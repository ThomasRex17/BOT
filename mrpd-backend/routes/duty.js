// ============================================
//  Mesai API (GÜNCELLENDİ)
// ============================================

const express = require('express');
const { z } = require('zod');
const botQueue = require('../utils/botQueue');

const db = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { recordActivity } = require('../middleware/activityLog');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { ValidationError, NotFoundError } = require('../utils/errors');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// GET /api/duty/active — şu an aktif mesaide olanlar
// (ended_at IS NULL olan duty_sessions)
// ═══════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// Bot'un JSON dosyasının tam yolu — buraya kendi yolunu yaz!
const BOT_MESAI_JSON = process.env.BOT_MESAI_JSON
    || 'C:/Users/Administrator/Downloads/Bot/BOT/aktif_mesailer.json';

// ═══════════════════════════════════════════════════════
// GET /api/duty/active — bot JSON + DB cross-reference
// ═══════════════════════════════════════════════════════
router.get('/active', authenticate, asyncHandler(async (req, res) => {
    try {
        // 1) Bot'un JSON'unu oku
        let botData = {};
        try {
            const raw = fs.readFileSync(BOT_MESAI_JSON, 'utf8');
            botData = JSON.parse(raw);
        } catch (e) {
            console.warn('[Duty] mesai.json okunamadı:', e.message);
            return res.json({ success: true, data: [] });
        }
        
        const discordIds = Object.keys(botData);
        if (!discordIds.length) {
            return res.json({ success: true, data: [] });
        }
        
        // 2) Bu Discord ID'lerin personnel + rank bilgisini DB'den çek
        const placeholders = discordIds.map(() => '?').join(',');
        const sql = `
            SELECT 
                p.id,
                p.user_id,
                p.callsign,
                p.badge_number,
                p.ic_name,
                p.ooc_name,
                p.rank_id,
                p.status,
                p.discord_id,
                r.name AS rank_name,
                r.short_name AS rank_short,
                r.color AS rank_color
            FROM personnel p
            LEFT JOIN ranks r ON r.id = p.rank_id
            WHERE p.discord_id IN (${placeholders})
        `;
        
        let rows;
        if (typeof db.prepare === 'function') {
            rows = db.prepare(sql).all(...discordIds);
        } else if (typeof db.all === 'function') {
            rows = await new Promise((resolve, reject) => {
                db.all(sql, discordIds, (err, r) => err ? reject(err) : resolve(r));
            });
        } else {
            const r = await db.query(sql, discordIds);
            rows = r.rows || r[0] || r;
        }
        
        // 3) Bot data'sından mesai başlangıcını ekle
        const NOW = Date.now();
        const enriched = (rows || []).map(p => {
            const session = botData[p.discord_id];
            if (!session) return p;
            const startedMs = session.baslangic;
            return {
                ...p,
                started_at: new Date(startedMs).toISOString(),
                elapsed_minutes: Math.floor((NOW - startedMs) / 60000),
                birim: session.birim || null,
            };
        });
        
        // Bot'ta var ama DB'de personel kaydı olmayanları logla
        const foundIds = new Set((rows || []).map(r => r.discord_id));
        const missing = discordIds.filter(d => !foundIds.has(d));
        if (missing.length) {
            console.warn(`[Duty] DB'de personnel kaydı olmayan discord_id'ler:`, missing);
        }
        
        console.log(`[Duty] /active → bot ${discordIds.length}, DB ${rows?.length || 0} eşleşti`);
        
        res.json({ success: true, data: enriched });
    } catch (e) {
        console.error('[Duty] active error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}));

// YENİ: Mesai Bitir (Siteden -> Bota)
router.post('/end', authenticate, authorize('admin', 'officer'), asyncHandler(async (req, res) => {
    const { personnel_id } = req.body;
    if (!personnel_id) throw new ValidationError('personnel_id gerekli');

    const session = db.prepare(`SELECT * FROM duty_sessions WHERE personnel_id = ? AND ended_at IS NULL`).get(personnel_id);
    if (!session) throw new ValidationError('Bu personelin aktif mesaisi yok');

    // SAAT DİLİMİ (TIMEZONE) HATASINI ÇÖZEN KISIM (+ 'Z' EKLENTİSİ)
    const startedAt = new Date(session.started_at + 'Z'); 
    const now = new Date();
    const durationMinutes = Math.floor((now - startedAt) / 60000);

    db.prepare(`
        UPDATE duty_sessions 
        SET ended_at = CURRENT_TIMESTAMP, duration_minutes = ?, closed_by_user_id = ?
        WHERE id = ?
    `).run(durationMinutes, req.user.id, session.id);

    db.prepare('UPDATE personnel SET status = ? WHERE id = ?').run('offline', personnel_id);

    const personnel = db.prepare('SELECT ic_name, discord_id FROM personnel WHERE id = ?').get(personnel_id);
    recordActivity(req.user.id, 'DUTY_END', 'personnel', personnel_id, { 
        ic_name: personnel.ic_name, 
        duration: durationMinutes 
    }, req.ip);

    // BOT'A HABER VER
    if (personnel.discord_id) {
        try {
            fetch('http://localhost:3002/api/site-to-bot/mesai-bitir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: personnel.discord_id })
            }).catch(() => {});
        } catch(e) {}
    }

    // Bot'a bildir
const endDutyPerson = db.prepare('SELECT * FROM personnel WHERE id = ?').get(personnel_id);
if (endDutyPerson?.discord_id) {
    botQueue.queueAction(botQueue.ACTIONS.DUTY_END, {
        discord_id: endDutyPerson.discord_id,
        personnel_name: endDutyPerson.ic_name,
        duration_minutes: durationMinutes || 0,
    });
}

    ok(res, { duration_minutes: durationMinutes }, `Mesai sonlandırıldı (${durationMinutes} dk)`);
}));

router.post('/add-time', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { personnel_id, minutes } = req.body;
    if (!personnel_id || !minutes) throw new ValidationError('personnel_id ve minutes gerekli');

    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE id = ?').get(personnel_id);
    if (!personnel) throw new NotFoundError('Personel bulunamadı');

    const minutesInt = parseInt(minutes);
    if (isNaN(minutesInt) || minutesInt === 0) throw new ValidationError('Geçerli dakika değeri gerekli');

    db.prepare(`
        INSERT INTO duty_sessions (personnel_id, started_at, ended_at, duration_minutes, closed_by_user_id, notes)
        VALUES (?, datetime('now', '-' || ? || ' minutes'), CURRENT_TIMESTAMP, ?, ?, ?)
    `).run(personnel_id, Math.abs(minutesInt), minutesInt, req.user.id, 'Manuel ekleme');

    recordActivity(req.user.id, 'DUTY_TIME_ADDED', 'personnel', personnel_id, { minutes: minutesInt }, req.ip);
    ok(res, null, `${minutesInt} dakika eklendi`);
}));

// ============================================
// GET /api/duty/leaderboard?limit=30
// Toplam mesai süresine göre lider tahtası
// ============================================
router.get('/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const fs = require('fs');
        const path = require('path');
        
        // Bot'un toplam_mesailer.json dosyasını oku
        const botMesaiPath = 'C:\\Users\\Administrator\\Downloads\\Bot\\bot\\toplam_mesailer.json';
        let botMesaileri = {};
        try {
            if (fs.existsSync(botMesaiPath)) {
                botMesaileri = JSON.parse(fs.readFileSync(botMesaiPath, 'utf8'));
            }
        } catch (e) {
            console.warn('[leaderboard] bot JSON okunamadı:', e.message);
        }
        
        // DB'den personeli al
        const rows = db.prepare(`
            SELECT 
                p.id,
                p.discord_id,
                p.ic_name,
                p.ooc_name,
                p.callsign,
                p.badge_number,
                p.status,
                r.name as rank_name,
                r.short_name as rank_short,
                r.color as rank_color,
                r.rank_order,
                COUNT(ds.id) as db_session_count,
                COALESCE(SUM(ds.duration_minutes), 0) as db_minutes
            FROM personnel p
            LEFT JOIN ranks r ON p.rank_id = r.id
            LEFT JOIN duty_sessions ds ON ds.personnel_id = p.id AND ds.ended_at IS NOT NULL
            GROUP BY p.id
        `).all();
        
        // Bot JSON'undan toplam ms'yi alıp DB ile birleştir
        const enriched = rows.map(row => {
            const botData = row.discord_id ? botMesaileri[row.discord_id] : null;
            let total_minutes = 0;
            let session_count = row.db_session_count || 0;
            
            if (botData) {
                if (typeof botData === 'number') {
                    total_minutes = botData; // eski format: direkt dakika
                } else if (botData.ms) {
                    total_minutes = Math.floor(botData.ms / 60000); // yeni format: ms
                }
            }
            
            // Bot JSON'unda yoksa DB'den al
            if (total_minutes === 0 && row.db_minutes > 0) {
                total_minutes = row.db_minutes;
            }
            
            return {
                ...row,
                total_minutes,
                session_count,
                total_hours: Math.floor(total_minutes / 60),
                total_mins_remainder: total_minutes % 60,
            };
        });
        
        // Mesai süresine göre sırala (en çok mesai yapan başta)
        enriched.sort((a, b) => b.total_minutes - a.total_minutes);
        
        // Sıra numarası ekle ve limitle
        const final = enriched.slice(0, limit).map((row, idx) => ({
            rank: idx + 1,
            ...row,
        }));
        
        res.json({
            success: true,
            data: final,
            count: final.length,
            total_with_data: enriched.filter(r => r.total_minutes > 0).length,
        });
    } catch (err) {
        console.error('[leaderboard] hata:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// ═══════════════════════════════════════════════════════
// GET /api/duty/summary?week=YYYY-MM-DD
// SQLite uyumlu — better-sqlite3 ya da sqlite3
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// GET /api/duty/summary?week=YYYY-MM-DD
// Bot JSON'undan night shift saatlerini hesapla
// ═══════════════════════════════════════════════════════
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
    const week = req.query.week;
    if (!week) return res.status(400).json({ success: false, message: 'week parametresi gerekli' });
    
    try {
        let botData = {};
        try {
            botData = JSON.parse(fs.readFileSync(BOT_MESAI_JSON, 'utf8'));
        } catch (e) {
            return res.json({ success: true, data: {} });
        }
        
        const discordIds = Object.keys(botData);
        if (!discordIds.length) return res.json({ success: true, data: {} });
        
        // Discord ID → personnel.id mapping
        const placeholders = discordIds.map(() => '?').join(',');
        const mapSql = `SELECT id, discord_id FROM personnel WHERE discord_id IN (${placeholders})`;
        
        let mapRows;
        if (typeof db.prepare === 'function') {
            mapRows = db.prepare(mapSql).all(...discordIds);
        } else {
            mapRows = await new Promise((resolve, reject) => {
                db.all(mapSql, discordIds, (err, r) => err ? reject(err) : resolve(r));
            });
        }
        
        const dcToPid = new Map((mapRows || []).map(r => [r.discord_id, r.id]));
        
        const weekStart = new Date(week + 'T00:00:00').getTime();
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
        const NOW = Date.now();
        
        const data = {};
        
        for (const [discordId, session] of Object.entries(botData)) {
            const pid = dcToPid.get(discordId);
            if (!pid) continue; // DB'de personel yoksa atla
            
            const sessStart = Math.max(session.baslangic, weekStart);
            const sessEnd = Math.min(NOW, weekEnd); // Hala aktif → şimdi
            
            if (sessEnd <= sessStart) continue;
            
            // Dakika dakika dolaş, gece (00:00-06:00) say
            let totalMin = 0, nightMin = 0;
            for (let t = sessStart; t < sessEnd; t += 60000) {
                const hour = new Date(t).getHours();
                totalMin++;
                if (hour < 6) nightMin++; // 00:00-06:00 = night
            }
            
            data[pid] = {
                nightHours: +(nightMin / 60).toFixed(2),
                totalHours: +(totalMin / 60).toFixed(2),
            };
        }
        
        res.json({ success: true, data });
    } catch (e) {
        console.error('[Duty] summary error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
}));

// ═══════════════════════════════════════════════════════
// GET /api/duty/reset-reports/latest
// GET /api/duty/reset-reports/:id
// ═══════════════════════════════════════════════════════

router.get('/reset-reports/latest', authenticate, asyncHandler(async (req, res) => {
    const report = db.prepare(`
        SELECT * FROM duty_reset_reports
        ORDER BY created_at DESC LIMIT 1
    `).get();

    if (!report) {
        return res.status(404).json({ success: false, message: 'Henüz hiç mesai sıfırlama raporu yok' });
    }

    ok(res, {
        data: {
            ...report,
            payload: report.payload ? JSON.parse(report.payload) : null,
        },
    });
}));

router.get('/reset-reports/:id', authenticate, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const report = db.prepare('SELECT * FROM duty_reset_reports WHERE id = ?').get(id);

    if (!report) {
        return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
    }

    ok(res, {
        data: {
            ...report,
            payload: report.payload ? JSON.parse(report.payload) : null,
        },
    });
}));

module.exports = router;