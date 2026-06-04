// ============================================
//  Bot Action Queue Helper
//  Site → Bot iletişimi için kuyruk
// ============================================

const db = require('../database');

const ACTIONS = {
    SET_DISCORD_NICKNAME: 'set_nickname',
    SET_DISCORD_ROLE: 'set_role',
    REMOVE_DISCORD_ROLE: 'remove_role',
    KICK_FROM_GUILD: 'kick',
    SEND_DM: 'send_dm',
    DUTY_START: 'duty_start',
    DUTY_END: 'duty_end',
    RANK_CHANGED: 'rank_changed',
    PERSONNEL_DELETED: 'personnel_deleted',
};

function queueAction(actionType, payload) {
    try {
        db.prepare(`
            INSERT INTO bot_action_queue (action_type, payload)
            VALUES (?, ?)
        `).run(actionType, JSON.stringify(payload));
    } catch (e) {
        console.error('Bot queue ekleme hatası:', e.message);
    }
}

function fetchPendingActions(limit = 20) {
    return db.prepare(`
        SELECT * FROM bot_action_queue 
        WHERE status = 'pending' AND attempts < 3
        ORDER BY created_at ASC
        LIMIT ?
    `).all(limit).map(a => ({
        ...a,
        payload: JSON.parse(a.payload),
    }));
}

function markActionDone(id, result = null) {
    db.prepare(`
        UPDATE bot_action_queue 
        SET status = 'done', result = ?, processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(result ? JSON.stringify(result) : null, id);
}

function markActionFailed(id, error) {
    db.prepare(`
        UPDATE bot_action_queue 
        SET status = CASE WHEN attempts >= 2 THEN 'failed' ELSE 'pending' END,
            attempts = attempts + 1,
            result = ?,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(JSON.stringify({ error }), id);
}

module.exports = {
    ACTIONS,
    queueAction,
    fetchPendingActions,
    markActionDone,
    markActionFailed,
};