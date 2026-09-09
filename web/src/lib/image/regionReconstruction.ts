import type { SKRSContext2D } from '@napi-rs/canvas';
import { RGBA, colorDistance, contrastColorFor, medianColor } from './colorUtils';

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const RING_MARGIN = 4;
const BOX_PADDING = 2;

function readPixel(data: Uint8ClampedArray, width: number, x: number, y: number): RGBA {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function clampBox(box: BBox, width: number, height: number): BBox {
  return {
    x0: Math.max(0, Math.min(box.x0, width - 1)),
    y0: Math.max(0, Math.min(box.y0, height - 1)),
    x1: Math.max(0, Math.min(box.x1, width - 1)),
    y1: Math.max(0, Math.min(box.y1, height - 1)),
  };
}

/**
 * Estimates the surrounding background color (sampling a ring just outside
 * the text box, split into a "top" and "bottom" sample so a vertical
 * gradient fill can approximate soft backgrounds) and the foreground text
 * color (sampling pixels inside the box that stand out from the background).
 *
 * This is a heuristic, not true inpainting/segmentation — see
 * docs/LIMITATIONS.md for why (no ML inpainting model is bundled).
 */
export function estimateColors(
  ctx: SKRSContext2D,
  box: BBox,
  imageWidth: number,
  imageHeight: number,
): { bgTop: RGBA; bgBottom: RGBA; text: RGBA } {
  const clamped = clampBox(box, imageWidth, imageHeight);
  const ringX0 = Math.max(0, clamped.x0 - RING_MARGIN);
  const ringY0 = Math.max(0, clamped.y0 - RING_MARGIN);
  const ringX1 = Math.min(imageWidth - 1, clamped.x1 + RING_MARGIN);
  const ringY1 = Math.min(imageHeight - 1, clamped.y1 + RING_MARGIN);
  const ringW = ringX1 - ringX0 + 1;
  const ringH = ringY1 - ringY0 + 1;
  if (ringW <= 0 || ringH <= 0) {
    return { bgTop: [255, 255, 255, 255], bgBottom: [255, 255, 255, 255], text: [0, 0, 0, 255] };
  }

  const ring = ctx.getImageData(ringX0, ringY0, ringW, ringH);
  const inBox = (x: number, y: number) =>
    x >= clamped.x0 - ringX0 && x <= clamped.x1 - ringX0 && y >= clamped.y0 - ringY0 && y <= clamped.y1 - ringY0;

  const topSamples: RGBA[] = [];
  const bottomSamples: RGBA[] = [];
  const midY = ringH / 2;
  for (let y = 0; y < ringH; y++) {
    for (let x = 0; x < ringW; x++) {
      if (inBox(x, y)) continue;
      const px = readPixel(ring.data as unknown as Uint8ClampedArray, ringW, x, y);
      (y < midY ? topSamples : bottomSamples).push(px);
    }
  }
  const bgTop = medianColor(topSamples.length > 0 ? topSamples : bottomSamples);
  const bgBottom = medianColor(bottomSamples.length > 0 ? bottomSamples : topSamples);
  const bgAvg = medianColor([bgTop, bgBottom]);

  const boxW = clamped.x1 - clamped.x0 + 1;
  const boxH = clamped.y1 - clamped.y0 + 1;
  let textSamples: RGBA[] = [];
  if (boxW > 0 && boxH > 0) {
    const boxData = ctx.getImageData(clamped.x0, clamped.y0, boxW, boxH);
    const arr = boxData.data as unknown as Uint8ClampedArray;
    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const px = readPixel(arr, boxW, x, y);
        if (colorDistance(px, bgAvg) > 60) textSamples.push(px);
      }
    }
  }

  const text = textSamples.length > boxW * boxH * 0.02 ? medianColor(textSamples) : contrastColorFor(bgAvg);

  return { bgTop, bgBottom, text };
}

/**
 * Paints over the (padded) text box with a top-to-bottom gradient built from
 * the sampled surrounding background, approximating the original background
 * well enough for flat or gently-shaded regions (speech bubbles, banners,
 * solid-color UI). Busy photographic backgrounds behind the removed text
 * will look smoothed rather than perfectly reconstructed — a known
 * limitation of heuristic (non-generative) reconstruction.
 */
export function reconstructBackground(
  ctx: SKRSContext2D,
  box: BBox,
  bgTop: RGBA,
  bgBottom: RGBA,
  imageWidth: number,
  imageHeight: number,
): void {
  const padded = clampBox(
    { x0: box.x0 - BOX_PADDING, y0: box.y0 - BOX_PADDING, x1: box.x1 + BOX_PADDING, y1: box.y1 + BOX_PADDING },
    imageWidth,
    imageHeight,
  );
  const w = padded.x1 - padded.x0 + 1;
  const h = padded.y1 - padded.y0 + 1;
  if (w <= 0 || h <= 0) return;

  const gradient = ctx.createLinearGradient(0, padded.y0, 0, padded.y1);
  gradient.addColorStop(0, `rgba(${bgTop[0]},${bgTop[1]},${bgTop[2]},1)`);
  gradient.addColorStop(1, `rgba(${bgBottom[0]},${bgBottom[1]},${bgBottom[2]},1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(padded.x0, padded.y0, w, h);
}
