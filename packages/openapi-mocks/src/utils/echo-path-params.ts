/**
 * Utilities for echoing path parameters into response data.
 *
 * When `echoPathParams: true` is set, path parameter values are injected into
 * matching fields in the generated response object. This is primarily used by
 * the `.handlers()` MSW layer (US-021); `.data()` ignores this option.
 */

/**
 * Convert a camelCase or PascalCase string to snake_case.
 * e.g. "userId" → "user_id", "UserID" → "user_i_d" (approx)
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_/, '');
}

/**
 * Convert a snake_case string to camelCase.
 * e.g. "user_id" → "userId"
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Generate the set of candidate property names for a path parameter name.
 * Includes both camelCase and snake_case variants.
 *
 * For example, "userId" → ["userId", "user_id"]
 * And "user_id" → ["user_id", "userId"]
 */
function getCandidateNames(paramName: string): string[] {
  const candidates = new Set<string>();
  candidates.add(paramName);

  // If it looks like camelCase, add snake_case variant
  if (/[A-Z]/.test(paramName)) {
    candidates.add(toSnakeCase(paramName));
  }

  // If it looks like snake_case, add camelCase variant
  if (paramName.includes('_')) {
    candidates.add(toCamelCase(paramName));
  }

  return Array.from(candidates);
}

/**
 * Apply path parameter values to a generated response object.
 *
 * For each path parameter in `pathParams`, if the response object contains a
 * property with a matching name (or its camelCase/snake_case variant), the
 * generated value is replaced with the path parameter value.
 *
 * @param data - The generated response object (mutated in place)
 * @param pathParams - Record of path parameter names to their values
 * @returns The same data object, with path param values injected
 */
export function applyEchoPathParams(
  data: Record<string, unknown>,
  pathParams: Record<string, string>,
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;

  for (const [paramName, paramValue] of Object.entries(pathParams)) {
    const candidates = getCandidateNames(paramName);

    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(data, candidate)) {
        data[candidate] = paramValue;
        break; // Only apply to the first matching property
      }
    }
  }

  return data;
}

/**
 * Extract path parameter names from an OpenAPI path string.
 * e.g. "/users/{userId}/posts/{postId}" → ["userId", "postId"]
 */
export function extractPathParamNames(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}
