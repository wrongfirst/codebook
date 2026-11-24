import type { D1Database } from '@cloudflare/workers-types';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_EMAIL_FAILURES = 10;
export const MAX_IP_FAILURES = 20;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface AttemptRow {
  failed_count: number;
  first_failed_at: number;
  locked_until: number | null;
}

export function getClientIp(req: Request): string | null {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return null;
}

function buildKeys(email: string, ip: string | null): Array<{ key: string; limit: number }> {
  const keys: Array<{ key: string; limit: number }> = [
    { key: `email:${email.toLowerCase().trim()}`, limit: MAX_EMAIL_FAILURES },
  ];
  if (ip) {
    keys.push({ key: `ip:${ip}`, limit: MAX_IP_FAILURES });
  }
  return keys;
}

export async function checkLoginRateLimit(
  db: D1Database,
  opts: { email: string; ip: string | null; now?: number }
): Promise<RateLimitResult> {
  const now = opts.now ?? Date.now();
  const keys = buildKeys(opts.email, opts.ip);

  let maxLockedUntil = 0;

  for (const { key } of keys) {
    const row = await db
      .prepare('SELECT failed_count, first_failed_at, locked_until FROM login_attempts WHERE attempt_key = ?')
      .bind(key)
      .first<AttemptRow>();

    if (row?.locked_until && row.locked_until > now) {
      if (row.locked_until > maxLockedUntil) {
        maxLockedUntil = row.locked_until;
      }
    }
  }

  if (maxLockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((maxLockedUntil - now) / 1000)),
    };
  }

  return { allowed: true };
}

export async function recordFailedLogin(
  db: D1Database,
  opts: { email: string; ip: string | null; now?: number }
): Promise<void> {
  const now = opts.now ?? Date.now();
  const keys = buildKeys(opts.email, opts.ip);

  for (const { key, limit } of keys) {
    const row = await db
      .prepare('SELECT failed_count, first_failed_at, locked_until FROM login_attempts WHERE attempt_key = ?')
      .bind(key)
      .first<AttemptRow>();

    const windowExpired = !row || now - row.first_failed_at > LOGIN_WINDOW_MS;
    const lockoutExpired = row?.locked_until !== null && row?.locked_until !== undefined && row.locked_until <= now;

    if (!row || windowExpired || lockoutExpired) {
      const nextCount = 1;
      const lockedUntil = nextCount >= limit ? now + LOGIN_LOCKOUT_MS : null;
      await db
        .prepare(`
          INSERT INTO login_attempts (attempt_key, failed_count, first_failed_at, locked_until)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(attempt_key) DO UPDATE SET
            failed_count = excluded.failed_count,
            first_failed_at = excluded.first_failed_at,
            locked_until = excluded.locked_until
        `)
        .bind(key, nextCount, now, lockedUntil)
        .run();
    } else {
      const nextCount = row.failed_count + 1;
      const lockedUntil = nextCount >= limit ? now + LOGIN_LOCKOUT_MS : row.locked_until;
      await db
        .prepare('UPDATE login_attempts SET failed_count = ?, locked_until = ? WHERE attempt_key = ?')
        .bind(nextCount, lockedUntil, key)
        .run();
    }
  }
}

export async function clearEmailLoginFailures(db: D1Database, email: string): Promise<void> {
  const key = `email:${email.toLowerCase().trim()}`;
  await db.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').bind(key).run();
}
