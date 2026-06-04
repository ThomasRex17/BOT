// ============================================
//  Discord OAuth2 Stratejisi
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });  // ← BU SATIRI EKLE


const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('../database');
const logger = require('./logger');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI,
    scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Discord ID'ye göre kullanıcı var mı?
        let user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(profile.id);
        
        if (user) {
            // Var, bilgilerini güncelle
            db.prepare(`
                UPDATE users 
                SET discord_username = ?, discord_avatar = ?, last_login = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(profile.username, profile.avatar, user.id);
            
            logger.info(`Discord login (mevcut): ${profile.username}`);
            return done(null, user);
        }
        
        // Yeni kullanıcı, oluştur
        // Username olarak discord username kullan, ama unique olmalı
        let username = profile.username.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
        if (username.length < 3) username = 'discord_' + profile.id.slice(0, 8);
        
        // Username çakışması kontrolü
        let attempt = 0;
        let finalUsername = username;
        while (db.prepare('SELECT id FROM users WHERE username = ?').get(finalUsername)) {
            attempt++;
            finalUsername = `${username}_${attempt}`;
        }
        
        // Discord ID ile aynı discord_id'yi olan personel var mı?
        const personnel = db.prepare('SELECT * FROM personnel WHERE discord_id = ?').get(profile.id);
        const role = personnel ? 'officer' : 'guest';
        
        const result = db.prepare(`
            INSERT INTO users (username, email, discord_id, discord_username, discord_avatar, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(finalUsername, profile.email || null, profile.id, profile.username, profile.avatar, role);
        
        const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        
        // Eğer personel kaydı varsa user_id'yi bağla
        if (personnel) {
            db.prepare('UPDATE personnel SET user_id = ? WHERE id = ?').run(newUser.id, personnel.id);
            logger.success(`Discord ile yeni officer bağlandı: ${profile.username} → [${personnel.callsign}]`);
        } else {
            logger.info(`Discord ile yeni guest: ${profile.username}`);
        }
        
        return done(null, newUser);
    } catch (err) {
        logger.error('Discord OAuth hatası:', err);
        return done(err, null);
    }
}));

module.exports = passport;