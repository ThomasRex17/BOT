const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// GET /api/reports/templates
router.get('/templates', authenticate, asyncHandler(async (req, res) => {
    const templates = db.prepare('SELECT * FROM report_templates ORDER BY created_at DESC').all();
    ok(res, templates.map(t => ({ ...t, fields: JSON.parse(t.fields) })));
}));

// POST /api/reports/templates
router.post('/templates', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { name, description, template_type, fields } = req.body;
    if (!name || !template_type || !fields) {
        return res.status(400).json({ success: false, message: 'İsim, tip ve alanlar gerekli' });
    }
    
    const result = db.prepare(`
        INSERT INTO report_templates (name, description, template_type, fields, created_by)
        VALUES (?, ?, ?, ?, ?)
    `).run(name, description || null, template_type, JSON.stringify(fields), req.user.id);
    
    ok(res, { id: result.lastInsertRowid }, 'Şablon oluşturuldu');
}));

// GET /api/reports
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    
    let where = '1=1';
    let params = [];
    if (status) {
        where += ' AND status = ?';
        params.push(status);
    }
    
    const total = db.prepare(`SELECT COUNT(*) as c FROM reports WHERE ${where}`).get(...params).c;
    const items = db.prepare(`
        SELECT r.*, t.name as template_name 
        FROM reports r
        LEFT JOIN report_templates t ON r.template_id = t.id
        WHERE ${where}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    ok(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

// POST /api/reports
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { template_id, title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Başlık ve içerik gerekli' });
    }
    
    const result = db.prepare(`
        INSERT INTO reports (template_id, title, content, officer_id, officer_name)
        VALUES (?, ?, ?, ?, ?)
    `).run(template_id || null, title, content, req.user.id, req.user.username);
    
    ok(res, { id: result.lastInsertRowid }, 'Rapor oluşturuldu');
}));

// PUT /api/reports/:id/submit
router.put('/:id/submit', authenticate, asyncHandler(async (req, res) => {
    db.prepare('UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('submitted', parseInt(req.params.id));
    ok(res, null, 'Rapor gönderildi');
}));

module.exports = router;