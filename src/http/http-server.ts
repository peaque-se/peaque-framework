/**
 * HTTP server implementation with WebSocket support.
 *
 * This module provides the core HTTP server functionality for the Peaque framework,
 * including request handling, WebSocket upgrades, and error management.
 *
 * @module http/http-server
 */

import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import { CookieJarImpl, PeaqueRequestImpl } from "./default-impl.js";
import { parseRequestBody } from "./http-bodyparser.js";
import { HttpMethod, PeaqueWebSocket, RequestHandler, WebSocketHandler } from "./http-types.js";
import { InterruptFurtherProcessing } from "@peaque/framework";

/**
 * WebSocket wrapper that queues messages until the connection is established.
 *
 * This allows handlers to send messages immediately during the upgrade process,
 * with messages being queued and sent once the connection is fully established.
 */
class DeferredPeaqueWebSocket implements PeaqueWebSocket {
  private ws?: WebSocket;
  private pendingMessages: (string | Buffer)[] = [];
  private connected = false;

  constructor(private remoteAddr: string) {}

  /**
   * Connect the deferred socket to a real WebSocket connection.
   * Sends any queued messages immediately.
   *
   * @param ws - The real WebSocket connection
   */
  connect(ws: WebSocket): void {
    this.ws = ws;
    this.connected = true;
    // Send any pending messages
    for (const message of this.pendingMessages) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (error) {
          console.error("Failed to send queued message:", error);
        }
      }
    }
    this.pendingMessages = [];
  }

  send(data: string | Buffer): void {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
        throw error;
      }
    } else {
      // Queue the message until connected
      if (this.pendingMessages.length > 1000) {
        console.warn("WebSocket pending message queue is getting large:", this.pendingMessages.length);
      }
      this.pendingMessages.push(data);
    }
  }

  close(code?: number, reason?: string): void {
    if (this.ws) {
      this.ws.close(code, reason)
    }
  }

  getRemoteAddress(): string {
    return this.remoteAddr
  }

  isOpen(): boolean {
    return this.ws ? this.ws.readyState === WebSocket.OPEN : false
  }
}

/**
 * Extended request implementation with WebSocket upgrade support.
 *
 * This class extends the base request implementation to add WebSocket
 * upgrade capabilities.
 */
class PeaqueRequestImplWithWebSocket extends PeaqueRequestImpl {
  private wsUpgraded = false;
  private rawRequest?: http.IncomingMessage;
  private rawResponse?: http.ServerResponse;
  private server?: HttpServer;

  constructor(
    bodyData: any,
    paramsData: Record<string, string>,
    queryData: Record<string, string | string[]>,
    headersData: Record<string, string | string[]>,
    methodData: HttpMethod,
    pathData: string,
    originalUrlData: string,
    ipData: string,
    cookieHeader: string | undefined,
    rawBodyData: Buffer | undefined,
    rawRequest?: http.IncomingMessage,
    rawResponse?: http.ServerResponse,
    server?: HttpServer
  ) {
    super(bodyData, paramsData, queryData, headersData, methodData, pathData, originalUrlData, ipData, cookieHeader, rawBodyData);
    this.rawRequest = rawRequest;
    this.rawResponse = rawResponse;
    this.server = server;
  }

  isUpgradeRequest(): boolean {
    return this.rawRequest?.headers.upgrade === "websocket";
  }

  /**
   * Check if the WebSocket upgrade has been completed.
   * @returns true if upgraded
   */
  isWebSocketUpgraded(): boolean {
    return this.wsUpgraded;
  }

  upgradeToWebSocket(handler: WebSocketHandler): PeaqueWebSocket {
    this.responded = true;
    if (!this.rawRequest || !this.rawResponse || !this.server) {
      throw new Error("WebSocket upgrade not available - missing raw request/response/server");
    }

    if (!this.isUpgradeRequest()) {
      throw new Error("Not a WebSocket upgrade request");
    }

    if (this.wsUpgraded) {
      throw new Error("WebSocket has already been upgraded");
    }

    this.wsUpgraded = true;
    return this.server.handleWebSocketUpgrade(this.rawRequest, this.rawResponse, handler);
  }
}

/**
 * HTTP server with WebSocket support.
 *
 * This is the main server class that handles incoming HTTP requests and
 * WebSocket connections. It wraps Node.js's http.Server and ws.WebSocketServer.
 *
 * @example
 * ```typescript
 * const server = new HttpServer(async (req) => {
 *   req.send({ message: 'Hello' });
 * });
 * await server.startServer(3000);
 * ```
 */
export class HttpServer {
  private handler: RequestHandler;
  private server = null as http.Server | null;
  private wss?: WebSocketServer;

  /**
   * Create a new HTTP server
   * @param handler - The request handler function
   */
  constructor(handler: RequestHandler) {
    this.handler = handler;
  }

  /**
   * Handle a WebSocket upgrade request.
   *
   * This method performs the WebSocket handshake and sets up event handlers.
   *
   * @param req - The incoming HTTP request
   * @param res - The HTTP response
   * @param handler - WebSocket event handlers
   * @returns A deferred WebSocket instance
   * @throws {Error} If WebSocket server is not initialized
   */
  handleWebSocketUpgrade(req: http.IncomingMessage, res: http.ServerResponse, handler: WebSocketHandler): PeaqueWebSocket {
    if (!this.wss) {
      throw new Error("WebSocket server not initialized");
    }

    const remoteAddr = req.socket.remoteAddress || "";

    // Create a deferred WebSocket that will be connected after upgrade
    const deferredWs = new DeferredPeaqueWebSocket(remoteAddr);

    this.wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
      // Connect the deferred WebSocket to the real one
      deferredWs.connect(ws);

      // Set up event handlers with error handling
      ws.on("message", (message: string | Buffer) => {
        if (handler.onMessage) {
          try {
            handler.onMessage(message, deferredWs);
          } catch (error) {
            console.error("Error in WebSocket message handler:", error);
            if (handler.onError) {
              handler.onError(error instanceof Error ? error.message : String(error), deferredWs);
            }
          }
        }
      });

      ws.on("close", (code: number, reason: Buffer) => {
        if (handler.onClose) {
          try {
            handler.onClose(code, reason.toString(), deferredWs);
          } catch (error) {
            console.error("Error in WebSocket close handler:", error);
          }
        }
      });

      ws.on("error", (error: Error) => {
        if (handler.onError) {
          try {
            handler.onError(error.message, deferredWs);
          } catch (handlerError) {
            console.error("Error in WebSocket error handler:", handlerError);
          }
        } else {
          console.error("WebSocket error:", error);
        }
      });
    });

    return deferredWs;
  }

  /**
   * Start the HTTP server on the specified port.
   *
   * This method creates the HTTP server, sets up WebSocket support,
   * and begins listening for connections.
   *
   * @param port - The port number to listen on
   * @returns Promise that resolves when the server is listening
   * @throws {Error} If the server fails to start
   *
   * @example
   * ```typescript
   * await server.startServer(3000);
   * console.log('Server listening on port 3000');
   * ```
   */
  async startServer(port: number): Promise<void> {
    if (typeof port !== 'number' || port < 0 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    this.server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = req.url || "/"
      const requestPath = url.split("?")[0]
      // Parse query parameters from URL
      const urlObj = new URL(url, `http://${req.headers.host || "localhost"}`)
      const queryParams: Record<string, string | string[]> = {}
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (queryParams[key]) {
          if (Array.isArray(queryParams[key])) {
            ;(queryParams[key] as string[]).push(value)
          } else {
            queryParams[key] = [queryParams[key] as string, value]
          }
        } else {
          queryParams[key] = value
        }
      }

      // Parse request body
      const bodyResult = await parseRequestBody(req, queryParams)
      const finalQueryParams = bodyResult.updatedQueryParams

      // Convert headers to the expected format
      const headers: Record<string, string | string[]> = {}
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers[key] = value
        }
      }

      const peaqueReq: PeaqueRequestImplWithWebSocket = new PeaqueRequestImplWithWebSocket(
        bodyResult.body, // parsed body data
        {}, // params - now includes path parameters from route
        finalQueryParams, // query - includes URL params and form data
        headers, // headers
        req.method as HttpMethod,
        requestPath,
        url, // originalUrl
        req.socket.remoteAddress || "",
        req.headers.cookie,
        bodyResult.rawBody, // raw body buffer for webhook validation
        req, // pass the raw request for WebSocket upgrade
        res, // pass the raw response
        this // pass the server instance for WebSocket management
      )

      try {
        await this.handler(peaqueReq)
      } catch (err) {
        if (peaqueReq.isResponded() && (err instanceof InterruptFurtherProcessing || (err && typeof err === "object" && (err as any).type === "@peaque/framework/InterruptFurtherProcessing"))) {
          // Intended interruption of further processing - do nothing
        } else {
          console.error("Error in request handler:", err)
          peaqueReq.code(500).type("text/plain").send("500 - Internal Server Error")
        }
      }

      if (!peaqueReq.isResponded()) {
        // No route matched and no response sent - return 404 by default
        peaqueReq.code(404).type("text/plain").send("404 - Not Found")
      }

      // Only send response if WebSocket upgrade didn't happen
      if (!peaqueReq.isWebSocketUpgraded()) {
        // send the response
        res.statusCode = peaqueReq.statusCode
        res.setHeader("Content-Type", peaqueReq.contentType)
        for (const [key, values] of Object.entries(peaqueReq.headersData)) {
          for (const value of values) {
            res.setHeader(key, value)
          }
        }
        // take any cookies set in the response
        const cookies = peaqueReq.cookies() as CookieJarImpl
        for (const cookieStr of cookies.getSetCookieHeaders()) {
          res.setHeader("Set-Cookie", cookieStr)
        }

        if (peaqueReq.sendData !== undefined) {
          // handle different types of sendData (plain text, JSON, Buffer)
          if (typeof peaqueReq.sendData === "string") {
            res.end(peaqueReq.sendData)
          } else if (Buffer.isBuffer(peaqueReq.sendData)) {
            //res.setHeader("Content-Type", "application/octet-stream")
            res.end(peaqueReq.sendData)
          } else {
            res.end(JSON.stringify(peaqueReq.sendData))
          }
        } else {
          res.end()
        }
      }
    })

    // Set up WebSocket server for upgrade handling
    this.wss = new WebSocketServer({ noServer: true })

    return new Promise((resolve, reject) => {
      this.server!.listen(port, () => resolve())
      this.server!.on("error", reject)
    })
  }

  /**
   * Stop the HTTP server and close all connections.
   *
   * This method gracefully shuts down the server, closing all WebSocket
   * connections and stopping the HTTP server from accepting new connections.
   *
   * @example
   * ```typescript
   * server.stop();
   * console.log('Server stopped');
   * ```
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}
