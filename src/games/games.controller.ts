import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GamesService } from './games.service';
import type { CreateGameBody, GameView } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly service: GamesService) {}

  /** Creates a game from a template. */
  @Post()
  create(@Body() body: CreateGameBody): Promise<GameView> {
    return this.service.createGame(body);
  }

  /** Lists all games, newest first. */
  @Get()
  list(): Promise<GameView[]> {
    return this.service.listGames();
  }

  /** Returns one game plus its template metadata; 404 if it does not exist. */
  @Get(':id')
  getOne(@Param('id') id: string): Promise<GameView> {
    return this.service.getGame(id);
  }
}
