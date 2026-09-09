export type RGBA = [number, number, number, number];

export function relativeLuminance([r, g, b]: RGBA): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function toCssColor([r, g, b]: RGBA): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function contrastColorFor([r, g, b]: RGBA): RGBA {
  return relativeLuminance([r, g, b, 255]) > 140 ? [0, 0, 0, 255] : [255, 255, 255, 255];
}

export function medianColor(samples: RGBA[]): RGBA {
  if (samples.length === 0) return [128, 128, 128, 255];
  const channel = (i: number) => {
    const values = samples.map((s) => s[i]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return [channel(0), channel(1), channel(2), channel(3)];
}

export function colorDistance(a: RGBA, b: RGBA): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
