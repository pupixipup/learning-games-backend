import { NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import {
  contentTypeFor,
  sanitizeKey,
  TemplateFile,
  TemplateStorage,
} from './template-storage';

/**
 * Dev driver: serves template files from the `GAMES_BUCKET` folder on disk
 * (default `templates`, holding `<id>/index.html` folders).
 */
export class LocalTemplateStorage implements TemplateStorage {
  // Bucket name doubles as the on-disk root folder. It must equal the fixed
  // `templates/` prefix every storage key carries (see sanitizeKey), so
  // GAMES_BUCKET is always `templates`.
  private readonly bucket = process.env.GAMES_BUCKET || 'templates';
  private readonly templatesRoot = resolve(this.bucket);

  /**
   * Maps a bucket-relative key onto an absolute path under {@link templatesRoot},
   * throwing {@link NotFoundException} if it would escape the root. Shared by the
   * read and write paths so both honour the same boundary.
   */
  private resolveSafe(key: string): string {
    const safeKey = sanitizeKey(key);
    // `safeKey` starts with the `<bucket>/` prefix; strip it and map the
    // remainder under templatesRoot.
    const relative = safeKey.slice(`${this.bucket}/`.length);
    const absolute = normalize(join(this.templatesRoot, relative));
    if (
      absolute !== this.templatesRoot &&
      !absolute.startsWith(this.templatesRoot + sep)
    ) {
      throw new NotFoundException(`Template file not found: ${key}`);
    }
    return absolute;
  }

  async streamTemplateFile(key: string): Promise<TemplateFile> {
    const absolute = this.resolveSafe(key);

    let size: number;
    try {
      const info = await stat(absolute);
      if (!info.isFile()) throw new Error('not a file');
      size = info.size;
    } catch {
      throw new NotFoundException(`Template file not found: ${key}`);
    }

    return {
      body: createReadStream(absolute),
      contentType: contentTypeFor(key),
      contentLength: size,
    };
  }

  async writeTemplateFile(key: string, body: Buffer): Promise<void> {
    const absolute = this.resolveSafe(key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body);
  }
}
