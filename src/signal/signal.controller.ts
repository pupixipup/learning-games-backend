import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SignalService } from './signal.service';
import type { BroadcasterMessage, ViewerMessage } from './signal.types';

@Controller('signal/:sessionId')
export class SignalController {
  constructor(private readonly signal: SignalService) {}

  /** Broadcaster subscribes: receives viewer-offer / viewer-ice / viewer-disconnect. */
  @Sse('broadcaster')
  broadcasterStream(
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    return this.signal.connectBroadcaster(sessionId);
  }

  /** Broadcaster sends broadcaster-answer / broadcaster-ice (carrying the target viewer id). */
  @Post('broadcaster')
  fromBroadcaster(
    @Param('sessionId') sessionId: string,
    @Body() body: BroadcasterMessage,
  ) {
    if (
      body?.type !== 'broadcaster-answer' &&
      body?.type !== 'broadcaster-ice'
    ) {
      throw new BadRequestException(
        'type must be "broadcaster-answer" or "broadcaster-ice"',
      );
    }
    if (!body.id) {
      throw new BadRequestException('id (target viewerId) is required');
    }
    return this.signal.fromBroadcaster(sessionId, body);
  }

  /** Viewer subscribes: receives broadcaster-ready / broadcaster-gone / broadcaster-answer / broadcaster-ice. */
  @Sse('viewer/:viewerId')
  viewerStream(
    @Param('sessionId') sessionId: string,
    @Param('viewerId') viewerId: string,
  ): Observable<MessageEvent> {
    return this.signal.connectViewer(sessionId, viewerId);
  }

  /** Viewer sends viewer-offer / viewer-ice (routed to the broadcaster). */
  @Post('viewer/:viewerId')
  fromViewer(
    @Param('sessionId') sessionId: string,
    @Param('viewerId') viewerId: string,
    @Body() body: ViewerMessage,
  ) {
    if (body?.type !== 'viewer-offer' && body?.type !== 'viewer-ice') {
      throw new BadRequestException(
        'type must be "viewer-offer" or "viewer-ice"',
      );
    }
    return this.signal.fromViewer(sessionId, viewerId, body);
  }
}
