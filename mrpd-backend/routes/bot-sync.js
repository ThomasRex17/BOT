// ============================================
//  Bot Sync API
//  Discord bot'un veritabanına yazdığı endpoint
// ============================================

const express = require('express');
const db = require('../database');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { AuthError } = require('../utils/errors');
const logger = require('../utils/logger');
const botQueue = require('../utils/botQueue');

const router = express.Router();

// Bot secret kontrolü
function botAuth(req, res, next) {
    const secret = req.headers['x-bot-secret'];
    if (!secret || secret !== process.env.BOT_SYNC_SECRET) {
        return next(new AuthError('Geçersiz bot secret'));
    }
    next();
}

// ============================================
//  POST /api/bot/sync
//  Bot tüm verileri toplu gönderir, biz DB'yi günceller
// ============================================
router.post('/sync', botAuth, asyncHandler(async (req, res) => {
    const { aktifMesailer, toplamMesailer, mazeretler, aktifBirimler, eskiIsimler } = req.body;
    
    let stats = {
        personnel_updated: 0,
        active_sessions: 0,
        leaves: 0,
        units: 0,
    };

    // ---- 1. ESKI İSİMLER → Personnel parse + güncelleme ----
// Format: "[502] Martino Rex | Eymen"
//   → Telsiz: 502
//   → IC İsim: "Martino Rex"
//   → OOC İsim: "Eymen"
if (eskiIsimler && typeof eskiIsimler === 'object') {
    const insertPersonnel = db.prepare(`
        INSERT OR IGNORE INTO personnel (discord_id, ic_name)
        VALUES (?, ?)
    `);
    const checkPersonnel = db.prepare('SELECT id, callsign FROM personnel WHERE discord_id = ?');
    
    for (const [discordId, fullName] of Object.entries(eskiIsimler)) {
        // String'i parçalara ayır: "[502] Martino Rex | Eymen"
        let callsign = null;
        let icName = fullName;
        let oocName = null;
        
        // 1. Telsiz kodunu çıkar: [502]
        const callsignMatch = fullName.match(/^\[(\d+)\]\s*(.*)/);
        if (callsignMatch) {
            callsign = parseInt(callsignMatch[1]);
            icName = callsignMatch[2].trim(); // "Martino Rex | Eymen"
        }
        
        // 2. IC ve OOC ismi ayır: "Martino Rex | Eymen"
        if (icName.includes('|')) {
            const parts = icName.split('|').map(s => s.trim());
            icName = parts[0]; // "Martino Rex"
            oocName = parts[1]; // "Eymen"
        }
        
        // Boş kalırsa fullName'i kullan
        if (!icName || icName.length < 1) {
            icName = fullName;
        }
        
        // Personel yoksa oluştur
        insertPersonnel.run(discordId, icName);
        
        // Mevcut personeli kontrol et
        const existing = checkPersonnel.get(discordId);
        if (!existing) continue;
        
        // 3. Bilgileri güncelle (sadece DB'de boş olanları)
        try {
            // IC İsim her zaman güncellensin (en güncel hali bot'tan gelir)
            db.prepare('UPDATE personnel SET ic_name = ? WHERE discord_id = ?').run(icName, discordId);
            
            // OOC İsim varsa ayarla
            if (oocName) {
                db.prepare('UPDATE personnel SET ooc_name = ? WHERE discord_id = ?').run(oocName, discordId);
            }
            
            // Telsiz kodu varsa ayarla (çakışmazsa)
            if (callsign) {
                // Aynı callsign başkasında mı?
                const conflict = db.prepare('SELECT id FROM personnel WHERE callsign = ? AND discord_id != ?').get(callsign, discordId);
                if (!conflict) {
                    db.prepare('UPDATE personnel SET callsign = ? WHERE discord_id = ?').run(callsign, discordId);
                }
            }
            
            stats.personnel_updated++;
        } catch (e) {
            // Sessiz devam et
            console.log(`Parse hatası ${discordId}: ${e.message}`);
        }
    }
}

    // ---- 2. TOPLAM MESAİLER ----
    if (toplamMesailer && typeof toplamMesailer === 'object') {
        const insertPersonnel = db.prepare(`
            INSERT OR IGNORE INTO personnel (discord_id, ic_name)
            VALUES (?, ?)
        `);
        const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
        
        for (const [discordId, data] of Object.entries(toplamMesailer)) {
            insertPersonnel.run(discordId, `User_${discordId.substring(0, 6)}`);
            
            const personnel = getPersonnel.get(discordId);
            if (!personnel) continue;
            
            // Toplam dakikayı bul
            const totalMs = typeof data === 'number' ? data : (data.ms || 0);
            const totalMinutes = Math.floor(totalMs / 60000);
            
            if (totalMinutes <= 0) continue;
            
            // Mevcut DB'deki toplamı kontrol et
            const existing = db.prepare(`
                SELECT COALESCE(SUM(duration_minutes), 0) as total 
                FROM duty_sessions 
                WHERE personnel_id = ? AND ended_at IS NOT NULL
            `).get(personnel.id);
            
            const diff = totalMinutes - existing.total;
            
            // Eğer fark varsa yeni bir session olarak ekle
            if (diff > 0) {
                db.prepare(`
                    INSERT INTO duty_sessions (personnel_id, started_at, ended_at, duration_minutes, notes)
                    VALUES (?, datetime('now', '-' || ? || ' minutes'), CURRENT_TIMESTAMP, ?, 'Bot sync')
                `).run(personnel.id, diff, diff);
                stats.active_sessions++;
            }
        }
    }

    // ---- 3. AKTİF MESAİLER ----
    if (aktifMesailer && typeof aktifMesailer === 'object') {
        const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
        
// Önce DB'deki tüm aktif sessionları JS saatiyle doğru şekilde kapat
const aktifler = db.prepare('SELECT id, started_at FROM duty_sessions WHERE ended_at IS NULL').all();
const updateSession = db.prepare('UPDATE duty_sessions SET ended_at = CURRENT_TIMESTAMP, duration_minutes = ?, is_auto_closed = 1 WHERE id = ?');

for (const s of aktifler) {
    const dk = Math.floor((Date.now() - new Date(s.started_at + 'Z').getTime()) / 60000);
    updateSession.run(dk > 0 ? dk : 1, s.id);
}
        
        // Personnel statuses'u sıfırla
        db.prepare(`UPDATE personnel SET status = 'offline' WHERE status = 'duty'`).run();
        
        // Bot'taki aktif mesaileri ekle
        const insertSession = db.prepare(`
            INSERT INTO duty_sessions (personnel_id, started_at)
            VALUES (?, ?)
        `);
        const updateStatus = db.prepare(`UPDATE personnel SET status = 'duty' WHERE id = ?`);
        
        for (const [discordId, data] of Object.entries(aktifMesailer)) {
            const personnel = getPersonnel.get(discordId);
            if (!personnel) continue;
            
            const startedAt = new Date(data.baslangic || data.giris || Date.now()).toISOString();
            insertSession.run(personnel.id, startedAt);
            updateStatus.run(personnel.id);
            stats.active_sessions++;
        }
    }

    // ---- 4. MAZERETLER ----
    if (mazeretler && Array.isArray(mazeretler)) {
        const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
        const insertPersonnel = db.prepare(`
            INSERT OR IGNORE INTO personnel (discord_id, ic_name)
            VALUES (?, ?)
        `);
        
        // Sadece bot kaynaklı mazeret kayıtlarını temizle (site kaynaklıları silme)
        db.prepare("DELETE FROM leaves WHERE review_note LIKE 'Bot:%'").run();
        
        const insertLeave = db.prepare(`
            INSERT INTO leaves (personnel_id, reason, additional_info, starts_at, ends_at, status, review_note, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const m of mazeretler) {
            if (!m.user) continue;
            
            insertPersonnel.run(m.user, `User_${m.user.substring(0, 6)}`);
            const personnel = getPersonnel.get(m.user);
            if (!personnel) continue;
            
            const startsAt = new Date().toISOString(); // tarih bilgisi yok botda
            const endsAt = m.bitisZamani ? new Date(m.bitisZamani).toISOString() : new Date(Date.now() + 86400000).toISOString();
            
            const status = m.durum === 'Onaylandı' ? 'approved' 
                         : m.durum === 'Reddedildi' ? 'rejected' 
                         : 'pending';
            
            const reviewNote = `Bot: ${m.onaylayan || 'sistem'} - ${m.onayTarihi || ''}`;
            const reviewedAt = m.onayTarihi || (status !== 'pending' ? new Date().toISOString() : null);
            
            insertLeave.run(
                personnel.id,
                m.sebep || 'Belirtilmedi',
                m.ek || '',
                startsAt,
                endsAt,
                status,
                reviewNote,
                reviewedAt
            );
            stats.leaves++;
        }
    }

    // ---- 5. AKTİF BİRİMLER ----
    if (aktifBirimler && typeof aktifBirimler === 'object') {
        // Eski aktif birimleri kapat
        db.prepare(`UPDATE active_units SET closed_at = CURRENT_TIMESTAMP WHERE closed_at IS NULL`).run();
        db.prepare(`DELETE FROM unit_members`).run();
        
        const insertUnit = db.prepare(`
            INSERT INTO active_units (type, code, capacity)
            VALUES (?, ?, ?)
        `);
        const getPersonnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
        const insertMember = db.prepare(`
            INSERT OR IGNORE INTO unit_members (unit_id, personnel_id)
            VALUES (?, ?)
        `);
        
        for (const [, data] of Object.entries(aktifBirimler)) {
            const result = insertUnit.run(data.tur || 'unknown', data.kod || '?', data.kapasite || 1);
            const unitId = result.lastInsertRowid;
            
            for (const memberDiscordId of (data.uyeler || [])) {
                const personnel = getPersonnel.get(memberDiscordId);
                if (personnel) {
                    insertMember.run(unitId, personnel.id);
                }
            }
            stats.units++;
        }
    }

    logger.success(`Bot sync tamam: ${JSON.stringify(stats)}`);
    
    ok(res, stats, 'Sync tamamlandı');
}));

// ============================================
//  POST /api/bot/duty/start
//  Bot mesai başlatınca bunu çağırır
// ============================================
router.post('/duty/start', botAuth, asyncHandler(async (req, res) => {
    const { discord_id, started_at } = req.body;
    
    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE discord_id = ?').get(discord_id);
    if (!personnel) {
        return ok(res, null, 'Personel DB\'de yok, atlandı');
    }
    
    // Aktif session var mı?
    const active = db.prepare('SELECT id FROM duty_sessions WHERE personnel_id = ? AND ended_at IS NULL').get(personnel.id);
    if (active) {
        return ok(res, null, 'Zaten aktif session var');
    }
    
    db.prepare(`
        INSERT INTO duty_sessions (personnel_id, started_at)
        VALUES (?, ?)
    `).run(personnel.id, started_at || new Date().toISOString());
    
    db.prepare('UPDATE personnel SET status = ? WHERE id = ?').run('duty', personnel.id);
    
    logger.info(`[BOT] Mesai başlatıldı: ${personnel.ic_name}`);
    ok(res, null, 'Mesai başlatıldı');
}));

// ============================================
//  POST /api/bot/duty/end
//  Bot mesai bitirince bunu çağırır
// ============================================
router.post('/duty/end', botAuth, asyncHandler(async (req, res) => {
    const { discord_id, duration_ms } = req.body;
    
    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE discord_id = ?').get(discord_id);
    if (!personnel) {
        return ok(res, null, 'Personel yok');
    }
    
    const session = db.prepare(`
        SELECT * FROM duty_sessions WHERE personnel_id = ? AND ended_at IS NULL
        ORDER BY started_at DESC LIMIT 1
    `).get(personnel.id);
    
    if (!session) return ok(res, null, 'Aktif session yok');
    
    const minutes = duration_ms ? Math.floor(duration_ms / 60000) : Math.floor((Date.now() - new Date(session.started_at + 'Z').getTime()) / 60000);
    
    db.prepare(`
        UPDATE duty_sessions 
        SET ended_at = CURRENT_TIMESTAMP, duration_minutes = ?
        WHERE id = ?
    `).run(minutes, session.id);
    
    db.prepare('UPDATE personnel SET status = ? WHERE id = ?').run('offline', personnel.id);
    
    logger.info(`[BOT] Mesai bitti: ${personnel.ic_name} (${minutes} dk)`);
    ok(res, { duration_minutes: minutes });
}));

// ============================================
//  POST /api/bot/leave
//  Bot mazeret oluşturunca
// ============================================
router.post('/leave', botAuth, asyncHandler(async (req, res) => {
    const { discord_id, reason, additional_info, ends_at, status } = req.body;
    
    const personnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?').get(discord_id);
    if (!personnel) return ok(res, null, 'Personel yok');
    
    db.prepare(`
        INSERT INTO leaves (personnel_id, reason, additional_info, starts_at, ends_at, status, review_note)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Bot kaynaklı')
    `).run(personnel.id, reason, additional_info || '', ends_at, status || 'pending');
    
    ok(res, null, 'Mazeret eklendi');
}));

// ============================================
//  GET /api/bot/health
//  Bot bağlantı testi
// ============================================
router.get('/health', botAuth, (req, res) => {
    ok(res, { 
        status: 'connected',
        time: new Date().toISOString(),
        personnel_count: db.prepare('SELECT COUNT(*) as c FROM personnel').get().c,
    });
});

// ============================================
//  POST /api/bot/member-left
//  Bir üye Discord'dan ayrılınca bot bunu çağırır
// ============================================
router.post('/member-left', botAuth, asyncHandler(async (req, res) => {
    const { discord_id, username } = req.body;
    if (!discord_id) return ok(res, null, 'discord_id gerekli');
    
    const personnel = db.prepare('SELECT id, ic_name FROM personnel WHERE discord_id = ?').get(discord_id);
    if (!personnel) return ok(res, null, 'DB\'de yok');
    
    // Aktif mesaisi varsa kapat
    db.prepare(`
        UPDATE duty_sessions 
        SET ended_at = CURRENT_TIMESTAMP, 
            duration_minutes = CAST((julianday('now') - julianday(started_at)) * 24 * 60 AS INTEGER),
            is_auto_closed = 1,
            notes = 'Discord\'dan ayrıldı'
        WHERE personnel_id = ? AND ended_at IS NULL
    `).run(personnel.id);
    
    // Bekleyen mazeretleri iptal et
    db.prepare(`
        UPDATE leaves 
        SET status = 'rejected', 
            review_note = 'Personel Discord\'dan ayrıldı',
            reviewed_at = CURRENT_TIMESTAMP
        WHERE personnel_id = ? AND status = 'pending'
    `).run(personnel.id);
    
    // Aktif birim üyeliklerinden çıkar
    db.prepare('DELETE FROM unit_members WHERE personnel_id = ?').run(personnel.id);
    
    // Personeli sil
    db.prepare('DELETE FROM personnel WHERE id = ?').run(personnel.id);
    
    logger.warn(`[BOT] Personel ayrıldı: ${personnel.ic_name} (${discord_id})`);
    ok(res, null, `${personnel.ic_name} silindi`);
}));

// ============================================
//  POST /api/bot/role-update
//  Bot Discord'daki rol değişikliğini bildirir
// ============================================
router.post('/role-update', botAuth, asyncHandler(async (req, res) => {
    const { discord_id, role_ids, display_name } = req.body;
    if (!discord_id || !Array.isArray(role_ids)) {
        return ok(res, null, 'Geçersiz veri');
    }
    
    // Discord rol ID'lerine göre rütbeyi bul
    const rank = db.prepare(`
        SELECT id FROM ranks 
        WHERE discord_role_id IN (${role_ids.map(() => '?').join(',') || "''"})
        ORDER BY rank_order ASC
        LIMIT 1
    `).get(...role_ids);
    
    const personnel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?').get(discord_id);
    if (!personnel) return ok(res, null, 'Personel yok');
    
    // Rütbeyi güncelle
    if (rank) {
        db.prepare('UPDATE personnel SET rank_id = ? WHERE id = ?').run(rank.id, personnel.id);
    } else {
        db.prepare('UPDATE personnel SET rank_id = NULL WHERE id = ?').run(personnel.id);
    }
    
    // Display name güncelle (varsa)
    if (display_name) {
        // "[502] Martino Rex | Eymen" formatını parse et
        let callsign = null;
        let icName = display_name;
        let oocName = null;
        
        const callsignMatch = display_name.match(/^\[(\d+)\]\s*(.*)/);
        if (callsignMatch) {
            callsign = parseInt(callsignMatch[1]);
            icName = callsignMatch[2].trim();
        }
        
        if (icName.includes('|')) {
            const parts = icName.split('|').map(s => s.trim());
            icName = parts[0];
            oocName = parts[1];
        }
        
        try {
            db.prepare('UPDATE personnel SET ic_name = ?, ooc_name = ? WHERE id = ?').run(icName, oocName, personnel.id);
            
            if (callsign) {
                const conflict = db.prepare('SELECT id FROM personnel WHERE callsign = ? AND id != ?').get(callsign, personnel.id);
                if (!conflict) {
                    db.prepare('UPDATE personnel SET callsign = ? WHERE id = ?').run(callsign, personnel.id);
                }
            }
        } catch (e) {
            console.log('Parse error:', e.message);
        }
    }
    
    ok(res, null, 'Rütbe güncellendi');
}));

// ============================================
//  POST /api/bot/full-member-sync
//  SADECE LSPD üyeleri sync edilir
// ============================================
router.post('/full-member-sync', botAuth, asyncHandler(async (req, res) => {
    const { members } = req.body;
    if (!Array.isArray(members)) return ok(res, null, 'members gerekli');
    
    const LSPD_GENEL_ROL_ID = process.env.LSPD_GENEL_ROL_ID || '1487581846182166548';
    
    // SADECE LSPD genel rolü olanları al
    const lspdMembers = members.filter(m => 
        Array.isArray(m.role_ids) && m.role_ids.includes(LSPD_GENEL_ROL_ID)
    );
    
    const activeDiscordIds = lspdMembers.map(m => m.discord_id).filter(Boolean);
    
    let stats = { updated: 0, added: 0, removed: 0, skipped: members.length - lspdMembers.length };
    
    // 1. LSPD'de olmayan personelleri sil
    if (activeDiscordIds.length > 0) {
        const placeholders = activeDiscordIds.map(() => '?').join(',');
        
        const toRemove = db.prepare(`
            SELECT id, ic_name FROM personnel 
            WHERE discord_id IS NOT NULL 
            AND discord_id NOT IN (${placeholders})
        `).all(...activeDiscordIds);
        
        for (const p of toRemove) {
            db.prepare(`
                UPDATE duty_sessions 
                SET ended_at = CURRENT_TIMESTAMP, is_auto_closed = 1
                WHERE personnel_id = ? AND ended_at IS NULL
            `).run(p.id);
            db.prepare('DELETE FROM unit_members WHERE personnel_id = ?').run(p.id);
            db.prepare('DELETE FROM personnel WHERE id = ?').run(p.id);
            stats.removed++;
        }
    } else {
        // Hiç LSPD üyesi yoksa hepsini sil (anormal durum)
        const allCount = db.prepare('SELECT COUNT(*) as c FROM personnel WHERE discord_id IS NOT NULL').get().c;
        if (allCount > 0) {
            console.log('⚠️ LSPD üye listesi boş geldi, silme atlandı (güvenlik)');
        }
    }
    
    // 2. LSPD üyeleri ekle/güncelle
    for (const member of lspdMembers) {
        if (!member.discord_id) continue;
        
        let callsign = null;
        let icName = member.display_name || `User_${member.discord_id.substring(0, 6)}`;
        let oocName = null;
        
        const callsignMatch = (member.display_name || '').match(/^\[(\d+)\]\s*(.*)/);
        if (callsignMatch) {
            callsign = parseInt(callsignMatch[1]);
            icName = callsignMatch[2].trim();
        }
        
        if (icName.includes('|')) {
            const parts = icName.split('|').map(s => s.trim());
            icName = parts[0];
            oocName = parts[1];
        }
        
        // Rütbe bul (en yüksek rank_order'lı = en yüksek rütbe)
        let rankId = null;
        if (Array.isArray(member.role_ids) && member.role_ids.length > 0) {
            const placeholders = member.role_ids.map(() => '?').join(',');
            const rank = db.prepare(`
                SELECT id FROM ranks 
                WHERE discord_role_id IN (${placeholders})
                ORDER BY rank_order ASC
                LIMIT 1
            `).get(...member.role_ids);
            if (rank) rankId = rank.id;
        }
        
        const existing = db.prepare('SELECT id, callsign FROM personnel WHERE discord_id = ?').get(member.discord_id);
        
        if (existing) {
            try {
                db.prepare(`
                    UPDATE personnel 
                    SET ic_name = ?, ooc_name = ?, rank_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(icName, oocName, rankId, existing.id);
                
                if (callsign && callsign !== existing.callsign) {
                    const conflict = db.prepare('SELECT id FROM personnel WHERE callsign = ? AND id != ?').get(callsign, existing.id);
                    if (!conflict) {
                        db.prepare('UPDATE personnel SET callsign = ? WHERE id = ?').run(callsign, existing.id);
                    }
                }
                stats.updated++;
            } catch (e) {}
        } else {
            try {
                db.prepare(`
                    INSERT INTO personnel (discord_id, ic_name, ooc_name, callsign, rank_id, status)
                    VALUES (?, ?, ?, ?, ?, 'offline')
                `).run(member.discord_id, icName, oocName, callsign, rankId);
                stats.added++;
            } catch (e) {}
        }
    }
    
    logger.success(`LSPD sync: +${stats.added} eklendi, ${stats.updated} güncellendi, -${stats.removed} silindi (${stats.skipped} non-LSPD atlandı)`);
    ok(res, stats);
}));

// ============================================
//  POST /api/bot/fto-sync
//  Bot Discord FTO thread listesini gönderir,
//  backend upsert + transaction ile DB'ye yazar.
//  Beklenen body: { threads: [{ threadId, trainerId, trainerUsername,
//                               traineeId, traineeUsername, status,
//                               notes?, createdAt? }] }
// ============================================
router.post('/fto-sync', botAuth, asyncHandler(async (req, res) => {
    const { threads } = req.body;
    if (!Array.isArray(threads)) {
        return ok(res, null, 'threads dizisi gerekli');
    }

    const upsert = db.prepare(`
        INSERT INTO fto_discord_threads
            (thread_id, trainer_discord_id, trainer_username,
             trainee_discord_id, trainee_username,
             status, notes, discord_created_at, last_sync_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
            trainer_discord_id = excluded.trainer_discord_id,
            trainer_username   = excluded.trainer_username,
            trainee_discord_id = excluded.trainee_discord_id,
            trainee_username   = excluded.trainee_username,
            status             = excluded.status,
            notes              = excluded.notes,
            last_sync_at       = excluded.last_sync_at,
            updated_at         = excluded.updated_at
    `);

    const closeAll = db.prepare(`
        UPDATE fto_discord_threads SET status = 'closed', updated_at = ? WHERE status = 'active'
    `);

    const syncFn = db.transaction((threads) => {
        const now = new Date().toISOString();
        const activeIds = [];

        for (const t of threads) {
            if (!t.threadId) continue;
            upsert.run(
                t.threadId,
                t.trainerId    || null,
                t.trainerUsername || null,
                t.traineeId    || null,
                t.traineeUsername || null,
                t.status       || 'active',
                t.notes        || null,
                t.createdAt    ? new Date(t.createdAt).toISOString() : null,
                now,
                now
            );
            if ((t.status || 'active') === 'active') activeIds.push(t.threadId);
        }

        // Discord'da artık açık olmayan aktif thread'leri kapat
        if (activeIds.length > 0) {
            const ph = activeIds.map(() => '?').join(',');
            db.prepare(
                `UPDATE fto_discord_threads SET status = 'closed', updated_at = ?
                 WHERE thread_id NOT IN (${ph}) AND status = 'active'`
            ).run(now, ...activeIds);
        } else if (threads.length > 0) {
            // Veri geldi ama hiç aktif thread yok → hepsini kapat
            closeAll.run(now);
        }
        // threads boşsa güvenlik: hiçbir şey silme

        return { synced: threads.length, activeCount: activeIds.length };
    });

    const result = syncFn(threads);
    logger.success(`[FTO] Sync: ${result.synced} thread işlendi, ${result.activeCount} aktif`);
    ok(res, result, 'FTO sync tamamlandı');
}));

// ============================================
//  GET /api/bot/queue
//  Bot bekleyen aksiyonları çeker
// ============================================
router.get('/queue', botAuth, asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const actions = botQueue.fetchPendingActions(limit);
    ok(res, actions);
}));

// ============================================
//  POST /api/bot/queue/:id/done
//  Bot aksiyon tamamlandığında bildir
// ============================================
router.post('/queue/:id/done', botAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { result } = req.body;
    botQueue.markActionDone(id, result);
    ok(res, null, 'Tamamlandı');
}));

// ============================================
//  POST /api/bot/queue/:id/failed
//  Bot aksiyon başarısız olduğunda bildir
// ============================================
router.post('/queue/:id/failed', botAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { error } = req.body;
    botQueue.markActionFailed(id, error);
    ok(res, null, 'Bildirildi');
}));

module.exports = router;