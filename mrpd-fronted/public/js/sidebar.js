// ============================================
//  SIDEBAR + TOPBAR
// ============================================

const MENU_GROUPS = [
    {
        title: 'GENEL',
        links: [
            { icon: '🏠', label: 'Dashboard',  href: '/index.html',   id: 'dashboard' },
            { icon: '👤', label: 'Hesabım',    href: '/profile.html', id: 'profile' },
            { icon: '🪖', label: 'Kadro',      href: '/kadro.html',   id: 'kadro', perm: PERM.PAGE_KADRO },
        ],
    },
    {
        title: 'PERSONEL DÜZENLEME',
        links: [
            { icon: '⏱️', label: 'Mesai Yönetimi',  href: '/duty.html',      id: 'duty',      perm: PERM.PAGE_DUTY },
            { icon: '👮', label: 'Personel Yönetimi',href: '/personnel.html', id: 'personnel', perm: PERM.PAGE_PERSONNEL },
            { icon: '⭐', label: 'Rütbe Düzenleme',  href: '/ranks.html',     id: 'ranks',     perm: PERM.PAGE_RANKS },
            { icon: '🪪', label: 'Lisans Yönetimi',  href: '/licenses.html',  id: 'licenses',  perm: PERM.PAGE_LICENSES },
            { icon: '🎖️', label: 'Rozet & Madalya',  href: '/badges.html',    id: 'badges',    perm: PERM.PAGE_BADGES },
            { icon: '📅', label: 'Mazeret Yönetimi', href: '/leaves.html',    id: 'leaves',    perm: PERM.PAGE_LEAVES },
        ],
    },
    {
        title: 'OPERASYON',
        links: [
            { icon: '📚', label: 'FTO & FTS',          href: '/fto.html',              id: 'fto',      perm: PERM.PAGE_FTO },
            { icon: '👥', label: 'Vatandaş Veritabanı',href: '/citizens.html',         id: 'citizens', perm: PERM.PAGE_CITIZENS },
            { icon: '📄', label: 'Rapor Şablonları',   href: '/report-templates.html', id: 'reports',  perm: PERM.PAGE_REPORTS },
            { icon: '🏢', label: 'Birim Yönetimi',     href: '/units.html',            id: 'units',    perm: PERM.PAGE_UNITS },
            { icon: '📊', label: 'İstatistikler',       href: '/stats.html',            id: 'stats',    perm: PERM.PAGE_STATS },
            { icon: '📡', label: 'Dispatch',            href: '/dispatch.html',         id: 'dispatch', perm: PERM.PAGE_DISPATCH },
        ],
    },
    {
        title: 'BAŞVURU',
        links: [
            { icon: '✓',  label: 'Başvuru Yönetimi', href: '/applications.html', id: 'applications', perm: PERM.PAGE_APPS },
            { icon: '📋', label: 'Başvuru Formları',  href: '/forms.html',        id: 'forms',        perm: PERM.PAGE_FORMS },
        ],
    },
    {
        title: 'SİSTEM',
        links: [
            { icon: '📜', label: 'Aktivite Logu', href: '/activity.html', id: 'activity', perm: PERM.PAGE_ACTIVITY },
            { icon: '💰', label: 'Prim Bordrosu', href: '/payroll.html',  id: 'payroll',  perm: PERM.PAGE_PAYROLL },
            { icon: '📖', label: 'Bilgi Merkezi', href: '/handbook.html', id: 'handbook', perm: PERM.PAGE_HANDBOOK },
            { icon: '⚙️', label: 'Ayarlar',       href: '/settings.html', id: 'settings', perm: PERM.PAGE_SETTINGS },
        ],
    },
];

function renderSidebar(activeId) {
    let html = '';
    const permsReady = typeof Perms !== 'undefined';

    MENU_GROUPS.forEach(group => {
        const visibleLinks = group.links.filter(link => {
            if (!link.perm) return true;
            // Perms yoksa (permissions.js yüklenmemişse) tier ile yedek kontrol
            if (!permsReady) return typeof Auth !== 'undefined' ? Auth.hasTier('memur') : true;
            return Perms.can(link.perm);
        });

        if (!visibleLinks.length) return;

        html += `
            <div class="sidebar-group">
                <div class="sidebar-group-title">${group.title}</div>
                ${visibleLinks.map(link => `
                    <a href="${link.href}" class="sidebar-link ${activeId === link.id ? 'active' : ''}">
                        <span class="sidebar-link-icon">${link.icon}</span>
                        <span class="sidebar-link-label">${link.label}</span>
                    </a>
                `).join('')}
            </div>
        `;
    });

    return html;
}

function renderTopBar() {
    const user = Auth.user();
    if (!user) return '';

    // Discord sunucu takma adını, sonra global adı, sonra kullanıcı adını dene
    const displayName = user.discord_display_name
        || user.discord_nick
        || user.discord_server_name
        || user.display_name
        || user.discord_global_name
        || user.discord_username
        || user.ic_name
        || user.username
        || '—';

    const rankLabel = user.rank_name || user.rankName || user.role || '—';

    const dutyStatus = localStorage.getItem('duty_status') || 'offline';
    const dutyColors = { duty: 'var(--primary)', online: '#22c55e', offline: '#6b7280' };

    return `
        <div class="dash-topbar">
            <div class="topbar-left">
                <!-- Mobil hamburger — masaüstünde gizli, telefonda görünür -->
                <button class="topbar-hamburger" onclick="toggleMobileSidebar()" aria-label="Menüyü aç">
                    <span></span><span></span><span></span>
                </button>
                
                <div class="topbar-logo">
                    <div class="topbar-logo-icon">🚔</div>
                    <div class="topbar-logo-text">
                        <div class="topbar-logo-title" data-brand-name>MRPD</div>
                        <div class="topbar-logo-sub">Management System</div>
                    </div>
                </div>

                <a href="/home.html" target="_blank" class="dash-link top-bar-public-btn" title="Public siteyi yeni sekmede aç">
                    <span style="font-size: 14px;">👁️</span>
                    <span>Public Site</span>
                </a>

                <a href="/duty.html" class="topbar-duty" title="Mesai sayfasına git" style="text-decoration:none; cursor:pointer;">
                    <div class="duty-indicator" style="background: ${dutyColors[dutyStatus]};"></div>
                    <span class="duty-label">${dutyStatus === 'duty' ? 'Görevde' : dutyStatus === 'online' ? 'Aktif' : 'Çevrimdışı'}</span>
                </a>
            </div>

            <div class="topbar-right">
                <div class="topbar-user">
                    <div class="topbar-user-avatar">${displayName.charAt(0).toUpperCase()}</div>
                    <div class="topbar-user-info">
                        <div class="topbar-user-name">${displayName}</div>
                        <div class="topbar-user-role">${rankLabel}</div>
                    </div>
                </div>
                <button class="topbar-logout" onclick="logout()" aria-label="Çıkış">
                    <span style="font-size: 16px;">🚪</span>
                </button>
            </div>
        </div>
        <!-- Sidebar açıldığında arkayı karartan backdrop -->
        <div class="mobile-sidebar-backdrop" id="mobileSbBackdrop" onclick="toggleMobileSidebar(false)"></div>
    `;
}

// Mobil sidebar drawer aç/kapat
function toggleMobileSidebar(force) {
    const sb = document.querySelector('.dash-sidebar') || document.getElementById('sidebar');
    const bd = document.getElementById('mobileSbBackdrop');
    if (!sb) return;
    const willOpen = force === undefined ? !sb.classList.contains('mobile-open') : force;
    sb.classList.toggle('mobile-open', willOpen);
    if (bd) bd.classList.toggle('show', willOpen);
    document.body.style.overflow = willOpen ? 'hidden' : '';
}

// ESC ile kapansın
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleMobileSidebar(false);
});

// Sidebar linkine tıklayınca otomatik kapansın (mobilde)
document.addEventListener('click', e => {
    if (e.target.closest('.sb-link, .sb-back-btn')) {
        // Sadece mobilde
        if (window.innerWidth <= 900) toggleMobileSidebar(false);
    }
});

function toggleDuty() {
    // Mesai yönetimi duty.html'den yapılır
    window.location.href = '/duty.html';
}

function logout() {
    showConfirm('Çıkış yapmak istediğine emin misin?', () => {
        Auth.logout();
        window.location.href = '/login.html';
    });
}

function setupDashLayout() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }
    // Resize: masaüstüne dönüldüğünde drawer kapanmalı
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            const sb = document.querySelector('.dash-sidebar');
            const bd = document.getElementById('mobileSbBackdrop');
            if (sb) sb.classList.remove('mobile-open');
            if (bd) bd.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
    return true;
}

// Resize listener'ı sayfada sidebar.js yüklendiğinde otomatik kur.
// Her sayfada manuel setupDashLayout() çağrısı yapmaya gerek yok.
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            const sb = document.querySelector('.dash-sidebar');
            const bd = document.getElementById('mobileSbBackdrop');
            if (sb) sb.classList.remove('mobile-open');
            if (bd) bd.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
}