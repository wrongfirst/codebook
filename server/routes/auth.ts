import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { GitHub, Google, generateState, generateCodeVerifier } from 'arctic';
import type { Env } from '../index';
import {
  createSession,
  validateSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromCookie,
  generateId,
  isSecureRequest,
} from '../auth/session';
import { upsertOAuthUser, upsertEmailUser } from '../auth/user';
import { verifyPassword } from '../auth/password';

const auth = new Hono<{ Bindings: Env }>();
const OAUTH_RETURN_TO_COOKIE = 'oauth_return_to';
const DEFAULT_AUTH_FROM_EMAIL = 'Wrongfirst <auth@wrongfirst.dev>';

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * Only allow same-origin relative paths (e.g. `/codebook/#ex-1`) to prevent open redirects.
 */
export function sanitizeReturnTo(raw?: string | null): string {
  if (!raw) return '/';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  if (/[\r\n]/.test(trimmed)) {
    return '/';
  }
  return trimmed;
}

function setReturnToCookie(c: Parameters<typeof setCookie>[0], raw?: string | null): void {
  const returnTo = sanitizeReturnTo(raw);
  if (returnTo === '/') return;
  setCookie(c, OAUTH_RETURN_TO_COOKIE, returnTo, {
    path: '/',
    httpOnly: true,
    secure: isSecureRequest(c.req.raw),
    sameSite: 'Lax',
    maxAge: 600,
  });
}

function consumeReturnToCookie(c: Parameters<typeof getCookie>[0]): string {
  const stored = getCookie(c, OAUTH_RETURN_TO_COOKIE);
  if (stored) {
    deleteCookie(c, OAUTH_RETURN_TO_COOKIE, { path: '/' });
  }
  return sanitizeReturnTo(stored);
}

// ----------------------------------------------------
// GitHub OAuth
// ----------------------------------------------------
auth.get('/login/github', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.text('GitHub OAuth is not configured', 500);
  }

  const origin = getOrigin(c.req.raw);
  const redirectUri = `${origin}/api/auth/callback/github`;
  const github = new GitHub(clientId, clientSecret, redirectUri);

  const state = generateState();
  const url = github.createAuthorizationURL(state, ['user:email']);

  setCookie(c, 'github_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: isSecureRequest(c.req.raw),
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
  });
  setReturnToCookie(c, c.req.query('returnTo'));

  return c.redirect(url.toString(), 302);
});

auth.get('/callback/github', async (c) => {
  const db = c.env.DB;
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;
  if (!db || !clientId || !clientSecret) {
    return c.text('Server misconfiguration', 500);
  }

  const query = c.req.query();
  const code = query.code;
  const state = query.state;
  const storedState = getCookie(c, 'github_oauth_state');

  if (!code || !state || !storedState || state !== storedState) {
    return c.text('Invalid OAuth state or missing code', 400);
  }

  deleteCookie(c, 'github_oauth_state', { path: '/' });

  try {
    const origin = getOrigin(c.req.raw);
    const redirectUri = `${origin}/api/auth/callback/github`;
    const github = new GitHub(clientId, clientSecret, redirectUri);
    const tokens = await github.validateAuthorizationCode(code);

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
        'User-Agent': 'Codebook-App',
      },
    });
    const ghUser = await userRes.json() as { id: number; name?: string; login: string; avatar_url?: string; email?: string };

    let primaryEmail = ghUser.email;
    if (!primaryEmail) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
          'User-Agent': 'Codebook-App',
        },
      });
      const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const verifiedPrimary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified);
      if (verifiedPrimary) {
        primaryEmail = verifiedPrimary.email;
      }
    }

    if (!primaryEmail) {
      return c.text('A verified email address is required from GitHub', 400);
    }

    const user = await upsertOAuthUser(db, {
      provider: 'github',
      providerUserId: String(ghUser.id),
      email: primaryEmail,
      name: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });

    const sessionId = await createSession(db, user.id);
    setSessionCookie(c, sessionId);

    return c.redirect(consumeReturnToCookie(c), 302);
  } catch (err: any) {
    console.error('[OAuth GitHub Error]:', err);
    return c.text('Failed to authenticate with GitHub', 500);
  }
});

// ----------------------------------------------------
// Google OAuth
// ----------------------------------------------------
auth.get('/login/google', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.text('Google OAuth is not configured', 500);
  }

  const origin = getOrigin(c.req.raw);
  const redirectUri = `${origin}/api/auth/callback/google`;
  const google = new Google(clientId, clientSecret, redirectUri);

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

  setCookie(c, 'google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: isSecureRequest(c.req.raw),
    sameSite: 'Lax',
    maxAge: 600,
  });

  setCookie(c, 'google_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: isSecureRequest(c.req.raw),
    sameSite: 'Lax',
    maxAge: 600,
  });
  setReturnToCookie(c, c.req.query('returnTo'));

  return c.redirect(url.toString(), 302);
});

auth.get('/callback/google', async (c) => {
  const db = c.env.DB;
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!db || !clientId || !clientSecret) {
    return c.text('Server misconfiguration', 500);
  }

  const query = c.req.query();
  const code = query.code;
  const state = query.state;
  const storedState = getCookie(c, 'google_oauth_state');
  const codeVerifier = getCookie(c, 'google_code_verifier');

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return c.text('Invalid OAuth state or missing code verifier', 400);
  }

  deleteCookie(c, 'google_oauth_state', { path: '/' });
  deleteCookie(c, 'google_code_verifier', { path: '/' });

  try {
    const origin = getOrigin(c.req.raw);
    const redirectUri = `${origin}/api/auth/callback/google`;
    const google = new Google(clientId, clientSecret, redirectUri);
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    });
    const gUser = await userRes.json() as { sub: string; name?: string; email: string; email_verified?: boolean; picture?: string };

    if (!gUser.email || gUser.email_verified === false) {
      return c.text('A verified Google email address is required', 400);
    }

    const user = await upsertOAuthUser(db, {
      provider: 'google',
      providerUserId: gUser.sub,
      email: gUser.email,
      name: gUser.name,
      avatarUrl: gUser.picture,
    });

    const sessionId = await createSession(db, user.id);
    setSessionCookie(c, sessionId);

    return c.redirect(consumeReturnToCookie(c), 302);
  } catch (err: any) {
    console.error('[OAuth Google Error]:', err);
    return c.text('Failed to authenticate with Google', 500);
  }
});

// ----------------------------------------------------
// Passwordless Magic Link
// ----------------------------------------------------
auth.post('/magic-link', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  let body: { email?: string; returnTo?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  const token = generateId('tok');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

  await db
    .prepare('INSERT INTO verification_tokens (token, email, expires_at) VALUES (?, ?, ?)')
    .bind(token, email, expiresAt)
    .run();

  const origin = getOrigin(c.req.raw);
  const returnTo = sanitizeReturnTo(body.returnTo);
  const returnQuery = returnTo !== '/' ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
  const verifyUrl = `${origin}/api/auth/verify?token=${token}${returnQuery}`;

  const resendApiKey = c.env.RESEND_API_KEY;
  if (resendApiKey) {
    const fromEmail = c.env.AUTH_FROM_EMAIL?.trim() || DEFAULT_AUTH_FROM_EMAIL;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'Sign in to Wrongfirst',
          html: `<p>Click here to sign in to Wrongfirst:</p><p><a href="${verifyUrl}">Sign in to Wrongfirst</a></p><p>This link will expire in 15 minutes.</p>`,
        }),
      });
    } catch (err) {
      console.error('[Magic Link Email Error]:', err);
    }
  } else {
    console.log(`[Magic Link Dev URL]: ${verifyUrl}`);
  }

  return c.json({ success: true });
});

auth.get('/verify', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.text('Database unavailable', 500);
  }

  const token = c.req.query('token');
  if (!token) {
    return c.text('Missing verification token', 400);
  }

  const record = await db
    .prepare('SELECT token, email, expires_at FROM verification_tokens WHERE token = ?')
    .bind(token)
    .first<{ token: string; email: string; expires_at: number }>();

  if (!record || record.expires_at < Date.now()) {
    if (record) {
      await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();
    }
    return c.text('Invalid or expired verification link', 400);
  }

  // One-time use: delete token immediately
  await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();

  const user = await upsertEmailUser(db, record.email);
  const sessionId = await createSession(db, user.id);
  setSessionCookie(c, sessionId);

  return c.redirect(sanitizeReturnTo(c.req.query('returnTo')), 302);
});

// ----------------------------------------------------
// Email + Password Login
// ----------------------------------------------------
auth.post('/login/password', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const row = await db
    .prepare(`
      SELECT
        id,
        email,
        name,
        avatar_url as avatarUrl,
        tier,
        paddle_customer_id as paddleCustomerId,
        paddle_subscription_id as paddleSubscriptionId,
        password_hash as passwordHash
      FROM users
      WHERE email = ?
    `)
    .bind(email)
    .first<{
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      tier: 'free' | 'pro';
      paddleCustomerId: string | null;
      paddleSubscriptionId: string | null;
      passwordHash: string | null;
    }>();

  if (!row || !row.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const sessionId = await createSession(db, row.id);
  setSessionCookie(c, sessionId);

  return c.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      tier: row.tier || 'free',
      paddleCustomerId: row.paddleCustomerId,
      paddleSubscriptionId: row.paddleSubscriptionId,
    },
  });
});

// ----------------------------------------------------
// Session Management
// ----------------------------------------------------
auth.get('/me', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ user: null }, 401);
  }

  const sessionId = getSessionIdFromCookie(c);
  if (!sessionId) {
    return c.json({ user: null }, 401);
  }

  const user = await validateSession(db, sessionId);
  if (!user) {
    clearSessionCookie(c);
    return c.json({ user: null }, 401);
  }

  return c.json({ user });
});

auth.post('/logout', async (c) => {
  const db = c.env.DB;
  const sessionId = getSessionIdFromCookie(c);
  if (db && sessionId) {
    await deleteSession(db, sessionId);
  }
  clearSessionCookie(c);
  return c.json({ success: true });
});

export default auth;
