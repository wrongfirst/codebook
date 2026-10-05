import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';
import { createTestD1 } from '../test/d1';
import type { D1Database } from '@cloudflare/workers-types';

async function generatePaddleSignature(rawBody: string, secret: string, ts: string = '1700000000'): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = `${ts}:${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const h1 = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `ts=${ts};h1=${h1}`;
}

describe('Paddle Billing v2 Seam', () => {
  let db: D1Database;
  const WEBHOOK_SECRET = 'test_pdl_webhook_secret_key';

  const mockEnv = () => ({
    DB: db,
    PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    PADDLE_API_KEY: 'test_pdl_api_key',
    PADDLE_PRICE_ID: 'pri_test_123',
    PADDLE_CLIENT_TOKEN: 'live_test_client_token',
  });

  beforeEach(() => {
    db = createTestD1();
  });

  it('GET /api/billing/config returns public checkout parameters', async () => {
    const res = await app.request('/api/billing/config', {}, mockEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toEqual({
      clientToken: 'live_test_client_token',
      priceId: 'pri_test_123',
      environment: 'sandbox',
    });
  });

  it('POST /api/billing/webhook rejects requests missing signature', async () => {
    const res = await app.request('/api/billing/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'subscription.activated' }),
    }, mockEnv());

    expect(res.status).toBe(400);
  });

  it('POST /api/billing/webhook rejects requests with invalid signature', async () => {
    const rawBody = JSON.stringify({ event_type: 'subscription.activated' });
    const res = await app.request('/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': 'ts=1700000000;h1=invalid_signature_hash',
      },
      body: rawBody,
    }, mockEnv());

    expect(res.status).toBe(400);
  });

  it('POST /api/billing/webhook handles subscription.activated and upgrades user to Pro', async () => {
    // 1. Seed user in D1
    const userId = 'usr_learner_1';
    await db.prepare(
      'INSERT INTO users (id, email, name, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, 'learner@example.com', 'Learner', 'free', 1000, 1000).run();

    // 2. Construct Paddle event
    const event = {
      event_id: 'evt_act_001',
      event_type: 'subscription.activated',
      data: {
        id: 'sub_paddle_123',
        customer_id: 'ctm_paddle_456',
        status: 'active',
        custom_data: {
          user_id: userId,
        },
      },
    };
    const rawBody = JSON.stringify(event);
    const signature = await generatePaddleSignature(rawBody, WEBHOOK_SECRET);

    const res = await app.request('/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': signature,
      },
      body: rawBody,
    }, mockEnv());

    expect(res.status).toBe(200);

    // 3. Verify user in D1 is now Pro with paddle customer and subscription IDs
    const user = await db
      .prepare('SELECT tier, paddle_customer_id, paddle_subscription_id FROM users WHERE id = ?')
      .bind(userId)
      .first<{ tier: string; paddle_customer_id: string; paddle_subscription_id: string }>();

    expect(user!.tier).toBe('pro');
    expect(user!.paddle_customer_id).toBe('ctm_paddle_456');
    expect(user!.paddle_subscription_id).toBe('sub_paddle_123');
  });

  it('POST /api/billing/webhook handles subscription.canceled and reverts user to free tier', async () => {
    // 1. Seed user as Pro in D1
    const userId = 'usr_pro_user';
    await db.prepare(
      'INSERT INTO users (id, email, name, tier, paddle_customer_id, paddle_subscription_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, 'pro@example.com', 'Pro User', 'pro', 'ctm_paddle_456', 'sub_paddle_123', 1000, 1000).run();

    // 2. Construct Paddle cancel event
    const event = {
      event_id: 'evt_cancel_001',
      event_type: 'subscription.canceled',
      data: {
        id: 'sub_paddle_123',
        customer_id: 'ctm_paddle_456',
        status: 'canceled',
        custom_data: {
          user_id: userId,
        },
      },
    };
    const rawBody = JSON.stringify(event);
    const signature = await generatePaddleSignature(rawBody, WEBHOOK_SECRET);

    const res = await app.request('/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': signature,
      },
      body: rawBody,
    }, mockEnv());

    expect(res.status).toBe(200);

    // 3. Verify user was downgraded to 'free'
    const user = await db
      .prepare('SELECT tier FROM users WHERE id = ?')
      .bind(userId)
      .first<{ tier: string }>();

    expect(user!.tier).toBe('free');
  });

  describe('Customer Portal Seam', () => {
    it('POST /api/billing/portal requires authentication', async () => {
      const res = await app.request('/api/billing/portal', {
        method: 'POST',
      }, mockEnv());
      expect(res.status).toBe(401);
    });

    it('POST /api/billing/portal rejects users without billing customer record', async () => {
      const userId = 'usr_free_user';
      await db.prepare(
        'INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, 'free@example.com', 'free', 1000, 1000).run();

      const sessionId = 'sess_free_user';
      await db.prepare(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionId, userId, Date.now() + 100000).run();

      const res = await app.request('/api/billing/portal', {
        method: 'POST',
        headers: {
          Cookie: `session=${sessionId}`,
        },
      }, mockEnv());

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain('No active subscription');
    });

    it('POST /api/billing/portal returns portal URL for users with customer ID', async () => {
      const userId = 'usr_pro_customer';
      const customerId = 'ctm_paid_123';
      await db.prepare(
        'INSERT INTO users (id, email, tier, paddle_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, 'pro@example.com', 'pro', customerId, 1000, 1000).run();

      const sessionId = 'sess_pro_customer';
      await db.prepare(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionId, userId, Date.now() + 100000).run();

      const res = await app.request('/api/billing/portal', {
        method: 'POST',
        headers: {
          Cookie: `session=${sessionId}`,
        },
      }, mockEnv());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.url).toContain(customerId);
    });
  });
});
