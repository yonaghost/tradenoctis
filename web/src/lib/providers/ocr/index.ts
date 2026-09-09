import { OCRProvider } from './OCRProvider';
import { TesseractOCRProvider } from './TesseractOCRProvider';

export * from './OCRProvider';

let cached: OCRProvider | null = null;

/** Single OCR backend for now; kept behind a factory so a future provider
 * (e.g. a native/cloud OCR service) can be swapped in without touching
 * callers. */
export function getOCRProvider(): OCRProvider {
  if (!cached) cached = new TesseractOCRProvider();
  return cached;
}
