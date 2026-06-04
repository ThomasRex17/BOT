// ============================================
//  Veritabanı Kontrol Scripti
// ============================================

const db = require('../database');

console.log('\n📊 VERİTABANI KONTROLÜ\n');
console.log('═══════════════════════════════════\n');

// 1. Tablolar
const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`).all();

console.log(`📋 Toplam tablo: ${tables.length}\n`);
tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
    console.log(`   ${t.name.padEnd(25)} → ${count} kayıt`);
});

console.log('\n═══════════════════════════════════\n');

// 2. Rütbeler
console.log('🎖️  RÜTBELER:\n');
const ranks = db.prepare('SELECT id, name, callsign_min, callsign_max FROM ranks ORDER BY rank_order').all();
ranks.forEach(r => {
    console.log(`   [${r.id}] ${r.name.padEnd(20)} (${r.callsign_min}-${r.callsign_max})`);
});

console.log('\n═══════════════════════════════════\n');

// 3. Personel (ilk 10)
console.log('👮 İLK 10 PERSONEL:\n');
const personnel = db.prepare(`
    SELECT id, ic_name, discord_id, callsign 
    FROM personnel 
    LIMIT 10
`).all();

if (personnel.length === 0) {
    console.log('   (Henüz personel yok)');
} else {
    personnel.forEach(p => {
        console.log(`   [${String(p.id).padStart(3)}] ${(p.ic_name || '?').padEnd(20)} | Discord: ${p.discord_id || '—'} | Telsiz: ${p.callsign || '—'}`);
    });
}

console.log('\n═══════════════════════════════════\n');

// 4. Admin
console.log('👑 KULLANICILAR:\n');
const users = db.prepare('SELECT id, username, role, email FROM users').all();
users.forEach(u => {
    console.log(`   [${u.id}] ${u.username.padEnd(15)} | ${u.role.padEnd(8)} | ${u.email || '—'}`);
});

console.log('\n═══════════════════════════════════\n');
console.log('✅ Kontrol tamamlandı!\n');

process.exit(0);