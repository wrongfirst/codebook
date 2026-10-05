import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';
import { createTestD1 } from '../test/d1';
import type { D1Database } from '@cloudflare/workers-types';

describe('Managed Rubber Duck AI Seam', () => {
  let db: D1Database;

  const mockAi = {
    async run(model: string, options: any) {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"response":"Hello "}\n\n'));
          controller.enqueue(encoder.encode('data: {"response":"world!"}\n\n'));
          controller.close();
        },
      });
    },
  };

  const mockEnv = () => ({
    DB: db,
    AI: mockAi,
  });

  beforeEach(() => {
    db = createTestD1();
  });

  it('POST /api/chat requires authentication', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me' }] }),
    }, mockEnv());

    expect(res.status).toBe(401);
  });

  it('POST /api/chat forbids free-tier users with HTTP 403', async () => {
    const userId = 'usr_free_ai';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'free_ai@example.com', 'free', now, now).run();

    const sessionId = 'sess_free_ai';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me' }] }),
    }, mockEnv());

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain('Pro subscription required');
  });

  it('POST /api/chat streams SSE response for Pro subscribers and increments usage', async () => {
    const userId = 'usr_pro_ai';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'pro_ai@example.com', 'pro', now, now).run();

    const sessionId = 'sess_pro_ai';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello duck' }] }),
    }, mockEnv());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('Hello');
    expect(text).toContain('world!');
    expect(text).toContain('[DONE]');

    // Check usage recorded in D1
    const dateKey = new Date().toISOString().slice(0, 10);
    const usage = await db
      .prepare('SELECT request_count FROM ai_usage WHERE user_id = ? AND date_key = ?')
      .bind(userId, dateKey)
      .first<{ request_count: number }>();

    expect(usage).not.toBeNull();
    expect(usage!.request_count).toBe(1);
  });

  it('POST /api/chat enforces daily quota rate limit of 100 queries', async () => {
    const userId = 'usr_pro_capped';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'capped@example.com', 'pro', now, now).run();

    const sessionId = 'sess_capped';
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, now + 100000).run();

    const dateKey = new Date().toISOString().slice(0, 10);
    // Pre-seed 100 queries for today
    await db.prepare(
      'INSERT INTO ai_usage (user_id, date_key, request_count) VALUES (?, ?, ?)'
    ).bind(userId, dateKey, 100).run();

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionId}`,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'One too many' }] }),
    }, mockEnv());

    expect(res.status).toBe(429);
    const body = await res.json() as any;
    expect(body.error).toContain('Daily AI limit reached');
  });
});
