// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: isDev ? undefined: netlify()
});