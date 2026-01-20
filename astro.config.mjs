import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify/functions';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'server',
  site: 'https://johncrow.org',
  integrations: [
    react(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      // Exclude API routes and dynamic pages that shouldn't be indexed
      filter: (page) => {
        return !page.includes('/api/') && 
               !page.includes('/visualize/map') && // Map is dynamic
               !page.includes('.html'); // Exclude old HTML files
      },
      // Create a single sitemap.xml file instead of index
      createLinkInHead: false
    })
  ],
  adapter: netlify()
});