import { faker as defaultFaker, type Faker } from '@faker-js/faker';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { callFakerMethod } from './faker-extension.js';
import { getSmartDefault } from './smart-defaults.js';
import { generateFromTypeFallback } from './type-fallback.js';

export type Schema =
  | OpenAPIV3.SchemaObject
  | OpenAPIV3_1.SchemaObject
  | Record<string, unknown>;

/**
 * Options for generating a value from a schema.
 */
export interface GenerateValueOptions {
  /**
   * A map of dot-notation paths to override values.
   * Applied at the top level before generation.
   */
  overrides?: Record<string, unknown>;

  /**
   * If true, skip spec `example` and `default` values; always use Faker.
   */
  ignoreExamples?: boolean;

  /**
   * Seeded Faker instance to use. If not provided, a new Faker instance is created.
   */
  faker?: Faker;

  /**
   * The property name of the current field (used for smart default lookup).
   */
  propertyName?: string;

  /**
   * Current override path prefix (dot-notation), for nested traversal.
   * @internal
   */
  _overridePath?: string;

  /**
   * Array length overrides: dot-path → [min, max]
   */
  arrayLengths?: Record<string, [number, number]>;

  /**
   * Maximum depth for circular reference prevention.
   * @default 3
   */
  maxDepth?: number;

  /**
   * @internal Current traversal depth for circular ref detection.
   */
  _depth?: number;

  /**
   * @internal Stack of visited schema pointers for circular ref detection.
   */
  _visitedSchemas?: Set<object>;
}

/**
 * Resolve the type from a schema. Handles both string types (3.0.x) and
 * array types (3.1.x). Returns the primary non-null type, or undefined.
 */
function resolveType(schema: Schema): string | undefined {
  const rawType = (schema as Record<string, unknown>)['type'];
  if (typeof rawType === 'string') {
    return rawType === 'null' ? undefined : rawType;
  }
  if (Array.isArray(rawType)) {
    return (rawType as string[]).find((t) => t !== 'null');
  }
  // Infer from schema shape
  if ((schema as Record<string, unknown>)['properties']) return 'object';
  if ((schema as Record<string, unknown>)['items']) return 'array';
  return undefined;
}

/**
 * Check if a schema is nullable (3.0.x `nullable: true` or 3.1.x `type: ["...", "null"]`).
 */
function isNullable(schema: Schema): boolean {
  // 3.0.x: nullable: true
  if ((schema as Record<string, unknown>)['nullable'] === true) return true;
  // 3.1.x: type includes "null"
  const rawType = (schema as Record<string, unknown>)['type'];
  if (Array.isArray(rawType)) {
    return (rawType as string[]).includes('null');
  }
  return false;
}

/**
 * Get a nested value from an object by dot-notation path.
 */
function getByPath(obj: Record<string, unknown>, path: string): { found: true; value: unknown } | { found: false } {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in (current as Record<string, unknown>))) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[part];
  }
  return { found: true, value: current };
}

/**
 * Generate a value for an OpenAPI schema, applying the full resolution priority chain:
 *
 * 1. Override (if provided for the current path)
 * 2. spec `example` / `default` (unless `ignoreExamples` is true)
 * 3. `x-faker-method` extension
 * 4. Smart default (property name mapping)
 * 5. Type-based fallback
 *
 * @param schema - The OpenAPI schema object
 * @param options - Generation options
 * @returns A generated value
 */
export function generateValueForSchema(schema: Schema, options: GenerateValueOptions = {}): unknown {
  const {
    overrides = {},
    ignoreExamples = false,
    faker = defaultFaker,
    propertyName,
    _overridePath = '',
    arrayLengths = {},
    maxDepth = 3,
    _depth = 0,
    _visitedSchemas = new Set(),
  } = options;

  const baseOptions: GenerateValueOptions = {
    overrides,
    ignoreExamples,
    faker,
    arrayLengths,
    maxDepth,
    _depth,
    _visitedSchemas,
  };

  // --- Priority 1: Check for override at current path ---
  if (_overridePath && Object.prototype.hasOwnProperty.call(overrides, _overridePath)) {
    return overrides[_overridePath];
  }

  // --- Nullable: may return null randomly (seeded) ---
  if (isNullable(schema) && faker.datatype.boolean()) {
    return null;
  }

  // --- Priority 2: spec example / default ---
  if (!ignoreExamples) {
    const example = (schema as Record<string, unknown>)['example'];
    if (example !== undefined) {
      return example;
    }
    const defaultValue = (schema as Record<string, unknown>)['default'];
    if (defaultValue !== undefined) {
      return defaultValue;
    }
  }

  // --- Priority 3: x-faker-method extension ---
  const xFakerMethod = (schema as Record<string, unknown>)['x-faker-method'];
  if (typeof xFakerMethod === 'string') {
    return callFakerMethod(faker, xFakerMethod);
  }

  // --- Priority 4: Smart default by property name ---
  if (propertyName) {
    const rawType = (schema as Record<string, unknown>)['type'];
    const schemaType = Array.isArray(rawType)
      ? (rawType as string[]).filter((t) => t !== 'null')
      : rawType;
    const smartPath = getSmartDefault(propertyName, schemaType as string | string[] | undefined);
    if (smartPath) {
      try {
        return callFakerMethod(faker, smartPath);
      } catch {
        // Fall through to type-based generation
      }
    }
  }

  // --- Priority 5: Type-based generation ---
  const type = resolveType(schema);

  if (type === 'object') {
    return generateObject(schema, baseOptions, _overridePath);
  }

  if (type === 'array') {
    return generateArray(schema, baseOptions, _overridePath, propertyName);
  }

  // For simple types, delegate to type fallback
  return generateFromTypeFallback(schema as OpenAPIV3.SchemaObject, faker);
}

/**
 * Generate an object value by recursively generating each property.
 */
function generateObject(
  schema: Schema,
  options: GenerateValueOptions,
  overridePath: string,
): Record<string, unknown> {
  const { faker = defaultFaker, overrides = {}, _depth = 0, maxDepth = 3, _visitedSchemas = new Set() } = options;

  const properties = (schema as Record<string, unknown>)['properties'] as
    | Record<string, Schema>
    | undefined;
  const required = (schema as Record<string, unknown>)['required'] as string[] | undefined;

  if (!properties) {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const isRequired = required?.includes(key) ?? false;

    // Optional fields are randomly omitted (~50% chance), unless overrides force inclusion
    const propPath = overridePath ? `${overridePath}.${key}` : key;

    // Check if there's an override for this path or any descendant
    const hasOverride = Object.keys(overrides).some(
      (k) => k === propPath || k.startsWith(`${propPath}.`),
    );

    if (!isRequired && !hasOverride) {
      // ~50% chance of omitting optional field
      if (faker.datatype.boolean()) {
        continue;
      }
    }

    // Circular reference detection
    const propSchemaObj = propSchema as object;
    if (_visitedSchemas.has(propSchemaObj) && _depth >= maxDepth) {
      if (isRequired) {
        // Provide a minimal stub for required fields
        result[key] = generateMinimalStub(propSchema as Schema, options);
      }
      // Optional fields at max depth are omitted
      continue;
    }

    const newVisited = new Set(_visitedSchemas);
    newVisited.add(propSchemaObj);

    result[key] = generateValueForSchema(propSchema as Schema, {
      ...options,
      propertyName: key,
      _overridePath: propPath,
      _depth: _depth + 1,
      _visitedSchemas: newVisited,
    });
  }

  // Apply any direct overrides for this level
  for (const [overrideKey, overrideValue] of Object.entries(overrides)) {
    const prefix = overridePath ? `${overridePath}.` : '';
    if (overrideKey.startsWith(prefix)) {
      const relKey = overrideKey.slice(prefix.length);
      // Only apply direct (non-nested) overrides at this level
      if (!relKey.includes('.')) {
        result[relKey] = overrideValue;
      }
    }
  }

  return result;
}

/**
 * Generate an array value using the items schema.
 */
function generateArray(
  schema: Schema,
  options: GenerateValueOptions,
  overridePath: string,
  propertyName?: string,
): unknown[] {
  const { faker = defaultFaker, arrayLengths = {} } = options;

  const minItems = (schema as Record<string, unknown>)['minItems'] as number | undefined;
  const maxItems = (schema as Record<string, unknown>)['maxItems'] as number | undefined;
  const itemSchema = (schema as Record<string, unknown>)['items'] as Schema | undefined;

  // Determine count: check arrayLengths first, then schema constraints, then default 0-5
  let min = 0;
  let max = 5;

  if (minItems !== undefined) min = Math.max(min, minItems);
  if (maxItems !== undefined) max = Math.min(max, maxItems);

  // Check arrayLengths override
  if (propertyName && arrayLengths[propertyName]) {
    const [overrideMin, overrideMax] = arrayLengths[propertyName]!;
    min = Math.max(min, overrideMin);
    max = Math.min(max, overrideMax);
    // If exact length (min === max from override), use that
    if (overrideMin === overrideMax) {
      min = overrideMin;
      max = overrideMax;
    }
  } else if (overridePath && arrayLengths[overridePath]) {
    const [overrideMin, overrideMax] = arrayLengths[overridePath]!;
    min = Math.max(min, overrideMin);
    max = Math.min(max, overrideMax);
    if (overrideMin === overrideMax) {
      min = overrideMin;
      max = overrideMax;
    }
  }

  // Ensure min <= max
  if (min > max) max = min;

  const count = faker.number.int({ min, max });
  const result: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const itemPath = overridePath ? `${overridePath}.${i}` : String(i);
    result.push(
      itemSchema
        ? generateValueForSchema(itemSchema, {
            ...options,
            propertyName: undefined,
            _overridePath: itemPath,
          })
        : faker.lorem.word(),
    );
  }

  return result;
}

/**
 * Generate a minimal stub for a required circular field.
 * Returns null for nullable schemas, a simple primitive for simple types,
 * or an empty object as a last resort.
 */
function generateMinimalStub(schema: Schema, options: GenerateValueOptions): unknown {
  const { faker = defaultFaker } = options;

  if (isNullable(schema)) return null;

  const type = resolveType(schema);
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}
