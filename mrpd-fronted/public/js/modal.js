// ============================================
//  Modal Component
// ============================================

let currentModal = null;

function showModal({ title, subtitle = '', body = '', size = '', buttons = [] }) {
    closeModal();
    
    const buttonsHtml = buttons.map(b => `
        <button class="btn ${b.class || 'btn-ghost'}" id="modal-btn-${b.id}">${b.label}</button>
    `).join('');
    
    const modalHtml = `
        <div class="modal-backdrop show" id="modal-backdrop">
            <div class="modal ${size}">
                <div class="modal-head">
                    <div>
                        <h2>${title}</h2>
                        ${subtitle ? `<p>${subtitle}</p>` : ''}
                    </div>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">${body}</div>
                ${buttons.length ? `<div class="modal-foot">${buttonsHtml}</div>` : ''}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    currentModal = document.getElementById('modal-backdrop');
    
    // Buton handler'ları
    buttons.forEach(b => {
        const btn = document.getElementById(`modal-btn-${b.id}`);
        if (btn && b.onClick) {
            btn.addEventListener('click', b.onClick);
        }
    });
    
    // Backdrop tıklamasına kapat
    currentModal.addEventListener('click', (e) => {
        if (e.target === currentModal) closeModal();
    });
}

function closeModal() {
    if (currentModal) {
        currentModal.remove();
        currentModal = null;
    }
}

// Confirm dialog
function showConfirm(message, onConfirm) {
    showModal({
        title: 'Onayla',
        body: `<p style="color: var(--text-dim); line-height: 1.6;">${message}</p>`,
        buttons: [
            { id: 'cancel', label: 'İptal', class: 'btn-ghost', onClick: closeModal },
            { id: 'confirm', label: 'Evet', class: 'btn-danger', onClick: () => { closeModal(); onConfirm(); } },
        ],
    });
}