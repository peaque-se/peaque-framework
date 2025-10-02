/**
 * Testing utilities and helpers for writing tests.
 *
 * This module provides utilities for testing API routes, mocking requests,
 * and creating test fixtures.
 *
 * @module utils/testing
 */

import type { PeaqueRequest, RequestHandler, HttpMethod, CookieJar } from '../http/http-types.js';

/**
 * Mock request builder for testing
 */
export class MockRequest {
  private _body: any = {};
  private _rawBody?: Buffer;
  private _params: Record<string, string> = {};
  private _query: Record<string, string | string[]> = {};
  private _headers: Record<string, string | string[]> = {};
  private _method: HttpMethod = 'GET';
  private _path = '/';
  private _originalUrl = '/';
  private _ip = '127.0.0.1';
  private _cookies: Record<string, string> = {};
  private _statusCode = 200;
  private _contentType = 'application/json';
  private _responseHeaders: Record<string, string[]> = {};
  private _responseBody: any;
  private _responded = false;

  /**
   * Set request body
   */
  body(body: any): this {
    this._body = body;
    return this;
  }

  /**
   * Set request method
   */
  method(method: HttpMethod): this {
    this._method = method;
    return this;
  }

  /**
   * Set request path
   */
  path(path: string): this {
    this._path = path;
    this._originalUrl = path;
    return this;
  }

  /**
   * Set path parameter
   */
  param(name: string, value: string): this {
    this._params[name] = value;
    return this;
  }

  /**
   * Set query parameter
   */
  query(name: string, value: string | string[]): this {
    this._query[name] = value;
    return this;
  }

  /**
   * Set request header
   */
  header(name: string, value: string): this {
    this._headers[name] = value;
    return this;
  }

  /**
   * Set cookie
   */
  cookie(name: string, value: string): this {
    this._cookies[name] = value;
    return this;
  }

  /**
   * Build the mock request object
   */
  build(): PeaqueRequest {
    const mockCookies: CookieJar = {
      get: (name: string) => this._cookies[name],
      getAll: () => ({ ...this._cookies }),
      set: (name: string, value: string) => {
        this._cookies[name] = value;
      },
      remove: (name: string) => {
        delete this._cookies[name];
      }
    };

    return {
      body: () => this._body,
      rawBody: () => this._rawBody,
      isResponded: () => this._responded,
      path: () => this._path,
      setPath: (path: string) => { this._path = path; },
      param: (name: string) => this._params[name] || this._query[name] as string,
      paramNames: () => [...Object.keys(this._params), ...Object.keys(this._query)],
      pathParam: (name: string) => this._params[name],
      setPathParam: (name: string, value: string) => { this._params[name] = value; },
      queryParam: (name: string) => Array.isArray(this._query[name]) ? this._query[name][0] : this._query[name] as string,
      queryString: () => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(this._query)) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.set(key, value);
          }
        }
        return params.toString() ? `?${params.toString()}` : '';
      },
      setQueryParam: (name: string, value: string[]) => { this._query[name] = value; },
      queryParamValues: (name: string) => {
        const value = this._query[name];
        return Array.isArray(value) ? value : value ? [value] : undefined;
      },
      requestHeader: (name: string) => {
        const value = this._headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value as string;
      },
      requestHeaderValues: (name: string) => {
        const value = this._headers[name.toLowerCase()];
        return Array.isArray(value) ? value : value ? [value as string] : undefined;
      },
      proxyTo: async () => { throw new Error('proxyTo not implemented in mock'); },
      method: () => this._method,
      originalUrl: () => this._originalUrl,
      ip: () => this._ip,
      cookies: () => mockCookies,
      code: (statusCode: number) => {
        this._statusCode = statusCode;
        return this.build();
      },
      header: (name: string, value: string) => {
        if (!this._responseHeaders[name]) {
          this._responseHeaders[name] = [];
        }
        this._responseHeaders[name].push(value);
        return this.build();
      },
      type: (contentType: string) => {
        this._contentType = contentType;
        return this.build();
      },
      send: (data?: any) => {
        this._responseBody = data;
        this._responded = true;
      },
      redirect: (url: string, code = 302) => {
        this._statusCode = code;
        this._responseHeaders['Location'] = [url];
        this._responded = true;
      },
      responseCode: () => this._statusCode,
      responseBody: () => this._responseBody,
      isUpgradeRequest: () => false,
      upgradeToWebSocket: () => { throw new Error('WebSocket not supported in mock'); }
    };
  }
}

/**
 * Create a mock request for testing
 *
 * @example
 * ```typescript
 * const req = mockRequest()
 *   .method('POST')
 *   .path('/api/users')
 *   .body({ name: 'John' })
 *   .build();
 *
 * await handler(req);
 * expect(req.responseCode()).toBe(201);
 * ```
 */
export function mockRequest(): MockRequest {
  return new MockRequest();
}

/**
 * Test a request handler
 *
 * @param handler - The handler to test
 * @param request - Mock request builder
 * @returns The request object after handler execution
 *
 * @example
 * ```typescript
 * const result = await testHandler(
 *   myHandler,
 *   mockRequest().method('GET').path('/users')
 * );
 *
 * expect(result.responseCode()).toBe(200);
 * expect(result.responseBody()).toEqual([...users]);
 * ```
 */
export async function testHandler(
  handler: RequestHandler,
  request: MockRequest
): Promise<PeaqueRequest> {
  const req = request.build();
  await handler(req);
  return req;
}

/**
 * Assert response status code
 */
export function assertStatus(req: PeaqueRequest, expectedStatus: number): void {
  const actual = req.responseCode();
  if (actual !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${actual}`);
  }
}

/**
 * Assert response body matches expected
 */
export function assertBody(req: PeaqueRequest, expected: any): void {
  const actual = req.responseBody();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Body mismatch:\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

/**
 * Assert response was sent
 */
export function assertResponded(req: PeaqueRequest): void {
  if (!req.isResponded()) {
    throw new Error('Expected response to be sent, but it was not');
  }
}

/**
 * Create a spy function to track calls
 *
 * @example
 * ```typescript
 * const spy = createSpy();
 * await handler(req);
 * expect(spy.called).toBe(true);
 * expect(spy.callCount).toBe(1);
 * ```
 */
export function createSpy<T extends (...args: any[]) => any>() {
  const calls: Array<{ args: any[]; result?: any; error?: any }> = [];

  const spy = ((...args: any[]) => {
    const call: any = { args };
    calls.push(call);
    return undefined;
  }) as T & {
    calls: typeof calls;
    called: boolean;
    callCount: number;
    reset: () => void;
  };

  Object.defineProperty(spy, 'calls', { get: () => calls });
  Object.defineProperty(spy, 'called', { get: () => calls.length > 0 });
  Object.defineProperty(spy, 'callCount', { get: () => calls.length });
  spy.reset = () => calls.length = 0;

  return spy;
}

/**
 * Wait for a condition to be true
 *
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @param intervalMs - Check interval in milliseconds (default: 100)
 *
 * @example
 * ```typescript
 * await waitFor(() => spy.callCount > 0, 1000);
 * ```
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

/**
 * Create a test fixture factory
 *
 * @example
 * ```typescript
 * const createUser = fixture({
 *   id: '123',
 *   name: 'Test User',
 *   email: 'test@example.com'
 * });
 *
 * const user1 = createUser();
 * const user2 = createUser({ name: 'Other User' });
 * ```
 */
export function fixture<T extends object>(defaults: T): (overrides?: Partial<T>) => T {
  return (overrides?: Partial<T>): T => ({
    ...defaults,
    ...overrides
  });
}
