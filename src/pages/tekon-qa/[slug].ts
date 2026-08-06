import type { APIRoute, GetStaticPaths } from 'astro';

const origin = 'https://tekon-8tvm.vercel.app';

const routes = [
  ['home', '/'],
  ['564-fz', '/564-fz/'],
  ['certificates', '/certificates/'],
  ['company', '/company/'],
  ['contacts', '/contacts/'],
  ['documentation', '/documentation/'],
  ['news', '/news/'],
  ['products', '/products/'],
  ['software', '/software/'],
  ['404', '/404.html'],
  ['product-kio-2ms', '/products/kio-2ms/'],
  ['product-kun-ip8', '/products/kun-ip8/'],
  ['product-kcs-ipm', '/products/kcs-ipm/'],
  ['product-ksl-rs', '/products/ksl-rs/'],
  ['product-kup-4rs', '/products/kup-4rs/'],
  ['product-kir-16', '/products/kir-16/'],
  ['product-kun-2dm', '/products/kun-2dm/'],
  ['product-upsl-m', '/products/upsl-m/']
] as const;

type Props = { route: string };

export const getStaticPaths: GetStaticPaths = () => routes.map(([slug, route]) => ({
  params: { slug },
  props: { route } satisfies Props
}));

const forceLight = `
<script>
  try { localStorage.setItem('tekon-theme-preference', 'light'); } catch {}
  document.documentElement.dataset.themePreference = 'light';
  document.documentElement.dataset.theme = 'light';
  document.documentElement.style.colorScheme = 'light';
</script>
<link rel="stylesheet" href="https://www.rom4.ru/__tekon-qa/typography.css" />
<style>
  html { color-scheme: light !important; }
  body::after {
    content: 'QA · PR #17';
    position: fixed;
    right: 8px;
    bottom: 8px;
    z-index: 99999;
    padding: 4px 7px;
    color: #17382f;
    background: #d7ff72;
    border-radius: 999px;
    font: 700 10px/1 system-ui;
    letter-spacing: .04em;
    pointer-events: none;
  }
</style>`;

export const GET: APIRoute<Props> = async ({ props }) => {
  const target = new URL(props.route, `${origin}/`);
  const response = await fetch(target, { headers: { accept: 'text/html' } });
  if (!response.ok) return new Response(`Upstream ${response.status}: ${target}`, { status: 502 });

  let html = await response.text();
  html = html
    .replace(/<html([^>]*)>/i, '<html$1 data-theme="light" data-theme-preference="light" style="color-scheme: light;">')
    .replace(/<head>/i, `<head><base href="${target.href}">`)
    .replace(/<\/head>/i, `${forceLight}</head>`)
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="noindex, nofollow">');

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'x-robots-tag': 'noindex, nofollow'
    }
  });
};
