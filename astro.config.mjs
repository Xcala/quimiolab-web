import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.quimiolab.com.co',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
});
