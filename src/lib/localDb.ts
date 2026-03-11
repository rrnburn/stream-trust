/**
 * Local SQLite-backed data layer for native Capacitor builds.
 * Uses @capacitor-community/sqlite for on-device persistence.
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;

const DB_NAME = 'streaminstuff';

export async function initLocalDb() {
  if (db) return db;

  const ret = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

  if (ret.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }

  await db.open();

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS iptv_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      username TEXT,
      password TEXT,
      epg_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parsed_media (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      poster TEXT DEFAULT '',
      category TEXT DEFAULT 'channel',
      genre TEXT DEFAULT 'Uncategorized',
      description TEXT DEFAULT '',
      stream_url TEXT DEFAULT '',
      group_name TEXT,
      FOREIGN KEY (source_id) REFERENCES iptv_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      progress REAL DEFAULT 0,
      watched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function uuid() {
  return crypto.randomUUID();
}

// ── Sources ─────────────────────────────────────────────────

export async function getSources() {
  const d = await initLocalDb();
  const res = await d.query('SELECT * FROM iptv_sources ORDER BY created_at DESC');
  return res.values || [];
}

export async function addSourceLocal(source: { name: string; type: string; url: string; username?: string; password?: string }) {
  const d = await initLocalDb();
  const id = uuid();
  await d.run(
    'INSERT INTO iptv_sources (id, name, type, url, username, password) VALUES (?, ?, ?, ?, ?, ?)',
    [id, source.name, source.type, source.url, source.username || null, source.password || null],
  );
  return id;
}

export async function removeSourceLocal(id: string) {
  const d = await initLocalDb();
  await d.run('DELETE FROM parsed_media WHERE source_id = ?', [id]);
  await d.run('DELETE FROM iptv_sources WHERE id = ?', [id]);
}

// ── Parsed Media ────────────────────────────────────────────

export async function getParsedMedia() {
  const d = await initLocalDb();
  const res = await d.query('SELECT * FROM parsed_media ORDER BY title ASC');
  return res.values || [];
}

export async function insertParsedMedia(
  sourceId: string,
  items: Array<{ title: string; logo: string; category: string; group: string; url: string; sourceName?: string }>,
) {
  const d = await initLocalDb();
  // Delete old records for this source
  await d.run('DELETE FROM parsed_media WHERE source_id = ?', [sourceId]);

  // Batch insert inside a single transaction for massive speedup
  const BATCH_SIZE = 500;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const statements = batch.map(item => ({
      statement: 'INSERT INTO parsed_media (id, source_id, title, poster, category, genre, description, stream_url, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      values: [uuid(), sourceId, item.title, item.logo || '', item.category, item.group || 'Uncategorized', `From ${item.sourceName || 'source'}`, item.url, item.group || null],
    }));
    await d.executeSet(statements);
  }
}

// ── Favorites ───────────────────────────────────────────────

export async function getFavorites() {
  const d = await initLocalDb();
  const res = await d.query('SELECT media_id FROM favorites');
  return (res.values || []).map((r: any) => r.media_id);
}

export async function toggleFavoriteLocal(mediaId: string) {
  const d = await initLocalDb();
  const existing = await d.query('SELECT id FROM favorites WHERE media_id = ?', [mediaId]);
  if (existing.values && existing.values.length > 0) {
    await d.run('DELETE FROM favorites WHERE media_id = ?', [mediaId]);
  } else {
    await d.run('INSERT INTO favorites (id, media_id) VALUES (?, ?)', [uuid(), mediaId]);
  }
}

// ── Watch History ───────────────────────────────────────────

export async function getWatchHistory() {
  const d = await initLocalDb();
  const res = await d.query('SELECT media_id, progress, watched_at FROM watch_history ORDER BY watched_at DESC LIMIT 50');
  return (res.values || []).map((r: any) => ({ id: r.media_id, progress: r.progress, timestamp: r.watched_at }));
}

export async function addToHistoryLocal(mediaId: string, progress: number) {
  const d = await initLocalDb();
  await d.run(
    'INSERT INTO watch_history (id, media_id, progress) VALUES (?, ?, ?)',
    [uuid(), mediaId, progress],
  );
}
