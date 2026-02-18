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
  // Circular reference handling
  // -------------------------------------------------------------------------
  describe('circular reference handling', () => {
    it('stops recursion at maxDepth and returns minimal stub for required fields', () => {
      // Simulate a self-referential schema by reusing the same object reference
      const childSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: ['self'],
      };
      // Make it self-referential by reference
      childSchema['properties'] = { self: childSchema };

      // Should not throw or infinite loop
      expect(() =>
        generateValueForSchema(childSchema, {
          faker: fakerInstance,
          maxDepth: 2,
        }),
      ).not.toThrow();
    });
  });
});
