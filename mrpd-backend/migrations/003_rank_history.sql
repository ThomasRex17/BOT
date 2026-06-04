-- ============================================
-- Migration 003: Rütbe Geçmişi Tablosu
-- ============================================

CREATE TABLE IF NOT EXISTS rank_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    rank_id INTEGER REFERENCES ranks(id) ON DELETE SET NULL,
    rank_name TEXT NOT NULL,
    rank_color TEXT,
    action TEXT NOT NULL DEFAULT 'rank_assigned',
    -- 'initial' | 'promoted' | 'demoted' | 'rank_assigned'
    changed_by_discord_id TEXT,
    changed_by_name TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rank_history_personnel_id ON rank_history(personnel_id);

-- Mevcut tüm personel için başlangıç kaydı ekle
INSERT INTO rank_history (personnel_id, rank_id, rank_name, rank_color, action, created_at)
SELECT
    p.id,
    p.rank_id,
    COALESCE(r.name, '(rütbesiz)'),
    r.color,
    'initial',
    p.created_at
FROM personnel p
LEFT JOIN ranks r ON r.id = p.rank_id;
