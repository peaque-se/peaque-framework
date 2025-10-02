import { proxyRequest } from '../../src/http/request-proxy.js';
import { createMockHttpClient } from './request-proxy.test-helpers.js';

// ============================================================================
// Tests: Host Header Replacement
// ============================================================================

describe('proxyRequest - Host Header Replacement', () => {
  it('should replace Host header with target host', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.example.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.example.com',
          'user-agent': 'test-agent',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['host']).toBe('target.example.com');
    expect(capturedRequest.headers['user-agent']).toBe('test-agent');
  });

  it('should handle target with port in Host header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.example.com:8080/api',
      {
        method: 'GET',
        headers: { host: 'original.example.com:3000' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['host']).toBe('target.example.com:8080');
  });

  it('should handle IPv6 addresses in Host header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://[2001:db8::1]:8080/api',
      {
        method: 'GET',
        headers: { host: '[::1]:3000' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['host']).toBe('[2001:db8::1]:8080');
    expect(capturedRequest.headers['x-forwarded-host']).toBe('[::1]:3000');
  });

  it('should handle hostnames with special characters', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target-domain.co.uk/api',
      {
        method: 'GET',
        headers: { host: 'original_domain.test' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['host']).toBe('target-domain.co.uk');
    expect(capturedRequest.headers['x-forwarded-host']).toBe('original_domain.test');
  });

  it('should handle empty host header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: '' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['host']).toBe('target.com');
    expect(capturedRequest.headers['x-forwarded-host']).toBeUndefined();
  });
});

// ============================================================================
// Tests: X-Forwarded-* Headers
// ============================================================================

describe('proxyRequest - X-Forwarded-* Headers', () => {
  it('should add X-Forwarded-For header with client IP', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '203.0.113.42',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe('203.0.113.42');
  });

  it('should append to existing X-Forwarded-For header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        },
        clientIp: '203.0.113.42',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe(
      '10.0.0.1, 10.0.0.2, 203.0.113.42'
    );
  });

  it('should add X-Forwarded-Host header with original host', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.example.com:3000' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-host']).toBe('original.example.com:3000');
  });

  it('should handle array value for host header in X-Forwarded-Host', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: ['host1.com', 'host2.com'] },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-host']).toBe('host1.com');
  });

  it('should add X-Forwarded-Proto as http by default', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('http');
  });

  it('should detect HTTPS from x-forwarded-ssl header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-ssl': 'on',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should detect HTTPS from x-forwarded-scheme header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-scheme': 'https',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should preserve existing X-Forwarded-Proto header', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-proto': 'https',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should preserve non-standard X-Forwarded-Proto values', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-proto': 'ws',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('ws');
  });

  it('should prioritize x-forwarded-ssl over conflicting x-forwarded-scheme', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-ssl': 'on',
          'x-forwarded-scheme': 'http',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should handle case-insensitive x-forwarded-ssl detection', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-ssl': 'on', // Correct case
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should handle case-insensitive x-forwarded-scheme detection', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-scheme': 'https', // Correct case
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should handle IPv6 client IP addresses', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '2001:db8::1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe('2001:db8::1');
  });

  it('should handle IPv6 client IP with brackets', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '[::1]',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe('[::1]');
  });

  it('should handle empty client IP', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe('');
  });
});

// ============================================================================
// Tests: Request Headers Preservation
// ============================================================================

describe('proxyRequest - Request Headers Preservation', () => {
  it('should preserve all request headers except Host', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: {
          host: 'original.com',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0',
          authorization: 'Bearer token123',
          'x-custom-header': 'custom-value',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['content-type']).toBe('application/json');
    expect(capturedRequest.headers['user-agent']).toBe('Mozilla/5.0');
    expect(capturedRequest.headers['authorization']).toBe('Bearer token123');
    expect(capturedRequest.headers['x-custom-header']).toBe('custom-value');
    expect(capturedRequest.headers['host']).toBe('target.com');
  });

  it('should convert array header values to comma-separated strings', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          accept: ['application/json', 'text/html'],
          'accept-language': ['en-US', 'en'],
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['accept']).toBe('application/json, text/html');
    expect(capturedRequest.headers['accept-language']).toBe('en-US, en');
  });
});

// ============================================================================
// Tests: Request Body Forwarding
// ============================================================================

describe('proxyRequest - Request Body Forwarding', () => {
  it('should forward request body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    const requestBody = Buffer.from('{"key": "value"}');

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: {
          host: 'original.com',
          'content-type': 'application/json',
        },
        body: requestBody,
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body?.toString()).toBe('{"key": "value"}');
  });

  it('should handle empty request body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body).toBeUndefined();
  });

  it('should handle zero-length buffer body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: { host: 'original.com' },
        body: Buffer.alloc(0),
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body).toBeUndefined();
  });

  it('should forward binary request body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: {
          host: 'original.com',
          'content-type': 'application/octet-stream',
        },
        body: binaryData,
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body).toEqual(binaryData);
  });

  it('should forward text request body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    const textData = Buffer.from('Hello, World!');

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: {
          host: 'original.com',
          'content-type': 'text/plain',
        },
        body: textData,
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body?.toString()).toBe('Hello, World!');
  });

  it('should forward form data request body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    const formData = Buffer.from('name=John&age=30');

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: {
          host: 'original.com',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body?.toString()).toBe('name=John&age=30');
  });

  it('should handle single-byte body', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    const singleByte = Buffer.from([42]);

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: { host: 'original.com' },
        body: singleByte,
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.body).toEqual(singleByte);
  });
});

// ============================================================================
// Tests: HTTP Methods
// ============================================================================

describe('proxyRequest - HTTP Methods', () => {
  it('should proxy GET requests', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.method).toBe('GET');
  });

  it('should proxy POST requests', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 201,
      body: 'Created',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: { host: 'original.com' },
        body: Buffer.from('data'),
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.method).toBe('POST');
  });

  it('should proxy PUT requests', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'Updated',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'PUT',
        headers: { host: 'original.com' },
        body: Buffer.from('data'),
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.method).toBe('PUT');
  });

  it('should proxy DELETE requests', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 204,
      body: '',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'DELETE',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.method).toBe('DELETE');
  });

  it('should proxy PATCH requests', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'Patched',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'PATCH',
        headers: { host: 'original.com' },
        body: Buffer.from('data'),
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.method).toBe('PATCH');
  });
});

// ============================================================================
// Tests: Response Handling
// ============================================================================

describe('proxyRequest - Response Handling', () => {
  it('should return response status code', async () => {
    const { mockClient } = createMockHttpClient({
      status: 201,
      body: 'Created',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'POST',
        headers: { host: 'original.com' },
        body: Buffer.from('data'),
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(201);
  });

  it('should return response headers', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      },
      body: '{}',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-custom-header')).toBe('custom-value');
  });

  it('should return response body', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      body: '{"success": true}',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.body.toString()).toBe('{"success": true}');
  });

  it('should handle binary response body', async () => {
    const binaryResponse = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: { 'content-type': 'image/png' },
      body: binaryResponse,
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.body).toEqual(binaryResponse);
  });

  it('should handle empty response body', async () => {
    const { mockClient } = createMockHttpClient({
      status: 204,
      headers: { 'content-type': 'application/json' },
      body: '',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'DELETE',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(204);
    expect(response.body.length).toBe(0);
  });

  it('should handle response with no body headers', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {},
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.toString()).toBe('OK');
    expect(response.headers.get('content-type')).toBeUndefined();
  });

  it('should handle 1xx informational responses', async () => {
    const { mockClient } = createMockHttpClient({
      status: 100,
      body: '',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(100);
  });

  it('should handle 5xx server error responses', async () => {
    const { mockClient } = createMockHttpClient({
      status: 503,
      headers: { 'retry-after': '60' },
      body: 'Service Unavailable',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
  });
});

// ============================================================================
// Tests: Hop-by-Hop Header Filtering
// ============================================================================

describe('proxyRequest - Hop-by-Hop Header Filtering', () => {
  it('should filter out Connection header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        connection: 'keep-alive',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('connection')).toBeUndefined();
    expect(response.headers.get('content-type')).toBe('text/plain');
  });

  it('should filter out Keep-Alive header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'keep-alive': 'timeout=5',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('keep-alive')).toBeUndefined();
  });

  it('should filter out Transfer-Encoding header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'transfer-encoding': 'chunked',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('transfer-encoding')).toBeUndefined();
  });

  it('should filter out Upgrade header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        upgrade: 'websocket',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('upgrade')).toBeUndefined();
  });

  it('should filter out Proxy-Authenticate header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 407,
      headers: {
        'proxy-authenticate': 'Basic realm="proxy"',
        'content-type': 'text/plain',
      },
      body: 'Proxy Authentication Required',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('proxy-authenticate')).toBeUndefined();
  });

  it('should filter out Proxy-Authorization header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'proxy-authorization': 'Basic dXNlcjpwYXNz',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('proxy-authorization')).toBeUndefined();
  });

  it('should filter out TE header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        te: 'trailers',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('te')).toBeUndefined();
  });

  it('should filter out Trailer header from response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        trailer: 'content-length',
        'content-type': 'text/plain',
      },
      body: 'OK',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('trailer')).toBeUndefined();
  });

  it('should preserve end-to-end headers in response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'cache-control': 'max-age=3600',
        'content-type': 'application/json',
        'set-cookie': 'session=abc123',
        etag: '"123456"',
      },
      body: '{}',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('cache-control')).toBe('max-age=3600');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('set-cookie')).toBe('session=abc123');
    expect(response.headers.get('etag')).toBe('"123456"');
  });
});

// ============================================================================
// Tests: URL and Path Handling
// ============================================================================

describe('proxyRequest - URL and Path Handling', () => {
  it('should preserve query parameters in target URL', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api?foo=bar&baz=qux',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('http://target.com/api?foo=bar&baz=qux');
  });

  it('should handle path with special characters', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api/users/john%20doe',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('http://target.com/api/users/john%20doe');
  });

  it('should handle HTTPS URLs', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'https://secure-target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('https://secure-target.com/api');
    expect(capturedRequest.headers['host']).toBe('secure-target.com');
  });

  it('should handle HTTPS URLs with port', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'https://secure-target.com:8443/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('https://secure-target.com:8443/api');
    expect(capturedRequest.headers['host']).toBe('secure-target.com:8443');
  });

  it('should handle URLs with authentication credentials', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://user:pass@target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('http://user:pass@target.com/api');
    expect(capturedRequest.headers['host']).toBe('target.com');
  });

  it('should handle URLs with fragments', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api#section',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('http://target.com/api#section');
    expect(capturedRequest.headers['host']).toBe('target.com');
  });

  it('should handle complex URL paths', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api/v2/users/123/posts?filter=recent&limit=10',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.url).toBe('http://target.com/api/v2/users/123/posts?filter=recent&limit=10');
    expect(capturedRequest.headers['host']).toBe('target.com');
  });
});

// ============================================================================
// Tests: Error Status Codes
// ============================================================================

describe('proxyRequest - Error Status Codes', () => {
  it('should handle 404 response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 404,
      body: 'Not Found',
    });

    const response = await proxyRequest(
      'http://target.com/api/missing',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(404);
    expect(response.body.toString()).toBe('Not Found');
  });

  it('should handle 500 response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 500,
      body: 'Internal Server Error',
    });

    const response = await proxyRequest(
      'http://target.com/api/error',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.toString()).toBe('Internal Server Error');
  });

  it('should handle 302 redirect response', async () => {
    const { mockClient } = createMockHttpClient({
      status: 302,
      headers: {
        location: 'http://target.com/new-location',
      },
      body: '',
    });

    const response = await proxyRequest(
      'http://target.com/api/old',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.statusCode).toBe(302);
    expect(response.headers.get('location')).toBe('http://target.com/new-location');
  });
});

// ============================================================================
// Tests: Error Handling
// ============================================================================

describe('proxyRequest - Error Handling', () => {
  it('should throw error for malformed target URL', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await expect(
      proxyRequest(
        'not-a-valid-url',
        {
          method: 'GET',
          headers: { host: 'original.com' },
          clientIp: '192.168.1.1',
        },
        mockClient
      )
    ).rejects.toThrow();
  });

  it('should throw error for empty target URL', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await expect(
      proxyRequest(
        '',
        {
          method: 'GET',
          headers: { host: 'original.com' },
          clientIp: '192.168.1.1',
        },
        mockClient
      )
    ).rejects.toThrow();
  });

  it('should propagate client errors', async () => {
    const mockClientWithError = {
      async request() {
        throw new Error('Network error');
      }
    };

    await expect(
      proxyRequest(
        'http://target.com/api',
        {
          method: 'GET',
          headers: { host: 'original.com' },
          clientIp: '192.168.1.1',
        },
        mockClientWithError
      )
    ).rejects.toThrow('Network error');
  });

  it('should handle client timeout errors', async () => {
    const mockClientWithTimeout = {
      async request() {
        throw new Error('Timeout');
      }
    };

    await expect(
      proxyRequest(
        'http://target.com/api',
        {
          method: 'GET',
          headers: { host: 'original.com' },
          clientIp: '192.168.1.1',
        },
        mockClientWithTimeout
      )
    ).rejects.toThrow('Timeout');
  });
});

// ============================================================================
// Tests: Header Case Sensitivity
// ============================================================================

describe('proxyRequest - Header Case Sensitivity', () => {
  it('should handle mixed-case header names in request', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          host: 'original.com',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['content-type']).toBe('application/json');
    expect(capturedRequest.headers['x-custom-header']).toBe('custom-value');
    expect(capturedRequest.headers['host']).toBe('target.com');
  });

  it('should handle mixed-case X-Forwarded headers', async () => {
    const { mockClient, capturedRequest } = createMockHttpClient({
      status: 200,
      body: 'OK',
    });

    await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: {
          host: 'original.com',
          'x-forwarded-for': '10.0.0.1',
          'x-forwarded-proto': 'https',
        },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(capturedRequest.headers['x-forwarded-for']).toBe('10.0.0.1, 192.168.1.1');
    expect(capturedRequest.headers['x-forwarded-proto']).toBe('https');
  });

  it('should preserve header case in response headers', async () => {
    const { mockClient } = createMockHttpClient({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'Set-Cookie': 'session=abc123',
      },
      body: '{}',
    });

    const response = await proxyRequest(
      'http://target.com/api',
      {
        method: 'GET',
        headers: { host: 'original.com' },
        clientIp: '192.168.1.1',
      },
      mockClient
    );

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-custom-header')).toBe('custom-value');
    expect(response.headers.get('set-cookie')).toBe('session=abc123');
  });
});
