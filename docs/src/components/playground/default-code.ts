export const DEFAULT_CODE = `// createMockClient and spec are pre-injected
const client = createMockClient(spec, {
  baseUrl: 'http://playground.local',
  seed: 42,
});

return client.handlers();
`;
