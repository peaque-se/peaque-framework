import type { CookieJar, CookieOptions, HttpMethod, PeaqueRequest, RouteHandler, WebSocketHandler, PeaqueWebSocket } from "./public-types";

// Implementation of a simple CookieJar to manage cookies in requests and responses
export class CookieJarImpl implements CookieJar {
  private requestCookies: Map<string, string> = new Map();
  private responseCookies: Map<string, { value: string; options?: CookieOptions }> = new Map();

  constructor(cookieHeader?: string) {
    if (cookieHeader) {
      this.parseCookies(cookieHeader);
    }
  }

  private parseCookies(cookieHeader: string): void {
    // Parse cookie header like "name1=value1; name2=value2"
    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.trim().split('=');
      if (name && valueParts.length > 0) {
        const value = decodeURIComponent(valueParts.join('='));
        this.requestCookies.set(name.trim(), value.trim());
      }
    }
  }

  get(name: string): string | undefined {
    return this.requestCookies.get(name);
  }

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    this.requestCookies.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  set(name: string, value: string, options?: CookieOptions): void {
    this.responseCookies.set(name, { value, options });
  }

  remove(name: string, options?: CookieOptions): void {
    // To remove a cookie, set it with an expired date
    this.responseCookies.set(name, { value: '', options: { ...options, maxAge: 0 } });
  }

  getSetCookieHeaders(): string[] {
    const headers: string[] = [];
    this.responseCookies.forEach((cookie, name) => {
      let cookieString = `${name}=${encodeURIComponent(cookie.value)}`;
      if (cookie.options) {
        if (cookie.options.maxAge !== undefined) {
          cookieString += `; Max-Age=${cookie.options.maxAge}`;
        }
        if (cookie.options.expires) {
          cookieString += `; Expires=${cookie.options.expires.toUTCString()}`;
        }
        if (cookie.options.path) {
          cookieString += `; Path=${cookie.options.path}`;
        }
        if (cookie.options.domain) {
          cookieString += `; Domain=${cookie.options.domain}`;
        }
        if (cookie.options.secure) {
          cookieString += `; Secure`;
        }
        if (cookie.options.httpOnly) {
          cookieString += `; HttpOnly`;
        }
        if (cookie.options.sameSite) {
          cookieString += `; SameSite=${cookie.options.sameSite}`;
        }
      }
      headers.push(cookieString);
    });
    return headers;
  }
}

// implementation that keeps all data in memory (copied from a http request implementation)
export class PeaqueRequestImpl implements PeaqueRequest {
  private requestBodyData: any;
  private paramsData: Record<string, string>;
  private queryData: Record<string, string | string[]>;
  private requestHeadersData: Record<string, string | string[]>;
  private methodData: HttpMethod
  private urlData: string;
  private ipData: string
  private cookieJar: CookieJarImpl;

  statusCode: number = 200;
  headersData: Record<string, string[]> = {};
  contentType: string = 'application/json';
  sendData: any = null;

  constructor(
    bodyData: any,
    paramsData: Record<string, string>,
    queryData: Record<string, string | string[]>,
    headersData: Record<string, string | string[]>,
    methodData: HttpMethod,
    urlData: string,
    ipData: string,
    cookieHeader: string | undefined,
  ) {
    this.requestBodyData = bodyData;
    this.paramsData = paramsData;
    this.queryData = queryData;
    this.requestHeadersData = headersData;
    this.methodData = methodData;
    this.urlData = urlData;
    this.ipData = ipData;
    this.cookieJar = new CookieJarImpl(cookieHeader);
  }

  body<T = any>(): T {
    return this.requestBodyData as T;
  }
  param(name: string): string | undefined {
    return this.paramsData[name] || this.queryParam(name);
  }
  pathParam(name: string): string | undefined {
    return this.paramsData[name];
  }
  queryParam(name: string): string | undefined {
    const value = this.queryData[name];
    return Array.isArray(value) ? value[0] : value;
  }
  queryParamValues(name: string): string[] | undefined {
    const value = this.queryData[name];
    return Array.isArray(value) ? value : value !== undefined ? [value] : undefined;
  }
  requestHeader(name: string): string | undefined {
    const value = this.requestHeadersData[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
  requestHeaderValues(name: string): string[] | undefined {
    const value = this.requestHeadersData[name.toLowerCase()];
    return Array.isArray(value) ? value : value !== undefined ? [value] : undefined;
  }
  method(): HttpMethod {
    return this.methodData;
  }
  url(): string {
    return this.urlData;
  }
  ip(): string {
    return this.ipData;
  }
  cookies(): CookieJar {
    return this.cookieJar;
  }

  code(statusCode: number): PeaqueRequest {
    this.statusCode = statusCode;
    return this;
  }
  header(name: string, value: string): PeaqueRequest {
    name = name.toLowerCase();
    if (!this.headersData[name]) {
      this.headersData[name] = [];
    }
    this.headersData[name].push(value);
    return this;
  }
  send<T = any>(data?: T): void {
    this.sendData = data;
  }
  type(contentType: string): PeaqueRequest {
    this.contentType = contentType;
    return this;
  }
  redirect(url: string, code: number = 302): void {
    this.statusCode = code;
    this.header('Location', url);
    this.sendData = `Redirecting to ${url}`; // Optional body for redirect?!
  }

  // WebSocket upgrade support (not implemented in this basic request implementation)
  isUpgradeRequest(): boolean {
    return false; // This implementation doesn't support WebSocket upgrades
  }

  upgradeToWebSocket(handler: any): any {
    throw new Error('WebSocket upgrade not supported in this request implementation');
  }
}

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  filePath: string;
}

export interface FrameworkConfig {
  port?: number;
  host?: string;
  dev?: boolean;
  pagesDir?: string;
  apiDir?: string;
  publicDir?: string;
  buildDir?: string;
  logger?: boolean | object;
  betaAccess?: {
    enabled?: boolean;
    secret?: string;
    cookieName?: string;
  };
}

export interface BuildResult {
  success: boolean;
  errors?: string[];
  warnings?: string[];
}
