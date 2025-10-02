import * as http from 'node:http'
import * as https from 'node:https'

export interface ProxyRequestData {
  method: string
  headers: Record<string, string | string[]>
  body?: Buffer
  clientIp: string
}

export interface ProxyResponseData {
  statusCode: number
  headers: Map<string, string>
  body: Buffer
}

/**
 * HTTP client interface for making proxied requests
 */
export interface HttpClient {
  request(url: string, options: {
    method: string
    headers: Record<string, string>
    body?: Buffer
  }): Promise<{
    statusCode: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }>
}

/**
 * Native Node.js HTTP/HTTPS client (no auto-decompression)
 */
export class NativeHttpClient implements HttpClient {
  async request(url: string, options: {
    method: string
    headers: Record<string, string>
    body?: Buffer
  }): Promise<{
    statusCode: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: options.method,
        headers: options.headers,
      }, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);

      if (options.body && options.body.length > 0) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

/**
 * Proxies an HTTP request to a target URL, preserving all request data except the Host header.
 * Adds standard X-Forwarded-* headers and filters hop-by-hop response headers.
 * Uses native http/https modules to avoid automatic decompression.
 *
 * @param targetUrl - The URL to proxy the request to
 * @param requestData - The original request data to forward
 * @param httpClient - HTTP client to use (defaults to NativeHttpClient)
 */
export async function proxyRequest(
  targetUrl: string,
  requestData: ProxyRequestData,
  httpClient: HttpClient = new NativeHttpClient()
): Promise<ProxyResponseData> {
  // Parse the target URL to extract the host
  const url = new URL(targetUrl);

  // Prepare headers - copy all headers except host, then set the new host
  const proxyHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(requestData.headers)) {
    const lowerKey = key.toLowerCase();

    // Skip host header - we'll set it to the target host
    if (lowerKey === 'host') {
      continue;
    }

    // Convert array values to comma-separated string (HTTP standard)
    if (Array.isArray(value)) {
      proxyHeaders[key] = value.join(', ');
    } else {
      proxyHeaders[key] = value;
    }
  }

  // Set the host header to the target host
  proxyHeaders['host'] = url.host;

  // Add X-Forwarded-* headers (standard proxy headers)
  // X-Forwarded-For: Original client IP
  const existingForwardedFor = proxyHeaders['x-forwarded-for'];
  if (existingForwardedFor) {
    proxyHeaders['x-forwarded-for'] = `${existingForwardedFor}, ${requestData.clientIp}`;
  } else {
    proxyHeaders['x-forwarded-for'] = requestData.clientIp;
  }

  // X-Forwarded-Host: Original host requested by client
  const originalHost = requestData.headers['host'];
  if (originalHost) {
    proxyHeaders['x-forwarded-host'] = Array.isArray(originalHost) ? originalHost[0] : originalHost;
  }

  // X-Forwarded-Proto: Original protocol (http/https)
  const originalProto = requestData.headers['x-forwarded-proto'];
  if (!originalProto) {
    // Detect from common indicators if not already set
    const isHttps = requestData.headers['x-forwarded-ssl'] === 'on' ||
                    requestData.headers['x-forwarded-scheme'] === 'https';
    proxyHeaders['x-forwarded-proto'] = isHttps ? 'https' : 'http';
  }

  // Make the proxied request
  const res = await httpClient.request(targetUrl, {
    method: requestData.method,
    headers: proxyHeaders,
    body: requestData.body,
  });

  // Headers that should NOT be forwarded from the proxied response
  const skipHeaders = new Set([
    'connection',           // Hop-by-hop header
    'keep-alive',           // Hop-by-hop header
    'proxy-authenticate',   // Proxy-specific
    'proxy-authorization',  // Proxy-specific
    'te',                   // Hop-by-hop header
    'trailer',              // Hop-by-hop header
    'transfer-encoding',    // Let the framework handle encoding
    'upgrade',              // Hop-by-hop header
  ]);

  // Copy response headers, filtering out hop-by-hop headers
  const responseHeaders = new Map<string, string>();
  for (const [name, value] of Object.entries(res.headers)) {
    const lowerName = name.toLowerCase();

    if (!skipHeaders.has(lowerName) && value !== undefined) {
      // Join array values with comma (HTTP standard)
      const headerValue = Array.isArray(value) ? value.join(', ') : String(value);
      responseHeaders.set(name, headerValue);
    }
  }

  return {
    statusCode: res.statusCode,
    headers: responseHeaders,
    body: res.body,
  };
}
