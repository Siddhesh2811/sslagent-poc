import fs from 'fs';
import path from 'path';
import util from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Generate session log filename
const now = new Date();
const timestamp = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') + '-' +
    String(now.getMinutes()).padStart(2, '0') + '-' +
    String(now.getSeconds()).padStart(2, '0');

const logFilePath = path.join(logDir, `session-${timestamp}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

console.log(`[Logger] Session logging to: ${logFilePath}`);

const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

function formatLog(args) {
    const timestamp = new Date().toISOString();
    const msg = util.format(...args);
    return `[${timestamp}] ${msg}\n`;
}

// Override console.log
const originalLog = console.log;
console.log = function (...args) {
    const formatted = formatLog(args);
    logStream.write(formatted);
    // process.stdout.write(formatted); // This might cause double timestamps if console.log already does it, but standard console.log just outputs. 
    // Usually console.log(...) calls process.stdout.write with a newline.
    // Let's just defer to the original console.log for terminal, but we need to pass args exactly.
    originalLog.apply(console, args);
};

// Override console.error
const originalError = console.error;
console.error = function (...args) {
    const formatted = formatLog(args);
    logStream.write(formatted);
    originalError.apply(console, args);
};

// Also catch uncaught exceptions to log them before crash
process.on('uncaughtException', (err) => {
    const msg = `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack || err}\n`;
    logStream.write(msg);
    process.stderr.write(msg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = `[${new Date().toISOString()}] UNHANDLED REJECTION: ${util.format(reason)}\n`;
    logStream.write(msg);
    process.stderr.write(msg);
});

export default logStream;
