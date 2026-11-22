-- Scope user_sync snapshots per course instance (site_slug) so multi-instance
-- deployments on the same domain do not overwrite each other's progress.
CREATE TABLE IF NOT EXISTS user_sync_v2 (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_slug TEXT NOT NULL DEFAULT 'default',
    version INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, site_slug)
);

INSERT INTO user_sync_v2 (user_id, site_slug, version, payload_json, updated_at)
SELECT user_id, 'default', version, payload_json, updated_at FROM user_sync;

DROP TABLE user_sync;
ALTER TABLE user_sync_v2 RENAME TO user_sync;
