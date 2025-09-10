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
}

export interface RouteHandler {
  (req: PeaqueRequest): Promise<void> | void;
}
