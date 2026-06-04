// ============================================
//  Activity Log + Score Reasons + Mail Groups
// ============================================

const db = require('../database');

console.log('📦 Yeni tablolar oluşturuluyor...\n');

// 1. Activity Log
// Eski hatalı tabloyu temizleyip sıfırdan kurmak için geçici olarak eklendi:
db.prepare(`DROP TABLE IF EXISTS activity_log`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        action_label TEXT NOT NULL,
        actor_user_id INTEGER,
        actor_name TEXT,
        actor_civ_id TEXT,
        target_personnel_id INTEGER,
        target_name TEXT,
        target_civ_id TEXT,
        summary TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (target_personnel_id) REFERENCES personnel(id) ON DELETE SET NULL
    )
`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(action_type)`).run();
console.log('✅ activity_log tablosu hazır');

// 2. Score Reasons
db.prepare(`
    CREATE TABLE IF NOT EXISTS score_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();
console.log('✅ score_reasons tablosu hazır');

// 3. Mail Groups
db.prepare(`
    CREATE TABLE IF NOT EXISTS mail_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        rank_filter TEXT,
        unit_filter TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();
console.log('✅ mail_groups tablosu hazır');

// 4. System Settings
db.prepare(`
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();
console.log('✅ system_settings tablosu hazır');

// Default ayarlar
const defaults = {
    'site.name': 'Mission Row PD',
    'site.tagline': 'Los Santos Police Department',
    'site.theme': 'mrpd',
    'rank.score_enabled': 'false',
    'duty.weekly_target': '10',
    'auto_refresh.seconds': '15',
};

for (const [key, value] of Object.entries(defaults)) {
    db.prepare(`INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)`).run(key, value);
}
console.log('✅ Default ayarlar yüklendi\n');
console.log('🎉 Tamamlandı!');
process.exit(0);