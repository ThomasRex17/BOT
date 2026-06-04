// ==============================================================================
// 🎛️ LSPD KONTROL PANELİ — Bot/Frontend/Backend Yönetim Sistemi
// PM2 üzerinden çalışan tüm process'leri kontrol eder
// ==============================================================================

const express = require('express');
const pm2 = require('pm2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const { spawn } = require('child_process');
require('dotenv').config();

const PANEL_PORT = parseInt(process.env.PANEL_PORT || '4500');
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_TO_RANDOM_STRING_PLEASE';
const USERS_FILE = path.join(__dirname, 'users.json');
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================================
// KULLANICI YÖNETİMİ
// ==============================================================================
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUsers = {
            admin: {
                password: bcrypt.hashSync('admin123', 10),
                role: 'admin',
                allowedProcesses: '*',
                createdAt: Date.now()
            }
        };
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        console.log('⚠️  İLK KURULUM: Varsayılan admin oluşturuldu');
        console.log('   Kullanıcı: admin  /  Şifre: admin123');
        console.log('   ❗ İLK GİRİŞTEN SONRA HEMEN ŞİFRE DEĞİŞTİR!');
        return defaultUsers;
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function logActivity(username, action, target = null) {
    let activity = [];
    if (fs.existsSync(ACTIVITY_FILE)) {
        try { activity = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8')); } catch(e) {}
    }
    activity.unshift({
        time: Date.now(),
        username,
        action,
        target
    });
    // Son 500 aktiviteyi tut
    if (activity.length > 500) activity = activity.slice(0, 500);
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
}

// ==============================================================================
// AUTH MIDDLEWARE
// ==============================================================================
function auth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Kullanıcı hâlâ var mı?
        const users = loadUsers();
        if (!users[decoded.username]) {
            return res.status(401).json({ error: 'Kullanıcı artık mevcut değil, tekrar giriş yapın' });
        }
        req.user = decoded;
        next();
    } catch(e) {
        return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yap' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sadece admin' });
    next();
}

function processAccessCheck(req, res, next) {
    const processName = req.params.name;
    const users = loadUsers();
    const user = users[req.user.username];
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    if (user.allowedProcesses === '*' || user.role === 'admin') return next();
    if (!Array.isArray(user.allowedProcesses) || !user.allowedProcesses.includes(processName)) {
        return res.status(403).json({ error: `Bu process'e (${processName}) erişim yetkin yok` });
    }
    next();
}

// ==============================================================================
// PM2 BAĞLANTISI
// ==============================================================================
pm2.connect((err) => {
    if (err) {
        console.error('❌ PM2 bağlanamadı:', err.message);
        console.error('   PM2 yüklü mü? `npm i -g pm2` ile yükle.');
        process.exit(1);
    }
    console.log('✅ PM2 bağlandı');
});

// ==============================================================================
// API ENDPOINTS
// ==============================================================================

// --- Login ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    
    const users = loadUsers();
    const user = users[username];
    if (!user) return res.status(401).json({ error: 'Kullanıcı veya şifre yanlış' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Kullanıcı veya şifre yanlış' });
    
    const token = jwt.sign({ username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    logActivity(username, 'GİRİŞ');
    res.json({ 
        token, 
        username, 
        role: user.role,
        allowedProcesses: user.allowedProcesses
    });
});

// --- Process Listesi ---
app.get('/api/processes', auth, (req, res) => {
    pm2.list((err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const users = loadUsers();
        const user = users[req.user.username];
        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı, yeniden giriş yapın' });
        }
        const isAdmin = user.role === 'admin' || user.allowedProcesses === '*';
        
        const processes = list
            .filter(p => isAdmin || (Array.isArray(user.allowedProcesses) && user.allowedProcesses.includes(p.name)))
            .map(p => ({
                name: p.name || 'unknown',
                id: p.pm_id,
                status: p.pm2_env?.status || 'unknown',
                cpu: p.monit?.cpu || 0,
                memory: Math.round((p.monit?.memory || 0) / 1024 / 1024),
                uptime: p.pm2_env?.pm_uptime || 0,
                restarts: p.pm2_env?.restart_time || 0,
                createdAt: p.pm2_env?.created_at,
                pid: p.pid,
                exec_mode: p.pm2_env?.exec_mode,
                node_args: p.pm2_env?.node_args,
                script: p.pm2_env?.pm_exec_path,
                logPath: p.pm2_env?.pm_out_log_path,
                errorLogPath: p.pm2_env?.pm_err_log_path
            }));
        
        res.json(processes);
    });
});

// --- Process Başlat ---
app.post('/api/processes/:name/start', auth, processAccessCheck, (req, res) => {
    pm2.start(req.params.name, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'BAŞLAT', req.params.name);
        res.json({ success: true });
    });
});

// --- Process Durdur ---
app.post('/api/processes/:name/stop', auth, processAccessCheck, (req, res) => {
    pm2.stop(req.params.name, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'DURDUR', req.params.name);
        res.json({ success: true });
    });
});

// --- Process FORCE KILL (zombie process'leri öldürür, port'u serbest bırakır) ---
app.post('/api/processes/:name/kill', auth, processAccessCheck, (req, res) => {
    pm2.list((err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        const proc = list.find(p => p.name === req.params.name);
        if (!proc) return res.status(404).json({ error: 'Process bulunamadı' });
        
        const pid = proc.pid;
        
        // 1. Önce PM2'ye stop sinyali gönder
        pm2.stop(req.params.name, () => {
            // 2. Sonra OS-level olarak PID'yi force kill
            if (pid && pid > 0) {
                const isWindows = process.platform === 'win32';
                const killCmd = isWindows
                    ? spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true })
                    : spawn('kill', ['-9', String(pid)]);
                
                killCmd.on('close', () => {
                    logActivity(req.user.username, 'FORCE KILL', `${req.params.name} (PID:${pid})`);
                    res.json({ success: true, pid });
                });
                killCmd.on('error', () => {
                    // Yine de başarılı say, PM2 stop zaten oldu
                    res.json({ success: true, pid });
                });
            } else {
                logActivity(req.user.username, 'FORCE KILL', req.params.name);
                res.json({ success: true });
            }
        });
    });
});

// --- Process Restart ---
app.post('/api/processes/:name/restart', auth, processAccessCheck, (req, res) => {
    pm2.restart(req.params.name, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'YENİDEN BAŞLAT', req.params.name);
        res.json({ success: true });
    });
});

// --- Process Sil (PM2'den tamamen kaldır) ---
app.delete('/api/processes/:name', auth, adminOnly, (req, res) => {
    pm2.delete(req.params.name, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'PROCESS SİL', req.params.name);
        // Otomatik save
        pm2.dump(() => {});
        res.json({ success: true });
    });
});

// --- Yeni Process Ekle ---
app.post('/api/processes', auth, adminOnly, (req, res) => {
    const { name, script, cwd, args, interpreter } = req.body;
    if (!name || !script) return res.status(400).json({ error: 'name ve script zorunlu' });
    
    const startOpts = {
        name,
        script,
        cwd: cwd || path.dirname(script),
        exec_mode: 'fork',
        autorestart: true
    };
    if (args) startOpts.args = args;
    if (interpreter) startOpts.interpreter = interpreter;
    
    pm2.start(startOpts, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'PROCESS EKLE', name);
        pm2.dump(() => {}); // listeyi otomatik kaydet
        res.json({ success: true });
    });
});

// --- Son N satır log oku ---
app.get('/api/processes/:name/logs', auth, processAccessCheck, (req, res) => {
    pm2.list((err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        const p = list.find(x => x.name === req.params.name);
        if (!p) return res.status(404).json({ error: 'Process bulunamadı' });
        
        const outLog = p.pm2_env.pm_out_log_path;
        const errLog = p.pm2_env.pm_err_log_path;
        
        const readTail = (file, lines = 200) => {
            if (!file || !fs.existsSync(file)) return '';
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const allLines = content.split('\n');
                return allLines.slice(-lines).join('\n');
            } catch(e) { return ''; }
        };
        
        res.json({
            stdout: readTail(outLog, 300),
            stderr: readTail(errLog, 300)
        });
    });
});

// --- Logları Temizle ---
app.post('/api/processes/:name/flush', auth, processAccessCheck, (req, res) => {
    pm2.flush(req.params.name, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(req.user.username, 'LOG TEMİZLE', req.params.name);
        res.json({ success: true });
    });
});

// ==============================================================================
// KULLANICI YÖNETİMİ (Admin)
// ==============================================================================
app.get('/api/users', auth, adminOnly, (req, res) => {
    const users = loadUsers();
    const safeUsers = Object.entries(users).map(([username, data]) => ({
        username,
        role: data.role,
        allowedProcesses: data.allowedProcesses,
        createdAt: data.createdAt
    }));
    res.json(safeUsers);
});

app.post('/api/users', auth, adminOnly, (req, res) => {
    const { username, password, role, allowedProcesses } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    
    const users = loadUsers();
    if (users[username]) return res.status(400).json({ error: 'Bu kullanıcı zaten var' });
    
    users[username] = {
        password: bcrypt.hashSync(password, 10),
        role: role || 'user',
        allowedProcesses: allowedProcesses || [],
        createdAt: Date.now()
    };
    saveUsers(users);
    logActivity(req.user.username, 'KULLANICI EKLE', username);
    res.json({ success: true });
});

app.delete('/api/users/:username', auth, adminOnly, (req, res) => {
    if (req.params.username === 'admin') return res.status(400).json({ error: 'Ana admin silinemez' });
    if (req.params.username === req.user.username) return res.status(400).json({ error: 'Kendini silemezsin' });
    
    const users = loadUsers();
    if (!users[req.params.username]) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    
    delete users[req.params.username];
    saveUsers(users);
    logActivity(req.user.username, 'KULLANICI SİL', req.params.username);
    res.json({ success: true });
});

app.put('/api/users/:username', auth, adminOnly, (req, res) => {
    const { password, role, allowedProcesses } = req.body;
    const users = loadUsers();
    if (!users[req.params.username]) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    
    if (password) {
        if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        users[req.params.username].password = bcrypt.hashSync(password, 10);
    }
    if (role) users[req.params.username].role = role;
    if (allowedProcesses !== undefined) users[req.params.username].allowedProcesses = allowedProcesses;
    
    saveUsers(users);
    logActivity(req.user.username, 'KULLANICI GÜNCELLE', req.params.username);
    res.json({ success: true });
});

// --- Kendi Şifreni Değiştir ---
app.post('/api/me/password', auth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
    
    const users = loadUsers();
    const user = users[req.user.username];
    if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(401).json({ error: 'Eski şifre yanlış' });
    
    user.password = bcrypt.hashSync(newPassword, 10);
    saveUsers(users);
    logActivity(req.user.username, 'ŞİFRE DEĞİŞTİR');
    res.json({ success: true });
});

// --- Aktivite Log ---
app.get('/api/activity', auth, adminOnly, (req, res) => {
    if (!fs.existsSync(ACTIVITY_FILE)) return res.json([]);
    try {
        const activity = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8'));
        res.json(activity.slice(0, 100));
    } catch(e) { res.json([]); }
});

// --- Sistem Bilgisi ---
app.get('/api/system', auth, (req, res) => {
    const os = require('os');
    const cpus = os.cpus();
    res.json({
        platform: os.platform(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        totalMem: Math.round(os.totalmem() / 1024 / 1024),
        freeMem: Math.round(os.freemem() / 1024 / 1024),
        cpuModel: cpus[0]?.model || 'Bilinmiyor',
        cpuCount: cpus.length,
        loadAvg: os.loadavg()
    });
});

// --- Açık Portları Listele (LISTENING durumdaki) ---
app.get('/api/ports', auth, adminOnly, (req, res) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'netstat' : 'ss';
    const args = isWindows ? ['-ano'] : ['-tlnp'];
    
    const proc = spawn(cmd, args, { windowsHide: true });
    let output = '';
    let errOutput = '';
    
    proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { errOutput += chunk.toString(); });
    
    proc.on('close', () => {
        const lines = output.split('\n');
        const ports = [];
        const seen = new Set();
        
        if (isWindows) {
            // Windows netstat formatı:
            // TCP    0.0.0.0:4500           0.0.0.0:0              LISTENING       3532
            for (const line of lines) {
                const m = line.match(/\s+TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
                if (m) {
                    const port = m[1];
                    const pid = m[2];
                    const key = `${port}-${pid}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        ports.push({ port: parseInt(port), pid: parseInt(pid), proto: 'TCP' });
                    }
                }
            }
        } else {
            for (const line of lines) {
                const m = line.match(/LISTEN.*:(\d+).*pid=(\d+)/);
                if (m) {
                    ports.push({ port: parseInt(m[1]), pid: parseInt(m[2]), proto: 'TCP' });
                }
            }
        }
        
        // PID -> Process adı eşle (PM2'den)
        pm2.list((err, pm2list) => {
            const pidMap = {};
            if (!err && pm2list) {
                pm2list.forEach(p => {
                    if (p.pid) pidMap[p.pid] = p.name;
                });
            }
            ports.sort((a, b) => a.port - b.port);
            res.json(ports.map(p => ({ ...p, processName: pidMap[p.pid] || null })));
        });
    });
});

// --- Bir PID'yi force kill et ---
app.post('/api/ports/:pid/kill', auth, adminOnly, (req, res) => {
    const pid = parseInt(req.params.pid);
    if (!pid || pid <= 0) return res.status(400).json({ error: 'Geçersiz PID' });
    
    // Panel'in kendi PID'sini öldürme!
    if (pid === process.pid) return res.status(400).json({ error: 'Panel kendini öldüremez!' });
    
    const isWindows = process.platform === 'win32';
    const killCmd = isWindows
        ? spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true })
        : spawn('kill', ['-9', String(pid)]);
    
    killCmd.on('close', (code) => {
        logActivity(req.user.username, 'PID KILL', `PID:${pid}`);
        res.json({ success: code === 0, code });
    });
    killCmd.on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
});

// ==============================================================================
// WEBSOCKET — Tek server, path'e göre routing
// ==============================================================================
const server = http.createServer(app);

// noServer: true → biz manuel upgrade yapacağız
const wss = new WebSocketServer({ noServer: true });           // /api/logs/stream
const terminalWss = new WebSocketServer({ noServer: true });   // /api/terminal/stream

// Upgrade isteklerini path'e göre dağıt
server.on('upgrade', (req, socket, head) => {
    let pathname;
    try {
        pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    } catch(e) {
        socket.destroy();
        return;
    }
    
    console.log(`[WS] Upgrade isteği: ${pathname} (${req.headers.host})`);
    
    if (pathname === '/api/logs/stream') {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    } else if (pathname === '/api/terminal/stream') {
        terminalWss.handleUpgrade(req, socket, head, (ws) => {
            terminalWss.emit('connection', ws, req);
        });
    } else {
        console.log(`[WS] ❌ Bilinmeyen path: ${pathname}`);
        socket.destroy();
    }
});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const processFilter = url.searchParams.get('process');
    
    let userInfo;
    try {
        userInfo = jwt.verify(token, JWT_SECRET);
    } catch(e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Geçersiz token' }));
        ws.close();
        return;
    }
    
    // Kullanıcının yetkisi var mı?
    const users = loadUsers();
    const user = users[userInfo.username];
    if (!user) { ws.close(); return; }
    
    const isAdmin = user.role === 'admin' || user.allowedProcesses === '*';
    if (processFilter && !isAdmin && (!Array.isArray(user.allowedProcesses) || !user.allowedProcesses.includes(processFilter))) {
        ws.send(JSON.stringify({ type: 'error', message: 'Bu process logu için yetkin yok' }));
        ws.close();
        return;
    }
    
    pm2.launchBus((err, bus) => {
        if (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
            return;
        }
        
        const onOut = (packet) => {
            if (!processFilter || packet.process.name === processFilter) {
                if (!isAdmin && Array.isArray(user.allowedProcesses) && !user.allowedProcesses.includes(packet.process.name)) return;
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'log',
                        process: packet.process.name,
                        stream: 'out',
                        data: packet.data,
                        time: Date.now()
                    }));
                }
            }
        };
        
        const onErr = (packet) => {
            if (!processFilter || packet.process.name === processFilter) {
                if (!isAdmin && Array.isArray(user.allowedProcesses) && !user.allowedProcesses.includes(packet.process.name)) return;
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'log',
                        process: packet.process.name,
                        stream: 'err',
                        data: packet.data,
                        time: Date.now()
                    }));
                }
            }
        };
        
        bus.on('log:out', onOut);
        bus.on('log:err', onErr);
        
        ws.send(JSON.stringify({ type: 'connected', message: 'Canlı log akışı başladı' }));
        
        ws.on('close', () => {
            try {
                bus.off('log:out', onOut);
                bus.off('log:err', onErr);
                bus.close();
            } catch(e) {}
        });
    });
});

// ==============================================================================
// 💻 TERMİNAL WEBSOCKET (Admin Only) — Kalıcı oturum desteği
// ==============================================================================
// Kullanıcı başına kalıcı oturum: cwd, geçmiş, çalışan komut
const terminalSessions = new Map();

// Session'ları diskten yükle (panel restart olunca da kalsın)
const SESSIONS_FILE = path.join(__dirname, 'terminal_sessions.json');
function loadSessions() {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    try {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        Object.entries(data).forEach(([username, sess]) => {
            terminalSessions.set(username, {
                cwd: sess.cwd,
                history: sess.history || [],
                outputBuffer: sess.outputBuffer || [],
                currentChild: null
            });
        });
    } catch(e) { console.log('Session yükleme hatası:', e.message); }
}
function saveSessions() {
    const obj = {};
    terminalSessions.forEach((sess, username) => {
        obj[username] = {
            cwd: sess.cwd,
            history: sess.history.slice(0, 50),
            outputBuffer: sess.outputBuffer.slice(-200) // son 200 satır
        };
    });
    try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2)); } catch(e) {}
}
loadSessions();
// Her 30 saniyede session'ları kaydet
setInterval(saveSessions, 30000);

// terminalWss yukarıda noServer ile tanımlandı

terminalWss.on('connection', (ws, req) => {
    console.log(`[TERM] Bağlantı isteği geldi: ${req.url}`);
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    let userInfo;
    try {
        userInfo = jwt.verify(token, JWT_SECRET);
        console.log(`[TERM] Token OK: ${userInfo.username} (${userInfo.role})`);
    } catch(e) {
        console.log(`[TERM] ❌ Token hatası: ${e.message}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Geçersiz token' }));
        ws.close();
        return;
    }
    
    // SADECE ADMİN erişebilir
    if (userInfo.role !== 'admin') {
        console.log(`[TERM] ❌ Admin değil: ${userInfo.role}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Sadece admin terminali kullanabilir' }));
        ws.close();
        return;
    }
    
    console.log(`[TERM] ✅ Bağlandı: ${userInfo.username}`);
    
    // KALICI OTURUM: Kullanıcı başına state'i koru
    if (!terminalSessions.has(userInfo.username)) {
        terminalSessions.set(userInfo.username, {
            cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
            history: [],
            outputBuffer: [],
            currentChild: null
        });
    }
    const session = terminalSessions.get(userInfo.username);
    
    logActivity(userInfo.username, 'TERMİNAL AÇ');
    
    // İlk bağlantıda: state'i ve geçmiş output'u gönder
    ws.send(JSON.stringify({ 
        type: 'ready', 
        cwd: session.cwd, 
        platform: process.platform,
        history: session.history,
        outputBuffer: session.outputBuffer,
        isRunning: !!(session.currentChild && !session.currentChild.killed)
    }));
    
    // Eğer çalışan bir komut varsa, onun output'unu da bu WS'e bağla
    if (session.currentChild && !session.currentChild.killed) {
        session.activeWs = ws;
    }
    
    // Output'u session buffer'a da yazıp tüm bağlı WS'lere yolla
    const broadcast = (msg) => {
        // Buffer'a output ekle (clear hariç)
        if (msg.type === 'output') {
            session.outputBuffer.push({ stream: msg.stream, data: msg.data });
            if (session.outputBuffer.length > 500) session.outputBuffer.shift();
        }
        if (msg.type === 'clear') {
            session.outputBuffer = [];
        }
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    };
    
    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg.toString()); }
        catch(e) { return; }
        
        if (data.type === 'exec') {
            const cmd = (data.cmd || '').trim();
            if (!cmd) {
                broadcast({ type: 'done', cwd: session.cwd, code: 0 });
                return;
            }
            
            // History'e ekle
            session.history.unshift(cmd);
            if (session.history.length > 50) session.history.pop();
            
            // Önceki child varsa kill
            if (session.currentChild && !session.currentChild.killed) {
                try { session.currentChild.kill(); } catch(e){}
            }
            
            // Komutu output buffer'a ekho et (yeni sekmede de görünsün)
            broadcast({ type: 'output', stream: 'cmd', data: `$ ${cmd}\r\n` });
            
            // 'cd' komutu özel: cwd state'i değiştir
            const cdMatch = cmd.match(/^cd\s+(.+)$/i) || cmd.match(/^cd$/i);
            if (cdMatch) {
                if (!cdMatch[1]) {
                    session.cwd = process.env.HOME || process.env.USERPROFILE || session.cwd;
                } else {
                    const target = cdMatch[1].trim().replace(/^["']|["']$/g, '');
                    let newPath;
                    if (path.isAbsolute(target)) {
                        newPath = target;
                    } else {
                        newPath = path.resolve(session.cwd, target);
                    }
                    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
                        session.cwd = newPath;
                    } else {
                        broadcast({ type: 'output', stream: 'err', data: `Klasör bulunamadı: ${target}\r\n` });
                    }
                }
                broadcast({ type: 'done', cwd: session.cwd, code: 0 });
                saveSessions();
                logActivity(userInfo.username, 'TERMİNAL CMD', cmd);
                return;
            }
            
            // 'clear' veya 'cls' özel
            if (cmd === 'clear' || cmd === 'cls') {
                broadcast({ type: 'clear' });
                broadcast({ type: 'done', cwd: session.cwd, code: 0 });
                return;
            }
            
            logActivity(userInfo.username, 'TERMİNAL CMD', cmd);
            
            // Process spawn
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'powershell.exe' : 'bash';
            const shellArgs = isWindows
                ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', cmd]
                : ['-c', cmd];
            
            try {
                session.currentChild = spawn(shell, shellArgs, {
                    cwd: session.cwd,
                    env: process.env,
                    windowsHide: true
                });
            } catch(e) {
                broadcast({ type: 'output', stream: 'err', data: `Hata: ${e.message}\r\n` });
                broadcast({ type: 'done', cwd: session.cwd, code: 1 });
                return;
            }
            
            session.activeWs = ws;
            
            session.currentChild.stdout.on('data', (chunk) => {
                const out = { type: 'output', stream: 'out', data: chunk.toString() };
                session.outputBuffer.push({ stream: 'out', data: chunk.toString() });
                if (session.outputBuffer.length > 500) session.outputBuffer.shift();
                // Aktif WS'e gönder
                if (session.activeWs && session.activeWs.readyState === 1) {
                    session.activeWs.send(JSON.stringify(out));
                }
            });
            session.currentChild.stderr.on('data', (chunk) => {
                const out = { type: 'output', stream: 'err', data: chunk.toString() };
                session.outputBuffer.push({ stream: 'err', data: chunk.toString() });
                if (session.outputBuffer.length > 500) session.outputBuffer.shift();
                if (session.activeWs && session.activeWs.readyState === 1) {
                    session.activeWs.send(JSON.stringify(out));
                }
            });
            session.currentChild.on('error', (err) => {
                if (session.activeWs && session.activeWs.readyState === 1) {
                    session.activeWs.send(JSON.stringify({ type: 'output', stream: 'err', data: `Hata: ${err.message}\r\n` }));
                }
            });
            session.currentChild.on('close', (code) => {
                if (session.activeWs && session.activeWs.readyState === 1) {
                    session.activeWs.send(JSON.stringify({ type: 'done', cwd: session.cwd, code: code || 0 }));
                }
                session.currentChild = null;
            });
        }
        
        else if (data.type === 'cancel') {
            if (session.currentChild && !session.currentChild.killed) {
                try { session.currentChild.kill('SIGTERM'); } catch(e){}
                broadcast({ type: 'output', stream: 'err', data: '\r\n^C iptal edildi\r\n' });
                broadcast({ type: 'done', cwd: session.cwd, code: 130 });
            }
        }
        
        else if (data.type === 'clear-session') {
            // Kullanıcı kasten buffer'ı temizledi
            session.outputBuffer = [];
            session.history = [];
            saveSessions();
            broadcast({ type: 'clear' });
            broadcast({ type: 'done', cwd: session.cwd, code: 0 });
        }
    });
    
    ws.on('close', () => {
        // Child'ı KAPATMA - kalsın, sonraki bağlantı görsün
        // Sadece active WS referansını temizle
        if (session.activeWs === ws) {
            session.activeWs = null;
        }
        saveSessions();
    });
});

server.listen(PANEL_PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🎛️  LSPD KONTROL PANELİ AKTİF        ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║   🌐 http://localhost:${PANEL_PORT}            ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Panel kapatılıyor...');
    pm2.disconnect();
    process.exit(0);
});

// ==============================================================================
// 🛡️ ANTI-CRASH: Beklenmedik hatalarda panel çökmesin
// ==============================================================================
process.on('uncaughtException', (err, origin) => {
    console.error('[ANTI-CRASH] Uncaught Exception:', err);
    console.error('Origin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ANTI-CRASH] Unhandled Rejection:', reason);
});

// Express global error handler
app.use((err, req, res, next) => {
    console.error('[EXPRESS ERROR]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Sunucu hatası' });
});