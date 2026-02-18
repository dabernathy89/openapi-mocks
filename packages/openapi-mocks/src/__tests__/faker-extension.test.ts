import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { callFakerMethod } from '../generators/faker-extension.js';

describe('callFakerMethod', () => {
  describe('valid dot-paths', () => {
    it('calls a simple two-segment method and returns a value', () => {
      const result = callFakerMethod(faker, 'internet.email');
      expect(typeof result).toBe('string');
      expect(result as string).toContain('@');
    });

    it('calls faker.string.uuid and returns a UUID-shaped string', () => {
      const result = callFakerMethod(faker, 'string.uuid');
      expect(typeof result).toBe('string');
      expect(result as string).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('calls faker.lorem.word and returns a non-empty string', () => {
      const result = callFakerMethod(faker, 'lorem.word');
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });

    it('calls faker.datatype.boolean and returns a boolean', () => {
      const result = callFakerMethod(faker, 'datatype.boolean');
      expect(typeof result).toBe('boolean');
    });

    it('calls faker.image.avatar and returns a string', () => {
      const result = callFakerMethod(faker, 'image.avatar');
      expect(typeof result).toBe('string');
    });

    it('calls faker.location.city and returns a string', () => {
      const result = callFakerMethod(faker, 'location.city');
      expect(typeof result).toBe('string');
    });

    it('respects faker seed for deterministic output', () => {
      faker.seed(42);
      const result1 = callFakerMethod(faker, 'internet.email');
      faker.seed(42);
      const result2 = callFakerMethod(faker, 'internet.email');
      expect(result1).toBe(result2);
    });
  });

  describe('method with no arguments works', () => {
    it('calls faker.person.firstName with no arguments', () => {
      const result = callFakerMethod(faker, 'person.firstName');
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThan(0);
    });
  });

  describe('nested path works', () => {
    it('resolves a two-level deep path', () => {
      const result = callFakerMethod(faker, 'finance.currencyCode');
      expect(typeof result).toBe('string');
      expect((result as string).length).toBe(3); // Currency codes are 3 letters
    });
  });

  describe('invalid dot-paths throw descriptive errors', () => {
    it('throws when the module does not exist', () => {
      expect(() => callFakerMethod(faker, 'nonexistent.method')).toThrowError(
        /nonexistent/,
      );
    });

    it('throws when the method does not exist in a valid module', () => {
      expect(() => callFakerMethod(faker, 'internet.nonexistentMethod')).toThrowError(
        /nonexistentMethod/,
      );
    });

    it('throws when only one segment is provided', () => {
      expect(() => callFakerMethod(faker, 'internet')).toThrowError(
        /not a valid Faker dot-path/,
      );
    });

    it('throws when the path is empty', () => {
      expect(() => callFakerMethod(faker, '')).toThrowError(
        /not a valid Faker dot-path/,
      );
    });

    it('includes the invalid path in the error message', () => {
      expect(() => callFakerMethod(faker, 'nonexistent.method')).toThrowError(
        'nonexistent.method',
      );
    });

    it('throws with a helpful message for invalid method', () => {
      let error: Error | undefined;
      try {
        callFakerMethod(faker, 'internet.fakeMethodThatDoesNotExist');
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
      expect(error!.message).toContain('fakeMethodThatDoesNotExist');
      expect(error!.message).toContain('openapi-mocks');
    });
  });
});
