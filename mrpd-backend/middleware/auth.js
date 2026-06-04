// ============================================
//  Auth Middleware
//  JWT token doğrulama
// ============================================

const jwt = require('jsonwebtoken');
const db = require('../database');
const { AuthError, ForbiddenError } = require('../utils/errors');

/**
 * Token'ı doğrular, kullanıcıyı req.user'a koyar
 */
function authenticate(req, res, next) {
    try {
        // Token'ı header'dan veya cookie'den al
        let token = null;
        
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            throw new AuthError('Token gerekli');
        }
        
        // Doğrula
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Kullanıcıyı DB'den çek (rol değişmiş olabilir)
        const user = db.prepare(`
            SELECT id, username, email, role, discord_id, is_active
            FROM users
            WHERE id = ?
        `).get(decoded.userId);
        
        if (!user) {
            throw new AuthError('Kullanıcı bulunamadı');
        }
        
        if (!user.is_active) {
            throw new AuthError('Hesabınız devre dışı');
        }
        
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Sadece belirli rollere izin verir
 * Kullanım: authorize('admin', 'officer')
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthError('Önce giriş yapmalısınız'));
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError(`Bu işlem için yetkiniz yok (${allowedRoles.join(' veya ')} gerekli)`));
        }
        
        next();
    };
}

/**
 * Token VARSA doğrular ama yoksa hata vermez
 * (Public sayfalarda kullanılır, login olmuşsa kullanıcıyı tanır)
 */
function authenticateOptional(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.token;
        
        if (!authHeader && !cookieToken) {
            return next();
        }
        
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        } else if (cookieToken) {
            token = cookieToken;
        }
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = db.prepare(`
                SELECT id, username, email, role, discord_id, is_active
                FROM users WHERE id = ?
            `).get(decoded.userId);
            
            if (user && user.is_active) {
                req.user = user;
            }
        }
        
        next();
    } catch (err) {
        // Hata olsa da devam et (optional)
        next();
    }
}

// Admin yetkisi isteyen rotalar için hazır tanımlama
const requireAdmin = authorize('admin');

module.exports = {
    authenticate,
    authorize,
    authenticateOptional,
    requireAdmin
};