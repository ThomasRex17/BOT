const db = require('../database');

console.log('📋 Form ekleniyor...\n');

const questions = [
    { label: 'Yaş', type: 'text', required: true },
    { label: 'Polis olma sebebin nedir?', type: 'textarea', required: true },
    { label: 'Daha önce departmanlarda görev aldın mı?', type: 'textarea', required: false },
    { label: 'Aktif olabileceğin saatler', type: 'text', required: true },
    { label: 'RP geçmişin', type: 'textarea', required: false },
    { label: 'Discord etiketin', type: 'text', required: true },
];

const result = db.prepare(`
    INSERT INTO application_forms (title, description, questions_json, requires_login, is_active)
    VALUES (?, ?, ?, 0, 1)
`).run(
    'MRPD Memurluk Başvurusu',
    'Mission Row Police Department\'a katılmak için aşağıdaki formu doldurun. Tüm sorulara dürüstçe cevap verin.',
    JSON.stringify(questions)
);

console.log('✅ Form eklendi, ID:', result.lastInsertRowid);
process.exit(0);