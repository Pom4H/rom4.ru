import type { APIRoute, GetStaticPaths } from 'astro';

const preview = 'https://tekon-git-agent-final-typography-pass-pom4hs-projects.vercel.app';

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

const devices = [
  ['desktop', 1440, 1000],
  ['mobile', 430, 932]
] as const;

type Props = {
  route: string;
  width: number;
  height: number;
};

export const getStaticPaths: GetStaticPaths = () => routes.flatMap(([slug, route]) =>
  devices.map(([device, width, height]) => ({
    params: { name: `${slug}-${device}` },
    props: { route, width, height } satisfies Props
  }))
);

let active = 0;
const waiters: Array<() => void> = [];

const withCaptureLimit = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (active >= 1) await new Promise<void>(resolve => waiters.push(resolve));
  active += 1;
  try {
    return await operation();
  } finally {
    await new Promise(resolve => setTimeout(resolve, 2200));
    active -= 1;
    waiters.shift()?.();
  }
};

const errorSvg = (message: string) => new TextEncoder().encode(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000" viewBox="0 0 1440 1000">
    <rect width="1440" height="1000" fill="#181818"/>
    <text x="72" y="120" fill="#ff8e8e" font-family="monospace" font-size="28">Tekon visual QA capture failed</text>
    <foreignObject x="72" y="170" width="1296" height="700">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color:#ddd;font:22px/1.5 monospace;white-space:pre-wrap">${message.replace(/[<>&]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[character]!)}</div>
    </foreignObject>
  </svg>
`);

export const GET: APIRoute<Props> = async ({ props }) => withCaptureLimit(async () => {
  const target = new URL(props.route, `${preview}/`).href;
  const shot = new URL('https://pageshot.site/v1/screenshot');
  shot.searchParams.set('url', target);
  shot.searchParams.set('width', String(props.width));
  shot.searchParams.set('height', String(props.height));
  shot.searchParams.set('format', 'png');
  shot.searchParams.set('full_page', 'true');
  shot.searchParams.set('dark_mode', 'false');
  shot.searchParams.set('delay', '1200');

  try {
    const response = await fetch(shot, { headers: { accept: 'image/png' } });
    if (!response.ok) {
      throw new Error(`PageShot ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unexpected PageShot content type ${contentType}: ${(await response.text()).slice(0, 300)}`);
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=300'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(errorSvg(message), {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
        'x-visual-qa-error': 'true'
      }
    });
  }
});
