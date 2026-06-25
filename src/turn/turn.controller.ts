import { Controller, Get, Query } from '@nestjs/common';
import { TurnService } from './turn.service';
import type { TurnCredentials } from './turn.service';

@Controller('turn-credentials')
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @Get()
  getCredentials(@Query('userId') userId?: string): TurnCredentials {
    return this.turnService.getCredentials(userId);
  }
}
