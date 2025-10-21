// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { checkDBConnection } = require('./config/db');
const apiRoutes = require('./routes/api');
const { initializeSockets } = require('./sockets/socketHandler');
const { startGameTimer } = require('./game/gameManager');
const path = require('path')

// 1. Inicializar Express y Servidor HTTP
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// 2. Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, deberías restringir esto a tu dominio
    methods: ["GET", "POST"]
  }
});

// 3. Middlewares de Express
app.use(cors());
app.use(express.json());
// Servir archivos estáticos del frontend (ajusta la ruta si es necesario)
app.use(express.static('../frontend')); 
app.use(express.static(path.join(__dirname, '..'))); 
app.use('/resuelto', express.static(path.join(__dirname, '../resuelto')));
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 4. Usar las rutas de la API
app.use('/api', apiRoutes);

// 5. Inicializar Módulos
checkDBConnection();      // Verificar conexión a la base de datos
initializeSockets(io);    // Poner a escuchar los eventos de Socket.IO
startGameTimer(io);       // Iniciar el temporizador para reiniciar el juego

// 6. Poner el servidor a escuchar (¡MODIFICADO!)
const HOST = '0.0.0.0'; // Escuchará en todas las interfaces de red

server.listen(PORT, HOST, () => {
  console.log(`   Servidor corriendo en tu red local.`);
  console.log(`   Puedes acceder desde cualquier dispositivo en la misma red Wi-Fi via:`);
  // Cambia la IP si la de tu computadora es otra
  console.log(`   http://192.168.1.147:${PORT}`); 
});