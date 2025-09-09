import { FastifyRequest, FastifyReply } from 'fastify';

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

export class CookieJar {
  private cookies: Map<string, string> = new Map();
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
        const value = valueParts.join('=');
        this.cookies.set(name.trim(), value.trim());
      }
    }
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    this.cookies.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  set(name: string, value: string, options?: CookieOptions): void {
    this.responseCookies.set(name, { value, options });
  }

  remove(name: string, options?: CookieOptions): void {
    this.responseCookies.set(name, { value: '', options: { ...options, maxAge: 0 } });
  }

  getResponseCookies(): Map<string, { value: string; options?: CookieOptions }> {
    return this.responseCookies;
  }

  clearResponseCookies(): void {
    this.responseCookies.clear();
  }
}

// Framework types that wrap Fastify types
export interface PeaqueRequest<T = any> {
  body: T;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  ip: string;
  cookies: CookieJar;
}

export interface PeaqueReply {
  code(statusCode: number): PeaqueReply;
  header(name: string, value: string): PeaqueReply;
  send(data?: any): void;
  type(contentType: string): PeaqueReply;
  redirect(url: string, code?: number): void;
  setCookie(name: string, value: string, options?: CookieOptions): PeaqueReply;
  clearCookie(name: string, options?: CookieOptions): PeaqueReply;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface RouteHandler<T = any> {
  (req: PeaqueRequest<T>, reply: PeaqueReply): Promise<void> | void;
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
}

export interface BuildResult {
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

// Utility types for converting Fastify types to Peaque types
export function createPeaqueRequest<T = any>(fastifyReq: FastifyRequest): PeaqueRequest<T> {
  const cookieHeader = fastifyReq.headers.cookie as string;
  return {
    body: fastifyReq.body as T,
    params: fastifyReq.params as Record<string, string>,
    query: fastifyReq.query as Record<string, string | string[]>,
    headers: fastifyReq.headers,
    method: fastifyReq.method,
    url: fastifyReq.url,
    ip: fastifyReq.ip,
    cookies: new CookieJar(cookieHeader)
  };
}

export function createPeaqueReply(fastifyReply: FastifyReply): PeaqueReply {
  return {
    code: (statusCode: number) => {
      fastifyReply.code(statusCode);
      return createPeaqueReply(fastifyReply);
    },
    header: (name: string, value: string) => {
      fastifyReply.header(name, value);
      return createPeaqueReply(fastifyReply);
    },
    send: (data?: any) => {
      fastifyReply.send(data);
    },
    type: (contentType: string) => {
      fastifyReply.type(contentType);
      return createPeaqueReply(fastifyReply);
    },
    redirect: (url: string, code?: number) => {
      fastifyReply.redirect(url, code);
    },
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      let cookieValue = `${name}=${value}`;

      if (options) {
        if (options.maxAge !== undefined) {
          cookieValue += `; Max-Age=${options.maxAge}`;
        }
        if (options.expires) {
          cookieValue += `; Expires=${options.expires.toUTCString()}`;
        }
        if (options.path) {
          cookieValue += `; Path=${options.path}`;
        }
        if (options.domain) {
          cookieValue += `; Domain=${options.domain}`;
        }
        if (options.secure) {
          cookieValue += `; Secure`;
        }
        if (options.httpOnly) {
          cookieValue += `; HttpOnly`;
        }
        if (options.sameSite) {
          cookieValue += `; SameSite=${options.sameSite}`;
        }
      }

      fastifyReply.header('Set-Cookie', cookieValue);
      return createPeaqueReply(fastifyReply);
    },
    clearCookie: (name: string, options?: CookieOptions) => {
      let cookieValue = `${name}=; Max-Age=0`;

      if (options) {
        if (options.path) {
          cookieValue += `; Path=${options.path}`;
        }
        if (options.domain) {
          cookieValue += `; Domain=${options.domain}`;
        }
        if (options.secure) {
          cookieValue += `; Secure`;
        }
        if (options.httpOnly) {
          cookieValue += `; HttpOnly`;
        }
        if (options.sameSite) {
          cookieValue += `; SameSite=${options.sameSite}`;
        }
      }

      fastifyReply.header('Set-Cookie', cookieValue);
      return createPeaqueReply(fastifyReply);
    }
  };
}
