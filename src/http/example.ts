import { Router } from "./http-router"
import { HttpServer } from "./http-server"
import { PeaqueRequest, WebSocketHandler } from "./http-types"

// Example usage with unified HTTP/WebSocket routing
const router = new Router()

// HTTP routes
router.addRoute("GET", "/", async (req: PeaqueRequest) => {
  console.log(`Received request: ${req.method()} ${req.url()}`)
  req.send("hello world")
})

// Unified WebSocket route - same path handles both HTTP and WebSocket
router.addRoute("GET", "/ws", async (req: PeaqueRequest) => {
  if (req.isUpgradeRequest()) {
    console.log(`🔌 WebSocket upgrade request to ${req.url()}`)
    
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
router.addRoute("GET", "/ws/chat/:roomId", async (req: PeaqueRequest) => {
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

const httpServer = new HttpServer(router)
httpServer.startServer(3001)
