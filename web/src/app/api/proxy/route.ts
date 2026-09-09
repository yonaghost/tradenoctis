import { NextRequest, NextResponse } from 'next/server';
import { fetchGuarded, BlockedUrlError } from '../../../lib/net/fetchGuarded';
import { rewriteHtmlForProxy } from '../../../lib/html/rewrite';
import { DEFAULT_TARGET_LANG } from '../../../lib/languages';

export const runtime = 'nodejs';

const MAX_HTML_BYTES = 15 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  const lang = req.nextUrl.searchParams.get('lang') ?? DEFAULT_TARGET_LANG;
  const scale = Number(req.nextUrl.searchParams.get('scale') ?? '1') || 1;

  if (!target) {
    return NextResponse.json({ error: 'Parâmetro "url" é obrigatório.' }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await fetchGuarded(target, {
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: 20_000,
      accept: 'text/html,application/xhtml+xml',
    });

    const pageUrl = new URL(target);

    if (contentType && !contentType.includes('html')) {
      // Non-HTML resource requested directly (e.g. a PDF/image link) —
      // stream it back untouched instead of trying to translate it.
      return new NextResponse(buffer, { headers: { 'Content-Type': contentType } });
    }

    const html = buffer.toString('utf-8');
    const rewritten = rewriteHtmlForProxy(html, { pageUrl, targetLang: lang, fontScale: scale });

    return new NextResponse(rewritten, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Never let the framed document be treated as ours for caching by
        // shared caches; each proxied page can differ per language/scale.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const message = err instanceof BlockedUrlError ? err.message : 'Não foi possível carregar essa página.';
    const status = err instanceof BlockedUrlError ? 400 : 502;
    return new NextResponse(renderErrorPage(message), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function renderErrorPage(message: string): string {
  return `<!doctype html><html><body style="font-family:system-ui;background:#0B0F14;color:#F1F5F9;padding:2rem;">
    <h1 style="color:#00E5A0">Não foi possível abrir a página</h1>
    <p>${message}</p>
  </body></html>`;
}
