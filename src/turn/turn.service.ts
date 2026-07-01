import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
}

/**
 * Generates short-lived TURN credentials compatible with coturn's
 * `use-auth-secret` / `static-auth-secret` mechanism (the "TURN REST API").
 *
 * The username is a unix expiry timestamp and the credential is
 * base64(HMAC-SHA1(secret, username)). coturn recomputes the same HMAC to
 * validate, so no per-user state is stored on either side.
 *
 * @see https://github.com/coturn/coturn/wiki/turnserver#turn-rest-api
 */
@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);

  private readonly secret = process.env.TURN_SECRET;
  private readonly urls = (
    process.env.TURN_URLS ?? 'turn:turn.example.com:3478'
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  private readonly ttlSeconds = Number(process.env.TURN_TTL ?? 86400);

  constructor() {
    if (!this.secret) {
      this.logger.warn('Set TURN_SECRET. It is empty.');
    }
  }

  /**
   * @param userId optional identifier embedded in the username, useful for
   *   per-user revocation / logging on the coturn side.
   */
  getCredentials(userId?: string): TurnCredentials {
    const expiry = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const username = userId ? `${expiry}:${userId}` : `${expiry}`;

    const credential = createHmac('sha1', this.secret)
      .update(username)
      .digest('base64');

    return { urls: this.urls, username, credential };
  }
}
