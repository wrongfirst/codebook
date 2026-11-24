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
import { upsertOAuthUser } from '../auth/user';
import { DUMMY_PASSWORD_HASH, MAX_PASSWORD_LENGTH, verifyPassword } from '../auth/password';
import {
  checkLoginRateLimit,
  clearEmailLoginFailures,
  getClientIp,
  recordFailedLogin,
} from '../auth/rateLimit';

const auth = new Hono<{ Bindings: Env }>();
const OAUTH_RETURN_TO_COOKIE = 'oauth_return_to';

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
// Email + Password Login
// ----------------------------------------------------
auth.post('/login/password', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  let body: { email?: string; password?: string; 'cf-turnstile-response'?: string };
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

  const clientIp = getClientIp(c.req.raw);

  const expectedAction = 'login';
  const expectedHostnames = new Set(
    (c.env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );
  const turnstileSecret = c.env.TURNSTILE_SECRET_KEY;
  const turnstileToken = body['cf-turnstile-response'];

  if (
    typeof turnstileSecret !== 'string' ||
    turnstileSecret.length === 0 ||
    typeof turnstileToken !== 'string' ||
    turnstileToken.length === 0 ||
    turnstileToken.length > 2048 ||
    expectedHostnames.size === 0
  ) {
    return c.json({ error: 'Verification failed. Please try again.' }, 403);
  }

  let siteverifyResult: {
    success?: boolean;
    action?: string;
    hostname?: string;
  };
  try {
    const formData = new URLSearchParams({
      secret: turnstileSecret,
      response: turnstileToken,
    });
    if (clientIp) {
      formData.set('remoteip', clientIp);
    }
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: formData,
    });
    if (!verifyRes.ok) {
      throw new Error(`siteverify ${verifyRes.status}`);
    }
    siteverifyResult = (await verifyRes.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
  } catch {
    return c.json({ error: 'Verification failed. Please try again.' }, 403);
  }

  if (
    !siteverifyResult.success ||
    siteverifyResult.action !== expectedAction ||
    typeof siteverifyResult.hostname !== 'string' ||
    !expectedHostnames.has(siteverifyResult.hostname)
  ) {
    return c.json({ error: 'Verification failed. Please try again.' }, 403);
  }

  const rateLimit = await checkLoginRateLimit(db, { email, ip: clientIp });
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds) {
      c.header('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    return c.json({ error: 'Too many failed login attempts. Please try again later.' }, 429);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    await recordFailedLogin(db, { email, ip: clientIp });
    return c.json({ error: 'Invalid email or password' }, 401);
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
        password_hash as passwordHash,
        email_verified_at as emailVerifiedAt
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
      emailVerifiedAt: number | null;
    }>();

  const valid = await verifyPassword(password, row?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!row || !row.passwordHash || !valid) {
    await recordFailedLogin(db, { email, ip: clientIp });
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (row.emailVerifiedAt === null) {
    return c.json({ error: 'Please verify your email address before signing in.' }, 403);
  }

  await clearEmailLoginFailures(db, email);

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
