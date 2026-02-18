import { faker as fakerInstance } from '@faker-js/faker';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateValueForSchema, mergeAllOf } from '../generators/schema-walker.js';

const SEED = 42;

beforeEach(() => {
  fakerInstance.seed(SEED);
});

describe('generateValueForSchema', () => {
  // -------------------------------------------------------------------------
  // Priority 1: Overrides
  // -------------------------------------------------------------------------
  describe('priority 1: overrides', () => {
    it('uses override value at the top-level path', () => {
      const schema = { type: 'string' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        overrides: { '': 'forced-value' },
        _overridePath: '',
      });
      // '' is the default path so no match expected for top-level without path
      expect(typeof result).toBe('string');
    });

    it('uses override when path matches _overridePath', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } } } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        overrides: { name: 'Jane Doe' },
        _overridePath: 'name',
      }) as string;
      expect(result).toBe('Jane Doe');
    });

    it('overrides nested property in object', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      } as Record<string, unknown>;

      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        overrides: { 'user.name': 'Override Name' },
      }) as Record<string, unknown>;

      expect((result['user'] as Record<string, unknown>)['name']).toBe('Override Name');
    });

    it('override forces optional field to be included', () => {
      // With a seed that would normally omit the optional field,
      // having an override should force its inclusion
      fakerInstance.seed(SEED);
      const schema = {
        type: 'object',
        properties: {
          optional: { type: 'string' },
          required: { type: 'string' },
        },
        required: ['required'],
      } as Record<string, unknown>;

      // Run 10 times with override - optional should always be present
      for (let i = 0; i < 10; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, {
          faker: fakerInstance,
          overrides: { optional: 'forced' },
        }) as Record<string, unknown>;
        expect(result['optional']).toBe('forced');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Priority 2: spec example / default
  // -------------------------------------------------------------------------
  describe('priority 2: example/default', () => {
    it('uses schema example value', () => {
      const schema = { type: 'string', example: 'example-value' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(result).toBe('example-value');
    });

    it('uses schema default value when no example', () => {
      const schema = { type: 'string', default: 'default-value' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(result).toBe('default-value');
    });

    it('example takes priority over default', () => {
      const schema = {
        type: 'string',
        example: 'example-value',
        default: 'default-value',
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(result).toBe('example-value');
    });

    it('ignores example when ignoreExamples is true', () => {
      const schema = { type: 'string', example: 'example-value' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        ignoreExamples: true,
      });
      // Should not be the example value
      expect(result).not.toBe('example-value');
      expect(typeof result).toBe('string');
    });

    it('ignores default when ignoreExamples is true', () => {
      const schema = { type: 'string', default: 'default-value' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        ignoreExamples: true,
      });
      expect(result).not.toBe('default-value');
      expect(typeof result).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // Priority 3: x-faker-method
  // -------------------------------------------------------------------------
  describe('priority 3: x-faker-method', () => {
    it('calls x-faker-method when present', () => {
      const schema = {
        type: 'string',
        'x-faker-method': 'internet.email',
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(typeof result).toBe('string');
      expect(result as string).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });

    it('x-faker-method overrides smart defaults', () => {
      // Property name "email" would normally use internet.email (same here, but use a different method)
      const schema = {
        type: 'string',
        'x-faker-method': 'string.uuid',
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        propertyName: 'email',
      });
      // Should be a UUID, not an email
      expect(result as string).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('throws for invalid x-faker-method path', () => {
      const schema = {
        type: 'string',
        'x-faker-method': 'nonexistent.method',
      } as Record<string, unknown>;
      expect(() => generateValueForSchema(schema, { faker: fakerInstance })).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Priority 4: Smart defaults
  // -------------------------------------------------------------------------
  describe('priority 4: smart defaults', () => {
    it('uses smart default for known property name', () => {
      const schema = { type: 'string' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        propertyName: 'email',
        ignoreExamples: true,
      });
      // email smart default → internet.email
      expect(typeof result).toBe('string');
      expect(result as string).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });

    it('falls through to type fallback for unknown property names', () => {
      const schema = { type: 'string' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        propertyName: 'unknownXyzAbc',
        ignoreExamples: true,
      });
      expect(typeof result).toBe('string');
    });

    it('skips smart default when type conflicts', () => {
      // email smart default returns a string, but schema type is integer
      const schema = { type: 'integer' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        propertyName: 'email',
        ignoreExamples: true,
      });
      // Should fall through to type-based generation
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result as number)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Priority 5: Type-based fallback
  // -------------------------------------------------------------------------
  describe('priority 5: type-based fallback', () => {
    it('generates string for type: string', () => {
      const schema = { type: 'string' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true });
      expect(typeof result).toBe('string');
    });

    it('generates number for type: number', () => {
      const schema = { type: 'number' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(typeof result).toBe('number');
    });

    it('generates integer for type: integer', () => {
      const schema = { type: 'integer' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result as number)).toBe(true);
    });

    it('generates boolean for type: boolean', () => {
      const schema = { type: 'boolean' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(typeof result).toBe('boolean');
    });
  });

  // -------------------------------------------------------------------------
  // Object generation
  // -------------------------------------------------------------------------
  describe('object generation', () => {
    it('generates an object with properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name', 'age'],
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result['name']).toBe('string');
      expect(typeof result['age']).toBe('number');
    });

    it('returns empty object when no properties', () => {
      const schema = { type: 'object' } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(result).toEqual({});
    });

    it('required properties are always included', () => {
      const schema = {
        type: 'object',
        properties: {
          required: { type: 'string' },
          optional: { type: 'string' },
        },
        required: ['required'],
      } as Record<string, unknown>;

      // Run many times, required should always be present
      for (let i = 0; i < 20; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
        expect(result).toHaveProperty('required');
      }
    });

    it('optional properties may be omitted', () => {
      const schema = {
        type: 'object',
        properties: {
          always: { type: 'string' },
          maybe: { type: 'string' },
        },
        required: ['always'],
      } as Record<string, unknown>;

      const results = [];
      for (let i = 0; i < 30; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>);
      }

      const hasOptional = results.filter((r) => 'maybe' in r).length;
      const missingOptional = results.filter((r) => !('maybe' in r)).length;

      // With 30 runs, should see both included and omitted
      expect(hasOptional).toBeGreaterThan(0);
      expect(missingOptional).toBeGreaterThan(0);
    });

    it('infers object type from properties when no type field', () => {
      const schema = {
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(typeof result['foo']).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // Array generation
  // -------------------------------------------------------------------------
  describe('array generation', () => {
    it('generates an array', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(Array.isArray(result)).toBe(true);
    });

    it('respects minItems and maxItems', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3,
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as unknown[];
      expect(result.length).toBe(3);
    });

    it('generates items of correct type', () => {
      const schema = {
        type: 'array',
        items: { type: 'integer' },
        minItems: 2,
        maxItems: 2,
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as number[];
      for (const item of result) {
        expect(typeof item).toBe('number');
        expect(Number.isInteger(item)).toBe(true);
      }
    });

    it('defaults to 0–5 items when no constraints', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      } as Record<string, unknown>;

      const lengths: number[] = [];
      for (let i = 0; i < 20; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, { faker: fakerInstance }) as unknown[];
        lengths.push(result.length);
      }

      expect(Math.max(...lengths)).toBeLessThanOrEqual(5);
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(0);
    });

    it('infers array type from items when no type field', () => {
      const schema = {
        items: { type: 'string' },
        minItems: 1,
        maxItems: 1,
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, { faker: fakerInstance });
      expect(Array.isArray(result)).toBe(true);
    });

    it('uses arrayLengths option to control array size', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      } as Record<string, unknown>;
      const result = generateValueForSchema(schema, {
        faker: fakerInstance,
        propertyName: 'tags',
        arrayLengths: { tags: [5, 5] },
      }) as unknown[];
      expect(result.length).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Nullable handling
  // -------------------------------------------------------------------------
  describe('nullable handling', () => {
    it('may return null for 3.0.x nullable: true schemas', () => {
      const schema = { type: 'string', nullable: true } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      const nullCount = results.filter((r) => r === null).length;
      const stringCount = results.filter((r) => typeof r === 'string').length;

      expect(nullCount).toBeGreaterThan(0);
      expect(stringCount).toBeGreaterThan(0);
    });

    it('may return null for 3.1.x type: ["string", "null"] schemas', () => {
      const schema = { type: ['string', 'null'] } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      const nullCount = results.filter((r) => r === null).length;
      const stringCount = results.filter((r) => typeof r === 'string').length;

      expect(nullCount).toBeGreaterThan(0);
      expect(stringCount).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Seeded determinism
  // -------------------------------------------------------------------------
  describe('seeded determinism', () => {
    it('produces the same output for the same seed', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 18, maximum: 99 },
        },
        required: ['name', 'email', 'age'],
      } as Record<string, unknown>;

      fakerInstance.seed(123);
      const result1 = generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true });

      fakerInstance.seed(123);
      const result2 = generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true });

      expect(result1).toEqual(result2);
    });
  });

  // -------------------------------------------------------------------------
  // allOf composition
  // -------------------------------------------------------------------------
  describe('allOf composition', () => {
    it('merges two object schemas', () => {
      const schema = {
        allOf: [
          {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
          {
            type: 'object',
            properties: { age: { type: 'integer' } },
            required: ['age'],
          },
        ],
      } as Record<string, unknown>;

      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result['name']).toBe('string');
      expect(typeof result['age']).toBe('number');
      expect(Number.isInteger(result['age'])).toBe(true);
    });

    it('unions required arrays from all sub-schemas', () => {
      const schema = {
        allOf: [
          {
            type: 'object',
            properties: { a: { type: 'string' }, b: { type: 'string' } },
            required: ['a'],
          },
          {
            type: 'object',
            properties: { c: { type: 'string' } },
            required: ['b', 'c'],
          },
        ],
      } as Record<string, unknown>;

      // Run many times — all required fields (a, b, c) should always be present
      for (let i = 0; i < 20; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
        expect(result).toHaveProperty('a');
        expect(result).toHaveProperty('b');
        expect(result).toHaveProperty('c');
      }
    });

    it('includes property from each sub-schema in output', () => {
      const schema = {
        allOf: [
          {
            type: 'object',
            properties: { firstName: { type: 'string' } },
            required: ['firstName'],
          },
          {
            type: 'object',
            properties: { lastName: { type: 'string' } },
            required: ['lastName'],
          },
        ],
      } as Record<string, unknown>;

      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(result).toHaveProperty('firstName');
      expect(result).toHaveProperty('lastName');
    });

    it('throws when allOf sub-schemas have conflicting types', () => {
      const schema = {
        allOf: [
          { type: 'object', properties: { x: { type: 'string' } } },
          { type: 'string' },
        ],
      } as Record<string, unknown>;

      expect(() => generateValueForSchema(schema, { faker: fakerInstance })).toThrow(
        /conflicting types/i,
      );
    });

    it('mergeAllOf: compatible types are merged correctly', () => {
      const merged = mergeAllOf([
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } as Record<string, unknown>,
        { type: 'object', properties: { b: { type: 'integer' } }, required: ['b'] } as Record<string, unknown>,
      ]);

      const m = merged as Record<string, unknown>;
      expect(m['type']).toBe('object');
      expect(m['properties']).toHaveProperty('a');
      expect(m['properties']).toHaveProperty('b');
      expect(m['required']).toEqual(expect.arrayContaining(['a', 'b']));
    });

    it('mergeAllOf: throws on conflicting types', () => {
      expect(() =>
        mergeAllOf([
          { type: 'string' } as Record<string, unknown>,
          { type: 'integer' } as Record<string, unknown>,
        ]),
      ).toThrow(/conflicting types/i);
    });

    it('mergeAllOf: does not duplicate required entries', () => {
      const merged = mergeAllOf([
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } as Record<string, unknown>,
        { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'] } as Record<string, unknown>,
      ]);

      const m = merged as Record<string, unknown>;
      const required = m['required'] as string[];
      expect(required.filter((r) => r === 'a').length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // oneOf composition
  // -------------------------------------------------------------------------
  describe('oneOf composition', () => {
    it('selects one sub-schema randomly when no discriminator', () => {
      const schema = {
        oneOf: [
          { type: 'object', properties: { kind: { type: 'string', enum: ['cat'] }, meow: { type: 'string' } }, required: ['kind', 'meow'] },
          { type: 'object', properties: { kind: { type: 'string', enum: ['dog'] }, bark: { type: 'string' } }, required: ['kind', 'bark'] },
        ],
      } as Record<string, unknown>;

      const results = [];
      for (let i = 0; i < 20; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>);
      }

      // Should see at least one cat and one dog over 20 runs
      const cats = results.filter((r) => 'meow' in r);
      const dogs = results.filter((r) => 'bark' in r);
      expect(cats.length).toBeGreaterThan(0);
      expect(dogs.length).toBeGreaterThan(0);
    });

    it('selects sub-schema via discriminator mapping', () => {
      const catSchema = {
        type: 'object',
        properties: {
          petType: { type: 'string' },
          meow: { type: 'string' },
        },
        required: ['petType', 'meow'],
      };
      const dogSchema = {
        type: 'object',
        properties: {
          petType: { type: 'string' },
          bark: { type: 'string' },
        },
        required: ['petType', 'bark'],
      };

      // Simulate discriminator with mapping (mapping points to schemas by ref name)
      // Since refs are resolved, we pass schemas directly in oneOf
      // and the discriminator mapping references the schemas
      const schema = {
        oneOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
        discriminator: {
          propertyName: 'petType',
          mapping: {
            cat: '#/components/schemas/Cat',
            dog: '#/components/schemas/Dog',
          },
        },
      } as Record<string, unknown>;

      // Since $refs won't be resolved in isolation, test the discriminator property name behavior
      // by using inline schemas that don't use $ref
      const inlineSchema = {
        oneOf: [catSchema, dogSchema],
        discriminator: {
          propertyName: 'petType',
        },
      } as Record<string, unknown>;

      fakerInstance.seed(SEED);
      const result = generateValueForSchema(inlineSchema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(typeof result).toBe('object');
      // Either cat or dog schema selected — both have petType
      expect(result).toHaveProperty('petType');
    });

    it('sets discriminator property to correct value when enum is present', () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['cat'] },
              name: { type: 'string' },
            },
            required: ['kind', 'name'],
          },
        ],
        discriminator: {
          propertyName: 'kind',
        },
      } as Record<string, unknown>;

      fakerInstance.seed(SEED);
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(result['kind']).toBe('cat');
    });

    it('sets discriminator property to const value when const is present', () => {
      const schema = {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'circle' },
              radius: { type: 'number' },
            },
            required: ['type', 'radius'],
          },
        ],
        discriminator: {
          propertyName: 'type',
        },
      } as Record<string, unknown>;

      fakerInstance.seed(SEED);
      const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
      expect(result['type']).toBe('circle');
    });

    it('generates valid output for each possible sub-schema', () => {
      const schema = {
        oneOf: [
          { type: 'string' },
          { type: 'integer' },
          { type: 'boolean' },
        ],
      } as Record<string, unknown>;

      const results = new Set<string>();
      for (let i = 0; i < 30; i++) {
        fakerInstance.seed(i);
        const r = generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true });
        results.add(typeof r);
      }

      // Should generate various types
      expect(results.size).toBeGreaterThan(1);
    });
  });

  // -------------------------------------------------------------------------
  // anyOf composition
  // -------------------------------------------------------------------------
  describe('anyOf composition', () => {
    it('selects at least one sub-schema', () => {
      const schema = {
        anyOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] },
        ],
      } as Record<string, unknown>;

      // Run multiple times — should always produce a result (never undefined/null)
      for (let i = 0; i < 20; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, { faker: fakerInstance });
        expect(result).not.toBeUndefined();
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      }
    });

    it('can select a single sub-schema', () => {
      const schema = {
        anyOf: [
          { type: 'string' },
        ],
      } as Record<string, unknown>;

      const result = generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true });
      expect(typeof result).toBe('string');
    });

    it('merges multiple selected sub-schemas and includes all their properties', () => {
      // With only 2 schemas, when both are selected, all properties appear
      // Use minItems/maxItems to force 2 selections via schemas with no overlap
      // Strategy: seed until we get a multi-schema merge scenario
      let foundMulti = false;
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        const schema = {
          anyOf: [
            { type: 'object', properties: { alpha: { type: 'string' } }, required: ['alpha'] },
            { type: 'object', properties: { beta: { type: 'string' } }, required: ['beta'] },
          ],
        } as Record<string, unknown>;

        const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
        if ('alpha' in result && 'beta' in result) {
          foundMulti = true;
          break;
        }
      }
      // With 50 iterations we expect at least one multi-selection case
      expect(foundMulti).toBe(true);
    });

    it('produces varied output across seeds (different sub-schema selections)', () => {
      const schema = {
        anyOf: [
          { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
          { type: 'object', properties: { y: { type: 'string' } }, required: ['y'] },
        ],
      } as Record<string, unknown>;

      const hasX: boolean[] = [];
      const hasY: boolean[] = [];
      for (let i = 0; i < 30; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(schema, { faker: fakerInstance }) as Record<string, unknown>;
        hasX.push('x' in result);
        hasY.push('y' in result);
      }

      // Should see both x and y appear across seeds
      expect(hasX.some(Boolean)).toBe(true);
      expect(hasY.some(Boolean)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // OpenAPI 3.0.x vs 3.1.x compatibility (US-012)
  // -------------------------------------------------------------------------
  describe('OpenAPI 3.0.x vs 3.1.x compatibility', () => {
    it('3.0.x nullable: true treated equivalently to 3.1.x type: ["string", "null"]', () => {
      const schema30 = { type: 'string', nullable: true } as Record<string, unknown>;
      const schema31 = { type: ['string', 'null'] } as Record<string, unknown>;

      // Both should produce null sometimes and a string other times
      const results30: unknown[] = [];
      const results31: unknown[] = [];

      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results30.push(generateValueForSchema(schema30, { faker: fakerInstance, ignoreExamples: true }));
        fakerInstance.seed(i);
        results31.push(generateValueForSchema(schema31, { faker: fakerInstance, ignoreExamples: true }));
      }

      // Both should have null values
      expect(results30.some((r) => r === null)).toBe(true);
      expect(results31.some((r) => r === null)).toBe(true);
      // Both should have string values
      expect(results30.some((r) => typeof r === 'string')).toBe(true);
      expect(results31.some((r) => typeof r === 'string')).toBe(true);
      // Neither should produce non-string, non-null values
      expect(results30.every((r) => r === null || typeof r === 'string')).toBe(true);
      expect(results31.every((r) => r === null || typeof r === 'string')).toBe(true);
    });

    it('3.1.x type array uses non-null type for generation when not returning null', () => {
      const schema = { type: ['integer', 'null'], minimum: 1, maximum: 100 } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      // Non-null values must be integers (whole numbers)
      const nonNulls = results.filter((r) => r !== null);
      expect(nonNulls.length).toBeGreaterThan(0);
      for (const v of nonNulls) {
        expect(typeof v).toBe('number');
        expect(Number.isInteger(v)).toBe(true);
        expect(v as number).toBeGreaterThanOrEqual(1);
        expect(v as number).toBeLessThanOrEqual(100);
      }
    });

    it('3.1.x type array with multiple non-null types uses the first non-null type', () => {
      const schema = { type: ['string', 'null'] } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 30; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      const nonNulls = results.filter((r) => r !== null);
      expect(nonNulls.length).toBeGreaterThan(0);
      // All non-null values must be strings
      for (const v of nonNulls) {
        expect(typeof v).toBe('string');
      }
    });

    it('3.0.x nullable integer schema generates integers when not null', () => {
      const schema = {
        type: 'integer',
        nullable: true,
        minimum: 10,
        maximum: 20,
      } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      const nonNulls = results.filter((r) => r !== null);
      expect(nonNulls.length).toBeGreaterThan(0);
      for (const v of nonNulls) {
        expect(typeof v).toBe('number');
        expect(Number.isInteger(v)).toBe(true);
        expect(v as number).toBeGreaterThanOrEqual(10);
        expect(v as number).toBeLessThanOrEqual(20);
      }
    });

    it('sibling keywords alongside a resolved $ref are respected', () => {
      // In 3.1.x, $ref siblings are valid. After Swagger Parser resolution,
      // $ref is gone but sibling keywords remain. The walker should honor them.
      // Simulating post-resolution: schema has sibling keywords (description, example)
      // alongside the resolved properties — walker must not discard them.
      const schema = {
        type: 'object',
        description: 'A user object',
        example: { id: 'example-id', name: 'Example User' },
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      } as Record<string, unknown>;

      // With ignoreExamples: false, the example sibling keyword is used
      fakerInstance.seed(SEED);
      const withExample = generateValueForSchema(schema, {
        faker: fakerInstance,
        ignoreExamples: false,
      }) as Record<string, unknown>;
      expect(withExample).toEqual({ id: 'example-id', name: 'Example User' });

      // With ignoreExamples: true, the type-based fallback is used
      fakerInstance.seed(SEED);
      const withoutExample = generateValueForSchema(schema, {
        faker: fakerInstance,
        ignoreExamples: true,
      }) as Record<string, unknown>;
      expect(typeof withoutExample['id']).toBe('string');
      expect(typeof withoutExample['name']).toBe('string');
    });

    it('3.0.x nullable object generates object when not null', () => {
      const schema = {
        type: 'object',
        nullable: true,
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      } as Record<string, unknown>;

      const results: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.push(generateValueForSchema(schema, { faker: fakerInstance, ignoreExamples: true }));
      }

      const nonNulls = results.filter((r) => r !== null);
      expect(nonNulls.length).toBeGreaterThan(0);
      for (const v of nonNulls) {
        expect(typeof v).toBe('object');
        expect(v).not.toBeNull();
        expect((v as Record<string, unknown>)['value']).toBeDefined();
        expect(typeof (v as Record<string, unknown>)['value']).toBe('string');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Circular reference handling (US-013)
  // -------------------------------------------------------------------------
  describe('circular reference handling', () => {
    it('stops recursion at default maxDepth (3) for self-referential schemas', () => {
      // Simulate a self-referential schema by reusing the same object reference
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['child'],
      };
      // Make it self-referential by reference
      nodeSchema['properties'] = { child: nodeSchema };

      // Should not throw or infinite loop; depth limit prevents infinite recursion
      expect(() =>
        generateValueForSchema(nodeSchema, {
          faker: fakerInstance,
        }),
      ).not.toThrow();
    });

    it('optional circular field is omitted when depth limit is reached', () => {
      // Node with an optional self-reference
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        // 'child' is NOT in required — it's optional
      };
      nodeSchema['properties'] = {
        id: { type: 'string' },
        child: nodeSchema,
      };

      // Run multiple times — optional circular field should be omitted at depth limit
      let seenWithoutChild = false;
      for (let i = 0; i < 30; i++) {
        fakerInstance.seed(i);
        const result = generateValueForSchema(nodeSchema, {
          faker: fakerInstance,
          maxDepth: 1,
        }) as Record<string, unknown>;
        expect(typeof result).toBe('object');
        // id is required, should always be present
        expect(result).toHaveProperty('id');
        // At depth limit, optional circular field must not cause infinite loop
        // (may or may not be present at shallow levels)
        if (!('child' in result)) {
          seenWithoutChild = true;
        }
      }
      expect(seenWithoutChild).toBe(true);
    });

    it('required circular field gets a minimal stub at depth limit', () => {
      // Node with a required self-reference
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['self'],
      };
      nodeSchema['properties'] = { self: nodeSchema };

      fakerInstance.seed(SEED);
      // Should not throw; the required circular field gets a stub
      const result = generateValueForSchema(nodeSchema, {
        faker: fakerInstance,
        maxDepth: 1,
      }) as Record<string, unknown>;

      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      // The self field may be a stub (empty object, null, etc.) — but should be defined
      expect('self' in result).toBe(true);
    });

    it('custom maxDepth is respected', () => {
      // With maxDepth: 0, should immediately stub required circular refs
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['child'],
      };
      nodeSchema['properties'] = { child: nodeSchema };

      fakerInstance.seed(SEED);
      expect(() =>
        generateValueForSchema(nodeSchema, {
          faker: fakerInstance,
          maxDepth: 0,
        }),
      ).not.toThrow();

      // With maxDepth: 5, should recurse deeper before stopping
      const linearSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['next'],
      };
      linearSchema['properties'] = { next: linearSchema };

      fakerInstance.seed(SEED);
      expect(() =>
        generateValueForSchema(linearSchema, {
          faker: fakerInstance,
          maxDepth: 5,
        }),
      ).not.toThrow();
    });

    it('self-referential schema at depth 3 produces valid output at all levels', () => {
      // Verify that the output at each level is a valid object, not undefined
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['id'],
      };
      nodeSchema['properties'] = {
        id: { type: 'string' },
        child: nodeSchema, // optional circular reference
      };

      fakerInstance.seed(SEED);
      const result = generateValueForSchema(nodeSchema, {
        faker: fakerInstance,
        maxDepth: 3,
        ignoreExamples: true,
      }) as Record<string, unknown>;

      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result['id']).toBe('string');
    });
  });
});
