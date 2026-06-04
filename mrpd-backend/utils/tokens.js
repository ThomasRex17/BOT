// ============================================
//  JWT Token Yardımcı Fonksiyonlar
// ============================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET tanımlanmamış! .env dosyasını kontrol et.');
}

/**
 * Access token üretir (kısa ömürlü, API çağrılarında kullanılır)
 */
function generateAccessToken(user) {
    return jwt.sign(
        { 
            userId: user.id, 
            username: user.username,
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

/**
 * Refresh token üretir (uzun ömürlü, access token yenilemek için)
 */
function generateRefreshToken(user) {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Refresh token'ı DB'de hash'lenmiş olarak sakla
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 gün
    
    db.prepare(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
    `).run(user.id, tokenHash, expiresAt.toISOString());
    
    return token;
}

/**
 * Refresh token doğrula
 */
function verifyRefreshToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const record = db.prepare(`
        SELECT user_id, expires_at FROM refresh_tokens
        WHERE token_hash = ?
    `).get(tokenHash);
    
    if (!record) return null;
    
    if (new Date(record.expires_at) < new Date()) {
        // Süresi dolmuş, sil
        db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
        return null;
    }
    
    return record.user_id;
}

/**
 * Refresh token sil (logout için)
 */
function revokeRefreshToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

/**
 * Bir kullanıcının TÜM refresh tokenlarını sil
 */
function revokeAllUserTokens(userId) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
};