import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';
import { createTestD1 } from '../test/d1';
import type { D1Database } from '@cloudflare/workers-types';

describe('Pro Cloud Sync Seam', () => {
  let db: D1Database;
  const mockEnv = () => ({
    DB: db,
  });

  beforeEach(() => {
    db = createTestD1();
  });

  it('GET /api/sync requires authentication', async () => {
    const res = await app.request('/api/sync', {}, mockEnv());
    expect(res.status).toBe(401);
  });

  it('GET /api/sync forbids free-tier users with HTTP 403', async () => {
    const userId = 'usr_free_sync';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'free_sync@example.com', 'free', now, now).run();

    const sessionId = 'sess_free_sync';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const res = await app.request('/api/sync', {
      headers: { Cookie: `session=${sessionId}` },
    }, mockEnv());

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain('Pro subscription required');
  });

  it('POST /api/sync forbids free-tier users with HTTP 403', async () => {
    const userId = 'usr_free_post';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'free_post@example.com', 'free', now, now).run();

    const sessionId = 'sess_free_post';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const res = await app.request('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ snapshot: { completedSlugs: ['ex-1'] } }),
    }, mockEnv());

    expect(res.status).toBe(403);
  });

  it('Round-trips snapshot saves and loads for Pro subscribers', async () => {
    const userId = 'usr_pro_sync';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'pro_sync@example.com', 'pro', now, now).run();

    const sessionId = 'sess_pro_sync';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    // 1. Initial GET returns empty snapshot
    const initialGet = await app.request('/api/sync', {
      headers: { Cookie: `session=${sessionId}` },
    }, mockEnv());
    expect(initialGet.status).toBe(200);
    const initialBody = await initialGet.json() as any;
    expect(initialBody).toEqual({ snapshot: null, updatedAt: null, version: null });

    // 2. POST save snapshot
    const snapshotData = {
      completedSlugs: ['go-basics-1', 'go-basics-2'],
      userCode: { 'go-basics-1': 'package main\nfunc main() {}' },
    };
    const postRes = await app.request('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ snapshot: snapshotData, version: 1 }),
    }, mockEnv());

    expect(postRes.status).toBe(200);
    const postBody = await postRes.json() as any;
    expect(postBody.success).toBe(true);
    expect(postBody.updatedAt).toBeTypeOf('number');

    // 3. Subsequent GET returns stored snapshot
    const getRes = await app.request('/api/sync', {
      headers: { Cookie: `session=${sessionId}` },
    }, mockEnv());
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json() as any;
    expect(getBody.snapshot).toEqual(snapshotData);
    expect(getBody.version).toBe(1);
    expect(getBody.updatedAt).toBe(postBody.updatedAt);
  });

  it('Preserves cloud data safely when subscription ends and rejects new writes', async () => {
    const userId = 'usr_expired_sub';
    const now = Date.now();

    // 1. User was Pro and synced data
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'expired@example.com', 'pro', now, now).run();

    const sessionId = 'sess_expired';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const savedSnapshot = { completedSlugs: ['first-step'] };
    await app.request('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ snapshot: savedSnapshot, version: 1 }),
    }, mockEnv());

    // 2. Subscription is canceled / downgraded to free
    await db.prepare('UPDATE users SET tier = ? WHERE id = ?').bind('free', userId).run();

    // 3. New writes are blocked
    const blockedPost = await app.request('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ snapshot: { completedSlugs: ['new-progress'] }, version: 1 }),
    }, mockEnv());
    expect(blockedPost.status).toBe(403);

    // 4. Cloud data in D1 remains intact
    const preserved = await db
      .prepare('SELECT payload_json FROM user_sync WHERE user_id = ?')
      .bind(userId)
      .first<{ payload_json: string }>();

    expect(preserved).not.toBeNull();
    expect(JSON.parse(preserved!.payload_json)).toEqual(savedSnapshot);
  });
});
