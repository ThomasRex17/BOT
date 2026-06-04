// ============================================
//  Lisans API
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

const licenseSchema = z.object({
    name: z.string().min(2).max(64),
    short_name: z.string().max(16).optional(),
    color: z.string().max(16).optional(),
    icon: z.string().max(32).optional(),
    description: z.string().max(500).optional(),
});

router.get('/', authenticate, asyncHandler(async (req, res) => {
    const licenses = db.prepare(`
        SELECT l.*, 
            (SELECT COUNT(*) FROM personnel_licenses WHERE license_id = l.id) as personnel_count
        FROM licenses l
        ORDER BY l.id ASC
    `).all();
    ok(res, licenses);
}));

router.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const data = licenseSchema.parse(req.body);
    const result = db.prepare(`
        INSERT INTO licenses (name, short_name, color, icon, description)
        VALUES (?, ?, ?, ?, ?)
    `).run(data.name, data.short_name || null, data.color || '#5865f2', data.icon || null, data.description || null);
    const license = db.prepare('SELECT * FROM licenses WHERE id = ?').get(result.lastInsertRowid);
    recordActivity(req.user.id, 'LICENSE_CREATED', 'license', license.id, data, req.ip);
    created(res, license, 'Lisans eklendi');
}));

router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const data = licenseSchema.partial().parse(req.body);
    const existing = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Lisans bulunamadı');

    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
    }

    if (fields.length > 0) {
        params.push(req.params.id);
        db.prepare(`UPDATE licenses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
    recordActivity(req.user.id, 'LICENSE_UPDATED', 'license', req.params.id, data, req.ip);
    ok(res, updated, 'Lisans güncellendi');
}));

router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id, name FROM licenses WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Lisans bulunamadı');
    db.prepare('DELETE FROM licenses WHERE id = ?').run(req.params.id);
    recordActivity(req.user.id, 'LICENSE_DELETED', 'license', req.params.id, { name: existing.name }, req.ip);
    ok(res, null, 'Lisans silindi');
}));

module.exports = router;