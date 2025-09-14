import http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { CookieJarImpl, PeaqueRequestImpl } from "./default-impl.js"
import { parseRequestBody } from "./http-bodyparser.js"
import { HttpMethod, PeaqueWebSocket, RequestHandler, WebSocketHandler } from "./http-types.js"

class DeferredPeaqueWebSocket implements PeaqueWebSocket {
  private ws?: WebSocket
  private pendingMessages: (string | Buffer)[] = []
  private connected = false

  constructor(private remoteAddr: string) {}

  connect(ws: WebSocket): void {
    this.ws = ws
    this.connected = true
    // Send any pending messages
    for (const message of this.pendingMessages) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    }
    this.pendingMessages = []
  }

  send(data: string | Buffer): void {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      // Queue the message until connected
      this.pendingMessages.push(data)
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

class PeaqueRequestImplWithWebSocket extends PeaqueRequestImpl {
  private wsUpgraded = false
  private rawRequest?: http.IncomingMessage
  private rawResponse?: http.ServerResponse
  private server?: HttpServer

  constructor(bodyData: any, paramsData: Record<string, string>, queryData: Record<string, string | string[]>, headersData: Record<string, string | string[]>, methodData: HttpMethod, pathData: string, originalUrlData: string, ipData: string, cookieHeader: string | undefined, rawRequest?: http.IncomingMessage, rawResponse?: http.ServerResponse, server?: HttpServer) {
    super(bodyData, paramsData, queryData, headersData, methodData, pathData, originalUrlData, ipData, cookieHeader)
    this.rawRequest = rawRequest
    this.rawResponse = rawResponse
    this.server = server
  }

  isUpgradeRequest(): boolean {
    return this.rawRequest?.headers.upgrade === "websocket"
  }

  isWebSocketUpgraded(): boolean {
    return this.wsUpgraded
  }

  upgradeToWebSocket(handler: WebSocketHandler): PeaqueWebSocket {
    this.responded = true
    if (!this.rawRequest || !this.rawResponse || !this.server) {
      throw new Error("WebSocket upgrade not available - missing raw request/response/server")
    }

    if (!this.isUpgradeRequest()) {
      throw new Error("Not a WebSocket upgrade request")
    }

    this.wsUpgraded = true
    return this.server.handleWebSocketUpgrade(this.rawRequest, this.rawResponse, handler)
  }
}

export class HttpServer {
  private handler: RequestHandler
  private server = null as http.Server | null
  private wss?: WebSocketServer

  constructor(handler: RequestHandler) {
    this.handler = handler
  }

  handleWebSocketUpgrade(req: http.IncomingMessage, res: http.ServerResponse, handler: WebSocketHandler): PeaqueWebSocket {
    if (!this.wss) {
      throw new Error("WebSocket server not initialized")
    }

    const remoteAddr = req.socket.remoteAddress || ""

    // Create a deferred WebSocket that will be connected after upgrade
    const deferredWs = new DeferredPeaqueWebSocket(remoteAddr)

    this.wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
      // Connect the deferred WebSocket to the real one
      deferredWs.connect(ws)

      // Set up event handlers
      ws.on("message", (message: string | Buffer) => {
        if (handler.onMessage) {
          handler.onMessage(message, deferredWs)
        }
      })

      ws.on("close", (code: number, reason: Buffer) => {
        if (handler.onClose) {
          handler.onClose(code, reason.toString(), deferredWs)
        }
      })

      ws.on("error", (error: Error) => {
        if (handler.onError) {
          handler.onError(error.message, deferredWs)
        }
      })
    })

    return deferredWs
  }

  startServer(port: number): void {
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
        req, // pass the raw request for WebSocket upgrade
        res, // pass the raw response
        this // pass the server instance for WebSocket management
      )

      try {
        await this.handler(peaqueReq)
      } catch (err) {
        console.error("Error in request handler:", err)
        peaqueReq.code(500).type("text/plain").send("500 - Internal Server Error")
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

    this.server.listen(port)
  }

  stop() {
    this.wss?.close()
    this.server?.close()
  }
}

