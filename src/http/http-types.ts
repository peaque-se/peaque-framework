// Cookie jar interface for managing cookies
export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface CookieJar {
  get(name: string): string | undefined;
  getAll(): Record<string, string>;
  set(name: string, value: string, options?: CookieOptions): void;
  remove(name: string, options?: CookieOptions): void;
}

// Framework types that represent a HTTP request and reply

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface PeaqueRequest {
  body<T=any>(): T;
  param(name: string): string | undefined; // first value of path params and query params
  pathParam(name: string): string | undefined; // path param only, first value
  queryParam(name: string): string | undefined; // query param only, first value
  queryParamValues(name: string): string[] | undefined; // query param only, all values
  requestHeader(name: string): string | undefined; // header only
  requestHeaderValues(name: string): string[] | undefined; // all header values
  method(): HttpMethod;
  url(): string;
  ip(): string;
  cookies(): CookieJar;

  code(statusCode: number): PeaqueRequest;
  header(name: string, value: string): PeaqueRequest;
  send<T=any>(data?: T): void;
  type(contentType: string): PeaqueRequest;
  redirect(url: string, code?: number): void;
  
  // WebSocket upgrade support
  isUpgradeRequest(): boolean;
  upgradeToWebSocket(handler: WebSocketHandler): PeaqueWebSocket;
}

export interface RouteHandler {
  (req: PeaqueRequest): Promise<void> | void;
}

// HTTP routing types
export type MatchingRoute = {
  method: HttpMethod
  path: string
  parameters: Record<string, string>
  handler: (req: PeaqueRequest) => Promise<void> | void
}

// WebSocket types
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