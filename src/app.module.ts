import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { TurnModule } from './turn/turn.module';
import { SignalModule } from './signal/signal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // In prod (NODE_ENV=production, set by the Dockerfile) env vars are
      // injected by the orchestrator, so there is no .env file to read.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    DatabaseModule,
    TurnModule,
    SignalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
