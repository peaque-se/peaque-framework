import { addAssetRoutesForFolder } from "../assets/asset-handler"
import { Router } from "./http-router"
import { HttpServer } from "./http-server"
import { PeaqueRequest, RequestHandler, RequestMiddleware, WebSocketHandler } from "./http-types"

// Example usage with unified HTTP/WebSocket routing
const router = new Router()

// Example middleware functions
const authMiddleware: RequestMiddleware = async (req: PeaqueRequest, next: RequestHandler) => {
  console.log(`🔐 Auth middleware: ${req.method()} ${req.path()}`)
  // Simulate authentication check
  const authHeader = req.requestHeader('authorization')
  if (!authHeader) {
    req.code(401).send('Unauthorized')
    return
  }
  await next(req)
}

const loggingMiddleware: RequestMiddleware = async (req: PeaqueRequest, next: RequestHandler) => {
  console.log(`📝 Logging middleware: ${req.method()} ${req.path()}`)
  const start = Date.now()
  await next(req)
  const duration = Date.now() - start
  console.log(`📝 Request completed in ${duration}ms`)
}

const corsMiddleware: RequestMiddleware = async (req: PeaqueRequest, next: RequestHandler) => {
  console.log(`🌐 CORS middleware: ${req.method()} ${req.path()}`)
  req.header('Access-Control-Allow-Origin', '*')
  req.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  req.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  await next(req)
}

// HTTP routes with stackable middleware using the new instance-based pattern
const baseRouter = router

// Create router with CORS middleware
const corsRouter = baseRouter.use(corsMiddleware)

// Create router with CORS + logging middleware
const loggedRouter = corsRouter.use(loggingMiddleware)

// Routes added to loggedRouter will have both CORS and logging middleware
loggedRouter
  .addRoute("GET", "/", async (req: PeaqueRequest) => {
    console.log(`Received request: ${req.method()} ${req.path()}`)
    req.send("hello world")
  })
  .addRoute("GET", "/public", async (req: PeaqueRequest) => {
    req.send("This is a public route with CORS and logging middleware")
  })

// Create router with CORS + logging + auth middleware
const protectedRouter = loggedRouter.use(authMiddleware)

// Routes added to protectedRouter will have CORS, logging, and auth middleware
protectedRouter
  .addRoute("GET", "/protected", async (req: PeaqueRequest) => {
    req.send("This is a protected route with auth, logging, and CORS middleware")
  })
  .addRoute("POST", "/protected/data", async (req: PeaqueRequest) => {
    req.send("Protected POST endpoint with full middleware stack")
  })

// Routes added to corsRouter will only have CORS middleware
corsRouter.addRoute("GET", "/cors-only", async (req: PeaqueRequest) => {
  req.send("This route only has CORS middleware")
})

// Routes added to baseRouter will have no middleware
baseRouter.addRoute("GET", "/no-middleware", async (req: PeaqueRequest) => {
  req.send("This route has no middleware")
})



baseRouter.addRoute("POST", "/post/:apa", async (req: PeaqueRequest) => {
  console.log(`Received request: ${req.method()} ${req.path()}`)
  console.log('Body content type:', req.requestHeader('content-type'))
  console.log('Body:', req.body())
  // parameters
  console.log('Parameter names:', req.paramNames())
  req.send("hello world")
})

// Unified WebSocket route - same path handles both HTTP and WebSocket
baseRouter.addRoute("GET", "/ws", async (req: PeaqueRequest) => {
  if (req.isUpgradeRequest()) {
    console.log(`🔌 WebSocket upgrade request to ${req.path()}`)
    
    const wsHandler: WebSocketHandler = {
      onMessage: (message, ws) => {
        console.log(`📨 Received message on /ws: ${message}`)
        ws.send(JSON.stringify({ type: 'echo', data: message.toString() }))
      },
      onClose: (code, reason, ws) => {
        console.log(`🔌 WebSocket connection closed: ${code} ${reason}`)
      },
      onError: (error, ws) => {
        console.error(`❌ WebSocket error: ${error}`)
      }
    }
    
    const ws = req.upgradeToWebSocket(wsHandler)
    // Can immediately use the WebSocket!
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server!' }))
  } else {
    req.send("This endpoint supports WebSocket connections. Use a WebSocket client to connect.")
  }
})

// WebSocket route with parameters - unified handling
baseRouter.addRoute("GET", "/ws/chat/:roomId", async (req: PeaqueRequest) => {
  const roomId = req.pathParam("roomId") || "unknown"
  
  if (req.isUpgradeRequest()) {
    console.log(`🔌 WebSocket upgrade request for chat room: ${roomId}`)
    
    const wsHandler: WebSocketHandler = {
      onMessage: (message, ws) => {
        console.log(`📨 Chat message in room ${roomId}: ${message}`)
        // Echo back to the same client
        ws.send(JSON.stringify({ type: 'message', room: roomId, data: message.toString() }))
      },
      onClose: (code, reason, ws) => {
        console.log(`🔌 User left chat room ${roomId}: ${code} ${reason}`)
      },
      onError: (error, ws) => {
        console.error(`❌ WebSocket error in room ${roomId}: ${error}`)
      }
    }
    
    const ws = req.upgradeToWebSocket(wsHandler)
    // Send welcome message immediately
    ws.send(JSON.stringify({ type: 'joined', room: roomId, message: `Welcome to chat room ${roomId}!` }))
  } else {
    req.send(`Chat room: ${roomId}. Connect with a WebSocket client to join the chat.`)
  }
})

const httpServer = new HttpServer(baseRouter.getRequestHandler())
httpServer.startServer(3001)
