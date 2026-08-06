// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const temporaryQaLink = {
  name: 'temporary-tekon-qa-link',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const index = new URL('index.html', dir);
      const html = await readFile(index, 'utf8');
      const link = '<a href="/__tekon-visual-qa/" aria-label="Tekon visual QA" style="position:fixed;right:0;bottom:0;width:1px;height:1px;overflow:hidden;opacity:.001">Tekon visual QA</a>';
      await writeFile(index, html.replace('</body>', `${link}</body>`));
    }
  }
};

export default defineConfig({
  site: 'https://rom4.ru',
  // Порт назначает окружение: в проекте нередко уже крутится dev-сервер
  // соседней сессии, и жёстко прибитый 4321 просто не поднимается.
  server: { port: Number(process.env.PORT) || 4321 },
  integrations: [sitemap(), temporaryQaLink],
});
