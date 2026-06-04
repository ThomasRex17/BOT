// ============================================
//  Bot Action Queue tablosu ekle
// ============================================

const db = require('../database');

console.log('📦 Bot action queue tablosu oluşturuluyor...\n');

db.prepare(`
    CREATE TABLE IF NOT EXISTS bot_action_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
    )
`).run();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_queue_status ON bot_action_queue(status, created_at)`).run();

console.log('✅ bot_action_queue tablosu hazır');

// Eski (>7 gün) tamamlanmış kayıtları temizle
const cleaned = db.prepare(`
    DELETE FROM bot_action_queue 
    WHERE status IN ('done', 'failed') 
    AND processed_at < datetime('now', '-7 days')
`).run();

console.log(`🧹 ${cleaned.changes} eski kayıt temizlendi\n`);
console.log('🎉 Tamamlandı!');
process.exit(0);