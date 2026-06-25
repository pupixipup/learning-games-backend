import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TurnModule } from './turn/turn.module';
import { SignalModule } from './signal/signal.module';

@Module({
  imports: [TurnModule, SignalModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
