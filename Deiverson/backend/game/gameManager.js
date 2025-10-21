// personali/backend/game/gameManager.js

const { pool } = require('../config/db');
// --- LÍNEA AÑADIDA: Importamos la función para emitir notificaciones ---
const { emitNotificationUpdate } = require('../utils/notifications');

const GAME_DURATION_MINUTES = 60; 
let SOLD_OUT_RESET_MS = 10 * 60 * 1000;
let soldOutCountdown = null;

let gameState = {
  currentGameId: null,
  purchasedColumns: [],
  nextResetTimestamp: null,
  isSoldOut: false,
  remainingTimeBeforeSoldOut: null, 
};

const PREMIO_MAYOR = 2000;

function calculateNextResetTimestamp(ms) {
    const now = new Date();
    return now.getTime() + ms;
}

async function startNextDrawCountdown(io) {
    if (soldOutCountdown) clearInterval(soldOutCountdown);
    
    const remainingTime = gameState.nextResetTimestamp - Date.now();
    gameState.remainingTimeBeforeSoldOut = remainingTime > 0 ? remainingTime : 0;
    
    gameState.isSoldOut = true;
    gameState.nextResetTimestamp = calculateNextResetTimestamp(SOLD_OUT_RESET_MS); 
    
    soldOutCountdown = setInterval(async () => {
        if (Date.now() >= gameState.nextResetTimestamp) {
            clearInterval(soldOutCountdown);
            soldOutCountdown = null;
            await resetGame(io); 
        }
    }, 1000);
    
    io.emit('game_sold_out_countdown', getGameState()); 
    console.log(`[Backend] 💥 Columnas agotadas. Próximo juego en ${SOLD_OUT_RESET_MS / 1000} segundos.`);
}

async function resetGame(io) {
  try {
    await pool.query("UPDATE bingo_games SET status = 'finalizado', ended_at = NOW() WHERE status = 'activo'");
    const newGame = await pool.query("INSERT INTO bingo_games (status, sold_columns, created_at) VALUES ('activo', '{}', NOW()) RETURNING id");
    
    gameState.currentGameId = newGame.rows[0].id;
    gameState.purchasedColumns = [];
    gameState.isSoldOut = false;
    gameState.remainingTimeBeforeSoldOut = null;
    gameState.nextResetTimestamp = calculateNextResetTimestamp(GAME_DURATION_MINUTES * 60 * 1000); 

    io.emit('game_reset', getGameState());
    console.log(`[Backend] ✅ Juego nuevo creado con ID: ${newGame.rows[0].id}.`);
    
    // Al resetear, también actualizamos notificaciones para limpiar la de "juego agotado"
    emitNotificationUpdate(io);

  } catch (error) {
    console.error('❌ Error al reiniciar el juego:', error);
  }
}

async function purchaseColumns(io, boughtColumns) {
  if (!gameState.currentGameId || gameState.isSoldOut) return;

  const newPurchased = [...new Set([...gameState.purchasedColumns, ...boughtColumns])];
  gameState.purchasedColumns = newPurchased;
  
  try {
    const pgArray = `{${newPurchased.join(',')}}`;
    await pool.query('UPDATE bingo_games SET sold_columns = $1 WHERE id = $2', [pgArray, gameState.currentGameId]);
    
    if (newPurchased.length >= 15 && !gameState.isSoldOut) {
      await startNextDrawCountdown(io); 
      // --- LÍNEA CLAVE AÑADIDA ---
      // Justo cuando se agota, emitimos la actualización de notificaciones
      emitNotificationUpdate(io);
    } else {
      io.emit('update_board', getGameState());
    }
    
  } catch (error) {
    console.error('❌ Error al actualizar columnas en la DB:', error);
  }
}

// (El resto del archivo no cambia, lo incluyo para que esté completo)

async function unpurchaseColumns(io, columnsToUnblock) {
    if (!gameState.currentGameId || !columnsToUnblock) return;
    const wasSoldOut = gameState.isSoldOut;
    const newPurchased = gameState.purchasedColumns.filter(col => !columnsToUnblock.includes(col));
    gameState.purchasedColumns = newPurchased;
    try {
        const pgArray = `{${newPurchased.join(',')}}`;
        await pool.query('UPDATE bingo_games SET sold_columns = $1 WHERE id = $2', [pgArray, gameState.currentGameId]);
        if (wasSoldOut && newPurchased.length < 15) {
            gameState.isSoldOut = false;
            if (soldOutCountdown) {
                clearInterval(soldOutCountdown);
                soldOutCountdown = null;
            }
            if (gameState.remainingTimeBeforeSoldOut) {
                gameState.nextResetTimestamp = calculateNextResetTimestamp(gameState.remainingTimeBeforeSoldOut);
            } else {
                gameState.nextResetTimestamp = calculateNextResetTimestamp(GAME_DURATION_MINUTES * 60 * 1000);
            }
            // Al revertir el estado, también actualizamos para quitar la notificación
            emitNotificationUpdate(io);
        }
        io.emit('update_board', getGameState());
    } catch (error) {
        console.error('❌ Error al desbloquear columnas en la DB:', error);
    }
}

// ... (El resto de las funciones: stopCurrentGame, resumeGameTimer, declareWinner, etc., se quedan igual)
async function stopCurrentGame(io) {
    if (!gameState.currentGameId) return;
    try {
        await pool.query("UPDATE bingo_games SET status = 'detenido', ended_at = NOW() WHERE id = $1", [gameState.currentGameId]);
        gameState.nextResetTimestamp = null;
        if (soldOutCountdown) clearInterval(soldOutCountdown);
        soldOutCountdown = null;
        io.emit('game_stopped', { purchasedColumns: gameState.purchasedColumns, nextResetTimestamp: null });
        emitNotificationUpdate(io); // Actualizar por si cambia el estado de juegos detenidos
    } catch (error) {
        console.error('❌ Error al detener el juego:', error);
    }
}

async function resumeGameTimer(io) {
    if (!gameState.currentGameId) return;
    try {
        await pool.query("UPDATE bingo_games SET status = 'activo', ended_at = NULL WHERE id = $1", [gameState.currentGameId]);
        if (!gameState.nextResetTimestamp || gameState.nextResetTimestamp <= Date.now()) {
            gameState.nextResetTimestamp = calculateNextResetTimestamp(GAME_DURATION_MINUTES * 60 * 1000);
        }
        io.emit('update_board', getGameState());
        emitNotificationUpdate(io); // Actualizar por si cambia el estado de juegos detenidos
    } catch (error) {
        console.error('❌ Error al reanudar el juego:', error);
    }
}

function startGameTimer(io) {
    resetGame(io);
    setInterval(() => {
        if (!gameState.isSoldOut) {
             resetGame(io);
        }
    }, GAME_DURATION_MINUTES * 60 * 1000);
}

const saveGanancia = async (gameId, profit) => {
    const finalProfit = Math.max(0, profit);
    try {
        await pool.query('INSERT INTO ganancias (game_id, profit, created_at) VALUES ($1, $2, NOW())', [gameId, finalProfit]);
    } catch (error) {
        console.error("Error al guardar la ganancia:", error);
    }
};

async function declareWinner(io, { winner, ended_at }) {
    if (!gameState.currentGameId) return;
    const gameIdToFinalize = gameState.currentGameId;
    try {
        const revenueResult = await pool.query("SELECT COALESCE(SUM(monto), 0) as total_ingresos FROM tickets WHERE game_id = $1 AND status IN ('pagado', 'impreso')", [gameIdToFinalize]);
        const totalRevenue = parseFloat(revenueResult.rows[0].total_ingresos);
        if (totalRevenue < PREMIO_MAYOR) {
            io.emit('admin_error', { message: `No se puede declarar ganador. Los ingresos (${totalRevenue.toFixed(2)} Bs) no cubren el premio de ${PREMIO_MAYOR} Bs.` });
            return;
        }
        const profitOfGame = totalRevenue - PREMIO_MAYOR;
        await saveGanancia(gameIdToFinalize, profitOfGame);
        await pool.query("UPDATE bingo_games SET status = 'finalizado', winner = $1, ended_at = $2 WHERE id = $3", [winner, ended_at || new Date(), gameIdToFinalize]);
        io.emit('game_winner_declared', { winner: winner });
        io.emit('dashboard_update', {});
        setTimeout(() => { resetGame(io); }, 5000); 
    } catch (error) {
        console.error('❌ Error al declarar el ganador en la DB:', error);
    }
}

const getGameState = () => ({ ...gameState });

function setGameTimer(io, minutes) {
  gameState.nextResetTimestamp = calculateNextResetTimestamp(minutes * 60 * 1000);
  io.emit('update_board', getGameState());
}

function setSoldOutInterval(io, ms) {
    SOLD_OUT_RESET_MS = ms;
    if (gameState.isSoldOut && soldOutCountdown) {
        gameState.nextResetTimestamp = calculateNextResetTimestamp(ms);
        io.emit('game_sold_out_countdown', getGameState());
    }
}

async function forceStartNextGame(io) {
    if (soldOutCountdown) clearInterval(soldOutCountdown);
    soldOutCountdown = null;
    await resetGame(io);
}

module.exports = {
  startGameTimer,
  purchaseColumns,
  unpurchaseColumns,
  getGameState,
  declareWinner, 
  resetGame,
  setGameTimer,
  stopCurrentGame,
  resumeGameTimer,
  setSoldOutInterval,
  forceStartNextGame,
};