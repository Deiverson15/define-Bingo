// personali/frontend/js/sala-bingo.js

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const welcomeMessage = document.getElementById('welcome-message');
    const balanceDisplay = document.getElementById('balance-display').querySelector('p:last-child');
    const cartonSelectionGrid = document.getElementById('carton-selection-grid');
    const currentCartonTitle = document.getElementById('current-carton-title');
    const bingoCardContainer = document.getElementById('bingo-card-container');
    const playButton = document.getElementById('play-button');
    const gameInfo = document.getElementById('game-info');

    // --- ESTADO DEL JUEGO ---
    let sessionData = null;
    let currentBalance = 0;
    let selectedCartonId = null;
    let currentCardGrid = []; // Guardará el cartón como una matriz 5x5
    const COSTO_JUGADA = 10.00;
    const PREMIO_LINEA = 50.00;

    // --- INICIALIZACIÓN ---
    const init = () => {
        const sessionJSON = localStorage.getItem('sala_virtual_session');
        if (!sessionJSON) {
            Swal.fire({
                title: 'Acceso Denegado', text: 'No has iniciado sesión en una sala virtual.', icon: 'error',
                confirmButtonText: 'Ir a la página de acceso'
            }).then(() => window.location.href = 'game_access.html');
            return;
        }

        sessionData = JSON.parse(sessionJSON);
        currentBalance = parseFloat(sessionData.monto);

        welcomeMessage.textContent = `¡Bienvenido, ${sessionData.nombre}!`;
        updateBalanceDisplay();
        createCartonSelectors();
    };

    // --- FUNCIONES DE LA INTERFAZ ---
    const updateBalanceDisplay = () => {
        balanceDisplay.textContent = `${currentBalance.toFixed(2)} Bs`;
    };

    const createCartonSelectors = () => {
        cartonSelectionGrid.innerHTML = '';
        for (let i = 1; i <= 15; i++) {
            const button = document.createElement('button');
            button.className = 'carton-selector p-3 bg-gray-800 rounded-lg font-bold border-2 border-transparent hover:border-accent';
            button.textContent = i;
            button.onclick = () => selectCarton(i, button);
            cartonSelectionGrid.appendChild(button);
        }
    };

    const selectCarton = (cartonId, buttonEl) => {
        document.querySelectorAll('.carton-selector').forEach(btn => btn.classList.remove('active'));
        buttonEl.classList.add('active');
        
        selectedCartonId = cartonId;
        currentCardGrid = generateBingoCard(); // Genera y guarda la matriz 5x5
        
        currentCartonTitle.textContent = `Cartón #${cartonId}`;
        bingoCardContainer.innerHTML = '';
        bingoCardContainer.classList.remove('hidden');

        // Renderizar encabezados B-I-N-G-O
        ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
            bingoCardContainer.innerHTML += `<div class="bingo-card-cell text-accent font-black">${letter}</div>`;
        });

        // Renderizar números desde la matriz
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) {
                    bingoCardContainer.innerHTML += `<div class="bingo-card-cell marked">FREE</div>`;
                } else {
                    bingoCardContainer.innerHTML += `<div class="bingo-card-cell">${currentCardGrid[row][col]}</div>`;
                }
            }
        }

        playButton.disabled = currentBalance < COSTO_JUGADA;
    };

    // --- LÓGICA DEL JUEGO DE BINGO ---
    const generateBingoCard = () => {
        const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
        const columns = ranges.map(range => {
            const col = new Set();
            while (col.size < 5) {
                col.add(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
            }
            return Array.from(col);
        });
        // Transponer para tener filas correctas para el renderizado
        return columns[0].map((_, i) => columns.map(row => row[i]));
    };

    const playGame = () => {
        if (currentBalance < COSTO_JUGADA) {
            gameInfo.textContent = "Saldo insuficiente para jugar.";
            return;
        }

        currentBalance -= COSTO_JUGADA;
        updateBalanceDisplay();
        playButton.disabled = true;
        gameInfo.innerHTML = `<span class="text-gray-400">Sorteando números...</span>`;

        // Limpiar marcas previas (excepto el FREE)
        bingoCardContainer.querySelectorAll('.bingo-card-cell').forEach(cell => {
            if (cell.textContent !== 'FREE') cell.classList.remove('marked');
        });

        const drawnNumbers = new Set();
        while (drawnNumbers.size < 40) {
            drawnNumbers.add(Math.floor(Math.random() * 75) + 1);
        }

        // Simular el marcado con un pequeño retraso
        setTimeout(() => {
            let hits = 0;
            const cells = Array.from(bingoCardContainer.children).slice(5); // Ignorar los encabezados
            cells.forEach(cell => {
                const num = parseInt(cell.textContent);
                if (drawnNumbers.has(num)) {
                    cell.classList.add('marked');
                    hits++;
                }
            });

            checkWinConditions();
            playButton.disabled = currentBalance < COSTO_JUGADA;
        }, 500);
    };

    const checkWinConditions = () => {
        const cells = Array.from(bingoCardContainer.children).slice(5);
        const isMarked = (row, col) => cells[row * 5 + col].classList.contains('marked');
        let linesWon = 0;

        // Comprobar filas y columnas
        for (let i = 0; i < 5; i++) {
            if (isMarked(i, 0) && isMarked(i, 1) && isMarked(i, 2) && isMarked(i, 3) && isMarked(i, 4)) linesWon++; // Fila i
            if (isMarked(0, i) && isMarked(1, i) && isMarked(2, i) && isMarked(3, i) && isMarked(4, i)) linesWon++; // Columna i
        }

        // Comprobar diagonales
        if (isMarked(0, 0) && isMarked(1, 1) && isMarked(2, 2) && isMarked(3, 3) && isMarked(4, 4)) linesWon++;
        if (isMarked(0, 4) && isMarked(1, 3) && isMarked(2, 2) && isMarked(3, 1) && isMarked(4, 0)) linesWon++;

        if (linesWon > 0) {
            const prize = linesWon * PREMIO_LINEA;
            currentBalance += prize;
            updateBalanceDisplay();
            gameInfo.innerHTML = `<span class="text-green-400 font-bold">¡Ganaste ${prize.toFixed(2)} Bs! (${linesWon} línea${linesWon > 1 ? 's' : ''})</span>`;
        } else {
            gameInfo.innerHTML = `<span class="text-yellow-500">No hubo suerte. ¡Inténtalo de nuevo!</span>`;
        }
    };
    
    // --- ASIGNACIÓN DE EVENTOS ---
    playButton.addEventListener('click', playGame);

    // --- INICIO ---
    init();
});