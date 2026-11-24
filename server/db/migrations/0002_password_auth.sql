-- Add optional password hash for email + password authentication
ALTER TABLE users ADD COLUMN password_hash TEXT;
