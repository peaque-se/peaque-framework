import http from "http"
import { WebSocket, WebSocketServer } from "ws"
import { PeaqueRequestImpl } from "../api-router"
import { Router } from "./http-router"
import { HttpMethod, PeaqueWebSocket, WebSocketHandler } from "./http-types"

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

  constructor(bodyData: any, paramsData: Record<string, string>, queryData: Record<string, string | string[]>, headersData: Record<string, string | string[]>, methodData: HttpMethod, urlData: string, ipData: string, cookieHeader: string | undefined, rawRequest?: http.IncomingMessage, rawResponse?: http.ServerResponse, server?: HttpServer) {
    super(bodyData, paramsData, queryData, headersData, methodData, urlData, ipData, cookieHeader)
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
  private router: Router
  private wss?: WebSocketServer

  constructor(router: Router) {
    this.router = router
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

      // WebSocket connection is now established
      console.log(`🔌 WebSocket connection established from ${remoteAddr}`)
    })

    return deferredWs
  }

  startServer(port: number): void {
    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = req.url || "/"
      const matchingRoute = this.router.getMatchingRoute(req.method as HttpMethod, url)

      if (!matchingRoute) {
        // Fallback 404 error
        res.statusCode = 404
        res.setHeader("Content-Type", "text/plain")
        res.end("404 Not Found")
      } else {
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

        // Convert headers to the expected format
        const headers: Record<string, string | string[]> = {}
        for (const [key, value] of Object.entries(req.headers)) {
          if (value !== undefined) {
            headers[key] = value
          }
        }

        const peaqueReq: PeaqueRequestImplWithWebSocket = new PeaqueRequestImplWithWebSocket(
          {}, // body - would need body parser middleware for actual body data
          matchingRoute.parameters || {}, // params - now includes path parameters from route
          queryParams, // query
          headers, // headers
          req.method as HttpMethod,
          url,
          req.socket.remoteAddress || "",
          req.headers.cookie,
          req, // pass the raw request for WebSocket upgrade
          res, // pass the raw response
          this // pass the server instance for WebSocket management
        )

        await matchingRoute.handler(peaqueReq)

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
          if (peaqueReq.sendData !== undefined) {
            res.end(typeof peaqueReq.sendData === "string" ? peaqueReq.sendData : JSON.stringify(peaqueReq.sendData))
          } else {
            res.end()
          }
        }
      }
    })

    // Set up WebSocket server for upgrade handling
    this.wss = new WebSocketServer({ noServer: true })

    server.listen(port)
    console.log(`🚀 HTTP server started on port ${port}`)
  }
}

/// http server todo
/// - parse body data into parameters when content-type is application/x-www-form-urlencoded
/// - parse body data into json when content-type is application/json
/// - support multipart/form-data for file uploads, adding file(name:string): FileUpload to PeaqueRequest
/// - support fallbacks for 404 and 500 errors with custom handlers
/// - add a handler for static files that is efficient