import { describe, expect, it } from 'vitest';
import { getSmartDefault, SMART_DEFAULTS } from '../generators/smart-defaults.js';

describe('getSmartDefault', () => {
  describe('exact match', () => {
    it('returns correct dot-path for "email"', () => {
      expect(getSmartDefault('email')).toBe('internet.email');
    });

    it('returns correct dot-path for "firstName"', () => {
      expect(getSmartDefault('firstName')).toBe('person.firstName');
    });

    it('returns correct dot-path for "lastName"', () => {
      expect(getSmartDefault('lastName')).toBe('person.lastName');
    });

    it('returns correct dot-path for "username"', () => {
      expect(getSmartDefault('username')).toBe('internet.username');
    });

    it('returns correct dot-path for "phone"', () => {
      expect(getSmartDefault('phone')).toBe('phone.number');
    });

    it('returns correct dot-path for "city"', () => {
      expect(getSmartDefault('city')).toBe('location.city');
    });

    it('returns correct dot-path for "country"', () => {
      expect(getSmartDefault('country')).toBe('location.country');
    });

    it('returns correct dot-path for "id"', () => {
      expect(getSmartDefault('id')).toBe('string.uuid');
    });

    it('returns correct dot-path for "slug"', () => {
      expect(getSmartDefault('slug')).toBe('lorem.slug');
    });

    it('returns correct dot-path for "color"', () => {
      expect(getSmartDefault('color')).toBe('color.rgb');
    });

    it('returns correct dot-path for "price"', () => {
      expect(getSmartDefault('price')).toBe('commerce.price');
    });

    it('returns correct dot-path for "currency"', () => {
      expect(getSmartDefault('currency')).toBe('finance.currencyCode');
    });
  });

  describe('case-insensitive matching', () => {
    it('matches "EMAIL" (uppercase)', () => {
      expect(getSmartDefault('EMAIL')).toBe('internet.email');
    });

    it('matches "Email" (mixed case)', () => {
      expect(getSmartDefault('Email')).toBe('internet.email');
    });

    it('matches "UserName" (PascalCase)', () => {
      expect(getSmartDefault('UserName')).toBe('internet.username');
    });

    it('matches "CITY" (uppercase)', () => {
      expect(getSmartDefault('CITY')).toBe('location.city');
    });
  });

  describe('snake_case matching', () => {
    it('matches "first_name" → person.firstName', () => {
      expect(getSmartDefault('first_name')).toBe('person.firstName');
    });

    it('matches "last_name" → person.lastName', () => {
      expect(getSmartDefault('last_name')).toBe('person.lastName');
    });

    it('matches "phone_number" → phone.number', () => {
      expect(getSmartDefault('phone_number')).toBe('phone.number');
    });

    it('matches "full_name" → person.fullName', () => {
      expect(getSmartDefault('full_name')).toBe('person.fullName');
    });

    it('matches "street_address" → location.streetAddress', () => {
      expect(getSmartDefault('street_address')).toBe('location.streetAddress');
    });

    it('matches "zip_code" → location.zipCode', () => {
      expect(getSmartDefault('zip_code')).toBe('location.zipCode');
    });

    it('matches "postal_code" → location.zipCode', () => {
      expect(getSmartDefault('postal_code')).toBe('location.zipCode');
    });

    it('matches "company_name" → company.name', () => {
      expect(getSmartDefault('company_name')).toBe('company.name');
    });

    it('matches "created_at" → date.past', () => {
      expect(getSmartDefault('created_at')).toBe('date.past');
    });

    it('matches "updated_at" → date.recent', () => {
      expect(getSmartDefault('updated_at')).toBe('date.recent');
    });

    it('matches "avatar_url" → image.avatar', () => {
      expect(getSmartDefault('avatar_url')).toBe('image.avatar');
    });

    it('matches "image_url" → image.url', () => {
      expect(getSmartDefault('image_url')).toBe('image.url');
    });
  });

  describe('type conflict skipping', () => {
    it('skips "email" when schema type is "integer"', () => {
      expect(getSmartDefault('email', 'integer')).toBeUndefined();
    });

    it('skips "email" when schema type is "number"', () => {
      expect(getSmartDefault('email', 'number')).toBeUndefined();
    });

    it('skips "email" when schema type is "boolean"', () => {
      expect(getSmartDefault('email', 'boolean')).toBeUndefined();
    });

    it('returns "email" when schema type is "string"', () => {
      expect(getSmartDefault('email', 'string')).toBe('internet.email');
    });

    it('skips "firstName" when schema type is "integer"', () => {
      expect(getSmartDefault('firstName', 'integer')).toBeUndefined();
    });

    it('returns "lat" / latitude when schema type is "number"', () => {
      expect(getSmartDefault('lat', 'number')).toBe('location.latitude');
    });

    it('skips "lat" when schema type is "string"', () => {
      expect(getSmartDefault('lat', 'string')).toBeUndefined();
    });

    it('skips "lng" when schema type is "boolean"', () => {
      expect(getSmartDefault('lng', 'boolean')).toBeUndefined();
    });

    it('handles array type — picks non-null type for conflict check', () => {
      // email with type ["string", "null"] should still match
      expect(getSmartDefault('email', ['string', 'null'])).toBe('internet.email');
    });

    it('skips when array type has no compatible type', () => {
      // email with type ["integer", "null"] should skip
      expect(getSmartDefault('email', ['integer', 'null'])).toBeUndefined();
    });

    it('returns match when schemaType is undefined (no conflict check)', () => {
      expect(getSmartDefault('email', undefined)).toBe('internet.email');
    });
  });

  describe('unknown name', () => {
    it('returns undefined for an unknown name', () => {
      expect(getSmartDefault('fooBarBaz')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getSmartDefault('')).toBeUndefined();
    });

    it('returns undefined for "xyzzy"', () => {
      expect(getSmartDefault('xyzzy')).toBeUndefined();
    });
  });

  describe('coverage of required mappings', () => {
    const requiredMappings: Array<[string, string]> = [
      ['firstName', 'person.firstName'],
      ['first_name', 'person.firstName'],
      ['lastName', 'person.lastName'],
      ['last_name', 'person.lastName'],
      ['email', 'internet.email'],
      ['phone', 'phone.number'],
      ['phoneNumber', 'phone.number'],
      ['phone_number', 'phone.number'],
      ['avatar', 'image.avatar'],
      ['avatarUrl', 'image.avatar'],
      ['avatar_url', 'image.avatar'],
      ['username', 'internet.username'],
      ['userName', 'internet.username'],
      ['user_name', 'internet.username'],
      ['url', 'internet.url'],
      ['website', 'internet.url'],
      ['address', 'location.streetAddress'],
      ['streetAddress', 'location.streetAddress'],
      ['street_address', 'location.streetAddress'],
      ['city', 'location.city'],
      ['state', 'location.state'],
      ['zip', 'location.zipCode'],
      ['zipCode', 'location.zipCode'],
      ['zip_code', 'location.zipCode'],
      ['postalCode', 'location.zipCode'],
      ['postal_code', 'location.zipCode'],
      ['country', 'location.country'],
      ['latitude', 'location.latitude'],
      ['lat', 'location.latitude'],
      ['longitude', 'location.longitude'],
      ['lng', 'location.longitude'],
      ['lon', 'location.longitude'],
      ['title', 'lorem.sentence'],
      ['description', 'lorem.paragraph'],
      ['summary', 'lorem.paragraph'],
      ['bio', 'lorem.paragraph'],
      ['name', 'person.fullName'],
      ['fullName', 'person.fullName'],
      ['full_name', 'person.fullName'],
      ['company', 'company.name'],
      ['companyName', 'company.name'],
      ['company_name', 'company.name'],
      ['createdAt', 'date.past'],
      ['created_at', 'date.past'],
      ['updatedAt', 'date.recent'],
      ['updated_at', 'date.recent'],
      ['id', 'string.uuid'],
      ['slug', 'lorem.slug'],
      ['color', 'color.rgb'],
      ['price', 'commerce.price'],
      ['amount', 'commerce.price'],
      ['currency', 'finance.currencyCode'],
      ['imageUrl', 'image.url'],
      ['image_url', 'image.url'],
      ['image', 'image.url'],
      ['photo', 'image.url'],
    ];

    it.each(requiredMappings)('"%s" maps to "%s"', (name, expected) => {
      expect(getSmartDefault(name)).toBe(expected);
    });

    it('has at least 30 distinct normalized entries', () => {
      expect(SMART_DEFAULTS.size).toBeGreaterThanOrEqual(30);
    });
  });
});
