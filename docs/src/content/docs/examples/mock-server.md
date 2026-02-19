---
title: Standalone Mock Server
description: Build a real HTTP mock server using openapi-mocks and Hono — no MSW required.
---

This guide walks through the [`examples/mock-server/`](https://github.com/your-org/openapi-mocks/tree/main/examples/mock-server) project, which demonstrates how to use `openapi-mocks` (core, no MSW) to build a lightweight HTTP mock server using [Hono](https://hono.dev/).

The server reads a local OpenAPI spec, calls `createMockClient.data()` to generate realistic fake responses, and registers corresponding HTTP routes — all without writing a single mock value by hand.

## Use case

This pattern is useful when:

- You want a real HTTP server for services that can't use browser-level interception (CLI tools, mobile apps, backend services)
- You want to share a running local mock API with your team during development
- You're prototyping a frontend before the backend is ready and need a realistic API to code against
- You want to run automated tests against a real HTTP server (not in-process mocks)

For browser-based interception without a server, see the [Playwright E2E example](/examples/playwright).

## Project setup

The example is a standalone project (not a monorepo workspace member) you can clone and run independently.

```
examples/mock-server/
├── specs/
│   └── products-api.yaml      # OpenAPI 3.1 spec (products CRUD + categories)
├── src/
│   └── server.ts              # Hono server — registers routes from the spec
├── package.json
├── tsconfig.json
└── README.md
```

### Installation

```bash
cd examples/mock-server

# Install dependencies (links openapi-mocks from the local workspace)
pnpm install

# Start the server
pnpm start
```

The server starts on `http://localhost:3000`.

## Core pattern: calling `.data()` per route

Create the mock client once at module load time — the spec is parsed and resolved only once. Then call `.data()` inside each route handler to generate fresh mock data for that request.

```ts
import { createMockClient } from 'openapi-mocks';
import { Hono } from 'hono';

// Parse the spec once at startup
const mocks = createMockClient('./specs/products-api.yaml', { seed: 42 });

const app = new Hono();

// Register a route — call .data() per request
app.get('/products', async (c) => {
  const data = await mocks.data({
    operations: {
      listProducts: {
        arrayLengths: { products: [3, 5] },
      },
    },
  });

  const result = data.get('listProducts')?.get(200);
  return c.json(result, 200);
});
```

The `operations` key acts as a filter: only the listed operation IDs are generated. Omit it to generate all operations at once.

## Registering routes from the spec

The example registers one Hono route for each operation in the spec. The mapping is manual — route path and HTTP method are taken from the OpenAPI spec, and the operation ID links each route to its generated data:

| Method | Path                 | Operation ID    |
|--------|----------------------|-----------------|
| GET    | /products            | listProducts    |
| POST   | /products            | createProduct   |
| GET    | /products/:productId | getProduct      |
| GET    | /categories          | listCategories  |

You can automate this registration by iterating over the dereferenced spec's `paths` object if your use case requires fully dynamic route registration.

## Path parameter handling

The `transform` callback receives the generated data and returns a new object. Use it to inject real path parameters from the incoming request into the mock response:

```ts
app.get('/products/:productId', async (c) => {
  const productId = c.req.param('productId');

  const data = await mocks.data({
    operations: {
      getProduct: {
        // Inject the real path param into the generated response
        transform: (generated) => ({
          ...generated,
          id: productId,
        }),
      },
    },
  });

  return c.json(data.get('getProduct')?.get(200), 200);
});
```

Now `curl http://localhost:3000/products/abc-123` returns a product with `"id": "abc-123"` — the ID in the response matches the URL.

## Status code selection

By default `.data()` returns the lowest 2xx response defined for each operation. For routes that return a non-200 success code (e.g. `201 Created`), pass `statusCode` to select a specific code:

```ts
app.post('/products', async (c) => {
  const data = await mocks.data({
    operations: {
      createProduct: {
        statusCode: 201,
      },
    },
    statusCodes: [201],
  });

  const result = data.get('createProduct')?.get(201);
  return c.json(result, 201);
});
```

## Array length control

Use `arrayLengths` to pin the number of items in list responses. Keys are dot-notation paths matching the response schema property names:

```ts
const data = await mocks.data({
  operations: {
    listCategories: {
      arrayLengths: { categories: [4, 4] },  // always exactly 4 categories
    },
  },
});
```

A `[min, max]` tuple with equal values produces an exact count. A range like `[3, 5]` produces a random count within that range (seeded).

## curl examples

With the server running on `http://localhost:3000`:

```bash
# List products (3–5 items, seeded data)
curl http://localhost:3000/products | jq .

# Get a specific product — the id in the response matches the URL
curl http://localhost:3000/products/abc-123 | jq .

# Create a product (returns 201 with a generated product)
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"category":"Electronics"}' | jq .

# List categories (exactly 4 items)
curl http://localhost:3000/categories | jq .
```

## Seeded vs. live data

The example uses `{ seed: 42 }` — with a fixed seed the same data is returned on every call, making the server predictable for demos and tests. Remove the seed (or change it) to get different data on each call:

```ts
// Always the same data (good for demos, snapshots)
const mocks = createMockClient(specPath, { seed: 42 });

// Different data on every server restart (good for exploratory testing)
const mocks = createMockClient(specPath);
```

## Caveats

- **No statefulness:** Every request re-generates data independently. `POST /products` doesn't store anything; `GET /products` won't reflect it. This is intentional — the server is a mock, not a database.
- **No request validation:** The server accepts any request body and ignores it. Invalid input returns the same mock as valid input.
- **Not for production:** This pattern is a development and demo tool. It does not implement real business logic or persistence.
- **Circular specs:** If your spec has circular `$ref` chains, the library stops recursion at `maxDepth` (default 3). Increase this with the `maxDepth` global option if needed.

## Full runnable code

See [`examples/mock-server/`](https://github.com/your-org/openapi-mocks/tree/main/examples/mock-server) for the complete, runnable example including the OpenAPI spec, server source, and package configuration.
