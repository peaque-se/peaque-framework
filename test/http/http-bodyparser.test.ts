import { parseRequestBody } from "../../src/http/http-bodyparser.js"
import { IncomingMessage } from 'http';
import { PassThrough } from 'stream';
import { describe, test, expect } from '@jest/globals'

// Mock IncomingMessage implementation using PassThrough stream
class MockIncomingMessage extends PassThrough {
  public headers: Record<string, string | string[]> = {};
  public method: string = 'POST';
  public aborted: boolean = false;
  public httpVersion: string = '1.1';
  public httpVersionMajor: number = 1;
  public httpVersionMinor: number = 1;
  public rawHeaders: string[] = [];
  public rawTrailers: string[] = [];
  public trailers: Record<string, string> = {};
  public trailersDistinct?: any;
  public url?: string;
  public complete: boolean = false;
  public connection?: any;
  public socket?: any;
  public headersDistinct?: any;

  constructor(
    private mockData: Buffer | string = '',
    private mockHeaders: Record<string, string> = {},
    private mockMethod: string = 'POST'
  ) {
    super();

    // Set headers and method (normalize header names to lowercase)
    this.headers = {};
    for (const [key, value] of Object.entries(mockHeaders)) {
      this.headers[key.toLowerCase()] = value;
    }
    this.method = mockMethod;

    // Convert data to buffer
    const dataBuffer = typeof mockData === 'string' ? Buffer.from(mockData) : mockData;

    // Set content-length if not provided and there's data
    if (dataBuffer.length > 0 && !this.headers['content-length']) {
      this.headers['content-length'] = dataBuffer.length.toString();
    }

    // Write data to the stream
    this.write(dataBuffer);
    this.end();
  }

  // Make it compatible with IncomingMessage interface
  getHeader(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  setTimeout(): void {
    // Mock implementation
  }
}

describe('parseRequestBody', () => {
  describe('GET and HEAD requests', () => {
    test('should return null body for GET requests', async () => {
      const req = new MockIncomingMessage('', {}, 'GET');
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should return null body for HEAD requests', async () => {
      const req = new MockIncomingMessage('', {}, 'HEAD');
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should preserve existing query params for GET requests', async () => {
      const req = new MockIncomingMessage('', {}, 'GET');
      const existingParams = { foo: 'bar', baz: ['qux', 'quux'] };
      const result = await parseRequestBody(req as any, existingParams);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual(existingParams);
    });
  });

  describe('Zero content length', () => {
    test('should return null body when content-length is 0', async () => {
      const req = new MockIncomingMessage('', { 'content-length': '0' });
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should return null body when content-length is not set', async () => {
      const req = new MockIncomingMessage('', {});
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });
  });

  describe('JSON parsing', () => {
    test('should parse valid JSON', async () => {
      const jsonData = { name: 'John', age: 30 };
      const req = new MockIncomingMessage(
        JSON.stringify(jsonData),
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(jsonData);
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should parse empty JSON object', async () => {
      const req = new MockIncomingMessage(
        '{}',
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual({});
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should parse JSON array', async () => {
      const jsonData = [1, 2, 3, 'test'];
      const req = new MockIncomingMessage(
        JSON.stringify(jsonData),
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(jsonData);
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should handle malformed JSON gracefully', async () => {
      const req = new MockIncomingMessage(
        '{invalid json}',
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should handle empty JSON string', async () => {
      const req = new MockIncomingMessage(
        '',
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should preserve existing query params with JSON', async () => {
      const jsonData = { name: 'John' };
      const req = new MockIncomingMessage(
        JSON.stringify(jsonData),
        { 'content-type': 'application/json' }
      );
      const existingParams = { existing: 'param' };
      const result = await parseRequestBody(req as any, existingParams);

      expect(result.body).toEqual(jsonData);
      expect(result.updatedQueryParams).toEqual(existingParams);
    });
  });

  describe('Form data parsing', () => {
    test('should parse simple form data', async () => {
      const formData = 'name=John&age=30';
      const req = new MockIncomingMessage(
        formData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({
        name: 'John',
        age: '30'
      });
    });

    test('should merge form data with existing query params', async () => {
      const formData = 'name=John&age=30';
      const req = new MockIncomingMessage(
        formData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const existingParams = { existing: 'param', name: 'existing' };
      const result = await parseRequestBody(req as any, existingParams);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({
        existing: 'param',
        name: ['existing', 'John'], // Form data appends to existing
        age: '30'
      });
    });

    test('should handle multiple values for same key', async () => {
      const formData = 'hobby=reading&hobby=gaming&hobby=coding';
      const req = new MockIncomingMessage(
        formData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({
        hobby: ['reading', 'gaming', 'coding']
      });
    });

    test('should handle URL-encoded values', async () => {
      const formData = 'name=John%20Doe&message=Hello%20World%21';
      const req = new MockIncomingMessage(
        formData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({
        name: 'John Doe',
        message: 'Hello World!'
      });
    });

    test('should handle empty form data', async () => {
      const req = new MockIncomingMessage(
        '',
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should handle form data with existing array params', async () => {
      const formData = 'tags=new';
      const req = new MockIncomingMessage(
        formData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const existingParams = { tags: ['existing1', 'existing2'] };
      const result = await parseRequestBody(req as any, existingParams);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({
        tags: ['existing1', 'existing2', 'new']
      });
    });
  });

  describe('Binary data handling', () => {
    test('should return binary data as Buffer for unknown content types', async () => {
      const binaryData = Buffer.from('binary content');
      const req = new MockIncomingMessage(
        binaryData,
        { 'content-type': 'application/octet-stream' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(binaryData);
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should return text data as Buffer for unknown content types', async () => {
      const textData = 'plain text content';
      const req = new MockIncomingMessage(
        textData,
        { 'content-type': 'text/plain' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(Buffer.from(textData));
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should handle empty binary data', async () => {
      const req = new MockIncomingMessage(
        Buffer.alloc(0),
        { 'content-type': 'application/octet-stream' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull(); // Empty content should result in null body
      expect(result.updatedQueryParams).toEqual({});
    });
  });

  describe('Content-Type case insensitivity', () => {
    test('should handle uppercase content-type', async () => {
      const jsonData = { test: 'value' };
      const req = new MockIncomingMessage(
        JSON.stringify(jsonData),
        { 'CONTENT-TYPE': 'APPLICATION/JSON' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(jsonData);
    });

    test('should handle mixed case content-type', async () => {
      const formData = 'key=value';
      const req = new MockIncomingMessage(
        formData,
        { 'Content-Type': 'Application/X-WWW-Form-Urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({ key: 'value' });
    });
  });

  describe('Error handling', () => {
    test('should handle stream errors gracefully', async () => {
      // Create a mock that simulates a stream error
      class ErrorMockIncomingMessage extends IncomingMessage {
        constructor() {
          super({
            readable: true,
            writable: false,
            readableHighWaterMark: 16384,
            writableHighWaterMark: 16384,
          } as any);

          this.headers['content-type'] = 'application/json';
          this.method = 'POST';
          this.push('{invalid json');
          this.push(null);
        }
      }

      const req = new ErrorMockIncomingMessage();
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams).toEqual({});
    });

    test('should handle missing content-type header', async () => {
      const data = 'some data';
      const req = new MockIncomingMessage(data, {});
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(Buffer.from(data));
      expect(result.updatedQueryParams).toEqual({});
    });
  });

  describe('Large data handling', () => {
    test('should handle large JSON payloads', async () => {
      const largeData = { data: 'x'.repeat(10000) };
      const req = new MockIncomingMessage(
        JSON.stringify(largeData),
        { 'content-type': 'application/json' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toEqual(largeData);
    });

    test('should handle large form data', async () => {
      const largeFormData = 'data=' + 'x'.repeat(10000);
      const req = new MockIncomingMessage(
        largeFormData,
        { 'content-type': 'application/x-www-form-urlencoded' }
      );
      const result = await parseRequestBody(req as any);

      expect(result.body).toBeNull();
      expect(result.updatedQueryParams.data).toBe('x'.repeat(10000));
    });
  });
});