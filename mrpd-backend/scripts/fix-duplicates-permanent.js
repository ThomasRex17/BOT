// ============================================
//  KALICI DUPLICATE ÇÖZÜMÜ
//  discord_id UNIQUE constraint ekler
// ============================================

const db = require('../database');

console.log('🔧 Kalıcı duplicate çözümü başlıyor...\n');

// 1. Önce mevcut duplicate'leri birleştir
console.log('📋 Adım 1: Mevcut duplicate\'leri birleştir...');

const dups = db.prepare(`
    SELECT discord_id, COUNT(*) as cnt
    FROM personnel
    WHERE discord_id IS NOT NULL
    GROUP BY discord_id
    HAVING cnt > 1
`).all();

let mergedCount = 0;

for (const dup of dups) {
    const records = db.prepare(`
        SELECT * FROM personnel 
        WHERE discord_id = ? 
        ORDER BY 
            CASE WHEN ic_name LIKE 'User_%' THEN 1 ELSE 0 END,
            CASE WHEN callsign IS NULL THEN 1 ELSE 0 END,
            id ASC
    `).all(dup.discord_id);
    
    const keep = records[0];
    const removeIds = records.slice(1).map(r => r.id);
    
    for (const removeId of removeIds) {
        db.prepare(`UPDATE duty_sessions SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`UPDATE leaves SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`UPDATE personnel_licenses SET personnel_id = ? WHERE personnel_id = ?`).run(keep.id, removeId);
        db.prepare(`DELETE FROM unit_members WHERE personnel_id = ?`).run(removeId);
        db.prepare(`DELETE FROM personnel WHERE id = ?`).run(removeId);
        mergedCount++;
    }
}

console.log(`✅ ${mergedCount} duplicate birleştirildi\n`);

// 2. discord_id'yi UNIQUE yap
console.log('📋 Adım 2: discord_id UNIQUE constraint ekle...');

try {
    // Eski indexi sil
    try { db.prepare('DROP INDEX IF EXISTS idx_personnel_discord_id').run(); } catch {}
    try { db.prepare('DROP INDEX IF EXISTS idx_personnel_discord_id_unique').run(); } catch {}
    
    // Yeni UNIQUE index oluştur
    db.prepare(`
        CREATE UNIQUE INDEX idx_personnel_discord_id_unique 
        ON personnel(discord_id) 
        WHERE discord_id IS NOT NULL
    `).run();
    
    console.log('✅ UNIQUE index eklendi (discord_id)\n');
} catch (e) {
    console.log(`⚠️ Index eklenemedi: ${e.message}\n`);
}

// 3. Callsign duplicate temizle
console.log('📋 Adım 3: Callsign duplicate temizle...');
const csDups = db.prepare(`
    SELECT callsign, COUNT(*) as cnt
    FROM personnel
    WHERE callsign IS NOT NULL
    GROUP BY callsign
    HAVING cnt > 1
`).all();

for (const dup of csDups) {
    const records = db.prepare(`
        SELECT * FROM personnel WHERE callsign = ? 
        ORDER BY updated_at DESC, id DESC
    `).all(dup.callsign);
    
    for (let i = 1; i < records.length; i++) {
        db.prepare('UPDATE personnel SET callsign = NULL WHERE id = ?').run(records[i].id);
    }
}

console.log(`✅ ${csDups.length} callsign çakışması çözüldü\n`);

console.log('📊 Final durum:');
console.log(`   Personel: ${db.prepare('SELECT COUNT(*) as c FROM personnel').get().c}`);
console.log(`   Discord ID'li: ${db.prepare('SELECT COUNT(*) as c FROM personnel WHERE discord_id IS NOT NULL').get().c}`);
console.log(`   Discord ID'li unique: ${db.prepare('SELECT COUNT(DISTINCT discord_id) as c FROM personnel WHERE discord_id IS NOT NULL').get().c}`);

console.log('\n🎉 Tamamlandı! Artık aynı discord_id ikinci kez eklenemez.');
process.exit(0);