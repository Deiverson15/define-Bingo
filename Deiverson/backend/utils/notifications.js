// personali/backend/utils/notifications.js

const { pool } = require('../config/db');

/**
 * Calcula el número de ítems pendientes en varias tablas, siguiendo el flujo de trabajo.
 * @returns {Promise<object>} Un objeto con los conteos de cada sección.
 */
const getNotificationCounts = async () => {
  try {
    // TAREA 1: Contar pagos pendientes para la insignia de "Pagos".
    const pendingPagosQuery = pool.query("SELECT COUNT(*) FROM tickets WHERE status = 'pendiente'");
    
    // TAREA 2: Contar tickets pagados (pendientes de imprimir) para la insignia de "Tickets".
    const pendingPrintQuery = pool.query("SELECT COUNT(*) FROM tickets WHERE status = 'pagado'");
    
    // TAREA 3: Contar juegos detenidos.
    const stoppedGamesQuery = pool.query("SELECT COUNT(*) FROM bingo_games WHERE status = 'detenido'");

    // TAREA 4: Contar sorteos pendientes
    const pendingSorteosQuery = pool.query("SELECT COUNT(*) FROM sorteos_admin WHERE estado = 'pendiente'");
    
    // TAREA 5: Contar resultados en borrador
    const draftResultadosQuery = pool.query("SELECT COUNT(*) FROM resultados WHERE status = 'borrador'");

    // Ejecutar todas las consultas en paralelo
    const [
      pendingPagosResult,
      pendingPrintResult,
      stoppedGamesResult,
      pendingSorteosResult,
      draftResultadosResult
    ] = await Promise.all([
      pendingPagosQuery,
      pendingPrintQuery,
      stoppedGamesQuery,
      pendingSorteosQuery,
      draftResultadosQuery
    ]);

    // Lógica AÑADIDA: Determinar si el juego activo está AGOTADO (15 columnas vendidas)
    let soldOutGameCount = 0;
    try {
        const activeGameResult = await pool.query(
            "SELECT sold_columns FROM bingo_games WHERE status = 'activo' ORDER BY created_at DESC LIMIT 1"
        );
        // sold_columns es un PG array, que node-postgres lo convierte en un array de JS.
        const soldColumns = activeGameResult.rows[0]?.sold_columns; 
        if (Array.isArray(soldColumns) && soldColumns.length >= 15) {
            soldOutGameCount = 1;
        }
    } catch (error) {
        // En caso de error (ej. no hay juego activo), la cuenta sigue en 0.
    }
    
    const stoppedCount = parseInt(stoppedGamesResult.rows[0].count, 10);
    // Combina el conteo: 1 si está agotado MÁS el número de juegos detenidos.
    const totalJuegosPendientes = stoppedCount + soldOutGameCount; 


    return {
      pagos: parseInt(pendingPagosResult.rows[0].count, 10),
      tickets: parseInt(pendingPrintResult.rows[0].count, 10),
      // MODIFICADO: Incluye juegos agotados y detenidos
      juegos: totalJuegosPendientes, 
      sorteos: parseInt(pendingSorteosResult.rows[0].count, 10),
      resultados: parseInt(draftResultadosResult.rows[0].count, 10),
    };
  } catch (error) {
    console.error("Error al calcular las notificaciones:", error);
    return { tickets: 0, pagos: 0, juegos: 0, sorteos: 0, resultados: 0 };
  }
};

/**
 * Emite una actualización de notificaciones a todos los admins conectados.
 * @param {object} io - La instancia de Socket.IO.
 */
const emitNotificationUpdate = async (io) => {
    const counts = await getNotificationCounts();
    io.emit('notifications_update', counts);
    console.log('📢 Notificaciones de flujo de trabajo actualizadas:', counts);
};

module.exports = { getNotificationCounts, emitNotificationUpdate };