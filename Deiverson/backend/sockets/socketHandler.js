// personali/backend/sockets/socketHandler.js

// 1. Mantenemos las importaciones originales
const gameManager = require('../game/gameManager');
const { getNotificationCounts } = require('../utils/notifications'); 

// 2. Lógica para el Sorteo Manual del Admin (puedes colapsar esto si quieres, no tiene cambios)
let adminSorteoState = {
    numerosSorteados: [],
    numerosPosibles: [],
    ultimoSorteado: null,
    anteriorSorteado: null,
    sorteoFinalizado: true,
    patronGanador: null,
    isRunning: false
};
let adminSorteoInterval = null;
const PATRONES_VERTICALES = Array.from({ length: 15 }, (_, i) => [1 + i, 16 + i, 31 + i, 46 + i, 61 + i]);

function iniciarSorteoAdmin(io) {
    adminSorteoState = {
        numerosSorteados: [],
        numerosPosibles: Array.from({ length: 75 }, (_, i) => i + 1),
        ultimoSorteado: null,
        anteriorSorteado: null,
        sorteoFinalizado: false,
        patronGanador: null,
        isRunning: true
    };
    
    adminSorteoInterval = setInterval(() => cicloSorteoAdmin(io), 1500);
    io.emit('admin_sorteo_update', adminSorteoState);
}

function cicloSorteoAdmin(io) {
    if (adminSorteoState.numerosPosibles.length === 0 || adminSorteoState.sorteoFinalizado) {
        detenerSorteoAdmin(io);
        return;
    }

    adminSorteoState.anteriorSorteado = adminSorteoState.ultimoSorteado;
    const indice = Math.floor(Math.random() * adminSorteoState.numerosPosibles.length);
    const nuevoNumero = adminSorteoState.numerosPosibles.splice(indice, 1)[0];
    adminSorteoState.numerosSorteados.push(nuevoNumero);
    adminSorteoState.ultimoSorteado = nuevoNumero;

    for (const patron of PATRONES_VERTICALES) {
        if (patron.every(num => adminSorteoState.numerosSorteados.includes(num))) {
            adminSorteoState.patronGanador = patron;
            adminSorteoState.sorteoFinalizado = true;
            detenerSorteoAdmin(io);
            break;
        }
    }
    
    io.emit('admin_sorteo_update', adminSorteoState);
}

function pausarReanudarSorteoAdmin(io) {
    if (adminSorteoState.sorteoFinalizado) return;

    if (adminSorteoState.isRunning) {
        clearInterval(adminSorteoInterval);
        adminSorteoState.isRunning = false;
    } else {
        adminSorteoInterval = setInterval(() => cicloSorteoAdmin(io), 1500);
        adminSorteoState.isRunning = true;
    }
    io.emit('admin_sorteo_update', adminSorteoState);
}

function detenerSorteoAdmin(io) {
    clearInterval(adminSorteoInterval);
    adminSorteoInterval = null;
    adminSorteoState.isRunning = false;
    io.emit('admin_sorteo_update', adminSorteoState);
}



function initializeSockets(io) {
    io.on('connection', async (socket) => { 
        const clientIp = socket.handshake.address;
        console.log(`🔌 Nuevo usuario conectado desde la IP: ${clientIp} (ID: ${socket.id})`);

        try {
            const initialCounts = await getNotificationCounts();
            socket.emit('notifications_update', initialCounts);
            console.log('✉️ Notificaciones iniciales enviadas:', initialCounts);
        } catch (error) {
            console.error("Error al enviar notificaciones iniciales:", error);
        }

        // --- RESTO DE LOS EVENTOS ---
        socket.on('subscribe_to_ticket_status', (ticketId) => {
            console.log(`[Socket] Usuario ${socket.id} suscrito al ticket ID: ${ticketId}`);
            socket.join(`ticket_${ticketId}`);
        });

        // --- LÍNEA CLAVE AÑADIDA ---
        // Responde a la solicitud del admin con el estado actual del juego.
        socket.on('admin_request_game_state', () => {
            console.log(`[Socket] Admin ${socket.id} solicitó estado del juego. Enviando...`);
            socket.emit('update_board', gameManager.getGameState());
        });

        socket.emit('update_board', gameManager.getGameState());
        socket.on('buy_columns', (boughtColumns) => { gameManager.purchaseColumns(io, boughtColumns); });
        socket.on('admin_block_columns', ({ columns }) => { gameManager.purchaseColumns(io, columns); });
        socket.on('admin_unblock_columns', ({ columns }) => { gameManager.unpurchaseColumns(io, columns); });
        socket.on('admin_set_timer', ({ minutes }) => { gameManager.setGameTimer(io, parseFloat(minutes)); });
        socket.on('admin_stop_game', () => { gameManager.stopCurrentGame(io); });
        socket.on('admin_resume_game', () => { gameManager.resumeGameTimer(io); });
        socket.on('admin_declare_winner', (data) => { gameManager.declareWinner(io, data); });
        socket.emit('admin_sorteo_update', adminSorteoState);
        socket.on('admin_sorteo_start', () => { iniciarSorteoAdmin(io); });
        socket.on('admin_sorteo_pause_resume', () => { pausarReanudarSorteoAdmin(io); });

        socket.on('disconnect', () => {
            console.log(`🔌 Usuario desconectado de la IP: ${clientIp} (ID: ${socket.id})`);
        });
    });
}


module.exports = { initializeSockets };