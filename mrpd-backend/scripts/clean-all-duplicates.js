// ============================================
//  TÜM DUPLICATE'LERİ AKILLI ŞEKİLDE TEMİZLE
// ============================================

const db = require('../database');

console.log('🧹 Akıllı duplicate temizliği başlıyor...\n');

// ===== 1. PERSONNEL DUPLICATELARI =====
console.log('📋 1. Personnel duplicate kontrolü...');

// Önce: Aynı discord_id'ye sahip olanları birleştir
const sameDiscordId = db.prepare(`
    SELECT discord_id, COUNT(*) as cnt
    FROM personnel
    WHERE discord_id IS NOT NULL
    GROUP BY discord_id
    HAVING cnt > 1
`).all();

let mergedCount = 0;

for (const dup of sameDiscordId) {
    // Bu discord_id'ye sahip tüm kayıtları al
    const records = db.prepare(`
        SELECT * FROM personnel 
        WHERE discord_id = ? 
        ORDER BY 
            CASE WHEN ic_name LIKE 'User_%' THEN 1 ELSE 0 END, -- gerçek isimliyi öne al
            id ASC
    `).all(dup.discord_id);
    
    // İlki "ana", diğerleri silinecek
    const keep = records[0];
    const removeIds = records.slice(1).map(r => r.id);
    
    // Mesai kayıtlarını ana kayda taşı
    for (const removeId of removeIds) {
        db.prepare(`UPDATE duty_sessions SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`UPDATE leaves SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`UPDATE personnel_licenses SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`DELETE FROM unit_members WHERE personnel_id = ?`).run(removeId);
        db.prepare(`DELETE FROM personnel WHERE id = ?`).run(removeId);
        mergedCount++;
    }
    
    console.log(`   🔀 ${dup.discord_id}: ${records.length} kayıt birleştirildi (${keep.ic_name})`);
}

console.log(`✅ ${mergedCount} duplicate personel birleştirildi\n`);

// ===== 2. RÜTBE DUPLICATELARI =====
console.log('📋 2. Rütbe duplicate kontrolü...');
const ranksRemoved = db.prepare(`
    DELETE FROM ranks 
    WHERE id NOT IN (SELECT MIN(id) FROM ranks GROUP BY name)
`).run();
console.log(`✅ ${ranksRemoved.changes} duplicate rütbe silindi\n`);

// ===== 3. LİSANS DUPLICATELARI =====
console.log('📋 3. Lisans duplicate kontrolü...');
const licensesRemoved = db.prepare(`
    DELETE FROM licenses 
    WHERE id NOT IN (SELECT MIN(id) FROM licenses GROUP BY name)
`).run();
console.log(`✅ ${licensesRemoved.changes} duplicate lisans silindi\n`);

// ===== 4. AYNI CALLSIGN ÇAKIŞMALARI =====
console.log('📋 4. Telsiz kodu çakışmaları...');
const callsignDups = db.prepare(`
    SELECT callsign, COUNT(*) as cnt
    FROM personnel
    WHERE callsign IS NOT NULL
    GROUP BY callsign
    HAVING cnt > 1
`).all();

for (const dup of callsignDups) {
    // En son güncellenen hariç hepsinin callsign'ını sil
    const records = db.prepare(`
        SELECT * FROM personnel WHERE callsign = ? ORDER BY updated_at DESC, id DESC
    `).all(dup.callsign);
    
    for (let i = 1; i < records.length; i++) {
        db.prepare('UPDATE personnel SET callsign = NULL WHERE id = ?').run(records[i].id);
    }
    console.log(`   ⚠️  [${dup.callsign}] çakışma çözüldü (${records.length - 1} kayıttan kaldırıldı)`);
}

console.log(`\n📊 Son durum:`);
console.log(`   Personel:  ${db.prepare('SELECT COUNT(*) as c FROM personnel').get().c}`);
console.log(`   Rütbe:     ${db.prepare('SELECT COUNT(*) as c FROM ranks').get().c}`);
console.log(`   Lisans:    ${db.prepare('SELECT COUNT(*) as c FROM licenses').get().c}`);

console.log('\n🎉 Temizlik tamamlandı!');
process.exit(0);