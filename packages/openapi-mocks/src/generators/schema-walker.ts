import { faker as defaultFaker, type Faker } from '@faker-js/faker';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { OpenApiMocksError } from '../errors.js';
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
 * Deep-merge allOf sub-schemas into a single combined schema.
 * Combines `properties`, unions `required` arrays, and validates compatible types.
 */
export function mergeAllOf(subSchemas: Schema[]): Schema {
  const merged: Record<string, unknown> = {};

  let mergedType: string | undefined;
  const mergedProperties: Record<string, Schema> = {};
  const mergedRequired: string[] = [];

  for (const sub of subSchemas) {
    const s = sub as Record<string, unknown>;

    // Merge type — must be compatible if both are present
    const rawType = s['type'];
    const subType = typeof rawType === 'string' ? rawType : undefined;
    if (subType !== undefined) {
      if (mergedType !== undefined && mergedType !== subType) {
        throw new OpenApiMocksError(
          `openapi-mocks: allOf has conflicting types: "${mergedType}" vs "${subType}"`,
        );
      }
      mergedType = subType;
    }

    // Merge properties
    const props = s['properties'] as Record<string, Schema> | undefined;
    if (props) {
      Object.assign(mergedProperties, props);
    }

    // Union required arrays
    const req = s['required'] as string[] | undefined;
    if (req) {
      for (const r of req) {
        if (!mergedRequired.includes(r)) {
          mergedRequired.push(r);
        }
      }
    }

    // Copy other schema keywords (example, default, x-faker-method, format, etc.)
    for (const [key, value] of Object.entries(s)) {
      if (key !== 'type' && key !== 'properties' && key !== 'required') {
        merged[key] = value;
      }
    }
  }

  if (mergedType !== undefined) merged['type'] = mergedType;
  if (Object.keys(mergedProperties).length > 0) merged['properties'] = mergedProperties;
  if (mergedRequired.length > 0) merged['required'] = mergedRequired;

  return merged as Schema;
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

  // --- allOf composition: deep-merge and generate ---
  const allOf = (schema as Record<string, unknown>)['allOf'] as Schema[] | undefined;
  if (allOf && allOf.length > 0) {
    const merged = mergeAllOf(allOf);
    return generateValueForSchema(merged, { ...baseOptions, propertyName, _overridePath });
  }

  // --- oneOf composition: select one sub-schema (with discriminator support) ---
  const oneOf = (schema as Record<string, unknown>)['oneOf'] as Schema[] | undefined;
  if (oneOf && oneOf.length > 0) {
    return generateOneOf(oneOf, schema, { ...baseOptions, propertyName, _overridePath });
  }

  // --- anyOf composition: select one or more sub-schemas, merge, and generate ---
  const anyOf = (schema as Record<string, unknown>)['anyOf'] as Schema[] | undefined;
  if (anyOf && anyOf.length > 0) {
    return generateAnyOf(anyOf, { ...baseOptions, propertyName, _overridePath });
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
 * Generate a value for a oneOf schema.
 * Selects one sub-schema randomly (seeded), or uses the discriminator if present.
 */
function generateOneOf(
  subSchemas: Schema[],
  parentSchema: Schema,
  options: GenerateValueOptions & { propertyName?: string; _overridePath?: string },
): unknown {
  const { faker = defaultFaker } = options;

  const discriminator = (parentSchema as Record<string, unknown>)['discriminator'] as
    | { propertyName?: string; mapping?: Record<string, string> }
    | undefined;

  let selectedSchema: Schema;
  let discriminatorValue: string | undefined;

  if (discriminator?.propertyName && discriminator.mapping) {
    // With mapping: pick a random entry from the mapping (seeded)
    const mappingEntries = Object.entries(discriminator.mapping);
    const [, selectedRef] = mappingEntries[faker.number.int({ min: 0, max: mappingEntries.length - 1 })]!;
    discriminatorValue = Object.keys(discriminator.mapping)[
      mappingEntries.findIndex(([, ref]) => ref === selectedRef)
    ];

    // Find the sub-schema that matches the ref (by identity or by $ref string)
    const matched = subSchemas.find((s) => {
      const ref = (s as Record<string, unknown>)['$ref'];
      if (typeof ref === 'string') return ref === selectedRef;
      return false;
    });
    selectedSchema = matched ?? subSchemas[faker.number.int({ min: 0, max: subSchemas.length - 1 })]!;
  } else {
    // No mapping: select randomly (seeded)
    selectedSchema = subSchemas[faker.number.int({ min: 0, max: subSchemas.length - 1 })]!;

    // If there's a propertyName but no mapping, try to get the discriminator value from enum/const
    if (discriminator?.propertyName) {
      const props = (selectedSchema as Record<string, unknown>)['properties'] as
        | Record<string, Record<string, unknown>>
        | undefined;
      const discriminatorProp = props?.[discriminator.propertyName];
      if (discriminatorProp) {
        const enumValues = discriminatorProp['enum'] as unknown[] | undefined;
        if (enumValues && enumValues.length > 0) {
          discriminatorValue = String(enumValues[0]);
        }
        const constValue = discriminatorProp['const'];
        if (constValue !== undefined) {
          discriminatorValue = String(constValue);
        }
      }
    }
  }

  // Generate data for the selected schema
  const generated = generateValueForSchema(selectedSchema, options) as Record<string, unknown>;

  // If we have a discriminator property and value, set it in the output
  if (discriminator?.propertyName && discriminatorValue !== undefined && typeof generated === 'object' && generated !== null) {
    generated[discriminator.propertyName] = discriminatorValue;
  }

  return generated;
}

/**
 * Generate a value for an anyOf schema.
 * Randomly selects one or more sub-schemas (seeded), merges them (same as allOf), and generates.
 * At least one sub-schema is always selected.
 */
function generateAnyOf(
  subSchemas: Schema[],
  options: GenerateValueOptions & { propertyName?: string; _overridePath?: string },
): unknown {
  const { faker = defaultFaker } = options;

  // Randomly decide how many to pick (at least 1, at most all)
  const count = faker.number.int({ min: 1, max: subSchemas.length });

  // Shuffle and pick `count` sub-schemas (seeded)
  const shuffled = faker.helpers.shuffle([...subSchemas]);
  const selected = shuffled.slice(0, count);

  if (selected.length === 1) {
    // Single selection — generate directly
    return generateValueForSchema(selected[0]!, options);
  }

  // Multiple selections — merge using allOf logic, then generate
  const merged = mergeAllOf(selected);
  return generateValueForSchema(merged, options);
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

  // Determine count: schema constraints first (baseline), then default 0-5
  let min = 0;
  let max = 5;

  if (minItems !== undefined) min = minItems;
  if (maxItems !== undefined) max = maxItems;

  // Check arrayLengths override — intersect with schema constraints
  // Match by propertyName first, then by overridePath
  const lookupKey = (propertyName && arrayLengths[propertyName] !== undefined)
    ? propertyName
    : (overridePath && arrayLengths[overridePath] !== undefined)
      ? overridePath
      : undefined;

  if (lookupKey !== undefined) {
    const [overrideMin, overrideMax] = arrayLengths[lookupKey]!;
    // Intersect: effective range is overlap of schema constraints and arrayLengths tuple
    min = Math.max(min, overrideMin);
    max = Math.min(max, overrideMax);
    // If exact length (min === max from override), respect that directly
    if (overrideMin === overrideMax) {
      min = overrideMin;
      max = overrideMax;
    }
  }

  // Ensure min <= max (if constraints conflict, clamp to min)
  if (min > max) max = min;

  const count = faker.number.int({ min, max });
  const result: unknown[] = [];

  // Build child arrayLengths by expanding wildcard [*] entries.
  // e.g. if current path is "users" and arrayLengths has "users[*].addresses": [1,1],
  // pass { addresses: [1,1] } into each item's generation.
  // We check both overridePath and propertyName as possible wildcard base paths.
  const wildcardPrefixes: string[] = [];
  if (overridePath) wildcardPrefixes.push(`${overridePath}[*].`);
  if (propertyName && propertyName !== overridePath) wildcardPrefixes.push(`${propertyName}[*].`);

  const childArrayLengths: Record<string, [number, number]> = {};
  const consumedKeys = new Set<string>();
  for (const [key, val] of Object.entries(arrayLengths)) {
    for (const prefix of wildcardPrefixes) {
      if (key.startsWith(prefix)) {
        const childKey = key.slice(prefix.length);
        childArrayLengths[childKey] = val;
        consumedKeys.add(key);
        break;
      }
    }
  }

  // Pass remaining (non-wildcard) keys plus de-scoped wildcard keys to items
  let itemArrayLengths = arrayLengths;
  if (consumedKeys.size > 0) {
    const remaining: Record<string, [number, number]> = {};
    for (const [key, val] of Object.entries(arrayLengths)) {
      if (!consumedKeys.has(key)) {
        remaining[key] = val;
      }
    }
    itemArrayLengths = { ...remaining, ...childArrayLengths };
  }

  for (let i = 0; i < count; i++) {
    const itemPath = overridePath ? `${overridePath}.${i}` : String(i);
    result.push(
      itemSchema
        ? generateValueForSchema(itemSchema, {
            ...options,
            arrayLengths: itemArrayLengths,
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
