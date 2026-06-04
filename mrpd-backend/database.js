// ============================================
//  Veritabanı Bağlantısı
// ============================================

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './db/mrpd.db';

// db/ klasörü yoksa oluştur
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Veritabanı bağlantısı
const db = new Database(DB_PATH, {
    // verbose: console.log  // SQL loglarını görmek istersen aç
});

// Performans ayarları
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

console.log('✅ SQLite veritabanı bağlantısı kuruldu:', DB_PATH);

module.exports = db;