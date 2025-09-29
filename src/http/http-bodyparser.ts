import { IncomingMessage } from 'http';
import { URLSearchParams } from 'url';

export interface ParsedBodyResult {
  body: any;
  updatedQueryParams: Record<string, string | string[]>;
  failed?: boolean;
}

/**
 * Parses the body of an HTTP request based on its Content-Type header.
 * Supports JSON, form-urlencoded data, and binary data.
 * For form data, merges parsed values into query parameters.
 */
export async function parseRequestBody(req: IncomingMessage, existingQueryParams: Record<string, string | string[]> = {}): Promise<ParsedBodyResult> {
  const contentType = req.headers['content-type']?.toLowerCase() || '';
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  // If no body expected, return empty result
  if (req.method === 'GET' || req.method === 'HEAD' || contentLength === 0) {
    return {
      body: null,
      updatedQueryParams: { ...existingQueryParams }
    };
  }

  try {
    // Read the raw body data
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Handle different content types
    if (contentType.includes('application/json')) {
      // JSON parsing
      const jsonString = rawBody.toString('utf8');
      const parsedBody = jsonString ? JSON.parse(jsonString) : null;
      return {
        body: parsedBody,
        updatedQueryParams: { ...existingQueryParams }
      };
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Form data parsing - merge into query params
      const formString = rawBody.toString('utf8');
      const formParams = new URLSearchParams(formString);
      const updatedQueryParams = { ...existingQueryParams };

      // Merge form data into query params
      for (const [key, value] of formParams.entries()) {
        if (updatedQueryParams[key]) {
          // If key already exists, convert to array or append
          if (Array.isArray(updatedQueryParams[key])) {
            (updatedQueryParams[key] as string[]).push(value);
          } else {
            updatedQueryParams[key] = [updatedQueryParams[key] as string, value];
          }
        } else {
          updatedQueryParams[key] = value;
        }
      }

      return {
        body: null, // Form data doesn't typically have a separate body
        updatedQueryParams
      };
    } else {
      // Binary or other content types - return as Buffer
      return {
        body: rawBody,
        updatedQueryParams: { ...existingQueryParams }
      };
    }
  } catch (error) {
    // If parsing fails, return raw body as fallback
    //console.warn('Failed to parse request body:', error);
    return {
      body: null,
      updatedQueryParams: { ...existingQueryParams },
      failed: true
    };
  }
}
