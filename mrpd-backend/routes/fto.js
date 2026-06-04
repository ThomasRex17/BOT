const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// fto_reports tablosu — yoksa oluştur
db.exec(`
    CREATE TABLE IF NOT EXISTS fto_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        trainer_discord_id TEXT,
        trainee_discord_id TEXT,
        trainer_name TEXT,
        trainee_name TEXT,
        report_date TEXT,
        shift_start TEXT,
        shift_end TEXT,
        patrol_unit TEXT,
        radio_usage TEXT,
        vehicle_driving TEXT,
        incident_approach TEXT,
        regulation_compliance TEXT,
        hierarchy_compliance TEXT,
        civilian_communication TEXT,
        conduct TEXT,
        officer_communication TEXT,
        felony_stop_compliance TEXT,
        environment_interaction TEXT,
        general_view TEXT,
        fts_errors TEXT,
        signature TEXT,
        created_by_user_id INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

// ---------- CONSTANTS ----------
const BOT_DATA_PATH = process.env.BOT_DATA_PATH || path.join(__dirname, '../../bot');
const FTO_FILE     = path.join(BOT_DATA_PATH, 'fto_atamalari.json');
const MEMBERS_FILE = path.join(BOT_DATA_PATH, 'discord_members.json');

const BOT_HTTP_URL    = process.env.BOT_HTTP_URL    || 'http://127.0.0.1:3001';
const BOT_HTTP_SECRET = process.env.BOT_HTTP_SECRET || 'CHANGE_ME';

// FTO_TRAINEE_ROLE_IDS — Discord'da eğitim bekleyenlerin rol ID'leri (virgülle ayrılmış)
const TRAINEE_ROLE_IDS = (process.env.FTO_TRAINEE_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

// FTO_TRAINER_ROLE_IDS — Discord'da FTO (eğitmen) rolüne sahip üyelerin rol ID'leri
const FTO_ROLE_IDS = (process.env.FTO_TRAINER_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

function readJSON(file, fallback = []) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { return fallback; }
}

// ---------- GET /api/fto/assignments ----------
router.get('/assignments', authenticate, asyncHandler(async (req, res) => {
    const status = req.query.status || 'active';
    const items = db.prepare(`
        SELECT a.*,
               fto.ic_name as fto_ic_name, fto.callsign as fto_callsign,
               student.ic_name as student_ic_name, student.callsign as student_callsign
        FROM fto_assignments a
        LEFT JOIN personnel fto ON a.fto_id = fto.id
        LEFT JOIN personnel student ON a.student_id = student.id
        WHERE a.status = ?
        ORDER BY a.created_at DESC
    `).all(status);
    ok(res, items);
}));

// ---------- POST /api/fto/assignments ----------
router.post('/assignments', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { fto_id, student_id, start_date, notes } = req.body;
    if (!fto_id || !student_id || !start_date) {
        return res.status(400).json({ success: false, message: 'FTO, öğrenci ve başlangıç tarihi gerekli' });
    }

    const fto     = db.prepare('SELECT ic_name FROM personnel WHERE id = ?').get(fto_id);
    const student = db.prepare('SELECT ic_name FROM personnel WHERE id = ?').get(student_id);

    const result = db.prepare(`
        INSERT INTO fto_assignments (fto_id, fto_name, student_id, student_name, start_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(fto_id, fto?.ic_name, student_id, student?.ic_name, start_date, notes || null);

    ok(res, { id: result.lastInsertRowid }, 'FTO ataması oluşturuldu');
}));

// ---------- PUT /api/fto/assignments/:id/complete ----------
router.put('/assignments/:id/complete', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { end_date } = req.body;
    db.prepare(`
        UPDATE fto_assignments
        SET status = 'completed', end_date = ?
        WHERE id = ?
    `).run(end_date || new Date().toISOString().split('T')[0], parseInt(req.params.id));
    ok(res, null, 'Atama tamamlandı');
}));

// ---------- POST /api/fto/evaluations ----------
router.post('/evaluations', authenticate, asyncHandler(async (req, res) => {
    const { assignment_id, rating, strengths, weaknesses, recommendation } = req.body;
    if (!assignment_id) {
        return res.status(400).json({ success: false, message: 'Atama ID gerekli' });
    }

    const result = db.prepare(`
        INSERT INTO fto_evaluations (assignment_id, evaluator_id, evaluator_name, rating, strengths, weaknesses, recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        assignment_id,
        req.user.id,
        req.user.username,
        rating || 3,
        strengths || null,
        weaknesses || null,
        recommendation || null
    );

    ok(res, { id: result.lastInsertRowid }, 'Değerlendirme kaydedildi');
}));

// ---------- GET /api/fto/discord-sync ----------
router.get('/discord-sync', authenticate, asyncHandler(async (req, res) => {
    const memberData = readJSON(MEMBERS_FILE, []);
    const memberMap  = new Map(memberData.map(m => [m.id, m]));

    // DB'den FTO thread verisi çek (race condition yok, transaction güvenceli)
    const ftoData = db.prepare('SELECT * FROM fto_discord_threads ORDER BY created_at DESC').all();

    // Her atamayı zenginleştir
    const enriched = ftoData.map(f => {
        const traineeId      = f.trainee_discord_id;
        const trainerId      = f.trainer_discord_id;
        const traineeInGuild = !!(traineeId && memberMap.has(traineeId));
        const trainerInGuild = !!(trainerId && memberMap.has(trainerId));
        const traineeMember  = traineeId ? memberMap.get(traineeId) : null;
        const trainerMember  = trainerId ? memberMap.get(trainerId) : null;
        return {
            ...f,
            traineeId,
            trainerId,
            traineeUsername:    f.trainee_username,
            trainerUsername:    f.trainer_username,
            traineeInGuild,
            trainerInGuild,
            traineeDisplayName: traineeMember?.displayName || f.trainee_username || '—',
            trainerDisplayName: trainerMember?.displayName || f.trainer_username || '—',
            isOrphan: f.status === 'active' && (!traineeInGuild || !trainerInGuild),
        };
    });

    // 1) Aktif & sağlam atamalar
    const aktifAtamalar = enriched.filter(f => f.status === 'active' && !f.isOrphan);

    // 2) Orphan atamalar
    const orphanAtamalar = enriched.filter(f => f.isOrphan).map(f => ({
        ...f,
        leftWho: !f.traineeInGuild && !f.trainerInGuild ? 'both'
              : !f.traineeInGuild ? 'trainee' : 'trainer',
    }));

    // 3) FTO bekleyen adaylar (trainee rolü var, aktif ataması yok)
    const aktifTraineeIds = new Set(aktifAtamalar.map(f => f.traineeId).filter(Boolean));
    const ftoBekleyenler  = TRAINEE_ROLE_IDS.length === 0 ? [] :
        memberData
            .filter(m => m.roleIds.some(rid => TRAINEE_ROLE_IDS.includes(rid)))
            .filter(m => !aktifTraineeIds.has(m.id))
            .map(m => ({
                discordId:   m.id,
                username:    m.username,
                displayName: m.displayName,
                nickname:    m.nickname,
                joinedAt:    m.joinedAt,
            }));

    // 4) Kapanmış atamalar
    const kapali = enriched.filter(f => f.status === 'closed');

    // 5) Discord'da FTO rolüne sahip üyeler
    const ftoMembers = FTO_ROLE_IDS.length === 0 ? [] :
        memberData
            .filter(m => Array.isArray(m.roleIds) && m.roleIds.some(rid => FTO_ROLE_IDS.includes(rid)))
            .map(m => ({
                discordId:   m.id,
                username:    m.username,
                displayName: m.displayName,
                nickname:    m.nickname,
                joinedAt:    m.joinedAt,
            }));

    const lastSyncRow = db.prepare('SELECT MAX(last_sync_at) as t FROM fto_discord_threads').get();

    res.json({
        success: true,
        data: {
            active:        aktifAtamalar,
            orphans:       orphanAtamalar,
            waitingForFTO: ftoBekleyenler,
            closed:        kapali,
            ftoMembers,
            stats: {
                activeCount:    aktifAtamalar.length,
                orphanCount:    orphanAtamalar.length,
                waitingCount:   ftoBekleyenler.length,
                closedCount:    kapali.length,
                ftoMemberCount: ftoMembers.length,
                lastSync:       lastSyncRow?.t || null,
            }
        }
    });
}));

// ---------- POST /api/fto/create → bot'a thread aç ----------
router.post('/create', authenticate, asyncHandler(async (req, res) => {
    const { trainerId, traineeId, notes } = req.body;

    if (!trainerId || !traineeId) {
        return res.status(400).json({ success: false, message: 'trainerId ve traineeId zorunlu' });
    }
    if (trainerId === traineeId) {
        return res.status(400).json({ success: false, message: 'Trainer ve trainee aynı kişi olamaz' });
    }

    try {
        const botRes = await fetch(`${BOT_HTTP_URL}/fto/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: BOT_HTTP_SECRET, trainerId, traineeId, notes: notes || null }),
        });

        const data = await botRes.json();

        if (!botRes.ok) {
            return res.status(botRes.status).json({ success: false, message: data.error || 'Bot hatası' });
        }

        res.json({ success: true, data, message: 'FTO thread oluşturuldu' });
    } catch (e) {
        console.error('[FTO] Bot bağlantı hatası:', e.message);
        res.status(503).json({ success: false, message: 'Bot şu an erişilemiyor. Bot çalışıyor mu?' });
    }
}));

// ---------- POST /api/fto/sync → manuel resync ----------
router.post('/sync', authenticate, asyncHandler(async (req, res) => {
    try {
        const botRes = await fetch(`${BOT_HTTP_URL}/fto/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: BOT_HTTP_SECRET }),
        });
        const data = await botRes.json();
        res.json({ success: botRes.ok, data });
    } catch (e) {
        res.status(503).json({ success: false, message: 'Bot erişilemiyor' });
    }
}));

// ---------- POST /api/fto/reports — Yeni rapor kaydet ----------
router.post('/reports', authenticate, asyncHandler(async (req, res) => {
    const {
        thread_id, trainer_discord_id, trainee_discord_id, trainer_name, trainee_name,
        report_date, shift_start, shift_end, patrol_unit,
        radio_usage, vehicle_driving, incident_approach, regulation_compliance,
        hierarchy_compliance, civilian_communication, conduct, officer_communication,
        felony_stop_compliance, environment_interaction, general_view, fts_errors, signature,
    } = req.body;

    if (!thread_id) return res.status(400).json({ success: false, message: 'thread_id zorunlu' });

    const result = db.prepare(`
        INSERT INTO fto_reports (
            thread_id, trainer_discord_id, trainee_discord_id, trainer_name, trainee_name,
            report_date, shift_start, shift_end, patrol_unit,
            radio_usage, vehicle_driving, incident_approach, regulation_compliance,
            hierarchy_compliance, civilian_communication, conduct, officer_communication,
            felony_stop_compliance, environment_interaction, general_view, fts_errors,
            signature, created_by_user_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
        thread_id, trainer_discord_id || null, trainee_discord_id || null,
        trainer_name || null, trainee_name || null,
        report_date || null, shift_start || null, shift_end || null, patrol_unit || null,
        radio_usage || null, vehicle_driving || null, incident_approach || null,
        regulation_compliance || null, hierarchy_compliance || null, civilian_communication || null,
        conduct || null, officer_communication || null, felony_stop_compliance || null,
        environment_interaction || null, general_view || null, fts_errors || null,
        signature || null, req.user.id
    );

    // Discord thread'e rapor mesajı gönder (hata olsa bile kaydı döndür)
    try {
        await fetch(`${BOT_HTTP_URL}/fto/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: BOT_HTTP_SECRET,
                threadId: thread_id,
                trainer_name, trainee_name,
                report_date, shift_start, shift_end, patrol_unit,
                radio_usage, vehicle_driving, incident_approach,
                regulation_compliance, hierarchy_compliance, civilian_communication,
                conduct, officer_communication, felony_stop_compliance,
                environment_interaction, general_view, fts_errors, signature,
            }),
        });
    } catch (e) {
        console.error('[FTO] Discord rapor gönderme hatası:', e.message);
    }

    ok(res, { id: result.lastInsertRowid }, 'Rapor kaydedildi');
}));

// ---------- GET /api/fto/reports?thread_id=xxx — Raporları listele ----------
router.get('/reports', authenticate, asyncHandler(async (req, res) => {
    const { thread_id } = req.query;
    const rows = thread_id
        ? db.prepare(`
            SELECT r.*, u.username as created_by_username
            FROM fto_reports r LEFT JOIN users u ON r.created_by_user_id = u.id
            WHERE r.thread_id = ? ORDER BY r.created_at DESC
          `).all(thread_id)
        : db.prepare(`
            SELECT r.*, u.username as created_by_username
            FROM fto_reports r LEFT JOIN users u ON r.created_by_user_id = u.id
            ORDER BY r.created_at DESC LIMIT 100
          `).all();
    ok(res, rows);
}));

// ---------- DELETE /api/fto/reports/:id — Rapor sil ----------
router.delete('/reports/:id', authenticate, asyncHandler(async (req, res) => {
    const report = db.prepare('SELECT id, created_by_user_id FROM fto_reports WHERE id = ?').get(parseInt(req.params.id));
    if (!report) return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
    if (req.user.role !== 'admin' && report.created_by_user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Bu raporu silme yetkiniz yok' });
    }
    db.prepare('DELETE FROM fto_reports WHERE id = ?').run(parseInt(req.params.id));
    ok(res, null, 'Rapor silindi');
}));

module.exports = router;
