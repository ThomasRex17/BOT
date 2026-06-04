const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// GET /api/citizens - listele
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    let where = '1=1';
    let params = [];
    if (search) {
        where += ' AND (name LIKE ? OR civ_id LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    
    const total = db.prepare(`SELECT COUNT(*) as c FROM citizens WHERE ${where}`).get(...params).c;
    const items = db.prepare(`
        SELECT * FROM citizens 
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    ok(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

// GET /api/citizens/:id - detay
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const citizen = db.prepare('SELECT * FROM citizens WHERE id = ?').get(parseInt(req.params.id));
    if (!citizen) return res.status(404).json({ success: false, message: 'Vatandaş bulunamadı' });
    
    const records = db.prepare('SELECT * FROM citizen_records WHERE citizen_id = ? ORDER BY created_at DESC').all(citizen.id);
    ok(res, { ...citizen, records });
}));

// POST /api/citizens - oluştur
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { civ_id, name, date_of_birth, gender, phone, address, notes, risk_level } = req.body;
    if (!civ_id || !name) {
        return res.status(400).json({ success: false, message: 'Kimlik no ve isim gerekli' });
    }
    
    try {
        const result = db.prepare(`
            INSERT INTO citizens (civ_id, name, date_of_birth, gender, phone, address, notes, risk_level, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(civ_id, name, date_of_birth || null, gender || null, phone || null, address || null, notes || null, risk_level || 'low', req.user.id);
        
        ok(res, { id: result.lastInsertRowid }, 'Vatandaş kaydı oluşturuldu');
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'Bu kimlik numarası zaten kayıtlı' });
        }
        throw e;
    }
}));

// PUT /api/citizens/:id - güncelle
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, date_of_birth, gender, phone, address, notes, is_wanted, risk_level } = req.body;
    
    db.prepare(`
        UPDATE citizens 
        SET name = ?, date_of_birth = ?, gender = ?, phone = ?, address = ?, notes = ?, is_wanted = ?, risk_level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(name, date_of_birth || null, gender || null, phone || null, address || null, notes || null, is_wanted ? 1 : 0, risk_level || 'low', id);
    
    ok(res, null, 'Güncellendi');
}));

// POST /api/citizens/:id/records - kayıt ekle
router.post('/:id/records', authenticate, asyncHandler(async (req, res) => {
    const citizen_id = parseInt(req.params.id);
    const { record_type, title, description, fine_amount, jail_time } = req.body;
    
    const result = db.prepare(`
        INSERT INTO citizen_records (citizen_id, record_type, title, description, officer_id, officer_name, fine_amount, jail_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(citizen_id, record_type || 'incident', title, description || null, req.user.id, req.user.username, fine_amount || null, jail_time || null);
    
    ok(res, { id: result.lastInsertRowid }, 'Kayıt eklendi');
}));

module.exports = router;