import { OCRLine, OCRWord, TextOrientation } from './OCRProvider';

const CJK_REGEX = /[぀-ヿ㐀-䶿一-鿿가-힯]/;

function isCjkText(text: string): boolean {
  return CJK_REGEX.test(text);
}

function unionBbox(words: OCRWord[]): OCRLine['bbox'] {
  return {
    x0: Math.min(...words.map((w) => w.bbox.x0)),
    y0: Math.min(...words.map((w) => w.bbox.y0)),
    x1: Math.max(...words.map((w) => w.bbox.x1)),
    y1: Math.max(...words.map((w) => w.bbox.y1)),
  };
}

function avgConfidence(words: OCRWord[]): number {
  return words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
}

function joinWords(words: OCRWord[]): string {
  const text = words.map((w) => w.text).join(' ');
  return isCjkText(text) ? text.replace(/\s+/g, '') : text;
}

/**
 * Clusters raw OCR words into reading-order lines. Pure/deterministic so it
 * can be unit-tested without a real OCR engine.
 *
 * Horizontal: cluster by vertical (y) overlap, order clusters top-to-bottom,
 * words left-to-right within a cluster.
 *
 * Vertical (used for CJK vertical text such as manga/manhwa/webtoon
 * dialogue): cluster by horizontal (x) overlap into columns, order columns
 * right-to-left (traditional reading direction), words top-to-bottom within
 * a column. This is a heuristic, not a layout-aware model — see
 * docs/LIMITATIONS.md.
 */
export function groupWordsIntoLines(words: OCRWord[], orientation: TextOrientation): OCRLine[] {
  if (words.length === 0) return [];

  if (orientation === 'vertical') {
    return groupByAxis(words, 'x', 'y', /* descending primary order */ true);
  }
  return groupByAxis(words, 'y', 'x', /* descending primary order */ false);
}

/**
 * @param primaryAxis axis used to decide which cluster a word belongs to
 * @param secondaryAxis axis used to order words within a cluster
 * @param primaryDescending whether clusters are ordered high-to-low on the primary axis
 */
function groupByAxis(
  words: OCRWord[],
  primaryAxis: 'x' | 'y',
  secondaryAxis: 'x' | 'y',
  primaryDescending: boolean,
): OCRLine[] {
  const center = (w: OCRWord, axis: 'x' | 'y') =>
    axis === 'x' ? (w.bbox.x0 + w.bbox.x1) / 2 : (w.bbox.y0 + w.bbox.y1) / 2;
  const size = (w: OCRWord, axis: 'x' | 'y') =>
    axis === 'x' ? w.bbox.x1 - w.bbox.x0 : w.bbox.y1 - w.bbox.y0;

  const sorted = [...words].sort((a, b) => center(a, primaryAxis) - center(b, primaryAxis));
  const avgSize = sorted.reduce((sum, w) => sum + size(w, primaryAxis === 'x' ? 'y' : 'x'), 0) / sorted.length;
  const threshold = Math.max(avgSize * 0.6, 4);

  const clusters: OCRWord[][] = [];
  for (const word of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const lastCenter = last.reduce((sum, w) => sum + center(w, primaryAxis), 0) / last.length;
      if (Math.abs(center(word, primaryAxis) - lastCenter) <= threshold) {
        last.push(word);
        continue;
      }
    }
    clusters.push([word]);
  }

  const ordered = primaryDescending
    ? clusters.sort(
        (a, b) =>
          b.reduce((s, w) => s + center(w, primaryAxis), 0) / b.length -
          a.reduce((s, w) => s + center(w, primaryAxis), 0) / a.length,
      )
    : clusters;

  return ordered.map((cluster) => {
    const wordsInOrder = [...cluster].sort((a, b) => center(a, secondaryAxis) - center(b, secondaryAxis));
    return {
      text: joinWords(wordsInOrder),
      confidence: avgConfidence(wordsInOrder),
      bbox: unionBbox(wordsInOrder),
      words: wordsInOrder,
      orientation: primaryAxis === 'x' ? 'vertical' : 'horizontal',
    };
  });
}
