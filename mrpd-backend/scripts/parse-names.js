const db = require('../database');

console.log('🔧 Personel isimlerini parse ediyorum...\n');

const personnel = db.prepare(`
    SELECT id, ic_name, discord_id 
    FROM personnel 
    WHERE ic_name LIKE '[%' OR ic_name LIKE '%|%'
`).all();

let updated = 0;

for (const p of personnel) {
    let callsign = null;
    let icName = p.ic_name;
    let oocName = null;
    
    // Telsiz: [502]
    const callsignMatch = p.ic_name.match(/^\[(\d+)\]\s*(.*)/);
    if (callsignMatch) {
        callsign = parseInt(callsignMatch[1]);
        icName = callsignMatch[2].trim();
    }
    
    // IC | OOC
    if (icName.includes('|')) {
        const parts = icName.split('|').map(s => s.trim());
        icName = parts[0];
        oocName = parts[1];
    }
    
    try {
        db.prepare('UPDATE personnel SET ic_name = ?, ooc_name = ? WHERE id = ?').run(icName, oocName, p.id);
        
        if (callsign) {
            const conflict = db.prepare('SELECT id FROM personnel WHERE callsign = ? AND id != ?').get(callsign, p.id);
            if (!conflict) {
                db.prepare('UPDATE personnel SET callsign = ? WHERE id = ?').run(callsign, p.id);
            }
        }
        
        console.log(`✅ ${p.ic_name} → IC: "${icName}" | OOC: "${oocName || '—'}" | Telsiz: ${callsign || '—'}`);
        updated++;
    } catch (e) {
        console.log(`❌ Hata: ${p.ic_name} - ${e.message}`);
    }
}

console.log(`\n🎉 ${updated} personel güncellendi.`);
process.exit(0);