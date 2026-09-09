import { NextRequest, NextResponse } from 'next/server';
import { renderTranslatedPagePdf } from '../../../lib/pdf/renderPdf';
import { DEFAULT_TARGET_LANG } from '../../../lib/languages';
import { assertPublicHttpUrl, BlockedUrlError } from '../../../lib/net/fetchGuarded';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  const lang = req.nextUrl.searchParams.get('lang') ?? DEFAULT_TARGET_LANG;
  const scale = req.nextUrl.searchParams.get('scale') ?? '1';

  if (!target) {
    return NextResponse.json({ error: 'Parâmetro "url" é obrigatório.' }, { status: 400 });
  }

  try {
    assertPublicHttpUrl(target);
  } catch (err) {
    return NextResponse.json({ error: err instanceof BlockedUrlError ? err.message : 'URL inválida.' }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const proxyUrl = `${origin}/api/proxy?url=${encodeURIComponent(target)}&lang=${encodeURIComponent(lang)}&scale=${encodeURIComponent(scale)}`;

  try {
    const pdf = await renderTranslatedPagePdf({ pageUrl: proxyUrl });
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="pagina-traduzida-noctis.pdf"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          'Não foi possível gerar o PDF. Isso normalmente significa que nenhum Chromium está disponível para o servidor ' +
          '(defina PLAYWRIGHT_CHROMIUM_PATH ou instale o Chromium do Playwright no ambiente de deploy).',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
