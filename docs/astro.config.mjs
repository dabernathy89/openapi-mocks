import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
      sidebar: [
        {
          label: 'Guides',
          items: [],
        },
        {
          label: 'Examples',
          items: [],
        },
        {
          label: 'API Reference',
          items: [],
        },
      ],
    }),
  ],
});
