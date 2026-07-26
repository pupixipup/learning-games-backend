import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  contentTypeFor,
  sanitizeKey,
  TemplateFile,
  TemplateStorage,
  WriteOptions,
} from './template-storage';
import {
  S3Client,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { NodeJsClient } from '@smithy/types';

/**
 * Prod driver: downloads template files from the private `templates` bucket with the
 * service-role key. The bucket is never exposed to the browser directly — the
 * backend proxies the bytes so a template's relative asset paths keep working
 * without per-object signed URLs.
 */
export class SupabaseTemplateStorage implements TemplateStorage {
  private readonly logger = new Logger(SupabaseTemplateStorage.name);
  private readonly bucket = process.env.GAMES_BUCKET ?? 'templates';
  private readonly client?: NodeJsClient<S3Client>;

  constructor() {
    this.client = new S3Client({
      region: 'eu-central-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }

  async streamTemplateFile(key: string): Promise<TemplateFile> {
    const safeKey = sanitizeKey(key);
    if (!this.client) {
      throw new NotFoundException('Supabase storage is not configured');
    }

    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
        }),
      );

      if (!result.Body) {
        throw new NotFoundException();
      }

      return {
        body: result.Body,
        contentType: contentTypeFor(safeKey),
        contentLength: result.ContentLength
          ? Number(result.ContentLength)
          : undefined,
      };
    } catch (err) {
      if (isNotFound(err)) {
        throw new NotFoundException(`Template file not found: ${key}`);
      }

      throw err;
    }
  }

  async writeTemplateFile(
    key: string,
    body: Buffer,
    options?: WriteOptions,
  ): Promise<void> {
    const safeKey = sanitizeKey(key);
    if (!this.client) {
      throw new InternalServerErrorException('storage is not configured');
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: body,
          ContentType: options?.contentType ?? contentTypeFor(safeKey),
          // Correct metadata for a pre-compressed sidecar, so the object is still
          // right if the bucket is ever served directly or through a CDN. The
          // response header does not depend on this being stored.
          ...(options?.contentEncoding && {
            ContentEncoding: options.contentEncoding,
          }),
        }),
      );
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(
        `Failed to store template file: ${key}`,
      );
    }
  }
}

/**
 * `true` for every way the S3-compatible endpoint can report a missing object.
 * The typed `NoSuchKey` error alone is not enough: the serve path deliberately
 * requests sidecars that may not exist and falls back on {@link NotFoundException},
 * so a bare 404 that surfaced as some other error would turn every template
 * uploaded before pre-compression into a 500 instead of a graceful fallback.
 */
function isNotFound(err: unknown): boolean {
  if (err instanceof NoSuchKey) return true;
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
