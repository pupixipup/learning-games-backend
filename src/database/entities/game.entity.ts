import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GameTemplate } from './game-template.entity';

/**
 * A user-created game instance. A game is just `template_id + title + config`:
 * it reuses its template's files and supplies content/settings through `config`.
 * Games carry no files of their own.
 */
@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** FK to {@link GameTemplate.id}. */
  @Column({ name: 'template_id', type: 'text' })
  templateId!: string;

  @Column('text')
  title!: string;

  /** Concrete configuration values chosen for this instance. */
  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => GameTemplate, (template) => template.games)
  @JoinColumn({ name: 'template_id' })
  template?: GameTemplate;
}
