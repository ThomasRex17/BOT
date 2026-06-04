// ============================================
//  Seed Script
//  Başlangıç verilerini ekler
// ============================================

const db = require('../database');

console.log('🌱 Seed başlıyor...\n');

// ---- RÜTBELER ----
const ranks = [
    { name: 'Captain', short_name: 'CPT', color: '#5865f2', rank_order: 1, callsign_min: 101, callsign_max: 103, discord_role_id: '1487574113563443210' },
    { name: 'Lieutenant II', short_name: 'LT II', color: '#3b82f6', rank_order: 2, callsign_min: 201, callsign_max: 203, discord_role_id: '1487574117321281676' },
    { name: 'Lieutenant I', short_name: 'LT I', color: '#3b82f6', rank_order: 3, callsign_min: 301, callsign_max: 305, discord_role_id: '1487574118541819934' },
    { name: 'Sergeant II', short_name: 'SGT II', color: '#fbbf24', rank_order: 4, callsign_min: 401, callsign_max: 410, discord_role_id: '1487574119561035786' },
    { name: 'Sergeant I', short_name: 'SGT I', color: '#fbbf24', rank_order: 5, callsign_min: 501, callsign_max: 515, discord_role_id: '1487574120286916668' },
    { name: 'Officer II', short_name: 'OFC II', color: '#22c55e', rank_order: 6, callsign_min: 601, callsign_max: 620, discord_role_id: '1487574120953544724', extra_callsigns: '[630]' },
    { name: 'Officer I', short_name: 'OFC I', color: '#22c55e', rank_order: 7, callsign_min: 701, callsign_max: 760, discord_role_id: '1487574121264058499' },
];

const insertRank = db.prepare(`
    INSERT INTO ranks (name, short_name, color, rank_order, callsign_min, callsign_max, discord_role_id, extra_callsigns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const r of ranks) {
    try {
        insertRank.run(r.name, r.short_name, r.color, r.rank_order, r.callsign_min, r.callsign_max, r.discord_role_id, r.extra_callsigns || null);
        console.log(`✅ Rütbe: ${r.name}`);
    } catch (e) {
        console.log(`⏭️  Rütbe zaten var: ${r.name}`);
    }
}

// ---- LİSANSLAR ----
const licenses = [
    { name: 'Bean Bag License', short_name: 'BBL', color: '#fb923c', icon: 'shield', description: 'Ölümcül olmayan müdahale yetkisi' },
    { name: 'Operation Safe Street', short_name: 'OSS', color: '#a855f7', icon: 'users', description: 'Güvenli sokak operasyonu' },
    { name: 'High Speed Unit', short_name: 'HSU', color: '#22c55e', icon: 'car', description: 'Yüksek hızda araç kullanım' },
    { name: 'FTO (Field Trainer)', short_name: 'FTO', color: '#eab308', icon: 'key', description: 'Saha eğitmeni' },
    { name: 'Air Support', short_name: 'AS', color: '#06b6d4', icon: 'helicopter', description: 'Hava desteği yetkisi' },
    { name: 'K-9 Handler', short_name: 'K9', color: '#84cc16', icon: 'dog', description: 'K-9 birimi yetkisi' },
    { name: 'SWAT', short_name: 'SWAT', color: '#dc2626', icon: 'flame', description: 'SWAT birimi yetkisi' },
];

const insertLicense = db.prepare(`
    INSERT INTO licenses (name, short_name, color, icon, description)
    VALUES (?, ?, ?, ?, ?)
`);

for (const l of licenses) {
    try {
        insertLicense.run(l.name, l.short_name, l.color, l.icon, l.description);
        console.log(`✅ Lisans: ${l.name}`);
    } catch (e) {
        console.log(`⏭️  Lisans zaten var: ${l.name}`);
    }
}

// ---- AYARLAR ----
const settings = [
    { key: 'site_name', value: 'Mission Row Police Department' },
    { key: 'site_short', value: 'MRPD' },
    { key: 'tagline', value: 'Los Santos Police Department · Mission Row Division' },
    { key: 'discord_invite', value: 'https://discord.gg/mrpd' },
    { key: 'rank_points_enabled', value: 'true' },
    { key: 'auto_discord_roles', value: 'true' },
];

const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

for (const s of settings) {
    insertSetting.run(s.key, s.value);
    console.log(`✅ Ayar: ${s.key}`);
}

// ---- VARSAYILAN ADMİN ----
const bcrypt = require('bcrypt');
const adminPassword = 'admin123'; // Sonra değiştir!
const passwordHash = bcrypt.hashSync(adminPassword, 12);

const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, ?)
`);

const result = insertAdmin.run('admin', 'admin@mrpd.local', passwordHash, 'admin');

if (result.changes > 0) {
    console.log(`\n👑 Admin hesabı oluşturuldu:`);
    console.log(`   Kullanıcı adı: admin`);
    console.log(`   Şifre: ${adminPassword}`);
    console.log(`   ⚠️  İLK GİRİŞTE ŞİFRENİ DEĞİŞTİR!`);
} else {
    console.log(`\n⏭️  Admin hesabı zaten var.`);
}

console.log('\n🎉 Seed tamamlandı!');
process.exit(0);