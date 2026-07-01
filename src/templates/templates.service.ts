import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameTemplate } from '../database/entities/game-template.entity';
import {
  isAllowedExtension,
  slugify,
  TEMPLATE_STORAGE,
} from '../storage/template-storage';
import type { TemplateStorage } from '../storage/template-storage';

/** What `POST /templates` returns once a template has been stored. */
export interface UploadTemplateResult {
  id: string;
  path: string;
  files: string[];
}

const INDEX_FILE = 'index.html';

@Injectable()
export class TemplatesService {
  constructor(
    @Inject(TEMPLATE_STORAGE) private readonly storage: TemplateStorage,
    @InjectRepository(GameTemplate)
    private readonly templates: Repository<GameTemplate>,
  ) {}

  /** Lists every registered template (file contents are served separately). */
  listTemplates(): Promise<GameTemplate[]> {
    return this.templates.find();
  }

  /** Returns one template's metadata; throws 404 when it does not exist. */
  async getTemplate(id: string): Promise<GameTemplate> {
    const template = await this.templates.findOneBy({ id });
    if (!template) {
      throw new NotFoundException(`Template not found: ${id}`);
    }
    return template;
  }

  /**
   * Stores an uploaded game template: writes its files under `templates/<slug>/`
   * and registers a {@link GameTemplate} row. Validates the name, the presence of
   * a root-level `index.html`, and that every file is a known web asset.
   */
  async createTemplate(
    name: string,
    files: Express.Multer.File[],
    config?: string,
  ): Promise<UploadTemplateResult> {
    const slug = slugify(name ?? '');
    if (!slug) {
      throw new BadRequestException(
        '`name` is required and must contain letters or digits',
      );
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('At least `index.html` must be uploaded');
    }

    const parsedConfig = this.parseConfig(config);

    // Compute a safe relative key per file and validate it.
    const entries = files.map((file) => ({
      file,
      relKey: this.relKeyFor(file.originalname),
    }));

    const indexCount = entries.filter((e) => e.relKey === INDEX_FILE).length;
    if (indexCount === 0) {
      throw new BadRequestException(
        'A root-level `index.html` file is required',
      );
    }
    if (indexCount > 1) {
      throw new BadRequestException('Only one `index.html` may be uploaded');
    }

    for (const { relKey } of entries) {
      if (!isAllowedExtension(relKey)) {
        throw new BadRequestException(`Unsupported file type: ${relKey}`);
      }
    }

    if (await this.templates.findOneBy({ id: slug })) {
      throw new ConflictException(`A template named '${slug}' already exists`);
    }

    const path = `templates/${slug}`;
    for (const { file, relKey } of entries) {
      await this.storage.writeTemplateFile(
        `${path}/${relKey}`,
        file.buffer,
        file.mimetype,
      );
    }

    await this.templates.save(
      this.templates.create({ id: slug, path, config: parsedConfig }),
    );

    return { id: slug, path, files: entries.map((e) => e.relKey) };
  }

  /**
   * Normalises a multipart `originalname` into a safe relative key (basename, or a
   * relative subpath like `assets/app.js` when the client sent one). Rejects path
   * traversal and absolute paths.
   */
  private relKeyFor(originalname: string): string {
    const cleaned = (originalname ?? '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\//, '');
    const segments = cleaned
      .split('/')
      .filter((s) => s.length > 0 && s !== '.');
    if (segments.length === 0 || segments.some((s) => s === '..')) {
      throw new BadRequestException(`Invalid file name: ${originalname}`);
    }
    return segments.join('/');
  }

  /** Parses the optional `config` JSON string into a plain object (or null). */
  private parseConfig(config?: string): Record<string, unknown> | null {
    if (config == null || config.trim() === '') return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(config);
    } catch {
      throw new BadRequestException('`config` must be valid JSON');
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new BadRequestException('`config` must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  }
}
