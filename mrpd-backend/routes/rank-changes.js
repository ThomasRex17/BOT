// GET /api/recent-rank-changes?limit=20
const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const rows = db.prepare(`
        SELECT
            rh.id,
            rh.personnel_id,
            p.ic_name        AS personnel_name,
            rh.rank_name     AS new_rank,
            rh.action,
            rh.changed_by_name AS changed_by,
            rh.created_at
        FROM rank_history rh
        JOIN personnel p ON p.id = rh.personnel_id
        WHERE rh.action IN ('promoted', 'demoted', 'rank_assigned')
        ORDER BY rh.created_at DESC
        LIMIT ?
    `).all(limit);

    // old_rank'ı bir önceki kayıttan türet
    const enriched = rows.map(row => {
        const prev = db.prepare(`
            SELECT rank_name FROM rank_history
            WHERE personnel_id = ? AND created_at < ?
            ORDER BY created_at DESC LIMIT 1
        `).get(row.personnel_id, row.created_at);

        return {
            ...row,
            old_rank: prev?.rank_name || null,
        };
    });

    ok(res, { data: enriched });
}));

module.exports = router;
