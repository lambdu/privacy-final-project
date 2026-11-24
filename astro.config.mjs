// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// GitHub Pages serves project sites from /<repo-name>/.
// If you fork/rename the repo, update `base` (and `site` with your username).
export default defineConfig({
  site: 'https://lambdu.github.io',
  base: '/privacy-final-project',
  trailingSlash: 'ignore',
  integrations: [preact()],
});
