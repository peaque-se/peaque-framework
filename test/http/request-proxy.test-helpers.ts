import type { FetchFunction } from '../../src/http/request-proxy.js';

/**
 * Creates a mock fetch function for testing proxy requests
 */
export function createMockFetch(
  mockResponse: {
    status: number;
    headers?: Record<string, string>;
    body?: string | Buffer;
  }
): { mockFetch: FetchFunction; capturedRequest: CapturedRequest } {
  const capturedRequest: CapturedRequest = {
    url: '',
    method: '',
    headers: {},
    body: undefined,
  };

  const mockFetch: FetchFunction = async (url: string | URL | Request, init?: RequestInit) => {
    // Capture the request details
    capturedRequest.url = typeof url === 'string' ? url : url.toString();
    capturedRequest.method = init?.method || 'GET';
    capturedRequest.headers = init?.headers as Record<string, string> || {};

    if (init?.body) {
      if (init.body instanceof Buffer) {
        capturedRequest.body = init.body;
      } else if (typeof init.body === 'string') {
        capturedRequest.body = Buffer.from(init.body);
      } else if (init.body instanceof ArrayBuffer) {
        capturedRequest.body = Buffer.from(init.body);
      }
    }

    // Return mock response
    const responseBody = mockResponse.body || '';
    const bodyBuffer = typeof responseBody === 'string'
      ? Buffer.from(responseBody)
      : responseBody;

    const mockHeaders = new Headers(mockResponse.headers || {});

    return {
      status: mockResponse.status,
      statusText: 'OK',
      ok: mockResponse.status >= 200 && mockResponse.status < 300,
      headers: mockHeaders,
      body: null,
      bodyUsed: false,
      redirected: false,
      type: 'basic' as ResponseType,
      url: capturedRequest.url,

      async arrayBuffer() {
        return bodyBuffer.buffer.slice(
          bodyBuffer.byteOffset,
          bodyBuffer.byteOffset + bodyBuffer.byteLength
        ) as ArrayBuffer;
      },
      async blob() {
        return new Blob([bodyBuffer as any]);
      },
      async bytes() {
        return new Uint8Array(bodyBuffer);
      },
      async text() {
        return bodyBuffer.toString();
      },
      async json() {
        return JSON.parse(bodyBuffer.toString());
      },
      async formData() {
        throw new Error('FormData not implemented in mock');
      },
      clone() {
        throw new Error('Clone not implemented in mock');
      },
    } as Response;
  };

  return { mockFetch, capturedRequest };
}

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Buffer;
}

/**
 * Example test usage:
 *
 * ```typescript
 * import { proxyRequest } from './request-proxy.js';
 * import { createMockFetch } from './request-proxy.test-helpers.js';
 *
 * // Test that Host header is changed
 * const { mockFetch, capturedRequest } = createMockFetch({
 *   status: 200,
 *   headers: { 'content-type': 'application/json' },
 *   body: '{"success": true}'
 * });
 *
 * await proxyRequest('http://target.com/api', {
 *   method: 'POST',
 *   headers: {
 *     'host': 'original.com',
 *     'user-agent': 'test-agent'
 *   },
 *   body: Buffer.from('test data'),
 *   clientIp: '192.168.1.1'
 * }, mockFetch);
 *
 * // Assert captured request
 * console.assert(capturedRequest.headers['host'] === 'target.com');
 * console.assert(capturedRequest.headers['x-forwarded-for'] === '192.168.1.1');
 * console.assert(capturedRequest.headers['x-forwarded-host'] === 'original.com');
 * console.assert(capturedRequest.body?.toString() === 'test data');
 * ```
 */
