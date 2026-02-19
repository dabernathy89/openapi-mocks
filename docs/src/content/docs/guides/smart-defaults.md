---
title: Smart Defaults
description: Learn how openapi-mocks automatically generates realistic data for common property names without any configuration.
---

Smart defaults are the built-in property name → Faker method mappings that `openapi-mocks` applies automatically. When a property name matches a known pattern, the library generates realistic data for it without requiring an `x-faker-method` annotation on every field.

## How Smart Defaults Work

When generating data for an object schema, `openapi-mocks` checks each property name against its internal mapping table. If a match is found **and** the schema type is compatible, the corresponding Faker method is used.

The lookup is:
- **Case-insensitive** — `Email`, `email`, and `EMAIL` all match.
- **`snake_case`-aware** — underscores are stripped before comparison, so `first_name` and `firstName` resolve to the same entry.

Smart defaults sit in the middle of the [priority chain](/guides/configuration#data-generation-priority-chain):

```
consumer overrides
  ↓ spec example / default
  ↓ x-faker-method extension
  ↓ smart defaults  ← here
  ↓ type-based fallback
```

## Full Mapping Table

| Property name(s) | Faker method | Output type |
|---|---|---|
| `firstName`, `first_name` | `person.firstName` | string |
| `lastName`, `last_name` | `person.lastName` | string |
| `fullName`, `full_name`, `name` | `person.fullName` | string |
| `username`, `userName`, `user_name` | `internet.username` | string |
| `nickname` | `internet.username` | string |
| `avatar`, `avatarUrl`, `avatar_url` | `image.avatar` | string |
| `bio` | `lorem.paragraph` | string |
| `email`, `emailAddress`, `email_address` | `internet.email` | string |
| `phone`, `phoneNumber`, `phone_number` | `phone.number` | string |
| `url`, `website` | `internet.url` | string |
| `imageUrl`, `image_url`, `image`, `photo` | `image.url` | string |
| `address`, `streetAddress`, `street_address` | `location.streetAddress` | string |
| `city` | `location.city` | string |
| `state` | `location.state` | string |
| `zip`, `zipCode`, `zip_code`, `postalCode`, `postal_code` | `location.zipCode` | string |
| `country` | `location.country` | string |
| `latitude`, `lat` | `location.latitude` | number |
| `longitude`, `lng`, `lon` | `location.longitude` | number |
| `title` | `lorem.sentence` | string |
| `description`, `summary` | `lorem.paragraph` | string |
| `slug` | `lorem.slug` | string |
| `company`, `companyName`, `company_name` | `company.name` | string |
| `price`, `amount` | `commerce.price` | string |
| `currency` | `finance.currencyCode` | string |
| `id` | `string.uuid` | string |
| `color`, `colour` | `color.rgb` | string |
| `createdAt`, `created_at` | `date.past` | object/string |
| `updatedAt`, `updated_at` | `date.recent` | object/string |

## Type Conflict Skip Behavior

A smart default is **skipped** if the Faker method's output type is incompatible with the schema's declared `type`. For example:

```yaml
properties:
  email:
    type: integer   # ← conflict: internet.email returns a string
```

In this case, `internet.email` is not applied. The generator falls back to the type-based fallback instead (producing a random integer). This prevents generating invalid data that would fail schema validation.

The compatibility rules are:

| Faker output type | Compatible schema types |
|---|---|
| `string` | `string` |
| `number` | `number`, `integer` |
| `boolean` | `boolean` |
| `object` | `object`, `string` (dates can be ISO strings) |

When no `type` is specified in the schema, the smart default is applied without a conflict check.

## When to Use `x-faker-method` Instead

Smart defaults cover the most common property names. Use [`x-faker-method`](/guides/faker-extensions) when:

- **The property name isn't in the table** — e.g., `userHandle`, `contactInfo`, `postalAddress`.
- **You want a more specific Faker method** — e.g., `title` maps to `lorem.sentence` by default, but you might want `book.title` for a book schema.
- **The smart default doesn't fit the context** — e.g., `name` maps to `person.fullName`, but in a product schema you might want `commerce.productName`.

```yaml
# Override the generic 'name' smart default for a product schema
properties:
  name:
    type: string
    x-faker-method: commerce.productName
  price:
    type: string
    x-faker-method: commerce.price    # same as smart default, explicit is fine too
```

## Example

Given this schema:

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        firstName:
          type: string
        lastName:
          type: string
        email:
          type: string
        phone:
          type: string
        avatarUrl:
          type: string
        createdAt:
          type: string
          format: date-time
```

`openapi-mocks` automatically generates realistic data for all of these properties using the smart defaults table — no `x-faker-method` annotations required:

```json
{
  "id": "a4e8b3c1-7f02-4d9e-b6a0-12c3d4e5f678",
  "firstName": "Amelia",
  "lastName": "Rodriguez",
  "email": "amelia.rodriguez@example.com",
  "phone": "+1-555-234-5678",
  "avatarUrl": "https://avatars.example.com/img/a4e8b3c1.jpg",
  "createdAt": "2024-08-15T10:23:00.000Z"
}
```
