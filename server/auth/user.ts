import type { D1Database } from '@cloudflare/workers-types';
import { deleteAllUserSessions } from './session';
import { hashPassword, validatePasswordPolicy } from './password';

/**
 * Update a user's password (enforcing NIST length policy) and revoke all existing sessions.
 */
export async function updateUserPassword(
  db: D1Database,
  userId: string,
  newPassword: string
): Promise<void> {
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    throw new Error(policy.error || 'Invalid password');
  }

  const passwordHash = await hashPassword(newPassword);
  const now = Date.now();

  await db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(passwordHash, now, userId)
    .run();

  await deleteAllUserSessions(db, userId);
}


