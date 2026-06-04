const fs = require('fs');
const db = require('./database');

console.log('🔄 Botun doğru verileri siteye aktarılıyor...');

try {
    // Sitenin klasörüne kopyaladığın bot verisini okuyoruz
    const botData = JSON.parse(fs.readFileSync('./toplam_mesailer.json', 'utf8'));
    let guncellenen = 0;

    // ÖNEMLİ: Sitedeki eski hatalı mesai geçmişini tamamen siliyoruz
    db.prepare('DELETE FROM duty_sessions').run();
    console.log('🗑️ Sitedeki eski hatalı mesai kayıtları temizlendi.');

    const getPersonel = db.prepare('SELECT id FROM personnel WHERE discord_id = ?');
    
    // Doğru süreyi siteye tek bir oturum (kayıt) olarak ekleme komutu
    const insertSession = db.prepare(`
        INSERT INTO duty_sessions (personnel_id, started_at, ended_at, duration_minutes, notes)
        VALUES (?, datetime('now', '-' || ? || ' minutes'), CURRENT_TIMESTAMP, ?, 'Bot üzerinden doğru veri aktarıldı')
    `);

    // Bottaki herkesin süresini tek tek siteye işliyoruz
    for (const [discordId, data] of Object.entries(botData)) {
        let ms = 0;
        
        // Veri sayı veya obje formatında olabilir, kontrol ediyoruz
        if (typeof data === 'number') {
            ms = data;
        } else if (data && data.ms) {
            ms = data.ms;
        }

        const dakika = Math.floor(ms / 60000);

        if (dakika > 0) {
            // BURASI DÜZELTİLDİ: Değişken adını veritabanından gelen_personel yaptık ki karışmasın
            const gelen_personel = getPersonel.get(discordId);
            
            if (gelen_personel) {
                insertSession.run(gelen_personel.id, dakika, dakika);
                guncellenen++;
            }
        }
    }

    console.log(`✅ Başarılı! ${guncellenen} personelin doğru süresi siteye eklendi.`);
    console.log(`🎉 Artık sitedeki mesai süreleri ile bottaki süreler birebir aynı!`);

} catch (error) {
    console.error('❌ Bir hata oluştu:', error.message);
}