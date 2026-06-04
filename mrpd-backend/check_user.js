const db = require('./database');
const p = db.prepare("SELECT id, ic_name, ooc_name, discord_id, user_id FROM personnel WHERE ic_name LIKE ? OR ooc_name LIKE ?").all("%Martino%", "%Eymen%");
console.log(JSON.stringify(p, null, 2));
const u = db.prepare("SELECT id, username, role FROM users").all();
console.log("USERS:", JSON.stringify(u, null, 2));
