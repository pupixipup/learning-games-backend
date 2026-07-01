import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Game } from './game.entity';

/**
 * Catalog of reusable game templates. A template owns the actual files
 * (`index.html` + assets/scripts); games created from it reuse those files and
 * only supply content/settings via their own `config`.
 *
 * The `id` is a human-readable slug that matches the template's folder under the
 * `templates` storage bucket (e.g. `tic-tac-toe` -> `templates/tic-tac-toe/`).
 */
@Entity('game_templates')
export class GameTemplate {
  /** Slug primary key, e.g. `tic-tac-toe`. Referenced by `games.template_id`. */
  @PrimaryColumn('text')
  id!: string;

  /**
   * Configurability schema for the template (field defs / JSON schema / defaults).
   * `null` means the template cannot be configured — games are created with an
   * empty `config`.
   */
  @Column({ type: 'jsonb', nullable: true })
  config!: Record<string, unknown> | null;

  /** Bucket-relative prefix for the template's files, e.g. `templates/tic-tac-toe`. */
  @Column('text')
  path!: string;

  @OneToMany(() => Game, (game) => game.template)
  games?: Game[];
}
