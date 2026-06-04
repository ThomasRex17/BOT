// ============================================
//  MRPD Site DB Sync (v2)
// ============================================

const fetch = global.fetch || require('node-fetch');

const API_URL = 'http://localhost:3001/api/bot';
const BOT_SECRET = 'mrpd_bot_sync_kjsdh38fdj92kdf938fjkd238fjksdf';

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5000;

async function apiPost(endpoint, data, timeoutMs = 10000) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Bot-Secret': BOT_SECRET,
            },
            body: JSON.stringify(data),
            signal: ac.signal,
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (err) { return null; }
    finally { clearTimeout(tid); }
}

async function fullSync(data) {
    const now = Date.now();
    if (now - lastSyncTime < SYNC_COOLDOWN) return;
    if (isSyncing) return;
    isSyncing = true;
    lastSyncTime = now;
    try {
        const result = await apiPost('/sync', data);
        if (result?.success) console.log('[DB-SYNC] ✅ JSON sync tamam');
    } finally { isSyncing = false; }
}

async function dutyStart(discordId) {
    return apiPost('/duty/start', { discord_id: discordId, started_at: new Date().toISOString() }, 5000);
}

async function dutyEnd(discordId, durationMs) {
    return apiPost('/duty/end', { discord_id: discordId, duration_ms: durationMs }, 5000);
}

async function memberLeft(discordId, username) {
    const result = await apiPost('/member-left', { discord_id: discordId, username }, 5000);
    if (result?.success) console.log(`[DB-SYNC] 👋 Üye silindi: ${username || discordId}`);
    return result;
}

async function roleUpdate(discordId, roleIds, displayName) {
    return apiPost('/role-update', { discord_id: discordId, role_ids: roleIds, display_name: displayName }, 5000);
}

async function fullMemberSync(guild) {
    if (!guild) return;
    try {
        const members = guild.members.cache
            .filter(m => !m.user.bot)
            .map(m => ({
                discord_id: m.id,
                display_name: m.displayName,
                role_ids: Array.from(m.roles.cache.keys()),
            }));
        
        if (members.length === 0) {
            console.log('[DB-SYNC] ⚠️ Cache boş');
            return;
        }
        
        const result = await apiPost('/full-member-sync', { members }, 30000);
        if (result?.success) {
            const { added, updated, removed } = result.data;
            console.log(`[DB-SYNC] 👥 +${added} eklendi, ${updated} güncellendi, -${removed} silindi`);
        }
        return result;
    } catch (err) {
        console.log('[DB-SYNC] ❌ Üye sync hata:', err.message);
    }
}

async function healthCheck() {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 3000);
    try {
        const response = await fetch(`${API_URL}/health`, {
            headers: { 'X-Bot-Secret': BOT_SECRET },
            signal: ac.signal,
        });
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ MRPD Site DB bağlandı (${result.data.personnel_count} personel)`);
            return true;
        }
    } catch (err) {
        console.log(`⚠️ MRPD Site DB'ye bağlanılamadı: ${err.message}`);
    } finally {
        clearTimeout(tid);
    }
    return false;
}

// =========================================
//  Bot Queue Worker — Site → Bot
// =========================================

async function fetchQueue() {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 5000);
    try {
        const response = await fetch(`${API_URL}/queue?limit=20`, {
            headers: { 'X-Bot-Secret': BOT_SECRET },
            signal: ac.signal,
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (err) {
        return [];
    } finally {
        clearTimeout(tid);
    }
}

async function markQueueDone(id, result = null) {
    try {
        await fetch(`${API_URL}/queue/${id}/done`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': BOT_SECRET },
            body: JSON.stringify({ result }),
            timeout: 3000,
        });
    } catch {}
}

async function markQueueFailed(id, error) {
    try {
        await fetch(`${API_URL}/queue/${id}/failed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': BOT_SECRET },
            body: JSON.stringify({ error }),
            timeout: 3000,
        });
    } catch {}
}

async function ftoSync(threads) {
    return apiPost('/fto-sync', { threads }, 30000);
}

module.exports = {
    fullSync, dutyStart, dutyEnd, memberLeft,
    roleUpdate, fullMemberSync, healthCheck,
    fetchQueue, markQueueDone, markQueueFailed,
    ftoSync,
};