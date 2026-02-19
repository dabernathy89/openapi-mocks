import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';

// We mock the parser so we can supply inline specs without file I/O
vi.mock('../parser.js', () => ({
  resolveSpec: vi.fn(),
}));

/**
 * A spec with operations that have various response code combinations, used to
 * exercise the default status code selection logic (US-024).
 */
const statusCodeSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Status Code Test API', version: '1.0.0' },
  paths: {
    // Operation with 200 and 201 defined — default should pick 200 (lowest 2xx)
    '/both-200-and-201': {
      get: {
        operationId: 'bothCodes',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'ok' } },
                  required: ['message'],
                },
              },
            },
          },
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string', example: 'abc' } },
                  required: ['id'],
                },
              },
            },
          },
        },
      },
    },

    // Operation with 201 and 422 — default picks 201 (lowest 2xx)
    '/create-with-error': {
      post: {
        operationId: 'createWithError',
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'string', example: 'new-id' } },
                  required: ['id'],
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
                    message: { type: 'string', example: 'validation failed' },
                    code: { type: 'integer', example: 422 },
                  },
                  required: ['message'],
                },
              },
            },
          },
        },
      },
    },

    // Operation with only a 4xx response — no 2xx, should be skipped
    '/no-success': {
      get: {
        operationId: 'noSuccess',
        responses: {
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string', example: 'not found' } },
                  required: ['error'],
                },
              },
            },
          },
        },
      },
    },

    // Operation with 200, 404, and 500 — default picks 200, global filter can target any
    '/with-multiple-responses': {
      get: {
        operationId: 'withMultiple',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { result: { type: 'string', example: 'data' } },
                  required: ['result'],
                },
              },
            },
          },
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string', example: 'not found' } },
                  required: ['error'],
                },
              },
            },
          },
          '500': {
            description: 'Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string', example: 'server error' } },
                  required: ['error'],
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('Default status code selection (US-024)', () => {
  let createMockClient: (typeof import('../mock-client.js'))['createMockClient'];
  let resolveSpec: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const parserModule = await import('../parser.js');
    resolveSpec = parserModule.resolveSpec as ReturnType<typeof vi.fn>;
    resolveSpec.mockResolvedValue(statusCodeSpec);

    const module = await import('../mock-client.js');
    createMockClient = module.createMockClient;
  });

  // -----------------------------------------------------------------------
  // Default: lowest 2xx
  // -----------------------------------------------------------------------
  describe('default: lowest 2xx', () => {
    it('returns the lowest 2xx code when both 200 and 201 are defined', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({ operations: { bothCodes: {} } });

      const opMap = data.get('bothCodes')!;
      expect(opMap.has(200)).toBe(true);
      expect(opMap.has(201)).toBe(false); // 201 is not the lowest
    });

    it('returns 201 as lowest 2xx when only 201 and 422 are defined', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({ operations: { createWithError: {} } });

      const opMap = data.get('createWithError')!;
      expect(opMap.has(201)).toBe(true);
      expect(opMap.has(422)).toBe(false); // 422 is not a 2xx
    });

    it('default picks only one status code (the lowest 2xx)', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({ operations: { withMultiple: {} } });

      const opMap = data.get('withMultiple')!;
      expect(opMap.size).toBe(1);
      expect(opMap.has(200)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // No 2xx response: skip with console.warn
  // -----------------------------------------------------------------------
  describe('no 2xx response defined', () => {
    it('skips operations with no 2xx response', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({ operations: { noSuccess: {} } });

      expect(data.has('noSuccess')).toBe(false);
      warnSpy.mockRestore();
    });

    it('emits a console.warn naming the operation when no 2xx is defined', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      await client.data({ operations: { noSuccess: {} } });

      const warnMessages = warnSpy.mock.calls.map((args) => String(args[0]));
      const noSuccessWarn = warnMessages.find((msg) => msg.includes('noSuccess'));
      expect(noSuccessWarn).toBeDefined();
      // Should mention "2xx" or "no 2xx" to indicate the reason
      expect(noSuccessWarn).toMatch(/2xx|no 2xx/i);

      warnSpy.mockRestore();
    });

    it('does not throw when operation has no 2xx response', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      await expect(client.data({ operations: { noSuccess: {} } })).resolves.not.toThrow();
      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Per-operation statusCode override
  // -----------------------------------------------------------------------
  describe('per-operation statusCode override', () => {
    it('selects the specified status code instead of the default', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          createWithError: { statusCode: 422 },
        },
      });

      const opMap = data.get('createWithError')!;
      expect(opMap.has(422)).toBe(true);
      expect(opMap.has(201)).toBe(false); // default 2xx not included
    });

    it('can target a non-2xx code via per-operation override', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          withMultiple: { statusCode: 404 },
        },
      });

      const opMap = data.get('withMultiple')!;
      expect(opMap.has(404)).toBe(true);
      expect(opMap.has(200)).toBe(false);
    });

    it('emits a warning and skips when specified code is not defined in the spec', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        operations: {
          withMultiple: { statusCode: 503 }, // 503 not in spec
        },
      });

      expect(data.has('withMultiple')).toBe(false);
      const warnMessages = warnSpy.mock.calls.map((args) => String(args[0]));
      const relevant = warnMessages.find((msg) => msg.includes('503'));
      expect(relevant).toBeDefined();

      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Global statusCodes filter: generate multiple codes
  // -----------------------------------------------------------------------
  describe('global statusCodes filter', () => {
    it('generates responses for all matching codes', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [201, 422],
        operations: { createWithError: {} },
      });

      const opMap = data.get('createWithError')!;
      expect(opMap.has(201)).toBe(true);
      expect(opMap.has(422)).toBe(true);
    });

    it('only includes codes that are actually defined in the spec', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [200, 503], // 503 not in spec
        operations: { withMultiple: {} },
      });

      const opMap = data.get('withMultiple')!;
      expect(opMap.has(200)).toBe(true);
      expect(opMap.has(503)).toBe(false);
    });

    it('can target a 4xx code globally', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [200, 404],
        operations: { withMultiple: {} },
      });

      const opMap = data.get('withMultiple')!;
      expect(opMap.has(200)).toBe(true);
      expect(opMap.has(404)).toBe(true);
      expect(opMap.has(500)).toBe(false); // not in the filter
    });

    it('generated data for each status code matches expected schema', async () => {
      const client = createMockClient('./test.yaml', { seed: 42 });
      const data = await client.data({
        statusCodes: [201, 422],
        operations: { createWithError: {} },
      });

      const created = data.get('createWithError')!.get(201) as Record<string, unknown>;
      const error = data.get('createWithError')!.get(422) as Record<string, unknown>;

      expect(typeof created['id']).toBe('string');
      expect(typeof error['message']).toBe('string');
    });
  });
});
