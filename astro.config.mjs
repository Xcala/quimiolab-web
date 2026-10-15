import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.quimiolab.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false }, // en desarrollo tapaba las barras del editor y del panel

});
