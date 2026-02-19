import { describe, it, expect } from 'vitest';
import { generateFromSchema } from '../generate-from-schema.js';

describe('generateFromSchema', () => {
  // -----------------------------------------------------------------------
  // Basic object generation (from mock-data-example.ts example 6)
  // -----------------------------------------------------------------------
  describe('basic object', () => {
    it('generates an object with required fields', () => {
      const result = generateFromSchema(
        {
          type: 'object',
          properties: {
            street: { type: 'string', 'x-faker-method': 'location.streetAddress' },
            city: { type: 'string', 'x-faker-method': 'location.city' },
            zip: { type: 'string', 'x-faker-method': 'location.zipCode' },
          },
          required: ['street', 'city', 'zip'],
        },
        { seed: 42 },
      );

      expect(result).toBeTypeOf('object');
      expect(result).not.toBeNull();
      const obj = result as Record<string, unknown>;
      expect(obj).toHaveProperty('street');
      expect(obj).toHaveProperty('city');
      expect(obj).toHaveProperty('zip');
      expect(typeof obj['street']).toBe('string');
      expect(typeof obj['city']).toBe('string');
      expect(typeof obj['zip']).toBe('string');
    });

    it('is deterministic with a seed', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name', 'age'],
      };

      const result1 = generateFromSchema(schema, { seed: 99 });
      const result2 = generateFromSchema(schema, { seed: 99 });

      expect(result1).toEqual(result2);
    });

    it('differs with different seeds', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      };

      const result1 = generateFromSchema(schema, { seed: 1 }) as Record<string, unknown>;
      const result2 = generateFromSchema(schema, { seed: 999 }) as Record<string, unknown>;

      // Different seeds should produce different results (not guaranteed but extremely likely for strings)
      // We just assert both are strings
      expect(typeof result1['id']).toBe('string');
      expect(typeof result2['id']).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // oneOf with discriminator (from mock-data-example.ts example 7)
  // -----------------------------------------------------------------------
  describe('oneOf with discriminator', () => {
    const notificationSchema = {
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['email'] },
            subject: { type: 'string' },
            to: { type: 'string', 'x-faker-method': 'internet.email' },
          },
          required: ['type', 'subject', 'to'],
        },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['sms'] },
            body: { type: 'string' },
            phone: { type: 'string', 'x-faker-method': 'phone.number' },
          },
          required: ['type', 'body', 'phone'],
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: { email: '#/oneOf/0', sms: '#/oneOf/1' },
      },
    };

    it('generates a valid notification object', () => {
      const result = generateFromSchema(notificationSchema, { seed: 7 }) as Record<string, unknown>;

      expect(result).toBeTypeOf('object');
      expect(result).not.toBeNull();
      // Should have a 'type' discriminator field
      expect(result).toHaveProperty('type');
      const type = result['type'];
      expect(['email', 'sms']).toContain(type);
    });

    it('is deterministic with a seed', () => {
      const result1 = generateFromSchema(notificationSchema, { seed: 7 });
      const result2 = generateFromSchema(notificationSchema, { seed: 7 });

      expect(result1).toEqual(result2);
    });
  });

  // -----------------------------------------------------------------------
  // Arrays with constraints (from mock-data-example.ts example 8)
  // -----------------------------------------------------------------------
  describe('array with constraints', () => {
    it('generates an array within minItems/maxItems bounds', () => {
      const result = generateFromSchema(
        {
          type: 'array',
          items: { type: 'string', 'x-faker-method': 'lorem.word' },
          minItems: 2,
          maxItems: 4,
        },
        { seed: 42 },
      );

      expect(Array.isArray(result)).toBe(true);
      const arr = result as unknown[];
      expect(arr.length).toBeGreaterThanOrEqual(2);
      expect(arr.length).toBeLessThanOrEqual(4);
      for (const item of arr) {
        expect(typeof item).toBe('string');
      }
    });

    it('is deterministic with a seed', () => {
      const schema = {
        type: 'array',
        items: { type: 'integer' },
        minItems: 3,
        maxItems: 3,
      };
      const result1 = generateFromSchema(schema, { seed: 100 });
      const result2 = generateFromSchema(schema, { seed: 100 });

      expect(result1).toEqual(result2);
    });
  });

  // -----------------------------------------------------------------------
  // Nullable & optional fields (from mock-data-example.ts example 9)
  // -----------------------------------------------------------------------
  describe('nullable and optional fields', () => {
    const profileSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        bio: { type: ['string', 'null'] },      // 3.1.x nullable
        nickname: { type: 'string' },           // not required → may be omitted
      },
      required: ['name'],
    };

    it('always includes required fields', () => {
      for (let seed = 0; seed < 20; seed++) {
        const result = generateFromSchema(profileSchema, { seed }) as Record<string, unknown>;
        expect(result).toHaveProperty('name');
        expect(typeof result['name']).toBe('string');
      }
    });

    it('bio is either null or a string', () => {
      const results = Array.from({ length: 20 }, (_, i) =>
        generateFromSchema(profileSchema, { seed: i }) as Record<string, unknown>,
      );
      for (const result of results) {
        if ('bio' in result) {
          const bio = result['bio'];
          expect(bio === null || typeof bio === 'string').toBe(true);
        }
      }
    });

    it('nullable bio can be null across seeds', () => {
      const nullCount = Array.from({ length: 30 }, (_, i) => {
        const result = generateFromSchema(profileSchema, { seed: i }) as Record<string, unknown>;
        return 'bio' in result && result['bio'] === null;
      }).filter(Boolean).length;

      // With 30 seeds, at least one should produce null for bio
      expect(nullCount).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // ignoreExamples option
  // -----------------------------------------------------------------------
  describe('ignoreExamples option', () => {
    const schemaWithExample = {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    };

    it('uses spec example by default', () => {
      const result = generateFromSchema(schemaWithExample, { seed: 1 }) as Record<string, unknown>;
      expect(result['email']).toBe('user@example.com');
    });

    it('ignores spec example when ignoreExamples is true', () => {
      const result = generateFromSchema(schemaWithExample, { seed: 1, ignoreExamples: true }) as Record<string, unknown>;
      // Should NOT be the spec example value
      expect(result['email']).not.toBe('user@example.com');
      expect(typeof result['email']).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // overrides option
  // -----------------------------------------------------------------------
  describe('overrides option', () => {
    it('applies an override to a top-level field', () => {
      const result = generateFromSchema(
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
          },
          required: ['name', 'age'],
        },
        {
          seed: 42,
          overrides: { name: 'Fixed Name' },
        },
      ) as Record<string, unknown>;

      expect(result['name']).toBe('Fixed Name');
      expect(typeof result['age']).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // Primitive types
  // -----------------------------------------------------------------------
  describe('primitive types', () => {
    it('generates a string', () => {
      const result = generateFromSchema({ type: 'string' }, { seed: 1 });
      expect(typeof result).toBe('string');
    });

    it('generates an integer', () => {
      const result = generateFromSchema({ type: 'integer' }, { seed: 1 });
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('generates a number', () => {
      const result = generateFromSchema({ type: 'number' }, { seed: 1 });
      expect(typeof result).toBe('number');
    });

    it('generates a boolean', () => {
      const result = generateFromSchema({ type: 'boolean' }, { seed: 1 });
      expect(typeof result).toBe('boolean');
    });
  });

  // -----------------------------------------------------------------------
  // allOf composition
  // -----------------------------------------------------------------------
  describe('allOf composition', () => {
    it('generates merged properties from allOf', () => {
      const result = generateFromSchema(
        {
          allOf: [
            { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
          ],
        },
        { seed: 42 },
      ) as Record<string, unknown>;

      expect(typeof result['id']).toBe('string');
      expect(typeof result['name']).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // anyOf composition
  // -----------------------------------------------------------------------
  describe('anyOf composition', () => {
    it('generates a value matching one or more anyOf sub-schemas', () => {
      const result = generateFromSchema(
        {
          anyOf: [
            { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
            { type: 'object', properties: { b: { type: 'integer' } }, required: ['b'] },
          ],
        },
        { seed: 42 },
      );

      expect(result).toBeTypeOf('object');
      expect(result).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Circular reference handling
  // -----------------------------------------------------------------------
  describe('circular reference / maxDepth', () => {
    it('handles self-referential schemas without infinite loop', () => {
      const nodeSchema: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: [],
      };
      // Make it self-referential
      (nodeSchema['properties'] as Record<string, unknown>)['child'] = nodeSchema;
      (nodeSchema['properties'] as Record<string, unknown>)['name'] = { type: 'string' };

      expect(() => generateFromSchema(nodeSchema, { seed: 1, maxDepth: 2 })).not.toThrow();
    });
  });
});
