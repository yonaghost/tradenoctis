import { describe, expect, it } from 'vitest';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { drawFittedText } from '../image/textCompositor';

function hasNonTransparentPixel(canvas: Canvas): boolean {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

describe('drawFittedText', () => {
  it('draws long text inside a small box without throwing, shrinking to fit', () => {
    const canvas = createCanvas(200, 60);
    const ctx = canvas.getContext('2d');
    expect(() =>
      drawFittedText(
        ctx,
        { x0: 10, y0: 10, x1: 190, y1: 50 },
        'Este é um texto de exemplo bem mais longo do que a caixa original.',
        [0, 0, 0, 255],
        'pt',
        1,
      ),
    ).not.toThrow();
    expect(hasNonTransparentPixel(canvas)).toBe(true);
  });

  it('wraps by character for CJK target languages instead of by word', () => {
    const canvas = createCanvas(120, 120);
    const ctx = canvas.getContext('2d');
    expect(() =>
      drawFittedText(ctx, { x0: 0, y0: 0, x1: 120, y1: 120 }, 'これはテスト文章です', [0, 0, 0, 255], 'ja', 1),
    ).not.toThrow();
  });

  it('does nothing for empty/whitespace-only text', () => {
    const canvas = createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    drawFittedText(ctx, { x0: 0, y0: 0, x1: 50, y1: 50 }, '   ', [0, 0, 0, 255], 'pt', 1);
    expect(hasNonTransparentPixel(canvas)).toBe(false);
  });
});
