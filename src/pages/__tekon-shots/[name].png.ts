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
  ['desktop', 1440, 1000, false, false],
  ['mobile', 430, 932, true, true]
] as const;

type Props = {
  route: string;
  width: number;
  height: number;
  isMobile: boolean;
  hasTouch: boolean;
};

export const getStaticPaths: GetStaticPaths = () => routes.flatMap(([slug, route]) =>
  devices.map(([device, width, height, isMobile, hasTouch]) => ({
    params: { name: `${slug}-${device}` },
    props: { route, width, height, isMobile, hasTouch } satisfies Props
  }))
);

const extractUrl = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const matches = value.match(/https?:\/\/[^\s"'<>]+/g);
    return matches?.find(item => /\.(png|jpe?g|webp)(?:\?|$)/i.test(item)) ?? matches?.[0] ?? null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUrl(item);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['content', 'pageshot', 'screenshot', 'image', 'url', 'data']) {
      if (key in record) {
        const found = extractUrl(record[key]);
        if (found) return found;
      }
    }
    for (const item of Object.values(record)) {
      const found = extractUrl(item);
      if (found) return found;
    }
  }
  return null;
};

let active = 0;
const waiters: Array<() => void> = [];

const withCaptureLimit = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (active >= 2) await new Promise<void>(resolve => waiters.push(resolve));
  active += 1;
  try {
    return await operation();
  } finally {
    await new Promise(resolve => setTimeout(resolve, 300));
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
  try {
    const response = await fetch('https://r.jina.ai/', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-respond-with': 'pageshot',
        'x-no-cache': 'true',
        'x-remove-overlay': 'true',
        'x-timeout': '60',
        'x-respond-timing': 'media-idle'
      },
      body: JSON.stringify({
        url: target,
        viewport: {
          width: props.width,
          height: props.height,
          deviceScaleFactor: 1,
          isMobile: props.isMobile,
          hasTouch: props.hasTouch
        }
      })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Reader ${response.status}: ${text.slice(0, 300)}`);
    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch {}
    const imageUrl = extractUrl(payload);
    if (!imageUrl) throw new Error(`Screenshot URL not found: ${text.slice(0, 300)}`);

    const image = await fetch(imageUrl);
    if (!image.ok) throw new Error(`Image ${image.status}: ${imageUrl}`);
    const bytes = await image.arrayBuffer();
    return new Response(bytes, {
      headers: {
        'content-type': image.headers.get('content-type') ?? 'image/png',
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
