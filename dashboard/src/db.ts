import { Database } from "bun:sqlite";

let _db: Database | null = null;

function pruneLocalHostnames(db: Database): void {
  const ids = db
    .query<{ id: string }, []>(
      `
        SELECT id
        FROM servers
        WHERE hostname = 'localhost'
          OR hostname = 'localhost.localdomain'
          OR hostname LIKE '127.%'
          OR hostname LIKE '%.local'
          OR hostname LIKE '%.lan'
          OR hostname LIKE '%.home'
          OR hostname LIKE '%.cs1local'
      `,
    )
    .all()
    .map((row) => row.id);

  if (ids.length === 0) return;

  const placeholders = ids.map(() => "?").join(", ");
  db.transaction(() => {
    db.run(
      `DELETE FROM activity_log WHERE server_id IN (${placeholders})`,
      ids,
    );
    db.run(
      `DELETE FROM registration_tokens WHERE server_id IN (${placeholders})`,
      ids,
    );
    db.run(`DELETE FROM sites WHERE server_id IN (${placeholders})`, ids);
    db.run(`DELETE FROM servers WHERE id IN (${placeholders})`, ids);
  })();
}

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id       INTEGER PRIMARY KEY,
      email    TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS servers (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      hostname         TEXT NOT NULL,
      ssh_user         TEXT NOT NULL DEFAULT 'root',
      ssh_port         INTEGER NOT NULL DEFAULT 22,
      ssh_key_path     TEXT NOT NULL,
      agent_direct_url TEXT,
      status           TEXT NOT NULL DEFAULT 'unknown',
      added_at         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id          TEXT PRIMARY KEY,
      server_id   TEXT NOT NULL REFERENCES servers(id),
      domain      TEXT NOT NULL,
      site_user   TEXT NOT NULL,
      php_version TEXT NOT NULL,
      tier        TEXT NOT NULL,
      tls_mode    TEXT NOT NULL,
      synced_at   INTEGER NOT NULL,
      UNIQUE(server_id, domain)
    );

    CREATE TABLE IF NOT EXISTS registration_tokens (
      id         TEXT PRIMARY KEY,
      token      TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER,
      server_id  TEXT REFERENCES servers(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id          TEXT PRIMARY KEY,
      server_id   TEXT NOT NULL REFERENCES servers(id),
      site_id     TEXT REFERENCES sites(id),
      action      TEXT NOT NULL,
      params      TEXT NOT NULL,
      status      TEXT NOT NULL,
      output      TEXT,
      actor       TEXT NOT NULL,
      started_at  INTEGER NOT NULL,
      finished_at INTEGER
    );
  `);

  const wpColumns = [
    "ALTER TABLE sites ADD COLUMN wp_version TEXT",
    "ALTER TABLE sites ADD COLUMN plugins_need_update INTEGER DEFAULT 0",
    "ALTER TABLE sites ADD COLUMN themes_need_update INTEGER DEFAULT 0",
    "ALTER TABLE sites ADD COLUMN wp_scanned_at INTEGER",
  ];
  for (const stmt of wpColumns) {
    try {
      db.exec(stmt);
    } catch {
      // column already exists — safe to ignore on re-run
    }
  }

  const gitColumns = [
    "ALTER TABLE sites ADD COLUMN git_repo TEXT",
    "ALTER TABLE sites ADD COLUMN git_branch TEXT",
  ];
  for (const stmt of gitColumns) {
    try {
      db.exec(stmt);
    } catch {
      // column already exists
    }
  }

  pruneLocalHostnames(db);
}

export function openDb(path: string): Database {
  const db = new Database(path);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  migrate(db);
  return db;
}

export function getDb(): Database {
  if (!_db) {
    const path = process.env.DB_PATH ?? "/var/lib/litesoup-dashboard/db.sqlite";
    _db = openDb(path);
  }
  return _db;
}
