const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

// GET /api/payroll/periods - dönemler
router.get('/periods', authenticate, asyncHandler(async (req, res) => {
    const periods = db.prepare('SELECT * FROM payroll_periods ORDER BY start_date DESC').all();
    ok(res, periods);
}));

// POST /api/payroll/periods - yeni dönem
router.post('/periods', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const { period_name, start_date, end_date } = req.body;
    if (!period_name || !start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Dönem adı ve tarihler gerekli' });
    }
    
    const result = db.prepare(`
        INSERT INTO payroll_periods (period_name, start_date, end_date, created_by)
        VALUES (?, ?, ?, ?)
    `).run(period_name, start_date, end_date, req.user.id);
    
    ok(res, { id: result.lastInsertRowid }, 'Dönem oluşturuldu');
}));

// POST /api/payroll/periods/:id/calculate - hesapla
router.post('/periods/:id/calculate', authenticate, requireAdmin, asyncHandler(async (req, res) => {
    const periodId = parseInt(req.params.id);
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(periodId);
    if (!period) return res.status(404).json({ success: false, message: 'Dönem bulunamadı' });
    
    // Tüm personeli al
    const personnel = db.prepare(`
        SELECT p.id, p.ic_name, r.name as rank_name,
               COALESCE(SUM(CASE WHEN d.started_at >= ? AND d.started_at <= ? THEN (julianday(COALESCE(d.ended_at, CURRENT_TIMESTAMP)) - julianday(d.started_at)) * 24 ELSE 0 END), 0) as duty_hours
        FROM personnel p
        LEFT JOIN ranks r ON p.rank_id = r.id
        LEFT JOIN duty_sessions d ON p.id = d.personnel_id
        WHERE p.status != 'inactive'
        GROUP BY p.id
    `).all(period.start_date, period.end_date);
    
    // Her personel için prim hesapla
    db.prepare('DELETE FROM payroll_items WHERE period_id = ?').run(periodId);
    
    let totalAmount = 0;
    personnel.forEach(p => {
        const base = 5000; // Base maaş
        const dutyBonus = Math.round(p.duty_hours * 100); // Saat başı 100
        const performanceBonus = 0; // Manuel girilecek
        const seniorityBonus = 500; // Kıdem
        const total = base + dutyBonus + performanceBonus + seniorityBonus;
        
        db.prepare(`
            INSERT INTO payroll_items (period_id, personnel_id, personnel_name, rank_name, base_amount, duty_hours, duty_bonus, performance_bonus, seniority_bonus, total_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(periodId, p.id, p.ic_name, p.rank_name, base, p.duty_hours, dutyBonus, performanceBonus, seniorityBonus, total);
        
        totalAmount += total;
    });
    
    db.prepare('UPDATE payroll_periods SET total_amount = ?, status = ? WHERE id = ?').run(totalAmount, 'calculated', periodId);
    
    ok(res, { total: totalAmount, count: personnel.length }, 'Prim hesaplandı');
}));

// GET /api/payroll/periods/:id/items - dönem detayı
router.get('/periods/:id/items', authenticate, asyncHandler(async (req, res) => {
    const items = db.prepare('SELECT * FROM payroll_items WHERE period_id = ? ORDER BY total_amount DESC').all(parseInt(req.params.id));
    ok(res, items);
}));

module.exports = router;