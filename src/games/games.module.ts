import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../database/entities/game.entity';
import { GameTemplate } from '../database/entities/game-template.entity';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameTemplate])],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
