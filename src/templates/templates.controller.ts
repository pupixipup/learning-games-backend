import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { GameTemplate } from '../database/entities/game-template.entity';
import { TEMPLATE_STORAGE } from '../storage/template-storage';
import type { TemplateStorage } from '../storage/template-storage';
import { TemplatesService } from './templates.service';
import type { UploadTemplateResult } from './templates.service';

const MAX_FILES = 50;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

@Controller('templates')
export class TemplatesController {
  constructor(
    @Inject(TEMPLATE_STORAGE) private readonly storage: TemplateStorage,
    private readonly service: TemplatesService,
  ) {}

  /**
   * Uploads a new game template: a `name` plus multipart `files` containing a
   * mandatory `index.html` and optional JS/CSS/asset files.
   */
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
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

  @Get(':id/*path')
  async serve(
    @Param('id') id: string,
    @Param('path') rest: string | string[],
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const tail = Array.isArray(rest) ? rest.join('/') : (rest ?? '');
    const file = await this.storage.streamTemplateFile(
      `templates/${id}/${tail}`,
    );

    res.setHeader('Content-Type', file.contentType);
    if (file.contentLength != null) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    file.body.pipe(res);
  }
}
