// ============================================
//  Rütbe API
// ============================================

const express = require('express');
const { z } = require('zod');

const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

const rankSchema = z.object({
    name: z.string().min(2).max(64),
    short_name: z.string().max(16).optional(),
    discord_role_id: z.string().max(32).optional().nullable(),
    color: z.string().max(16).optional(),
    rank_order: z.number().int().optional(),
    callsign_min: z.number().int().optional().nullable(),
    callsign_max: z.number().int().optional().nullable(),
});

// GET /api/ranks
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const ranks = db.prepare(`
        SELECT r.*, 
            (SELECT COUNT(*) FROM personnel WHERE rank_id = r.id) as personnel_count
        FROM ranks r
        ORDER BY r.rank_order ASC
    `).all();
    ok(res, ranks);
}));

// POST /api/ranks
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const data = rankSchema.parse(req.body);
    const result = db.prepare(`
        INSERT INTO ranks (name, short_name, discord_role_id, color, rank_order, callsign_min, callsign_max)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.name,
        data.short_name || null,
        data.discord_role_id || null,
        data.color || '#5865f2',
        data.rank_order || 99,
        data.callsign_min || null,
        data.callsign_max || null
    );
    const rank = db.prepare('SELECT * FROM ranks WHERE id = ?').get(result.lastInsertRowid);
    recordActivity(req.user.id, 'RANK_CREATED', 'rank', rank.id, data, req.ip);
    created(res, rank, 'Rütbe eklendi');
}));

// PUT /api/ranks/:id
router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const data = rankSchema.partial().parse(req.body);
    const existing = db.prepare('SELECT * FROM ranks WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Rütbe bulunamadı');

    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
    }

    if (fields.length > 0) {
        params.push(req.params.id);
        db.prepare(`UPDATE ranks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM ranks WHERE id = ?').get(req.params.id);
    recordActivity(req.user.id, 'RANK_UPDATED', 'rank', req.params.id, data, req.ip);
    ok(res, updated, 'Rütbe güncellendi');
}));

// DELETE /api/ranks/:id
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id, name FROM ranks WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Rütbe bulunamadı');
    db.prepare('DELETE FROM ranks WHERE id = ?').run(req.params.id);
    recordActivity(req.user.id, 'RANK_DELETED', 'rank', req.params.id, { name: existing.name }, req.ip);
    ok(res, null, 'Rütbe silindi');
}));

// PATCH /api/ranks/reorder — toplu sıralama güncellemesi
router.patch('/reorder', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'items dizisi gerekli' });
    }

    const update = db.prepare('UPDATE ranks SET rank_order = ? WHERE id = ?');
    const reorder = db.transaction((rows) => {
        for (const row of rows) {
            update.run(parseInt(row.rank_order), parseInt(row.id));
        }
    });

    reorder(items);
    recordActivity(req.user.id, 'RANK_REORDERED', 'rank', null, { count: items.length }, req.ip);
    ok(res, null, `${items.length} rütbe sıralaması güncellendi`);
}));

module.exports = router;