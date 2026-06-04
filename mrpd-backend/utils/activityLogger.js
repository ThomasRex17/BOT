// ============================================
//  Activity Logger
// ============================================

const db = require('../database');

const ACTION_TYPES = {
    LOGIN: { type: 'login', label: 'Giriş yapıldı' },
    LOGOUT: { type: 'logout', label: 'Çıkış yapıldı' },
    PERSONNEL_CREATE: { type: 'personnel_create', label: 'Yeni personel oluşturuldu' },
    PERSONNEL_UPDATE: { type: 'personnel_update', label: 'Personel bilgisi güncellendi' },
    PERSONNEL_DELETE: { type: 'personnel_delete', label: 'Personel silindi' },
    RANK_CREATE: { type: 'rank_create', label: 'Rütbe oluşturuldu' },
    RANK_UPDATE: { type: 'rank_update', label: 'Rütbe güncellendi' },
    RANK_DELETE: { type: 'rank_delete', label: 'Rütbe silindi' },
    LICENSE_GRANT: { type: 'license_grant', label: 'Lisans verildi' },
    LICENSE_REVOKE: { type: 'license_revoke', label: 'Lisans kaldırıldı' },
    DUTY_START: { type: 'duty_start', label: 'Mesaiye giriş yapıldı' },
    DUTY_END: { type: 'duty_end', label: 'Mesaiden çıkış yapıldı' },
    DUTY_RESET: { type: 'duty_reset', label: 'Veri sıfırlama işlemi' },
    LEAVE_CREATE: { type: 'leave_create', label: 'Mazeret oluşturuldu' },
    LEAVE_APPROVE: { type: 'leave_approve', label: 'Mazeret onaylandı' },
    LEAVE_REJECT: { type: 'leave_reject', label: 'Mazeret reddedildi' },
    APPLICATION_SUBMIT: { type: 'application_submit', label: 'Başvuru gönderildi' },
    APPLICATION_APPROVE: { type: 'application_approve', label: 'Başvuru onaylandı' },
    APPLICATION_REJECT: { type: 'application_reject', label: 'Başvuru reddedildi' },
    SETTINGS_UPDATE: { type: 'settings_update', label: 'Ayarlar güncellendi' },
};

function log({ actionType, req, actor, target, summary, details }) {
    try {
        const a = ACTION_TYPES[actionType] || { type: actionType.toLowerCase(), label: actionType };
        const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || null;
        const user = req?.user || actor || {};
        
        db.prepare(`
            INSERT INTO activity_log (
                action_type, action_label,
                actor_user_id, actor_name, actor_civ_id,
                target_personnel_id, target_name, target_civ_id,
                summary, details, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            a.type,
            a.label,
            user.id || null,
            user.username || user.name || null,
            user.civ_id || null,
            target?.id || null,
            target?.name || target?.ic_name || null,
            target?.civ_id || null,
            summary || null,
            details ? JSON.stringify(details) : null,
            ip ? String(ip).substring(0, 45) : null
        );
    } catch (e) {
        console.error('Activity log error:', e.message);
    }
}

module.exports = { log, ACTION_TYPES };