// ============================================
//  MRPD Backend API Server
//  Ana sunucu dosyası
// ============================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const db = require('./database'); // DB'yi yükle

const app = express();

// ---------- SECURITY ----------
app.use(helmet({
    contentSecurityPolicy: false, // API için kapalı
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — sadece izin verilen origin'lerden istek gelsin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
app.use(cors({
    origin: (origin, callback) => {
        // Postman/curl gibi araçlardan origin gelmez, izin ver
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS engellendi: ${origin}`);
            callback(new Error('CORS politikası engelliyor'));
        }
    },
    credentials: true,
}));

// ---------- RATE LIMITING ----------
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 1000, // 15 dakikada max 1000 istek
    message: { success: false, message: 'Çok fazla istek, biraz sonra tekrar deneyin' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // login için 15 dakikada max 20 deneme
    message: { success: false, message: 'Çok fazla giriş denemesi, 15 dk sonra tekrar deneyin' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ---------- BODY PARSING ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Passport (Discord OAuth için)
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'gecici-secret-degistir',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // production'da true (HTTPS gerekir)
        maxAge: 10 * 60 * 1000, // 10 dakika (sadece OAuth flow için)
    },
}));

const passport = require('./utils/discordStrategy');
app.use(passport.initialize());
app.use(passport.session());

// ---------- LOGGING ----------
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        logger.info(`${color}${res.statusCode}\x1b[0m ${req.method.padEnd(6)} ${req.originalUrl} \x1b[90m${duration}ms\x1b[0m`);
    });
    next();
});

// ---------- ROUTES ----------
app.get('/', (req, res) => {
    res.json({
        name: 'MRPD Backend API',
        version: '1.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health', (req, res) => {
    try {
        const personnelCount = db.prepare('SELECT COUNT(*) as c FROM personnel').get().c;
        res.json({
            success: true,
            status: 'healthy',
            database: 'connected',
            personnel_count: personnelCount,
            uptime: process.uptime(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: err.message,
        });
    }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/ranks', require('./routes/ranks'));
app.use('/api/licenses', require('./routes/licenses'));
app.use('/api/duty', require('./routes/duty'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/fto', require('./routes/fto'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/dispatch', require('./routes/dispatch'));
app.use('/api/system', require('./routes/system'));
app.use('/api/citizens', require('./routes/citizens'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/handbook', require('./routes/handbook'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/bot', require('./routes/bot-sync'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/recent-rank-changes', require('./routes/rank-changes'));

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: `Endpoint bulunamadı: ${req.method} ${req.originalUrl}`,
    });
});

// Error handler (en sonda olmalı)
app.use(errorHandler);

// ---------- BAŞLAT ----------
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  🚔 MRPD Backend API Started');
    console.log('═══════════════════════════════════════════');
    console.log(`  Yerel:    http://localhost:${PORT}`);
    console.log(`  Sunucu:   http://188.191.107.75:${PORT}`);
    console.log(`  Mod:      ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Sunucu kapatılıyor...');
    server.close(() => {
        db.close();
        logger.success('Sunucu temiz şekilde kapatıldı');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});

module.exports = app;