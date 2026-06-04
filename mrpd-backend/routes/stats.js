const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// ─── MAIN ENDPOINT ───
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
    const period = req.query.period || 'month'; // 'week' | 'month' | 'year'

    const dutyDays     = period === 'week' ? 7 : period === 'year' ? 365 : 30;
    const reportMonths = period === 'year' ? 12 : 6;

    const overview        = computeOverview(period);
    const dutyTrend       = computeDutyTrend(dutyDays);
    const monthlyReports  = computeMonthlyReports(reportMonths);
    const personnelTrend  = computePersonnelTrend(6);
    const unitDist        = computeUnitDistribution();
    const weeklyDuty      = computeWeeklyDuty();

    res.json({
        success: true,
        data: { overview, dutyTrend, monthlyReports, personnelTrend, unitDist, weeklyDuty, period },
    });
}));

// ─── HESAPLAMA FONKSİYONLARI (better-sqlite3 / SQLite uyumlu) ───

function computeOverview(period = 'month') {
    try {
        const totalPersonnel = db.prepare("SELECT COUNT(*) AS c FROM personnel WHERE status != 'inactive'").get().c;

        const now = new Date();
        let thisMonthStart, lastMonthStart;

        if (period === 'week') {
            thisMonthStart = new Date(now);
            thisMonthStart.setDate(now.getDate() - 7);
            lastMonthStart = new Date(thisMonthStart);
            lastMonthStart.setDate(lastMonthStart.getDate() - 7);
        } else if (period === 'year') {
            thisMonthStart = new Date(now.getFullYear(), 0, 1);
            lastMonthStart = new Date(now.getFullYear() - 1, 0, 1);
        } else {
            thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        }

        const thisMonthStr = thisMonthStart.toISOString().slice(0, 10);
        const lastMonthStr = lastMonthStart.toISOString().slice(0, 10);

        const dutyThis = db.prepare(`
            SELECT COALESCE(SUM(duration_minutes), 0) AS total_min
            FROM duty_sessions WHERE started_at >= ? AND ended_at IS NOT NULL
        `).get(thisMonthStr);
        const dutyLast = db.prepare(`
            SELECT COALESCE(SUM(duration_minutes), 0) AS total_min
            FROM duty_sessions WHERE started_at >= ? AND started_at < ? AND ended_at IS NOT NULL
        `).get(lastMonthStr, thisMonthStr);

        const dutyThisHours = +((dutyThis.total_min || 0) / 60).toFixed(1);
        const dutyLastHours = +((dutyLast.total_min || 0) / 60).toFixed(1);
        const dutyChange = dutyLastHours > 0 ? Math.round((dutyThisHours - dutyLastHours) / dutyLastHours * 100) : 0;

        const lastMonthPpl = db.prepare("SELECT COUNT(*) AS c FROM personnel WHERE created_at < ?").get(thisMonthStr).c;
        const pplChange = lastMonthPpl > 0 ? Math.round((totalPersonnel - lastMonthPpl) / lastMonthPpl * 100) : 0;

        const reportsThis = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE created_at >= ?").get(thisMonthStr).c;
        const reportsLast = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE created_at >= ? AND created_at < ?").get(lastMonthStr, thisMonthStr).c;
        const reportChange = reportsLast > 0 ? Math.round((reportsThis - reportsLast) / reportsLast * 100) : 0;

        const totalCitizens = db.prepare("SELECT COUNT(*) AS c FROM citizens").get().c;

        return { totalPersonnel, pplChange, dutyHours: dutyThisHours, dutyChange, reportsCount: reportsThis, reportChange, totalCitizens, citChange: 0 };
    } catch (e) {
        console.warn('[Stats] computeOverview error:', e.message);
        return { totalPersonnel: 0, pplChange: 0, dutyHours: 0, dutyChange: 0, reportsCount: 0, reportChange: 0, totalCitizens: 0, citChange: 0 };
    }
}

function computeDutyTrend(days = 30) {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const rows = db.prepare(`
            SELECT DATE(started_at) AS day, COALESCE(SUM(duration_minutes), 0) / 60.0 AS hours
            FROM duty_sessions
            WHERE started_at >= ? AND ended_at IS NOT NULL
            GROUP BY DATE(started_at)
            ORDER BY day ASC
        `).all(cutoffStr);

        const map = new Map(rows.map(r => [r.day, parseFloat(r.hours) || 0]));
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push({
                date: key,
                label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                value: map.get(key) || 0,
            });
        }
        return result;
    } catch (e) {
        console.warn('[Stats] computeDutyTrend error:', e.message);
        return [];
    }
}

function computeMonthlyReports(months = 6) {
    try {
        const result = [];
        const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const monthStart = d.toISOString().slice(0, 10);
            const d2 = new Date(d);
            d2.setMonth(d2.getMonth() + 1);
            const monthEnd = d2.toISOString().slice(0, 10);
            const cnt = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE created_at >= ? AND created_at < ?").get(monthStart, monthEnd).c;
            result.push({ month: monthStart.slice(0, 7), label: labels[d.getMonth()], value: cnt });
        }
        return result;
    } catch (e) {
        console.warn('[Stats] computeMonthlyReports error:', e.message);
        return [];
    }
}

function computePersonnelTrend(months = 6) {
    try {
        const result = [];
        const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i + 1);
            d.setDate(0);
            const dateStr = d.toISOString().slice(0, 10);
            const cnt = db.prepare("SELECT COUNT(*) AS c FROM personnel WHERE created_at <= ?").get(dateStr).c;
            result.push({ label: labels[d.getMonth()], value: cnt });
        }
        return result;
    } catch (e) {
        console.warn('[Stats] computePersonnelTrend error:', e.message);
        return [];
    }
}

function computeUnitDistribution() {
    try {
        const rows = db.prepare(`
            SELECT r.name AS unit, COUNT(*) AS cnt
            FROM personnel p
            LEFT JOIN ranks r ON p.rank_id = r.id
            WHERE p.status != 'inactive'
            GROUP BY r.name
            ORDER BY cnt DESC
        `).all();
        const total = rows.reduce((s, r) => s + (parseInt(r.cnt) || 0), 0);
        return rows.map(r => ({
            label: r.unit || 'Bilinmiyor',
            value: parseInt(r.cnt) || 0,
            percent: total > 0 ? Math.round((r.cnt / total) * 100) : 0,
        }));
    } catch (e) {
        console.warn('[Stats] computeUnitDistribution error:', e.message);
        return [];
    }
}

function computeWeeklyDuty() {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 28);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const rows = db.prepare(`
            SELECT strftime('%w', started_at) AS dow, COUNT(*) AS cnt
            FROM duty_sessions
            WHERE started_at >= ? AND ended_at IS NOT NULL
            GROUP BY strftime('%w', started_at)
            ORDER BY dow
        `).all(cutoffStr);

        const map = new Map(rows.map(r => [parseInt(r.dow), parseInt(r.cnt) || 0]));
        const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        return days.map((label, i) => ({ label, value: map.get(i) || 0 }));
    } catch (e) {
        console.warn('[Stats] computeWeeklyDuty error:', e.message);
        return [];
    }
}

module.exports = router;
