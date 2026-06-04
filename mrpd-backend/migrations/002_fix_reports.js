// Migration 002: reports tablosunu route ile uyumlu hale getir
const db = require('../database');

const migrate = db.transaction(() => {
    db.prepare('DROP TABLE IF EXISTS reports').run();

    // officer_id → users(id) referansı (route req.user.id kullanıyor)
    db.prepare(`
        CREATE TABLE reports (
            id          INTEGER  PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER  REFERENCES report_templates(id) ON DELETE SET NULL,
            title       TEXT     NOT NULL,
            content     TEXT     NOT NULL,
            officer_id  INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            officer_name TEXT,
            status      TEXT     NOT NULL DEFAULT 'pending',
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    console.log('✅ reports tablosu yeniden oluşturuldu (officer_id → users)');
});

migrate();
process.exit(0);
