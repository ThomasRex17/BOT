const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// GET /api/activity - listele
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const action_type = req.query.action_type || '';
    const actor = req.query.actor || '';
    const target = req.query.target || '';
    const from = req.query.from || '';   // YYYY-MM-DD
    const to = req.query.to || '';       // YYYY-MM-DD

    let where = ['1=1'];
    let params = [];

    if (action_type && action_type !== 'all') {
        where.push('action_type = ?');
        params.push(action_type);
    }
    if (actor) {
        where.push('(actor_name LIKE ? OR actor_civ_id LIKE ?)');
        params.push(`%${actor}%`, `%${actor}%`);
    }
    if (target) {
        where.push('(target_name LIKE ? OR target_civ_id LIKE ?)');
        params.push(`%${target}%`, `%${target}%`);
    }
    if (from) {
        where.push('created_at >= ?');
        params.push(from);
    }
    if (to) {
        // to günü dahil: günün sonuna kadar
        where.push('created_at < ?');
        params.push(to + 'T23:59:59');
    }

    const whereSQL = where.join(' AND ');
    
    const total = db.prepare(`SELECT COUNT(*) as c FROM activity_log WHERE ${whereSQL}`).get(...params).c;
    
    const items = db.prepare(`
        SELECT * FROM activity_log 
        WHERE ${whereSQL}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    ok(res, {
        items: items.map(i => ({
            ...i,
            details: i.details ? JSON.parse(i.details) : null,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
}));

// GET /api/activity/:id - detay
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const log = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(parseInt(req.params.id));
    if (!log) return res.status(404).json({ success: false, message: 'Log bulunamadı' });
    
    ok(res, {
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
    });
}));

// GET /api/activity/types/list - filtre için
router.get('/types/list', authenticate, asyncHandler(async (req, res) => {
    const types = db.prepare(`
        SELECT DISTINCT action_type, action_label, COUNT(*) as count
        FROM activity_log
        GROUP BY action_type
        ORDER BY count DESC
    `).all();
    
    ok(res, types);
}));

module.exports = router;