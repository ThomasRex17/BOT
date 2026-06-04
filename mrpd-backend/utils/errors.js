// ============================================
//  Özel Hata Sınıfları
// ============================================

class AppError extends Error {
    constructor(message, statusCode = 500, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
    }
}

class ValidationError extends AppError {
    constructor(message = 'Geçersiz veri', details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

class AuthError extends AppError {
    constructor(message = 'Yetkisiz erişim') {
        super(message, 401, 'AUTH_ERROR');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Bu işlem için yetkiniz yok') {
        super(message, 403, 'FORBIDDEN');
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Kayıt bulunamadı') {
        super(message, 404, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Kayıt zaten mevcut') {
        super(message, 409, 'CONFLICT');
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
};