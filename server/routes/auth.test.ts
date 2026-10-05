import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index';
import { createTestD1 } from '../test/d1';
import { upsertOAuthUser } from '../auth/user';
import type { D1Database } from '@cloudflare/workers-types';

describe('Auth HTTP Boundary Seam', () => {
  let db: D1Database;
  const mockEnv = () => ({
    DB: db,
    GITHUB_CLIENT_ID: 'mock-gh-client-id',
    GITHUB_CLIENT_SECRET: 'mock-gh-client-secret',
    GOOGLE_CLIENT_ID: 'mock-google-client-id',
    GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
  });

  beforeEach(() => {
    db = createTestD1();
  });

  it('GET /api/auth/login/github redirects to GitHub OAuth and sets state cookie', async () => {
    const res = await app.request('/api/auth/login/github', {}, mockEnv());
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('github.com/login/oauth/authorize');
    expect(location).toContain('client_id=mock-gh-client-id');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('github_oauth_state=');
  });

  it('GET /api/auth/login/google redirects to Google OAuth and sets state & code_verifier cookies', async () => {
    const res = await app.request('/api/auth/login/google', {}, mockEnv());
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=mock-google-client-id');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('google_oauth_state=');
    expect(setCookie).toContain('google_code_verifier=');
  });

  it('GET /api/auth/me returns 401 when unauthenticated', async () => {
    const res = await app.request('/api/auth/me', {}, mockEnv());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ user: null });
  });

  it('Creates session, retrieves profile via /api/auth/me, and logs out cleanly', async () => {
    // 1. Manually insert a test user into D1
    const userId = 'usr_test123';
    const email = 'developer@example.com';
    const now = Date.now();
    await db.prepare(
      'INSERT INTO users (id, email, name, avatar_url, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, 'Test Dev', 'https://example.com/avatar.png', 'free', now, now).run();

    // 2. Insert a valid session
    const sessionId = 'sess_abc123xyz';
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    await db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, expiresAt).run();

    // 3. Test GET /api/auth/me with session cookie
    const meRes = await app.request('/api/auth/me', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    }, mockEnv());

    expect(meRes.status).toBe(200);
    const meBody = await meRes.json() as any;
    expect(meBody.user).toEqual({
      id: userId,
      email,
      name: 'Test Dev',
      avatarUrl: 'https://example.com/avatar.png',
      tier: 'free',
      paddleCustomerId: null,
      paddleSubscriptionId: null,
    });

    // 4. Test POST /api/auth/logout with session cookie
    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionId}`,
      },
    }, mockEnv());

    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.headers.get('Set-Cookie');
    expect(logoutCookie).toContain('session=;');

    // 5. Subsequent /api/auth/me returns 401
    const meAfterLogout = await app.request('/api/auth/me', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    }, mockEnv());
    expect(meAfterLogout.status).toBe(401);
  });

  it('Links multiple OAuth providers sharing the same verified email to the same user record', async () => {
    const email = 'learner@example.com';

    // 1. First login with GitHub
    const ghUser = await upsertOAuthUser(db, {
      provider: 'github',
      providerUserId: 'gh_9999',
      email,
      name: 'GitHub Learner',
      avatarUrl: 'https://avatars.githubusercontent.com/u/9999',
    });
    expect(ghUser.id).toMatch(/^usr_/);
    expect(ghUser.email).toBe(email);

    // 2. Second login with Google using same email
    const googleUser = await upsertOAuthUser(db, {
      provider: 'google',
      providerUserId: 'google_12345',
      email,
      name: 'Google Learner',
      avatarUrl: 'https://lh3.googleusercontent.com/12345',
    });

    // Should resolve to the exact same user ID
    expect(googleUser.id).toBe(ghUser.id);
    expect(googleUser.email).toBe(email);

    // Verify both oauth_accounts exist in D1 pointing to the same user_id
    const accounts = await db
      .prepare('SELECT provider, provider_user_id FROM oauth_accounts WHERE user_id = ? ORDER BY provider ASC')
      .bind(ghUser.id)
      .all<{ provider: string; provider_user_id: string }>();

    expect(accounts.results).toHaveLength(2);
    expect(accounts.results[0]).toEqual({ provider: 'github', provider_user_id: 'gh_9999' });
    expect(accounts.results[1]).toEqual({ provider: 'google', provider_user_id: 'google_12345' });
  });

  describe('Passwordless Magic Link Seam', () => {
    it('POST /api/auth/magic-link validates email format', async () => {
      const res = await app.request('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }, mockEnv());

      expect(res.status).toBe(400);
    });

    it('POST /api/auth/magic-link creates verification token in D1', async () => {
      const email = 'magic@example.com';
      const res = await app.request('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }, mockEnv());

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);

      const tokenRecord = await db
        .prepare('SELECT * FROM verification_tokens WHERE email = ?')
        .bind(email)
        .first<{ token: string; email: string; expires_at: number }>();

      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord!.token).toBeDefined();
      expect(tokenRecord!.expires_at).toBeGreaterThan(Date.now());
    });

    it('GET /api/auth/verify verifies token, creates session, and prevents reuse', async () => {
      const email = 'magic-user@example.com';
      const token = 'tok_valid_test_12345';
      const expiresAt = Date.now() + 15 * 60 * 1000;

      await db
        .prepare('INSERT INTO verification_tokens (token, email, expires_at) VALUES (?, ?, ?)')
        .bind(token, email, expiresAt)
        .run();

      // 1. Verify with valid token
      const res = await app.request(`/api/auth/verify?token=${token}`, {}, mockEnv());
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('session=');

      // 2. Token must be consumed/deleted
      const deletedToken = await db
        .prepare('SELECT * FROM verification_tokens WHERE token = ?')
        .bind(token)
        .first();
      expect(deletedToken).toBeNull();

      // 3. User must be created in D1
      const user = await db
        .prepare('SELECT * FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: string; email: string; tier: string }>();
      expect(user).not.toBeNull();
      expect(user!.tier).toBe('free');

      // 4. Reusing the same token fails
      const replayRes = await app.request(`/api/auth/verify?token=${token}`, {}, mockEnv());
      expect(replayRes.status).toBe(400);
    });

    it('GET /api/auth/verify rejects expired tokens', async () => {
      const email = 'expired@example.com';
      const token = 'tok_expired_12345';
      const expiresAt = Date.now() - 1000; // Expired 1 second ago

      await db
        .prepare('INSERT INTO verification_tokens (token, email, expires_at) VALUES (?, ?, ?)')
        .bind(token, email, expiresAt)
        .run();

      const res = await app.request(`/api/auth/verify?token=${token}`, {}, mockEnv());
      expect(res.status).toBe(400);
    });

    it('Seamlessly links Magic Link account to subsequent OAuth logins with the same email', async () => {
      const email = 'crosslink@example.com';
      const token = 'tok_crosslink_1';
      const expiresAt = Date.now() + 15 * 60 * 1000;

      await db
        .prepare('INSERT INTO verification_tokens (token, email, expires_at) VALUES (?, ?, ?)')
        .bind(token, email, expiresAt)
        .run();

      // 1. User signs in first via magic link
      await app.request(`/api/auth/verify?token=${token}`, {}, mockEnv());
      const user = await db
        .prepare('SELECT id, email FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: string; email: string }>();

      expect(user).not.toBeNull();

      // 2. Later, user logs in via GitHub with the same email
      const ghUser = await upsertOAuthUser(db, {
        provider: 'github',
        providerUserId: 'gh_cross_99',
        email,
        name: 'Crosslink Dev',
      });

      // 3. User ID should be preserved and linked
      expect(ghUser.id).toBe(user!.id);
      expect(ghUser.name).toBe('Crosslink Dev');

      const linkedAccount = await db
        .prepare('SELECT provider, provider_user_id FROM oauth_accounts WHERE user_id = ?')
        .bind(user!.id)
        .first<{ provider: string; provider_user_id: string }>();

      expect(linkedAccount).toEqual({ provider: 'github', provider_user_id: 'gh_cross_99' });
    });
  });
});
