import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenApiMocksError } from '../errors.js';
import { callFakerMethod } from '../generators/faker-extension.js';
import { mergeAllOf } from '../generators/schema-walker.js';
import { faker } from '@faker-js/faker';

// -------------------------------------------------------------------------
// US-026: Error handling for broken specs
// -------------------------------------------------------------------------

describe('OpenApiMocksError', () => {
  it('is an instance of Error', () => {
    const err = new OpenApiMocksError('test message');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of OpenApiMocksError', () => {
    const err = new OpenApiMocksError('test message');
    expect(err).toBeInstanceOf(OpenApiMocksError);
  });

  it('has the correct name', () => {
    const err = new OpenApiMocksError('test message');
    expect(err.name).toBe('OpenApiMocksError');
  });

  it('has the correct message', () => {
    const err = new OpenApiMocksError('broken $ref at #/components/schemas/Foo');
    expect(err.message).toBe('broken $ref at #/components/schemas/Foo');
  });

  it('can be caught with instanceof check', () => {
    let caught: unknown;
    try {
      throw new OpenApiMocksError('caught error');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });
});

describe('invalid x-faker-method throws OpenApiMocksError', () => {
  it('throws OpenApiMocksError for invalid dot-path', () => {
    let caught: unknown;
    try {
      callFakerMethod(faker, 'nonexistent.method');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });

  it('throws OpenApiMocksError for single-segment path', () => {
    let caught: unknown;
    try {
      callFakerMethod(faker, 'internet');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });

  it('error message names the invalid path', () => {
    expect(() => callFakerMethod(faker, 'bad.method')).toThrowError(/bad\.method/);
  });

  it('thrown error is also an instance of Error', () => {
    let caught: unknown;
    try {
      callFakerMethod(faker, 'nonexistent.method');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });
});

describe('broken $ref throws (via parser)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws an error (wrapping parser) for broken $ref spec', async () => {
    const { resolveSpec } = await import('../parser.js');

    const brokenSpec = {
      openapi: '3.0.3',
      info: { title: 'Broken', version: '1.0.0' },
      paths: {
        '/foo': {
          get: {
            operationId: 'getFoo',
            responses: {
              200: {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/NonExistent' },
                  },
                },
              },
            },
          },
        },
      },
    };

    // SwaggerParser throws for broken $refs — the error may be a plain Error from the parser
    // but should be descriptive. We assert it throws (either wrapped or from the parser).
    await expect(resolveSpec(brokenSpec as Record<string, unknown>)).rejects.toThrow();
  });

  it('throws OpenApiMocksError for non-OpenAPI-3.x document', async () => {
    // Mock SwaggerParser to return a document without an `openapi` field
    vi.doMock('@apidevtools/swagger-parser', () => ({
      default: {
        dereference: vi.fn().mockResolvedValue({
          swagger: '2.0',
          info: { title: 'Old', version: '1.0.0' },
        }),
      },
    }));

    // Import after mocking so the mock is in place
    const { resolveSpec } = await import('../parser.js');
    // Also import OpenApiMocksError from the same module graph
    const { OpenApiMocksError: OAMError } = await import('../errors.js');

    const swagger2doc = { swagger: '2.0', info: { title: 'Old', version: '1.0.0' } };
    let caught: unknown;
    try {
      await resolveSpec(swagger2doc as Record<string, unknown>);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(OAMError);
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('OpenApiMocksError');
  });
});

describe('allOf conflicting types throws OpenApiMocksError', () => {
  it('throws OpenApiMocksError for conflicting allOf types', () => {
    let caught: unknown;
    try {
      mergeAllOf([{ type: 'string' }, { type: 'integer' }]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });

  it('error message mentions conflicting types', () => {
    expect(() =>
      mergeAllOf([{ type: 'string' }, { type: 'integer' }]),
    ).toThrowError(/conflicting types/i);
  });

  it('thrown error is also an instance of Error', () => {
    let caught: unknown;
    try {
      mergeAllOf([{ type: 'string' }, { type: 'integer' }]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(OpenApiMocksError);
  });
});
