import { NotFoundException } from '@nestjs/common';
import { isAbsolute } from 'node:path';
import { Readable } from 'node:stream';

/** A single template file, ready to stream to the client. */
export interface TemplateFile {
  body: Readable;
  contentType: string;
  /** Set when the size is known up front (enables a Content-Length header). */
  contentLength?: number;
}

/**
 * Source of template files (`index.html` + assets/scripts). One implementation
 * per environment (disk in dev, the private Supabase bucket in prod); the active
 * instance is selected in {@link StorageModule}. Consumers depend on this
 * interface via the {@link TEMPLATE_STORAGE} token, never on a concrete class.
 */
export interface TemplateStorage {
  /**
   * Streams a single file by its bucket-relative key, e.g.
   * `templates/tic-tac-toe/index.html`. Throws {@link NotFoundException} when the
   * file is missing.
   */
  streamTemplateFile(key: string): Promise<TemplateFile>;

  /**
   * Writes (or overwrites) a single file at its bucket-relative key, e.g.
   * `templates/tic-tac-toe/index.html`. Used by the template-upload endpoint;
   * the key is normalised with {@link sanitizeKey} by each driver.
   */
  writeTemplateFile(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void>;
}

/** DI token for the active {@link TemplateStorage} implementation. */
export const TEMPLATE_STORAGE = Symbol('TEMPLATE_STORAGE');

/** Minimal extension -> content-type map for the asset types a game ships. */
const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
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
};

/**
 * Normalises a request path into a safe bucket key under `templates/`. Rejects
 * traversal (`..`), backslashes and absolute paths; defaults a bare template
 * folder to its `index.html`. Shared by every {@link TemplateStorage} so the
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
  // Expected shape: templates/<id>/<...>. Serve index.html for a bare folder.
  if (segments.length <= 2) segments.push('index.html');
  return segments.join('/');
}

export function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * `true` when the file's extension is one the platform knows how to serve (the
 * keys of {@link CONTENT_TYPES}). The upload endpoint rejects anything else so a
 * template only ever ships streamable web assets.
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return filename.includes('.') && ext in CONTENT_TYPES;
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
