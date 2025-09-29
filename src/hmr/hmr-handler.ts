import { PeaqueWebSocket, RequestHandler } from "../http/http-types.js"
import colors from "yoctocolors"

const connectedClients = new Set<PeaqueWebSocket>()

export const getHmrClientJs = (port: number) => {
  return `if (typeof window !== 'undefined') {
  let reconnectAttempts = 0;
  const maxAttempts = 5;

  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/hmr');
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'reload') window.location.reload();
    };
    ws.onclose = () => {
      if (reconnectAttempts++ < maxAttempts) setTimeout(connect, 1000);
    };
  }
  connect();
}`
}

export const hmrConnectHandler: RequestHandler = async (req) => {
  // This is a WebSocket upgrade request for HMR
  if (req.isUpgradeRequest()) {
    const ws = await req.upgradeToWebSocket({
      onMessage: (message, ws) => {},
      onClose: (code, reason, ws) => {},
      onError: (error, ws) => {},
    })
    connectedClients.add(ws)
  }
}

export function notifyConnectedClients(data: any = {}, reason = "application") {
  if (connectedClients.size > 0) {
    connectedClients.forEach((ws) => {
      if (ws.isOpen()) {
        ws.send(JSON.stringify({ type: "reload", data }))
      } else {
        connectedClients.delete(ws)
      }
    })
    //console.log(`📡 Updated ${colors.gray(reason)} (${connectedClients.size} client${connectedClients.size === 1 ? "" : "s"})`)
  }
}
