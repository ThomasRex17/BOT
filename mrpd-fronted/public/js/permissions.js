// ============================================
//  MRPD Yetki (Permission) Sistemi
//  Discord rol isimlerine göre erişim kontrolü
//  api.js'den SONRA, sidebar.js'den ÖNCE yüklenmeli
// ============================================

// ─── İzin sabitleri ───────────────────────────────────────────
const PERM = {
    // Sayfa erişimi
    PAGE_DUTY:      'page.duty',
    PAGE_PERSONNEL: 'page.personnel',
    PAGE_RANKS:     'page.ranks',
    PAGE_LICENSES:  'page.licenses',
    PAGE_BADGES:    'page.badges',
    PAGE_LEAVES:    'page.leaves',
    PAGE_FTO:       'page.fto',
    PAGE_CITIZENS:  'page.citizens',
    PAGE_REPORTS:   'page.reports',
    PAGE_UNITS:     'page.units',
    PAGE_STATS:     'page.stats',
    PAGE_DISPATCH:  'page.dispatch',
    PAGE_APPS:      'page.applications',
    PAGE_FORMS:     'page.forms',
    PAGE_ACTIVITY:  'page.activity',
    PAGE_PAYROLL:   'page.payroll',
    PAGE_HANDBOOK:  'page.handbook',
    PAGE_SETTINGS:  'page.settings',
    PAGE_KADRO:     'page.kadro',

    // FTO modülü
    FTO_CREATE:     'fto.create',
    FTO_WRITE:      'fto.write_report',
    FTO_READ:       'fto.read_reports',
    FTO_COUNT_ONLY: 'fto.count_only',

    // Rapor modülü
    REPORT_WRITE:   'report.write',
    REPORT_READ:    'report.read',
    REPORT_MANAGE:  'report.manage',

    // IAD modülü
    IAD_VIEW:       'iad.view',
    IAD_MANAGE:     'iad.manage',

    // Personel
    PERSONNEL_VIEW: 'personnel.view',
    PERSONNEL_EDIT: 'personnel.edit',
    PERSONNEL_DEL:  'personnel.delete',

    // Değerlendirme modülü
    REVIEW_WRITE:   'review.write',
    REVIEW_DELETE:  'review.delete',
};

// ─── Dahili rol tespiti ───────────────────────────────────────
// r = lowercase Discord rol isimleri dizisi

function _any(r, ...words) {
    return words.some(w => r.some(role => role.includes(w)));
}

// Personel statüsü — dashboard erişim hakkı
function _isStaff(r, t) {
    if (t === 'memur' || t === 'amir' || t === 'yonetim') return true;
    return _any(r,
        'trooper', 'detective', 'sergeant', 'supervisor', 'captain', 'lieutenant', 'command',
        'field training',
        'iad', 'internal affairs',
        'swat', '[ted]', 'ted captain', 'ted co captain', 'ted: ',
        '[ccw]', 'ccw command', '[ccu]', 'ccu command',
        '[db]', '[dbs]', 'detective bureau',
        '[ad]', 'air captain', 'air co captain', 'asd: pilot',
        '[red]', '[td]', 'legal supervisor',
        'mazeretli', 'stp sürecinde', 'acting supervisor', 'emekli'
    );
}

function _isCommand(r) {
    return _any(r, 'captain ii', 'captain i', 'captain', 'lieutenant', 'command', 'chief', 'komiser');
}
function _isSupervisor(r) {
    return _any(r, 'sergeant', 'supervisor', 'detective iii', 'detective ii', 'acting supervisor', 'stp sürecinde');
}
function _isDetective(r) {
    return _any(r, 'detective');
}
function _isTrooper(r) {
    return _any(r, 'trooper');
}
function _isFTOD(r) {
    return _any(r, 'ftod', 'field training officer dire');
}
function _isFTOS(r) {
    return _any(r, 'ftos', 'field training officer sup');
}
function _isFTO(r) {
    return (_any(r, '[fto]') || (_any(r, 'field training officer') && !_isFTOD(r) && !_isFTOS(r)));
}
function _isFTS(r) {
    return _any(r, '[fts]', 'field training student');
}
function _isSenior(r) {
    return _any(r, 'senior trooper', 'senior officer', 'senior detective');
}
function _isLead(r) {
    return _any(r, 'lead trooper', 'lead officer');
}
function _isOfficer(r) {
    // Şeriflikte Trooper, Poliste Officer en alt rütbe
    return _any(r, 'trooper i', 'trooper ii', 'trooper iii', 'officer i', 'officer ii', 'officer iii', 'police officer', 'deputy');
}
function _isIAD(r) {
    return _any(r, 'iad', 'internal affairs');
}
function _isDB(r) {
    return _any(r, '[db]', 'detective bureau');
}
function _isRED(r) {
    return _any(r, '[red]', 'recruitment');
}

// ─── İzin tablosu ────────────────────────────────────────────
// Her izin: (roles: string[], tier: string) => boolean

const _PERM_TABLE = {
    // Sayfa erişimleri — hepsi en az personel statüsü gerektirir
    [PERM.PAGE_DUTY]:      (r, t) => _isStaff(r, t),
    [PERM.PAGE_PERSONNEL]: (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim' || t === 'amir',
    [PERM.PAGE_RANKS]:     (r, t) => _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_LICENSES]:  (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_BADGES]:    (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_LEAVES]:    (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_KADRO]:     (r, t) => true, // herkes kadroyu görebilir
    [PERM.PAGE_FTO]:       (r, t) => _isFTOD(r) || _isFTOS(r) || _isFTO(r) || _isFTS(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_CITIZENS]:  (r, t) => t !== 'aday',
    [PERM.PAGE_REPORTS]:   (r, t) => _isDetective(r) || _isSupervisor(r) || _isCommand(r) || _isFTOD(r) || _isFTOS(r) || _isFTO(r) || t !== 'aday',
    [PERM.PAGE_UNITS]:     (r, t) => _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_STATS]:     (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_DISPATCH]:  (r, t) => _isStaff(r, t),
    [PERM.PAGE_APPS]:      (r, t) => _isRED(r) || _isCommand(r) || _isSupervisor(r) || t === 'yonetim' || t === 'amir',
    [PERM.PAGE_FORMS]:     (r, t) => _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_ACTIVITY]:  (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_PAYROLL]:   (r, t) => _isCommand(r) || t === 'yonetim',
    [PERM.PAGE_HANDBOOK]:  (r, t) => _isStaff(r, t),
    [PERM.PAGE_SETTINGS]:  (r, t) => t === 'yonetim',

    // FTO izinleri
    [PERM.FTO_CREATE]:     (r, t) => _isFTOD(r) || _isFTOS(r) || _isCommand(r) || t === 'yonetim',
    [PERM.FTO_WRITE]:      (r, t) => _isFTOD(r) || _isFTOS(r) || _isFTO(r) || _isCommand(r) || t === 'yonetim',
    [PERM.FTO_READ]:       (r, t) => _isFTOD(r) || _isFTOS(r) || _isFTO(r) || _isCommand(r) || t === 'yonetim',
    [PERM.FTO_COUNT_ONLY]: (r, t) => _isFTS(r),

    // Rapor izinleri
    [PERM.REPORT_WRITE]:   (r, t) => _isDetective(r) || _isSupervisor(r) || _isCommand(r) || t !== 'aday',
    [PERM.REPORT_READ]:    (r, t) => _isDetective(r) || _isSupervisor(r) || _isCommand(r) || t !== 'aday',
    [PERM.REPORT_MANAGE]:  (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',

    // IAD izinleri
    [PERM.IAD_VIEW]:       (r, t) => _isIAD(r) || _isCommand(r) || t === 'yonetim',
    [PERM.IAD_MANAGE]:     (r, t) => _any(r, 'iad director', 'iad supervisor') || _isCommand(r) || t === 'yonetim',

    // Personel izinleri
    [PERM.PERSONNEL_VIEW]: (r, t) => t !== 'aday',
    [PERM.PERSONNEL_EDIT]: (r, t) => _isSupervisor(r) || _isCommand(r) || t === 'yonetim',
    [PERM.PERSONNEL_DEL]:  (r, t) => _isCommand(r) || t === 'yonetim',

    // Değerlendirme izinleri
    // WRITE: Admin, High Command, Supervisor, Senior, Lead, FTO, Trooper/Officer — FTS hariç
    [PERM.REVIEW_WRITE]:  (r, t) => {
        if (t === 'yonetim') return true;
        return _isCommand(r) || _isSupervisor(r) || _isSenior(r) || _isLead(r)
            || _isFTOD(r) || _isFTOS(r) || _isFTO(r)
            || _isTrooper(r) || _isOfficer(r) || _isDetective(r);
    },
    // DELETE: sadece site admin
    [PERM.REVIEW_DELETE]: (r, t) => t === 'yonetim',
};

// ─── Ana API ─────────────────────────────────────────────────
const Perms = {
    _cache: null,

    // Cache temizle (oturum değişikliğinde çağır)
    invalidate() { this._cache = null; },

    // Kullanıcının Discord rollerini döndür (lowercase string[])
    roles() {
        if (this._cache !== null) return this._cache;
        const u = (typeof Auth !== 'undefined') ? Auth.user() : null;
        if (!u) { this._cache = []; return this._cache; }
        
        // Çok sayıda olası format desteği — backend her şekilde dönebilir
        const rawSources = [
            u.discord_roles,
            u.roles,
            u.discordRoles,
            u.discord?.roles,
        ].filter(Boolean);
        
        const allRoles = [];
        for (const raw of rawSources) {
            if (Array.isArray(raw)) {
                raw.forEach(r => {
                    if (typeof r === 'string') allRoles.push(r);
                    else if (r && typeof r === 'object') allRoles.push(r.name || r.role_name || r.label || '');
                });
            } else if (typeof raw === 'string') {
                allRoles.push(...raw.split(',').map(s => s.trim()));
            }
        }
        
        // Ek olarak: rank_name veya rank string'i de bir "rol" gibi davranır
        // Böylece backend rol göndermese bile rütbeden tespit yapılır
        const rankSources = [u.rank_name, u.rankName, u.rank, u.role_name, u.roleName];
        for (const rk of rankSources) {
            if (rk && typeof rk === 'string') allRoles.push(rk);
        }
        
        this._cache = allRoles
            .filter(r => r && typeof r === 'string')
            .map(r => r.toLowerCase().trim())
            .filter(r => r.length > 0);
        
        return this._cache;
    },

    // İzin var mı?
    can(perm) {
        const checker = _PERM_TABLE[perm];
        if (!checker) return false;
        return checker(this.roles(), (typeof Auth !== 'undefined') ? Auth.tier() : 'aday');
    },

    // Herhangi biri var mı?
    canAny(...perms) { return perms.some(p => this.can(p)); },

    // Tümü var mı?
    canAll(...perms) { return perms.every(p => this.can(p)); },

    // UI elementi göster/gizle
    toggle(el, perm) {
        if (!el) return;
        el.style.display = this.can(perm) ? '' : 'none';
    },

    // CSS selector ile göster/gizle
    toggleAll(selector, perm) {
        document.querySelectorAll(selector).forEach(el => this.toggle(el, perm));
    },

    // Sayfayı koru — izin yoksa yönlendir
    require(perm, redirectTo = '/index.html') {
        if (typeof requireAuth === 'function' && !requireAuth()) return false;
        if (!this.can(perm)) {
            if (typeof showError === 'function') showError('Bu sayfaya erişim yetkiniz yok');
            setTimeout(() => window.location.href = redirectTo, 1500);
            return false;
        }
        return true;
    },

    // ─── FTO sayfası için yardımcılar ───────────────────────

    // Kullanıcının FTO rolü: 'ftod' | 'ftos' | 'fto' | 'fts' | 'admin' | null
    ftoRole() {
        const r = this.roles();
        const t = (typeof Auth !== 'undefined') ? Auth.tier() : 'aday';
        if (_isCommand(r) || t === 'yonetim') return 'admin';
        if (_isFTOD(r)) return 'ftod';
        if (_isFTOS(r)) return 'ftos';
        if (_isFTO(r))  return 'fto';
        if (_isFTS(r))  return 'fts';
        return null;
    },

    // Kullanıcının Discord ID'si
    discordId() {
        const u = (typeof Auth !== 'undefined') ? Auth.user() : null;
        return u ? (u.discord_id || u.discordId || u.id || null) : null;
    },

    // ─── IAD sayfası için yardımcılar ───────────────────────

    iadRole() {
        const r = this.roles();
        if (_any(r, 'iad director')) return 'director';
        if (_any(r, 'iad supervisor')) return 'supervisor';
        if (_any(r, 'iad investigator')) return 'investigator';
        if (_isIAD(r)) return 'member';
        return null;
    },

    // ─── Dedektif kontrolü ──────────────────────────────────

    isDetective() {
        const r = this.roles();
        if (_isDetective(r)) return true;
        const t = (typeof Auth !== 'undefined') ? Auth.tier() : 'aday';
        return t === 'amir' || t === 'yonetim';
    },
    isCommand() {
        const r = this.roles();
        if (_isCommand(r)) return true;
        const t = (typeof Auth !== 'undefined') ? Auth.tier() : 'aday';
        return t === 'yonetim';
    },
    isSupervisor() {
        const r = this.roles();
        if (_isSupervisor(r)) return true;
        const t = (typeof Auth !== 'undefined') ? Auth.tier() : 'aday';
        return t === 'amir' || t === 'yonetim';
    },

    // ─── Değerlendirme izin yardımcıları ───────────────────
    canWriteReview()  { return Auth.isAdmin() || this.can(PERM.REVIEW_WRITE); },
    canDeleteReview() { return Auth.isAdmin() || this.can(PERM.REVIEW_DELETE); },

    // ─── Personel statüsü kontrolü ───────────────────────
    // Civilian/Mülakat gibi rollerin dashboard'a erişimini engeller

    isStaff() {
        return _isStaff(this.roles(), (typeof Auth !== 'undefined') ? Auth.tier() : 'aday');
    },

    // Personel olmayan kullanıcıyı apply.html'e yönlendir
    requireStaff(redirectTo = '/apply.html') {
        if (typeof requireAuth === 'function' && !requireAuth()) return false;
        if (!this.isStaff()) {
            if (typeof showError === 'function') {
                showError('Bu panele erişmek için aktif personel statüsü gerekiyor. Başvuru yapmak için yönlendiriliyorsunuz.');
            }
            setTimeout(() => window.location.href = redirectTo, 2000);
            return false;
        }
        return true;
    },
};
