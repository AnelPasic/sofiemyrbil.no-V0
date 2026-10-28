import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://example.invalid',
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
  redirects: {
    '/verkstedtjenester/eu-kontroll/': '/eu-kontroll/',
    '/verkstedtjenester/service/': '/tjeneste/',
    '/verkstedtjenester/reparasjoner/': '/tjeneste/',
    '/verkstedtjenester/bobilservice/': '/tjeneste/',
    '/verkstedtjenester/': '/tjeneste/',
    '/flateavtale-service-og-vedlikehol/': '/tjeneste/',
    '/om-oss/': '/om/',
    '/kontakt-oss/': '/kontakt/',
  },
});
