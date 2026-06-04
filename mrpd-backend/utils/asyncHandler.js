// ============================================
//  Async Hata Yakalayıcı
//  Express'te async fonksiyonlardaki hataları yakalar
// ============================================

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;