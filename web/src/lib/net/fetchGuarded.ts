import { isIP } from 'node:net';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^\[::1\]$/,
];

export class BlockedUrlError extends Error {}

/**
 * Best-effort SSRF guard for the proxy/image-fetch endpoints: rejects
 * obviously-internal hostnames/IP literals before we let the server fetch
 * an attacker-supplied URL. This is not exhaustive (it does not resolve
 * DNS to catch rebinding to a private IP behind a public hostname), so it
 * should be treated as defense-in-depth, not a complete sandbox — see
 * docs/LIMITATIONS.md.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('URL inválida.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Apenas URLs http/https são suportadas.');
  }

  const hostname = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname))) {
    throw new BlockedUrlError('URLs apontando para redes internas não são permitidas.');
  }
  if (isIP(hostname) && PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname))) {
    throw new BlockedUrlError('URLs apontando para redes internas não são permitidas.');
  }

  return url;
}

export interface FetchGuardedOptions {
  maxBytes: number;
  timeoutMs: number;
  accept?: string;
}

export async function fetchGuarded(rawUrl: string, opts: FetchGuardedOptions): Promise<{ buffer: Buffer; contentType: string | null }> {
  const url = assertPublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A generic bot-style User-Agent gets blocked outright by a lot of
        // sites (this was previously "NoctisTranslator/0.1", which some
        // targets 404'd on sight). Presenting as an ordinary desktop
        // Chrome — the same thing any browser-based page-translate tool
        // does — avoids that class of false block. It does not, and
        // cannot, get past real bot-detection (Cloudflare/Akamai JS
        // challenges, TLS fingerprinting) — see docs/LIMITATIONS.md.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        ...(opts.accept ? { Accept: opts.accept } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream respondeu ${res.status}`);
    }
    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > opts.maxBytes) {
      throw new Error('Conteúdo excede o limite de tamanho permitido.');
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > opts.maxBytes) throw new Error('Conteúdo excede o limite de tamanho permitido.');
      return { buffer: buf, contentType: res.headers.get('content-type') };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > opts.maxBytes) throw new Error('Conteúdo excede o limite de tamanho permitido.');
        chunks.push(value);
      }
    }
    return { buffer: Buffer.concat(chunks), contentType: res.headers.get('content-type') };
  } finally {
    clearTimeout(timeout);
  }
}
