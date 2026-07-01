import 'dotenv/config';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Single source of truth for the database connection.
 *
 * Used both by the Nest application (see `database.module.ts`) and by the
 * TypeORM CLI for migrations (`npm run migration:*`, which loads the default
 * export below). `dotenv/config` is imported at the top so the CLI — which runs
 * outside the Nest runtime — still picks up the local `.env` file.
 *
 * The `__dirname`-based globs intentionally match both `.ts` (ts-node) and
 * `.js` (compiled `dist/`) so the exact same config works in dev and prod.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'turn',
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  // Never auto-sync the schema — migrations are the only way it changes.
  synchronize: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
