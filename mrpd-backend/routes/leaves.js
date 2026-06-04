// ============================================
//  Mazeret API
// ============================================

const express = require('express');
const { z } = require('zod');

const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { ValidationError, NotFoundError } = require('../utils/errors');

const router = express.Router();

const leaveSchema = z.object({
    personnel_id: z.number().int().positive(),
    reason: z.string().min(3).max(500),
    additional_info: z.string().max(500).optional(),
    starts_at: z.string(), // ISO datetime
    ends_at: z.string(),
});

// GET /api/leaves - Tüm mazeretler
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const status = req.query.status; // 'pending', 'approved', 'rejected', 'all'

    // Süresi dolmuş onaylı mazeretleri otomatik kapat
    db.prepare(`
        UPDATE leaves
        SET status = 'expired',
            review_note = COALESCE(review_note || ' [Otomatik kapatıldı]', '[Otomatik kapatıldı]'),
            reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP)
        WHERE status = 'approved' AND ends_at < CURRENT_TIMESTAMP
    `).run();

    // Süresi dolmuş bekleyen mazeretleri de kapat
    db.prepare(`
        UPDATE leaves
        SET status = 'expired',
            review_note = '[Süre doldu — onay gelmedi]',
            reviewed_at = CURRENT_TIMESTAMP
        WHERE status = 'pending' AND ends_at < CURRENT_TIMESTAMP
    `).run();

    let whereSql = '';
    const params = [];

    if (status && status !== 'all') {
        whereSql = 'WHERE l.status = ?';
        params.push(status);
    } else {
        // "all" seçeneğinde süresi dolmuşları (expired) gösterme
        whereSql = "WHERE l.status != 'expired'";
    }

    const leaves = db.prepare(`
        SELECT
            l.*,
            p.ic_name, p.callsign, p.badge_number,
            r.name as rank_name,
            u.username as reviewed_by_username
        FROM leaves l
        INNER JOIN personnel p ON l.personnel_id = p.id
        LEFT JOIN ranks r ON p.rank_id = r.id
        LEFT JOIN users u ON l.reviewed_by_user_id = u.id
        ${whereSql}
        ORDER BY l.created_at DESC
    `).all(...params);

    ok(res, leaves);
}));

// POST /api/leaves - Yeni mazeret
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const data = leaveSchema.parse(req.body);
    
    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE id = ?').get(data.personnel_id);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const result = db.prepare(`
        INSERT INTO leaves (personnel_id, reason, additional_info, starts_at, ends_at, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(data.personnel_id, data.reason, data.additional_info || null, data.starts_at, data.ends_at);

    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid);
    
    recordActivity(req.user.id, 'LEAVE_CREATED', 'leave', leave.id, { 
        personnel: personnel.ic_name 
    }, req.ip);

    created(res, leave, 'Mazeret oluşturuldu');
}));

// PUT /api/leaves/:id/approve
router.put('/:id/approve', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
    if (!leave) throw new NotFoundError('Mazeret bulunamadı');

    db.prepare(`
        UPDATE leaves 
        SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
        WHERE id = ?
    `).run(req.user.id, req.body.note || null, req.params.id);

    db.prepare('UPDATE personnel SET status = ? WHERE id = ?').run('mazeret', leave.personnel_id);

    recordActivity(req.user.id, 'LEAVE_APPROVED', 'leave', leave.id, null, req.ip);

    ok(res, null, 'Mazeret onaylandı');
}));

// PUT /api/leaves/:id/reject
router.put('/:id/reject', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
    if (!leave) throw new NotFoundError('Mazeret bulunamadı');

    if (!req.body.note) throw new ValidationError('Reddetme sebebi gerekli (note alanı)');

    db.prepare(`
        UPDATE leaves 
        SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
        WHERE id = ?
    `).run(req.user.id, req.body.note, req.params.id);

    recordActivity(req.user.id, 'LEAVE_REJECTED', 'leave', leave.id, { reason: req.body.note }, req.ip);

    ok(res, null, 'Mazeret reddedildi');
}));

// DELETE /api/leaves/:id
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const leave = db.prepare('SELECT id FROM leaves WHERE id = ?').get(req.params.id);
    if (!leave) throw new NotFoundError('Mazeret bulunamadı');
    
    db.prepare('DELETE FROM leaves WHERE id = ?').run(req.params.id);
    recordActivity(req.user.id, 'LEAVE_DELETED', 'leave', req.params.id, null, req.ip);
    
    ok(res, null, 'Mazeret silindi');
}));

module.exports = router;