# openapi-mocks: Mock Server Example

This example shows how to use `openapi-mocks` (core, no MSW) to build a simple HTTP mock server using [Hono](https://hono.dev/).

The server reads a local OpenAPI spec, calls `createMockClient.data()` to generate realistic fake responses, and registers corresponding HTTP routes — all without writing a single mock value by hand.

## Use case

Use this pattern when:
- You want a real HTTP server (not browser-level interception via MSW)
- Your consumers are CLI tools, mobile apps, or services that call an API directly
- You want to share a local mock server with your team during development

## Setup

```bash
# From the examples/mock-server directory:
pnpm install
pnpm start
```

> **Note:** If you're inside the openapi-mocks monorepo, pnpm may try to resolve the workspace. Run `pnpm install --ignore-workspace` if needed.

The server starts on `http://localhost:3000`.

## Available routes

| Method | Path                    | Description                         |
|--------|-------------------------|-------------------------------------|
| GET    | /products               | List products (3–5 items)           |
| POST   | /products               | Create product (returns 201)        |
| GET    | /products/:productId    | Get product (echoes productId)      |
| GET    | /categories             | List categories (exactly 4 items)   |

## curl examples

```bash
# List products
curl http://localhost:3000/products | jq .

# Get a specific product (the id in the response matches the URL)
curl http://localhost:3000/products/abc-123 | jq .

# Create a product (mocked — returns a generated product regardless of input)
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"category":"Electronics"}' | jq .

# List categories
curl http://localhost:3000/categories | jq .
```

## How it works

The key file is [`src/server.ts`](src/server.ts). Here's the core pattern:

```ts
import { createMockClient } from 'openapi-mocks';

// Parse the spec once
const mocks = createMockClient('./specs/products-api.yaml', { seed: 42 });

// Register a route
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

### Path parameter handling

The `transform` callback lets you inject real path params into the generated response:

```ts
app.get('/products/:productId', async (c) => {
  const productId = c.req.param('productId');

  const data = await mocks.data({
    operations: {
      getProduct: {
        transform: (generated) => ({ ...generated, id: productId }),
      },
    },
  });

  return c.json(data.get('getProduct')?.get(200), 200);
});
```

## Caveats

- **No statefulness:** Every request re-generates data. POST /products doesn't save anything; GET /products won't reflect it.
- **No request validation:** The server accepts any request body and ignores it. Invalid input returns the same mock as valid input.
- **Seeded data:** With `{ seed: 42 }`, the same data is returned on every call. Remove the seed for different data each time.
- **Not for production:** This is a development / demo tool. It does not implement real business logic.
