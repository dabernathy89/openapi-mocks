import type { Faker } from '@faker-js/faker';

/**
 * Resolves a Faker dot-path string (e.g. "internet.email") and calls the
 * corresponding Faker method, returning its result.
 *
 * @param faker - A Faker.js instance (may be pre-seeded)
 * @param dotPath - A dot-separated path to a Faker method (e.g. "internet.email")
 * @returns The value returned by the Faker method
 * @throws If the dot-path does not resolve to a callable function
 */
export function callFakerMethod(faker: Faker, dotPath: string): unknown {
  const parts = dotPath.split('.');

  if (parts.length < 2) {
    throw new Error(
      `openapi-mocks: x-faker-method "${dotPath}" is not a valid Faker dot-path. Expected at least two segments (e.g. "internet.email").`,
    );
  }

  // Walk the Faker object to find the target
  let target: unknown = faker;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i]!;
    if (typeof target !== 'object' || target === null || !(segment in target)) {
      throw new Error(
        `openapi-mocks: x-faker-method "${dotPath}" is not a valid Faker dot-path. Module "${segment}" not found.`,
      );
    }
    target = (target as Record<string, unknown>)[segment];
  }

  const methodName = parts[parts.length - 1]!;
  if (typeof target !== 'object' || target === null || !(methodName in target)) {
    throw new Error(
      `openapi-mocks: x-faker-method "${dotPath}" is not a valid Faker dot-path. Method "${methodName}" not found.`,
    );
  }

  const method = (target as Record<string, unknown>)[methodName];
  if (typeof method !== 'function') {
    throw new Error(
      `openapi-mocks: x-faker-method "${dotPath}" does not resolve to a callable function. "${methodName}" is of type ${typeof method}.`,
    );
  }

  // Call the method with no arguments (Faker methods are typically zero-arg or accept optional params)
  return (method as () => unknown).call(target);
}
