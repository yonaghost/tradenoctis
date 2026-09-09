import type { SKRSContext2D } from '@napi-rs/canvas';
import { RGBA, toCssColor } from './colorUtils';
import { BBox } from './regionReconstruction';

const MIN_FONT_PX = 8;
const FONT_STEP = 1;

// Languages conventionally written without spaces between words — wrap by
// character instead of by word for these targets.
const CHARACTER_WRAP_LANGS = new Set(['ja', 'ko', 'zh-CN', 'zh-TW']);

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, byCharacter: boolean): string[] {
  const units = byCharacter ? Array.from(text) : text.split(/\s+/).filter(Boolean);
  const sep = byCharacter ? '' : ' ';
  const lines: string[] = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? current + sep + unit : unit;
    if (ctx.measureText(candidate).width <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = unit;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitText(
  ctx: SKRSContext2D,
  text: string,
  box: BBox,
  targetLang: string,
  fontFamily: string,
  startFontPx: number,
): { fontPx: number; lines: string[] } {
  const maxWidth = box.x1 - box.x0;
  const maxHeight = box.y1 - box.y0;
  const byCharacter = CHARACTER_WRAP_LANGS.has(targetLang);

  let fontPx = Math.max(startFontPx, MIN_FONT_PX);
  for (; fontPx >= MIN_FONT_PX; fontPx -= FONT_STEP) {
    ctx.font = `${fontPx}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth, byCharacter);
    const lineHeight = fontPx * 1.25;
    if (lines.length * lineHeight <= maxHeight || fontPx === MIN_FONT_PX) {
      return { fontPx, lines };
    }
  }
  ctx.font = `${MIN_FONT_PX}px ${fontFamily}`;
  return { fontPx: MIN_FONT_PX, lines: wrapText(ctx, text, maxWidth, byCharacter) };
}

/**
 * Draws `text` inside `box`, shrinking and wrapping it so it always stays
 * within the region originally occupied by the source text (requirement:
 * translated text must not spill outside the detected area).
 *
 * Translated text is always laid out horizontally, even when the *original*
 * text was vertical (e.g. Japanese manga dialogue): the target languages we
 * support (Portuguese, English, Spanish, ...) are not conventionally read
 * top-to-bottom, so horizontal wrapping inside the same box reads naturally
 * while still respecting the original placement/size of the bubble/caption.
 */
export function drawFittedText(
  ctx: SKRSContext2D,
  box: BBox,
  text: string,
  textColor: RGBA,
  targetLang: string,
  fontScale: number,
  fontFamily = 'sans-serif',
): void {
  if (!text.trim()) return;

  const naturalFontPx = Math.max(MIN_FONT_PX, Math.min(box.y1 - box.y0, 64));
  const desiredFontPx = Math.round(naturalFontPx * fontScale);
  const { fontPx, lines } = fitText(ctx, text, box, targetLang, fontFamily, desiredFontPx);

  ctx.font = `${fontPx}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = fontPx * 1.25;
  const blockHeight = lines.length * lineHeight;
  const startY = box.y0 + (box.y1 - box.y0 - blockHeight) / 2 + lineHeight / 2;
  const centerX = box.x0 + (box.x1 - box.x0) / 2;

  const strokeColor: RGBA = textColor[0] + textColor[1] + textColor[2] > 380 ? [0, 0, 0, 255] : [255, 255, 255, 255];
  ctx.lineWidth = Math.max(1, fontPx / 10);
  ctx.strokeStyle = `${toCssColor(strokeColor)}`;
  ctx.globalAlpha = 0.55;
  lines.forEach((line, i) => ctx.strokeText(line, centerX, startY + i * lineHeight));
  ctx.globalAlpha = 1;

  ctx.fillStyle = toCssColor(textColor);
  lines.forEach((line, i) => ctx.fillText(line, centerX, startY + i * lineHeight));
}
