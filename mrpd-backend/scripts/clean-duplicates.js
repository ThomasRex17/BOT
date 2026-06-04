// ============================================
//  Duplicate kayıtları temizler
// ============================================

const db = require('../database');

console.log('🧹 Duplicate temizleme başlıyor...\n');

// Rütbelerden duplicate'leri sil (en küçük id'liyi tut)
const ranksDeleted = db.prepare(`
    DELETE FROM ranks 
    WHERE id NOT IN (
        SELECT MIN(id) FROM ranks GROUP BY name
    )
`).run();
console.log(`✅ ${ranksDeleted.changes} duplicate rütbe silindi`);

// Lisanslardan duplicate'leri sil
const licensesDeleted = db.prepare(`
    DELETE FROM licenses 
    WHERE id NOT IN (
        SELECT MIN(id) FROM licenses GROUP BY name
    )
`).run();
console.log(`✅ ${licensesDeleted.changes} duplicate lisans silindi`);

// Personnel'den duplicate'leri sil (aynı discord_id'ye sahip olanlar)
const personnelDeleted = db.prepare(`
    DELETE FROM personnel 
    WHERE id NOT IN (
        SELECT MIN(id) FROM personnel WHERE discord_id IS NOT NULL GROUP BY discord_id
    ) AND discord_id IS NOT NULL
`).run();
console.log(`✅ ${personnelDeleted.changes} duplicate personel silindi`);

console.log('\n📊 Yeni durum:');
console.log(`   Rütbe: ${db.prepare('SELECT COUNT(*) as c FROM ranks').get().c}`);
console.log(`   Lisans: ${db.prepare('SELECT COUNT(*) as c FROM licenses').get().c}`);
console.log(`   Personel: ${db.prepare('SELECT COUNT(*) as c FROM personnel').get().c}`);

console.log('\n🎉 Temizlik tamamlandı!');
process.exit(0);