/**
 * HTTP client utilities for making requests.
 *
 * This module provides a simple, type-safe wrapper around the native fetch API
 * with additional features like retries, timeouts, and request/response interceptors.
 *
 * @module utils/http-client
 */

/**
 * HTTP methods supported by the client.
 */
export type HttpClientMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTP request configuration.
 */
export interface HttpClientRequestConfig {
  /** Request method */
  method?: HttpClientMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON stringified if object) */
  body?: any;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts on failure */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to throw on HTTP error status */
  throwOnError?: boolean;
  /** Base URL to prepend to relative URLs */
  baseURL?: string;
}

/**
 * HTTP response wrapper.
 */
export interface HttpClientResponse<T = any> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Original Response object */
  raw: Response;
}

/**
 * Request interceptor function.
 */
export type RequestInterceptor = (config: HttpClientRequestConfig & { url: string }) => HttpClientRequestConfig & { url: string } | Promise<HttpClientRequestConfig & { url: string }>;

/**
 * Response interceptor function.
 */
export type ResponseInterceptor = <T = any>(response: HttpClientResponse<T>) => HttpClientResponse<T> | Promise<HttpClientResponse<T>>;

/**
 * HTTP client error.
 */
export class HttpClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: HttpClientResponse
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

/**
 * HTTP client class with interceptor support.
 *
 * @example
 * ```typescript
 * const client = new HttpClient({
 *   baseURL: 'https://api.example.com',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * const data = await client.get<User[]>('/users');
 * ```
 */
export class HttpClient {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private defaultConfig: HttpClientRequestConfig;

  constructor(defaultConfig: HttpClientRequestConfig = {}) {
    this.defaultConfig = {
      timeout: 30000,
      retries: 0,
      retryDelay: 1000,
      throwOnError: true,
      ...defaultConfig
    };
  }

  /**
   * Add a request interceptor.
   *
   * @param interceptor - Interceptor function
   * @returns Function to remove the interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Add a response interceptor.
   *
   * @param interceptor - Interceptor function
   * @returns Function to remove the interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Make an HTTP request.
   *
   * @param url - Request URL
   * @param config - Request configuration
   * @returns Response data
   */
  async request<T = any>(
    url: string,
    config: HttpClientRequestConfig = {}
  ): Promise<T> {
    const response = await this.requestWithResponse<T>(url, config);
    return response.data;
  }

  /**
   * Make an HTTP request and return full response.
   *
   * @param url - Request URL
   * @param config - Request configuration
   * @returns Full response object
   */
  async requestWithResponse<T = any>(
    url: string,
    config: HttpClientRequestConfig = {}
  ): Promise<HttpClientResponse<T>> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    let finalConfig = { ...mergedConfig, url };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    // Build final URL
    const finalUrl = this.buildUrl(finalConfig.url, finalConfig.baseURL, finalConfig.params);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...finalConfig.headers
    };

    // Build request body
    let body: string | undefined;
    if (finalConfig.body) {
      if (typeof finalConfig.body === 'string') {
        body = finalConfig.body;
      } else {
        body = JSON.stringify(finalConfig.body);
      }
    }

    // Make request with retries
    let lastError: Error | undefined;
    const maxAttempts = (finalConfig.retries || 0) + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0 && finalConfig.retryDelay) {
          await this.sleep(finalConfig.retryDelay);
        }

        const controller = new AbortController();
        const timeoutId = finalConfig.timeout
          ? setTimeout(() => controller.abort(), finalConfig.timeout)
          : undefined;

        try {
          const response = await fetch(finalUrl, {
            method: finalConfig.method || 'GET',
            headers,
            body,
            signal: controller.signal
          });

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Parse response
          let data: T;
          const contentType = response.headers.get('content-type');

          if (contentType?.includes('application/json')) {
            data = await response.json();
          } else if (contentType?.includes('text/')) {
            data = (await response.text()) as any;
          } else {
            data = (await response.blob()) as any;
          }

          // Build response object
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          let httpResponse: HttpClientResponse<T> = {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            raw: response
          };

          // Apply response interceptors
          for (const interceptor of this.responseInterceptors) {
            httpResponse = await interceptor(httpResponse);
          }

          // Check for HTTP errors
          if (!response.ok && finalConfig.throwOnError) {
            throw new HttpClientError(
              `HTTP ${response.status}: ${response.statusText}`,
              response.status,
              httpResponse
            );
          }

          return httpResponse;
        } catch (error: any) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          if (error.name === 'AbortError') {
            throw new HttpClientError(`Request timeout after ${finalConfig.timeout}ms`);
          }

          throw error;
        }
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (error instanceof HttpClientError && error.status && error.status < 500) {
          throw error;
        }

        // Last attempt, throw error
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw lastError || new HttpClientError('Request failed');
  }

  /**
   * Make a GET request.
   *
   * @param url - Request URL
   * @param config - Request configuration
   * @returns Response data
   */
  async get<T = any>(url: string, config?: HttpClientRequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * Make a POST request.
   *
   * @param url - Request URL
   * @param body - Request body
   * @param config - Request configuration
   * @returns Response data
   */
  async post<T = any>(url: string, body?: any, config?: HttpClientRequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'POST', body });
  }

  /**
   * Make a PUT request.
   *
   * @param url - Request URL
   * @param body - Request body
   * @param config - Request configuration
   * @returns Response data
   */
  async put<T = any>(url: string, body?: any, config?: HttpClientRequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PUT', body });
  }

  /**
   * Make a PATCH request.
   *
   * @param url - Request URL
   * @param body - Request body
   * @param config - Request configuration
   * @returns Response data
   */
  async patch<T = any>(url: string, body?: any, config?: HttpClientRequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'PATCH', body });
  }

  /**
   * Make a DELETE request.
   *
   * @param url - Request URL
   * @param config - Request configuration
   * @returns Response data
   */
  async delete<T = any>(url: string, config?: HttpClientRequestConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * Build final URL with base URL and query parameters.
   */
  private buildUrl(url: string, baseURL?: string, params?: Record<string, string | number | boolean>): string {
    let finalUrl = url;

    // Add base URL
    if (baseURL && !url.startsWith('http')) {
      finalUrl = baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, String(value));
      }
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl += separator + searchParams.toString();
    }

    return finalUrl;
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a default HTTP client instance.
 *
 * @param config - Default configuration
 * @returns HTTP client instance
 *
 * @example
 * ```typescript
 * const api = createHttpClient({
 *   baseURL: 'https://api.example.com',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * const users = await api.get<User[]>('/users');
 * await api.post('/users', { name: 'John' });
 * ```
 */
export function createHttpClient(config?: HttpClientRequestConfig): HttpClient {
  return new HttpClient(config);
}

/**
 * Make a quick GET request without creating a client.
 *
 * @param url - Request URL
 * @param config - Request configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const data = await httpGet<User>('https://api.example.com/user/123');
 * ```
 */
export async function httpGet<T = any>(
  url: string,
  config?: HttpClientRequestConfig
): Promise<T> {
  const client = new HttpClient(config);
  return client.get<T>(url);
}

/**
 * Make a quick POST request without creating a client.
 *
 * @param url - Request URL
 * @param body - Request body
 * @param config - Request configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const user = await httpPost<User>('https://api.example.com/users', {
 *   name: 'John',
 *   email: 'john@example.com'
 * });
 * ```
 */
export async function httpPost<T = any>(
  url: string,
  body?: any,
  config?: HttpClientRequestConfig
): Promise<T> {
  const client = new HttpClient(config);
  return client.post<T>(url, body);
}

/**
 * Make a quick PUT request without creating a client.
 *
 * @param url - Request URL
 * @param body - Request body
 * @param config - Request configuration
 * @returns Response data
 */
export async function httpPut<T = any>(
  url: string,
  body?: any,
  config?: HttpClientRequestConfig
): Promise<T> {
  const client = new HttpClient(config);
  return client.put<T>(url, body);
}

/**
 * Make a quick PATCH request without creating a client.
 *
 * @param url - Request URL
 * @param body - Request body
 * @param config - Request configuration
 * @returns Response data
 */
export async function httpPatch<T = any>(
  url: string,
  body?: any,
  config?: HttpClientRequestConfig
): Promise<T> {
  const client = new HttpClient(config);
  return client.patch<T>(url, body);
}

/**
 * Make a quick DELETE request without creating a client.
 *
 * @param url - Request URL
 * @param config - Request configuration
 * @returns Response data
 */
export async function httpDelete<T = any>(
  url: string,
  config?: HttpClientRequestConfig
): Promise<T> {
  const client = new HttpClient(config);
  return client.delete<T>(url);
}
