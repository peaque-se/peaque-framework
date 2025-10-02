/**
 * HTTP methods supported by the framework
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

/**
 * Handler function for processing HTTP requests
 *
 * @example
 * ```typescript
 * // In api/users/route.ts
 * export const GET: RequestHandler = async (req) => {
 *   const users = await db.getUsers();
 *   req.send(users);
 * };
 * ```
 */
export interface RequestHandler {
  (req: PeaqueRequest): Promise<void> | void;
}

/**
 * Middleware function for processing HTTP requests before handlers
 *
 * @param req - The request object
 * @param next - Function to call the next handler in the chain
 *
 * @example
 * ```typescript
 * const authMiddleware: RequestMiddleware = async (req, next) => {
 *   if (!req.cookies().get('auth')) {
 *     req.code(401).send({ error: 'Unauthorized' });
 *     return;
 *   }
 *   await next(req);
 * };
 * ```
 */
export interface RequestMiddleware {
  (req: PeaqueRequest, next: RequestHandler): Promise<void> | void;
}

/**
 * Main request object providing access to request data and response methods.
 *
 * This is the primary interface for handling HTTP requests in route handlers.
 * It provides methods for reading request data and sending responses.
 *
 * @example
 * ```typescript
 * export const GET: RequestHandler = async (req: PeaqueRequest) => {
 *   const userId = req.pathParam('id');
 *   const filter = req.queryParam('filter');
 *   req.code(200).send({ userId, filter });
 * };
 * ```
 */
export interface PeaqueRequest {
  // Request Body Methods

  /**
   * Get the parsed request body
   * @returns The parsed body (JSON, form data, etc.)
   */
  body<T = any>(): T;

  /**
   * Get the raw request body buffer
   * @returns The raw body buffer, or undefined if not available
   */
  rawBody(): Buffer | undefined;

  // Request State Methods

  /**
   * Check if a response has been sent
   * @returns true if response was already sent
   */
  isResponded(): boolean;

  // Path and URL Methods

  /**
   * Get the request path (without query string)
   * @returns The request path (e.g., "/api/users/123")
   */
  path(): string;

  /**
   * Set the request path (for internal routing)
   * @param path - The new path to set
   */
  setPath(path: string): void;

  /**
   * Get the original full URL including query string
   * @returns The original URL (e.g., "/api/users?page=1")
   */
  originalUrl(): string;

  // Parameter Methods

  /**
   * Get a parameter value (checks both path and query params)
   * @param name - Parameter name
   * @returns The first parameter value, or undefined
   */
  param(name: string): string | undefined;

  /**
   * Get all parameter names from path and query params
   * @returns Array of parameter names
   */
  paramNames(): string[];

  /**
   * Get a path parameter value (from route pattern like /users/:id)
   * @param name - Path parameter name
   * @returns The parameter value, or undefined
   */
  pathParam(name: string): string | undefined;

  /**
   * Set a path parameter value (for internal routing)
   * @param name - Parameter name
   * @param value - Parameter value
   */
  setPathParam(name: string, value: string): void;

  // Query Parameter Methods

  /**
   * Get a query parameter value (first value if multiple)
   * @param name - Query parameter name
   * @returns The first query parameter value, or undefined
   */
  queryParam(name: string): string | undefined;

  /**
   * Get all values for a query parameter
   * @param name - Query parameter name
   * @returns Array of all values, or undefined
   */
  queryParamValues(name: string): string[] | undefined;

  /**
   * Get the full query string
   * @returns The query string (e.g., "?a=1&b=2")
   */
  queryString(): string;

  /**
   * Set a query parameter value (for internal routing)
   * @param name - Parameter name
   * @param value - Array of values
   */
  setQueryParam(name: string, value: string[]): void;

  // Header Methods

  /**
   * Get a request header value (first value if multiple)
   * @param name - Header name (case-insensitive)
   * @returns The header value, or undefined
   */
  requestHeader(name: string): string | undefined;

  /**
   * Get all values for a request header
   * @param name - Header name (case-insensitive)
   * @returns Array of all header values, or undefined
   */
  requestHeaderValues(name: string): string[] | undefined;

  // Other Request Methods

  /**
   * Get the HTTP method
   * @returns The HTTP method (GET, POST, etc.)
   */
  method(): HttpMethod;

  /**
   * Get the client IP address
   * @returns The IP address
   */
  ip(): string;

  /**
   * Get the cookie jar for reading/writing cookies
   * @returns The cookie jar instance
   */
  cookies(): CookieJar;

  /**
   * Proxy the request to another URL
   * @param url - The target URL to proxy to
   * @returns Promise that resolves when proxy is complete
   */
  proxyTo(url: string): Promise<void>;

  // Response Methods (chainable)

  /**
   * Set the HTTP status code
   * @param statusCode - The status code (e.g., 200, 404, 500)
   * @returns this for chaining
   */
  code(statusCode: number): PeaqueRequest;

  /**
   * Set a response header
   * @param name - Header name
   * @param value - Header value
   * @returns this for chaining
   */
  header(name: string, value: string): PeaqueRequest;

  /**
   * Set the Content-Type header
   * @param contentType - The content type (e.g., "application/json")
   * @returns this for chaining
   */
  type(contentType: string): PeaqueRequest;

  /**
   * Send a response (JSON, string, or Buffer)
   * @param data - The data to send
   */
  send<T = unknown>(data?: T): void;

  /**
   * Send a redirect response
   * @param url - The URL to redirect to
   * @param code - The status code (default: 302)
   */
  redirect(url: string, code?: number): void;

  // Response Inspection Methods

  /**
   * Get the response status code that will be sent
   * @returns The status code
   */
  responseCode(): number;

  /**
   * Get the response body that will be sent
   * @returns The response body
   */
  responseBody(): unknown;

  // WebSocket Methods

  /**
   * Check if this is a WebSocket upgrade request
   * @returns true if this is a WebSocket upgrade request
   */
  isUpgradeRequest(): boolean;

  /**
   * Upgrade the connection to a WebSocket
   * @param handler - WebSocket event handlers
   * @returns The WebSocket instance
   */
  upgradeToWebSocket(handler: WebSocketHandler): PeaqueWebSocket;
}

/**
 * Options for setting cookies
 */
export interface CookieOptions {
  /** Maximum age in seconds */
  maxAge?: number;
  /** Expiration date */
  expires?: Date;
  /** Cookie path (default: "/") */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag (HTTPS only) */
  secure?: boolean;
  /** HttpOnly flag (not accessible via JavaScript) */
  httpOnly?: boolean;
  /** SameSite policy */
  sameSite?: "strict" | "lax" | "none";
}

/**
 * Cookie jar for reading and writing cookies
 *
 * @example
 * ```typescript
 * const cookies = req.cookies();
 * const sessionId = cookies.get('session');
 * cookies.set('user', 'john', { maxAge: 3600, httpOnly: true });
 * ```
 */
export interface CookieJar {
  /**
   * Get a cookie value by name
   * @param name - Cookie name
   * @returns The cookie value, or undefined
   */
  get(name: string): string | undefined;

  /**
   * Get all cookies as an object
   * @returns Object with all cookie name-value pairs
   */
  getAll(): Record<string, string>;

  /**
   * Set a cookie
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - Cookie options
   */
  set(name: string, value: string, options?: CookieOptions): void;

  /**
   * Remove a cookie
   * @param name - Cookie name
   * @param options - Cookie options (should match the options used when setting)
   */
  remove(name: string, options?: CookieOptions): void;
}

/**
 * Internal type representing a matched route
 * @internal
 */
export type MatchingRoute = {
  method: HttpMethod;
  path: string;
  parameters: Record<string, string>;
  handler: RequestHandler;
  middleware: RequestMiddleware[];
};

/**
 * WebSocket connection wrapper
 */
export interface PeaqueWebSocket {
  /**
   * Send data through the WebSocket
   * @param data - String or Buffer to send
   */
  send(data: string | Buffer): void;

  /**
   * Close the WebSocket connection
   * @param code - Close code (default: 1000)
   * @param reason - Close reason
   */
  close(code?: number, reason?: string): void;

  /**
   * Get the remote client address
   * @returns The IP address
   */
  getRemoteAddress(): string;

  /**
   * Check if the WebSocket is open
   * @returns true if open
   */
  isOpen(): boolean;
}

/**
 * WebSocket connection information
 */
export interface PeaqueWebSocketConnection {
  /** The WebSocket instance */
  socket: PeaqueWebSocket;
  /** The request path */
  path: string;
  /** Path parameters */
  parameters: Record<string, string>;
  /** Query parameters */
  query: Record<string, string | string[]>;
  /** Request headers */
  headers: Record<string, string | string[]>;
  /** Client IP address */
  remoteAddress: string;
}

/**
 * WebSocket event handlers
 *
 * @example
 * ```typescript
 * const handler: WebSocketHandler = {
 *   onMessage: (message, ws) => {
 *     console.log('Received:', message);
 *     ws.send('Echo: ' + message);
 *   },
 *   onClose: (code, reason) => {
 *     console.log('Closed:', code, reason);
 *   }
 * };
 * ```
 */
export type WebSocketHandler = {
  /**
   * Called when a message is received
   * @param message - The received message
   * @param ws - The WebSocket instance
   */
  onMessage?: (message: string | Buffer, ws: PeaqueWebSocket) => void;

  /**
   * Called when the connection is closed
   * @param code - The close code
   * @param reason - The close reason
   * @param ws - The WebSocket instance
   */
  onClose?: (code: number, reason: string, ws: PeaqueWebSocket) => void;

  /**
   * Called when an error occurs
   * @param error - The error message
   * @param ws - The WebSocket instance
   */
  onError?: (error: string, ws: PeaqueWebSocket) => void;
};
