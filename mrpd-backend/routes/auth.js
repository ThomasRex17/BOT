// ============================================
//  Auth Route'ları
//  POST /api/auth/login
//  POST /api/auth/register
//  POST /api/auth/logout
//  POST /api/auth/refresh
//  GET  /api/auth/me
// ============================================

const passport = require('../utils/discordStrategy');
const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, AuthError, ConflictError } = require('../utils/errors');
const tokens = require('../utils/tokens');

const router = express.Router();

// ---------- VALIDATORS ----------
const loginSchema = z.object({
    username: z.string().min(3).max(32),
    password: z.string().min(4).max(100),
});

const registerSchema = z.object({
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Sadece harf, rakam, _, ., - kullanın'),
    password: z.string().min(6).max(100),
    email: z.string().email().optional(),
});

// ---------- POST /api/auth/login ----------
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    
    const user = db.prepare(`
        SELECT id, username, email, password_hash, role, is_active, force_password_change
        FROM users WHERE username = ?
    `).get(username);
    
    if (!user || !user.password_hash) {
        throw new AuthError('Kullanıcı adı veya şifre hatalı');
    }
    
    if (!user.is_active) {
        throw new AuthError('Hesabınız devre dışı');
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        throw new AuthError('Kullanıcı adı veya şifre hatalı');
    }
    
    // Token'ları üret
    const accessToken = tokens.generateAccessToken(user);
    const refreshToken = tokens.generateRefreshToken(user);
    
    // Last login güncelle
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    // Log
    recordActivity(user.id, 'LOGIN', 'user', user.id, null, req.ip);
    
    res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            force_password_change: user.force_password_change === 1,
        },
    });
}));

// ---------- POST /api/auth/register ----------
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password, email } = registerSchema.parse(req.body);
    
    // Kullanıcı adı kontrolü
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        throw new ConflictError('Bu kullanıcı adı zaten alınmış');
    }
    
    // Email kontrolü
    if (email) {
        const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (emailExists) {
            throw new ConflictError('Bu e-posta zaten kayıtlı');
        }
    }
    
    // Şifreyi hash'le
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Kullanıcıyı oluştur (yeni kayıtlar 'guest' rolü ile başlar)
    const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, 'guest')
    `).run(username, email || null, passwordHash);
    
    const user = db.prepare(`
        SELECT id, username, email, role FROM users WHERE id = ?
    `).get(result.lastInsertRowid);
    
    // Token'ları üret
    const accessToken = tokens.generateAccessToken(user);
    const refreshToken = tokens.generateRefreshToken(user);
    
    recordActivity(user.id, 'REGISTER', 'user', user.id, null, req.ip);
    
    res.status(201).json({
        success: true,
        accessToken,
        refreshToken,
        user,
    });
}));

// ---------- POST /api/auth/logout ----------
router.post('/logout', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
        tokens.revokeRefreshToken(refreshToken);
    }
    
    res.json({
        success: true,
        message: 'Çıkış yapıldı',
    });
}));

// ---------- POST /api/auth/refresh ----------
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        throw new AuthError('Refresh token gerekli');
    }
    
    const userId = tokens.verifyRefreshToken(refreshToken);
    if (!userId) {
        throw new AuthError('Geçersiz veya süresi dolmuş refresh token');
    }
    
    const user = db.prepare(`
        SELECT id, username, email, role, is_active FROM users WHERE id = ?
    `).get(userId);
    
    if (!user || !user.is_active) {
        throw new AuthError('Kullanıcı bulunamadı veya devre dışı');
    }
    
    const newAccessToken = tokens.generateAccessToken(user);
    
    res.json({
        success: true,
        accessToken: newAccessToken,
    });
}));

// ---------- GET /api/auth/me ----------
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = db.prepare(`
        SELECT u.id, u.username, u.email, u.role, u.discord_id, u.discord_username,
               u.discord_avatar, u.created_at, u.last_login, u.force_password_change,
               p.id AS personnel_id,
               p.ic_name,
               r.name AS rank_name,
               r.short_name AS rank_short,
               r.color AS rank_color
        FROM users u
        LEFT JOIN personnel p ON p.user_id = u.id
        LEFT JOIN ranks r ON r.id = p.rank_id
        WHERE u.id = ?
    `).get(req.user.id);

    res.json({
        success: true,
        user: {
            ...user,
            force_password_change: user.force_password_change === 1,
        },
    });
}));

// ---------- POST /api/auth/change-password ----------
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        throw new ValidationError('Mevcut ve yeni şifre gerekli (yeni şifre min 6 karakter)');
    }
    
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    
    if (!user.password_hash) {
        throw new ValidationError('Şifre değiştirme bu hesap için kullanılamaz');
    }
    
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
        throw new AuthError('Mevcut şifre hatalı');
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?').run(newHash, req.user.id);
    
    // Tüm token'ları iptal et (güvenlik)
    tokens.revokeAllUserTokens(req.user.id);
    
    recordActivity(req.user.id, 'PASSWORD_CHANGED', 'user', req.user.id, null, req.ip);
    
    res.json({
        success: true,
        message: 'Şifre değiştirildi. Tüm cihazlardan çıkış yapıldı, tekrar giriş yapın.',
    });
}));

// ============================================
//  DISCORD OAUTH
// ============================================

// /api/auth/discord — Discord'a yönlendir
router.get('/discord', passport.authenticate('discord'));

// /api/auth/discord/callback — Discord'dan dönüş
router.get('/discord/callback',
    passport.authenticate('discord', { 
        failureRedirect: 'http://188.191.107.75:5174/login.html?error=discord_failed',
        session: false,
    }),
    async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                return res.redirect('http://188.191.107.75:5174/login.html?error=no_user');
            }
            
            // Token üret
            const accessToken = tokens.generateAccessToken(user);
            const refreshToken = tokens.generateRefreshToken(user);
            
            recordActivity(user.id, 'LOGIN_DISCORD', 'user', user.id, null, req.ip);
            
            // Token'ları URL ile frontend'e gönder
            const redirectUrl = `http://188.191.107.75:5174/discord-callback.html?` +
                `access=${encodeURIComponent(accessToken)}&` +
                `refresh=${encodeURIComponent(refreshToken)}`;
            
            res.redirect(redirectUrl);
        } catch (err) {
            console.error('Discord callback hatası:', err);
            res.redirect('http://188.191.107.75:5174/login.html?error=server_error');
        }
    }
);

module.exports = router;