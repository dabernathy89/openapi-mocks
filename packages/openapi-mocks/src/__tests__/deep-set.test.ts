import { describe, it, expect } from 'vitest';
import { setByPath, applyOverrides } from '../utils/deep-set.js';

describe('setByPath', () => {
  it('sets a top-level field', () => {
    const obj: Record<string, unknown> = { name: 'Alice' };
    setByPath(obj, 'name', 'Bob');
    expect(obj['name']).toBe('Bob');
  });

  it('sets a nested field via dot-notation', () => {
    const obj: Record<string, unknown> = { address: { city: 'Portland', zip: '97201' } };
    setByPath(obj, 'address.city', 'Seattle');
    expect((obj['address'] as Record<string, unknown>)['city']).toBe('Seattle');
  });

  it('creates intermediate objects if missing', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'user.profile.bio', 'Hello');
    expect((obj['user'] as Record<string, unknown>)['profile'] as Record<string, unknown>);
    const profile = ((obj['user'] as Record<string, unknown>)['profile']) as Record<string, unknown>;
    expect(profile['bio']).toBe('Hello');
  });

  it('sets a value by array index', () => {
    const obj: Record<string, unknown> = { tags: ['a', 'b', 'c'] };
    setByPath(obj, 'tags.1', 'overridden');
    expect((obj['tags'] as string[])[1]).toBe('overridden');
  });

  it('sets null as a value', () => {
    const obj: Record<string, unknown> = { name: 'Alice' };
    setByPath(obj, 'name', null);
    expect(obj['name']).toBeNull();
  });

  it('does nothing if path traversal hits a non-object', () => {
    const obj: Record<string, unknown> = { name: 'Alice' };
    // 'name' is a string, can't traverse into it
    setByPath(obj, 'name.first', 'Bob');
    // Should not throw; name remains unchanged
    expect(obj['name']).toBe('Alice');
  });
});

describe('applyOverrides', () => {
  it('applies multiple overrides to an object', () => {
    const obj: Record<string, unknown> = {
      name: 'Alice',
      email: 'alice@example.com',
      address: { city: 'Portland', zip: '97201' },
    };

    applyOverrides(obj, {
      name: 'Bob',
      'address.city': 'Seattle',
    });

    expect(obj['name']).toBe('Bob');
    expect(obj['email']).toBe('alice@example.com'); // unchanged
    expect((obj['address'] as Record<string, unknown>)['city']).toBe('Seattle');
  });

  it('applies null override', () => {
    const obj: Record<string, unknown> = { name: 'Alice' };
    applyOverrides(obj, { name: null });
    expect(obj['name']).toBeNull();
  });

  it('handles empty overrides', () => {
    const obj: Record<string, unknown> = { name: 'Alice' };
    applyOverrides(obj, {});
    expect(obj['name']).toBe('Alice');
  });
});
