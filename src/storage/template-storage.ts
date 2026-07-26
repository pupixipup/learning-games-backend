import { NotFoundException } from '@nestjs/common';
import { isAbsolute } from 'node:path';
import { Readable } from 'node:stream';
import { SIDECAR_SUFFIX_RE } from './content-encoding';

/** A single template file, ready to stream to the client. */
export interface TemplateFile {
  body: Readable;
  contentType: string;
  /** Set when the size is known up front (enables a Content-Length header). */
  contentLength?: number;
}

/**
 * Storage metadata for a write. Deliberately absent from {@link TemplateFile}: the
 * local driver cannot persist it (plain files carry no metadata) and Supabase may
 * not echo it back, so the serve path derives the response headers from the key
 * and the variant it chose rather than trusting what storage returns.
 */
export interface WriteOptions {
  contentType?: string;
  contentEncoding?: 'br';
}

/**
 * Source of template files (`index.js` + assets). One implementation
 * per environment (disk in dev, the private Supabase bucket in prod); the active
 * instance is selected in {@link StorageModule}. Consumers depend on this
 * interface via the {@link TEMPLATE_STORAGE} token, never on a concrete class.
 */
export interface TemplateStorage {
  /**
   * Streams a single file by its bucket-relative key, e.g.
   * `templates/tic-tac-toe/index.js`. Throws {@link NotFoundException} when the
   * file is missing.
   */
  streamTemplateFile(key: string): Promise<TemplateFile>;

  /**
   * Writes (or overwrites) a single file at its bucket-relative key, e.g.
   * `templates/tic-tac-toe/index.js`. Used by the template-upload endpoint;
   * the key is normalised with {@link sanitizeKey} by each driver.
   *
   * Compressible assets are stored twice: the raw bytes at the canonical key,
   * plus a `<key>.br` sidecar. The sidecar is written unconditionally (see
   * {@link isCompressibleKey}) so the serve path can infer that it exists from
   * the extension alone, without probing storage.
   */
  writeTemplateFile(
    key: string,
    body: Buffer,
    options?: WriteOptions,
  ): Promise<void>;
}

/** DI token for the active {@link TemplateStorage} implementation. */
export const TEMPLATE_STORAGE = Symbol('TEMPLATE_STORAGE');

/**
 * Minimal extension -> content-type map for the asset types a game ships.
 *
 * WARNING: never add `gz` or `br` here. This map doubles as the upload allowlist
 * (see {@link isAllowedExtension}), so adding them would let a client upload a
 * file that shadows a server-generated sidecar and serve different bytes to
 * compressed and uncompressed clients for the same URL.
 */
const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  wasm: 'application/wasm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  // Godot resource pack (shipped alongside index.js + index.wasm by a web
  // export). No registered media type exists, and octet-stream is what Godot's
  // own loader fetches it as.
  pck: 'application/octet-stream',
};

/**
 * Normalises a request path into a safe bucket key under `templates/`. Rejects
 * traversal (`..`), backslashes and absolute paths; defaults a bare template
 * folder to its `index.js`. Shared by every {@link TemplateStorage} so the
 * guarantees hold regardless of which driver is active.
 */
export function sanitizeKey(key: string): string {
  const cleaned = key
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '');
  const segments = cleaned.split('/').filter((s) => s.length > 0 && s !== '.');
  if (segments.some((s) => s === '..') || isAbsolute(cleaned)) {
    throw new NotFoundException(`Invalid path: ${key}`);
  }
  // Expected shape: templates/<id>/<...>. Serve index.js for a bare folder.
  if (segments.length <= 2) segments.push('index.js');
  return segments.join('/');
}

/** Lowercased extension of a filename or key, without the dot. */
function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Content type to serve a key as. A trailing sidecar suffix is stripped first, so
 * `index.js.br` reports `text/javascript` — the type of the bytes once the client
 * has decoded them, which is what `Content-Encoding` requires.
 */
export function contentTypeFor(key: string): string {
  const canonical = key.replace(SIDECAR_SUFFIX_RE, '');
  return CONTENT_TYPES[extensionOf(canonical)] ?? 'application/octet-stream';
}

/**
 * `true` when the file's extension is one the platform knows how to serve (the
 * keys of {@link CONTENT_TYPES}). The upload endpoint rejects anything else so a
 * template only ever ships streamable web assets.
 */
export function isAllowedExtension(filename: string): boolean {
  return filename.includes('.') && extensionOf(filename) in CONTENT_TYPES;
}

/**
 * Extensions worth pre-compressing. The already-compressed formats (png, webp,
 * mp3, woff2, ...) are excluded: re-compressing them gains almost nothing and
 * costs CPU on every upload.
 */
const COMPRESSIBLE_EXTENSIONS = new Set([
  'js',
  'mjs',
  'css',
  'json',
  'map',
  'txt',
  // A Godot .pck is an uncompressed container, so it compresses even though the
  // textures and audio inside it are already compressed. Godot's web export docs
  // recommend serving it pre-compressed, same as .wasm.
  'pck',
  'svg',
  'wasm',
]);

/**
 * `true` when a key has `.br`/`.gz` sidecars, i.e. its response can vary by
 * `Accept-Encoding`. This is the single source of truth for both halves of the
 * feature: the upload path writes sidecars exactly when it holds, and the serve
 * path fetches one exactly when it holds — so neither side ever has to ask
 * storage whether a sidecar is there.
 */
export function isCompressibleKey(key: string): boolean {
  return COMPRESSIBLE_EXTENSIONS.has(extensionOf(key));
}

/**
 * Turns a human-readable template name into its slug `id`/folder name, e.g.
 * `Tic Tac Toe!` -> `tic-tac-toe`. Returns `''` when nothing usable remains, so
 * callers can reject empty names.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
