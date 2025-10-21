// /frontend/js/admin-juegos.js - CÓDIGO COMPLETO Y DEFINITIVO

document.addEventListener('DOMContentLoaded', () => {
    const seccionJuegos = document.getElementById('section-juegos');
    if (!seccionJuegos) return;

    // ======================================================
    // SELECCIÓN DE ELEMENTOS DEL DOM
    // ======================================================
    const bingoTableBody = document.getElementById('bingo-history-table-body');
    const refreshButton = document.getElementById('refresh-bingo-list');
    
    // Modales
    const liveGameModal = document.getElementById('live-game-modal');
    const historyGameModal = document.getElementById('history-game-modal');
    
    // Botones de modales
    const openModalButton = document.getElementById('open-live-game-modal');
    const closeModalButton = document.getElementById('close-live-game-modal');
    const closeHistoryModalButton = document.getElementById('close-history-game-modal');
    
    // Contenido del modal en vivo
    const modalCountdown = document.getElementById('modal-countdown-timer');
    const modalColumnsGrid = document.getElementById('modal-columns-grid');
    const modalGameStatusMessage = document.getElementById('modal-game-status-message');
    
    // Controles del modal en vivo
    const timerMinutesInput = document.getElementById('timer-minutes-input');
    const setTimerButton = document.getElementById('set-timer-button');
    const forceResetButton = document.getElementById('force-reset-button');
    const resumeGameButton = document.getElementById('resume-game-button');

    // Contenido del modal de historial
    const historyModalId = document.getElementById('history-modal-id');
    const historyModalDate = document.getElementById('history-modal-date');
    const historyModalStatus = document.getElementById('history-modal-status');
    const historyModalWinner = document.getElementById('history-modal-winner');
    const historyModalGrid = document.getElementById('history-modal-columns-grid');
    
    // UI Principal
    const mainCountdown = document.getElementById('game-status-display');
    const mainColumnsGrid = document.getElementById('main-columns-grid'); 
    
    // Controles avanzados
    const soldOutIntervalInput = document.getElementById('sold-out-interval-input');
    const setSoldOutIntervalBtn = document.getElementById('set-sold-out-interval-btn');
    const forceStartNextGameBtn = document.getElementById('force-start-next-game-btn');
    
    // UI de estado "Agotado"
    const soldOutStatusDiv = document.getElementById('sold-out-status-display');
    const soldOutCountdownDisplay = document.getElementById('sold-out-countdown-display');

    // ======================================================
    // ESTADO Y CONEXIÓN SOCKET.IO
    // ======================================================
    const socket = io(SOCKET_URL);
    let countdownInterval = null;
    let gamesHistory = []; 

    socket.on('connect', () => console.log('Módulo de Juegos conectado a Socket.IO.'));
    
    // --- SOLUCIÓN DEFINITIVA ---
    // Escucha la notificación general y la usa para refrescar el estado del juego en vivo.
    socket.on('dashboard_update', () => {
        if (!seccionJuegos.classList.contains('hidden')) {
            console.log("📢 Recibido 'dashboard_update'. Refrescando estado en vivo y historial.");
            fetchBingoGames(); // Actualiza la tabla de historial
            socket.emit('admin_request_game_state'); // Pide el estado en vivo más reciente
        }
    });
    
    socket.on('update_board', (gameState) => {
        updateLiveGameUI(gameState);
    });

    socket.on('game_sold_out_countdown', (gameState) => {
        updateLiveGameUI(gameState);
    });

    socket.on('game_sold_out', () => {
        if (window.UI) UI.toast("¡El tablero de Bingo está completamente AGOTADO!", "warning");
    });
    
    socket.on('game_reset', (gameState) => {
        updateLiveGameUI(gameState); 
        fetchBingoGames(); 
        if (liveGameModal) liveGameModal.classList.add('hidden'); 
        if (window.UI) UI.toast('¡Nuevo juego iniciado!', 'info');
    });

    // ======================================================
    // LÓGICA DE MANEJO DE MODALES Y UI
    // ======================================================
    if (openModalButton && liveGameModal) openModalButton.addEventListener('click', () => liveGameModal.classList.remove('hidden'));
    if (closeModalButton && liveGameModal) closeModalButton.addEventListener('click', () => liveGameModal.classList.add('hidden'));
    if (closeHistoryModalButton && historyGameModal) closeHistoryModalButton.addEventListener('click', () => historyGameModal.classList.add('hidden'));

    function updateLiveGameUI(gameState) {
        if (!gameState) return;
        
        const isSoldOut = gameState.isSoldOut;
        if (soldOutStatusDiv) soldOutStatusDiv.classList.toggle('hidden', !isSoldOut);
        
        renderLiveBingoGrid(gameState.purchasedColumns || [], mainColumnsGrid); 

        if(liveGameModal && !liveGameModal.classList.contains('hidden')) {
            renderLiveBingoGrid(gameState.purchasedColumns || [], modalColumnsGrid);
        }
        
        const message = isSoldOut 
            ? 'Columnas agotadas, el próximo sorteo iniciará pronto.'
            : 'Juego en curso, se pueden comprar columnas.';
        
        if (modalGameStatusMessage) {
            modalGameStatusMessage.textContent = message;
            modalGameStatusMessage.classList.toggle('text-red-400', isSoldOut);
            modalGameStatusMessage.classList.toggle('animate-pulse', isSoldOut);
            modalGameStatusMessage.classList.toggle('text-yellow-400', !isSoldOut);
        }
        
        startCountdown(gameState.nextResetTimestamp, isSoldOut); 
    }
    
    function startCountdown(resetTimestamp, isSoldOut) { 
        if (countdownInterval) clearInterval(countdownInterval);
        
        const updateText = (text, isRunning) => {
            if (modalCountdown) modalCountdown.textContent = text;
            if (mainCountdown) {
                mainCountdown.textContent = text;
                mainCountdown.classList.toggle('text-red-400', !isRunning);
                mainCountdown.classList.toggle('text-emerald-300', isRunning);
            }
            if (isSoldOut && soldOutCountdownDisplay) {
                soldOutCountdownDisplay.textContent = text;
            }
        }

        if (!resetTimestamp) {
            updateText("DETENIDO", false);
            return;
        };

        const targetTime = new Date(resetTimestamp).getTime();
        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;
            if (distance < 0) {
                clearInterval(countdownInterval);
                updateText("00:00", false);
                return;
            }
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            updateText(timeString, true); 
        }, 1000);
    }
    
    function renderLiveBingoGrid(purchasedColumns, container) {
        if (!container) return;
        container.innerHTML = '';
        for (let i = 1; i <= 15; i++) {
            const isPurchased = purchasedColumns.includes(i);
            container.innerHTML += `<button onclick="handleColumnClick(${i}, ${isPurchased})" class="p-2 rounded-lg font-bold text-sm text-center ${isPurchased ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-gray-600 text-white hover:bg-gray-500'}">${i}</button>`;
        }
        if(container === modalColumnsGrid && window.lucide) lucide.createIcons();
    }
    
    window.handleColumnClick = (colNumber, isToUnblock) => {
        const actionText = isToUnblock ? `¿Liberar la columna ${colNumber}?` : `¿Bloquear la columna ${colNumber}?`;
        if (confirm(actionText)) {
            socket.emit(isToUnblock ? 'admin_unblock_columns' : 'admin_block_columns', { columns: [colNumber] });
        }
    }

    if (forceResetButton) {
        forceResetButton.addEventListener('click', () => {
            Swal.fire({ title: '¿DETENER JUEGO?', text: "El contador se detendrá para todos.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, ¡detener!' })
               .then(result => { if (result.isConfirmed) socket.emit('admin_stop_game'); });
        });
    }

    if (resumeGameButton) {
        resumeGameButton.addEventListener('click', () => {
            if (confirm('¿Reanudar el contador?')) socket.emit('admin_resume_game');
        });
    }

    if (setTimerButton) {
        setTimerButton.addEventListener('click', () => {
            const minutes = timerMinutesInput.value;
            if (!minutes || minutes <= 0) return alert('Introduce un número de minutos válido.');
            if (confirm(`¿Establecer el contador en ${minutes} minutos?`)) {
                socket.emit('admin_set_timer', { minutes });
                timerMinutesInput.value = '';
            }
        });
    }
    
    // ======================================================
    // LÓGICA DE CONTROLES AVANZADOS
    // ======================================================
    if (setSoldOutIntervalBtn) {
        setSoldOutIntervalBtn.addEventListener('click', async () => {
            const intervalSeconds = parseInt(soldOutIntervalInput.value, 10);
            if (isNaN(intervalSeconds) || intervalSeconds < 1) return Swal.fire('Error', 'El valor debe ser un número positivo.', 'error');
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/game-config/set-sold-out-interval`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervalMs: intervalSeconds * 1000 }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                Swal.fire('Guardado', result.message, 'success');
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        });
    }
    
    if (forceStartNextGameBtn) {
        forceStartNextGameBtn.addEventListener('click', async () => {
            const res = await Swal.fire({ title: '¿Iniciar Juego Ahora?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, ¡Iniciar!' });
            if (res.isConfirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/game-config/force-start-next-game`, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
                    Swal.fire('Iniciado', result.message, 'success');
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    }

    // ======================================================
    // LÓGICA DEL HISTORIAL DE PARTIDAS
    // ======================================================
    async function fetchBingoGames() {
        if (!bingoTableBody) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/bingos`);
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            gamesHistory = await response.json();
            renderBingoTable(gamesHistory);
        } catch (error) {
            bingoTableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-400">${error.message}</td></tr>`;
        }
    }

    function renderBingoTable(games) {
        if (!bingoTableBody || !games) return;
        bingoTableBody.innerHTML = games.length === 0
            ? `<tr><td colspan="6" class="p-4 text-center text-[#9fb2b0]">No hay partidas registradas.</td></tr>`
            : games.map(game => `
                <tr class="border-b border-[#1b2742] hover:bg-[#0c1528]/40">
                    <td class="p-3 font-mono text-sm">${game.id}</td>
                    <td class="p-3">${new Date(game.created_at).toLocaleString('es-VE')}</td>
                    <td class="p-3 font-bold text-emerald-300">${game.winner || '---'}</td>
                    <td class="p-3"><span class="badge ${{ 'activo': 'badge-green', 'finalizado': 'badge-blue', 'detenido': 'badge-red' }[game.status] || 'badge-yellow'}">${game.status || 'N/A'}</span></td>
                    <td class="p-3 text-center">${15 - (Array.isArray(game.sold_columns) ? game.sold_columns.length : 0)} / 15</td>
                    <td class="p-3 text-center"><button onclick="openHistoryModal(${game.id})" class="btn btn-neutral py-1 px-2">Ver</button></td>
                </tr>`).join('');
    }

    window.openHistoryModal = (gameId) => {
        const game = gamesHistory.find(g => g.id == gameId);
        if (!game || !historyGameModal) return;
        historyModalId.textContent = game.id;
        historyModalDate.textContent = new Date(game.created_at).toLocaleString('es-VE');
        historyModalStatus.textContent = game.status || 'N/A';
        historyModalWinner.textContent = game.winner || '---';
        historyModalStatus.className = `font-bold text-lg ${{ 'activo': 'text-emerald-300', 'finalizado': 'text-indigo-400', 'detenido': 'text-red-400' }[game.status] || 'text-yellow-400'}`;
        renderHistoryGrid(Array.isArray(game.sold_columns) ? game.sold_columns : []);
        historyGameModal.classList.remove('hidden');
    }

    function renderHistoryGrid(soldColumns) {
        if (!historyModalGrid) return;
        historyModalGrid.innerHTML = '';
        for (let i = 1; i <= 15; i++) {
            historyModalGrid.innerHTML += `<div class="p-3 rounded-lg font-bold text-lg text-center ${soldColumns.includes(i) ? 'bg-red-600 text-white' : 'bg-gray-600'}">${i}</div>`;
        }
    }
    
    // ======================================================
    // CARGA INICIAL Y EVENTOS
    // ======================================================
    if (refreshButton) refreshButton.addEventListener('click', fetchBingoGames);
    
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'juegos') {
            fetchBingoGames();
            console.log('[Admin Juegos] Pestaña activada. Solicitando estado del juego en vivo...');
            socket.emit('admin_request_game_state');
        }
    });

    if (seccionJuegos && !seccionJuegos.classList.contains('hidden')) {
        fetchBingoGames();
        socket.emit('admin_request_game_state');
    }
});