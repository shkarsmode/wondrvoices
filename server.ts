import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './src/main.server';

export function app(): express.Express {
  const server = express();
  server.set('trust proxy', true); // важно за прокси/Cloudflare

  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // 1) Отдаём только статические файлы (*.js, *.css, картинки и т.п.)
  server.get('*.*', express.static(browserDistFolder, { maxAge: '1y' }));

  // 2) Все остальные роуты — через SSR
  server.get('**', (req, res, next) => {
    const proto =
      (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host =
      (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const url = `${proto}://${host}${req.originalUrl}`;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }],
      })
      .then(html => res.send(html))
      .catch(next);
  });

  return server;
}

// function run() { ... }
