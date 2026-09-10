import { chromium } from 'playwright-core';

export interface RenderPdfOptions {
  /** Absolute URL to the already-rewritten `/api/proxy` document to print. */
  pageUrl: string;
  /** Milliseconds to wait for the translation runtime to finish before printing anyway. */
  idleTimeoutMs?: number;
}

interface LaunchTarget {
  executablePath: string | undefined;
  args: string[];
  /** Set when @sparticuz/chromium was attempted and failed, for diagnosability if the final launch also fails. */
  sparticuzError?: string;
}

/**
 * Picks how to launch Chromium:
 *
 *  1. `PLAYWRIGHT_CHROMIUM_PATH` — an explicit binary path (self-hosted /
 *     container deploys where you ran `npx playwright install chromium`).
 *  2. `@sparticuz/chromium` — a Chromium build packaged specifically for
 *     serverless platforms (Vercel/AWS Lambda functions can't `apt install`
 *     a browser, and the read-only filesystem means "install Chromium on
 *     first request" isn't an option either). This is the standard,
 *     widely-used fix for "Executable does not exist" errors on Vercel —
 *     not a workaround invented for this project.
 *  3. Otherwise fall back to Playwright's own bundled-browser resolution
 *     (works when the full `playwright` package installed its browsers at
 *     build time).
 */
async function resolveLaunchTarget(): Promise<LaunchTarget> {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: [] };
  }

  try {
    const sparticuzChromium = (await import('@sparticuz/chromium')).default;
    return { executablePath: await sparticuzChromium.executablePath(), args: sparticuzChromium.args };
  } catch (err) {
    // Not installed, or failed to extract (e.g. running outside a
    // serverless sandbox) — fall through to Playwright's own resolution.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[renderPdf] @sparticuz/chromium executablePath() failed, falling back:', message);
    return { executablePath: undefined, args: [], sparticuzError: message };
  }
}

/**
 * Renders the translated page to a PDF using headless Chromium via
 * Playwright. See resolveLaunchTarget() for how the Chromium binary itself
 * is located — this is a real environment requirement, not something
 * Noctis can paper over. See docs/LIMITATIONS.md.
 */
export async function renderTranslatedPagePdf({ pageUrl, idleTimeoutMs = 20_000 }: RenderPdfOptions): Promise<Buffer> {
  const { executablePath, args, sparticuzError } = await resolveLaunchTarget();

  let browser;
  try {
    browser = await chromium.launch({ executablePath, args, headless: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      sparticuzError
        ? `Chromium launch failed (@sparticuz/chromium also failed: ${sparticuzError}): ${message}`
        : message,
    );
  }

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
