import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  contentTypeFor,
  sanitizeKey,
  TemplateFile,
  TemplateStorage,
} from './template-storage';
import { S3Client, GetObjectCommand, NoSuchKey, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeJsClient } from "@smithy/types";

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
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
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
      )

      if (!result.Body) {
        throw new NotFoundException()
      }

      return {
        body: result.Body,
        contentType:
          result.ContentType ?? contentTypeFor(safeKey),
        contentLength: result.ContentLength
          ? Number(result.ContentLength)
          : undefined,
      }
    } catch (err) {
      if (err instanceof NoSuchKey) {
        throw new NotFoundException(`Template file not found: ${key}`)
      }

      throw err
    }
  }

  async writeTemplateFile(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    const safeKey = sanitizeKey(key);
    if (!this.client) {
      throw new InternalServerErrorException(
        'storage is not configured',
      );
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: body,
          ContentType: contentType ?? contentTypeFor(safeKey),
        }),
      )
    } catch (err) {
      this.logger.error(err)
      throw new InternalServerErrorException(
        `Failed to store template file: ${key}`,
      )
    }
  }
}
