import { describe, it, expect } from 'vitest';
import { applyEchoPathParams, extractPathParamNames } from '../utils/echo-path-params.js';

describe('extractPathParamNames', () => {
  it('returns empty array for paths with no params', () => {
    expect(extractPathParamNames('/users')).toEqual([]);
    expect(extractPathParamNames('/')).toEqual([]);
  });

  it('extracts a single path parameter', () => {
    expect(extractPathParamNames('/users/{userId}')).toEqual(['userId']);
  });

  it('extracts multiple path parameters', () => {
    expect(extractPathParamNames('/users/{userId}/posts/{postId}')).toEqual(['userId', 'postId']);
  });

  it('extracts snake_case path parameter names', () => {
    expect(extractPathParamNames('/users/{user_id}')).toEqual(['user_id']);
  });
});

describe('applyEchoPathParams', () => {
  it('replaces a matching property with the param value (exact match)', () => {
    const data = { userId: 'generated-uuid', name: 'John' };
    const result = applyEchoPathParams(data, { userId: 'request-user-id' });
    expect(result.userId).toBe('request-user-id');
    expect(result.name).toBe('John'); // unchanged
  });

  it('returns data unchanged when no param matches', () => {
    const data = { name: 'John', email: 'john@example.com' };
    const result = applyEchoPathParams(data, { userId: 'request-user-id' });
    expect(result).toEqual({ name: 'John', email: 'john@example.com' });
  });

  it('matches camelCase param to snake_case property', () => {
    const data = { user_id: 'generated-uuid', name: 'John' };
    const result = applyEchoPathParams(data, { userId: 'request-user-id' });
    expect(result.user_id).toBe('request-user-id');
  });

  it('matches snake_case param to camelCase property', () => {
    const data = { userId: 'generated-uuid', name: 'John' };
    const result = applyEchoPathParams(data, { user_id: 'request-user-id' });
    expect(result.userId).toBe('request-user-id');
  });

  it('handles multiple path params', () => {
    const data = { userId: 'uid', postId: 'pid', title: 'Hello' };
    const result = applyEchoPathParams(data, { userId: 'real-uid', postId: 'real-pid' });
    expect(result.userId).toBe('real-uid');
    expect(result.postId).toBe('real-pid');
    expect(result.title).toBe('Hello');
  });

  it('mutates and returns the same data object', () => {
    const data = { userId: 'old' };
    const result = applyEchoPathParams(data, { userId: 'new' });
    expect(result).toBe(data); // same reference
    expect(data.userId).toBe('new');
  });

  it('handles empty pathParams gracefully', () => {
    const data = { userId: 'generated' };
    const result = applyEchoPathParams(data, {});
    expect(result.userId).toBe('generated'); // unchanged
  });

  it('prefers exact match over variant when both exist', () => {
    // If data has both userId and user_id, and param is "userId", userId is matched first
    const data: Record<string, unknown> = { userId: 'uid', user_id: 'uid2' };
    applyEchoPathParams(data, { userId: 'new-value' });
    // Only the first matching candidate should be replaced
    expect(data.userId).toBe('new-value');
    // user_id is NOT touched because userId was already found
    expect(data.user_id).toBe('uid2');
  });
});
