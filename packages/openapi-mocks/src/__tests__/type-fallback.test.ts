import { faker as fakerInstance } from '@faker-js/faker';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateFromTypeFallback } from '../generators/type-fallback.js';

// Use a fixed seed for deterministic tests
const SEED = 12345;

beforeEach(() => {
  fakerInstance.seed(SEED);
});

describe('generateFromTypeFallback', () => {
  describe('enum', () => {
    it('picks a value from enum list', () => {
      const result = generateFromTypeFallback(
        { type: 'string', enum: ['foo', 'bar', 'baz'] },
        fakerInstance,
      );
      expect(['foo', 'bar', 'baz']).toContain(result);
    });

    it('works with numeric enum', () => {
      const result = generateFromTypeFallback(
        { type: 'integer', enum: [1, 2, 3] },
        fakerInstance,
      );
      expect([1, 2, 3]).toContain(result);
    });
  });

  describe('string type', () => {
    it('generates a string', () => {
      const result = generateFromTypeFallback({ type: 'string' }, fakerInstance);
      expect(typeof result).toBe('string');
    });

    it('format: date-time returns ISO date string', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'date-time' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect(() => new Date(result as string)).not.toThrow();
      expect((result as string)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('format: date returns date string', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'date' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('format: email returns email', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'email' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });

    it('format: uri returns URL', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'uri' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(/^https?:\/\//);
    });

    it('format: url returns URL', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'url' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(/^https?:\/\//);
    });

    it('format: uuid returns UUID', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'uuid' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('format: hostname returns hostname', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'hostname' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect(result as string).toBeTruthy();
    });

    it('format: ipv4 returns IPv4 address', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'ipv4' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect((result as string)).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    it('format: ipv6 returns IPv6 address', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'ipv6' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      expect(result as string).toBeTruthy();
    });

    it('format: byte returns base64 string', () => {
      const result = generateFromTypeFallback(
        { type: 'string', format: 'byte' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      // base64 characters only
      expect((result as string)).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('respects minLength and maxLength', () => {
      const result = generateFromTypeFallback(
        { type: 'string', minLength: 5, maxLength: 10 },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      const len = (result as string).length;
      expect(len).toBeGreaterThanOrEqual(5);
      expect(len).toBeLessThanOrEqual(10);
    });

    it('respects pattern (best-effort)', () => {
      const result = generateFromTypeFallback(
        { type: 'string', pattern: '[0-9]{4}' },
        fakerInstance,
      );
      expect(typeof result).toBe('string');
      // Should produce something matching the pattern or fall back gracefully
      expect(result as string).toBeTruthy();
    });
  });

  describe('number type', () => {
    it('generates a number', () => {
      const result = generateFromTypeFallback({ type: 'number' }, fakerInstance);
      expect(typeof result).toBe('number');
    });

    it('respects minimum', () => {
      const result = generateFromTypeFallback(
        { type: 'number', minimum: 100 },
        fakerInstance,
      );
      expect(result as number).toBeGreaterThanOrEqual(100);
    });

    it('respects maximum', () => {
      const result = generateFromTypeFallback(
        { type: 'number', maximum: 10 },
        fakerInstance,
      );
      expect(result as number).toBeLessThanOrEqual(10);
    });

    it('respects minimum and maximum together', () => {
      const result = generateFromTypeFallback(
        { type: 'number', minimum: 5, maximum: 10 },
        fakerInstance,
      );
      expect(result as number).toBeGreaterThanOrEqual(5);
      expect(result as number).toBeLessThanOrEqual(10);
    });

    it('respects exclusiveMinimum (boolean, 3.0.x)', () => {
      for (let i = 0; i < 20; i++) {
        const result = generateFromTypeFallback(
          { type: 'number', minimum: 5, exclusiveMinimum: true } as Record<string, unknown>,
          fakerInstance,
        );
        expect(result as number).toBeGreaterThan(5);
      }
    });

    it('respects exclusiveMaximum (boolean, 3.0.x)', () => {
      for (let i = 0; i < 20; i++) {
        const result = generateFromTypeFallback(
          { type: 'number', maximum: 10, exclusiveMaximum: true } as Record<string, unknown>,
          fakerInstance,
        );
        expect(result as number).toBeLessThan(10);
      }
    });

    it('respects multipleOf', () => {
      const result = generateFromTypeFallback(
        { type: 'number', minimum: 0, maximum: 100, multipleOf: 5 } as Record<string, unknown>,
        fakerInstance,
      );
      expect((result as number) % 5).toBeCloseTo(0);
    });
  });

  describe('integer type', () => {
    it('generates an integer', () => {
      const result = generateFromTypeFallback({ type: 'integer' }, fakerInstance);
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('generates within int32 range by default', () => {
      const result = generateFromTypeFallback({ type: 'integer' }, fakerInstance);
      expect(result as number).toBeGreaterThanOrEqual(-2147483648);
      expect(result as number).toBeLessThanOrEqual(2147483647);
    });

    it('generates within int64 range for format: int64', () => {
      const result = generateFromTypeFallback(
        { type: 'integer', format: 'int64' },
        fakerInstance,
      );
      expect(typeof result).toBe('number');
    });

    it('respects minimum and maximum', () => {
      const result = generateFromTypeFallback(
        { type: 'integer', minimum: 1, maximum: 100 },
        fakerInstance,
      );
      expect(result as number).toBeGreaterThanOrEqual(1);
      expect(result as number).toBeLessThanOrEqual(100);
    });

    it('respects multipleOf', () => {
      const result = generateFromTypeFallback(
        { type: 'integer', minimum: 0, maximum: 100, multipleOf: 3 } as Record<string, unknown>,
        fakerInstance,
      );
      expect((result as number) % 3).toBe(0);
    });
  });

  describe('boolean type', () => {
    it('generates a boolean', () => {
      const result = generateFromTypeFallback({ type: 'boolean' }, fakerInstance);
      expect(typeof result).toBe('boolean');
    });

    it('can return true or false (statistical check with seed)', () => {
      const results = new Set<boolean>();
      for (let i = 0; i < 50; i++) {
        fakerInstance.seed(i);
        results.add(generateFromTypeFallback({ type: 'boolean' }, fakerInstance) as boolean);
      }
      // With 50 different seeds, should see both true and false
      expect(results.has(true)).toBe(true);
      expect(results.has(false)).toBe(true);
    });
  });

  describe('array type', () => {
    it('generates an array', () => {
      const result = generateFromTypeFallback({ type: 'array', items: { type: 'string' } }, fakerInstance);
      expect(Array.isArray(result)).toBe(true);
    });

    it('generates items of correct type', () => {
      const result = generateFromTypeFallback(
        { type: 'array', items: { type: 'integer' } },
        fakerInstance,
      ) as number[];
      for (const item of result) {
        expect(typeof item).toBe('number');
        expect(Number.isInteger(item)).toBe(true);
      }
    });

    it('respects minItems and maxItems', () => {
      const result = generateFromTypeFallback(
        { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 } as Record<string, unknown>,
        fakerInstance,
      ) as unknown[];
      expect(result.length).toBe(2);
    });
  });

  describe('object type', () => {
    it('generates an object', () => {
      const result = generateFromTypeFallback({ type: 'object' }, fakerInstance);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    });

    it('generates properties from schema', () => {
      const result = generateFromTypeFallback(
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
          },
        },
        fakerInstance,
      ) as Record<string, unknown>;
      expect(typeof result['name']).toBe('string');
      expect(typeof result['age']).toBe('number');
    });

    it('returns empty object when no properties defined', () => {
      const result = generateFromTypeFallback({ type: 'object' }, fakerInstance);
      expect(result).toEqual({});
    });
  });

  describe('null type', () => {
    it('returns null for type: null', () => {
      const result = generateFromTypeFallback(
        { type: 'null' } as Record<string, unknown>,
        fakerInstance,
      );
      expect(result).toBeNull();
    });
  });

  describe('OpenAPI 3.1.x array type', () => {
    it('handles type as array, picks first non-null type', () => {
      const result = generateFromTypeFallback(
        { type: ['string', 'null'] } as Record<string, unknown>,
        fakerInstance,
      );
      expect(typeof result).toBe('string');
    });

    it('handles type: ["null"] by returning null', () => {
      const result = generateFromTypeFallback(
        { type: ['null'] } as Record<string, unknown>,
        fakerInstance,
      );
      expect(result).toBeNull();
    });
  });

  describe('type inference fallback', () => {
    it('infers object from properties', () => {
      const result = generateFromTypeFallback(
        { properties: { foo: { type: 'string' } } } as Record<string, unknown>,
        fakerInstance,
      ) as Record<string, unknown>;
      expect(typeof result['foo']).toBe('string');
    });

    it('infers array from items', () => {
      const result = generateFromTypeFallback(
        { items: { type: 'boolean' } } as Record<string, unknown>,
        fakerInstance,
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns a word for unknown types', () => {
      const result = generateFromTypeFallback({} as Record<string, unknown>, fakerInstance);
      expect(typeof result).toBe('string');
    });
  });

  describe('determinism with seed', () => {
    it('produces same output for same seed', () => {
      fakerInstance.seed(42);
      const result1 = generateFromTypeFallback({ type: 'string' }, fakerInstance);
      fakerInstance.seed(42);
      const result2 = generateFromTypeFallback({ type: 'string' }, fakerInstance);
      expect(result1).toBe(result2);
    });

    it('produces same integer for same seed', () => {
      fakerInstance.seed(99);
      const result1 = generateFromTypeFallback(
        { type: 'integer', minimum: 1, maximum: 100 },
        fakerInstance,
      );
      fakerInstance.seed(99);
      const result2 = generateFromTypeFallback(
        { type: 'integer', minimum: 1, maximum: 100 },
        fakerInstance,
      );
      expect(result1).toBe(result2);
    });
  });
});
