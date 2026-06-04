// ============================================
//  Public Navbar Component
// ============================================

function renderPubNav(activePage = '') {
    const isLoggedIn = Auth.isLoggedIn();
    
    return `
        <nav class="pub-nav">
            <a href="/home.html" class="pub-brand">
                <div class="pub-brand-icon">🚔</div>
                <div class="pub-brand-text">
                    <h1 data-brand-name>MRPD</h1>
                    <p>Management System</p>
                </div>
            </a>
            
            <div class="pub-menu">
                <a href="/home.html" class="pub-link ${activePage === 'home' ? 'active' : ''}">Anasayfa</a>
                <a href="/birimler.html" class="pub-link ${activePage === 'units' ? 'active' : ''}">Birimler</a>
                <a href="/kadro.html" class="pub-link ${activePage === 'roster' ? 'active' : ''}">Kadro</a>
                ${isLoggedIn ? `<a href="/index.html" class="pub-link">Dashboard</a>` : ''}
            </div>
            
            <div class="pub-search">
                <input type="text" id="globalSearch" placeholder="Personel ara..." />
            </div>
            
            ${isLoggedIn 
                ? `<button class="pub-cta" onclick="pubLogout()">🚪 Çıkış</button>`
                : `<a href="/login.html" class="pub-cta">🔐 Giriş Yap</a>`
            }
        </nav>
    `;
}

function renderPubFooter() {
    return `
        <footer class="pub-footer">
            ⚡ Powered by Kateshi · MRPD Yönetim Sistemi
        </footer>
    `;
}

// Logout — ui-helpers.js yüklüyse şık modal, yoksa native confirm.
function pubLogout() {
    const go = async () => {
        try { await Auth.logout(); } catch {}
        window.location.href = '/login.html';
    };
    if (typeof showConfirm === 'function') {
        showConfirm('Çıkış yapmak istediğine emin misin?', go);
    } else if (window.confirm('Çıkış yapmak istediğine emin misin?')) {
        go();
    }
}

// ─── Global arama ────────────────────────────────────────────
// Navbar'ı renderPubNav() inline script ile inject ettiği için
// DOMContentLoaded sırasında input henüz DOM'da değil. Event
// delegation ile document seviyesine bağlıyoruz; navbar ne zaman
// inject edilirse edilsin listener çalışır.
let _pubSearchTimer = null;
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'globalSearch') {
        clearTimeout(_pubSearchTimer);
        const term = e.target.value.trim();
        if (term.length < 2) return;
        _pubSearchTimer = setTimeout(() => {
            window.location.href = `/kadro.html?search=${encodeURIComponent(term)}`;
        }, 600);
    }
});
// Enter ile anında ara (debounce'u beklemeden)
document.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'globalSearch' && e.key === 'Enter') {
        clearTimeout(_pubSearchTimer);
        const term = e.target.value.trim();
        if (term.length >= 1) {
            window.location.href = `/kadro.html?search=${encodeURIComponent(term)}`;
        }
    }
});