/**
 * Dev data seeder: registers the template fixtures under `seed/templates/` and
 * creates a game from each, so a fresh dev environment has something to load.
 *
 *   npm run seed              # create what is missing, leave the rest alone
 *   npm run seed -- --force   # replace the fixture templates (see below)
 *
 * It drives the public HTTP API rather than writing storage and rows directly.
 * That matters in dev: the API usually runs in Docker with its template files on
 * a named volume, which the host cannot see — and it means the seeded template
 * goes through the exact upload path (validation, content types, brotli
 * sidecars) a real upload would, instead of a parallel one that can drift.
 *
 * `POST /templates` refuses to overwrite an existing template, so re-seeding is
 * a no-op by design. Use `--force` after editing a fixture: it deletes the
 * template row *and every game pointing at it* straight through the database
 * (there is no delete endpoint), then uploads again. Dev only — it talks to
 * whichever database `.env` names.
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source';
import { slugify } from '../src/storage/template-storage';

/** Where the API is listening. Override for a non-default dev port/host. */
const API_URL = (process.env.API_URL ?? 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

/** Fixture root; each subfolder is one template, uploaded whole. */
const FIXTURES_DIR = resolve(__dirname, '..', 'seed', 'templates');

interface Fixture {
  /** Fixture folder name. Must equal the slug the API derives from `name`. */
  dir: string;
  /** Human-readable name sent to the API; slugified into the template id. */
  name: string;
  /**
   * Configurability schema for the template, or `null` when it has none. These
   * templates hardcode their content today, so a game's `config` is `{}`.
   */
  config: Record<string, unknown> | null;
  /** Games to create from the template. Matched by title, so re-runs are safe. */
  games: { title: string; config?: Record<string, unknown> }[];
}

const FIXTURES: Fixture[] = [
  {
    dir: 'space-journey',
    name: 'Space Journey',
    config: null,
    games: [{ title: 'Космическое путешествие' }],
  },
];

interface TemplateRow {
  id: string;
  path: string;
  config: Record<string, unknown> | null;
}

interface GameRow {
  id: string;
  title: string;
  templateId: string;
  entryUrl: string;
}

async function main(): Promise<void> {
  const force = process.argv.slice(2).includes('--force');

  await assertApiReachable();

  for (const fixture of FIXTURES) {
    const id = slugify(fixture.name);
    if (id !== fixture.dir) {
      throw new Error(
        `Fixture '${fixture.dir}': name '${fixture.name}' slugifies to '${id}', ` +
          `so the API would serve it from a different folder. Rename one of them.`,
      );
    }

    if (force && (await getTemplate(id))) {
      await deleteTemplate(id);
    }

    if (await getTemplate(id)) {
      console.log(`= template ${id} (exists — re-run with --force to replace)`);
    } else {
      const files = await collectFiles(join(FIXTURES_DIR, fixture.dir));
      if (files.length === 0) {
        throw new Error(`Fixture '${fixture.dir}' has no files`);
      }
      await uploadTemplate(fixture, files);
      console.log(
        `+ template ${id} (${files.length} file${files.length === 1 ? '' : 's'}: ` +
          `${files.map((f) => f.relKey).join(', ')})`,
      );
    }

    const existing = await listGames();
    for (const game of fixture.games) {
      const match = existing.find(
        (g) => g.templateId === id && g.title === game.title,
      );
      if (match) {
        console.log(`= game     ${match.id} "${match.title}"`);
        continue;
      }
      const created = await createGame(id, game.title, game.config);
      console.log(`+ game     ${created.id} "${created.title}"`);
    }

    console.log(`  play:    ${API_URL}/templates/${id}/index.js`);
  }
}

/** Fails early with a usable message when the dev API is not up. */
async function assertApiReachable(): Promise<void> {
  let body: { status?: string; db?: string };
  try {
    const res = await fetch(`${API_URL}/health`);
    body = (await res.json()) as typeof body;
    if (!res.ok) {
      throw new Error(`health check returned ${res.status} (db: ${body.db})`);
    }
  } catch (err) {
    throw new Error(
      `Cannot reach the API at ${API_URL} — start it first ` +
        `(\`docker compose up -d\` or \`npm run start:dev\`).\n  ${String(err)}`,
    );
  }
}

/** The template row, or `undefined` when it is not registered. */
async function getTemplate(id: string): Promise<TemplateRow | undefined> {
  const res = await fetch(`${API_URL}/templates/${id}`);
  if (res.status === 404) return undefined;
  return (await expectOk(res, `GET /templates/${id}`)) as TemplateRow;
}

async function listGames(): Promise<GameRow[]> {
  const res = await fetch(`${API_URL}/games`);
  return (await expectOk(res, 'GET /games')) as GameRow[];
}

async function createGame(
  templateId: string,
  title: string,
  config?: Record<string, unknown>,
): Promise<GameRow> {
  const res = await fetch(`${API_URL}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, title, config: config ?? {} }),
  });
  return (await expectOk(res, 'POST /games')) as GameRow;
}

/** Uploads a fixture folder as one multipart template upload. */
async function uploadTemplate(
  fixture: Fixture,
  files: { relKey: string; body: Buffer }[],
): Promise<void> {
  const form = new FormData();
  form.set('name', fixture.name);
  if (fixture.config) form.set('config', JSON.stringify(fixture.config));
  // The relative path is the multipart filename, which is how a subfolder like
  // `assets/app.css` keeps its shape on the server (the upload interceptor sets
  // `preservePath`).
  for (const file of files) {
    form.append('files', new Blob([file.body]), file.relKey);
  }

  const res = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    body: form,
  });
  await expectOk(res, 'POST /templates');
}

/**
 * Removes a fixture template and every game built on it. There is no delete
 * endpoint — deleting a template invalidates games that cannot exist without it
 * — so this reaches into the database directly, which only a dev seeder may do.
 */
async function deleteTemplate(id: string): Promise<void> {
  // Same connection settings the app uses, so `--force` can never hit a
  // different database than the API it just talked to.
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    // Counted with its own SELECT: `query()` reports a write's result as
    // `[rows, rowCount]`, which is easy to misread as the rows themselves.
    const games: { id: string }[] = await dataSource.query(
      'SELECT id FROM games WHERE template_id = $1',
      [id],
    );
    await dataSource.query('DELETE FROM games WHERE template_id = $1', [id]);
    await dataSource.query('DELETE FROM game_templates WHERE id = $1', [id]);
    console.log(
      `- template ${id} (--force; dropped ${games.length} game${games.length === 1 ? '' : 's'})`,
    );
  } finally {
    await dataSource.destroy();
  }
}

/** Every file under `dir`, keyed by its path relative to it, with `/` separators. */
async function collectFiles(
  dir: string,
): Promise<{ relKey: string; body: Buffer }[]> {
  const entries = await readdir(dir, {
    withFileTypes: true,
    recursive: true,
  }).catch(() => {
    throw new Error(`Fixture folder not found: ${dir}`);
  });

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = join(entry.parentPath, entry.name);
    files.push({
      relKey: relative(dir, absolute).split(sep).join('/'),
      body: await readFile(absolute),
    });
  }
  // Stable order so the logged file list does not shuffle between runs.
  return files.sort((a, b) => a.relKey.localeCompare(b.relKey));
}

/** Parses a JSON response, turning a non-2xx into an error carrying the body. */
async function expectOk(res: Response, what: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${what} failed: ${res.status} ${res.statusText}\n  ${text}`,
    );
  }
  return text ? JSON.parse(text) : undefined;
}

main().catch((err: unknown) => {
  console.error(`\nSeed failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
