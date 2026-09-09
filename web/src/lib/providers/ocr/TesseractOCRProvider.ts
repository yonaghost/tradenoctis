import { createWorker, type Worker } from 'tesseract.js';
import {
  OCRProvider,
  OCRProviderError,
  OCRRequest,
  OCRResult,
  OCRWord,
  TextOrientation,
} from './OCRProvider';
import { groupWordsIntoLines } from './lineGrouping';
import { scriptToTesseractLangs, verticalVariant } from './scriptMapping';

// Reuse workers per trained-data combo across requests in the same process —
// initializing a worker (loading traineddata) is the expensive part.
const workerPool = new Map<string, Promise<Worker>>();

async function getWorker(lang: string): Promise<Worker> {
  let pending = workerPool.get(lang);
  if (!pending) {
    pending = createWorker(lang, undefined, {
      // Allow self-hosting trained data / core assets for offline or
      // restricted-network deployments; falls back to tesseract.js defaults.
      langPath: process.env.TESSDATA_URL,
      cachePath: process.env.TESSDATA_CACHE_DIR ?? '.cache/tessdata',
    });
    workerPool.set(lang, pending);
  }
  return pending;
}

const MIN_WORD_CONFIDENCE = 35;

/**
 * OCR backend built on Tesseract.js (https://github.com/naptha/tesseract.js).
 * Runs fully locally inside the Node.js server process — no image bytes or
 * text ever leave the machine running Noctis for this stage, which is the
 * "prioritize local OCR" requirement. Trained-data files for each script are
 * fetched once (see TESSDATA_URL) and cached on disk afterward.
 */
export class TesseractOCRProvider implements OCRProvider {
  readonly id = 'tesseract';

  async recognize({ imageBuffer, languageHint }: OCRRequest): Promise<OCRResult> {
    const script = await this.detectScript(imageBuffer);
    const candidateLangs = scriptToTesseractLangs(script, languageHint);

    let best: { words: OCRWord[]; orientation: TextOrientation; lang: string } | null = null;

    for (const lang of candidateLangs) {
      const variants: { lang: string; orientation: TextOrientation }[] = [{ lang, orientation: 'horizontal' }];
      const vertical = verticalVariant(lang);
      if (vertical) variants.push({ lang: vertical, orientation: 'vertical' });

      for (const variant of variants) {
        try {
          const words = await this.recognizeWithLang(imageBuffer, variant.lang);
          const confSum = words.reduce((s, w) => s + w.confidence, 0);
          const avg = words.length > 0 ? confSum / words.length : 0;
          const bestAvg = best && best.words.length > 0
            ? best.words.reduce((s, w) => s + w.confidence, 0) / best.words.length
            : -1;
          if (words.length > 0 && avg > bestAvg) {
            best = { words, orientation: variant.orientation, lang: variant.lang };
          }
        } catch (err) {
          // A missing/unfetchable trained-data package for one candidate
          // must not fail the whole request — just skip that candidate.
          continue;
        }
      }
    }

    if (!best || best.words.length === 0) {
      return { lines: [], averageConfidence: 0 };
    }

    const filteredWords = best.words.filter((w) => w.confidence >= MIN_WORD_CONFIDENCE && w.text.trim() !== '');
    if (filteredWords.length === 0) {
      return { lines: [], averageConfidence: 0 };
    }

    const lines = groupWordsIntoLines(filteredWords, best.orientation);
    const averageConfidence = filteredWords.reduce((s, w) => s + w.confidence, 0) / filteredWords.length;

    return { lines, averageConfidence, detectedLang: best.lang };
  }

  private async detectScript(imageBuffer: Buffer): Promise<string | undefined> {
    try {
      const worker = await getWorker('osd');
      const { data } = await worker.detect(imageBuffer);
      return (data as unknown as { script?: string }).script;
    } catch {
      // OSD is a best-effort hint; recognition still proceeds without it.
      return undefined;
    }
  }

  private async recognizeWithLang(imageBuffer: Buffer, lang: string): Promise<OCRWord[]> {
    let worker: Worker;
    try {
      worker = await getWorker(lang);
    } catch (err) {
      throw new OCRProviderError(`Failed to initialize Tesseract worker for '${lang}'`, this.id, err);
    }

    const { data } = await worker.recognize(imageBuffer);
    const words = (data.words ?? []) as {
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }[];

    return words.map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));
  }
}
