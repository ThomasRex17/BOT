// ============================================
//  Migration Script
//  migrations/ klasöründeki SQL dosyalarını çalıştırır
// ============================================

const fs = require('fs');
const path = require('path');
const db = require('../database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

console.log('📦 Migration başlıyor...\n');

// Migration tablosu (hangi migrationlar çalıştı kayıt için)
db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// SQL dosyalarını sırayla oku
const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

if (files.length === 0) {
    console.log('⚠️  Migration dosyası bulunamadı.');
    process.exit(0);
}

for (const file of files) {
    // Bu migration daha önce çalıştı mı?
    const exists = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
    
    if (exists) {
        console.log(`⏭️  ${file} (zaten çalıştırılmış)`);
        continue;
    }
    
    // SQL'i çalıştır
    const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    
    try {
        db.exec(sqlContent);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        console.log(`✅ ${file}`);
    } catch (err) {
        console.error(`❌ ${file} HATA:`, err.message);
        process.exit(1);
    }
}

console.log('\n🎉 Migration tamamlandı!');
process.exit(0);