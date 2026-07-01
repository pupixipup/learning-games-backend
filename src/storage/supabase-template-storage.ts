import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'node:stream';
import {
  contentTypeFor,
  sanitizeKey,
  TemplateFile,
  TemplateStorage,
} from './template-storage';

/**
 * Prod driver: downloads template files from the private `templates` bucket with the
 * service-role key. The bucket is never exposed to the browser directly — the
 * backend proxies the bytes so a template's relative asset paths keep working
 * without per-object signed URLs.
 */
export class SupabaseTemplateStorage implements TemplateStorage {
  private readonly logger = new Logger(SupabaseTemplateStorage.name);
  private readonly bucket = process.env.GAMES_BUCKET ?? 'templates';
  private readonly client?: ReturnType<typeof createClient>;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      this.logger.error('requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    } else {
      this.client = createClient(url, key, { auth: { persistSession: false } });
    }
  }

  async streamTemplateFile(key: string): Promise<TemplateFile> {
    const safeKey = sanitizeKey(key);
    if (!this.client) {
      throw new NotFoundException('Supabase storage is not configured');
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(safeKey);
    if (error || !data) {
      throw new NotFoundException(`Template file not found: ${key}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      body: Readable.from(buffer),
      // Prefer the blob's own type, fall back to the extension map.
      contentType:
        data.type && data.type !== 'application/octet-stream'
          ? data.type
          : contentTypeFor(safeKey),
      contentLength: buffer.byteLength,
    };
  }

  async writeTemplateFile(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    const safeKey = sanitizeKey(key);
    if (!this.client) {
      throw new InternalServerErrorException(
        'Supabase storage is not configured',
      );
    }

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(safeKey, body, {
        contentType: contentType ?? contentTypeFor(safeKey),
        upsert: true,
      });
    if (error) {
      this.logger.error(`Failed to upload ${safeKey}: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to store template file: ${key}`,
      );
    }
  }
}
