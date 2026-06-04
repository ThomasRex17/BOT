// ============================================
//  Duyurular API
//  GET    /api/announcements       → Listele
//  POST   /api/announcements       → Oluştur (officer+)
//  DELETE /api/announcements/:id   → Sil (admin)
// ============================================

const express = require('express');
const { z } = require('zod');
const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

const announcementSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    priority: z.enum(['normal', 'important', 'urgent']).default('normal'),
    expires_at: z.string().datetime({ offset: true }).optional().nullable(),
    is_pinned: z.boolean().optional().default(false),
});

// GET /api/announcements
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const now = new Date().toISOString();

    const rows = db.prepare(`
        SELECT
            a.*,
            u.username AS author_name
        FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by_user_id
        WHERE (a.expires_at IS NULL OR a.expires_at > ?)
        ORDER BY a.is_pinned DESC, a.created_at DESC
        LIMIT ? OFFSET ?
    `).all(now, limit, offset);

    const total = db.prepare(`
        SELECT COUNT(*) as c FROM announcements
        WHERE (expires_at IS NULL OR expires_at > ?)
    `).get(now).c;

    ok(res, { data: rows, total, page, limit });
}));

// POST /api/announcements
router.post('/', authenticate, authorize('admin', 'officer'), asyncHandler(async (req, res) => {
    const data = announcementSchema.parse(req.body);

    const result = db.prepare(`
        INSERT INTO announcements (title, body, content, priority, expires_at, is_pinned, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.title,
        data.content,
        data.content,
        data.priority,
        data.expires_at || null,
        data.is_pinned ? 1 : 0,
        req.user.id
    );

    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
    created(res, announcement, 'Duyuru oluşturuldu');
}));

// DELETE /api/announcements/:id
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
    if (!existing) throw new NotFoundError('Duyuru bulunamadı');

    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    ok(res, null, 'Duyuru silindi');
}));

module.exports = router;
