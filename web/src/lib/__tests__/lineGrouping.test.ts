import { describe, expect, it } from 'vitest';
import { groupWordsIntoLines } from '../providers/ocr/lineGrouping';
import { OCRWord } from '../providers/ocr/OCRProvider';

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 90): OCRWord {
  return { text, confidence, bbox: { x0, y0, x1, y1 } };
}

describe('groupWordsIntoLines (horizontal)', () => {
  it('groups words on the same row and orders them left-to-right', () => {
    const words = [
      word('world', 60, 10, 100, 30),
      word('hello', 10, 12, 55, 32),
      word('line2', 10, 60, 55, 80),
    ];
    const lines = groupWordsIntoLines(words, 'horizontal');
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('hello world');
    expect(lines[1].text).toBe('line2');
  });

  it('joins CJK words without inserting spaces', () => {
    const words = [word('新しい', 10, 10, 50, 30), word('始まり', 55, 10, 95, 30)];
    const lines = groupWordsIntoLines(words, 'horizontal');
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('新しい始まり');
  });

  it('computes a union bounding box and average confidence per line', () => {
    const words = [word('a', 0, 0, 10, 10, 80), word('b', 12, 2, 22, 12, 60)];
    const [line] = groupWordsIntoLines(words, 'horizontal');
    expect(line.bbox).toEqual({ x0: 0, y0: 0, x1: 22, y1: 12 });
    expect(line.confidence).toBe(70);
  });
});

describe('groupWordsIntoLines (vertical)', () => {
  it('orders columns right-to-left and words top-to-bottom within a column', () => {
    const words = [
      word('下', 100, 40, 120, 60), // right column, bottom
      word('上', 100, 10, 120, 30), // right column, top
      word('左', 10, 10, 30, 30), // left column
    ];
    const lines = groupWordsIntoLines(words, 'vertical');
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('上下'); // rightmost column first, top-to-bottom
    expect(lines[1].text).toBe('左');
  });
});

describe('groupWordsIntoLines edge cases', () => {
  it('returns an empty array for no words', () => {
    expect(groupWordsIntoLines([], 'horizontal')).toEqual([]);
  });
});
