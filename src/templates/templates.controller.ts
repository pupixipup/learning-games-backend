import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { GameTemplate } from '../database/entities/game-template.entity';
import {
  isCompressibleKey,
  sanitizeKey,
  TEMPLATE_STORAGE,
} from '../storage/template-storage';
import type {
  TemplateFile,
  TemplateStorage,
} from '../storage/template-storage';
import { negotiateEncoding, sidecarKeyFor } from '../storage/content-encoding';
import type { ContentCoding } from '../storage/content-encoding';
import { TemplatesService } from './templates.service';
import type { UploadTemplateResult } from './templates.service';

const MAX_FILES = 50;
const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60 MB per file

@Controller('templates')
export class TemplatesController {
  constructor(
    @Inject(TEMPLATE_STORAGE) private readonly storage: TemplateStorage,
    private readonly service: TemplatesService,
  ) {}

  /**
   * Uploads a new game template: a `name` plus multipart `files` containing a
   * mandatory root-level `index.js` and optional JS/CSS/asset files. A file may
   * sit in a subfolder by sending its relative path as the multipart filename,
   * e.g. `assets/app.css`.
   */
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
      // Without this multer reduces every `originalname` to its basename, which
      // silently flattens an uploaded folder tree into one directory. The client
      // path is untrusted, so `relKeyFor` validates it before it becomes a key.
      preservePath: true,
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('name') name: string,
    @Body('config') config?: string,
  ): Promise<UploadTemplateResult> {
    return this.service.createTemplate(name, files, config);
  }

  /** Lists all registered templates (metadata only). */
  @Get()
  list(): Promise<GameTemplate[]> {
    return this.service.listTemplates();
  }

  /** Returns one template's metadata; 404 if it does not exist. */
  @Get(':id')
  getOne(@Param('id') id: string): Promise<GameTemplate> {
    return this.service.getTemplate(id);
  }

  /**
   * Streams one file out of a template, serving the pre-compressed `.br`/`.gz`
   * sidecar the client can accept. Nothing else in the stack compresses these
   * responses — the origin is not behind a compressing edge — so this is where a
   * game bundle stops going out raw.
   */
  @Get(':id/*path')
  async serve(
    @Param('id') id: string,
    @Param('path') rest: string | string[],
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const tail = Array.isArray(rest) ? rest.join('/') : (rest ?? '');

    // Normalise first so the key provably ends in a filename before a sidecar
    // suffix is appended: `templates/x` would otherwise become `templates/x.br`,
    // which sanitizeKey then reads as a folder and turns into
    // `templates/x.br/index.js`. sanitizeKey is idempotent, so the driver
    // normalising it again below is a no-op.
    const key = sanitizeKey(`templates/${id}/${tail}`);

    const compressible = isCompressibleKey(key);
    const wanted: ContentCoding = compressible
      ? negotiateEncoding(req.headers['accept-encoding'])
      : 'identity';

    // Only compressible keys have variants to vary by; saying so for images and
    // fonts would fragment their caches for nothing.
    if (compressible) res.setHeader('Vary', 'Accept-Encoding');

    let file: TemplateFile | undefined;
    let encoding: ContentCoding = 'identity';

    if (wanted !== 'identity') {
      try {
        file = await this.storage.streamTemplateFile(sidecarKeyFor(key));
        encoding = wanted;
      } catch (err) {
        // Templates uploaded before pre-compression have no sidecar, so fall
        // through to the raw file. Anything other than a 404 propagates — a
        // failing bucket should surface as an error, not silently start shipping
        // several times the bytes.
        if (!(err instanceof NotFoundException)) throw err;
      }
    }

    // A 404 from the canonical key is a genuinely missing asset; let it through.
    file ??= await this.storage.streamTemplateFile(key);

    // The decoded type: contentTypeFor strips the sidecar suffix, so a `.br`
    // variant still reports `text/javascript`.
    res.setHeader('Content-Type', file.contentType);
    if (encoding !== 'identity') res.setHeader('Content-Encoding', encoding);
    if (file.contentLength != null) {
      // The variant's own size — the number of bytes actually on the wire.
      res.setHeader('Content-Length', String(file.contentLength));
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    file.body.pipe(res);
  }
}
