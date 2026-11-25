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
import {
  DUMMY_PASSWORD_HASH,
  MAX_PASSWORD_LENGTH,
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from '../auth/password';
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

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifyTurnstile(
  env: Env,
  turnstileToken: unknown,
  expectedAction: string,
  clientIp: string | null
): Promise<boolean> {
  const expectedHostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;

  if (
    typeof turnstileSecret !== 'string' ||
    turnstileSecret.length === 0 ||
    typeof turnstileToken !== 'string' ||
    turnstileToken.length === 0 ||
    turnstileToken.length > 2048 ||
    expectedHostnames.size === 0
  ) {
    return false;
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
    return false;
  }

  const isTurnstileTestSecret =
    turnstileSecret === '1x0000000000000000000000000000000AA';

  return (
    Boolean(siteverifyResult.success) &&
    (isTurnstileTestSecret ||
      (siteverifyResult.action === expectedAction &&
        typeof siteverifyResult.hostname === 'string' &&
        expectedHostnames.has(siteverifyResult.hostname)))
  );
}

async function sendVerificationEmail(
  env: Env,
  email: string,
  verifyUrl: string
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('[Auth] RESEND_API_KEY is not configured');
    return false;
  }

  const from = env.AUTH_FROM_EMAIL?.trim() || 'WrongFirst <noreply@wrongfirst.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your email address',
      html: `
        <p>Welcome to Codebook!</p>
        <p>Click the link below to verify your email address and sign in:</p>
        <p><a href="${verifyUrl}">Verify email address</a></p>
        <p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[Auth] Resend email failed:', res.status, errText);
    return false;
  }

  return true;
}

// ----------------------------------------------------
// Email + Password Signup & Verification
// ----------------------------------------------------
auth.post('/signup', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  let body: { email?: string; password?: string; name?: string; 'cf-turnstile-response'?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const name = body.name?.trim() || null;

  if (!email || !BASIC_EMAIL_REGEX.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  const policy = validatePasswordPolicy(password ?? '');
  if (!policy.valid) {
    return c.json({ error: policy.error || 'Invalid password' }, 400);
  }

  const clientIp = getClientIp(c.req.raw);
  const turnstileOk = await verifyTurnstile(
    c.env,
    body['cf-turnstile-response'],
    'signup',
    clientIp
  );
  if (!turnstileOk) {
    return c.json({ error: 'Verification failed. Please try again.' }, 403);
  }

  const genericMessage = 'Verification email sent. Please check your inbox to verify your account.';

  const existing = await db
    .prepare('SELECT id, email_verified_at as emailVerifiedAt FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; emailVerifiedAt: number | null }>();

  // Avoid leaking whether a verified account already exists
  if (existing && existing.emailVerifiedAt !== null) {
    return c.json({ ok: true, message: genericMessage });
  }

  const passwordHash = await hashPassword(password!);
  const now = Date.now();

  if (existing) {
    await db
      .prepare('UPDATE users SET password_hash = ?, name = COALESCE(?, name), updated_at = ? WHERE id = ?')
      .bind(passwordHash, name, now, existing.id)
      .run();
  } else {
    const userId = generateId('usr');
    await db
      .prepare(`
        INSERT INTO users (id, email, name, tier, password_hash, email_verified_at, created_at, updated_at)
        VALUES (?, ?, ?, 'free', ?, NULL, ?, ?)
      `)
      .bind(userId, email, name, passwordHash, now, now)
      .run();
  }

  const token = generateId('ver');
  const expiresAt = now + VERIFICATION_TOKEN_TTL_MS;

  await db.prepare('DELETE FROM verification_tokens WHERE email = ?').bind(email).run();
  await db
    .prepare('INSERT INTO verification_tokens (token, email, expires_at) VALUES (?, ?, ?)')
    .bind(token, email, expiresAt)
    .run();

  const origin = getOrigin(c.req.raw);
  const verifyUrl = `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendVerificationEmail(c.env, email, verifyUrl);
  if (!sent) {
    return c.json({ error: 'Failed to send verification email. Please try again later.' }, 500);
  }

  return c.json({ ok: true, message: genericMessage });
});

auth.get('/verify-email', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.text('Database unavailable', 500);
  }

  const token = c.req.query('token')?.trim();
  if (!token) {
    return c.text('Missing verification token', 400);
  }

  const record = await db
    .prepare('SELECT email, expires_at as expiresAt FROM verification_tokens WHERE token = ?')
    .bind(token)
    .first<{ email: string; expiresAt: number }>();

  if (!record) {
    return c.text('Invalid or expired verification link', 400);
  }

  await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();

  if (record.expiresAt < Date.now()) {
    return c.text('Verification link has expired. Please sign up again.', 400);
  }

  const user = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(record.email)
    .first<{ id: string }>();

  if (!user) {
    return c.text('Account not found', 404);
  }

  const now = Date.now();
  await db
    .prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?')
    .bind(now, now, user.id)
    .run();

  const sessionId = await createSession(db, user.id);
  setSessionCookie(c, sessionId);

  return c.redirect('/', 302);
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
  const turnstileOk = await verifyTurnstile(
    c.env,
    body['cf-turnstile-response'],
    'login',
    clientIp
  );
  if (!turnstileOk) {
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
