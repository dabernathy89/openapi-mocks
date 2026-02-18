/**
 * Custom error class for openapi-mocks.
 * All errors thrown by the library are instances of this class,
 * so consumers can catch them specifically.
 *
 * @example
 * ```ts
 * import { OpenApiMocksError } from 'openapi-mocks';
 *
 * try {
 *   await createMockClient(spec).data();
 * } catch (err) {
 *   if (err instanceof OpenApiMocksError) {
 *     console.error('openapi-mocks error:', err.message);
 *   }
 * }
 * ```
 */
export class OpenApiMocksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenApiMocksError';
    // Fix prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
