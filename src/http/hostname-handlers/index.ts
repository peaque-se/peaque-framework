import http from "http"

export const CustomHostNameNodeHandler: Record<string, (req: http.IncomingMessage, res: http.ServerResponse)=>Promise<void>> = {}
