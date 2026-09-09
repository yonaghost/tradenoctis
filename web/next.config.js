/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tesseract.js / sharp / @napi-rs/canvas ship native or worker assets that
  // should not be bundled by webpack — they run only in the Node.js server
  // runtime (API routes), never in the browser bundle.
  serverExternalPackages: ['tesseract.js', 'sharp', '@napi-rs/canvas'],
};

module.exports = nextConfig;
