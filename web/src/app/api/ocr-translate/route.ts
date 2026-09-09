import { NextRequest, NextResponse } from 'next/server';
import { translateImage } from '../../../lib/image/pipeline';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { imageUrl?: unknown; sourceLang?: unknown; targetLang?: unknown; fontScale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ hasText: false, error: 'JSON inválido.' }, { status: 400 });
  }

  if (typeof body.imageUrl !== 'string' || typeof body.targetLang !== 'string') {
    return NextResponse.json(
      { hasText: false, error: '"imageUrl" e "targetLang" são obrigatórios.' },
      { status: 400 },
    );
  }

  const sourceLangHint = typeof body.sourceLang === 'string' ? body.sourceLang : 'auto';
  const fontScale = typeof body.fontScale === 'number' && body.fontScale > 0 ? body.fontScale : 1;

  // The pipeline itself already catches every internal failure and resolves
  // to { hasText: false } — this route only needs to guard against it
  // throwing due to something outside the pipeline (e.g. a bad request).
  const result = await translateImage({
    imageUrl: body.imageUrl,
    sourceLangHint,
    targetLang: body.targetLang,
    fontScale,
  });

  return NextResponse.json(result);
}
