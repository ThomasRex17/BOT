// ============================================
//  Personel API
//  GET    /api/personnel          → Listele
//  GET    /api/personnel/:id      → Tekil getir
//  POST   /api/personnel          → Yeni ekle (admin)
//  PUT    /api/personnel/:id      → Güncelle (admin)
//  DELETE /api/personnel/:id      → Sil (admin)
// ============================================

const express = require('express');
const bcrypt = require('bcrypt');
const botQueue = require('../utils/botQueue');
const { z } = require('zod');

const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paginated } = require('../utils/response');
const { ValidationError, NotFoundError } = require('../utils/errors');
const activityLogger = require('../utils/activityLogger');

const router = express.Router();

// ---------- VALIDATORS ----------
const personnelSchema = z.object({
    ic_name: z.string().min(2).max(64),
    ooc_name: z.string().max(64).optional(),
    callsign: z.number().int().positive().optional().nullable(),
    badge_number: z.string().max(16).optional(),
    rank_id: z.number().int().positive().optional().nullable(),
    discord_id: z.string().max(32).optional().nullable(),
    notes: z.string().max(500).optional(),
    status: z.enum(['online', 'offline', 'duty', 'mazeret']).optional(),
});

// ---------- GET /api/personnel ----------
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const rankId = req.query.rank_id;
    const status = req.query.status;

    let whereClauses = [];
    let params = [];

    if (search) {
        whereClauses.push(`(p.ic_name LIKE ? OR p.ooc_name LIKE ? OR CAST(p.callsign AS TEXT) LIKE ? OR p.badge_number LIKE ?)`);
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }
    if (rankId) {
        whereClauses.push('p.rank_id = ?');
        params.push(rankId);
    }
    if (status) {
        whereClauses.push('p.status = ?');
        params.push(status);
    }

    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as c FROM personnel p ${whereSql}`).get(...params).c;

    const items = db.prepare(`
        SELECT
            p.*,
            r.name as rank_name,
            r.short_name as rank_short,
            r.color as rank_color
        FROM personnel p
        LEFT JOIN ranks r ON p.rank_id = r.id
        ${whereSql}
        ORDER BY p.callsign ASC, p.id ASC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    paginated(res, items, total, page, limit);
}));

// ============================================
//  GET /api/personnel/public
//  HALKA AÇIK kadro listesi (login gerektirmez)
//  Sadece güvenli alanları döndürür
// ============================================
router.get('/public', asyncHandler(async (req, res) => {
    const personnel = db.prepare(`
        SELECT
            p.id,
            p.ic_name,
            p.callsign,
            p.badge_number,
            p.status,
            p.rank_id,
            r.name as rank_name,
            r.short_name as rank_short_name,
            r.color as rank_color,
            r.rank_order
        FROM personnel p
        LEFT JOIN ranks r ON p.rank_id = r.id
        ORDER BY
            CASE WHEN r.rank_order IS NULL THEN 999 ELSE r.rank_order END ASC,
            p.callsign ASC NULLS LAST,
            p.ic_name ASC
    `).all();

    // Lisansları da ekle
    const licenses = db.prepare(`
        SELECT
            pl.personnel_id,
            l.name as license_name,
            l.short_name as license_short_name,
            l.color as license_color
        FROM personnel_licenses pl
        JOIN licenses l ON pl.license_id = l.id
    `).all();

    // Personnel'e lisanslarını ekle
    const personnelWithLicenses = personnel.map(p => ({
        ...p,
        licenses: licenses.filter(l => l.personnel_id === p.id),
    }));

    ok(res, personnelWithLicenses);
}));

// ============================================
//  GET /api/personnel/public/:id
//  Halka açık personel profili (sınırlı bilgi)
// ============================================
router.get('/public/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const person = db.prepare(`
        SELECT
            p.id, p.ic_name, p.ooc_name, p.callsign, p.badge_number,
            p.status, p.created_at,
            r.name as rank_name, r.short_name as rank_short_name,
            r.color as rank_color, r.rank_order
        FROM personnel p
        LEFT JOIN ranks r ON p.rank_id = r.id
        WHERE p.id = ?
    `).get(id);

    if (!person) {
        return res.status(404).json({ success: false, message: 'Personel bulunamadı' });
    }

    // Lisanslar
    const licenses = db.prepare(`
        SELECT l.id, l.name, l.short_name, l.color, l.icon
        FROM personnel_licenses pl
        JOIN licenses l ON pl.license_id = l.id
        WHERE pl.personnel_id = ?
    `).all(id);

    // Toplam mesai
    const totalDuty = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM duty_sessions
        WHERE personnel_id = ? AND ended_at IS NOT NULL
    `).get(id);

    ok(res, {
        ...person,
        licenses,
        total_duty_minutes: totalDuty.total_minutes,
    });
}));

// ============================================
//  GET /api/personnel/public/ranks
//  Halka açık rütbe listesi
// ============================================
router.get('/public-ranks', asyncHandler(async (req, res) => {
    const ranks = db.prepare(`
        SELECT
            r.id, r.name, r.short_name, r.color, r.rank_order,
            r.callsign_min, r.callsign_max,
            COUNT(p.id) as personnel_count
        FROM ranks r
        LEFT JOIN personnel p ON p.rank_id = r.id
        GROUP BY r.id
        ORDER BY r.rank_order ASC
    `).all();

    ok(res, ranks);
}));

// ---------- GET /api/personnel/:id ----------
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const personnel = db.prepare(`
        SELECT
            p.*,
            r.name as rank_name,
            r.short_name as rank_short,
            r.color as rank_color
        FROM personnel p
        LEFT JOIN ranks r ON p.rank_id = r.id
        WHERE p.id = ?
    `).get(req.params.id);

    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    // Lisansları
    personnel.licenses = db.prepare(`
        SELECT l.id, l.name, l.short_name, l.color, l.icon
        FROM licenses l
        INNER JOIN personnel_licenses pl ON pl.license_id = l.id
        WHERE pl.personnel_id = ?
    `).all(personnel.id);

    // Toplam mesai
    const totalDuty = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total
        FROM duty_sessions
        WHERE personnel_id = ? AND ended_at IS NOT NULL
    `).get(personnel.id);

    personnel.total_duty_minutes = totalDuty.total;

    // Aktif mesai oturumu var mı?
    const activeSession = db.prepare(`
        SELECT * FROM duty_sessions
        WHERE personnel_id = ? AND ended_at IS NULL
        ORDER BY started_at DESC LIMIT 1
    `).get(personnel.id);

    personnel.active_session = activeSession || null;

    ok(res, personnel);
}));

// ---------- GET /api/personnel/:id/rank-history ----------
router.get('/:id/rank-history', authenticate, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const personnel = db.prepare('SELECT id FROM personnel WHERE id = ?').get(id);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const history = db.prepare(`
        SELECT
            id,
            personnel_id,
            rank_id,
            rank_name,
            rank_color,
            action,
            changed_by_discord_id,
            changed_by_name,
            notes,
            created_at
        FROM rank_history
        WHERE personnel_id = ?
        ORDER BY created_at ASC
    `).all(id);

    ok(res, { data: history });
}));

// ---------- POST /api/personnel ----------
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const data = personnelSchema.parse(req.body);

    // Telsiz kodu uniq mi?
    if (data.callsign) {
        const existing = db.prepare('SELECT id FROM personnel WHERE callsign = ?').get(data.callsign);
        if (existing) throw new ValidationError('Bu telsiz kodu zaten kullanılıyor');
    }

    const result = db.prepare(`
        INSERT INTO personnel (ic_name, ooc_name, callsign, badge_number, rank_id, discord_id, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.ic_name,
        data.ooc_name || null,
        data.callsign || null,
        data.badge_number || null,
        data.rank_id || null,
        data.discord_id || null,
        data.notes || null,
        data.status || 'offline'
    );

    const personnel = db.prepare('SELECT * FROM personnel WHERE id = ?').get(result.lastInsertRowid);

    // İlk rütbe kaydı
    if (data.rank_id) {
        const rank = db.prepare('SELECT * FROM ranks WHERE id = ?').get(data.rank_id);
        if (rank) {
            db.prepare(`
                INSERT INTO rank_history (personnel_id, rank_id, rank_name, rank_color, action, changed_by_discord_id, changed_by_name)
                VALUES (?, ?, ?, ?, 'initial', ?, ?)
            `).run(
                result.lastInsertRowid,
                rank.id,
                rank.name,
                rank.color ?? null,
                req.user.discord_id ?? null,
                req.user.username
            );
        }
    }

    recordActivity(req.user.id, 'PERSONNEL_CREATED', 'personnel', personnel.id, { ic_name: data.ic_name }, req.ip);

    created(res, personnel, 'Personel eklendi');

    activityLogger.log({
        actionType: 'PERSONNEL_CREATE',
        req,
        target: { id: result.lastInsertRowid, name: data.ic_name },
        summary: `Yeni personel oluşturuldu: ${data.ic_name}`,
    });
}));

// ---------- PUT /api/personnel/:id ----------
router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = personnelSchema.partial().parse(req.body);

    const existing = db.prepare('SELECT * FROM personnel WHERE id = ?').get(id);
    if (!existing) throw new NotFoundError('Personel bulunamadı');

    // Telsiz kodu değişiyorsa uniq kontrolü
    if (data.callsign && data.callsign !== existing.callsign) {
        const taken = db.prepare('SELECT id FROM personnel WHERE callsign = ? AND id != ?')
            .get(data.callsign, id);
        if (taken) throw new ValidationError('Bu telsiz kodu zaten kullanılıyor');
    }

    // Sadece gönderilen alanları güncelle
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length > 1) {
        params.push(id);
        db.prepare(`UPDATE personnel SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM personnel WHERE id = ?').get(id);

    // === RÜTBE GEÇMİŞİ ===
    if ('rank_id' in data && data.rank_id !== existing.rank_id) {
        const newRank = data.rank_id
            ? db.prepare('SELECT * FROM ranks WHERE id = ?').get(data.rank_id)
            : null;
        const oldRank = existing.rank_id
            ? db.prepare('SELECT * FROM ranks WHERE id = ?').get(existing.rank_id)
            : null;

        let action = 'rank_assigned';
        if (newRank && oldRank) {
            action = newRank.rank_order < oldRank.rank_order ? 'promoted' : 'demoted';
        }

        db.prepare(`
            INSERT INTO rank_history
                (personnel_id, rank_id, rank_name, rank_color, action, changed_by_discord_id, changed_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            newRank?.id ?? null,
            newRank?.name ?? '(rütbesiz)',
            newRank?.color ?? null,
            action,
            req.user.discord_id ?? null,
            req.user.username
        );
    }

    recordActivity(req.user.id, 'PERSONNEL_UPDATED', 'personnel', id, data, req.ip);

    activityLogger.log({
        actionType: 'PERSONNEL_UPDATE',
        req,
        target: { id, name: updated.ic_name },
        summary: existing.rank_id !== updated.rank_id
            ? `Polis rütbesi: ${existing.rank_id ? '(eski)' : '(yok)'} → ${updated.rank_id ? 'yeni' : '(yok)'}`
            : `Personel bilgisi güncellendi`,
    });

    // === SİTE → BOT SYNC ===
    if (updated.discord_id) {
        if (existing.rank_id !== updated.rank_id) {
            const newRankBot = updated.rank_id
                ? db.prepare('SELECT * FROM ranks WHERE id = ?').get(updated.rank_id)
                : null;
            const oldRankBot = existing.rank_id
                ? db.prepare('SELECT * FROM ranks WHERE id = ?').get(existing.rank_id)
                : null;

            botQueue.queueAction(botQueue.ACTIONS.RANK_CHANGED, {
                discord_id: updated.discord_id,
                old_role_id: oldRankBot?.discord_role_id || null,
                new_role_id: newRankBot?.discord_role_id || null,
                old_rank_name: oldRankBot?.name || 'yok',
                new_rank_name: newRankBot?.name || 'yok',
                personnel_name: updated.ic_name,
            });
        }

        if (existing.ic_name !== updated.ic_name
            || existing.ooc_name !== updated.ooc_name
            || existing.callsign !== updated.callsign) {
            let newNickname = '';
            if (updated.callsign) newNickname += `[${updated.callsign}] `;
            newNickname += updated.ic_name || '';
            if (updated.ooc_name) newNickname += ` | ${updated.ooc_name}`;

            botQueue.queueAction(botQueue.ACTIONS.SET_DISCORD_NICKNAME, {
                discord_id: updated.discord_id,
                nickname: newNickname.substring(0, 32),
            });
        }
    }

    ok(res, updated, 'Personel güncellendi');
}));

// ---------- DELETE /api/personnel/:id ----------
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id, ic_name FROM personnel WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Personel bulunamadı');

    db.prepare('DELETE FROM personnel WHERE id = ?').run(req.params.id);

    recordActivity(req.user.id, 'PERSONNEL_DELETED', 'personnel', req.params.id, { ic_name: existing.ic_name }, req.ip);

    ok(res, null, 'Personel silindi');

    activityLogger.log({
        actionType: 'PERSONNEL_DELETE',
        req,
        target: { id: req.params.id, name: existing.ic_name },
        summary: `Personel silindi: ${existing.ic_name || req.params.id}`,
    });

    // === SİTE → BOT SYNC ===
    if (existing.discord_id) {
        botQueue.queueAction(botQueue.ACTIONS.PERSONNEL_DELETED, {
            discord_id: existing.discord_id,
            personnel_name: existing.ic_name,
            notify_only: req.body?.kick === true ? false : true,
        });
    }
}));

// ---------- POST /api/personnel/:id/licenses ----------
router.post('/:id/licenses', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { license_id } = req.body;
    if (!license_id) throw new ValidationError('license_id gerekli');

    const personnel = db.prepare('SELECT id FROM personnel WHERE id = ?').get(req.params.id);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const license = db.prepare('SELECT id, name FROM licenses WHERE id = ?').get(license_id);
    if (!license) throw new NotFoundError('Lisans bulunamadı');

    db.prepare(`
        INSERT OR IGNORE INTO personnel_licenses (personnel_id, license_id, granted_by)
        VALUES (?, ?, ?)
    `).run(req.params.id, license_id, req.user.id);

    recordActivity(req.user.id, 'LICENSE_GRANTED', 'personnel', req.params.id, { license: license.name }, req.ip);

    ok(res, null, 'Lisans verildi');
}));

// ---------- DELETE /api/personnel/:id/licenses/:licenseId ----------
router.delete('/:id/licenses/:licenseId', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    db.prepare(`
        DELETE FROM personnel_licenses
        WHERE personnel_id = ? AND license_id = ?
    `).run(req.params.id, req.params.licenseId);

    recordActivity(req.user.id, 'LICENSE_REVOKED', 'personnel', req.params.id, { license_id: req.params.licenseId }, req.ip);

    ok(res, null, 'Lisans alındı');
}));

// ============================================
//  REVIEWS
// ============================================

const reviewSchema = z.object({
    result: z.enum(['excellent', 'good', 'average', 'poor']),
    comment: z.string().min(10).max(2000),
    strengths: z.string().max(1000).optional().nullable(),
    weaknesses: z.string().max(1000).optional().nullable(),
    action_items: z.string().max(1000).optional().nullable(),
    notify_user: z.boolean().optional().default(false),
    scores: z.object({
        performance: z.number().int().min(1).max(5),
        cooperation: z.number().int().min(1).max(5),
        discipline: z.number().int().min(1).max(5),
        communication: z.number().int().min(1).max(5),
        overall: z.number().int().min(1).max(5),
    }).optional().nullable(),
});

// POST /api/personnel/:id/reviews — değerlendirme yaz (officer+)
router.post('/:id/reviews', authenticate, authorize('admin', 'officer'), asyncHandler(async (req, res) => {
    const personnelId = parseInt(req.params.id);
    const data = reviewSchema.parse(req.body);

    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE id = ?').get(personnelId);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    // Yorumcunun personnel kaydı
    const reviewerPersonnel = db.prepare('SELECT id FROM personnel WHERE user_id = ?').get(req.user.id);

    const result = db.prepare(`
        INSERT INTO personnel_reviews
            (personnel_id, reviewer_id, reviewer_user_id, result, comment, strengths, weaknesses, action_items, scores)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        personnelId,
        reviewerPersonnel?.id || null,
        req.user.id,
        data.result,
        data.comment,
        data.strengths || null,
        data.weaknesses || null,
        data.action_items || null,
        data.scores ? JSON.stringify(data.scores) : null
    );

    activityLogger.log({
        actionType: 'PERSONNEL_UPDATE',
        req,
        target: { id: personnelId, name: personnel.ic_name },
        summary: `Personel değerlendirmesi yapıldı: ${data.result}`,
    });

    created(res, { id: result.lastInsertRowid }, 'Değerlendirme kaydedildi');
}));

// GET /api/personnel/:id/reviews — değerlendirme listesi
router.get('/:id/reviews', authenticate, asyncHandler(async (req, res) => {
    const personnelId = parseInt(req.params.id);

    const personnel = db.prepare('SELECT id FROM personnel WHERE id = ?').get(personnelId);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const reviews = db.prepare(`
        SELECT
            pr.id,
            pr.result,
            pr.comment,
            pr.strengths,
            pr.weaknesses,
            pr.action_items,
            pr.scores,
            pr.created_at,
            u.username   AS reviewer_name
        FROM personnel_reviews pr
        LEFT JOIN users u ON u.id = pr.reviewer_user_id
        WHERE pr.personnel_id = ?
        ORDER BY pr.created_at DESC
    `).all(personnelId);

    const parsed = reviews.map(r => ({
        ...r,
        scores: r.scores ? JSON.parse(r.scores) : null,
    }));

    ok(res, parsed);
}));

// DELETE /api/personnel/:id/reviews/:reviewId — değerlendirme sil (admin)
router.delete('/:id/reviews/:reviewId', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const personnelId = parseInt(req.params.id);
    const reviewId    = parseInt(req.params.reviewId);

    const review = db.prepare('SELECT id FROM personnel_reviews WHERE id = ? AND personnel_id = ?').get(reviewId, personnelId);
    if (!review) throw new NotFoundError('Değerlendirme bulunamadı');

    db.prepare('DELETE FROM personnel_reviews WHERE id = ?').run(reviewId);

    activityLogger.log({
        actionType: 'PERSONNEL_UPDATE',
        req,
        target: { id: personnelId },
        summary: `Değerlendirme silindi (id: ${reviewId})`,
    });

    ok(res, null, 'Değerlendirme silindi');
}));

// GET /api/personnel/:id/reviews/:reviewId — tek değerlendirme detayı
router.get('/:id/reviews/:reviewId', authenticate, asyncHandler(async (req, res) => {
    const personnelId = parseInt(req.params.id);
    const reviewId = parseInt(req.params.reviewId);

    const review = db.prepare(`
        SELECT
            pr.id,
            pr.result,
            pr.comment,
            pr.strengths,
            pr.weaknesses,
            pr.action_items,
            pr.scores,
            pr.created_at,
            u.username AS reviewer_name
        FROM personnel_reviews pr
        LEFT JOIN users u ON u.id = pr.reviewer_user_id
        WHERE pr.id = ? AND pr.personnel_id = ?
    `).get(reviewId, personnelId);

    if (!review) throw new NotFoundError('Değerlendirme bulunamadı');

    ok(res, {
        ...review,
        scores: review.scores ? JSON.parse(review.scores) : null,
    });
}));

// ============================================
//  POST /api/personnel/:id/set-password
//  Personele şifre ata veya mevcut hesabını güncelle (admin)
// ============================================

function normalizeUsername(str) {
    return str.trim().substring(0, 32);
}

router.post('/:id/set-password', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const personnelId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password || String(password).trim().length < 8) {
        throw new ValidationError('Şifre en az 8 karakter olmalı');
    }

    const personnel = db.prepare('SELECT * FROM personnel WHERE id = ?').get(personnelId);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const hash = await bcrypt.hash(String(password), 10);
    let finalUsername;
    let isNewAccount = false;

    if (personnel.user_id) {
        // Mevcut hesabın şifresini güncelle, username'ini ic_name'e güncelle
        const existing = db.prepare('SELECT username FROM users WHERE id = ?').get(personnel.user_id);

        // ic_name'den yeni username üret
        let newUsername = existing?.username || null;
        if (personnel.ic_name) {
            let baseUsername = normalizeUsername(personnel.ic_name);
            let candidate = baseUsername;
            let suffix = 1;
            while (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(candidate, personnel.user_id)) {
                candidate = `${baseUsername}_${suffix++}`;
            }
            newUsername = candidate;
        }

        finalUsername = newUsername;
        db.prepare('UPDATE users SET username = ?, password_hash = ?, force_password_change = 1 WHERE id = ?')
            .run(finalUsername, hash, personnel.user_id);
    } else {
        // Kullanıcı hesabı yok — yeni oluştur
        isNewAccount = true;

        // Username öncelik sırası: ic_name → ooc_name → discord_username → user_<id>
        let baseUsername;
        if (personnel.ic_name) {
            baseUsername = normalizeUsername(personnel.ic_name);
        } else if (personnel.ooc_name) {
            baseUsername = normalizeUsername(personnel.ooc_name);
        } else if (personnel.discord_username) {
            baseUsername = normalizeUsername(personnel.discord_username);
        } else {
            baseUsername = `user_${personnelId}`;
        }

        // Çakışma önleme
        finalUsername = baseUsername;
        let suffix = 1;
        while (db.prepare('SELECT id FROM users WHERE username = ?').get(finalUsername)) {
            finalUsername = `${baseUsername}_${suffix++}`;
        }

        const result = db.prepare(`
            INSERT INTO users (username, password_hash, role, is_active, force_password_change)
            VALUES (?, ?, 'officer', 1, 1)
        `).run(finalUsername, hash);

        db.prepare('UPDATE personnel SET user_id = ? WHERE id = ?')
            .run(result.lastInsertRowid, personnelId);
    }

    activityLogger.log({
        actionType: 'personnel.password_set',
        req,
        target: { id: personnelId, name: personnel.ic_name },
        summary: `Şifre atandı (${isNewAccount ? 'yeni hesap' : 'mevcut hesap güncellendi'})`,
    });

    ok(res, { username: finalUsername, is_new_account: isNewAccount }, 'Şifre güncellendi');
}));

module.exports = router;
