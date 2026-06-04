// ============================================
//  Basit Logger
//  Renkli ve zaman damgalı log
// ============================================

const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
};

function timestamp() {
    return new Date().toLocaleString('tr-TR', { 
        timeZone: 'Europe/Istanbul',
        hour12: false 
    });
}

const logger = {
    info: (msg, ...args) => {
        console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}ℹ${colors.reset}  ${msg}`, ...args);
    },
    success: (msg, ...args) => {
        console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}✓${colors.reset}  ${msg}`, ...args);
    },
    warn: (msg, ...args) => {
        console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}⚠${colors.reset}  ${msg}`, ...args);
    },
    error: (msg, ...args) => {
        console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}✗${colors.reset}  ${msg}`, ...args);
    },
};

module.exports = logger;