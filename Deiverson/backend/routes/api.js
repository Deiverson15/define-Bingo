// personali/backend/routes/api.js

const express = require('express');
const router = express.Router();
const {
  // Autenticación
  loginUser,
  // Tickets
  createTicket, getAdminTickets, getTicketById, updateTicketStatus, updateTicket, deleteTicket,
  // Juegos y Sorteos
  getBingoGames, updateBingoGameStatus, getActiveGame, getGameResults,
  createAdminSorteo, getAdminSorteos, updateAdminSorteo,
  // Ganadores
  createGanador, getGanadores, getGanadorById, updateGanador, deleteGanador,
  // Resultados
  createResultado, getResultados, updateResultado, deleteResultado, publishResultado, unpublishResultado,
  // Reportes y Estadísticas
  getGananciasStats, getCierreStats, executeCierre, getCierresHistory, downloadReport,
  // Controles de Juego
  setSoldOutIntervalController, forceStartNextGameController,
  // Sistema de Salas Virtuales
  createSala, getSalasAdmin, getSalasPublic, toggleSalaStatus, deleteSala,
  addJugadorToSala, getJugadoresBySala, getJugadorById, updateJugador, 
  adjustJugadorCredits, deleteJugador, toggleJugadorStatus,
  loginJugadorSala,

} = require('../controllers/apiController');

// --- RUTAS PÚBLICAS ---
router.post('/login', loginUser);
router.get('/results', getGameResults);
router.post('/salas/login', loginJugadorSala);
router.get('/salas', getSalasPublic);

// --- RUTAS DE TICKETS ---
router.post('/tickets', createTicket);
router.get('/tickets/:id', getTicketById);
router.patch('/tickets/:id/status', updateTicketStatus);
router.put('/tickets/:id', updateTicket);
router.delete('/tickets/:id', deleteTicket);

// --- RUTAS DE ADMINISTRACIÓN ---
router.get('/admin/tickets', getAdminTickets);
router.get('/admin/bingos', getBingoGames);
router.put('/admin/bingos/:id/status', updateBingoGameStatus);
router.get('/admin/active-game', getActiveGame);
router.post('/admin/sorteos', createAdminSorteo);
router.get('/admin/sorteos', getAdminSorteos);
router.put('/admin/sorteos/:id', updateAdminSorteo);
router.post('/admin/ganadores', createGanador);
router.get('/admin/ganadores', getGanadores);
router.get('/admin/ganadores/:id', getGanadorById);
router.put('/admin/ganadores/:id', updateGanador);
router.delete('/admin/ganadores/:id', deleteGanador);
router.post('/admin/resultados', createResultado);
router.get('/admin/resultados', getResultados);
router.put('/admin/resultados/:id', updateResultado);
router.delete('/admin/resultados/:id', deleteResultado);
router.patch('/admin/resultados/:id/publish', publishResultado);
router.patch('/admin/resultados/:id/unpublish', unpublishResultado);
router.get('/admin/ganancias/stats', getGananciasStats);
router.post('/admin/game-config/set-sold-out-interval', setSoldOutIntervalController);
router.post('/admin/game-config/force-start-next-game', forceStartNextGameController);
router.get('/admin/reports/cierre', getCierreStats);
router.post('/admin/reports/execute-cierre', executeCierre);
router.get('/admin/reports/cierres-history', getCierresHistory);
router.get('/admin/reports/download', downloadReport);

// --- RUTAS PARA GESTIÓN DE SALAS Y JUGADORES (ADMIN) ---
router.post('/admin/salas', createSala);
router.get('/admin/salas', getSalasAdmin);
router.patch('/admin/salas/:id/toggle', toggleSalaStatus);
router.delete('/admin/salas/:id', deleteSala);
router.post('/admin/salas/jugadores', addJugadorToSala);
router.get('/admin/salas/:sala_id/jugadores', getJugadoresBySala);
router.get('/admin/jugadores/:id', getJugadorById); // CORREGIDO
router.put('/admin/jugadores/:id', updateJugador);
router.patch('/admin/jugadores/:id/credits', adjustJugadorCredits);
router.delete('/admin/jugadores/:id', deleteJugador);
router.patch('/admin/jugadores/:id/toggle', toggleJugadorStatus); // CORREGIDO

module.exports = router;