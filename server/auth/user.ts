import type { D1Database } from '@cloudflare/workers-types';
import { deleteAllUserSessions, generateId, type AuthUser } from './session';
import { hashPassword, validatePasswordPolicy } from './password';

export interface OAuthProfile {
  provider: 'github' | 'google';
  providerUserId: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function upsertOAuthUser(db: D1Database, profile: OAuthProfile): Promise<AuthUser> {
  const now = Date.now();

  // 1. Check if OAuth account is already linked
  const linkedAccount = await db
    .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
    .bind(profile.provider, profile.providerUserId)
    .first<{ user_id: string }>();

  let userId: string;

  if (linkedAccount) {
    userId = linkedAccount.user_id;
    // Update profile info if present
    await db
      .prepare(`
        UPDATE users 
        SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
        WHERE id = ?
      `)
      .bind(profile.name ?? null, profile.avatarUrl ?? null, now, userId)
      .run();
  } else {
    // 2. Check if a user with this email already exists (Automatic Account Linking)
    const existingUser = await db
      .prepare('SELECT id, email_verified_at as emailVerifiedAt FROM users WHERE email = ?')
      .bind(profile.email.toLowerCase())
      .first<{ id: string; emailVerifiedAt: number | null }>();

    if (existingUser) {
      userId = existingUser.id;
      // Link this verified OAuth provider to the existing user
      await db
        .prepare(`
          INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at)
          VALUES (?, ?, ?, ?)
        `)
        .bind(profile.provider, profile.providerUserId, userId, now)
        .run();

      if (existingUser.emailVerifiedAt === null) {
        // Prevent pre-hijacking: an unverified password signup must not retain
        // password access or sessions once the verified email owner signs in via OAuth.
        await db
          .prepare(`
            UPDATE users
            SET name = COALESCE(?, name),
                avatar_url = COALESCE(?, avatar_url),
                password_hash = NULL,
                email_verified_at = ?,
                updated_at = ?
            WHERE id = ?
          `)
          .bind(profile.name ?? null, profile.avatarUrl ?? null, now, now, userId)
          .run();
        await deleteAllUserSessions(db, userId);
      } else {
        await db
          .prepare(`
            UPDATE users 
            SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
            WHERE id = ?
          `)
          .bind(profile.name ?? null, profile.avatarUrl ?? null, now, userId)
          .run();
      }
    } else {
      // 3. Create new verified user
      userId = generateId('usr');
      await db
        .prepare(`
          INSERT INTO users (id, email, name, avatar_url, tier, email_verified_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'free', ?, ?, ?)
        `)
        .bind(userId, profile.email.toLowerCase(), profile.name ?? null, profile.avatarUrl ?? null, now, now, now)
        .run();

      await db
        .prepare(`
          INSERT INTO oauth_accounts (provider, provider_user_id, user_id, created_at)
          VALUES (?, ?, ?, ?)
        `)
        .bind(profile.provider, profile.providerUserId, userId, now)
        .run();
    }
  }

  const user = await db
    .prepare(`
      SELECT 
        id, email, name, avatar_url as avatarUrl, tier,
        paddle_customer_id as paddleCustomerId, paddle_subscription_id as paddleSubscriptionId
      FROM users WHERE id = ?
    `)
    .bind(userId)
    .first<AuthUser>();

  if (!user) {
    throw new Error('Failed to retrieve user after upsert');
  }

  return user;
}

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


