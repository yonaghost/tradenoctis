import { NextRequest, NextResponse } from 'next/server';
import { getTranslationProvider } from '../../../lib/providers/translation';

export const runtime = 'nodejs';

const MAX_TEXTS_PER_REQUEST = 80;
const MAX_CHARS_PER_TEXT = 4000;

export async function POST(req: NextRequest) {
  let body: { texts?: unknown; sourceLang?: unknown; targetLang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  if (!Array.isArray(body.texts) || typeof body.targetLang !== 'string') {
    return NextResponse.json({ error: 'Campos "texts" (array) e "targetLang" (string) são obrigatórios.' }, { status: 400 });
  }

  const texts = body.texts
    .filter((t): t is string => typeof t === 'string')
    .slice(0, MAX_TEXTS_PER_REQUEST)
    .map((t) => t.slice(0, MAX_CHARS_PER_TEXT));
  const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : 'auto';
  const targetLang = body.targetLang;

  if (texts.length === 0) {
    return NextResponse.json({ translations: [] });
  }

  try {
    const provider = getTranslationProvider();
    const result = await provider.translate({ texts, sourceLang, targetLang });
    return NextResponse.json(result);
  } catch (err) {
    // Fallback requirement: translation failure must never break the page —
    // echo the original texts back so the caller can leave them untouched.
    return NextResponse.json(
      { translations: texts, error: err instanceof Error ? err.message : 'translation-failed' },
      { status: 200 },
    );
  }
}
