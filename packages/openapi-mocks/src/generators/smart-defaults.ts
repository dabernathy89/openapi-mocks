/**
 * Smart default property name → Faker dot-path mapping.
 *
 * The map covers common property names encountered in real-world OpenAPI specs.
 * Keys are normalized to lowercase for case-insensitive matching.
 * Values are Faker dot-paths (e.g. "internet.email").
 */

/** Types that Faker methods return, used for conflict detection. */
type FakerOutputType = 'string' | 'number' | 'boolean' | 'object';

interface SmartDefaultEntry {
  path: string;
  outputType: FakerOutputType;
}

/**
 * Normalize a property name for lookup:
 * - lowercase
 * - remove underscores (converts snake_case → flat)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/_/g, '');
}

// Build the lookup map: normalized name → { path, outputType }
// Multiple canonical names map to the same entry.
const SMART_DEFAULTS_MAP = new Map<string, SmartDefaultEntry>([
  // Personal
  ['firstname', { path: 'person.firstName', outputType: 'string' }],
  ['lastname', { path: 'person.lastName', outputType: 'string' }],
  ['fullname', { path: 'person.fullName', outputType: 'string' }],
  ['name', { path: 'person.fullName', outputType: 'string' }],
  ['username', { path: 'internet.username', outputType: 'string' }],
  ['username', { path: 'internet.username', outputType: 'string' }],
  ['nickname', { path: 'internet.username', outputType: 'string' }],
  ['avatar', { path: 'image.avatar', outputType: 'string' }],
  ['avatarurl', { path: 'image.avatar', outputType: 'string' }],
  ['bio', { path: 'lorem.paragraph', outputType: 'string' }],

  // Contact
  ['email', { path: 'internet.email', outputType: 'string' }],
  ['emailaddress', { path: 'internet.email', outputType: 'string' }],
  ['phone', { path: 'phone.number', outputType: 'string' }],
  ['phonenumber', { path: 'phone.number', outputType: 'string' }],

  // Web
  ['url', { path: 'internet.url', outputType: 'string' }],
  ['website', { path: 'internet.url', outputType: 'string' }],
  ['imageurl', { path: 'image.url', outputType: 'string' }],
  ['image', { path: 'image.url', outputType: 'string' }],
  ['photo', { path: 'image.url', outputType: 'string' }],

  // Location
  ['address', { path: 'location.streetAddress', outputType: 'string' }],
  ['streetaddress', { path: 'location.streetAddress', outputType: 'string' }],
  ['city', { path: 'location.city', outputType: 'string' }],
  ['state', { path: 'location.state', outputType: 'string' }],
  ['zip', { path: 'location.zipCode', outputType: 'string' }],
  ['zipcode', { path: 'location.zipCode', outputType: 'string' }],
  ['postalcode', { path: 'location.zipCode', outputType: 'string' }],
  ['country', { path: 'location.country', outputType: 'string' }],
  ['latitude', { path: 'location.latitude', outputType: 'number' }],
  ['lat', { path: 'location.latitude', outputType: 'number' }],
  ['longitude', { path: 'location.longitude', outputType: 'number' }],
  ['lng', { path: 'location.longitude', outputType: 'number' }],
  ['lon', { path: 'location.longitude', outputType: 'number' }],

  // Content
  ['title', { path: 'lorem.sentence', outputType: 'string' }],
  ['description', { path: 'lorem.paragraph', outputType: 'string' }],
  ['summary', { path: 'lorem.paragraph', outputType: 'string' }],
  ['slug', { path: 'lorem.slug', outputType: 'string' }],

  // Business
  ['company', { path: 'company.name', outputType: 'string' }],
  ['companyname', { path: 'company.name', outputType: 'string' }],
  ['price', { path: 'commerce.price', outputType: 'string' }],
  ['amount', { path: 'commerce.price', outputType: 'string' }],
  ['currency', { path: 'finance.currencyCode', outputType: 'string' }],

  // Identifiers
  ['id', { path: 'string.uuid', outputType: 'string' }],

  // Appearance
  ['color', { path: 'color.rgb', outputType: 'string' }],
  ['colour', { path: 'color.rgb', outputType: 'string' }],

  // Dates
  ['createdat', { path: 'date.past', outputType: 'object' }],
  ['updatedat', { path: 'date.recent', outputType: 'object' }],
]);

/**
 * OpenAPI schema types that are compatible with each Faker output type.
 * If the schema type doesn't appear in the compatible list, we skip the smart default.
 */
const COMPATIBLE_SCHEMA_TYPES: Record<FakerOutputType, string[]> = {
  string: ['string'],
  number: ['number', 'integer'],
  boolean: ['boolean'],
  object: ['object', 'string'], // dates can be serialized as strings
};

/**
 * Look up a smart default Faker dot-path for a given property name.
 *
 * Matching is case-insensitive and treats camelCase and snake_case as equivalent
 * (underscores are stripped before comparison).
 *
 * @param propertyName - The schema property name to look up
 * @param schemaType - The OpenAPI schema type (e.g. "string", "integer"). Pass `undefined`
 *   if the type is not known — the match is returned without conflict checking.
 * @returns The Faker dot-path string, or `undefined` if no match or type conflict.
 */
export function getSmartDefault(
  propertyName: string,
  schemaType?: string | string[],
): string | undefined {
  const normalized = normalizeName(propertyName);
  const entry = SMART_DEFAULTS_MAP.get(normalized);

  if (!entry) {
    return undefined;
  }

  // Type conflict check
  if (schemaType !== undefined) {
    // Resolve to a single type string for comparison
    const resolvedType = Array.isArray(schemaType)
      ? schemaType.find((t) => t !== 'null')
      : schemaType;

    if (resolvedType !== undefined) {
      const compatibleTypes = COMPATIBLE_SCHEMA_TYPES[entry.outputType];
      if (!compatibleTypes.includes(resolvedType)) {
        return undefined;
      }
    }
  }

  return entry.path;
}

/**
 * The full smart defaults mapping, exported for documentation/testing purposes.
 * Keys are normalized (lowercase, no underscores).
 */
export const SMART_DEFAULTS = SMART_DEFAULTS_MAP;
