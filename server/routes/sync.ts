import { Hono } from 'hono';
import type { Env } from '../index';
import { getSessionIdFromCookie, validateSession } from '../auth/session';

const sync = new Hono<{ Bindings: Env }>();

// ----------------------------------------------------
// Retrieve Cloud Progress Snapshot (Pro Only)
// ----------------------------------------------------
sync.get('/', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  const sessionId = getSessionIdFromCookie(c);
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const user = await validateSession(db, sessionId);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (user.tier !== 'pro') {
    return c.json({ error: 'Pro subscription required for cloud sync' }, 403);
  }

  const row = await db
    .prepare('SELECT payload_json, version, updated_at FROM user_sync WHERE user_id = ?')
    .bind(user.id)
    .first<{ payload_json: string; version: number; updated_at: number }>();

  if (!row) {
    return c.json({ snapshot: null, updatedAt: null, version: null });
  }

  let parsedSnapshot: any = null;
  try {
    parsedSnapshot = JSON.parse(row.payload_json);
  } catch (err) {
    console.error('[Cloud Sync Parse Error]:', err);
    return c.json({ error: 'Corrupt snapshot data' }, 500);
  }

  return c.json({
    snapshot: parsedSnapshot,
    version: row.version,
    updatedAt: row.updated_at,
  });
});

// ----------------------------------------------------
// Save Monolithic Cloud Progress Snapshot (Pro Only)
// ----------------------------------------------------
sync.post('/', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  const sessionId = getSessionIdFromCookie(c);
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const user = await validateSession(db, sessionId);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (user.tier !== 'pro') {
    return c.json({ error: 'Pro subscription required for cloud sync' }, 403);
  }

  let body: { snapshot?: any; version?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  if (!body.snapshot) {
    return c.json({ error: 'Missing snapshot data' }, 400);
  }

  const now = Date.now();
  const version = body.version ?? 1;
  const serialized = JSON.stringify(body.snapshot);

  await db
    .prepare(`
      INSERT INTO user_sync (user_id, payload_json, version, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        payload_json = excluded.payload_json,
        version = excluded.version,
        updated_at = excluded.updated_at
    `)
    .bind(user.id, serialized, version, now)
    .run();

  return c.json({
    success: true,
    updatedAt: now,
  });
});

export default sync;
