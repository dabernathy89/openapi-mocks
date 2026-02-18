import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

// We mock the parser so we can supply inline specs without file I/O
vi.mock('../parser.js', () => ({
  resolveSpec: vi.fn(),
}));

// Minimal inline OpenAPI 3.0.x spec for testing
const minimalSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string', example: 'user@example.com' },
                        },
                        required: ['id', 'name', 'email'],
                      },
                    },
                  },
                  required: ['users'],
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createUser',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                  required: ['id', 'name', 'email'],
                },
              },
            },
          },
          '422': {
            description: 'Validation Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    fieldErrors: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['message'],
                },
              },
            },
          },
        },
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
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
                    email: { type: 'string', example: 'user@example.com' },
                  },
                  required: ['id', 'name', 'email'],
                },
              },
            },
          },
        },
      },
    },
    '/no-json': {
      get: {
        operationId: 'noJsonOp',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
    '/mixed-content': {
      get: {
        operationId: 'mixedContentOp',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
              'image/png': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
    '/no-operation-id': {
      get: {
        responses: {
          '200': {
            description: 'OK',
          },
        },
      },
    },
  },
};

describe('createMockClient', () => {
  let createMockClient: (typeof import('../mock-client.js'))['createMockClient'];
  let resolveSpec: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Set up the mock
    const parserModule = await import('../parser.js');
    resolveSpec = parserModule.resolveSpec as ReturnType<typeof vi.fn>;
    resolveSpec.mockResolvedValue(minimalSpec);

    // Re-import the module under test after mock setup
    const module = await import('../mock-client.js');
    createMockClient = module.createMockClient;
  });

  // -----------------------------------------------------------------------
  // Basic: all operations generation
  // -----------------------------------------------------------------------
  describe('all-operations generation', () => {
    it('generates data for all operations with operationIds', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      expect(data).toBeInstanceOf(Map);
      // Should have listUsers, createUser, getUser (noJsonOp is skipped due to no JSON content)
      expect(data.has('listUsers')).toBe(true);
      expect(data.has('createUser')).toBe(true);
      expect(data.has('getUser')).toBe(true);
    });

    it('each operation map has the expected status code', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      // listUsers: 200 (lowest 2xx)
      expect(data.get('listUsers')!.has(200)).toBe(true);
      // createUser: 201 (lowest 2xx)
      expect(data.get('createUser')!.has(201)).toBe(true);
      // getUser: 200
      expect(data.get('getUser')!.has(200)).toBe(true);
    });

    it('generated data matches expected shape for listUsers', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      const listUsersData = data.get('listUsers')!.get(200) as Record<string, unknown>;
      expect(listUsersData).toHaveProperty('users');
      expect(Array.isArray(listUsersData['users'])).toBe(true);
    });

    it('is deterministic with a seed', async () => {
      const client1 = createMockClient('./test.yaml', { seed: 42 });
      const client2 = createMockClient('./test.yaml', { seed: 42 });

      const data1 = await client1.data();
      const data2 = await client2.data();

      const getUser1 = data1.get('getUser')!.get(200) as Record<string, unknown>;
      const getUser2 = data2.get('getUser')!.get(200) as Record<string, unknown>;

      expect(getUser1).toEqual(getUser2);
    });
  });

  // -----------------------------------------------------------------------
  // Scoped to specific operations
  // -----------------------------------------------------------------------
  describe('operations filter', () => {
    it('only generates listed operations when operations is provided', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          getUser: {},
        },
      });

      expect(data.has('getUser')).toBe(true);
      expect(data.has('listUsers')).toBe(false);
      expect(data.has('createUser')).toBe(false);
    });

    it('generates all operations when operations is omitted', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      // At minimum, the operations with JSON responses should be present
      expect(data.has('listUsers')).toBe(true);
      expect(data.has('getUser')).toBe(true);
      expect(data.has('createUser')).toBe(true);
    });

    it('generates multiple operations when multiple listed', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          listUsers: {},
          getUser: {},
        },
      });

      expect(data.has('listUsers')).toBe(true);
      expect(data.has('getUser')).toBe(true);
      expect(data.has('createUser')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple status codes
  // -----------------------------------------------------------------------
  describe('statusCodes filter', () => {
    it('generates multiple status codes when statusCodes is provided', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [201, 422],
        operations: {
          createUser: {},
        },
      });

      expect(data.has('createUser')).toBe(true);
      const createUserMap = data.get('createUser')!;
      expect(createUserMap.has(201)).toBe(true);
      expect(createUserMap.has(422)).toBe(true);
    });

    it('only includes status codes that are defined in the spec', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [200, 999], // 999 not defined
        operations: {
          listUsers: {},
        },
      });

      const listUsersMap = data.get('listUsers')!;
      expect(listUsersMap.has(200)).toBe(true);
      expect(listUsersMap.has(999)).toBe(false);
    });

    it('per-operation statusCode override selects specific code', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          createUser: { statusCode: 422 },
        },
      });

      const createUserMap = data.get('createUser')!;
      expect(createUserMap.has(422)).toBe(true);
      expect(createUserMap.has(201)).toBe(false);
    });

    it('422 response has expected message field', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          createUser: { statusCode: 422 },
        },
      });

      const errorData = data.get('createUser')!.get(422) as Record<string, unknown>;
      expect(errorData).toHaveProperty('message');
      expect(typeof errorData['message']).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Transforms
  // -----------------------------------------------------------------------
  describe('transform callback', () => {
    it('applies transform to the generated data', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          getUser: {
            transform: (d) => ({ ...d, name: 'Jane Doe' }),
          },
        },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      expect(userData['name']).toBe('Jane Doe');
    });

    it('transform receives a copy, not original reference', async () => {
      const originalRef: Record<string, unknown> = {};
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          getUser: {
            transform: (d) => {
              Object.assign(originalRef, d);
              return { ...d, name: 'Transformed' };
            },
          },
        },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      expect(userData['name']).toBe('Transformed');
      // The transform received data with original values
      expect(originalRef).toHaveProperty('id');
    });

    it('can add fields not in schema via transform', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          getUser: {
            transform: (d) => ({
              ...d,
              avatar: 'https://example.com/avatar.png',
            }),
          },
        },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      expect(userData['avatar']).toBe('https://example.com/avatar.png');
    });
  });

  // -----------------------------------------------------------------------
  // ignoreExamples
  // -----------------------------------------------------------------------
  describe('ignoreExamples', () => {
    it('uses spec examples by default', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: { getUser: {} },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      // email has example: 'user@example.com' — should be used
      expect(userData['email']).toBe('user@example.com');
    });

    it('ignores spec examples when ignoreExamples is true (global)', async () => {
      const client = createMockClient('./test.yaml', { seed: 42, ignoreExamples: true });
      const data = await client.data({
        operations: { getUser: {} },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      // email has example but should NOT be used
      expect(userData['email']).not.toBe('user@example.com');
      expect(typeof userData['email']).toBe('string');
    });

    it('ignores spec examples when ignoreExamples is true (per-call)', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        ignoreExamples: true,
        operations: { getUser: {} },
      });

      const userData = data.get('getUser')!.get(200) as Record<string, unknown>;
      expect(userData['email']).not.toBe('user@example.com');
    });
  });

  // -----------------------------------------------------------------------
  // arrayLengths per-operation
  // -----------------------------------------------------------------------
  describe('arrayLengths per-operation', () => {
    it('pins array length to exact value', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          listUsers: {
            arrayLengths: { users: [5, 5] },
          },
        },
      });

      const listData = data.get('listUsers')!.get(200) as Record<string, unknown>;
      expect(Array.isArray(listData['users'])).toBe(true);
      expect((listData['users'] as unknown[]).length).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Non-JSON content types
  // -----------------------------------------------------------------------
  describe('non-JSON content types', () => {
    it('skips operations with no application/json response content', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      // noJsonOp has only application/octet-stream — should be skipped
      expect(data.has('noJsonOp')).toBe(false);

      warnSpy.mockRestore();
    });

    it('emits a console.warn naming the operationId and content types when skipping non-JSON operation', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      await client.data();

      // Should have warned about noJsonOp's non-JSON content
      const warnCalls = warnSpy.mock.calls.map((args) => String(args[0]));
      const noJsonWarn = warnCalls.find((msg) => msg.includes('noJsonOp'));
      expect(noJsonWarn).toBeDefined();
      expect(noJsonWarn).toContain('application/octet-stream');

      warnSpy.mockRestore();
    });

    it('generates JSON variant for operations with both application/json and non-JSON content types', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data();

      // mixedContentOp has both application/json and image/png — should generate for JSON
      expect(data.has('mixedContentOp')).toBe(true);
      const opData = data.get('mixedContentOp')!;
      const response200 = opData.get(200) as Record<string, unknown>;
      expect(response200).toBeDefined();
      expect(typeof response200.name).toBe('string');

      warnSpy.mockRestore();
    });

    it('does not throw for non-JSON-only operations', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });

      // Should not throw
      await expect(client.data()).resolves.not.toThrow();

      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Spec is parsed once and cached
  // -----------------------------------------------------------------------
  describe('spec caching', () => {
    it('only calls resolveSpec once for multiple .data() calls', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });

      await client.data();
      await client.data();
      await client.data();

      expect(resolveSpec).toHaveBeenCalledTimes(1);
    });
  });
});
