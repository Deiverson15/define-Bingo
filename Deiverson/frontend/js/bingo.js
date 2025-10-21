// /frontend/js/bingo.js

document.addEventListener('DOMContentLoaded', () => {
    // ======================================================
    // CONEXIÓN CON EL SERVIDOR Y SELECCIÓN DE ELEMENTOS
    // ======================================================
    const socket = io(SOCKET_URL);

    const bingoBoard = document.getElementById('bingo-board');
    const comprarButton = document.getElementById('comprar-button');
    const totalPriceContainer = document.getElementById('total-price-container');
    const totalPriceEl = document.getElementById('total-price');
    const discountInfoEl = document.getElementById('discount-info');
    const countdownElement = document.getElementById('countdown-timer');
    const gameIdDisplay = document.getElementById('game-id-display'); // Elemento para el ID de partida
    const openInfoModalButton = document.getElementById('open-info-modal-button');
    const closeInfoModalButton = document.getElementById('close-info-modal-button');
    const infoModal = document.getElementById('info-modal');
    const selectionTitle = document.querySelector('main h2');
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    const boardOverlay = document.getElementById('board-overlay');

    let selectedColumns = [];
    let selectedPaymentMethod = null;
    let countdownInterval = null;
    let activeGameId = null;

    // ======================================================
    // LÓGICA DE JUEGO ACTIVO
    // ======================================================
    
    // FUNCIÓN MODIFICADA: Ahora actualiza la UI con el ID de la partida
    async function fetchActiveGameId() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/active-game`);
            if (!response.ok) throw new Error("No hay juego activo.");
            const game = await response.json();
            activeGameId = game.id;
            // Actualizar el elemento en la interfaz
            if (gameIdDisplay) {
                gameIdDisplay.textContent = `Partida #${activeGameId}`;
            }
        } catch (error) {
            activeGameId = null;
            if (gameIdDisplay) {
                gameIdDisplay.textContent = 'Partida #---';
            }
        }
    }
    
    // ======================================================
    // LÓGICA DE SOCKET.IO (ESCUCHAR EVENTOS DEL SERVIDOR)
    // ======================================================
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor en tiempo real. ID:', socket.id);
    });

    socket.on('update_board', (gameState) => {
        console.log("Tablero actualizado recibido, estado:", gameState);
        updateBoardUI(gameState.purchasedColumns || []);
        startCountdown(gameState.nextResetTimestamp);
        
        if (gameState.isSoldOut) {
            setSoldOutCountdownUI(gameState.nextResetTimestamp);
        } else {
            resetUI();
        }
    });
    
    socket.on('game_sold_out_countdown', (gameState) => {
        console.log("Recibido: ¡Juego Agotado! Iniciando cuenta regresiva para el siguiente sorteo.");
        setSoldOutCountdownUI(gameState.nextResetTimestamp);
        startCountdown(gameState.nextResetTimestamp);
        updateBoardUI(gameState.purchasedColumns || []); 
    });


    socket.on('game_reset', (gameState) => {
        console.log("EVENTO 'game_reset' RECIBIDO. Sincronizando.");
        Swal.fire({
            icon: 'info',
            title: '¡Nuevo Juego!',
            text: 'Ha comenzado una nueva ronda. El tablero ha sido reiniciado.',
            timer: 3000,
            showConfirmButton: false
        });
        
        selectedColumns = [];
        updateBoardUI(gameState.purchasedColumns || []);
        startCountdown(gameState.nextResetTimestamp);
        resetUI();
        fetchActiveGameId(); // Vuelve a obtener el ID de la nueva partida
    });

    socket.on('game_stopped', (gameState) => {
        console.log("EVENTO 'game_stopped' RECIBIDO. Deteniendo contador.");
        startCountdown(gameState.nextResetTimestamp);
        if (selectionTitle) {
            selectionTitle.textContent = "¡Contador Detenido! Atento a los Resultados";
            selectionTitle.classList.remove('text-green-400');
            selectionTitle.classList.add('text-yellow-400', 'animate-pulse');
        }
        if (countdownElement) {
            countdownElement.classList.add('text-red-500', 'animate-pulse'); 
            countdownElement.classList.remove('text-yellow-400');
        }
    });

    socket.on('game_winner_declared', (data) => {
        console.log(`EVENTO 'game_winner_declared' RECIBIDO. Ganador: ${data.winner}`);
        showWinnerAlert(data.winner);
    });

    // ======================================================
    // FUNCIONES PARA MANEJAR LA INTERFAZ (UI)
    // ======================================================

    function updatePrice() {
        const count = selectedColumns.length;
        const basePricePerColumn = 200;
        let total = count * basePricePerColumn;
        let discountApplied = false;

        if (count === 5) {
            total -= 40; // Aplica el descuento de 40 Bs
            discountApplied = true;
        }

        if (count > 0) {
            totalPriceEl.textContent = `${total.toFixed(2)} Bs`;
            discountInfoEl.textContent = discountApplied ? '¡Descuento de 40 Bs aplicado!' : '';
            totalPriceContainer.classList.remove('hidden');
        } else {
            totalPriceContainer.classList.add('hidden');
        }
    }

    function showWinnerAlert(winningColumn) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        Swal.fire({
            title: '¡Tenemos un Ganador!',
            html: `<p class="text-2xl text-gray-300 mb-4">La columna ganadora es la</p><div class="bg-yellow-400 text-gray-900 font-black text-8xl rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-lg">${winningColumn}</div>`,
            icon: 'success',
            timer: 15000,
            timerProgressBar: true,
            showConfirmButton: false,
            background: '#1f2937',
            color: '#ffffff',
            customClass: { title: 'text-yellow-400 text-4xl font-black' }
        });
    }

    function setSoldOutCountdownUI(resetTimestamp) {
        if (selectionTitle) {
            selectionTitle.innerHTML = "PRÓXIMO SORTEO EN BREVE<br><span class='text-red-500 font-bold text-sm'>ATENTO A LOS RESULTADOS</span>";
            selectionTitle.classList.add('text-yellow-400', 'animate-pulse');
            selectionTitle.classList.remove('text-green-400');
        }
        
        if (comprarButton) {
            comprarButton.disabled = true;
            comprarButton.textContent = 'AGOTADO';
        }
        
        if (boardOverlay) boardOverlay.classList.remove('hidden');
    }

    function resetUI() {
        if (selectionTitle) {
            selectionTitle.textContent = "SELECCIONA TU COLUMNA (MAX 5)";
            selectionTitle.classList.remove('text-red-500', 'animate-pulse', 'text-yellow-400');
            selectionTitle.classList.add('text-green-400');
        }
        if (comprarButton) {
            comprarButton.disabled = false;
            comprarButton.textContent = 'COMPRAR';
        }
        if (boardOverlay) boardOverlay.classList.add('hidden');
        if (countdownElement) {
            countdownElement.classList.remove('text-red-500', 'animate-pulse');
            countdownElement.classList.add('text-yellow-400');
        }
    }

    function updateBoardUI(purchasedColumns = []) {
        const allCells = bingoBoard.querySelectorAll('[data-col]');
        allCells.forEach(cell => {
            const colNum = parseInt(cell.dataset.col);
            cell.classList.remove('col-purchased', 'col-selected');
            if (purchasedColumns.includes(colNum)) {
                cell.classList.add('col-purchased');
            }
        });
    }

    function startCountdown(resetTimestamp) {
        if (countdownInterval) clearInterval(countdownInterval);
        if (!resetTimestamp) {
            countdownElement.textContent = "DETENIDO";
            return;
        }
        const targetTime = new Date(resetTimestamp).getTime();
        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;
            if (distance < 0) {
                clearInterval(countdownInterval);
                countdownElement.textContent = "00:00";
                return;
            }
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            countdownElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    // ======================================================
    // CONSTRUCCIÓN DEL TABLERO Y MANEJO DE EVENTOS
    // ======================================================
    function buildBoard() {
        bingoBoard.innerHTML = '';
        const letters = ['B', 'I', 'N', 'G', 'O'];
        const colors = ['bg-blue-500', 'bg-red-500', 'bg-gray-600', 'bg-green-500', 'bg-yellow-500'];
        let numberCounter = 1;
        for (let row = 0; row < 5; row++) {
            const letterCell = document.createElement('div');
            letterCell.className = `${colors[row]} p-2 text-xl flex items-center justify-center`;
            letterCell.textContent = letters[row];
            bingoBoard.appendChild(letterCell);
            for (let col = 1; col <= 15; col++) {
                const numberCell = document.createElement('div');
                numberCell.className = 'border border-gray-700 p-2 flex items-center justify-center';
                numberCell.textContent = numberCounter;
                numberCell.dataset.col = col; 
                bingoBoard.appendChild(numberCell);
                numberCounter++;
            }
        }
    }
    buildBoard();

    bingoBoard.addEventListener('click', (event) => {
        const cell = event.target;
        const col = cell.dataset.col;
        if (!col || cell.classList.contains('col-purchased')) return;
        const colIndex = parseInt(col);
        const isSelected = selectedColumns.includes(colIndex);
        if (isSelected) {
            selectedColumns = selectedColumns.filter(c => c !== colIndex);
            document.querySelectorAll(`[data-col="${col}"]`).forEach(c => c.classList.remove('col-selected'));
        } else {
            if (selectedColumns.length < 5) {
                selectedColumns.push(colIndex);
                document.querySelectorAll(`[data-col="${col}"]`).forEach(c => c.classList.add('col-selected'));
            } else {
                Swal.fire({ icon: 'warning', title: 'Límite alcanzado', text: 'Puedes seleccionar un máximo de 5 columnas.' });
            }
        }
        updatePrice();
    });

    document.querySelectorAll('.payment-method-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('payment-selected'));
            button.classList.add('payment-selected');
            selectedPaymentMethod = button.dataset.method;
        });
    });

    // ======================================================
    // LÓGICA DE COMPRA
    // ======================================================
    comprarButton.addEventListener('click', () => {
        if (selectedColumns.length === 0) {
            return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Debes seleccionar al menos una columna.' });
        }
        if (!selectedPaymentMethod) {
            return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Debes seleccionar una forma de pago.' });
        }
        const user = Auth.getUser();
        if (!user) {
            return Swal.fire({ icon: 'error', title: 'No has iniciado sesión', text: 'Por favor, inicia sesión para poder comprar.' });
        }
        if (!activeGameId) {
             return Swal.fire({ icon: 'error', title: 'Error de Sincronización', text: 'No se pudo obtener el ID de la partida. Recarga la página.' });
        }
        const pendingTicket = {
            columns: selectedColumns,
            paymentMethod: selectedPaymentMethod,
            userId: user.id,
            username: user.username,
            gameId: activeGameId,
        };
        localStorage.setItem('pendingTicketData', JSON.stringify(pendingTicket));
        window.location.href = 'ticket.html';
    });

    function updateTime() {
        const now = new Date();
        if (dateElement) dateElement.textContent = `FECHA ${now.toLocaleDateString('es-VE')}`;
        if (timeElement) timeElement.textContent = `HORA ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    updateTime();
    setInterval(updateTime, 60000);

    if (openInfoModalButton && infoModal) openInfoModalButton.addEventListener('click', () => infoModal.classList.remove('hidden'));
    if (closeInfoModalButton && infoModal) closeInfoModalButton.addEventListener('click', () => infoModal.classList.add('hidden'));
    
    // LLAMADA INICIAL PARA OBTENER EL ID DEL JUEGO AL CARGAR LA PÁGINA
    fetchActiveGameId(); 
});