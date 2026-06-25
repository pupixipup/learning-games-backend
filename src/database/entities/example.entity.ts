import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('examples')
export class Example {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
