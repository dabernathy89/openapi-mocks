---
title: Schema Composition
description: How openapi-mocks handles allOf, oneOf, and anyOf composition keywords, discriminators, and nullable schemas across OpenAPI 3.0.x and 3.1.x.
---

OpenAPI lets you compose schemas using `allOf`, `oneOf`, and `anyOf`. `openapi-mocks` handles all three keywords and produces realistic mock data that conforms to the composed schema.

## allOf

`allOf` requires the generated value to satisfy **all** listed sub-schemas. `openapi-mocks` deep-merges all sub-schemas into a single unified schema, then generates data from the merged result.

### What gets merged

| Field | Merge behaviour |
|-------|----------------|
| `properties` | All properties from every sub-schema are combined |
| `required` | The union of all `required` arrays |
| `type` | Must be the same across sub-schemas; conflicting types throw an error |

### Example

```yaml
components:
  schemas:
    Timestamps:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    User:
      allOf:
        - $ref: '#/components/schemas/Timestamps'
        - type: object
          required: [id, name]
          properties:
            id:
              type: string
              format: uuid
            name:
              type: string
```

Generated output:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:22:33.000Z"
}
```

All properties from both sub-schemas appear in the output. If both sub-schemas define a `required` array, the resulting `required` is the union of both.

### Conflicting types

If two sub-schemas within `allOf` declare incompatible `type` values, `openapi-mocks` throws an error rather than silently producing invalid data:

```yaml
# This will throw — string and integer are incompatible
allOf:
  - type: string
  - type: integer
```

---

## oneOf

`oneOf` means the generated value must satisfy **exactly one** sub-schema. `openapi-mocks` selects one sub-schema and generates data for it.

### Without a discriminator

When no `discriminator` is present, a sub-schema is selected randomly (seeded). Every run with the same seed produces the same choice.

```yaml
components:
  schemas:
    Payment:
      oneOf:
        - $ref: '#/components/schemas/CreditCardPayment'
        - $ref: '#/components/schemas/BankTransferPayment'

    CreditCardPayment:
      type: object
      required: [type, cardNumber, cvv]
      properties:
        type:
          type: string
          enum: [credit_card]
        cardNumber:
          type: string
        cvv:
          type: string

    BankTransferPayment:
      type: object
      required: [type, accountNumber, routingNumber]
      properties:
        type:
          type: string
          enum: [bank_transfer]
        accountNumber:
          type: string
        routingNumber:
          type: string
```

One of the two variants is generated per call. Use a `seed` to make the choice deterministic:

```ts
const client = createMockClient(spec, { seed: 42 });
const data = await client.data();
// Always generates the same Payment variant with seed 42
```

### With a discriminator

When `oneOf` has a `discriminator` with a `mapping`, `openapi-mocks` uses the mapping to deterministically select the correct sub-schema and sets the discriminator property to the matching value in the output.

```yaml
components:
  schemas:
    Shape:
      oneOf:
        - $ref: '#/components/schemas/Circle'
        - $ref: '#/components/schemas/Rectangle'
      discriminator:
        propertyName: shapeType
        mapping:
          circle: '#/components/schemas/Circle'
          rectangle: '#/components/schemas/Rectangle'

    Circle:
      type: object
      required: [shapeType, radius]
      properties:
        shapeType:
          type: string
        radius:
          type: number

    Rectangle:
      type: object
      required: [shapeType, width, height]
      properties:
        shapeType:
          type: string
        width:
          type: number
        height:
          type: number
```

Generated output (circle variant):

```json
{
  "shapeType": "circle",
  "radius": 14.7
}
```

The `shapeType` discriminator property is automatically set to `"circle"` to match the selected sub-schema.

#### Discriminator without a mapping

If `discriminator` has a `propertyName` but no `mapping`, the sub-schema is selected randomly (seeded). The discriminator property is set to the sub-schema's `enum` or `const` value if one is present; otherwise it is left to the type-based fallback.

---

## anyOf

`anyOf` means the generated value must satisfy **at least one** sub-schema. `openapi-mocks` randomly selects one or more sub-schemas (seeded), merges them using the same deep-merge logic as `allOf`, and generates data from the merged result.

At least one sub-schema is always selected.

### Example

```yaml
components:
  schemas:
    SearchResult:
      anyOf:
        - $ref: '#/components/schemas/UserResult'
        - $ref: '#/components/schemas/PostResult'

    UserResult:
      type: object
      properties:
        userId:
          type: string
          format: uuid
        displayName:
          type: string

    PostResult:
      type: object
      properties:
        postId:
          type: string
          format: uuid
        title:
          type: string
```

Possible generated outputs:

```json
// Only UserResult selected:
{ "userId": "f47ac10b-...", "displayName": "Jane Smith" }

// Only PostResult selected:
{ "postId": "a9b8c7d6-...", "title": "Getting started" }

// Both selected (merged):
{
  "userId": "f47ac10b-...",
  "displayName": "Jane Smith",
  "postId": "a9b8c7d6-...",
  "title": "Getting started"
}
```

---

## Nullable schemas

Nullable handling differs between OpenAPI 3.0.x and 3.1.x. `openapi-mocks` treats them equivalently.

### OpenAPI 3.0.x — `nullable: true`

```yaml
# OpenAPI 3.0.x
properties:
  middleName:
    type: string
    nullable: true
```

### OpenAPI 3.1.x — array `type`

```yaml
# OpenAPI 3.1.x
properties:
  middleName:
    type: ["string", "null"]
```

Both forms produce the same behaviour: the field is generated as a `string` value or `null` with roughly 50/50 probability (seeded). Use a fixed seed to get a deterministic result:

```ts
const client = createMockClient(spec, { seed: 123 });
// middleName will always be the same string or always null with seed 123
```

### Interaction with `required`

A nullable field in `required` is always present in the output (never omitted) — it may be `null`, but it will not be missing from the object. A nullable field that is **not** in `required` follows the standard optional-field logic: it may be omitted entirely (~50%), present as `null` (~25%), or present as a value (~25%).

---

## Composition and the priority chain

Schema composition keywords interact naturally with the [data generation priority chain](/guides/configuration):

- **`example` / `default`** on a composed schema takes precedence over generation (unless `ignoreExamples: true`)
- **`x-faker-method`** on a composed schema overrides sub-schema generation
- **Overrides** applied via the `overrides` option are deep-set after generation, so they work on composed schemas just like flat ones

```ts
const data = await createMockClient(spec).data({
  operations: {
    getShape: {
      // Force a specific discriminator value even with oneOf
      overrides: { shapeType: 'rectangle', width: 100, height: 50 },
    },
  },
});
```
