import type { Faker } from '@faker-js/faker';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

type Schema = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject;

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const INT64_MIN = Number.MIN_SAFE_INTEGER;
const INT64_MAX = Number.MAX_SAFE_INTEGER;

function resolveNumericBounds(
  schema: Schema,
  defaultMin: number,
  defaultMax: number,
): { min: number; max: number } {
  let min = defaultMin;
  let max = defaultMax;

  if (schema.minimum !== undefined) min = Math.max(min, schema.minimum);
  if (schema.maximum !== undefined) max = Math.min(max, schema.maximum);

  // OpenAPI 3.0.x uses boolean exclusiveMinimum/exclusiveMaximum
  // OpenAPI 3.1.x uses numeric exclusiveMinimum/exclusiveMaximum
  const excMin = (schema as Record<string, unknown>)['exclusiveMinimum'];
  const excMax = (schema as Record<string, unknown>)['exclusiveMaximum'];

  if (typeof excMin === 'boolean' && excMin && schema.minimum !== undefined) {
    min = schema.minimum + 1;
  } else if (typeof excMin === 'number') {
    min = Math.max(min, excMin + 1);
  }

  if (typeof excMax === 'boolean' && excMax && schema.maximum !== undefined) {
    max = schema.maximum - 1;
  } else if (typeof excMax === 'number') {
    max = Math.min(max, excMax - 1);
  }

  return { min, max };
}

function generateString(schema: Schema, faker: Faker): string {
  const format = schema.format;
  const minLength = schema.minLength;
  const maxLength = schema.maxLength;
  const pattern = (schema as Record<string, unknown>)['pattern'] as string | undefined;

  // Format-based generation takes priority
  switch (format) {
    case 'date-time':
      return faker.date.recent().toISOString();
    case 'date':
      return faker.date.recent().toISOString().split('T')[0]!;
    case 'email':
      return faker.internet.email();
    case 'uri':
    case 'url':
      return faker.internet.url();
    case 'uuid':
      return faker.string.uuid();
    case 'hostname':
      return faker.internet.domainName();
    case 'ipv4':
      return faker.internet.ipv4();
    case 'ipv6':
      return faker.internet.ipv6();
    case 'byte':
      // base64 string
      return Buffer.from(faker.lorem.words(3)).toString('base64');
    default:
      break;
  }

  // Pattern-based generation
  if (pattern) {
    try {
      return faker.helpers.fromRegExp(pattern);
    } catch {
      console.warn(
        `openapi-mocks: pattern "${pattern}" could not be used with faker.helpers.fromRegExp, falling back to a plain string`,
      );
    }
  }

  // Length-constrained string
  if (minLength !== undefined || maxLength !== undefined) {
    const min = minLength ?? 0;
    const max = maxLength ?? Math.max(min + 20, 30);
    const length = faker.number.int({ min, max });
    return faker.string.alphanumeric(length);
  }

  return faker.lorem.words(faker.number.int({ min: 1, max: 5 }));
}

function generateNumber(schema: Schema, faker: Faker): number {
  const { min, max } = resolveNumericBounds(schema, -1e9, 1e9);
  const multipleOf = (schema as Record<string, unknown>)['multipleOf'] as number | undefined;

  const value = faker.number.float({ min, max });

  if (multipleOf !== undefined && multipleOf > 0) {
    return Math.round(value / multipleOf) * multipleOf;
  }

  return value;
}

function generateInteger(schema: Schema, faker: Faker): number {
  const isInt64 = schema.format === 'int64';
  const defaultMin = isInt64 ? INT64_MIN : INT32_MIN;
  const defaultMax = isInt64 ? INT64_MAX : INT32_MAX;

  const { min, max } = resolveNumericBounds(schema, defaultMin, defaultMax);
  const multipleOf = (schema as Record<string, unknown>)['multipleOf'] as number | undefined;

  const value = faker.number.int({ min, max });

  if (multipleOf !== undefined && multipleOf > 0) {
    return Math.round(value / multipleOf) * multipleOf;
  }

  return value;
}

function generateArray(schema: Schema, faker: Faker): unknown[] {
  // Generate a simple array with 1–3 items for the type-fallback level
  // The schema walker (US-008) will handle full minItems/maxItems control
  const minItems = (schema as Record<string, unknown>)['minItems'] as number | undefined;
  const maxItems = (schema as Record<string, unknown>)['maxItems'] as number | undefined;
  const min = minItems ?? 0;
  const max = maxItems ?? 3;
  const count = faker.number.int({ min, max });

  const itemSchema = (schema as Record<string, unknown>)['items'] as Schema | undefined;
  const result: unknown[] = [];
  for (let i = 0; i < count; i++) {
    result.push(itemSchema ? generateFromTypeFallback(itemSchema, faker) : faker.lorem.word());
  }
  return result;
}

function generateObject(schema: Schema, faker: Faker): Record<string, unknown> {
  const properties = (schema as Record<string, unknown>)['properties'] as
    | Record<string, Schema>
    | undefined;

  if (!properties) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(properties)) {
    result[key] = generateFromTypeFallback(propSchema, faker);
  }
  return result;
}

/**
 * Generate a value for a given OpenAPI schema using only type/format information.
 * This is the lowest-priority fallback in the generation priority chain.
 *
 * @param schema - OpenAPI schema object
 * @param faker - A Faker.js instance (may be pre-seeded)
 * @returns A generated value matching the schema type
 */
export function generateFromTypeFallback(schema: Schema, faker: Faker): unknown {
  // Handle enum first — works for any type
  const enumValues = (schema as Record<string, unknown>)['enum'] as unknown[] | undefined;
  if (enumValues && enumValues.length > 0) {
    return faker.helpers.arrayElement(enumValues);
  }

  // Resolve type — may be a string or an array (OpenAPI 3.1.x)
  const rawType = (schema as Record<string, unknown>)['type'];
  let type: string | undefined;

  if (typeof rawType === 'string') {
    type = rawType;
  } else if (Array.isArray(rawType)) {
    // Pick first non-null type
    const nonNull = (rawType as string[]).find((t) => t !== 'null');
    type = nonNull ?? 'null';
  }

  switch (type) {
    case 'string':
      return generateString(schema, faker);
    case 'number':
      return generateNumber(schema, faker);
    case 'integer':
      return generateInteger(schema, faker);
    case 'boolean':
      return faker.datatype.boolean();
    case 'array':
      return generateArray(schema, faker);
    case 'object':
      return generateObject(schema, faker);
    case 'null':
      return null;
    default:
      // Unknown or missing type — infer from schema shape
      if ((schema as Record<string, unknown>)['properties']) {
        return generateObject(schema, faker);
      }
      if ((schema as Record<string, unknown>)['items']) {
        return generateArray(schema, faker);
      }
      return faker.lorem.word();
  }
}
