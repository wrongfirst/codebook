import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { D1Database } from '@cloudflare/workers-types';

export const SESSION_COOKIE_NAME = 'session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tier: 'free' | 'pro';
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
}

export function generateId(prefix: string = ''): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${hex}` : hex;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const sessionId = generateId('sess');
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt)
    .run();
  return sessionId;
}

export async function validateSession(db: D1Database, sessionId: string): Promise<AuthUser | null> {
  const now = Date.now();
  const row = await db
    .prepare(`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.avatar_url as avatarUrl, 
        u.tier,
        u.paddle_customer_id as paddleCustomerId,
        u.paddle_subscription_id as paddleSubscriptionId,
        s.expires_at as expiresAt
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `)
    .bind(sessionId)
    .first<AuthUser & { expiresAt: number }>();

  if (!row) return null;

  if (row.expiresAt < now) {
    await deleteSession(db, sessionId);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    tier: (row.tier as 'free' | 'pro') || 'free',
    paddleCustomerId: row.paddleCustomerId,
    paddleSubscriptionId: row.paddleSubscriptionId,
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  });
}

export function getSessionIdFromCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}
