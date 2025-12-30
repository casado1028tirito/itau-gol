# 🚀 Deploy a Railway

## Variables de Entorno Requeridas

Configura estas variables en Railway Dashboard:

```env
TELEGRAM_BOT_TOKEN=tu_bot_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
PORT=3000
NODE_ENV=production
```

## Pasos para Desplegar

### 1. Conectar Repositorio
1. Ve a [Railway.app](https://railway.app)
2. Click en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Autoriza Railway para acceder al repositorio: `casado1028tirito/itau-gol`
5. Selecciona el repositorio

### 2. Configurar Variables de Entorno
1. En el Dashboard del proyecto, ve a "Variables"
2. Agrega las variables de entorno:
   - `TELEGRAM_BOT_TOKEN` - Token de tu bot de Telegram
   - `TELEGRAM_CHAT_ID` - ID del chat donde recibirás mensajes
   - `PORT` - Railway asignará automáticamente, pero puedes usar 3000
   - `NODE_ENV=production`

### 3. Deploy Automático
Railway detectará automáticamente:
- `package.json` - Instalará dependencias
- `Procfile` - Usará el comando `web: node server.js`
- `railway.json` - Configuración de build y deploy

El proyecto se desplegará automáticamente.

### 4. Obtener URL Pública
1. Ve a "Settings" en el Dashboard
2. En "Networking", click "Generate Domain"
3. Railway generará una URL como: `https://itau-gol-production.up.railway.app`

## 🔧 Comandos Útiles

### Ver logs en tiempo real
```bash
railway logs
```

### Redeploy manual
```bash
railway up
```

## 📦 Archivos de Configuración

- `Procfile` - Comando para iniciar el servidor
- `railway.json` - Configuración de Railway
- `package.json` - Dependencias y scripts

## ⚡ Características

- ✅ Deploy automático en cada push a master
- ✅ SSL/HTTPS incluido gratis
- ✅ Escalado automático
- ✅ Logs en tiempo real
- ✅ Variables de entorno seguras
- ✅ Dominio personalizado disponible

## 🔐 Seguridad

**IMPORTANTE**: Nunca subas archivos `.env` al repositorio. Railway manejará las variables de entorno de forma segura.

## 📱 Uso

Una vez desplegado:
1. Accede a la URL generada por Railway
2. El servidor Socket.IO estará corriendo
3. Los mensajes llegarán a tu bot de Telegram
4. Los botones de Telegram redirigirán a los usuarios

## 🐛 Troubleshooting

### Error: Cannot find module
- Verifica que todas las dependencias estén en `package.json`
- Railway ejecutará `npm install` automáticamente

### Error: TELEGRAM_BOT_TOKEN no definido
- Asegúrate de agregar las variables de entorno en Railway Dashboard

### Socket.IO no conecta
- Verifica que la URL incluya el esquema correcto (https://)
- Revisa los logs con `railway logs`

---

**Repositorio**: https://github.com/casado1028tirito/itau-gol.git
**Última actualización**: ${new Date().toLocaleDateString('es-CO')}
