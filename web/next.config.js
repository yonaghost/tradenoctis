/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tesseract.js / sharp / @napi-rs/canvas ship native or worker assets that
  // should not be bundled by webpack — they run only in the Node.js server
  // runtime (API routes), never in the browser bundle.
  serverExternalPackages: ['tesseract.js', 'sharp', '@napi-rs/canvas', 'playwright-core', '@sparticuz/chromium'],
  // @sparticuz/chromium ships its Chromium binary as compressed .br files
  // under bin/, not as JS — Next's automatic output-file-tracing (used to
  // decide what to bundle into each Vercel serverless function) can't see
  // those from a dynamic `import()`, so without this the function deploys
  // without the binary and `executablePath()` fails at runtime on Vercel.
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
};

module.exports = nextConfig;
