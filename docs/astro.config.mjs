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
          items: [],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Playwright E2E', slug: 'examples/playwright' },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
