const db = require('./database');
const ranks = db.prepare("SELECT id, name, short_name, rank_order, discord_role_id FROM ranks ORDER BY rank_order ASC").all();
console.log(JSON.stringify(ranks, null, 2));
