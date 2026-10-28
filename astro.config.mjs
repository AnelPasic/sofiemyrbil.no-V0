import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

function servePagefindDev() {
  const mimeTypes = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.pf_meta': 'application/octet-stream',
    '.pagefind': 'application/octet-stream',
  };
  return {
    name: 'serve-pagefind-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/pagefind/')) {
          const relativePath = req.url.replace(/^\/pagefind\//, '').split('?')[0];
          const filePath = join(process.cwd(), 'dist', 'pagefind', relativePath);
          if (existsSync(filePath)) {
            const ext = Object.keys(mimeTypes).find(k => relativePath.endsWith(k)) || '';
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://example.invalid',
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss(), servePagefindDev()] },
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
