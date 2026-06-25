import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      migrationsRun: process.env.NODE_ENV === 'development',
    }),
  ],
})
export class DatabaseModule {}
