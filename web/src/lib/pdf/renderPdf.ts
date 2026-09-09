import { chromium } from 'playwright-core';

export interface RenderPdfOptions {
  /** Absolute URL to the already-rewritten `/api/proxy` document to print. */
  pageUrl: string;
  /** Milliseconds to wait for the translation runtime to finish before printing anyway. */
  idleTimeoutMs?: number;
}

/**
 * Renders the translated page to a PDF using headless Chromium via
 * Playwright. Requires a Chromium executable reachable by the server:
 *
 *  - set PLAYWRIGHT_CHROMIUM_PATH to an explicit binary path, or
 *  - install the full `playwright` package and run
 *    `npx playwright install chromium` during your build/deploy step.
 *
 * This is a real requirement of headless-Chromium PDF rendering, not
 * something Noctis can paper over: some constrained serverless platforms
 * don't allow bundling a Chromium binary at all. See docs/LIMITATIONS.md.
 */
export async function renderTranslatedPagePdf({ pageUrl, idleTimeoutMs = 20_000 }: RenderPdfOptions): Promise<Buffer> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ executablePath, headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Trigger lazy-loaded / IntersectionObserver-gated images by walking the
    // whole document height before waiting for the translation runtime.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      window.scrollTo(0, 0);
    });

    try {
      await page.waitForFunction(
        () => (window as unknown as { __noctisIsIdle?: () => boolean }).__noctisIsIdle?.() === true,
        { timeout: idleTimeoutMs },
      );
    } catch {
      // Best-effort: print whatever has been translated so far rather than
      // failing the whole export because a few images were still queued.
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
