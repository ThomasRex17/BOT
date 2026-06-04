// ============================================
//  Bot'taki rütbe ID'lerini DB'ye yaz
//  + 5 Detective rütbesi
// ============================================

const db = require('../database');

console.log('🎖️  Rütbeler bot ile senkronize ediliyor...\n');

// Bot kodunda olan ANA RÜTBELER
const mainRanks = [
    { name: 'Captain I',          short_name: 'CPT I',   color: '#dc2626', rank_order: 1, callsign_min: 101, callsign_max: 103, discord_role_id: '1487574113563443210' },
    { name: 'Lieutenant I',       short_name: 'LT I',    color: '#ea580c', rank_order: 2, callsign_min: 201, callsign_max: 203, discord_role_id: '1487574117321281676' },
    { name: 'Sergeant II',        short_name: 'SGT II',  color: '#f97316', rank_order: 3, callsign_min: 301, callsign_max: 305, discord_role_id: '1487574118541819934' },
    { name: 'Sergeant I',         short_name: 'SGT I',   color: '#fb923c', rank_order: 4, callsign_min: 301, callsign_max: 305, discord_role_id: '1487574119359844422' },
    { name: 'Officer 3+1',        short_name: 'OFC 3+1', color: '#fbbf24', rank_order: 5, callsign_min: 401, callsign_max: 410, discord_role_id: '1487574119561035786' },
    { name: 'Officer 3',          short_name: 'OFC 3',   color: '#facc15', rank_order: 6, callsign_min: 501, callsign_max: 515, discord_role_id: '1487574120286916668' },
    { name: 'Officer 2',          short_name: 'OFC 2',   color: '#84cc16', rank_order: 7, callsign_min: 601, callsign_max: 620, discord_role_id: '1487574120953544724' },
    { name: 'Officer 1',          short_name: 'OFC 1',   color: '#22c55e', rank_order: 8, callsign_min: 701, callsign_max: 760, discord_role_id: '1487574121264058499' },
];

// DEDEKTİF RÜTBELERİ (manuel atanacak, callsign aralığı yok)
const detectiveRanks = [
    { name: 'Detective III',      short_name: 'DET III', color: '#a855f7', rank_order: 10, callsign_min: null, callsign_max: null, discord_role_id: '1490059279439368344' },
    { name: 'Detective II',       short_name: 'DET II',  color: '#9333ea', rank_order: 11, callsign_min: null, callsign_max: null, discord_role_id: '1490059284715798572' },
    { name: 'Detective I',        short_name: 'DET I',   color: '#7e22ce', rank_order: 12, callsign_min: null, callsign_max: null, discord_role_id: '1490059288050143332' },
    { name: 'Junior Detective',   short_name: 'JR DET',  color: '#6b21a8', rank_order: 13, callsign_min: null, callsign_max: null, discord_role_id: '1490059291674148936' },
    { name: 'Detective Trainee',  short_name: 'DET TR',  color: '#581c87', rank_order: 14, callsign_min: null, callsign_max: null, discord_role_id: '1492849198024884298' },
];

const allRanks = [...mainRanks, ...detectiveRanks];

// Önce tüm eski rütbeleri sil (personel'in rank_id'si null olur, bot sync ile otomatik dolar)
db.prepare('UPDATE personnel SET rank_id = NULL').run();
db.prepare('DELETE FROM ranks').run();

// Yenilerini ekle
const insert = db.prepare(`
    INSERT INTO ranks (name, short_name, color, rank_order, callsign_min, callsign_max, discord_role_id, extra_callsigns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('━━━━━━━━ ANA RÜTBELER ━━━━━━━━');
for (const r of mainRanks) {
    try {
        insert.run(r.name, r.short_name, r.color, r.rank_order, r.callsign_min, r.callsign_max, r.discord_role_id, null);
        const range = r.callsign_min ? `[${r.callsign_min}-${r.callsign_max}]` : 'manuel';
        console.log(`✅ ${r.name.padEnd(22)} | ${r.discord_role_id} | ${range}`);
    } catch (e) {
        console.log(`❌ ${r.name}: ${e.message}`);
    }
}

console.log('\n━━━━━━ DETECTIVE RÜTBELERİ ━━━━━━');
for (const r of detectiveRanks) {
    try {
        insert.run(r.name, r.short_name, r.color, r.rank_order, r.callsign_min, r.callsign_max, r.discord_role_id, null);
        console.log(`✅ ${r.name.padEnd(22)} | ${r.discord_role_id} | manuel`);
    } catch (e) {
        console.log(`❌ ${r.name}: ${e.message}`);
    }
}

console.log(`\n📊 Toplam ${allRanks.length} rütbe DB'ye eklendi.`);
console.log('🔄 Bot bir sonraki sync\'te personellere rütbeleri otomatik atayacak.');
console.log('💡 Detective rütbeleri manuel atanır (callsign aralığı yok).');
console.log('\n🎉 Tamamlandı!');
process.exit(0);