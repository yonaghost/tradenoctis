import { createCanvas, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';
import { getOCRProvider } from '../providers/ocr';
import { getTranslationProvider } from '../providers/translation';
import { imageCacheKey } from '../cache/hash';
import { ocrResultCache, compositeImageCache } from '../cache/memoryCache';
import { estimateColors, reconstructBackground, BBox } from './regionReconstruction';
import { drawFittedText } from './textCompositor';
import { RGBA } from './colorUtils';
import { fetchGuarded } from '../net/fetchGuarded';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 2200;
const MIN_DIMENSION_TO_PROCESS = 24;
const MIN_AVERAGE_CONFIDENCE = 45;

interface StoredRegion {
  bbox: BBox;
  text: string;
  orientation: 'horizontal' | 'vertical';
  textColor: RGBA;
}

interface OcrStageResult {
  hasText: boolean;
  width: number;
  height: number;
  cleanedBackgroundPngBase64?: string;
  regions?: StoredRegion[];
  detectedLang?: string;
}

export interface TranslateImageInput {
  imageUrl: string;
  sourceLangHint: string;
  targetLang: string;
  fontScale: number;
}

export interface TranslateImageOutput {
  hasText: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  reason?: string;
}

async function runOcrStage(pngBuffer: Buffer, width: number, height: number, sourceLangHint: string): Promise<OcrStageResult> {
  const ocr = getOCRProvider();
  const result = await ocr.recognize({ imageBuffer: pngBuffer, languageHint: sourceLangHint });

  if (result.lines.length === 0 || result.averageConfidence < MIN_AVERAGE_CONFIDENCE) {
    return { hasText: false, width, height };
  }

  const image = await loadImage(pngBuffer);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const regions: StoredRegion[] = result.lines
    .filter((line) => line.text.trim().length > 0)
    .map((line) => ({
      bbox: line.bbox,
      text: line.text,
      orientation: line.orientation,
      textColor: estimateColors(ctx, line.bbox, width, height).text,
    }));

  // Paint over every region only after all colors have been sampled from the
  // still-intact image (reconstructing one region must not corrupt the
  // background samples for a neighboring one).
  for (const region of regions) {
    const { bgTop, bgBottom } = estimateColors(ctx, region.bbox, width, height);
    reconstructBackground(ctx, region.bbox, bgTop, bgBottom, width, height);
  }

  return {
    hasText: true,
    width,
    height,
    cleanedBackgroundPngBase64: canvas.toBuffer('image/png').toString('base64'),
    regions,
    detectedLang: result.detectedLang,
  };
}

async function composite(
  stage: OcrStageResult,
  translations: string[],
  targetLang: string,
  fontScale: number,
): Promise<string> {
  const background = Buffer.from(stage.cleanedBackgroundPngBase64!, 'base64');
  const image = await loadImage(background);
  const canvas = createCanvas(stage.width, stage.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, stage.width, stage.height);

  stage.regions!.forEach((region, i) => {
    const translated = translations[i] ?? region.text;
    drawFittedText(ctx, region.bbox, translated, region.textColor, targetLang, fontScale);
  });

  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}

/**
 * Full OCR -> translate -> reconstruct -> composite pipeline for a single
 * image. Every stage is guarded: any failure anywhere results in
 * `{ hasText: false }`, which callers must interpret as "keep the original
 * image" — Noctis never shows a blank space instead of an image.
 */
export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {
  try {
    const { buffer } = await fetchGuarded(input.imageUrl, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 15_000,
      accept: 'image/*',
    });

    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height || meta.width < MIN_DIMENSION_TO_PROCESS || meta.height < MIN_DIMENSION_TO_PROCESS) {
      return { hasText: false, reason: 'too-small' };
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(meta.width, meta.height));
    const targetWidth = Math.round(meta.width * scale);
    const targetHeight = Math.round(meta.height * scale);

    const normalizedPng = await sharp(buffer)
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .png()
      .toBuffer();

    const stageKey = imageCacheKey(normalizedPng, input.sourceLangHint);
    let stage = ocrResultCache.get(stageKey) as OcrStageResult | undefined;
    if (!stage) {
      stage = await runOcrStage(normalizedPng, targetWidth, targetHeight, input.sourceLangHint);
      ocrResultCache.set(stageKey, stage);
    }

    if (!stage.hasText || !stage.regions || stage.regions.length === 0) {
      return { hasText: false, reason: 'no-text-detected' };
    }

    const fontScaleBucket = Math.round(input.fontScale * 10) / 10;
    const compositeKey = `${stageKey}:${input.targetLang}:${fontScaleBucket}`;
    const cachedComposite = compositeImageCache.get(compositeKey);
    if (cachedComposite) {
      return { hasText: true, dataUrl: cachedComposite, width: stage.width, height: stage.height };
    }

    const translationProvider = getTranslationProvider();
    const { translations } = await translationProvider.translate({
      texts: stage.regions.map((r) => r.text),
      sourceLang: input.sourceLangHint,
      targetLang: input.targetLang,
    });

    const dataUrl = await composite(stage, translations, input.targetLang, fontScaleBucket);
    compositeImageCache.set(compositeKey, dataUrl);

    return { hasText: true, dataUrl, width: stage.width, height: stage.height };
  } catch (err) {
    // Never propagate: any unexpected failure at any stage falls back to
    // "keep the original image" for the caller. Still log server-side —
    // hasText:false is otherwise indistinguishable from "no text found".
    console.error('[image/pipeline] translateImage failed:', err);
    return { hasText: false, reason: err instanceof Error ? err.message : 'unknown-error' };
  }
}
