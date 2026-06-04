// ============================================
//  FİNAL ÖZELLİKLER: FTO/FTS, Vatandaş, Prim, Handbook, Rapor
// ============================================

const db = require('../database');

console.log('📦 Final özellikler ekleniyor...\n');

// 1. FTO & FTS (Eğitmen-Öğrenci Atamaları)
db.prepare(`
    CREATE TABLE IF NOT EXISTS fto_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fto_id INTEGER NOT NULL,
        fto_name TEXT,
        student_id INTEGER NOT NULL,
        student_name TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fto_id) REFERENCES personnel(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES personnel(id) ON DELETE CASCADE
    )
`).run();
console.log('✅ fto_assignments');

db.prepare(`
    CREATE TABLE IF NOT EXISTS fto_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        evaluator_id INTEGER NOT NULL,
        evaluator_name TEXT,
        rating INTEGER NOT NULL DEFAULT 3,
        strengths TEXT,
        weaknesses TEXT,
        recommendation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assignment_id) REFERENCES fto_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluator_id) REFERENCES personnel(id) ON DELETE SET NULL
    )
`).run();
console.log('✅ fto_evaluations');

// 2. Vatandaş Veritabanı
db.prepare(`
    CREATE TABLE IF NOT EXISTS citizens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        civ_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        date_of_birth DATE,
        gender TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        is_wanted INTEGER DEFAULT 0,
        risk_level TEXT DEFAULT 'low',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_citizens_civ_id ON citizens(civ_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_citizens_name ON citizens(name)`).run();
console.log('✅ citizens');

db.prepare(`
    CREATE TABLE IF NOT EXISTS citizen_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id INTEGER NOT NULL,
        record_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        officer_id INTEGER,
        officer_name TEXT,
        fine_amount INTEGER,
        jail_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
        FOREIGN KEY (officer_id) REFERENCES personnel(id) ON DELETE SET NULL
    )
`).run();
console.log('✅ citizen_records');

// 3. Prim Bordrosu
db.prepare(`
    CREATE TABLE IF NOT EXISTS payroll_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT DEFAULT 'draft',
        total_amount INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();
console.log('✅ payroll_periods');

db.prepare(`
    CREATE TABLE IF NOT EXISTS payroll_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id INTEGER NOT NULL,
        personnel_id INTEGER NOT NULL,
        personnel_name TEXT,
        rank_name TEXT,
        base_amount INTEGER DEFAULT 0,
        duty_hours REAL DEFAULT 0,
        duty_bonus INTEGER DEFAULT 0,
        performance_bonus INTEGER DEFAULT 0,
        seniority_bonus INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
        FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
    )
`).run();
console.log('✅ payroll_items');

// 4. Personel Bilgi Merkezi (Handbook)
db.prepare(`
    CREATE TABLE IF NOT EXISTS handbook_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT DEFAULT '📁',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();
console.log('✅ handbook_categories');

db.prepare(`
    CREATE TABLE IF NOT EXISTS handbook_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER,
        author_name TEXT,
        is_published INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES handbook_categories(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();
console.log('✅ handbook_articles');

// 5. Rapor Şablonları
db.prepare(`
    CREATE TABLE IF NOT EXISTS report_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        template_type TEXT NOT NULL,
        fields TEXT NOT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
`).run();
console.log('✅ report_templates');

db.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        officer_id INTEGER NOT NULL,
        officer_name TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL,
        FOREIGN KEY (officer_id) REFERENCES personnel(id) ON DELETE CASCADE
    )
`).run();
console.log('✅ reports');

// Default veriler
console.log('\n📝 Default veriler yükleniyor...');

// Handbook kategorileri
const cats = [
    { name: 'Kıyafet Dökümanları', icon: '👔', order: 1 },
    { name: 'Telsiz Kodları', icon: '📻', order: 2 },
    { name: 'Prosedürler', icon: '📋', order: 3 },
    { name: 'Eğitim Materyalleri', icon: '📚', order: 4 },
];
cats.forEach(c => {
    db.prepare(`INSERT OR IGNORE INTO handbook_categories (name, icon, sort_order) VALUES (?, ?, ?)`).run(c.name, c.icon, c.order);
});
console.log('✅ Handbook kategorileri');

// Rapor şablonları
const templates = [
    { name: 'Olay Raporu', type: 'incident', fields: JSON.stringify([
        { label: 'Olay Tarihi', type: 'date', required: true },
        { label: 'Olay Yeri', type: 'text', required: true },
        { label: 'Olay Açıklaması', type: 'textarea', required: true },
        { label: 'Şüpheliler', type: 'textarea', required: false },
        { label: 'Tanıklar', type: 'textarea', required: false },
    ]) },
    { name: 'Tutuklama Raporu', type: 'arrest', fields: JSON.stringify([
        { label: 'Tutuklanan Kişi', type: 'text', required: true },
        { label: 'Kimlik No', type: 'text', required: true },
        { label: 'Suçlamalar', type: 'textarea', required: true },
        { label: 'Tutuklama Yeri', type: 'text', required: true },
        { label: 'Tutuklama Saati', type: 'datetime', required: true },
    ]) },
    { name: 'Trafik Cezası', type: 'traffic', fields: JSON.stringify([
        { label: 'Sürücü Adı', type: 'text', required: true },
        { label: 'Plaka', type: 'text', required: true },
        { label: 'İhlal', type: 'textarea', required: true },
        { label: 'Ceza Miktarı', type: 'number', required: true },
    ]) },
];
templates.forEach(t => {
    db.prepare(`INSERT OR IGNORE INTO report_templates (name, template_type, fields) VALUES (?, ?, ?)`).run(t.name, t.type, t.fields);
});
console.log('✅ Rapor şablonları');

console.log('\n🎉 Tüm final özellikler hazır!');
process.exit(0);