-- ============================================
-- Migration 004: FTO Discord Thread Tablosu
-- ============================================

CREATE TABLE IF NOT EXISTS fto_discord_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT UNIQUE NOT NULL,
    trainer_discord_id TEXT,
    trainer_username TEXT,
    trainee_discord_id TEXT,
    trainee_username TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    discord_created_at DATETIME,
    last_sync_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fto_threads_trainee ON fto_discord_threads(trainee_discord_id);
CREATE INDEX IF NOT EXISTS idx_fto_threads_trainer ON fto_discord_threads(trainer_discord_id);
CREATE INDEX IF NOT EXISTS idx_fto_threads_status  ON fto_discord_threads(status);
