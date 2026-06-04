// ============================================
//  PERSONEL DÜZENLE MODAL (5 Tab'lı)
// ============================================

let _currentPersonnel = null;
let _allRanks = [];
let _allLicenses = [];
let _personLicenses = [];

async function openPersonnelEditModal(id) {
    try {
        // Tüm verileri paralel çek
        const [pRes, ranksRes, licensesRes, plRes] = await Promise.all([
            api.get(`/personnel/${id}`),
            api.get('/ranks'),
            api.get('/licenses'),
            api.get(`/personnel/${id}/licenses`).catch(() => ({ data: [] })),
        ]);
        
        _currentPersonnel = pRes.data;
        _allRanks = ranksRes.data;
        _allLicenses = licensesRes.data;
        _personLicenses = plRes.data;
        
        showModal({
            title: `✏️ Personel Düzenle`,
            subtitle: `${cleanName(_currentPersonnel.ic_name) || '—'} · ${_currentPersonnel.id}`,
            size: 'tabbed',
            body: renderPersonnelTabbedContent('general'),
            buttons: [],
        });
        
        attachTabListeners();
    } catch (err) { showError(err.message); }
}

function renderPersonnelTabbedContent(activeTab) {
    return `
        <div class="modal-tabs">
            <div class="modal-tabs-side">
                <button class="modal-tab-btn ${activeTab === 'general' ? 'active' : ''}" data-tab="general">
                    <span class="tab-icon">👤</span><span>Genel Bilgi</span>
                </button>
                <button class="modal-tab-btn ${activeTab === 'license' ? 'active' : ''}" data-tab="license">
                    <span class="tab-icon">🪪</span><span>Lisans Yönetimi</span>
                </button>
                <button class="modal-tab-btn ${activeTab === 'badge' ? 'active' : ''}" data-tab="badge">
                    <span class="tab-icon">🎖️</span><span>Rozet & Madalya</span>
                </button>
                <button class="modal-tab-btn ${activeTab === 'review' ? 'active' : ''}" data-tab="review">
                    <span class="tab-icon">📋</span><span>Değerlendirme</span>
                </button>
                <button class="modal-tab-btn ${activeTab === 'rankhistory' ? 'active' : ''}" data-tab="rankhistory">
                    <span class="tab-icon">📊</span><span>Rütbe Geçmişi</span>
                </button>
            </div>
            <div class="modal-tabs-content" id="modalTabContent">
                ${renderTabContent(activeTab)}
            </div>
        </div>
        <div class="modal-f">
            <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
            <button class="btn btn-ghost" onclick="closeModal()">Geri</button>
        </div>
    `;
}

function attachTabListeners() {
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('modalTabContent').innerHTML = renderTabContent(btn.dataset.tab);
        });
    });
}

function renderTabContent(tab) {
    switch (tab) {
        case 'general': return renderGeneralTab();
        case 'license': return renderLicenseTab();
        case 'badge': return renderBadgeTab();
        case 'review': return renderReviewTab();
        case 'rankhistory': return renderRankHistoryTab();
        default: return '';
    }
}

// ===== TAB 1: GENEL BİLGİ =====
function renderGeneralTab() {
    const p = _currentPersonnel;
    const rankOptions = _allRanks.map(r => 
        `<option value="${r.id}" ${p.rank_id === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
    ).join('');
    
    return `
        <form id="generalForm">
            <div class="form-row-2">
                <div class="form-group">
                    <label>IC İsim *</label>
                    <input name="ic_name" required maxlength="64" value="${escapeHtml(p.ic_name || '')}" />
                </div>
                <div class="form-group">
                    <label>OOC İsim</label>
                    <input name="ooc_name" maxlength="64" value="${escapeHtml(p.ooc_name || '')}" />
                </div>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label>Telsiz Kodu</label>
                    <input name="callsign" type="number" value="${p.callsign || ''}" placeholder="örn: 502" />
                </div>
                <div class="form-group">
                    <label>Rozet Numarası</label>
                    <input name="badge_number" maxlength="16" value="${escapeHtml(p.badge_number || '')}" />
                </div>
            </div>
            <div class="form-row-2">
                <div class="form-group">
                    <label>Rütbe</label>
                    <select name="rank_id">
                        <option value="">— Seç —</option>
                        ${rankOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Durum</label>
                    <select name="status">
                        <option value="offline" ${p.status === 'offline' ? 'selected' : ''}>Çevrimdışı</option>
                        <option value="online" ${p.status === 'online' ? 'selected' : ''}>Aktif</option>
                        <option value="duty" ${p.status === 'duty' ? 'selected' : ''}>Görevde</option>
                        <option value="mazeret" ${p.status === 'mazeret' ? 'selected' : ''}>Mazeretli</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Discord ID</label>
                <input name="discord_id" maxlength="32" value="${p.discord_id || ''}" />
            </div>
            <div class="form-group">
                <label>Notlar</label>
                <textarea name="notes" maxlength="500" style="min-height: 70px;">${escapeHtml(p.notes || '')}</textarea>
            </div>
            <button type="button" class="btn btn-primary" style="width: 100%;" onclick="saveGeneralTab()">💾 Kaydet</button>
        </form>

        <!-- ─── Şifre Yönetimi (admin tool'u) ─────────────────────────── -->
        <div style="margin-top:18px; padding:16px; background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:10px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <div>
                    <div style="font-size:13px; font-weight:700; color:#fff;">🔑 Şifre Yönetimi</div>
                    <div style="font-size:11px; color:var(--text-mute); margin-top:2px;">Rastgele güvenli şifre üret, kopyala, kullanıcıya Discord'dan ilet.</div>
                </div>
                <button type="button" class="btn btn-ghost" style="font-size:12px;" onclick="genRandomPwdForPersonnel()">🎲 Üret</button>
            </div>
            <div id="genPwdRow" style="display:none; margin-top:10px;">
                <div style="display:flex; gap:6px;">
                    <input type="text" id="genPwdValue" readonly style="flex:1; padding:10px 12px; border-radius:8px; background:rgba(0,0,0,0.5); border:1px solid var(--border); color:#fff; font-family:'Courier New', monospace; font-size:14px; letter-spacing:1px;">
                    <button type="button" class="btn btn-ghost" style="padding:0 14px;" onclick="copyGenPwd()">📋 Kopyala</button>
                    <button type="button" class="btn btn-primary" id="assignPwdBtn" style="padding:0 14px; white-space:nowrap;" onclick="assignPwdToPersonnel()">💾 Personele Ata</button>
                </div>
                <div style="font-size:11px; color:#fbbf24; margin-top:8px; line-height:1.5;">
                    ⚠ Şifreyi "Personele Ata" ile sisteme kaydet, sonra Discord'dan kullanıcıya ilet.
                </div>
                <div id="assignPwdResult" style="display:none; margin-top:8px; padding:10px 12px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px; font-size:12px; color:#4ade80;"></div>
            </div>
        </div>
    `;
}

// ─── Şifre üreteci (admin için) ───────────────────────────
function genRandomPwdForPersonnel() {
    const pwd = generateRandomPassword(14);
    const row = document.getElementById('genPwdRow');
    const inp = document.getElementById('genPwdValue');
    if (row && inp) {
        inp.value = pwd;
        row.style.display = 'block';
        inp.focus();
        inp.select();
    }
}
function copyGenPwd() {
    const inp = document.getElementById('genPwdValue');
    if (!inp || !inp.value) return;
    inp.select();
    inp.setSelectionRange(0, 999);
    try {
        navigator.clipboard.writeText(inp.value);
        if (typeof showSuccess === 'function') showSuccess('Şifre panoya kopyalandı ✓');
    } catch {
        document.execCommand && document.execCommand('copy');
        if (typeof showSuccess === 'function') showSuccess('Şifre panoya kopyalandı ✓');
    }
}

async function assignPwdToPersonnel() {
    const inp = document.getElementById('genPwdValue');
    if (!inp || !inp.value) { showError('Önce şifre üretin'); return; }

    const btn = document.getElementById('assignPwdBtn');
    const resultDiv = document.getElementById('assignPwdResult');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Atanıyor...'; }

    try {
        const res = await api.post(`/personnel/${_currentPersonnel.id}/set-password`, { password: inp.value });
        const { username, is_new_account } = res.data || {};
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `✓ ${is_new_account ? 'Hesap oluşturuldu' : 'Şifre güncellendi'} · Kullanıcı adı: <strong>${escapeHtml(username || '')}</strong>`;
        }
        showSuccess(is_new_account ? `Hesap oluşturuldu: ${username}` : `Şifre güncellendi: ${username}`);
        if (btn) { btn.textContent = '✓ Atandı'; }
    } catch (err) {
        showError('Şifre atanamadı: ' + (err.message || 'Bilinmeyen hata'));
        if (btn) { btn.disabled = false; btn.textContent = '💾 Personele Ata'; }
    }
}

async function saveGeneralTab() {
    const fd = new FormData(document.getElementById('generalForm'));
    const data = {
        ic_name: fd.get('ic_name'),
        ooc_name: fd.get('ooc_name') || '',
        callsign: fd.get('callsign') ? parseInt(fd.get('callsign')) : null,
        badge_number: fd.get('badge_number') || '',
        rank_id: fd.get('rank_id') ? parseInt(fd.get('rank_id')) : null,
        status: fd.get('status'),
        discord_id: fd.get('discord_id') || null,
        notes: fd.get('notes') || '',
    };
    if (!data.ic_name || data.ic_name.length < 2) { showError('IC isim gerekli'); return; }
    
    try {
        await api.put(`/personnel/${_currentPersonnel.id}`, data);
        showSuccess('Bilgiler kaydedildi · Discord\'a senkronize ediliyor...');
        _currentPersonnel = { ..._currentPersonnel, ...data };
        if (typeof loadPersonnel === 'function') setTimeout(() => loadPersonnel(currentPage || 1), 500);
    } catch (err) { showError(err.message); }
}

// ===== TAB 2: LİSANS =====
function renderLicenseTab() {
    const myLicenseIds = _personLicenses.map(l => l.license_id);
    
    return `
        <div style="margin-bottom: 16px;">
            <h4 style="font-size: 13px; color: #fff; margin-bottom: 8px;">Aktif Lisanslar (${_personLicenses.length})</h4>
            ${_personLicenses.length === 0 
                ? '<div style="background: rgba(0,0,0,0.4); padding: 16px; border-radius: 10px; text-align: center; color: var(--text-mute); font-size: 13px;">Henüz lisans atanmamış</div>'
                : `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${_personLicenses.map(l => `
                        <div style="background: ${l.color}25; color: ${l.color}; border: 1px solid ${l.color}50; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                            🪪 ${escapeHtml(l.name)}
                            <button onclick="removeLicense(${l.license_id})" style="background: rgba(0,0,0,0.4); border: none; color: ${l.color}; padding: 0 6px; border-radius: 4px; cursor: pointer; font-size: 14px;">×</button>
                        </div>
                    `).join('')}
                </div>`
            }
        </div>
        
        <h4 style="font-size: 13px; color: #fff; margin: 18px 0 8px;">Lisans Ekle</h4>
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px;">
            <select id="licenseSelect" style="padding: 10px 12px; background: rgba(0,0,0,0.5); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px;">
                <option value="">— Lisans Seç —</option>
                ${_allLicenses.filter(l => !myLicenseIds.includes(l.id)).map(l => 
                    `<option value="${l.id}">${escapeHtml(l.name)}</option>`
                ).join('')}
            </select>
            <button class="btn btn-primary" onclick="addLicense()">+ Ekle</button>
        </div>
    `;
}

async function addLicense() {
    const id = parseInt(document.getElementById('licenseSelect').value);
    if (!id) return;
    try {
        await api.post(`/personnel/${_currentPersonnel.id}/licenses`, { license_id: id });
        showSuccess('Lisans eklendi');
        const plRes = await api.get(`/personnel/${_currentPersonnel.id}/licenses`);
        _personLicenses = plRes.data;
        document.getElementById('modalTabContent').innerHTML = renderLicenseTab();
    } catch (err) { showError(err.message); }
}

async function removeLicense(licenseId) {
    if (!confirm('Bu lisansı kaldırmak istediğine emin misin?')) return;
    try {
        await api.delete(`/personnel/${_currentPersonnel.id}/licenses/${licenseId}`);
        showSuccess('Lisans kaldırıldı');
        const plRes = await api.get(`/personnel/${_currentPersonnel.id}/licenses`);
        _personLicenses = plRes.data;
        document.getElementById('modalTabContent').innerHTML = renderLicenseTab();
    } catch (err) { showError(err.message); }
}

// ===== TAB 3: ROZET =====
function renderBadgeTab() {
    return `
        <div style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; display: flex; gap: 12px;">
            <div style="font-size: 20px;">ℹ️</div>
            <div>
                <div style="font-size: 13px; font-weight: 700; color: #c084fc; margin-bottom: 4px;">Rozet & Madalya Yönetimi</div>
                <div style="font-size: 12px; color: var(--text-dim); line-height: 1.5;">Bu personele madalya verin veya rozet atayın. Bildirim Discord'dan personele iletilir.</div>
            </div>
        </div>
        
        <button class="btn btn-primary" style="width: 100%; margin-bottom: 18px;" onclick="showSuccess('Rozet sistemi yakında!')">+ Yeni Rozet/Madalya Ata</button>
        
        <div style="text-align: center; padding: 30px 0; color: var(--text-mute); font-size: 13px;">
            <div style="font-size: 32px; margin-bottom: 8px;">🎖️</div>
            <div>Bu personelde henüz rozet/madalya yok</div>
        </div>
    `;
}

// ===== TAB 4: DEĞERLENDİRME =====
function renderReviewTab() {
    // İçeriği async yükle
    setTimeout(_loadReviewsContent, 0);
    return `
        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; display: flex; gap: 12px;">
            <div style="font-size: 20px;">ℹ️</div>
            <div>
                <div style="font-size: 13px; font-weight: 700; color: #60a5fa; margin-bottom: 4px;">Performans Değerlendirmesi</div>
                <div style="font-size: 12px; color: var(--text-dim); line-height: 1.5;">Bu personelin performansını değerlendirin. 5 kategoride yıldız puanlama + güçlü/zayıf yönler + iyileştirme önerileri.</div>
            </div>
        </div>
        
        <button class="btn btn-primary" style="width: 100%; margin-bottom: 18px;" onclick="openNewReview()">📋 Yeni Değerlendirme Yap</button>
        
        <h4 style="font-size: 13px; color: #fff; margin-bottom: 10px;">Geçmiş Değerlendirmeler</h4>
        <div id="reviewsListContent">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;
}

// Geçmiş değerlendirmeleri yükle
async function _loadReviewsContent() {
    const el = document.getElementById('reviewsListContent');
    if (!el) return;
    try {
        const res = await api.get(`/personnel/${_currentPersonnel.id}/reviews`);
        const _rd = res.data;
        const reviews = Array.isArray(_rd) ? _rd : (Array.isArray(_rd?.data) ? _rd.data : []);
        
        if (!reviews.length) {
            el.innerHTML = `
                <div style="background: rgba(0,0,0,0.4); padding: 30px; border-radius: 10px; text-align: center; color: var(--text-mute); font-size: 13px;">
                    <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.5;">📭</div>
                    Henüz bir değerlendirme yapılmamış.<br>
                    <span style="font-size: 11px;">Yukarıdaki butondan ilk değerlendirmeyi oluşturabilirsiniz.</span>
                </div>
            `;
            return;
        }
        
        // En yeni en üstte
        reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const RESULT_LABELS = {
            excellent: { label: 'Mükemmel', icon: '⭐', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
            good:      { label: 'İyi',      icon: '👍', color: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
            average:   { label: 'Ortalama', icon: '➡️', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
            poor:      { label: 'Zayıf',    icon: '⚠️', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)' },
        };
        
        const fmt = d => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const canDelReview = Auth.isAdmin() || (typeof Perms !== 'undefined' && Perms.canDeleteReview());

        el.innerHTML = reviews.map((r, i) => {
            const meta = RESULT_LABELS[r.result] || RESULT_LABELS.average;
            const avgScore = r.scores
                ? ((r.scores.performance + r.scores.cooperation + r.scores.discipline + r.scores.communication + r.scores.overall) / 5).toFixed(1)
                : null;
            return `
                <div id="modal-review-card-${r.id}" style="background: rgba(0,0,0,0.4); border: 1px solid var(--border); padding: 14px 16px; border-radius: 10px; margin-bottom: 10px; transition: border-color 0.2s; animation: p1-fade-up 0.3s ${(i*40)}ms both;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px; cursor:pointer;" onclick="openReviewDetail(${r.id})">
                            <span style="background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.color}40; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700;">${meta.icon} ${meta.label}</span>
                            ${avgScore ? `<span style="font-size: 11px; color: var(--text-mute);">Ortalama: <strong style="color:#fff;">${avgScore}/5</strong></span>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="font-size: 11px; color: var(--text-mute);">${fmt(r.created_at)}</div>
                            ${canDelReview ? `<button onclick="deleteReviewFromModal(${r.id})" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; border-radius:6px; padding:2px 8px; font-size:11px; cursor:pointer;">🗑</button>` : ''}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text); line-height: 1.5; margin-bottom: 6px; cursor:pointer;" onclick="openReviewDetail(${r.id})">
                        ${esc((r.comment || '').slice(0, 180))}${(r.comment || '').length > 180 ? '…' : ''}
                    </div>
                    ${r.reviewer_name ? `<div style="font-size: 11px; color: var(--text-mute); display: flex; align-items: center; gap: 5px;">
                        <span>Değerlendiren:</span> <strong style="color: var(--text);">${esc(r.reviewer_name)}</strong>
                    </div>` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        el.innerHTML = `
            <div style="background: rgba(0,0,0,0.4); padding: 24px; border-radius: 10px; text-align: center; color: var(--text-mute); font-size: 13px;">
                <div style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;">⚠️</div>
                Değerlendirmeler yüklenemedi.<br>
                <span style="font-size: 11px;">${escapeHtml(err.message || '')}</span>
            </div>
        `;
    }
}

async function deleteReviewFromModal(reviewId) {
    if (!confirm('Bu değerlendirmeyi silmek istediğinizden emin misiniz?')) return;
    try {
        await api.delete(`/personnel/${_currentPersonnel.id}/reviews/${reviewId}`);
        const card = document.getElementById(`modal-review-card-${reviewId}`);
        if (card) card.remove();
    } catch (err) {
        showError('Silinemedi: ' + (err.message || 'Hata'));
    }
}

// Detay modal'ını aç (geçmiş bir değerlendirmeyi göster)
async function openReviewDetail(reviewId) {
    try {
        const res = await api.get(`/personnel/${_currentPersonnel.id}/reviews/${reviewId}`);
        const _rd2 = res.data;
        const r = (Array.isArray(_rd2?.data) ? _rd2.data[0] : (_rd2?.data || _rd2)) || {};
        
        const RESULT_LABELS = {
            excellent: { label: 'Mükemmel', icon: '⭐', color: '#fbbf24' },
            good:      { label: 'İyi',      icon: '👍', color: '#4ade80' },
            average:   { label: 'Ortalama', icon: '➡️', color: '#94a3b8' },
            poor:      { label: 'Zayıf',    icon: '⚠️', color: '#fca5a5' },
        };
        const meta = RESULT_LABELS[r.result] || RESULT_LABELS.average;
        const fmt = d => d ? new Date(d).toLocaleString('tr-TR') : '—';
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
        
        const scoreRow = (label, score) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <span style="color: var(--text-dim); font-size: 13px;">${label}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #fbbf24; font-size: 14px; letter-spacing: 2px; font-family: monospace;">${stars(score || 0)}</span>
                    <span style="color: #fff; font-weight: 700; font-size: 13px; min-width: 30px; text-align: right;">${score || 0}/5</span>
                </div>
            </div>
        `;
        
        showModal({
            title: `${meta.icon} ${meta.label} Değerlendirmesi`,
            subtitle: fmt(r.created_at) + (r.reviewer_name ? ` · ${r.reviewer_name}` : ''),
            size: 'lg',
            body: `
                ${r.scores ? `
                    <div style="background: var(--bg-3); border: 1px solid var(--border); padding: 14px 18px; border-radius: 10px; margin-bottom: 14px;">
                        <div style="font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">PUANLAMA</div>
                        ${scoreRow('Performans', r.scores.performance)}
                        ${scoreRow('İş Birliği', r.scores.cooperation)}
                        ${scoreRow('Disiplin', r.scores.discipline)}
                        ${scoreRow('İletişim', r.scores.communication)}
                        ${scoreRow('Genel Değerlendirme', r.scores.overall)}
                    </div>
                ` : ''}
                
                <div style="background: var(--bg-3); border: 1px solid var(--border); padding: 14px 18px; border-radius: 10px; margin-bottom: 14px;">
                    <div style="font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">AÇIKLAMA</div>
                    <div style="color: #fff; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${esc(r.comment || '—')}</div>
                </div>
                
                ${r.strengths ? `
                    <div style="background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); padding: 14px 18px; border-radius: 10px; margin-bottom: 14px;">
                        <div style="font-size: 11px; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">💪 GÜÇLÜ YÖNLER</div>
                        <div style="color: #fff; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${esc(r.strengths)}</div>
                    </div>
                ` : ''}
                
                ${r.weaknesses ? `
                    <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); padding: 14px 18px; border-radius: 10px; margin-bottom: 14px;">
                        <div style="font-size: 11px; color: #fbbf24; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🎯 GELİŞİME AÇIK YÖNLER</div>
                        <div style="color: #fff; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${esc(r.weaknesses)}</div>
                    </div>
                ` : ''}
                
                ${r.action_items ? `
                    <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); padding: 14px 18px; border-radius: 10px;">
                        <div style="font-size: 11px; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📋 İYİLEŞTİRME ÖNERİLERİ</div>
                        <div style="color: #fff; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${esc(r.action_items)}</div>
                    </div>
                ` : ''}
            `,
            buttons: [
                { id: 'close', label: 'Kapat', class: 'btn-ghost', onClick: closeModal },
            ],
        });
    } catch (err) {
        showError('Değerlendirme detayı yüklenemedi: ' + err.message);
    }
}

// ===== TAB 5: RÜTBE GEÇMİŞİ =====
function renderRankHistoryTab() {
    setTimeout(_loadRankHistoryContent, 0);
    return `
        <div id="rankHistoryContent" style="min-height: 160px;">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;
}

async function _loadRankHistoryContent() {
    const el = document.getElementById('rankHistoryContent');
    if (!el) return;
    try {
        const res = await api.get(`/personnel/${_currentPersonnel.id}/rank-history`);
        const _rh = res.data;
        const history = Array.isArray(_rh) ? _rh : (Array.isArray(_rh?.data) ? _rh.data : []);

        if (!history.length) {
            el.innerHTML = `
                <div style="text-align: center; padding: 40px 0;">
                    <div style="font-size: 32px; margin-bottom: 10px;">📊</div>
                    <div style="color: var(--text-mute); font-size: 13px;">Kayıtlı rütbe geçmişi bulunamadı</div>
                </div>
            `;
            return;
        }

        const actionIcon = a => a === 'promoted' ? '⬆️' : a === 'demoted' ? '⬇️' : a === 'initial' ? '🟢' : '◆';
        const fmtDate = d => d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        el.innerHTML = `
            <div style="position: relative; padding-left: 20px;">
                <div style="position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: var(--border);"></div>
                ${history.map((h, i) => {
                    const isCurrent = i === history.length - 1;
                    const color = h.rank_color || 'var(--text-mute)';
                    return `
                        <div style="position: relative; margin-bottom: 20px; padding-left: 18px;">
                            <div style="position: absolute; left: -21px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: ${color}; ${isCurrent ? `box-shadow: 0 0 0 3px ${color}30;` : ''}"></div>
                            <div style="font-size: 11px; color: var(--text-mute); margin-bottom: 3px;">${fmtDate(h.created_at)}</div>
                            <div style="font-size: 14px; font-weight: 700; color: ${color};">${actionIcon(h.action)} ${esc(h.rank_name)}</div>
                            ${h.changed_by_name ? `<div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">Değiştiren: ${esc(h.changed_by_name)}</div>` : ''}
                            ${h.notes ? `<div style="font-size: 11px; color: var(--text-dim); margin-top: 2px; font-style: italic;">${esc(h.notes)}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch {
        el.innerHTML = `<div style="text-align: center; padding: 30px 0; color: var(--text-mute); font-size: 13px;">Rütbe geçmişi yüklenemedi</div>`;
    }
}

function openNewReview() {
    const personnelId = _currentPersonnel.id;
    
    showModal({
        title: '📋 Yeni Performans Değerlendirmesi',
        subtitle: _currentPersonnel.ic_name || _currentPersonnel.name || '',
        size: 'lg',
        body: `
            <form id="reviewForm">
                <!-- 5 KATEGORİ YILDIZ PUANI -->
                <div style="background: var(--bg-3); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 14px;">
                    <div style="font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; font-weight: 700;">📊 PUANLAMA</div>
                    
                    ${[
                        { key: 'performance',   label: 'Performans',           icon: '🎯' },
                        { key: 'cooperation',   label: 'İş Birliği',           icon: '🤝' },
                        { key: 'discipline',    label: 'Disiplin',             icon: '⚖️' },
                        { key: 'communication', label: 'İletişim',             icon: '💬' },
                        { key: 'overall',       label: 'Genel Değerlendirme',  icon: '⭐' },
                    ].map(cat => `
                        <div class="rating-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${cat.icon}</span>
                                <span style="color: #fff; font-size: 13px; font-weight: 600;">${cat.label}</span>
                            </div>
                            <div class="star-rating" data-key="${cat.key}" data-value="3" style="display: flex; gap: 2px; font-size: 24px; cursor: pointer; user-select: none;">
                                ${[1,2,3,4,5].map(n => `<span class="star" data-n="${n}" style="color: ${n <= 3 ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; transition: color 0.15s, transform 0.15s;">★</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- GENEL SONUÇ -->
                <div class="form-group">
                    <label>Genel Sonuç *</label>
                    <select name="result" required style="width: 100%;">
                        <option value="excellent">⭐ Mükemmel</option>
                        <option value="good" selected>👍 İyi</option>
                        <option value="average">➡️ Ortalama</option>
                        <option value="poor">⚠️ Zayıf</option>
                    </select>
                </div>
                
                <!-- ANA AÇIKLAMA -->
                <div class="form-group">
                    <label>Genel Açıklama *</label>
                    <textarea name="comment" required maxlength="2000" style="min-height: 100px; width: 100%; resize: vertical;" placeholder="Personelin genel performansı hakkında düşünceleriniz..."></textarea>
                </div>
                
                <!-- GÜÇLÜ YÖNLER -->
                <div class="form-group">
                    <label style="color: #4ade80;">💪 Güçlü Yönler <span style="color: var(--text-mute); font-weight: 400; font-size: 11px;">(opsiyonel)</span></label>
                    <textarea name="strengths" maxlength="1000" style="min-height: 70px; width: 100%; resize: vertical;" placeholder="örn: Olağanüstü iletişim becerisi, kriz anında soğukkanlı davranış..."></textarea>
                </div>
                
                <!-- ZAYIF YÖNLER -->
                <div class="form-group">
                    <label style="color: #fbbf24;">🎯 Gelişime Açık Yönler <span style="color: var(--text-mute); font-weight: 400; font-size: 11px;">(opsiyonel)</span></label>
                    <textarea name="weaknesses" maxlength="1000" style="min-height: 70px; width: 100%; resize: vertical;" placeholder="örn: Rapor yazımında detaya daha fazla dikkat etmesi gerekiyor..."></textarea>
                </div>
                
                <!-- AKSİYON ÖĞELERİ -->
                <div class="form-group">
                    <label style="color: #a5b4fc;">📋 İyileştirme Önerileri <span style="color: var(--text-mute); font-weight: 400; font-size: 11px;">(opsiyonel)</span></label>
                    <textarea name="action_items" maxlength="1000" style="min-height: 70px; width: 100%; resize: vertical;" placeholder="örn: Önümüzdeki ay raporlama eğitimine katılması, FTO ile haftalık birebir görüşme..."></textarea>
                </div>
                
                <!-- BİLDİRİM -->
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                        <input type="checkbox" name="notify_user" checked style="width: 16px; height: 16px;" />
                        <span>Değerlendirme sonucunu personele Discord üzerinden bildir</span>
                    </label>
                </div>
            </form>
        `,
        buttons: [
            { id: 'cancel', label: 'Vazgeç', class: 'btn-ghost', onClick: closeModal },
            { id: 'save', label: '💾 Değerlendirmeyi Kaydet', class: 'btn-primary', onClick: () => saveReview(personnelId) },
        ],
    });
    
    // Yıldız rating'lerini bağla
    setTimeout(_setupStarRatings, 80);
}

// Yıldız puanlama etkileşimi
function _setupStarRatings() {
    document.querySelectorAll('.star-rating').forEach(group => {
        const stars = group.querySelectorAll('.star');
        const updateStars = (n) => {
            stars.forEach((s, i) => {
                s.style.color = (i + 1) <= n ? '#fbbf24' : 'rgba(255,255,255,0.15)';
            });
        };
        stars.forEach(star => {
            star.addEventListener('mouseenter', () => {
                const n = parseInt(star.dataset.n);
                updateStars(n);
                star.style.transform = 'scale(1.15)';
            });
            star.addEventListener('mouseleave', () => {
                star.style.transform = '';
                updateStars(parseInt(group.dataset.value));
            });
            star.addEventListener('click', () => {
                const n = parseInt(star.dataset.n);
                group.dataset.value = n;
                updateStars(n);
            });
        });
    });
}

async function saveReview(personnelId) {
    const form = document.getElementById('reviewForm');
    const fd = new FormData(form);
    
    // Yıldız puanlarını topla
    const scores = {};
    document.querySelectorAll('.star-rating').forEach(g => {
        scores[g.dataset.key] = parseInt(g.dataset.value);
    });
    
    const data = {
        result: fd.get('result'),
        comment: (fd.get('comment') || '').trim(),
        strengths: (fd.get('strengths') || '').trim() || null,
        weaknesses: (fd.get('weaknesses') || '').trim() || null,
        action_items: (fd.get('action_items') || '').trim() || null,
        notify_user: fd.get('notify_user') === 'on',
        scores: scores,
    };
    
    // Validasyon
    if (!data.comment) {
        showError('Genel açıklama zorunlu');
        return;
    }
    if (data.comment.length < 10) {
        showError('Açıklama en az 10 karakter olmalı');
        return;
    }
    
    try {
        await api.post(`/personnel/${personnelId}/reviews`, data);
        showSuccess('Değerlendirme kaydedildi' + (data.notify_user ? ' · Personel bilgilendirildi' : ''));
        closeModal();
        // Modal'ı yeniden aç → review tab'ında geçmiş yenilensin
        // (Personnel modal hâlâ açık olabilir)
        if (typeof _renderReviewTabContent === 'function') {
            _renderReviewTabContent();
        } else if (document.getElementById('reviewsListContent')) {
            _loadReviewsContent();
        }
    } catch (err) {
        showError('Değerlendirme kaydedilemedi: ' + (err.message || 'Bilinmeyen hata'));
    }
}