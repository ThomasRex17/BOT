// ============================================
//  API Helper
//  Tüm backend isteklerini yönetir
// ============================================

// ─── BACKEND ADRESİ — sunucu taşınırsa SADECE bu satırı değiştir ───
const API_HOST = 'http://188.191.107.75:3001';
const API_BASE = `${API_HOST}/api`;
// Yerel test için: const API_HOST = 'http://localhost:3001';

// ============================================
//  KADEME (YETKİ) SİSTEMİ
//  4 seviye: yonetim > amir > memur > aday
// ============================================

// Kademe sırası — düşükten yükseğe (index = güç seviyesi)
const TIER_ORDER = ['aday', 'memur', 'amir', 'yonetim'];

// Kademe görünen isimleri
const TIER_NAMES = {
    yonetim: 'Yönetim',
    amir: 'Amir',
    memur: 'Memur',
    aday: 'Aday',
};

// Rütbe ismi → kademe eşleştirmesi (anahtar kelime bazlı, küçük harf)
// Backend ileride tier'ı direkt verecek; bu harita yedek/varsayılan.
// Kendi rütbe isimlerine göre düzenle.
const RANK_TIER_MAP = {
    yonetim: ['captain', 'kaptan', 'lieutenant', 'komiser', 'commander', 'chief', 'şef', 'sef'],
    amir:    ['sergeant', 'sergant', 'çavuş', 'cavus', 'detective', 'dedektif', 'amir', 'supervisor'],
    memur:   ['officer', 'memur', 'corporal', 'onbaşı', 'onbasi', 'deputy'],
    aday:    ['cadet', 'aday', 'trainee', 'stajyer', 'rookie'],
};

// Token yönetimi
const TokenManager = {
    getAccess() {
        return localStorage.getItem('mrpd_access_token');
    },
    getRefresh() {
        return localStorage.getItem('mrpd_refresh_token');
    },
    setTokens(access, refresh) {
        localStorage.setItem('mrpd_access_token', access);
        if (refresh) localStorage.setItem('mrpd_refresh_token', refresh);
    },
    clear() {
        localStorage.removeItem('mrpd_access_token');
        localStorage.removeItem('mrpd_refresh_token');
        localStorage.removeItem('mrpd_user');
    },
    getUser() {
        const u = localStorage.getItem('mrpd_user');
        return u ? JSON.parse(u) : null;
    },
    setUser(user) {
        localStorage.setItem('mrpd_user', JSON.stringify(user));
    },
};

// Ana fetch fonksiyonu
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const timeoutMs = options.timeout ?? 20000;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    const token = TokenManager.getAccess();
    if (token && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 20 saniye sonra fetch'i iptal et → backend hang ederse kullanıcı
    // sonsuza dek spinner görmesin, anlamlı bir hata mesajı alsın.
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), timeoutMs);

    const config = {
        ...options,
        headers,
        signal: options.signal || ac.signal,
    };
    
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));
        
        // Token expired ise refresh dene
        if (response.status === 401 && data.code === 'TOKEN_EXPIRED' && !options.isRetry) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                return apiRequest(endpoint, { ...options, isRetry: true });
            } else {
                // Refresh de başarısız → logout
                TokenManager.clear();
                window.location.href = '/login.html';
                return;
            }
        }
        
        if (!response.ok) {
            const error = new Error(data.message || 'API hatası');
            error.code = data.code;
            error.status = response.status;
            error.details = data.details;
            throw error;
        }
        
        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            const te = new Error('Sunucu yanıt vermedi (zaman aşımı). Tekrar deneyin.');
            te.code = 'TIMEOUT';
            throw te;
        }
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            const networkError = new Error('Sunucuya bağlanılamadı. Backend çalışıyor mu?');
            networkError.code = 'NETWORK_ERROR';
            throw networkError;
        }
        throw err;
    } finally {
        clearTimeout(tid);
    }
}

// ─── Single-flight token refresh ─────────────────────────────
// İki API çağrısı aynı anda 401 alırsa, ikisi de aynı refresh
// promise'ını paylaşır — backend'e iki refresh isteği gitmez,
// ve ikinci refresh ilk refresh'in token'ını invalidate etmez.
let _refreshInFlight = null;
async function tryRefreshToken() {
    if (_refreshInFlight) return _refreshInFlight;
    _refreshInFlight = (async () => {
        const refreshToken = TokenManager.getRefresh();
        if (!refreshToken) return false;
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), 15000);
        try {
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
                signal: ac.signal,
            });
            if (!response.ok) return false;
            const data = await response.json();
            TokenManager.setTokens(data.accessToken);
            return true;
        } catch {
            return false;
        } finally {
            clearTimeout(tid);
        }
    })();
    try { return await _refreshInFlight; }
    finally { _refreshInFlight = null; }
}

// ─── Public endpoint helper (auth gerekmez, timeout dahil) ───
// Kullanım: const json = await fetchPublic('/personnel/public');
async function fetchPublic(path, opts = {}) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), opts.timeout ?? 20000);
    try {
        const r = await fetch(`${API_BASE}${path}`, { ...opts, signal: ac.signal });
        if (!r.ok) {
            const err = new Error(`HTTP ${r.status}`);
            err.status = r.status;
            throw err;
        }
        return await r.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            const e = new Error('Sunucu yanıt vermedi (zaman aşımı).');
            e.code = 'TIMEOUT';
            throw e;
        }
        throw err;
    } finally {
        clearTimeout(tid);
    }
}

// Kısayollar
const api = {
    get: (endpoint, options = {}) => apiRequest(endpoint, { method: 'GET', ...options }),
    post: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'POST', body, ...options }),
    put: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'PUT', body, ...options }),
    delete: (endpoint, options = {}) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};

// Auth fonksiyonları
const Auth = {
    async login(username, password) {
        const data = await api.post('/auth/login', { username, password }, { skipAuth: true });
        TokenManager.setTokens(data.accessToken, data.refreshToken);
        TokenManager.setUser(data.user);
        return data.user;
    },
    
    async register(username, password, email) {
        const data = await api.post('/auth/register', { username, password, email }, { skipAuth: true });
        TokenManager.setTokens(data.accessToken, data.refreshToken);
        TokenManager.setUser(data.user);
        return data.user;
    },
    
    async logout() {
        const refreshToken = TokenManager.getRefresh();
        try {
            await api.post('/auth/logout', { refreshToken });
        } catch {}
        TokenManager.clear();
    },
    
    async me() {
        const data = await api.get('/auth/me');
        TokenManager.setUser(data.user);
        return data.user;
    },
    
    async changePassword(currentPassword, newPassword) {
        return api.post('/auth/change-password', { currentPassword, newPassword });
    },
    
    isLoggedIn() {
        return !!TokenManager.getAccess();
    },
    
    user() {
        return TokenManager.getUser();
    },
    
    // ============================================
    //  KADEME FONKSİYONLARI
    // ============================================
    
    // Kullanıcının kademesini döndürür: 'yonetim' | 'amir' | 'memur' | 'aday'
    tier() {
        const u = this.user();
        if (!u) return null;
        
        // 1) Backend açıkça tier verdiyse onu kullan (en güvenilir)
        if (u.tier && TIER_ORDER.includes(u.tier)) return u.tier;
        
        // 2) Site admin hesabı her zaman Yönetim
        if (u.role === 'admin') return 'yonetim';
        
        // 3) Rütbe isminden çıkar (rank_name / rank alanı varsa)
        const rank = String(u.rank_name || u.rankName || u.rank || '').toLowerCase();
        if (rank) {
            for (const t of TIER_ORDER) {
                const patterns = RANK_TIER_MAP[t] || [];
                if (patterns.some(p => rank.includes(p))) return t;
            }
        }
        
        // 4) Discord rollerinden çıkar — backend rank_name göndermese bile
        //    Discord rolleri içinde rütbe isimleri olabilir
        const allRoles = [];
        const roleSources = [u.discord_roles, u.roles, u.discordRoles, u.discord?.roles].filter(Boolean);
        for (const raw of roleSources) {
            if (Array.isArray(raw)) {
                raw.forEach(r => {
                    if (typeof r === 'string') allRoles.push(r.toLowerCase());
                    else if (r && typeof r === 'object') allRoles.push(String(r.name || r.role_name || '').toLowerCase());
                });
            }
        }
        if (allRoles.length) {
            // Yüksek tier'dan başla — en üst eşleşmeyi al
            for (const t of ['yonetim', 'amir', 'memur', 'aday']) {
                const patterns = RANK_TIER_MAP[t] || [];
                if (patterns.some(p => allRoles.some(role => role.includes(p)))) {
                    return t;
                }
            }
        }
        
        // 5) Eski role alanından yedek tahmin
        if (u.role === 'officer') return 'memur';
        if (u.role === 'supervisor') return 'amir';
        if (u.role === 'command') return 'yonetim';
        
        // 6) Hiçbiri tutmadıysa en düşük kademe
        return 'aday';
    },
    
    // Kullanıcının kademesi en az `minTier` mi?
    hasTier(minTier) {
        const cur = this.tier();
        if (!cur) return false;
        return TIER_ORDER.indexOf(cur) >= TIER_ORDER.indexOf(minTier);
    },
    
    // Kademe görünen ismi ("Yönetim" gibi)
    tierName() {
        const t = this.tier();
        return t ? (TIER_NAMES[t] || t) : '—';
    },
    
    // Admin = site admin hesabı VEYA Yönetim kademesi
    isAdmin() {
        const u = this.user();
        if (u && u.role === 'admin') return true;
        return this.hasTier('yonetim');
    },
    
    // Officer = en az Memur kademesi
    isOfficer() {
        return this.hasTier('memur');
    },
};

// ─── Güvenli rastgele şifre üreteci ─────────────────────────
// Math.random ÇOK kötü — kriptografik olarak güvensiz, tahmin
// edilebilir. crypto.getRandomValues kullanıyoruz. Default 14 karakter:
// harf (büyük + küçük) + rakam + özel karakter. Karışıklığı yaratabilecek
// 0/O, 1/l/I gibi karakterleri çıkardık ki admin yanlış okumasın.
function generateRandomPassword(length = 14) {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // I, O çıkarıldı
    const lower  = 'abcdefghijkmnopqrstuvwxyz'; // l çıkarıldı
    const digits = '23456789';                  // 0, 1 çıkarıldı
    const symbol = '!@#$%&*-+?';
    const all = upper + lower + digits + symbol;

    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);

    let pwd = '';
    // Her sınıftan en az 1 karakter garanti et (zayıf şifre üretmesin)
    pwd += upper[buf[0] % upper.length];
    pwd += lower[buf[1] % lower.length];
    pwd += digits[buf[2] % digits.length];
    pwd += symbol[buf[3] % symbol.length];
    for (let i = 4; i < length; i++) pwd += all[buf[i] % all.length];

    // Sonra karıştır (yine crypto ile, Fisher-Yates)
    const arr = pwd.split('');
    const shufBuf = new Uint32Array(arr.length);
    crypto.getRandomValues(shufBuf);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = shufBuf[i] % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
}

// ─── Toast container (stacked notifications) ───
// Birden fazla showError/Success aynı yere yazmasın diye
// dikey bir stack tutuyoruz.
function _getToastStack() {
    let s = document.getElementById('mrpd-toast-stack');
    if (!s) {
        s = document.createElement('div');
        s.id = 'mrpd-toast-stack';
        s.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none; max-width:380px;';
        document.body.appendChild(s);
    }
    return s;
}

function _showToast(message, bg) {
    const stack = _getToastStack();
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${bg};
        color: white;
        padding: 14px 22px;
        border-radius: 8px;
        font-weight: 500;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        pointer-events: auto;
        animation: slideIn 0.25s;
        transition: opacity 0.3s, transform 0.3s;
    `;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, bg.includes('22c55e') ? 3000 : 4000);
}

// Hata gösterici (toast)
function showError(message) { _showToast(message, '#ef4444'); }
function showSuccess(message) { _showToast(message, '#22c55e'); }

// Sayfa korumalı mı?
function requireAuth(redirectTo = '/login.html') {
    if (!Auth.isLoggedIn()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

function requireAdmin(redirectTo = '/index.html') {
    if (!Auth.isAdmin()) {
        showError('Bu sayfa için admin yetkisi gerekli');
        setTimeout(() => window.location.href = redirectTo, 1500);
        return false;
    }
    return true;
}

// ============================================
//  KADEME BAZLI SAYFA KORUMASI
//  Kullanım: sayfanın en üstünde
//    if (!requireTier('amir')) { /* yönlendirildi */ }
// ============================================
function requireTier(minTier, redirectTo = '/index.html') {
    // Önce giriş yapılmış mı?
    if (!requireAuth()) return false;
    
    if (!Auth.hasTier(minTier)) {
        showError(`Bu sayfa için en az "${TIER_NAMES[minTier] || minTier}" kademesi gerekli`);
        setTimeout(() => window.location.href = redirectTo, 1500);
        return false;
    }
    return true;
}

// Bir elemanı kademeye göre gizle/göster (UI için yardımcı)
// Kullanım: hideIfTierBelow(document.getElementById('silBtn'), 'amir');
function hideIfTierBelow(el, minTier) {
    if (!el) return;
    if (!Auth.hasTier(minTier)) el.style.display = 'none';
}