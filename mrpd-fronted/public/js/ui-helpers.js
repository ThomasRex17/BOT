// ============================================
//  UI Helpers — Modal, Toast, Confirm
// ============================================

let _modalEl = null;

function showModal({ title, subtitle = '', body = '', size = '', buttons = [] }) {
    closeModal();
    
    const buttonsHtml = buttons.map(b => `
        <button class="btn ${b.class || 'btn-ghost'}" data-mb="${b.id}">${b.label}</button>
    `).join('');
    
    const html = `
        <div class="modal-bd show" id="modal-bd">
            <div class="modal-w ${size}">
                <div class="modal-h">
                    <div>
                        <h2>${title}</h2>
                        ${subtitle ? `<p>${subtitle}</p>` : ''}
                    </div>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-b">${body}</div>
                ${buttons.length ? `<div class="modal-f">${buttonsHtml}</div>` : ''}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    _modalEl = document.getElementById('modal-bd');
    
    buttons.forEach(b => {
        const btn = _modalEl.querySelector(`[data-mb="${b.id}"]`);
        if (btn && b.onClick) btn.addEventListener('click', b.onClick);
    });
    
    _modalEl.addEventListener('click', (e) => {
        if (e.target === _modalEl) closeModal();
    });
}

function closeModal() {
    if (_modalEl) {
        _modalEl.remove();
        _modalEl = null;
    }
}

function showConfirm(message, onConfirm, options = {}) {
    showModal({
        title: options.title || 'Onayla',
        body: `<p style="color: var(--text-dim); line-height: 1.6;">${message}</p>`,
        buttons: [
            { id: 'cancel', label: 'İptal', class: 'btn-ghost', onClick: closeModal },
            { id: 'confirm', label: options.confirmLabel || 'Evet', class: options.confirmClass || 'btn-danger', onClick: () => { closeModal(); onConfirm(); } },
        ],
    });
}

function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Bracket/parantez tag'leri isimden temizle: [Mazeretli] [M] [m] [M.] [610] (Mazeretli) vb.
// Sondaki tagları öncelikli temizler, baştakileri de kapar.
function cleanName(s) {
    if (s == null) return '';
    let t = String(s);
    // Tüm [...] tag'leri (callsign, mazeretli, m, M, vb)
    t = t.replace(/\[[^\]]*\]/g, '');
    // (Mazeretli) (m) gibi parantezli
    t = t.replace(/\([^)]*(?:mazeret|izin|leave|off)[^)]*\)/gi, '');
    // baş/son boşluk + ikili boşluk
    t = t.replace(/\s+/g, ' ').trim();
    // En son: izole "m" "M" "mz" varsa kaldır (örn: "Henry Black m" → "Henry Black")
    t = t.replace(/\s+(m|mz|mazeretli|M)$/i, '').trim();
    return t;
}

function formatDuration(minutes) {
    if (!minutes || minutes < 0) return '0dk';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}dk`;
    if (h >= 24) {
        const d = Math.floor(h / 24);
        return `${d}g ${h % 24}sa`;
    }
    return `${h}sa ${m}dk`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('tr-TR');
}

function relativeTime(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'şimdi';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} dk önce`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} sa önce`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} gün önce`;
    return formatDate(dateStr);
}