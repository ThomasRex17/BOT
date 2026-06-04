// ============================================
//  Başvuru API
// ============================================

const express = require('express');
const { z } = require('zod');

const db = require('../database');
const { authenticate, authorize, authenticateOptional } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { ValidationError, NotFoundError } = require('../utils/errors');

const router = express.Router();

const applicationSchema = z.object({
    form_id: z.number().int().positive(),
    applicant_name: z.string().min(2).max(64),
    applicant_email: z.string().email().optional(),
    applicant_discord_id: z.string().max(32).optional(),
    applicant_civ_id: z.string().max(16).optional(),
    answers: z.record(z.any()),
});

// GET /api/applications/forms - Aktif formlar (HALKA AÇIK)
router.get('/forms', asyncHandler(async (req, res) => {
    const forms = db.prepare(`
        SELECT id, title, description, requires_login, questions_json
        FROM application_forms
        WHERE is_active = 1
        ORDER BY id ASC
    `).all();

    forms.forEach(f => {
        try { f.questions = JSON.parse(f.questions_json); } catch { f.questions = []; }
        delete f.questions_json;
    });

    ok(res, forms);
}));

// GET /api/applications - Başvurular listesi (admin)
router.get('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const status = req.query.status;
    
    let whereSql = '';
    const params = [];
    
    if (status && status !== 'all') {
        whereSql = 'WHERE a.status = ?';
        params.push(status);
    }

    const apps = db.prepare(`
        SELECT 
            a.*,
            f.title as form_title,
            u.username as reviewed_by_username
        FROM applications a
        INNER JOIN application_forms f ON a.form_id = f.id
        LEFT JOIN users u ON a.reviewed_by_user_id = u.id
        ${whereSql}
        ORDER BY a.submitted_at DESC
    `).all(...params);

    apps.forEach(a => {
        try { a.answers = JSON.parse(a.answers_json); } catch { a.answers = {}; }
        delete a.answers_json;
    });

    ok(res, apps);
}));

// POST /api/applications - Yeni başvuru (HALKA AÇIK)
router.post('/', authenticateOptional, asyncHandler(async (req, res) => {
    const data = applicationSchema.parse(req.body);
    
    const form = db.prepare('SELECT * FROM application_forms WHERE id = ? AND is_active = 1').get(data.form_id);
    if (!form) throw new NotFoundError('Form bulunamadı veya pasif');

    if (form.requires_login && !req.user) {
        throw new ValidationError('Bu form için giriş yapmanız gerekiyor');
    }

    const result = db.prepare(`
        INSERT INTO applications (
            form_id, applicant_user_id, applicant_name, applicant_email, 
            applicant_discord_id, applicant_civ_id, answers_json, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
        data.form_id,
        req.user?.id || null,
        data.applicant_name,
        data.applicant_email || null,
        data.applicant_discord_id || null,
        data.applicant_civ_id || null,
        JSON.stringify(data.answers)
    );

    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
    
    recordActivity(req.user?.id || null, 'APPLICATION_SUBMITTED', 'application', app.id, {
        form: form.title,
        applicant: data.applicant_name,
    }, req.ip);

    created(res, { id: app.id }, 'Başvurunuz alındı');
}));

// GET /api/applications/:id - Tek başvuru detayı (admin)
router.get('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const app = db.prepare(`
        SELECT
            a.*,
            f.title as form_title,
            u.username as reviewed_by_username
        FROM applications a
        INNER JOIN application_forms f ON a.form_id = f.id
        LEFT JOIN users u ON a.reviewed_by_user_id = u.id
        WHERE a.id = ?
    `).get(req.params.id);

    if (!app) throw new NotFoundError('Başvuru bulunamadı');

    try { app.answers = JSON.parse(app.answers_json); } catch { app.answers = {}; }
    delete app.answers_json;

    ok(res, app);
}));

// PUT /api/applications/:id/approve
router.put('/:id/approve', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) throw new NotFoundError('Başvuru bulunamadı');

    db.prepare(`
        UPDATE applications 
        SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
        WHERE id = ?
    `).run(req.user.id, req.body.note || null, req.params.id);

    recordActivity(req.user.id, 'APPLICATION_APPROVED', 'application', app.id, null, req.ip);

    ok(res, null, 'Başvuru onaylandı');
}));

// PUT /api/applications/:id/reject
router.put('/:id/reject', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) throw new NotFoundError('Başvuru bulunamadı');

    db.prepare(`
        UPDATE applications 
        SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
        WHERE id = ?
    `).run(req.user.id, req.body.note || null, req.params.id);

    recordActivity(req.user.id, 'APPLICATION_REJECTED', 'application', app.id, null, req.ip);

    ok(res, null, 'Başvuru reddedildi');
}));

// PUT /api/applications/:id/review
router.put('/:id/review', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) throw new NotFoundError('Başvuru bulunamadı');

    db.prepare(`UPDATE applications SET status = 'review' WHERE id = ?`).run(req.params.id);
    
    ok(res, null, 'İncelemeye alındı');
}));

module.exports = router;