/**
 * Set a value at a dot-notation path within an object.
 * Supports numeric segments as array indices (e.g. "users.0.email").
 * Creates intermediate objects/arrays as needed.
 *
 * @param obj - The target object to mutate
 * @param path - Dot-notation path string (e.g. "user.name", "users.0.email")
 * @param value - The value to set (including null)
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const nextPart = parts[i + 1]!;
    const nextIsIndex = /^\d+$/.test(nextPart);

    if (typeof current !== 'object' || current === null) {
      // Cannot traverse deeper — stop
      return;
    }

    const target = current as Record<string, unknown>;
    if (!(part in target)) {
      // Create intermediate: array if next segment is numeric, object otherwise
      target[part] = nextIsIndex ? [] : {};
    } else if (typeof target[part] !== 'object' || target[part] === null) {
      // Existing value is a primitive — cannot traverse into it; stop
      return;
    }
    current = target[part];
  }

  const lastPart = parts[parts.length - 1]!;
  if (typeof current === 'object' && current !== null) {
    (current as Record<string, unknown>)[lastPart] = value;
  }
}

/**
 * Apply an overrides map (dot-notation keys → values) to a generated object.
 * Mutates the object in-place.
 *
 * @param obj - The generated data object to apply overrides to
 * @param overrides - A record of dot-notation paths to override values
 */
export function applyOverrides(
  obj: Record<string, unknown>,
  overrides: Record<string, unknown>,
): void {
  for (const [path, value] of Object.entries(overrides)) {
    setByPath(obj, path, value);
  }
}
