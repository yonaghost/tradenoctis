import { describe, expect, it } from 'vitest';
import { relativeLuminance, contrastColorFor, medianColor, colorDistance } from '../image/colorUtils';

describe('colorUtils', () => {
  it('computes higher luminance for white than black', () => {
    expect(relativeLuminance([255, 255, 255, 255])).toBeGreaterThan(relativeLuminance([0, 0, 0, 255]));
  });

  it('picks black text on a light background and white text on a dark one', () => {
    expect(contrastColorFor([250, 250, 250, 255])).toEqual([0, 0, 0, 255]);
    expect(contrastColorFor([10, 10, 10, 255])).toEqual([255, 255, 255, 255]);
  });

  it('computes a per-channel median that is robust to a single outlier', () => {
    const samples: [number, number, number, number][] = [
      [10, 10, 10, 255],
      [12, 12, 12, 255],
      [255, 0, 0, 255], // outlier
    ];
    const median = medianColor(samples);
    expect(median[0]).toBe(12);
  });

  it('measures euclidean distance between two colors', () => {
    expect(colorDistance([0, 0, 0, 255], [0, 0, 0, 255])).toBe(0);
    expect(colorDistance([0, 0, 0, 255], [3, 4, 0, 255])).toBe(5);
  });
});
