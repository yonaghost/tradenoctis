import { describe, expect, it } from 'vitest';
import { rewriteHtmlForProxy } from '../html/rewrite';

const pageUrl = new URL('https://example.com/blog/post');

describe('rewriteHtmlForProxy', () => {
  it('injects a base tag pointing at the source page', () => {
    const html = '<html><head></head><body>hi</body></html>';
    const out = rewriteHtmlForProxy(html, { pageUrl, targetLang: 'pt', fontScale: 1 });
    expect(out).toContain('<base href="https://example.com/blog/post">');
  });

  it('rewrites absolute and relative links to route back through the proxy', () => {
    const html = `<html><body>
      <a href="/other-page">a</a>
      <a href="https://example.com/full">b</a>
      <a href="https://external.com/x">c</a>
    </body></html>`;
    const out = rewriteHtmlForProxy(html, { pageUrl, targetLang: 'pt', fontScale: 1 });
    // Cheerio HTML-escapes "&" as "&amp;" inside attribute values, which is
    // correct output — assert against that serialized form.
    expect(out).toContain(`/api/proxy?url=${encodeURIComponent('https://example.com/other-page')}&amp;lang=pt&amp;scale=1`);
    expect(out).toContain(`/api/proxy?url=${encodeURIComponent('https://example.com/full')}&amp;lang=pt&amp;scale=1`);
    expect(out).toContain(`/api/proxy?url=${encodeURIComponent('https://external.com/x')}&amp;lang=pt&amp;scale=1`);
  });

  it('leaves non-navigable hrefs untouched', () => {
    const html = '<html><body><a href="javascript:void(0)">x</a><a href="#section">y</a></body></html>';
    const out = rewriteHtmlForProxy(html, { pageUrl, targetLang: 'pt', fontScale: 1 });
    expect(out).toContain('href="javascript:void(0)"');
    expect(out).toContain('href="#section"');
  });

  it('strips embedded CSP/X-Frame-Options meta tags that would block the injected script', () => {
    const html = `<html><head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      <meta http-equiv="X-Frame-Options" content="DENY">
    </head><body></body></html>`;
    const out = rewriteHtmlForProxy(html, { pageUrl, targetLang: 'pt', fontScale: 1 });
    expect(out).not.toContain('Content-Security-Policy');
    expect(out).not.toContain('X-Frame-Options');
  });

  it('injects the translation runtime script with the requested language and scale', () => {
    const html = '<html><body></body></html>';
    const out = rewriteHtmlForProxy(html, { pageUrl, targetLang: 'ja', fontScale: 1.3 });
    expect(out).toContain('src="/noctis-inject.js"');
    expect(out).toContain('data-target-lang="ja"');
    expect(out).toContain('data-font-scale="1.3"');
  });
});
