const db = require('../database');

const migrate = db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(users)').all();

    if (!columns.some(c => c.name === 'force_password_change')) {
        db.prepare('ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0').run();
        console.log('  ✅ users.force_password_change eklendi');
    } else {
        console.log('  ℹ  users.force_password_change zaten var');
    }
});

try {
    migrate();
    console.log('✅ Migration 006 tamamlandı');
} catch (err) {
    console.error('❌ Migration 006 hatası:', err.message);
    process.exit(1);
}
