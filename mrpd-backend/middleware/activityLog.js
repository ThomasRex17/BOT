// ============================================
//  Activity Log Middleware
//  Önemli işlemleri kaydeder (Yeni MRPD DB Uyumlu)
// ============================================

const db = require('../database');

// Yeni tablo yapısına göre INSERT sorgusu güncellendi
const insertLog = db.prepare(`
    INSERT INTO activity_log (
        actor_user_id, 
        action_type, 
        action_label, 
        summary, 
        target_personnel_id, 
        details, 
        ip_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function logActivity(action, targetType = null, targetId = null, details = null) {
    return (req, res, next) => {
        const userId = req.user?.id || null;
        const ip = req.ip || req.connection?.remoteAddress;
        const detailsJson = details ? JSON.stringify(details) : null;
        
        try {
            // action_label zorunlu olduğu için action ile aynı değeri veriyoruz
            // targetType verisini kaybetmemek için summary kısmına yazdırıyoruz
            insertLog.run(userId, action, action, targetType, targetId, detailsJson, ip);
        } catch (e) {
            // Log hatası uygulamayı durdurmaz
            console.error('Log kaydedilemedi:', e.message);
        }
        
        next();
    };
}

// Manuel log atma (bir route içinden)
function recordActivity(userId, action, targetType = null, targetId = null, details = null, ip = null) {
    try {
        insertLog.run(
            userId, 
            action, 
            action, // action_label
            targetType, // summary
            targetId, // target_personnel_id
            details ? JSON.stringify(details) : null, // details
            ip
        );
    } catch (e) {
        console.error('Log kaydedilemedi:', e.message);
    }
}

module.exports = { logActivity, recordActivity };