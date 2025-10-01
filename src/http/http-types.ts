export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

export interface RequestHandler {
  (req: PeaqueRequest): Promise<void> | void
}

export interface RequestMiddleware {
  (req: PeaqueRequest, next: RequestHandler): Promise<void> | void
}

export interface PeaqueRequest {
  body<T = any>(): T
  rawBody(): Buffer | undefined
  isResponded(): boolean
  path(): string
  setPath(path: string): void
  param(name: string): string | undefined // first value of path params and query params
  paramNames(): string[] // all parameter names from path and query params
  pathParam(name: string): string | undefined // path param only, first value
  setPathParam(name: string, value: string): void // set path param value
  queryParam(name: string): string | undefined // query param only, first value
  queryString(): string // full query string, e.g. ?a=1&b=2
  setQueryParam(name: string, value: string[]): void // set query param value
  queryParamValues(name: string): string[] | undefined // query param only, all values
  requestHeader(name: string): string | undefined // header only
  requestHeaderValues(name: string): string[] | undefined // all header values
  proxyTo(url: string): Promise<void> // proxy request to another URL
  method(): HttpMethod
  originalUrl(): string
  ip(): string
  cookies(): CookieJar

  code(statusCode: number): PeaqueRequest
  header(name: string, value: string): PeaqueRequest
  type(contentType: string): PeaqueRequest
  send<T = unknown>(data?: T): void
  redirect(url: string, code?: number): void

  responseCode(): number
  responseBody(): unknown

  isUpgradeRequest(): boolean
  upgradeToWebSocket(handler: WebSocketHandler): PeaqueWebSocket
}

export interface CookieOptions {
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: "strict" | "lax" | "none"
}

export interface CookieJar {
  get(name: string): string | undefined
  getAll(): Record<string, string>
  set(name: string, value: string, options?: CookieOptions): void
  remove(name: string, options?: CookieOptions): void
}

export type MatchingRoute = {
  method: HttpMethod
  path: string
  parameters: Record<string, string>
  handler: RequestHandler
  middleware: RequestMiddleware[]
}

export interface PeaqueWebSocket {
  send(data: string | Buffer): void
  close(code?: number, reason?: string): void
  getRemoteAddress(): string
  isOpen(): boolean
}

export interface PeaqueWebSocketConnection {
  socket: PeaqueWebSocket
  path: string
  parameters: Record<string, string>
  query: Record<string, string | string[]>
  headers: Record<string, string | string[]>
  remoteAddress: string
}

export type WebSocketHandler = {
  onMessage?: (message: string | Buffer, ws: PeaqueWebSocket) => void
  onClose?: (code: number, reason: string, ws: PeaqueWebSocket) => void
  onError?: (error: string, ws: PeaqueWebSocket) => void
}
