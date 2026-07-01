import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../database/entities/game.entity';
import { GameTemplate } from '../database/entities/game-template.entity';

/** Request body for `POST /games`. */
export interface CreateGameBody {
  templateId: string;
  title: string;
  /** Optional; omitted/empty is treated as `{}`. */
  config?: Record<string, unknown>;
}

/** A game plus everything the frontend needs to load and render it. */
export interface GameView {
  id: string;
  title: string;
  templateId: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  /** Template entry point to load (HTML that boots the game). */
  entryUrl: string;
  /** Base URL the template's relative assets resolve against. */
  assetsBaseUrl: string;
  /** Template metadata, included by `GET /games/:id`. */
  template?: Pick<GameTemplate, 'id' | 'path' | 'config'>;
}

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly games: Repository<Game>,
    @InjectRepository(GameTemplate)
    private readonly templates: Repository<GameTemplate>,
  ) {}

  /**
   * Creates a game instance of an existing template. A game owns no files — it
   * reuses the template's files and supplies content/settings via `config`.
   */
  async createGame(body: CreateGameBody): Promise<GameView> {
    const templateId = body?.templateId?.trim();
    const title = body?.title?.trim();
    if (!templateId) {
      throw new BadRequestException('`templateId` is required');
    }
    if (!title) {
      throw new BadRequestException('`title` is required');
    }

    const template = await this.templates.findOneBy({ id: templateId });
    if (!template) {
      throw new NotFoundException(`Template not found: ${templateId}`);
    }

    const config = this.normalizeConfig(body.config);
    const game = await this.games.save(
      this.games.create({ templateId, title, config }),
    );
    return this.toGameView(game);
  }

  /** Lists games, newest first. */
  async listGames(): Promise<GameView[]> {
    const games = await this.games.find({ order: { createdAt: 'DESC' } });
    return games.map((game) => this.toGameView(game));
  }

  /** Returns one game with its template metadata; 404 when it does not exist. */
  async getGame(id: string): Promise<GameView> {
    const game = await this.games.findOne({
      where: { id },
      relations: { template: true },
    });
    if (!game) {
      throw new NotFoundException(`Game not found: ${id}`);
    }
    return this.toGameView(game);
  }

  /** Missing/null config becomes `{}`; anything but a plain object is rejected. */
  private normalizeConfig(config: unknown): Record<string, unknown> {
    if (config == null) return {};
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('`config` must be a JSON object');
    }
    return config as Record<string, unknown>;
  }

  /** Shapes a {@link Game} into the API response, deriving asset URLs. */
  private toGameView(game: Game): GameView {
    const assetsBaseUrl = `/templates/${game.templateId}`;
    return {
      id: game.id,
      title: game.title,
      templateId: game.templateId,
      config: game.config,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      entryUrl: `${assetsBaseUrl}/index.html`,
      assetsBaseUrl,
      ...(game.template && {
        template: {
          id: game.template.id,
          path: game.template.path,
          config: game.template.config,
        },
      }),
    };
  }
}
