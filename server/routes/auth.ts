import { Hono } from 'hono';
import type { Env } from '../index';
import {
  createSession,
  validateSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromCookie,
  generateId,
} from '../auth/session';
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

function getOrigin(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

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
