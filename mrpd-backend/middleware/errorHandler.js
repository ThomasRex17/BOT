// ============================================
//  Genel Hata Yakalama Middleware
// ============================================

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
    // Hata bilgilerini logla
    if (err.isOperational) {
        logger.warn(`[${err.statusCode}] ${err.message}`);
    } else {
        logger.error('Beklenmeyen hata:', err);
    }
    
    // AppError ise direkt gönder
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            code: err.code,
            message: err.message,
            details: err.details || undefined,
        });
    }
    
    // SQLite UNIQUE constraint
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
            success: false,
            code: 'CONFLICT',
            message: 'Bu kayıt zaten mevcut.',
        });
    }
    
    // SQLite FOREIGN KEY
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({
            success: false,
            code: 'INVALID_REFERENCE',
            message: 'Geçersiz referans (bağlantılı kayıt yok).',
        });
    }
    
    // JWT hataları
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Geçersiz token.',
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            code: 'TOKEN_EXPIRED',
            message: 'Oturumunuz sona erdi, tekrar giriş yapın.',
        });
    }
    
    // Bilinmeyen hatalar
    return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Sunucu hatası oluştu.',
    });
}

module.exports = errorHandler;