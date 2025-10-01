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

export type FetchFunction = typeof fetch

/**
 * Proxies an HTTP request to a target URL, preserving all request data except the Host header.
 * Adds standard X-Forwarded-* headers and filters hop-by-hop response headers.
 *
 * @param targetUrl - The URL to proxy the request to
 * @param requestData - The original request data to forward
 * @param fetchFn - Optional fetch function for testing (defaults to global fetch)
 */
export async function proxyRequest(
  targetUrl: string,
  requestData: ProxyRequestData,
  fetchFn: FetchFunction = fetch
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

  // Prepare request body if present
  let bodyToSend: BodyInit | null | undefined = undefined;
  if (requestData.body && requestData.body.length > 0) {
    // Node's Buffer is compatible with fetch's body, but needs explicit typing
    bodyToSend = requestData.body as BodyInit;
  }

  // Make the proxied request
  const res = await fetchFn(targetUrl, {
    method: requestData.method,
    headers: proxyHeaders,
    body: bodyToSend,
    // Important: don't let fetch auto-redirect, we want to preserve the response
    redirect: 'manual',
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
  res.headers.forEach((value, name) => {
    const lowerName = name.toLowerCase();

    if (!skipHeaders.has(lowerName)) {
      responseHeaders.set(name, value);
    }
  });

  // Copy response body
  const rawBody = await res.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  return {
    statusCode: res.status,
    headers: responseHeaders,
    body: bodyBuffer,
  };
}
