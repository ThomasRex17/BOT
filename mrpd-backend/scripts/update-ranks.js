// Rütbeleri güncelle
require('dotenv').config();
const db = require('../database');

console.log('🔧 Rütbeler güncelleniyor...');

// Mevcut rütbeleri sil
db.prepare('DELETE FROM ranks').run();

// Yeni rütbeleri ekle
const ranks = [
    { name: 'Admin', short_name: 'ADMIN', color: '#ef4444', rank_order: 1, callsign_min: null, callsign_max: null },
    { name: 'Captain', short_name: 'CPT', color: '#f59e0b', rank_order: 2, callsign_min: 100, callsign_max: 199 },
    { name: 'Lieutenant II', short_name: 'LT II', color: '#10b981', rank_order: 3, callsign_min: 200, callsign_max: 299 },
    { name: 'Lieutenant I', short_name: 'LT I', color: '#10b981', rank_order: 4, callsign_min: 300, callsign_max: 399 },
    { name: 'Sergeant II', short_name: 'SGT II', color: '#3b82f6', rank_order: 5, callsign_min: 400, callsign_max: 499 },
    { name: 'Sergeant I', short_name: 'SGT I', color: '#3b82f6', rank_order: 6, callsign_min: 500, callsign_max: 599 },
    { name: 'Acting Supervisor', short_name: 'ACT SUP', color: '#8b5cf6', rank_order: 7, callsign_min: 600, callsign_max: 699 },
    { name: 'Trooper 3+1', short_name: 'TRP 3+1', color: '#a855f7', rank_order: 8, callsign_min: 700, callsign_max: 749 },
    { name: 'Trooper 3', short_name: 'TRP III', color: '#a855f7', rank_order: 9, callsign_min: 750, callsign_max: 799 },
    { name: 'Trooper 2', short_name: 'TRP II', color: '#d946ef', rank_order: 10, callsign_min: 800, callsign_max: 899 },
    { name: 'Trooper 1', short_name: 'TRP I', color: '#ec4899', rank_order: 11, callsign_min: 900, callsign_max: 999 },
];

const stmt = db.prepare(`
    INSERT INTO ranks (name, short_name, color, rank_order, callsign_min, callsign_max)
    VALUES (?, ?, ?, ?, ?, ?)
`);

ranks.forEach(rank => {
    stmt.run(rank.name, rank.short_name, rank.color, rank.rank_order, rank.callsign_min, rank.callsign_max);
    console.log(`✅ ${rank.name}`);
});

console.log('\n🎉 Rütbeler güncellendi!');
