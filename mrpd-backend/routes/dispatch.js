// ============================================================
// backend/routes/dispatch.js — YENİ DOSYA OLUŞTUR
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Mevcut backend'inde middleware adları farklıysa buraya uyarla:
const { authenticate } = require('../middleware/auth');
// Eğer asyncHandler kullanmıyorsa, sadece async (req,res)=>{} yeter

const DATA_DIR = path.join(__dirname, '../data');
const UNITS_FILE = path.join(DATA_DIR, 'dispatch_units.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Birim tipleri ───
const UNIT_TYPES = {
    L:   { name: 'LINCOLN',     capacity: 1, color: '#3b82f6', desc: 'Tek kişilik devriye' },
    A:   { name: 'ADAM',        capacity: 2, color: '#22c55e', desc: 'İki kişilik devriye' },
    Q:   { name: 'QUEEN',       capacity: 3, color: '#a855f7', desc: 'Üç kişilik saha devriyesi' },
    O:   { name: 'OMEGA',       capacity: 4, color: '#f97316', desc: 'Dört kişilik saha devriyesi' },
    C:   { name: 'CYCLE',       capacity: 1, color: '#06b6d4', desc: 'Bisiklet devriyesi' },
    T:   { name: 'TOM',         capacity: 1, color: '#eab308', desc: 'Trafik devriyesi (tek)' },
    TL:  { name: 'TOM LINCOLN', capacity: 2, color: '#ca8a04', desc: 'Trafik devriyesi (çift)' },
    D:   { name: 'DAVID',       capacity: 4, color: '#ef4444', desc: 'SWAT devriyesi' },
    AIR: { name: 'AIR',         capacity: 2, color: '#0ea5e9', desc: 'Hava birimi' },
    E:   { name: 'EDWARD',      capacity: 2, color: '#ec4899', desc: 'Yüksek hız birimi' },
};

const STATUSES = ['available', 'patrol', 'busy', 'code-6', 'code-4', 'panic'];

function readUnits() {
    if (!fs.existsSync(UNITS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(UNITS_FILE, 'utf8')); }
    catch { return []; }
}
function writeUnits(units) {
    fs.writeFileSync(UNITS_FILE, JSON.stringify(units, null, 2), 'utf8');
}

// ─── GET /api/dispatch/units ───
router.get('/units', authenticate, (req, res) => {
    res.json({ success: true, data: readUnits(), types: UNIT_TYPES });
});

// ─── GET /api/dispatch/types ───
router.get('/types', authenticate, (req, res) => {
    res.json({ success: true, types: UNIT_TYPES });
});

// ─── POST /api/dispatch/units (otomatik numaralandırma) ───
router.post('/units', authenticate, (req, res) => {
    const { type } = req.body;
    const cfg = UNIT_TYPES[type];
    if (!cfg) return res.status(400).json({ success: false, message: 'Geçersiz birim tipi' });
    
    const units = readUnits();
    const sameType = units.filter(u => u.type === type).map(u => u.number);
    let nextNum = 1;
    while (sameType.includes(nextNum)) nextNum++;
    
    const newUnit = {
        id: Date.now(),
        type,
        typeName: cfg.name,
        number: nextNum,
        callsign: `${cfg.name}-${nextNum}`,
        capacity: cfg.capacity,
        color: cfg.color,
        status: 'available',
        members: [],
        createdAt: new Date().toISOString(),
        createdBy: req.user?.username || 'system',
    };
    units.push(newUnit);
    writeUnits(units);
    res.json({ success: true, data: newUnit });
});

// ─── DELETE /api/dispatch/units/:id ───
router.delete('/units/:id', authenticate, (req, res) => {
    const id = parseInt(req.params.id);
    const units = readUnits().filter(u => u.id !== id);
    writeUnits(units);
    res.json({ success: true });
});

// ─── POST /api/dispatch/units/:id/members (üye ekle) ───
router.post('/units/:id/members', authenticate, (req, res) => {
    const id = parseInt(req.params.id);
    const userId = req.body.userId ?? req.body.user_id;
    const { callsign, name } = req.body;

    if (userId === undefined || userId === null || userId === '') {
        return res.status(400).json({ success: false, message: 'userId gerekli' });
    }
    
    const units = readUnits();
    const unit = units.find(u => u.id === id);
    if (!unit) return res.status(404).json({ success: false, message: 'Birim bulunamadı' });
    
    if (unit.members.length >= unit.capacity) {
        return res.status(400).json({ success: false, message: `Bu birim dolu (kapasite: ${unit.capacity})` });
    }
    
    // Kişiyi diğer tüm birimlerden çıkar (bir kişi sadece tek birimde olabilir)
    units.forEach(u => {
        u.members = u.members.filter(m => String(m.userId) !== String(userId));
    });
    
    unit.members.push({
        userId: String(userId),
        callsign: callsign || '',
        name: name || '—',
        addedAt: new Date().toISOString(),
    });
    
    writeUnits(units);
    res.json({ success: true, data: unit });
});

// ─── DELETE /api/dispatch/units/:id/members/:userId (üye çıkar) ───
router.delete('/units/:id/members/:userId', authenticate, (req, res) => {
    const id = parseInt(req.params.id);
    const userId = String(req.params.userId);
    const units = readUnits();
    const unit = units.find(u => u.id === id);
    if (!unit) return res.status(404).json({ success: false, message: 'Birim bulunamadı' });
    unit.members = unit.members.filter(m => String(m.userId) !== userId);
    writeUnits(units);
    res.json({ success: true, data: unit });
});

// ─── PATCH /api/dispatch/units/:id/status ───
router.patch('/units/:id/status', authenticate, (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Geçersiz durum' });
    }
    const units = readUnits();
    const unit = units.find(u => u.id === id);
    if (!unit) return res.status(404).json({ success: false, message: 'Birim bulunamadı' });
    unit.status = status;
    unit.statusUpdatedAt = new Date().toISOString();
    writeUnits(units);
    res.json({ success: true, data: unit });
});

// ─── DELETE /api/dispatch/units (tüm birimleri sıfırla — vardiya sonu) ───
router.delete('/units', authenticate, (req, res) => {
    writeUnits([]);
    res.json({ success: true, message: 'Tüm birimler temizlendi' });
});

module.exports = router;