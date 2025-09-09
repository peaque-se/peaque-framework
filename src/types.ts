import { FastifyRequest, FastifyReply } from 'fastify';

// Framework types that wrap Fastify types
export interface PeaqueRequest<T = any> {
  body: T;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  url: string;
  ip: string;
}

export interface PeaqueReply {
  code(statusCode: number): PeaqueReply;
  header(name: string, value: string): PeaqueReply;
  send(data?: any): void;
  type(contentType: string): PeaqueReply;
  redirect(url: string, code?: number): void;
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
  return {
    body: fastifyReq.body as T,
    params: fastifyReq.params as Record<string, string>,
    query: fastifyReq.query as Record<string, string | string[]>,
    headers: fastifyReq.headers,
    method: fastifyReq.method,
    url: fastifyReq.url,
    ip: fastifyReq.ip
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
    }
  };
}
