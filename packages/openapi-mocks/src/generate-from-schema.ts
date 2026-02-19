import { Faker, en } from '@faker-js/faker';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { generateValueForSchema, type Schema } from './generators/schema-walker.js';

/**
 * A single OpenAPI schema object (from either 3.0.x or 3.1.x).
 */
export type OpenAPISchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject | Record<string, unknown>;

/**
 * Options for `generateFromSchema`.
 */
export interface GenerateFromSchemaOptions {
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
   * A map of dot-notation paths to override values.
   * Applied before generation at the corresponding path.
   */
  overrides?: Record<string, unknown>;

  /**
   * Array length overrides: dot-path → [min, max]
   */
  arrayLengths?: Record<string, [number, number]>;

  /**
   * Maximum recursion depth for circular reference prevention.
   * @default 3
   */
  maxDepth?: number;
}

/**
 * Generate a mock value for a single OpenAPI schema object.
 *
 * Useful for ad-hoc mocking in unit tests or Storybook stories
 * without needing a full OpenAPI document.
 *
 * Uses the full resolution priority chain:
 *   overrides → spec example/default → x-faker-method → smart defaults → type fallback
 *
 * @param schema - An OpenAPI 3.0.x or 3.1.x schema object
 * @param options - Optional generation options
 * @returns A generated value matching the schema
 */
export function generateFromSchema(
  schema: OpenAPISchemaObject,
  options: GenerateFromSchemaOptions = {},
): unknown {
  const { seed, ignoreExamples = false, overrides = {}, arrayLengths = {}, maxDepth = 3 } = options;

  // Create a seeded Faker instance if a seed is provided
  const faker = new Faker({ locale: [en] });
  if (seed !== undefined) {
    faker.seed(seed);
  }

  return generateValueForSchema(schema as Schema, {
    faker,
    ignoreExamples,
    overrides,
    arrayLengths,
    maxDepth,
  });
}
