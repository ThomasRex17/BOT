// Migration 005: Yeni özellikler için tablolar ve sütunlar
const db = require('../database');

const migrate = db.transaction(() => {

    // ─── personnel_reviews ───
    db.prepare(`
        CREATE TABLE IF NOT EXISTS personnel_reviews (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            personnel_id     INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
            reviewer_id      INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
            reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            result           TEXT NOT NULL,
            comment          TEXT NOT NULL,
            strengths        TEXT,
            weaknesses       TEXT,
            action_items     TEXT,
            scores           TEXT,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    try {
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_reviews_personnel ON personnel_reviews(personnel_id, created_at)`).run();
    } catch (_) {}

    console.log('✅ personnel_reviews tablosu oluşturuldu');

    // ─── duty_reset_reports ───
    db.prepare(`
        CREATE TABLE IF NOT EXISTS duty_reset_reports (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id   INTEGER,
            actor_name TEXT,
            payload    TEXT NOT NULL,
            sha256     TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    try {
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_reset_reports_created ON duty_reset_reports(created_at)`).run();
    } catch (_) {}

    console.log('✅ duty_reset_reports tablosu oluşturuldu');

    // ─── announcements: priority + expires_at sütunları ───
    const cols = db.prepare("PRAGMA table_info(announcements)").all().map(c => c.name);

    if (!cols.includes('priority')) {
        db.prepare(`ALTER TABLE announcements ADD COLUMN priority TEXT DEFAULT 'normal'`).run();
        console.log('✅ announcements.priority sütunu eklendi');
    }
    if (!cols.includes('expires_at')) {
        db.prepare(`ALTER TABLE announcements ADD COLUMN expires_at DATETIME`).run();
        console.log('✅ announcements.expires_at sütunu eklendi');
    }
    if (!cols.includes('content')) {
        db.prepare(`ALTER TABLE announcements ADD COLUMN content TEXT`).run();
        console.log('✅ announcements.content sütunu eklendi');
    }

    // ─── system_settings: varsayılan değerler ───
    const defaults = [
        ['site.theme', 'orange'],
        ['duty.auto_end_enabled', 'false'],
        ['rank.score_enabled', 'false'],
        ['auto_refresh.seconds', '15'],
        ['duty.weekly_target', '10'],
    ];

    const upsert = db.prepare(`
        INSERT INTO system_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO NOTHING
    `);

    for (const [key, value] of defaults) {
        try {
            upsert.run(key, value);
        } catch (_) {}
    }

    console.log('✅ system_settings varsayılan değerleri eklendi');
});

try {
    migrate();
    console.log('✅ Migration 005 tamamlandı');
} catch (e) {
    console.error('❌ Migration 005 hatası:', e.message);
}

process.exit(0);
