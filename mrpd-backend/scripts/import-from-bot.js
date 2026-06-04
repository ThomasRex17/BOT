// ============================================
//  Botun JSON dosyalarını DB'ye aktar
// ============================================

const fs = require('fs');
const path = require('path');
const db = require('../database');

// BOTUN JSON DOSYALARININ YOLU - KENDİ YOLUNA GÖRE DEĞİŞTİR
const BOT_PATH = 'C:/Users/Administrator/Downloads/Bot/BOT';

console.log('📥 Bot verilerini içe aktarma başlıyor...\n');

// Yardımcı: JSON dosyası oku
function readJson(filename) {
    const filePath = path.join(BOT_PATH, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Dosya bulunamadı: ${filename}`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.log(`❌ Dosya okunamadı: ${filename}`);
        return null;
    }
}

// ---- 1. TOPLAM MESAİLER ----
console.log('📊 Toplam mesailer aktarılıyor...');
const toplamMesailer = readJson('toplam_mesailer.json');

if (toplamMesailer) {
    let count = 0;
    
    const insertPersonnel = db.prepare(`
        INSERT OR IGNORE INTO personnel (discord_id, ic_name, callsign)
        VALUES (?, ?, ?)
    `);
    
    const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
    
    const insertSession = db.prepare(`
        INSERT INTO duty_sessions (personnel_id, started_at, ended_at, duration_minutes)
        VALUES (?, datetime('now', '-30 days'), datetime('now'), ?)
    `);
    
    for (const [discordId, data] of Object.entries(toplamMesailer)) {
        // Personnel kaydı yoksa oluştur
        insertPersonnel.run(discordId, `User_${discordId.substring(0, 6)}`, null);
        
        const personnel = getPersonnel.get(discordId);
        if (!personnel) continue;
        
        // Toplam dakikayı bir oturum olarak ekle
        const totalMinutes = typeof data === 'number' ? data : Math.floor((data.ms || 0) / 60000);
        if (totalMinutes > 0) {
            insertSession.run(personnel.id, totalMinutes);
            count++;
        }
    }
    
    console.log(`✅ ${count} personel mesai kaydı aktarıldı`);
}

// ---- 2. AKTİF MESAİLER ----
console.log('\n⏱️  Aktif mesailer aktarılıyor...');
const aktifMesailer = readJson('aktif_mesailer.json');

if (aktifMesailer) {
    let count = 0;
    
    const insertPersonnel = db.prepare(`
        INSERT OR IGNORE INTO personnel (discord_id, ic_name)
        VALUES (?, ?)
    `);
    
    const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
    
    const insertActiveSession = db.prepare(`
        INSERT INTO duty_sessions (personnel_id, started_at)
        VALUES (?, ?)
    `);
    
    for (const [discordId, data] of Object.entries(aktifMesailer)) {
        insertPersonnel.run(discordId, `User_${discordId.substring(0, 6)}`);
        const personnel = getPersonnel.get(discordId);
        if (!personnel) continue;
        
        const startedAt = new Date(data.baslangic).toISOString();
        insertActiveSession.run(personnel.id, startedAt);
        count++;
    }
    
    console.log(`✅ ${count} aktif mesai aktarıldı`);
}

// ---- 3. MAZERETLER ----
console.log('\n📅 Mazeretler aktarılıyor...');
const gecmisMazeretler = readJson('mazeretler.json');

if (gecmisMazeretler && Array.isArray(gecmisMazeretler)) {
    let count = 0;
    
    const insertPersonnel = db.prepare(`
        INSERT OR IGNORE INTO personnel (discord_id, ic_name)
        VALUES (?, ?)
    `);
    
    const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
    
    const insertLeave = db.prepare(`
        INSERT INTO leaves (personnel_id, reason, additional_info, starts_at, ends_at, status)
        VALUES (?, ?, ?, datetime('now'), ?, ?)
    `);
    
    for (const m of gecmisMazeretler) {
        if (!m.user) continue;
        
        insertPersonnel.run(m.user, `User_${m.user.substring(0, 6)}`);
        const personnel = getPersonnel.get(m.user);
        if (!personnel) continue;
        
        const endsAt = new Date(m.bitisZamani).toISOString();
        const status = m.durum === 'Onaylandı' ? 'approved' : m.durum === 'Reddedildi' ? 'rejected' : 'pending';
        
        insertLeave.run(personnel.id, m.sebep || 'Belirtilmedi', m.ek || '', endsAt, status);
        count++;
    }
    
    console.log(`✅ ${count} mazeret aktarıldı`);
}

// ---- 4. AKTİF BİRİMLER ----
console.log('\n🚓 Aktif birimler aktarılıyor...');
const aktifBirimler = readJson('aktif_birimler.json');

if (aktifBirimler) {
    let count = 0;
    
    const insertUnit = db.prepare(`
        INSERT INTO active_units (type, code, capacity)
        VALUES (?, ?, ?)
    `);
    
    const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
    const insertMember = db.prepare(`
        INSERT OR IGNORE INTO unit_members (unit_id, personnel_id)
        VALUES (?, ?)
    `);
    
    for (const [, data] of Object.entries(aktifBirimler)) {
        const result = insertUnit.run(data.tur, data.kod, data.kapasite);
        const unitId = result.lastInsertRowid;
        
        for (const memberDiscordId of data.uyeler || []) {
            const personnel = getPersonnel.get(memberDiscordId);
            if (personnel) {
                insertMember.run(unitId, personnel.id);
            }
        }
        count++;
    }
    
    console.log(`✅ ${count} aktif birim aktarıldı`);
}

console.log('\n🎉 İçe aktarma tamamlandı!');

// Özet
const totalPersonnel = db.prepare('SELECT COUNT(*) as c FROM personnel').get().c;
const totalLeaves = db.prepare('SELECT COUNT(*) as c FROM leaves').get().c;
const totalUnits = db.prepare('SELECT COUNT(*) as c FROM active_units').get().c;
const totalSessions = db.prepare('SELECT COUNT(*) as c FROM duty_sessions').get().c;

console.log('\n📊 Özet:');
console.log(`   Personel: ${totalPersonnel}`);
console.log(`   Mesai oturumu: ${totalSessions}`);
console.log(`   Mazeret: ${totalLeaves}`);
console.log(`   Aktif birim: ${totalUnits}`);

process.exit(0);