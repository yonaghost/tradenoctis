import * as cheerio from 'cheerio';

export interface RewriteOptions {
  pageUrl: URL;
  targetLang: string;
  fontScale: number;
  /** Our own server origin (e.g. https://noctis.example.com), used to build
   * an absolute URL for the injected script — see note below on why a
   * root-relative one breaks. */
  origin: string;
}

const NON_NAVIGABLE_SCHEMES = /^(javascript:|mailto:|tel:|#)/i;

/**
 * Rewrites a fetched HTML document so it can be safely embedded in our own
 * iframe and kept navigable/translatable:
 *
 *  - injects a <base> tag so every relative resource (img/css/js/font/form
 *    action) keeps resolving against the original site, without us having
 *    to rewrite each one individually;
 *  - rewrites in-page <a href> links to route back through our own proxy,
 *    so clicking a link keeps the user inside the translator;
 *  - strips embedded CSP meta tags that would otherwise block our injected
 *    translation script (the original site's HTTP-level CSP header is never
 *    forwarded in the first place, since we issue our own response);
 *  - injects the client-side translation runtime script + base styles.
 *
 * Form submissions and any resource URL we don't explicitly rewrite are left
 * to resolve directly against the source site via <base> — that keeps them
 * working, but a submitted form navigates the user away from the
 * translator. See docs/LIMITATIONS.md.
 */
export function rewriteHtmlForProxy(html: string, { pageUrl, targetLang, fontScale, origin }: RewriteOptions): string {
  const $ = cheerio.load(html);

  $('head').first().prepend(`<base href="${escapeAttr(pageUrl.href)}">`);
  $('meta[http-equiv]').each((_, el) => {
    const value = $(el).attr('http-equiv')?.toLowerCase();
    if (value === 'content-security-policy' || value === 'x-frame-options') {
      $(el).remove();
    }
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || NON_NAVIGABLE_SCHEMES.test(href.trim())) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
      const proxied = `/api/proxy?url=${encodeURIComponent(resolved.href)}&lang=${encodeURIComponent(targetLang)}&scale=${fontScale}`;
      $(el).attr('href', proxied);
      $(el).removeAttr('target');
    } catch {
      // Malformed href — leave untouched rather than breaking the page.
    }
  });

  $('html').attr('style', `--noctis-scale:${fontScale}`);
  $('head').first().append(`
    <style id="noctis-base-style">
      .noctis-text { font-size: calc(1em * var(--noctis-scale, 1)) !important; }
      .noctis-processing-badge {
        position: fixed; bottom: 12px; right: 12px; z-index: 2147483647;
        background: #111820; color: #F1F5F9; border: 1px solid #263340;
        border-radius: 8px; padding: 6px 10px; font: 12px/1.4 system-ui, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,.4); opacity: .95;
      }
    </style>
  `);

  // Must be an absolute URL pointing at our own origin: the <base> tag above
  // makes the browser resolve ANY relative src/href — including a
  // root-relative one starting with "/" — against the target site's origin,
  // not ours. A root-relative script src here silently 404s against the
  // proxied site instead of loading from our server (caught via a real
  // deploy: Chrome reported it blocked by CORB after fetching the wrong
  // origin entirely).
  $('body').append(
    `<script src="${escapeAttr(origin)}/noctis-inject.js" defer data-target-lang="${escapeAttr(targetLang)}" data-source-url="${escapeAttr(pageUrl.href)}" data-font-scale="${fontScale}"></script>`,
  );

  return $.html();
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
