import { Injectable, Logger } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject, concat, from, interval, merge } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import type { BroadcasterMessage, ViewerMessage } from './signal.types';

interface Session {
  /** The single broadcaster's SSE stream, or null when none is connected. */
  broadcaster: Subject<MessageEvent> | null;
  /** Connected viewers' SSE streams, keyed by viewerId. */
  viewers: Map<string, Subject<MessageEvent>>;
  /** Messages destined for the broadcaster that arrived before it connected. */
  broadcasterBuffer: MessageEvent[];
}

/** Heartbeat keeps SSE connections alive through idle-timeout proxies. */
const HEARTBEAT_MS = 15_000;

/**
 * In-memory WebRTC signaling relay. One broadcaster and many viewers share a
 * `sessionId`. The broadcaster learns about viewers via `viewer-*` events; each
 * viewer receives `broadcaster-*` events targeted at it. State is per-process
 * and intentionally ephemeral — restart clears everything.
 */
@Injectable()
export class SignalService {
  private readonly logger = new Logger(SignalService.name);
  private readonly sessions = new Map<string, Session>();

  /** Broadcaster subscribes to its event stream. Buffered messages are flushed. */
  connectBroadcaster(sessionId: string): Observable<MessageEvent> {
    const session = this.getSession(sessionId);
    const subject = new Subject<MessageEvent>();
    session.broadcaster = subject;

    const buffered = session.broadcasterBuffer;
    session.broadcasterBuffer = [];
    this.logger.log(
      `broadcaster connected: ${sessionId} (flushed ${buffered.length})`,
    );

    // Tell already-waiting viewers the broadcaster is live.
    this.broadcastToViewers(session, { type: 'broadcaster-ready', data: {} });

    const events = concat(from(buffered), subject.asObservable());
    return merge(events, this.heartbeat()).pipe(
      finalize(() => {
        // Only tear down if a newer broadcaster hasn't replaced this one.
        if (session.broadcaster === subject) {
          session.broadcaster = null;
          this.logger.log(`broadcaster disconnected: ${sessionId}`);
          // Let waiting viewers show "player left."
          this.broadcastToViewers(session, {
            type: 'broadcaster-gone',
            data: {},
          });
          this.cleanupIfEmpty(sessionId, session);
        }
      }),
    );
  }

  /** Viewer subscribes to its event stream. */
  connectViewer(sessionId: string, viewerId: string): Observable<MessageEvent> {
    const session = this.getSession(sessionId);
    const subject = new Subject<MessageEvent>();
    session.viewers.set(viewerId, subject);
    this.logger.log(`viewer connected: ${sessionId}/${viewerId}`);

    // If a broadcaster is already live, greet this viewer with broadcaster-ready.
    // The subject isn't subscribed yet, so inject via concat rather than next().
    const startup: MessageEvent[] = session.broadcaster
      ? [{ type: 'broadcaster-ready', data: {} }]
      : [];

    return merge(
      concat(from(startup), subject.asObservable()),
      this.heartbeat(),
    ).pipe(
      finalize(() => {
        if (session.viewers.get(viewerId) === subject) {
          session.viewers.delete(viewerId);
          this.logger.log(`viewer disconnected: ${sessionId}/${viewerId}`);
          this.routeToBroadcaster(session, {
            type: 'viewer-disconnect',
            data: { id: viewerId },
          });
          this.cleanupIfEmpty(sessionId, session);
        }
      }),
    );
  }

  /** Broadcaster → viewer. Returns whether the target viewer was connected. */
  fromBroadcaster(
    sessionId: string,
    message: BroadcasterMessage,
  ): { delivered: boolean } {
    const session = this.getSession(sessionId);
    const viewer = session.viewers.get(message.id);
    if (!viewer) {
      this.logger.warn(
        `broadcaster message for unknown viewer ${sessionId}/${message.id}`,
      );
      return { delivered: false };
    }

    const data =
      message.type === 'broadcaster-answer'
        ? { answer: message.answer }
        : { candidate: message.candidate };
    viewer.next({ type: message.type, data });
    return { delivered: true };
  }

  /** Viewer → broadcaster. Tagged with the viewerId; buffered if none yet. */
  fromViewer(
    sessionId: string,
    viewerId: string,
    message: ViewerMessage,
  ): { buffered: boolean } {
    const session = this.getSession(sessionId);
    const data =
      message.type === 'viewer-offer'
        ? { id: viewerId, offer: message.offer }
        : { id: viewerId, candidate: message.candidate };

    return {
      buffered: this.routeToBroadcaster(session, { type: message.type, data }),
    };
  }

  /** Delivers to the broadcaster if connected, otherwise buffers. */
  private routeToBroadcaster(session: Session, event: MessageEvent): boolean {
    if (session.broadcaster) {
      session.broadcaster.next(event);
      return false;
    }
    session.broadcasterBuffer.push(event);
    return true;
  }

  /** Emits an event to every currently-connected viewer of the session. */
  private broadcastToViewers(session: Session, event: MessageEvent): void {
    for (const viewer of session.viewers.values()) {
      viewer.next(event);
    }
  }

  private heartbeat(): Observable<MessageEvent> {
    return interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: {} })));
  }

  private getSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        broadcaster: null,
        viewers: new Map(),
        broadcasterBuffer: [],
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private cleanupIfEmpty(sessionId: string, session: Session): void {
    if (
      !session.broadcaster &&
      session.viewers.size === 0 &&
      session.broadcasterBuffer.length === 0
    ) {
      this.sessions.delete(sessionId);
    }
  }
}
