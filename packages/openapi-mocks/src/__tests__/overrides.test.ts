import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

// Mock the parser so we don't need file I/O
vi.mock('../parser.js', () => ({
  resolveSpec: vi.fn(),
}));

// Spec with nested objects and arrays for override testing
const spec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Override Test API', version: '1.0.0' },
  paths: {
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    address: {
                      type: 'object',
                      properties: {
                        city: { type: 'string' },
                        zip: { type: 'string' },
                      },
                      required: ['city', 'zip'],
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['id', 'name', 'email', 'address', 'tags'],
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('overrides (US-018)', () => {
  let createMockClient: (typeof import('../mock-client.js'))['createMockClient'];
  let resolveSpec: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const parserModule = await import('../parser.js');
    resolveSpec = parserModule.resolveSpec as ReturnType<typeof vi.fn>;
    resolveSpec.mockResolvedValue(spec);

    const module = await import('../mock-client.js');
    createMockClient = module.createMockClient;
  });

  // -----------------------------------------------------------------------
  // Top-level override
  // -----------------------------------------------------------------------
  it('top-level override replaces generated value', async () => {
    const client = createMockClient('./test.yaml', { seed: 42 });
    const data = await client.data({
      operations: {
        getUser: {
          overrides: { name: 'Jane Doe' },
        },
      },
    });

    const user = data.get('getUser')!.get(200) as Record<string, unknown>;
    expect(user['name']).toBe('Jane Doe');
    // Other fields should still be generated
    expect(typeof user['id']).toBe('string');
  });

  // -----------------------------------------------------------------------
  // Nested override
  // -----------------------------------------------------------------------
  it('nested dot-notation override sets nested field', async () => {
    const client = createMockClient('./test.yaml', { seed: 42 });
    const data = await client.data({
      operations: {
        getUser: {
          overrides: { 'address.city': 'Springfield' },
        },
      },
    });

    const user = data.get('getUser')!.get(200) as Record<string, unknown>;
    const address = user['address'] as Record<string, unknown>;
    expect(address['city']).toBe('Springfield');
    // Other address fields should still be generated
    expect(typeof address['zip']).toBe('string');
  });

  // -----------------------------------------------------------------------
  // Array index override
  // -----------------------------------------------------------------------
  it('array index override sets value at specific index', async () => {
    const client = createMockClient('./test.yaml', { seed: 42 });
    const data = await client.data({
      operations: {
        getUser: {
          // Force array to have at least 1 item so we can override index 0
          arrayLengths: { tags: [3, 3] },
          overrides: { 'tags.0': 'overridden-tag' },
        },
      },
    });

    const user = data.get('getUser')!.get(200) as Record<string, unknown>;
    const tags = user['tags'] as string[];
    expect(Array.isArray(tags)).toBe(true);
    expect(tags[0]).toBe('overridden-tag');
    // Other items should remain generated
    expect(tags.length).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Null override
  // -----------------------------------------------------------------------
  it('null override sets field to null', async () => {
    const client = createMockClient('./test.yaml', { seed: 42 });
    const data = await client.data({
      operations: {
        getUser: {
          overrides: { name: null },
        },
      },
    });

    const user = data.get('getUser')!.get(200) as Record<string, unknown>;
    expect(user['name']).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Multiple overrides at once
  // -----------------------------------------------------------------------
  it('multiple overrides applied together', async () => {
    const client = createMockClient('./test.yaml', { seed: 42 });
    const data = await client.data({
      operations: {
        getUser: {
          overrides: {
            name: 'Alice',
            email: 'alice@example.com',
            'address.city': 'Portland',
          },
        },
      },
    });

    const user = data.get('getUser')!.get(200) as Record<string, unknown>;
    expect(user['name']).toBe('Alice');
    expect(user['email']).toBe('alice@example.com');
    const address = user['address'] as Record<string, unknown>;
    expect(address['city']).toBe('Portland');
  });
});
