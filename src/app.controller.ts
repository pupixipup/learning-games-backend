import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Readiness probe. Returns 200 only when the app can actually reach the
   * database; 503 otherwise. This is what Docker's healthcheck and any uptime
   * monitor poll, so a process that is "up" but cannot serve requests (e.g. the
   * database is unreachable) shows as unhealthy instead of silently failing.
   */
  @Get('health')
  async health(): Promise<{ status: string; db: string }> {
    try {
      await this.pingDb();
      return { status: 'ok', db: 'up' };
    } catch {
      throw new HttpException(
        { status: 'error', db: 'down' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /** `SELECT 1` against the DB, bounded so a dead connection can't hang the probe. */
  private async pingDb(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('db ping timed out')), 3000);
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
