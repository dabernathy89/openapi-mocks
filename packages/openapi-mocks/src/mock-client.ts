import { Faker, en } from '@faker-js/faker';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { resolveSpec, type SpecInput } from './parser.js';
import { generateValueForSchema, type Schema } from './generators/schema-walker.js';
import { applyOverrides } from './utils/deep-set.js';
import { applyEchoPathParams } from './utils/echo-path-params.js';

// HTTP methods that can have operations in OpenAPI
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Per-operation options for `.data()` calls.
 */
export interface OperationOptions {
  /**
   * Force a specific status code for this operation.
   */
  statusCode?: number;

  /**
   * Transform callback applied after data generation.
   * Receives the generated data and returns a new object.
   */
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;

  /**
   * Array length overrides: dot-path → [min, max]
   */
  arrayLengths?: Record<string, [number, number]>;

  /**
   * Override specific fields by dot-notation path.
   */
  overrides?: Record<string, unknown>;
}

/**
 * Global options for `createMockClient`.
 */
export interface GlobalOptions {
  /**
   * Seed for the Faker random number generator.
   * When provided, the same seed always produces the same output.
   */
  seed?: number;

  /**
   * If true, skip spec `example` and `default` values; always use Faker.
   * @default false
   */
  ignoreExamples?: boolean;

  /**
   * Maximum recursion depth for circular reference prevention.
   * @default 3
   */
  maxDepth?: number;

  /**
   * Base URL prepended to every handler's URL pattern.
   * e.g. "https://api.acme.dev/v1" + "/users" → handler matches "https://api.acme.dev/v1/users"
   */
  baseUrl?: string;

  /**
   * When true, path parameters from the intercepted request are echoed into
   * matching fields in the generated response. Only meaningful for `.handlers()`.
   * @default false
   */
  echoPathParams?: boolean;

  /**
   * Generate responses for specific status codes (global default for all operations).
   */
  statusCodes?: number[];
}

/**
 * Per-call options for `.data()`.
 */
export interface DataOptions {
  /**
   * Filter and configure specific operations.
   * When provided, only the listed operations are generated.
   */
  operations?: Record<string, OperationOptions>;

  /**
   * Generate responses for specific status codes.
   * Overrides the default behavior of using the lowest 2xx code.
   */
  statusCodes?: number[];

  /**
   * Per-call ignoreExamples override.
   */
  ignoreExamples?: boolean;
}

/**
 * Per-call options for `.handlers()`.
 */
export interface HandlersOptions {
  /**
   * Filter and configure specific operations.
   * When provided, only the listed operations generate handlers.
   */
  operations?: Record<string, OperationOptions>;

  /**
   * Generate responses for specific status codes.
   */
  statusCodes?: number[];

  /**
   * Per-call ignoreExamples override.
   */
  ignoreExamples?: boolean;
}

/**
 * The MockClient object returned by `createMockClient`.
 */
export interface MockClient {
  /**
   * Generate mock data for operations in the spec.
   *
   * @returns A Map keyed by operationId, then by status code, to the generated data.
   */
  data(options?: DataOptions): Promise<Map<string, Map<number, unknown>>>;

  /**
   * Generate MSW v2 request handlers for operations in the spec.
   * MSW is lazily loaded at call time — consumers who only use `.data()` never need MSW installed.
   *
   * @throws If MSW is not installed when called.
   * @returns An array of MSW HttpHandler objects.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlers(options?: HandlersOptions): Promise<any[]>;
}

/**
 * Flatten the operations from a dereferenced OpenAPI document.
 * Returns an array of { operationId, method, path, operation } tuples.
 */
function extractOperations(
  doc: OpenAPIV3.Document | OpenAPIV3_1.Document,
): Array<{
  operationId: string;
  method: HttpMethod;
  path: string;
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
}> {
  const results: Array<{
    operationId: string;
    method: HttpMethod;
    path: string;
    operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject;
  }> = [];

  const paths = doc.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | OpenAPIV3_1.OperationObject
        | undefined;

      if (!operation) continue;

      const operationId = operation.operationId;
      if (!operationId) {
        // Skip operations without operationId
        continue;
      }

      results.push({ operationId, method, path, operation });
    }
  }

  return results;
}

/**
 * Select status codes to generate for an operation.
 * Default: the lowest 2xx status code defined.
 * With statusCodes: generate all matching codes.
 * With per-operation statusCode: use that specific code.
 */
function selectStatusCodes(
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
  operationOptions: OperationOptions | undefined,
  globalStatusCodes: number[] | undefined,
): number[] {
  const responses = operation.responses ?? {};
  const definedCodes = Object.keys(responses)
    .map((code) => parseInt(code, 10))
    .filter((code) => !isNaN(code));

  // Per-operation override: use that specific code if it's defined
  if (operationOptions?.statusCode !== undefined) {
    const code = operationOptions.statusCode;
    if (definedCodes.includes(code)) {
      return [code];
    }
    // If the specified code isn't defined, skip with warning
    console.warn(
      `openapi-mocks: operation has no response defined for status code ${code}`,
    );
    return [];
  }

  // Global statusCodes filter: generate all matching codes
  if (globalStatusCodes && globalStatusCodes.length > 0) {
    return globalStatusCodes.filter((code) => definedCodes.includes(code));
  }

  // Default: lowest 2xx
  const twoxCodes = definedCodes.filter((code) => code >= 200 && code < 300).sort((a, b) => a - b);
  if (twoxCodes.length === 0) {
    console.warn(
      `openapi-mocks: operation "${(operation as OpenAPIV3.OperationObject).operationId}" has no 2xx response defined — skipping`,
    );
    return [];
  }
  return [twoxCodes[0]!];
}

/**
 * Extract the JSON schema from a response object.
 */
function extractResponseSchema(
  response: OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject,
): Schema | undefined {
  const content = response.content;
  if (!content) return undefined;

  const jsonContent = content['application/json'] as
    | OpenAPIV3.MediaTypeObject
    | OpenAPIV3_1.MediaTypeObject
    | undefined;

  if (!jsonContent) {
    // Non-JSON content — warn and skip
    const contentTypes = Object.keys(content);
    if (contentTypes.length > 0) {
      console.warn(
        `openapi-mocks: response has no application/json content type (found: ${contentTypes.join(', ')}) — skipping`,
      );
    }
    return undefined;
  }

  return jsonContent.schema as Schema | undefined;
}

/**
 * Convert an OpenAPI path (e.g. /users/{userId}) to an MSW path pattern (e.g. /users/:userId).
 */
function toMswPath(openapiPath: string): string {
  return openapiPath.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Factory that parses the spec once, then exposes `.data()` for mock data generation.
 *
 * @param spec - A spec URL, file path, JSON string, or parsed spec object
 * @param options - Global options (seed, ignoreExamples, maxDepth, baseUrl, echoPathParams, statusCodes)
 * @returns A MockClient object
 */
export function createMockClient(spec: SpecInput, options: GlobalOptions = {}): MockClient {
  const {
    seed,
    ignoreExamples: globalIgnoreExamples = false,
    maxDepth = 3,
    baseUrl = '',
    echoPathParams: globalEchoPathParams = false,
    statusCodes: globalStatusCodes,
  } = options;

  // Parse the spec lazily (first .data() call resolves it)
  let docPromise: Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> | undefined;

  function getDoc(): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
    if (!docPromise) {
      docPromise = resolveSpec(spec);
    }
    return docPromise;
  }

  /**
   * Internal helper: generate data for a single operation+statusCode combo.
   */
  function generateForOperation(
    operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
    operationOptions: OperationOptions | undefined,
    statusCode: number,
    faker: Faker,
    ignoreExamples: boolean,
  ): Record<string, unknown> | undefined {
    const responseObj = operation.responses?.[String(statusCode)] as
      | OpenAPIV3.ResponseObject
      | OpenAPIV3_1.ResponseObject
      | undefined;

    if (!responseObj) return undefined;

    const schema = extractResponseSchema(responseObj);
    if (!schema) return undefined;

    let generated = generateValueForSchema(schema, {
      faker,
      ignoreExamples,
      overrides: {},
      arrayLengths: operationOptions?.arrayLengths ?? {},
      maxDepth,
    }) as Record<string, unknown>;

    if (operationOptions?.overrides && typeof generated === 'object' && generated !== null) {
      applyOverrides(generated, operationOptions.overrides);
    }

    if (operationOptions?.transform && typeof generated === 'object' && generated !== null) {
      const transformed = operationOptions.transform({ ...generated });
      if (transformed !== undefined) {
        generated = transformed;
      }
    }

    return generated;
  }

  return {
    async data(callOptions: DataOptions = {}): Promise<Map<string, Map<number, unknown>>> {
      const doc = await getDoc();
      const { operations: operationsFilter, statusCodes: callStatusCodes, ignoreExamples: callIgnoreExamples } = callOptions;

      const ignoreExamples = callIgnoreExamples ?? globalIgnoreExamples;
      const effectiveStatusCodes = callStatusCodes ?? globalStatusCodes;

      // Create a seeded Faker instance
      const faker = new Faker({ locale: [en] });
      if (seed !== undefined) {
        faker.seed(seed);
      }

      const result = new Map<string, Map<number, unknown>>();
      const allOperations = extractOperations(doc);

      for (const { operationId, operation } of allOperations) {
        // If operations filter is provided, only process listed operations
        if (operationsFilter && !Object.prototype.hasOwnProperty.call(operationsFilter, operationId)) {
          continue;
        }

        const operationOptions = operationsFilter?.[operationId];
        const codesToGenerate = selectStatusCodes(operation, operationOptions, effectiveStatusCodes);

        if (codesToGenerate.length === 0) continue;

        const operationMap = new Map<number, unknown>();

        for (const statusCode of codesToGenerate) {
          const generated = generateForOperation(operation, operationOptions, statusCode, faker, ignoreExamples);
          if (generated !== undefined) {
            operationMap.set(statusCode, generated);
          }
        }

        if (operationMap.size > 0) {
          result.set(operationId, operationMap);
        }
      }

      return result;
    },

    async handlers(callOptions: HandlersOptions = {}): Promise<unknown[]> {
      // Lazily import MSW — consumers who only use .data() never need it installed
      let msw: typeof import('msw');
      try {
        msw = await import('msw');
      } catch {
        throw new Error(
          'openapi-mocks: .handlers() requires msw. Install it with: npm install msw',
        );
      }

      const { http, HttpResponse } = msw;

      const doc = await getDoc();
      const { operations: operationsFilter, statusCodes: callStatusCodes, ignoreExamples: callIgnoreExamples } = callOptions;

      const ignoreExamples = callIgnoreExamples ?? globalIgnoreExamples;
      const effectiveStatusCodes = callStatusCodes ?? globalStatusCodes;

      const allOperations = extractOperations(doc);
      const handlers: unknown[] = [];

      for (const { operationId, method, path, operation } of allOperations) {
        // If operations filter is provided, only process listed operations
        if (operationsFilter && !Object.prototype.hasOwnProperty.call(operationsFilter, operationId)) {
          continue;
        }

        const operationOptions = operationsFilter?.[operationId];
        const codesToGenerate = selectStatusCodes(operation, operationOptions, effectiveStatusCodes);

        if (codesToGenerate.length === 0) continue;

        // Use the first status code for the handler (MSW handlers return one response per request)
        const statusCode = codesToGenerate[0]!;

        // Pre-check: skip if the response has no JSON schema (e.g. non-JSON content types)
        const responseObj = operation.responses?.[String(statusCode)] as
          | OpenAPIV3.ResponseObject
          | OpenAPIV3_1.ResponseObject
          | undefined;
        if (!responseObj) continue;
        const responseSchema = extractResponseSchema(responseObj);
        if (!responseSchema) continue;

        // Build the URL pattern: baseUrl + converted path
        const mswPath = toMswPath(path);
        const urlPattern = baseUrl ? `${baseUrl.replace(/\/$/, '')}${mswPath}` : mswPath;

        // Capture variables for the closure
        const capturedOperation = operation;
        const capturedOperationOptions = operationOptions;
        const capturedStatusCode = statusCode;
        const capturedIgnoreExamples = ignoreExamples;
        const capturedEchoPathParams = globalEchoPathParams;

        const httpMethod = method as keyof typeof http;
        const handlerFn = http[httpMethod];

        if (typeof handlerFn !== 'function') continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = (handlerFn as any)(urlPattern, ({ params }: { params: Record<string, string | string[]> }) => {
          // Create a fresh seeded Faker instance per-request
          const faker = new Faker({ locale: [en] });
          if (seed !== undefined) {
            faker.seed(seed);
          }

          const generated = generateForOperation(
            capturedOperation,
            capturedOperationOptions,
            capturedStatusCode,
            faker,
            capturedIgnoreExamples,
          );

          if (generated === undefined) {
            return new HttpResponse(null, { status: capturedStatusCode });
          }

          // Echo path params if enabled
          let responseData: Record<string, unknown> = { ...generated };
          if (capturedEchoPathParams) {
            // Flatten params values to strings (MSW can give string | string[])
            const flatParams: Record<string, string> = {};
            for (const [k, v] of Object.entries(params)) {
              flatParams[k] = Array.isArray(v) ? v[0] ?? '' : v;
            }
            responseData = applyEchoPathParams(responseData, flatParams);
          }

          return HttpResponse.json(responseData, { status: capturedStatusCode });
        });

        handlers.push(handler);
      }

      return handlers;
    },
  };
}
