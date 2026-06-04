// ============================================
//  MRPD Frontend Sunucusu
//  Statik dosyaları yayınlar (HTML, JS, CSS)
// ============================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5174;
const HOST = '0.0.0.0';

app.get('/test', (req, res) => {
    res.send('Knk frontend sunucusu hayatta, tepki veriyor!');
});

// public/ klasörünü statik olarak yayınla (JS/CSS önbellekleme yok)
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
}));

// Tüm route'ları index.html'e yönlendir (SPA için)
// Tüm bilinmeyen route'ları index.html'e yönlendir (SPA için)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.listen(PORT, HOST, () => {
    console.log('================================================');
    console.log('  🚔 MRPD Site Sunucusu Başlatıldı');
    console.log('================================================');
    console.log(`  Yerel:    http://localhost:${PORT}`);
    console.log(`  Sunucu:   http://188.191.107.75:${PORT}`);
    console.log('  Backend:  http://188.191.107.75:3001');
    console.log('================================================');
});