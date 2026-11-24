import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../index';
import { createTestD1 } from '../test/d1';
import { upsertOAuthUser, updateUserPassword } from '../auth/user';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '../auth/password';
import { createSession } from '../auth/session';
import { MAX_EMAIL_FAILURES } from '../auth/rateLimit';
import type { D1Database } from '@cloudflare/workers-types';

describe('Auth HTTP Boundary Seam', () => {
  let db: D1Database;
  const mockEnv = () => ({
    DB: db,
    GITHUB_CLIENT_ID: 'mock-gh-client-id',
    GITHUB_CLIENT_SECRET: 'mock-gh-client-secret',
    GOOGLE_CLIENT_ID: 'mock-google-client-id',
    GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
    TURNSTILE_SECRET_KEY: 'mock-turnstile-secret',
    TURNSTILE_HOSTNAMES: 'wrongfirst.dev,next.wrongfirst.dev',
  });

  beforeEach(() => {
    db = createTestD1();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('GET /api/auth/login/github preserves valid subpath returnTo cookie and rejects open redirects', async () => {
    const validRes = await app.request(
      'https://next.wrongfirst.dev/api/auth/login/github?returnTo=%2Fcodebook%2F%23ex-1',
      {},
      mockEnv()
    );
    expect(validRes.status).toBe(302);
    const cookies = validRes.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('github_oauth_state=') && c.includes('Secure'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('oauth_return_to=%2Fcodebook%2F%23ex-1'))).toBe(true);

    const evilRes = await app.request(
      '/api/auth/login/github?returnTo=https%3A%2F%2Fevil.example%2Fphish',
      {},
      mockEnv()
    );
    expect(evilRes.status).toBe(302);
    expect(evilRes.headers.getSetCookie().some((c) => c.startsWith('oauth_return_to='))).toBe(false);
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

  describe('Password Authentication Seam', () => {
    const VALID_TOKEN = 'valid-turnstile-token';

    function mockSiteverify(response: {
      success: boolean;
      action?: string;
      hostname?: string;
      'error-codes'?: string[];
    }) {
      return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    beforeEach(() => {
      mockSiteverify({
        success: true,
        action: 'login',
        hostname: 'wrongfirst.dev',
      });
    });

    it('hashPassword and verifyPassword round-trip and reject wrong passwords', async () => {
      const hash = await hashPassword('correct-horse-battery-staple');
      expect(hash.startsWith('pbkdf2_sha256$100000$')).toBe(true);
      expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
      expect(await verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('POST /api/auth/login/password enforces Turnstile token, action, hostname, and single-use verification', async () => {
      const passwordHash = await hashPassword('super-secret-123');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_ts_1', 'ts@wrongfirst.dev', 'TS', 'free', passwordHash, now, now, now)
        .run();

      // Missing token -> 403
      const missingRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'ts@wrongfirst.dev', password: 'super-secret-123' }),
        },
        mockEnv()
      );
      expect(missingRes.status).toBe(403);

      // Overlong token -> 403
      const overlongRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ts@wrongfirst.dev',
            password: 'super-secret-123',
            'cf-turnstile-response': 'x'.repeat(2049),
          }),
        },
        mockEnv()
      );
      expect(overlongRes.status).toBe(403);

      // Wrong action -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: true, action: 'signup', hostname: 'wrongfirst.dev' });
      const wrongActionRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ts@wrongfirst.dev',
            password: 'super-secret-123',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(wrongActionRes.status).toBe(403);

      // Wrong hostname -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: true, action: 'login', hostname: 'evil.example' });
      const wrongHostRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ts@wrongfirst.dev',
            password: 'super-secret-123',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(wrongHostRes.status).toBe(403);

      // Failed / replayed token -> 403
      vi.restoreAllMocks();
      mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
      const replayRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ts@wrongfirst.dev',
            password: 'super-secret-123',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(replayRes.status).toBe(403);
    });

    it('POST /api/auth/login/password authenticates verified user with valid password and sets session cookie', async () => {
      const passwordHash = await hashPassword('super-secret-123');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_pw_1', 'admin@wrongfirst.dev', 'Admin', 'pro', passwordHash, now, now, now)
        .run();

      const loginRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'Admin@Wrongfirst.dev',
            password: 'super-secret-123',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );

      expect(loginRes.status).toBe(200);
      const body = (await loginRes.json()) as any;
      expect(body.user.id).toBe('usr_pw_1');
      expect(body.user.tier).toBe('pro');

      const setCookie = loginRes.headers.get('Set-Cookie');
      expect(setCookie).toContain('session=sess_');

      const sessionCookie = setCookie!.split(';')[0];
      const meRes = await app.request(
        '/api/auth/me',
        { headers: { Cookie: sessionCookie } },
        mockEnv()
      );
      expect(meRes.status).toBe(200);
      const meBody = (await meRes.json()) as any;
      expect(meBody.user.email).toBe('admin@wrongfirst.dev');
    });

    it('POST /api/auth/login/password rejects wrong password, unknown email, or passwordless user', async () => {
      const passwordHash = await hashPassword('right-password');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_pw_2', 'user@wrongfirst.dev', 'User', 'free', passwordHash, now, now)
        .run();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_nopw', 'oauth@wrongfirst.dev', 'OAuth User', 'free', now, now)
        .run();

      const badPw = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'user@wrongfirst.dev',
            password: 'wrong-password',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(badPw.status).toBe(401);

      const unknown = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nobody@wrongfirst.dev',
            password: 'right-password',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(unknown.status).toBe(401);

      const noPwUser = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'oauth@wrongfirst.dev',
            password: 'anything',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(noPwUser.status).toBe(401);

      const overlongPw = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'user@wrongfirst.dev',
            password: 'a'.repeat(300),
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(overlongPw.status).toBe(401);
    });

    it('rejects unverified email accounts with 403 only after password matches', async () => {
      const passwordHash = await hashPassword('valid-unverified-pass');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)'
        )
        .bind('usr_unverified', 'unverified@wrongfirst.dev', 'Unverified', 'free', passwordHash, now, now)
        .run();

      const wrongPw = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'unverified@wrongfirst.dev',
            password: 'wrong-password',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(wrongPw.status).toBe(401);

      const rightPw = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'unverified@wrongfirst.dev',
            password: 'valid-unverified-pass',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(rightPw.status).toBe(403);
      const rightPwBody = (await rightPw.json()) as { error?: string };
      expect(rightPwBody.error).toContain('verify your email');
    });

    it('neutralizes pre-hijacking when verified OAuth signs in over an unverified password squat', async () => {
      const passwordHash = await hashPassword('attacker-squat-pass');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)'
        )
        .bind('usr_squat', 'victim@wrongfirst.dev', 'Squatter', 'free', passwordHash, now, now)
        .run();

      const staleSession = await createSession(db, 'usr_squat');

      await upsertOAuthUser(db, {
        provider: 'github',
        providerUserId: 'gh_victim_1',
        email: 'victim@wrongfirst.dev',
        name: 'Real Owner',
      });

      const row = await db
        .prepare('SELECT password_hash as passwordHash, email_verified_at as emailVerifiedAt FROM users WHERE id = ?')
        .bind('usr_squat')
        .first<{ passwordHash: string | null; emailVerifiedAt: number | null }>();

      expect(row?.passwordHash).toBeNull();
      expect(row?.emailVerifiedAt).not.toBeNull();

      const meRes = await app.request(
        '/api/auth/me',
        { headers: { Cookie: `session=${staleSession}` } },
        mockEnv()
      );
      expect(meRes.status).toBe(401);
    });

    it('locks account with 429 after repeated failed logins across rotating IPs and clears on success', async () => {
      const passwordHash = await hashPassword('locked-test-pass-123');
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_rl_1', 'target@wrongfirst.dev', 'Target', 'free', passwordHash, now, now, now)
        .run();

      for (let i = 0; i < MAX_EMAIL_FAILURES; i++) {
        const res = await app.request(
          '/api/auth/login/password',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Connecting-IP': `198.51.100.${i + 1}`,
            },
            body: JSON.stringify({
              email: 'target@wrongfirst.dev',
              password: 'wrong',
              'cf-turnstile-response': VALID_TOKEN,
            }),
          },
          mockEnv()
        );
        expect(res.status).toBe(401);
      }

      // Next attempt (even with the correct password!) is blocked with 429 + Retry-After
      const lockedRes = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.99',
          },
          body: JSON.stringify({
            email: 'target@wrongfirst.dev',
            password: 'locked-test-pass-123',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(lockedRes.status).toBe(429);
      expect(Number(lockedRes.headers.get('Retry-After'))).toBeGreaterThan(0);
    });

    it('enforces NIST length policy and revokes all existing sessions on updateUserPassword', async () => {
      expect(validatePasswordPolicy('short').valid).toBe(false);
      expect(validatePasswordPolicy('a'.repeat(257)).valid).toBe(false);
      expect(validatePasswordPolicy('correct horse battery staple').valid).toBe(true);

      const now = Date.now();
      const oldHash = await hashPassword('old-password-12345');
      await db
        .prepare(
          'INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind('usr_pw_chg', 'rotate@wrongfirst.dev', 'Rotate', 'free', oldHash, now, now, now)
        .run();

      const sess1 = await createSession(db, 'usr_pw_chg');
      const sess2 = await createSession(db, 'usr_pw_chg');

      await updateUserPassword(db, 'usr_pw_chg', 'brand-new-passphrase-2026');

      const s1Res = await app.request('/api/auth/me', { headers: { Cookie: `session=${sess1}` } }, mockEnv());
      const s2Res = await app.request('/api/auth/me', { headers: { Cookie: `session=${sess2}` } }, mockEnv());
      expect(s1Res.status).toBe(401);
      expect(s2Res.status).toBe(401);

      const loginNew = await app.request(
        '/api/auth/login/password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'rotate@wrongfirst.dev',
            password: 'brand-new-passphrase-2026',
            'cf-turnstile-response': VALID_TOKEN,
          }),
        },
        mockEnv()
      );
      expect(loginNew.status).toBe(200);
    });
  });
});
