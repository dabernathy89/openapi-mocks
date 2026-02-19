---
title: Faker Extensions (x-faker-method)
description: Use the x-faker-method OpenAPI extension to control exactly which Faker.js method generates data for any schema property.
---

The `x-faker-method` extension lets you attach a specific [Faker.js](https://fakerjs.dev/) method to any property in your OpenAPI spec. When `openapi-mocks` encounters this extension, it calls the specified Faker method to generate the value rather than relying on smart defaults or type-based fallback.

## What it is

`x-faker-method` is a vendor extension field (OpenAPI allows any `x-` prefixed field). Its value is a **dot-path string** pointing to a method on the Faker.js API:

```yaml
properties:
  profileImage:
    type: string
    x-faker-method: image.avatar
```

The string `image.avatar` resolves to `faker.image.avatar()` at generation time.

## When to use it

You need `x-faker-method` when:

- The [smart defaults](/guides/smart-defaults) don't cover your property name
- The default type-based output doesn't match your expected shape (e.g., a `string` field that should be a realistic product SKU rather than random lorem text)
- You want to pin a specific Faker module for documentation or snapshot clarity

If a smart default already matches your property name, you don't need `x-faker-method` — the smart default will be applied automatically.

## Syntax

The value is a two-level (or deeper) dot-path: `module.method`. The path is resolved against the `faker` instance at call time.

```yaml
x-faker-method: internet.email
x-faker-method: location.city
x-faker-method: lorem.paragraphs
x-faker-method: finance.creditCardNumber
```

## Priority in the generation chain

`x-faker-method` sits in the third position of the data generation priority chain:

1. Consumer `overrides`
2. Schema `example` / `default` (unless `ignoreExamples: true`)
3. **`x-faker-method`** ← here
4. Smart defaults (property name mapping)
5. Type-based fallback

This means `x-faker-method` overrides both smart defaults and type-based generation, but can still be overridden per-call via the `overrides` option.

## Example table of Faker dot-paths

| Faker dot-path | Example output |
|---|---|
| `internet.email` | `"user@example.com"` |
| `internet.url` | `"https://example.com/path"` |
| `internet.username` | `"john_doe42"` |
| `internet.ipv4` | `"192.168.1.42"` |
| `image.avatar` | `"https://avatars.example.com/u/123"` |
| `image.url` | `"https://loremflickr.com/640/480"` |
| `person.firstName` | `"Jane"` |
| `person.lastName` | `"Doe"` |
| `person.fullName` | `"Jane Doe"` |
| `person.jobTitle` | `"Senior Engineer"` |
| `company.name` | `"Acme Corp"` |
| `location.city` | `"San Francisco"` |
| `location.country` | `"United States"` |
| `location.streetAddress` | `"123 Main St"` |
| `location.zipCode` | `"94102"` |
| `location.latitude` | `37.7749` |
| `location.longitude` | `-122.4194` |
| `lorem.sentence` | `"The quick brown fox jumps."` |
| `lorem.paragraph` | `"Lorem ipsum dolor sit amet..."` |
| `lorem.paragraphs` | Multiple paragraphs of text |
| `lorem.slug` | `"the-quick-brown-fox"` |
| `lorem.word` | `"lorem"` |
| `finance.amount` | `"1234.56"` |
| `finance.currencyCode` | `"USD"` |
| `finance.creditCardNumber` | `"4111 1111 1111 1111"` |
| `finance.iban` | `"GB29 NWBK 6016 1331 9268 19"` |
| `commerce.productName` | `"Ergonomic Rubber Chair"` |
| `commerce.price` | `"29.99"` |
| `color.rgb` | `"#a1b2c3"` |
| `color.hsl` | `"hsl(120, 50%, 50%)"` |
| `date.past` | `"2023-06-01T12:00:00.000Z"` |
| `date.recent` | `"2024-01-20T08:30:00.000Z"` |
| `date.future` | `"2025-09-15T16:45:00.000Z"` |
| `string.uuid` | `"f47ac10b-58cc-4372-a567-0e02b2c3d479"` |
| `phone.number` | `"+1-555-867-5309"` |

For the full list of available methods, see the [Faker.js API documentation](https://fakerjs.dev/api/).

## Walkthrough

Suppose you have an existing spec with a `product` schema and you want the `sku` field to produce realistic product codes instead of random strings:

### Before

```yaml
# openapi.yaml
components:
  schemas:
    Product:
      type: object
      required: [id, sku, name, price]
      properties:
        id:
          type: string
          format: uuid
        sku:
          type: string
        name:
          type: string
        price:
          type: number
```

Running `createMockClient(spec).data()` produces something like:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sku": "lorem ipsum",
  "name": "lorem ipsum",
  "price": 42.5
}
```

The `sku` and `name` fields fall back to random lorem text since there's no smart default for `sku`.

### After

Add `x-faker-method` to the `sku` and `name` fields:

```yaml
# openapi.yaml
components:
  schemas:
    Product:
      type: object
      required: [id, sku, name, price]
      properties:
        id:
          type: string
          format: uuid
        sku:
          type: string
          x-faker-method: commerce.productName
        name:
          type: string
          x-faker-method: commerce.productName
        price:
          type: number
          x-faker-method: commerce.price
```

Now the generated output is:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sku": "Ergonomic Rubber Chair",
  "name": "Sleek Steel Keyboard",
  "price": "29.99"
}
```

The values are now contextually meaningful product data.

## Seeding for deterministic output

Because `x-faker-method` calls the same seeded Faker instance as the rest of generation, passing a `seed` produces consistent output:

```ts
const client = createMockClient(spec, { seed: 42 });
const data = await client.data();
// x-faker-method fields always produce the same values with seed 42
```

## Error handling

If the dot-path does not resolve to a callable Faker method, `openapi-mocks` throws a descriptive error at generation time:

```
OpenApiMocksError: x-faker-method "nonexistent.method" on schema "Product.sku"
does not resolve to a callable Faker function.
Check the Faker.js documentation for valid dot-paths.
```

This fail-hard behaviour prevents silent data quality issues. Double-check the dot-path against the [Faker.js API docs](https://fakerjs.dev/api/) if you see this error.

## Overriding x-faker-method per call

Even with `x-faker-method` set in the spec, you can override the generated value for a specific call using the `overrides` option:

```ts
const data = await client.data({
  operations: {
    listProducts: {
      overrides: {
        'products[0].sku': 'CUSTOM-SKU-001',
      },
    },
  },
});
```

The `overrides` option always wins over `x-faker-method`. See the [Configuration guide](/guides/configuration) for full details on overrides.
