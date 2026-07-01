import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameTemplate } from '../database/entities/game-template.entity';
import { StorageModule } from '../storage/storage.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [StorageModule, TypeOrmModule.forFeature([GameTemplate])],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
