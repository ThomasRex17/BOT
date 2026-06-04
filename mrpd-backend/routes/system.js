const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// ===== SETTINGS =====
router.get('/settings', authenticate, asyncHandler(async (req, res) => {
    const items = db.prepare('SELECT * FROM system_settings').all();
    const settings = {};
    items.forEach(i => settings[i.key] = i.value);
    ok(res, settings);
}));

router.put('/settings', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const updates = req.body || {};
    const stmt = db.prepare(`
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    for (const [key, value] of Object.entries(updates)) {
        stmt.run(key, String(value));
    }
    ok(res, null, 'Ayarlar kaydedildi');
}));

// ===== SCORE REASONS =====
router.get('/score-reasons', authenticate, asyncHandler(async (req, res) => {
    const reasons = db.prepare(`
        SELECT * FROM score_reasons 
        ORDER BY sort_order ASC, id ASC
    `).all();
    ok(res, reasons);
}));

router.post('/score-reasons', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { description, points, sort_order } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Açıklama gerekli' });
    
    const result = db.prepare(`
        INSERT INTO score_reasons (description, points, sort_order)
        VALUES (?, ?, ?)
    `).run(description, parseInt(points) || 0, parseInt(sort_order) || 0);
    
    ok(res, { id: result.lastInsertRowid }, 'Sebep eklendi');
}));

router.put('/score-reasons/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { description, points, sort_order, is_active } = req.body;
    
    db.prepare(`
        UPDATE score_reasons 
        SET description = ?, points = ?, sort_order = ?, is_active = ?
        WHERE id = ?
    `).run(description, parseInt(points) || 0, parseInt(sort_order) || 0, is_active ? 1 : 0, id);
    
    ok(res, null, 'Güncellendi');
}));

router.delete('/score-reasons/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM score_reasons WHERE id = ?').run(parseInt(req.params.id));
    ok(res, null, 'Silindi');
}));

// ===== MAIL GROUPS =====
router.get('/mail-groups', authenticate, asyncHandler(async (req, res) => {
    const groups = db.prepare('SELECT * FROM mail_groups ORDER BY id ASC').all();
    ok(res, groups);
}));

router.post('/mail-groups', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { name, description, rank_filter, unit_filter } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Ad gerekli' });
    
    try {
        const result = db.prepare(`
            INSERT INTO mail_groups (name, description, rank_filter, unit_filter)
            VALUES (?, ?, ?, ?)
        `).run(name, description || null, rank_filter || null, unit_filter || null);
        ok(res, { id: result.lastInsertRowid }, 'Grup oluşturuldu');
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'Bu isimde bir grup zaten var' });
        }
        throw e;
    }
}));

router.put('/mail-groups/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, description, rank_filter, unit_filter } = req.body;
    db.prepare(`
        UPDATE mail_groups SET name = ?, description = ?, rank_filter = ?, unit_filter = ?
        WHERE id = ?
    `).run(name, description || null, rank_filter || null, unit_filter || null, id);
    ok(res, null, 'Güncellendi');
}));

router.delete('/mail-groups/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM mail_groups WHERE id = ?').run(parseInt(req.params.id));
    ok(res, null, 'Silindi');
}));

module.exports = router;