-- ============================================
-- MRPD VERİTABANI ŞEMASI
-- Tüm tablolar burada
-- ============================================

-- Kullanıcılar tablosu (Auth için)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    discord_id TEXT UNIQUE,
    discord_username TEXT,
    discord_avatar TEXT,
    role TEXT NOT NULL DEFAULT 'guest', -- 'admin', 'officer', 'guest'
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_discord_id ON users(discord_id);

-- Rütbeler tablosu
CREATE TABLE IF NOT EXISTS ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT,
    discord_role_id TEXT,
    color TEXT DEFAULT '#5865f2',
    rank_order INTEGER NOT NULL DEFAULT 99,
    callsign_min INTEGER,
    callsign_max INTEGER,
    extra_callsigns TEXT, -- JSON array
    excluded_callsigns TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Personeller tablosu
CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- users tablosuna bağlantı (nullable, çünkü herkesin user'ı olmayabilir)
    callsign INTEGER UNIQUE, -- Telsiz kodu (101, 201, vs)
    badge_number TEXT,
    ic_name TEXT NOT NULL, -- IC isim (in-character)
    ooc_name TEXT, -- OOC isim
    rank_id INTEGER,
    status TEXT NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'duty', 'mazeret'
    discord_id TEXT,
    notes TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE SET NULL
);

CREATE INDEX idx_personnel_callsign ON personnel(callsign);
CREATE INDEX idx_personnel_discord_id ON personnel(discord_id);
CREATE INDEX idx_personnel_rank_id ON personnel(rank_id);

-- Lisanslar tablosu
CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT,
    color TEXT DEFAULT '#5865f2',
    icon TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Personel-Lisans bağlantısı (çoğa-çok)
CREATE TABLE IF NOT EXISTS personnel_licenses (
    personnel_id INTEGER NOT NULL,
    license_id INTEGER NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER, -- user_id
    PRIMARY KEY (personnel_id, license_id),
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Mesai oturumları (her giriş-çıkış bir kayıt)
CREATE TABLE IF NOT EXISTS duty_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    duration_minutes INTEGER, -- bitince hesaplanır
    unit_id INTEGER, -- bağlı olduğu birim
    closed_by_user_id INTEGER, -- yetkili tarafından kapatıldıysa
    is_auto_closed INTEGER DEFAULT 0, -- otomatik mi kapandı (sesten düşme vs)
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE,
    FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_duty_personnel_id ON duty_sessions(personnel_id);
CREATE INDEX idx_duty_started_at ON duty_sessions(started_at);
CREATE INDEX idx_duty_active ON duty_sessions(personnel_id, ended_at);

-- Mazeretler
CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    additional_info TEXT,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by_user_id INTEGER,
    reviewed_at DATETIME,
    review_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_leaves_personnel_id ON leaves(personnel_id);
CREATE INDEX idx_leaves_status ON leaves(status);

-- Aktif birimler
CREATE TABLE IF NOT EXISTS active_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'lincoln', 'adam', 'omega', 'queen', vs
    code TEXT NOT NULL, -- 'D-91', 'Q-1', vs
    capacity INTEGER NOT NULL,
    created_by_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Birim üyeleri
CREATE TABLE IF NOT EXISTS unit_members (
    unit_id INTEGER NOT NULL,
    personnel_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (unit_id, personnel_id),
    FOREIGN KEY (unit_id) REFERENCES active_units(id) ON DELETE CASCADE,
    FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
);

-- Başvuru formları
CREATE TABLE IF NOT EXISTS application_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    questions_json TEXT NOT NULL, -- JSON: [{label, type, required}]
    requires_login INTEGER DEFAULT 0,
    auto_assign_rank_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auto_assign_rank_id) REFERENCES ranks(id) ON DELETE SET NULL
);

-- Başvurular
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    applicant_user_id INTEGER, -- nullable (anonim başvuru)
    applicant_name TEXT NOT NULL,
    applicant_email TEXT,
    applicant_discord_id TEXT,
    applicant_civ_id TEXT, -- sicil
    answers_json TEXT NOT NULL, -- JSON: cevaplar
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'review', 'approved', 'rejected'
    reviewed_by_user_id INTEGER,
    reviewed_at DATETIME,
    review_note TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES application_forms(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_form_id ON applications(form_id);

-- Raporlar
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    incident_date DATETIME NOT NULL,
    officer_id INTEGER NOT NULL,
    citizen_name TEXT,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    summary TEXT NOT NULL,
    template_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (officer_id) REFERENCES personnel(id) ON DELETE CASCADE
);

CREATE INDEX idx_reports_officer_id ON reports(officer_id);

-- Vatandaş veritabanı
CREATE TABLE IF NOT EXISTS citizens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    civ_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE,
    is_wanted INTEGER DEFAULT 0,
    record_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Araçlar
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    assigned_unit_id INTEGER, -- birim ID (active_units değil, üst kategori)
    status TEXT DEFAULT 'active', -- 'active', 'maintenance', 'oos'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Duyurular
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Mailler (dahili mesaj sistemi)
CREATE TABLE IF NOT EXISTS mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mails_to_user ON mails(to_user_id);
CREATE INDEX idx_mails_from_user ON mails(from_user_id);

-- Aktivite log
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT, -- 'personnel', 'application', vs
    target_id INTEGER,
    details_json TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

-- Ayarlar (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh token'ları (login için)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token_hash);