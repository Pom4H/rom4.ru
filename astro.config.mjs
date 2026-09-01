// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rom4.ru',
  // Порт назначает окружение: в проекте нередко уже крутится dev-сервер
  // соседней сессии, и жёстко прибитый 4321 просто не поднимается.
  server: { port: Number(process.env.PORT) || 4321 },
  integrations: [sitemap()],
});
