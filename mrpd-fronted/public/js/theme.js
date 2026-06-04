// ============================================
//  Tema Sistemi
// ============================================

const THEMES = [
    { id: 'mrpd',  name: 'Mission Row PD', color: '#6366f1' },
    { id: 'lspd',  name: 'LSPD',          color: '#1e40af' },
    { id: 'bcso',  name: 'BCSO',          color: '#ea580c' },
    { id: 'lssd',  name: 'LSSD',          color: '#f59e0b' },
    { id: 'sast',  name: 'SAST',          color: '#16a34a' },
    { id: 'fbi',   name: 'FBI',           color: '#475569' },
];

function getCurrentTheme() {
    return localStorage.getItem('mrpd_theme') || 'mrpd';
}

function setTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('mrpd_theme', themeId);

    // Brand isimleri güncelle (CSS değişkenlerinden)
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) {
        document.querySelectorAll('[data-brand-name]').forEach(el => el.textContent = theme.name);
    }

    // Aktif butonu güncelle
    document.querySelectorAll('.theme-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === themeId);
    });
}

function renderThemeSwitcher() {
    const html = `
        <button class="theme-toggle" id="themeToggle">🎨</button>
        <div class="theme-options" id="themeOptions">
            ${THEMES.map(t => `
                <button class="theme-opt" data-theme="${t.id}" onclick="setTheme('${t.id}')">
                    <span class="theme-color" style="background: ${t.color};"></span>
                    <span>${t.name}</span>
                </button>
            `).join('')}
        </div>
    `;

    const container = document.createElement('div');
    container.className = 'theme-switcher';
    container.innerHTML = html;
    document.body.appendChild(container);

    document.getElementById('themeToggle').addEventListener('click', () => {
        document.getElementById('themeOptions').classList.toggle('show');
    });

    // Dış tıklamada kapat
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-switcher')) {
            document.getElementById('themeOptions')?.classList.remove('show');
        }
    });
}

// Sayfa yüklendiğinde tema uygula
(function init() {
    const theme = getCurrentTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // DOM hazır olunca switcher'ı render et
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderThemeSwitcher);
    } else {
        renderThemeSwitcher();
    }
})();


// ─────────────────────────────────────────────────────────────
// TOPBAR (sıfırdan render eder — #topBarContainer'ı doldurur)
// ─────────────────────────────────────────────────────────────
(function() {
    // ─── CSS ───
    const css = `
    .mrpd-topbar {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 10px 18px !important;
        background: rgba(10, 10, 20, 0.85) !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        min-height: 58px !important;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        position: relative;
        z-index: 100;
    }
    .mrpd-brand {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        color: #fff !important;
        text-decoration: none !important;
        padding: 4px 10px 4px 4px !important;
        border-radius: 10px !important;
        transition: background 0.15s !important;
    }
    .mrpd-brand:hover { background: rgba(255,255,255,0.05) !important; }
    .mrpd-brand-logo {
        width: 38px; height: 38px;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        border-radius: 9px;
        display: grid; place-items: center;
        font-size: 19px;
        box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    }
    .mrpd-brand-text { display: flex; flex-direction: column; line-height: 1.15; gap: 1px; }
    .mrpd-brand-name { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 0.3px; }
    .mrpd-brand-sub { font-size: 10px; color: #888; letter-spacing: 0.2px; }

    .mrpd-nav { display: flex; align-items: center; gap: 6px; }
    .mrpd-nav-link {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 7px 12px !important;
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 8px !important;
        color: #ddd !important;
        text-decoration: none !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        transition: all 0.15s !important;
        white-space: nowrap;
    }
    .mrpd-nav-link:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; transform: translateY(-1px); }

    .mrpd-spacer { flex: 1; }

    .mrpd-duty-pill {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 6px 12px !important;
        border-radius: 999px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        white-space: nowrap;
        background: rgba(255,255,255,0.04);
        color: #888;
        border: 1px solid rgba(255,255,255,0.1);
    }
    .mrpd-duty-pill.on { background: rgba(34,197,94,0.15); color: #86efac; border-color: rgba(34,197,94,0.3); }

    .mrpd-icon-btn {
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        color: #fff !important;
        width: 36px !important;
        height: 36px !important;
        padding: 0 !important;
        border-radius: 9px !important;
        cursor: pointer !important;
        font-size: 15px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.15s !important;
    }
    .mrpd-icon-btn:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-1px); }

    .mrpd-user {
        display: flex !important;
        align-items: center !important;
        gap: 9px !important;
        padding: 4px 12px 4px 4px !important;
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 999px !important;
        white-space: nowrap;
    }
    .mrpd-user-avatar {
        width: 30px !important; height: 30px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
        display: grid !important;
        place-items: center !important;
        color: #fff !important;
        font-weight: 700 !important;
        font-size: 11px !important;
        flex-shrink: 0;
    }
    .mrpd-user-info { display: flex !important; flex-direction: column !important; line-height: 1.15 !important; gap: 1px !important; }
    .mrpd-user-name { font-size: 12px !important; font-weight: 600 !important; color: #fff !important; }
    .mrpd-user-role { font-size: 10px !important; color: #888 !important; text-transform: uppercase; letter-spacing: 0.5px; }

    @media (max-width: 768px) {
        .mrpd-brand-text, .mrpd-user-info { display: none !important; }
        .mrpd-nav-link span:last-child { display: none; }
    }
    `;

    document.getElementById('mrpd-topbar-css')?.remove();
    const styleEl = document.createElement('style');
    styleEl.id = 'mrpd-topbar-css';
    styleEl.textContent = css;
    (document.head || document.documentElement).appendChild(styleEl);

    // ─── HTML ───
    function buildHtml() {
        let user = {};
        try { user = (typeof Auth !== 'undefined' && Auth.user()) || JSON.parse(localStorage.getItem('mrpd_user') || '{}') || {}; }
        catch {}

        const username = user.username || user.name || 'admin';
        const role = user.role || 'admin';
        const avatar = String(username[0] || 'A').toUpperCase();

        return `
            <div class="mrpd-topbar">
                <a href="/index.html" class="mrpd-brand">
                    <div class="mrpd-brand-logo">🚓</div>
                    <div class="mrpd-brand-text">
                        <span class="mrpd-brand-name">MRPD</span>
                        <span class="mrpd-brand-sub">Management System</span>
                    </div>
                </a>

                <div class="mrpd-nav">
                    <a href="/home.html" target="_blank" class="mrpd-nav-link" title="Public site (yeni sekmede)">
                        <span>👁️</span><span>Public Site</span>
                    </a>
                </div>

                <div class="mrpd-spacer"></div>

                <span class="mrpd-duty-pill" id="mrpdDutyPill">⚫ Çevrimdışı</span>

                <button class="mrpd-icon-btn" id="bgTopBtn" title="Arka plan ayarları" onclick="if(window.openBgSettings) window.openBgSettings();">🖼️</button>

                <div class="mrpd-user" title="${role}">
                    <div class="mrpd-user-avatar">${avatar}</div>
                    <div class="mrpd-user-info">
                        <span class="mrpd-user-name">${username}</span>
                        <span class="mrpd-user-role">${role}</span>
                    </div>
                </div>

                <button class="mrpd-icon-btn" onclick="if(typeof Auth!=='undefined' && Auth.logout) Auth.logout().then(()=>location.href='/login.html'); else location.href='/login.html';" title="Çıkış">🚪</button>
            </div>
        `;
    }

    function apply() {
        const c = document.getElementById('topBarContainer');
        if (!c) return;
        c.innerHTML = buildHtml();
    }

    // Sayfa scriptleri çalıştıktan sonra topbar'ı override et
    function init() {
        apply();
        setTimeout(apply, 100);
        setTimeout(apply, 500);
        setTimeout(apply, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.refreshTopBar = apply;
})();


/* ==========================================================================
   MRPD ARKA PLAN SİSTEMİ (v2 — ayarlanabilir)
   --------------------------------------------------------------------------
   - localStorage anahtarı: mrpd_bg_v2
   - Topbar'daki 🖼️ butonu (bgTopBtn) bu modalı açar
   - Buton sadece admin'e görünür
   ========================================================================== */
(function () {
    'use strict';

    var CFG_KEY = 'mrpd_bg_v2';

    // Eski sürüm anahtarlarını temizle (çakışma olmasın)
    ['mrpd_bg_image', 'mrpd_bg_opacity', 'mrpd_bg_blur'].forEach(function (k) {
        localStorage.removeItem(k);
    });

    var DEFAULT_CFG = {
        enabled: false,
        image: '',
        darkness: 55,   // % karartma (0 = görsel net, 100 = tamamen siyah)
        blur: 0,        // px bulanıklık
        scope: 'all'    // 'all' | 'dashboard' | 'public'
    };

    // Public (giriş / başvuru) sayfaları — gerekirse kendine göre düzenle
    var PUBLIC_PAGES = ['login.html', 'apply.html', 'home.html', 'discord-callback.html'];

    function loadCfg() {
        try {
            return Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem(CFG_KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULT_CFG);
        }
    }
    function saveCfg(c) {
        localStorage.setItem(CFG_KEY, JSON.stringify(c));
    }

    function currentPage() {
        return location.pathname.split('/').pop() || 'index.html';
    }
    function isPublicPage() {
        return PUBLIC_PAGES.indexOf(currentPage()) !== -1;
    }

    // Bu sayfada arka plan gösterilmeli mi?
    function shouldShow(cfg) {
        if (!cfg.enabled || !cfg.image) return false;
        if (cfg.scope === 'all') return true;
        if (cfg.scope === 'dashboard') return !isPublicPage();
        if (cfg.scope === 'public') return isPublicPage();
        return false;
    }

    // ---- Arka planı uygula / kaldır ----
    function applyBackground() {
        var cfg = loadCfg();
        var overlay = document.getElementById('mrpd-bg-overlay');

        if (!shouldShow(cfg)) {
            if (overlay) overlay.remove();
            return;
        }

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mrpd-bg-overlay';
            document.body.insertBefore(overlay, document.body.firstChild);
        }

        var dark = Math.min(100, Math.max(0, cfg.darkness)) / 100;
        overlay.style.backgroundImage =
            'linear-gradient(rgba(0,0,0,' + dark + '),rgba(0,0,0,' + dark + ')), url("' +
            cfg.image.replace(/"/g, '%22') + '")';
        overlay.style.filter = cfg.blur > 0 ? 'blur(' + cfg.blur + 'px)' : 'none';
    }

    // ---- Gerekli CSS'i bir kez enjekte et ----
    function injectBaseCSS() {
        if (document.getElementById('mrpd-bg-style')) return;
        var st = document.createElement('style');
        st.id = 'mrpd-bg-style';
        st.textContent =
            // overlay: inset -40px → blur kenar boşluğu olmasın
            '#mrpd-bg-overlay{position:fixed;inset:-40px;z-index:0;pointer-events:none;' +
            'background-size:cover;background-position:center;background-repeat:no-repeat;}' +
            // body'nin diğer çocuklarını arka planın ÜSTÜNE çıkar (modal hariç)
            'body > *:not(#mrpd-bg-overlay):not(#mrpd-bg-modal):not(script):not(style){position:relative;z-index:1;}' +
            // ---- modal ----
            '#mrpd-bg-modal{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;' +
            'display:grid;place-items:center;padding:20px;}' +
            '#mrpd-bg-modal .bgm-card{background:#1e1f22;border:1px solid #2b2d31;border-radius:14px;' +
            'max-width:480px;width:100%;overflow:hidden;font-family:inherit;}' +
            '#mrpd-bg-modal .bgm-head{padding:16px 20px;border-bottom:1px solid #2b2d31;' +
            'display:flex;justify-content:space-between;align-items:center;}' +
            '#mrpd-bg-modal .bgm-head h3{margin:0;color:#fff;font-size:15px;}' +
            '#mrpd-bg-modal .bgm-x{background:none;border:none;color:#888;font-size:22px;cursor:pointer;line-height:1;}' +
            '#mrpd-bg-modal .bgm-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px;}' +
            '#mrpd-bg-modal label{font-size:12px;color:#b5bac1;font-weight:600;display:block;margin-bottom:6px;}' +
            '#mrpd-bg-modal input[type=text],#mrpd-bg-modal select{width:100%;padding:9px 11px;' +
            'background:#111214;border:1px solid #2b2d31;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;}' +
            '#mrpd-bg-modal input[type=range]{width:100%;}' +
            '#mrpd-bg-modal .bgm-row{display:flex;align-items:center;gap:10px;}' +
            '#mrpd-bg-modal .bgm-val{font-size:12px;color:#80848e;min-width:48px;text-align:right;}' +
            '#mrpd-bg-modal .bgm-preview{height:110px;border-radius:10px;background-size:cover;' +
            'background-position:center;border:1px solid #2b2d31;background-color:#111214;}' +
            '#mrpd-bg-modal .bgm-foot{padding:14px 20px;border-top:1px solid #2b2d31;' +
            'display:flex;justify-content:space-between;gap:10px;}' +
            '#mrpd-bg-modal .bgm-btn{padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;' +
            'font-weight:600;border:1px solid #2b2d31;}' +
            '#mrpd-bg-modal .bgm-btn.sec{background:#2b2d31;color:#b5bac1;}' +
            '#mrpd-bg-modal .bgm-btn.pri{background:#5865F2;color:#fff;border-color:#5865F2;}' +
            '#mrpd-bg-modal .bgm-btn.danger{background:transparent;color:#fca5a5;border-color:#7f1d1d;}' +
            '#mrpd-bg-modal .bgm-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:#fff;cursor:pointer;}';
        document.head.appendChild(st);
    }

    // ---- Ayar modalı (global — settings.html'den de çağrılabilir) ----
    window.openBgSettings = function () {
        injectBaseCSS();
        var existing = document.getElementById('mrpd-bg-modal');
        if (existing) existing.remove();

        var cfg = loadCfg();

        var modal = document.createElement('div');
        modal.id = 'mrpd-bg-modal';
        modal.innerHTML =
            '<div class="bgm-card">' +
              '<div class="bgm-head"><h3>🖼️ Arka Plan Ayarları</h3>' +
              '<button class="bgm-x" data-bg-close>×</button></div>' +
              '<div class="bgm-body">' +
                '<label class="bgm-toggle"><input type="checkbox" id="bg_enabled"' +
                (cfg.enabled ? ' checked' : '') + '> Arka planı aktif et</label>' +
                '<div><label>Görsel URL</label>' +
                '<input type="text" id="bg_image" placeholder="https://..." value="' +
                (cfg.image || '').replace(/"/g, '&quot;') + '"></div>' +
                '<div><label>Karartma (yazılar okunsun diye)</label>' +
                '<div class="bgm-row"><input type="range" id="bg_darkness" min="0" max="100" value="' + cfg.darkness + '">' +
                '<span class="bgm-val" id="bg_darkness_val">' + cfg.darkness + '%</span></div></div>' +
                '<div><label>Bulanıklık</label>' +
                '<div class="bgm-row"><input type="range" id="bg_blur" min="0" max="20" value="' + cfg.blur + '">' +
                '<span class="bgm-val" id="bg_blur_val">' + cfg.blur + 'px</span></div></div>' +
                '<div><label>Görünüm yeri</label>' +
                '<select id="bg_scope">' +
                  '<option value="all"' + (cfg.scope === 'all' ? ' selected' : '') + '>Tüm site</option>' +
                  '<option value="dashboard"' + (cfg.scope === 'dashboard' ? ' selected' : '') + '>Sadece dashboard</option>' +
                  '<option value="public"' + (cfg.scope === 'public' ? ' selected' : '') + '>Sadece giriş / public sayfalar</option>' +
                '</select></div>' +
                '<div><label>Önizleme</label><div class="bgm-preview" id="bg_preview"></div></div>' +
              '</div>' +
              '<div class="bgm-foot">' +
                '<button class="bgm-btn danger" data-bg-reset>Sıfırla</button>' +
                '<div style="display:flex;gap:8px;">' +
                  '<button class="bgm-btn sec" data-bg-close>İptal</button>' +
                  '<button class="bgm-btn pri" data-bg-save>Kaydet</button>' +
                '</div>' +
              '</div>' +
            '</div>';
        document.body.appendChild(modal);

        function updatePreview() {
            var img = document.getElementById('bg_image').value.trim();
            var dark = document.getElementById('bg_darkness').value / 100;
            var pv = document.getElementById('bg_preview');
            pv.style.backgroundImage = img
                ? 'linear-gradient(rgba(0,0,0,' + dark + '),rgba(0,0,0,' + dark + ')),url("' +
                  img.replace(/"/g, '%22') + '")'
                : 'none';
            pv.style.filter = 'blur(' + (document.getElementById('bg_blur').value / 3) + 'px)';
        }

        modal.querySelector('#bg_darkness').addEventListener('input', function () {
            document.getElementById('bg_darkness_val').textContent = this.value + '%';
            updatePreview();
        });
        modal.querySelector('#bg_blur').addEventListener('input', function () {
            document.getElementById('bg_blur_val').textContent = this.value + 'px';
            updatePreview();
        });
        modal.querySelector('#bg_image').addEventListener('input', updatePreview);
        updatePreview();

        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.hasAttribute('data-bg-close')) {
                modal.remove();
                return;
            }
            if (e.target.hasAttribute('data-bg-save')) {
                saveCfg({
                    enabled: document.getElementById('bg_enabled').checked,
                    image: document.getElementById('bg_image').value.trim(),
                    darkness: parseInt(document.getElementById('bg_darkness').value, 10),
                    blur: parseInt(document.getElementById('bg_blur').value, 10),
                    scope: document.getElementById('bg_scope').value
                });
                applyBackground();
                modal.remove();
                if (typeof showSuccess === 'function') showSuccess('✅ Arka plan kaydedildi');
            }
            if (e.target.hasAttribute('data-bg-reset')) {
                if (confirm('Arka plan ayarları sıfırlansın mı?')) {
                    saveCfg(Object.assign({}, DEFAULT_CFG));
                    applyBackground();
                    modal.remove();
                }
            }
        });
    };

    // ---- Topbar'daki 🖼️ butonunu sadece admin'e göster ----
    function gateBgButton() {
        var isAdmin = false;
        try { isAdmin = window.Auth && Auth.isAdmin && Auth.isAdmin(); } catch (e) {}
        var btn = document.getElementById('bgTopBtn');
        if (btn) btn.style.display = isAdmin ? '' : 'none';
    }

    // ---- Başlat ----
    function init() {
        injectBaseCSS();
        applyBackground();
        gateBgButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    // topbar birkaç kez yeniden render ediliyor — buton kontrolünü tekrar çalıştır
    setTimeout(gateBgButton, 300);
    setTimeout(gateBgButton, 800);
    setTimeout(gateBgButton, 2000);
})();