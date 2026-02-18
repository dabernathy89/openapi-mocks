import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

// Minimal valid OpenAPI 3.0 spec for testing
const minimalSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
  },
};

// We mock SwaggerParser.dereference to avoid real file/HTTP I/O
vi.mock('@apidevtools/swagger-parser', () => {
  const mockDereference = vi.fn();
  return {
    default: {
      dereference: mockDereference,
    },
  };
});

describe('resolveSpec', () => {
  let dereference: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    dereference = SwaggerParser.dereference as ReturnType<typeof vi.fn>;
    dereference.mockReset();
    dereference.mockResolvedValue({ ...minimalSpec });
  });

  it('passes an https:// URL string directly to dereference', async () => {
    const { resolveSpec } = await import('../parser.js');
    const url = 'https://example.com/openapi.json';
    await resolveSpec(url);
    expect(dereference).toHaveBeenCalledWith(url);
  });

  it('passes an http:// URL string directly to dereference', async () => {
    const { resolveSpec } = await import('../parser.js');
    const url = 'http://localhost:3000/openapi.json';
    await resolveSpec(url);
    expect(dereference).toHaveBeenCalledWith(url);
  });

  it('passes a file path string directly to dereference', async () => {
    const { resolveSpec } = await import('../parser.js');
    const filePath = './specs/openapi.yaml';
    await resolveSpec(filePath);
    expect(dereference).toHaveBeenCalledWith(filePath);
  });

  it('parses a JSON string and passes the object to dereference', async () => {
    const { resolveSpec } = await import('../parser.js');
    const jsonString = JSON.stringify(minimalSpec);
    await resolveSpec(jsonString);
    // dereference should have been called with the parsed object, not the string
    expect(dereference).toHaveBeenCalledWith(minimalSpec);
  });

  it('passes a plain object directly to dereference', async () => {
    const { resolveSpec } = await import('../parser.js');
    await resolveSpec(minimalSpec);
    expect(dereference).toHaveBeenCalledWith(minimalSpec);
  });

  it('returns the dereferenced document', async () => {
    const { resolveSpec } = await import('../parser.js');
    const result = await resolveSpec(minimalSpec);
    expect(result).toMatchObject({ openapi: '3.0.0' });
  });

  it('throws a descriptive error for a Swagger 2.x document', async () => {
    dereference.mockResolvedValue({
      swagger: '2.0',
      info: { title: 'Old API', version: '1.0.0' },
      paths: {},
    });
    const { resolveSpec } = await import('../parser.js');
    await expect(resolveSpec(minimalSpec)).rejects.toThrow(
      'openapi-mocks: expected an OpenAPI 3.x document',
    );
  });

  it('throws a descriptive error when no openapi field is present', async () => {
    dereference.mockResolvedValue({ info: { title: 'Bad API', version: '1.0.0' }, paths: {} });
    const { resolveSpec } = await import('../parser.js');
    await expect(resolveSpec(minimalSpec)).rejects.toThrow(
      'openapi-mocks: expected an OpenAPI 3.x document',
    );
  });
});
