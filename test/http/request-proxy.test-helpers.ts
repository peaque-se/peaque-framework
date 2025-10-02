import type { HttpClient } from '../../src/http/request-proxy.js';

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Buffer;
}

/**
 * Creates a mock HTTP client for testing proxy requests
 */
export function createMockHttpClient(
  mockResponse: {
    status: number;
    headers?: Record<string, string>;
    body?: string | Buffer;
  }
): { mockClient: HttpClient; capturedRequest: CapturedRequest } {
  const capturedRequest: CapturedRequest = {
    url: '',
    method: '',
    headers: {},
    body: undefined,
  };

  const mockClient: HttpClient = {
    async request(url, options) {
      // Capture the request details
      capturedRequest.url = url;
      capturedRequest.method = options.method;
      capturedRequest.headers = options.headers;
      // Only capture body if it exists and has length
      capturedRequest.body = (options.body && options.body.length > 0) ? options.body : undefined;

      // Return mock response
      const responseBody = mockResponse.body || '';
      const bodyBuffer = typeof responseBody === 'string'
        ? Buffer.from(responseBody)
        : responseBody;

      // Normalize header keys to lowercase for consistent testing
      const normalizedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(mockResponse.headers || {})) {
        normalizedHeaders[key.toLowerCase()] = value;
      }

      return {
        statusCode: mockResponse.status,
        headers: normalizedHeaders,
        body: bodyBuffer,
      };
    },
  };

  return { mockClient, capturedRequest };
}

/**
 * Example test usage:
 *
 * ```typescript
 * import { proxyRequest } from './request-proxy.js';
 * import { createMockHttpClient } from './request-proxy.test-helpers.js';
 *
 * // Test that Host header is changed
 * const { mockClient, capturedRequest } = createMockHttpClient({
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
 * }, mockClient);
 *
 * // Assert captured request
 * console.assert(capturedRequest.headers['host'] === 'target.com');
 * console.assert(capturedRequest.headers['x-forwarded-for'] === '192.168.1.1');
 * console.assert(capturedRequest.headers['x-forwarded-host'] === 'original.com');
 * console.assert(capturedRequest.body?.toString() === 'test data');
 * ```
 */
