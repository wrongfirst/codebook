-- Track email verification timestamp (NULL = unverified; backfill existing users)
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Track failed login attempts per email and per IP for brute-force lockout
CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_key TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 0,
    first_failed_at INTEGER NOT NULL,
    locked_until INTEGER
);
