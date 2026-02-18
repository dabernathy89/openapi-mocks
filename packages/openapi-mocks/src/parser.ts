import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { OpenApiMocksError } from './errors.js';

export type SpecInput =
  | string
  | OpenAPIV3.Document
  | OpenAPIV3_1.Document
  | Record<string, unknown>;

export async function resolveSpec(
  input: SpecInput,
): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
  let apiInput: string | OpenAPIV3.Document | OpenAPIV3_1.Document;

  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      // URL — pass directly as string
      apiInput = input;
    } else if (input.trimStart().startsWith('{')) {
      // JSON string — parse it
      const parsed = JSON.parse(input) as Record<string, unknown>;
      apiInput = parsed as OpenAPIV3.Document | OpenAPIV3_1.Document;
    } else {
      // File path — pass as string
      apiInput = input;
    }
  } else {
    // Object — pass directly
    apiInput = input as OpenAPIV3.Document | OpenAPIV3_1.Document;
  }

  const doc = await SwaggerParser.dereference(apiInput);

  // Ensure it's OpenAPI 3.x (not Swagger 2.x)
  const version = (doc as Record<string, unknown>)['openapi'] as string | undefined;
  if (!version || !version.startsWith('3.')) {
    throw new OpenApiMocksError(
      `openapi-mocks: expected an OpenAPI 3.x document but got ${
        version ? `openapi: "${version}"` : 'no "openapi" field'
      }`,
    );
  }

  return doc as OpenAPIV3.Document | OpenAPIV3_1.Document;
}
