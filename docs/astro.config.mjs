import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  integrations: [
    starlight({
      title: 'openapi-mocks',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
      },
      components: {
        Footer: './src/components/Footer.astro',
      },
      plugins: [
        starlightTypeDoc({
          entryPoints: ['../packages/openapi-mocks/src/index.ts'],
          tsconfig: '../packages/openapi-mocks/tsconfig.json',
          output: 'reference',
          typeDoc: {
            excludePrivate: true,
            excludeInternal: true,
          },
        }),
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Configuration', slug: 'guides/configuration' },
            { label: 'Schema Composition', slug: 'guides/composition' },
            { label: 'Faker Extensions', slug: 'guides/faker-extensions' },
            { label: 'Smart Defaults', slug: 'guides/smart-defaults' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Playwright E2E', slug: 'examples/playwright' },
            { label: 'Mock Server', slug: 'examples/mock-server' },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
