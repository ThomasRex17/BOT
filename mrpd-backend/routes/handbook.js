const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// GET /api/handbook/categories
router.get('/categories', authenticate, asyncHandler(async (req, res) => {
    const cats = db.prepare('SELECT * FROM handbook_categories ORDER BY sort_order ASC').all();
    ok(res, cats);
}));

// POST /api/handbook/categories
router.post('/categories', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { name, description, icon, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'İsim gerekli' });
    
    try {
        const result = db.prepare(`
            INSERT INTO handbook_categories (name, description, icon, sort_order)
            VALUES (?, ?, ?, ?)
        `).run(name, description || null, icon || '📁', sort_order || 0);
        ok(res, { id: result.lastInsertRowid }, 'Kategori oluşturuldu');
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'Bu kategori zaten var' });
        }
        throw e;
    }
}));

// GET /api/handbook/articles
router.get('/articles', authenticate, asyncHandler(async (req, res) => {
    const category_id = req.query.category_id ? parseInt(req.query.category_id) : null;
    let query = 'SELECT a.*, c.name as category_name FROM handbook_articles a LEFT JOIN handbook_categories c ON a.category_id = c.id WHERE a.is_published = 1';
    let params = [];
    
    if (category_id) {
        query += ' AND a.category_id = ?';
        params.push(category_id);
    }
    
    query += ' ORDER BY a.sort_order ASC, a.created_at DESC';
    
    const articles = db.prepare(query).all(...params);
    ok(res, articles);
}));

// GET /api/handbook/articles/:id
router.get('/articles/:id', authenticate, asyncHandler(async (req, res) => {
    const article = db.prepare('SELECT * FROM handbook_articles WHERE id = ?').get(parseInt(req.params.id));
    if (!article) return res.status(404).json({ success: false, message: 'Makale bulunamadı' });
    ok(res, article);
}));

// POST /api/handbook/articles
router.post('/articles', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { category_id, title, content, sort_order, is_published } = req.body;
    if (!category_id || !title || !content) {
        return res.status(400).json({ success: false, message: 'Kategori, başlık ve içerik gerekli' });
    }
    
    const result = db.prepare(`
        INSERT INTO handbook_articles (category_id, title, content, author_id, author_name, is_published, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(category_id, title, content, req.user.id, req.user.username, is_published ? 1 : 0, sort_order || 0);
    
    ok(res, { id: result.lastInsertRowid }, 'Makale oluşturuldu');
}));

// PUT /api/handbook/articles/:id
router.put('/articles/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, content, is_published } = req.body;
    
    db.prepare(`
        UPDATE handbook_articles 
        SET title = ?, content = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(title, content, is_published ? 1 : 0, id);
    
    ok(res, null, 'Güncellendi');
}));

module.exports = router;