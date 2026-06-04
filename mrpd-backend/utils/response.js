// ============================================
//  Standart API Yanıt Formatları
// ============================================

function ok(res, data = null, message = null) {
    res.json({ success: true, message, data });
}

function created(res, data, message = 'Oluşturuldu') {
    res.status(201).json({ success: true, message, data });
}

function paginated(res, items, total, page, limit) {
    res.json({
        success: true,
        data: {
            items,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        },
    });
}

module.exports = { ok, created, paginated };