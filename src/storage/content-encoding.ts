import { constants, brotliCompress } from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompressAsync = promisify(brotliCompress);

/** An HTTP content coding this platform can serve. */
export type ContentCoding = 'br' | 'identity';

/** File suffix a pre-compressed sidecar is stored under. */
export const SIDECAR_SUFFIX = '.br';

/**
 * Matches a trailing sidecar suffix. Deliberately covers `.gz` as well as `.br`:
 * only brotli is generated, but this also guards the upload surface, and a client
 * should not be able to plant either kind of variant.
 */
export const SIDECAR_SUFFIX_RE = /\.(br|gz)$/i;

/**
 * Our preference when the client is indifferent (equal `q`). Only brotli is
 * stored, so gzip-only clients fall through to identity — safe here because
 * template assets are ES modules loaded by browsers, and every browser that can
 * load an ES module also supports brotli.
 */
const PREFERENCE: readonly ContentCoding[] = ['br', 'identity'];

/**
 * The sidecar key for a canonical key, e.g.
 * `templates/x/index.js` -> `templates/x/index.js.br`. The canonical key must
 * already be normalised (see `sanitizeKey`) so it ends in a filename.
 */
export function sidecarKeyFor(canonicalKey: string): string {
  return `${canonicalKey}${SIDECAR_SUFFIX}`;
}

/**
 * Picks the best coding for an `Accept-Encoding` header, honouring `q` values.
 * Codings we do not store (`gzip`, `zstd`, `deflate`) are ignored, so a client
 * that cannot take brotli gets the raw file.
 */
export function negotiateEncoding(
  header: string | string[] | undefined,
): ContentCoding {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw) return 'identity';

  const weights = new Map<string, number>();
  let lowestQ = 1;
  for (const part of raw.split(',')) {
    const [tokenRaw, ...params] = part.split(';');
    const token = tokenRaw.trim().toLowerCase();
    if (!token) continue;
    let q = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match) {
        const parsed = Number.parseFloat(match[1]);
        q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1;
      }
    }
    weights.set(token, q);
    lowestQ = Math.min(lowestQ, q);
  }

  const star = weights.get('*');
  // identity is acceptable unless explicitly refused, but an unlisted identity
  // ranks at the lowest `q` in the header rather than at 1 — otherwise a client
  // sending `br;q=0.9` would get uncompressed bytes despite asking for brotli.
  // This is what `negotiator` does, so it matches what clients expect from Express.
  const weightOf = (coding: ContentCoding): number =>
    weights.get(coding) ?? star ?? (coding === 'identity' ? lowestQ : 0);

  let best: ContentCoding = 'identity';
  let bestWeight = 0;
  for (const coding of PREFERENCE) {
    const weight = weightOf(coding);
    // Strict `>` keeps PREFERENCE order for `q` ties, so `br` wins over identity.
    if (weight > bestWeight) {
      best = coding;
      bestWeight = weight;
    }
  }

  // A client that refused every coding should get a 406, but failing an asset
  // over its encoding is never worth it — send identity and let it cope.
  return bestWeight > 0 ? best : 'identity';
}

/**
 * brotli quality. q11 is ~29x slower than q9 for ~12% smaller output (measured
 * on a 9 MB bundle: 24.7 s vs 0.84 s), and uploads are interactive requests
 * sharing the libuv threadpool — so q9 is the default. Raise it only where slow
 * uploads are acceptable.
 */
const BROTLI_QUALITY = clampQuality(process.env.TEMPLATE_BROTLI_QUALITY, 9);

function clampQuality(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), constants.BROTLI_MAX_QUALITY);
}

/**
 * Compresses one asset for its sidecar. Async, so the work happens on the libuv
 * threadpool rather than blocking the event loop.
 */
export function compressAsset(body: Buffer): Promise<Buffer> {
  return brotliCompressAsync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
      // BROTLI_PARAM_LGWIN stays at its default 22. Large-window brotli is not a
      // valid HTTP content coding — browsers reject the stream outright.
    },
  });
}
