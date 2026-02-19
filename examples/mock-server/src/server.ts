/**
 * openapi-mocks mock server example
 *
 * This script reads the Products API spec, uses createMockClient to generate
 * mock data for each operation, and registers corresponding HTTP routes with Hono.
 *
 * Run: pnpm start
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createMockClient } from 'openapi-mocks';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SPEC_PATH = join(__dirname, '..', 'specs', 'products-api.yaml');
const PORT = 3000;

// Create the mock client — parses the spec once
const mocks = createMockClient(SPEC_PATH, { seed: 42 });

const app = new Hono();

// --- Route: GET /products ---
// Demonstrates: basic route registration, array length control
app.get('/products', async (c) => {
  const data = await mocks.data({
    operations: {
      listProducts: {
        arrayLengths: { 'products': [3, 5] },
      },
    },
  });

  const result = data.get('listProducts')?.get(200);
  if (!result) {
    return c.json({ message: 'No mock data available' }, 500);
  }

  return c.json(result, 200);
});

// --- Route: POST /products ---
// Demonstrates: returning a 201 Created response
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
  if (!result) {
    return c.json({ message: 'No mock data available' }, 500);
  }

  return c.json(result, 201);
});

// --- Route: GET /products/:productId ---
// Demonstrates: path parameter handling — echoes the productId into the response
app.get('/products/:productId', async (c) => {
  const productId = c.req.param('productId');

  const data = await mocks.data({
    operations: {
      getProduct: {
        // Transform injects the real path param into the generated response
        transform: (generatedData) => ({
          ...generatedData,
          id: productId,
        }),
      },
    },
  });

  const result = data.get('getProduct')?.get(200);
  if (!result) {
    return c.json({ message: 'Product not found' }, 404);
  }

  return c.json(result, 200);
});

// --- Route: GET /categories ---
// Demonstrates: simple list endpoint
app.get('/categories', async (c) => {
  const data = await mocks.data({
    operations: {
      listCategories: {
        arrayLengths: { 'categories': [4, 4] },
      },
    },
  });

  const result = data.get('listCategories')?.get(200);
  if (!result) {
    return c.json({ message: 'No mock data available' }, 500);
  }

  return c.json(result, 200);
});

// Start the server
console.log(`Mock server starting on http://localhost:${PORT}`);
console.log('');
console.log('Available routes:');
console.log('  GET  /products             → list products (3–5 items)');
console.log('  POST /products             → create product (returns 201)');
console.log('  GET  /products/:productId  → get product (echoes productId)');
console.log('  GET  /categories           → list categories (4 items)');
console.log('');

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
