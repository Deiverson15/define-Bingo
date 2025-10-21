// resuelto/js/caller-ui.js

const UI = (function() {
    const elementos = {
        tablero: document.getElementById('board-container'),
        numeroActual: document.getElementById('current-number-display'),
        numeroAnterior: document.getElementById('previous-number-display'),
        botonIniciar: document.getElementById('start-button'),
        botonPausar: document.getElementById('pause-button'),
        historial: document.getElementById('history-container'),
        botonHistorial: document.getElementById('history-button'),
        modalHistorial: document.getElementById('history-modal'),
        cerrarModalHistorial: document.getElementById('close-history-button'),
        contenedorHistorial: document.getElementById('history-entries-container')
    };

    // --- PARTE 1: LA VARIABLE MEMORIOSA ---
    let _lastPlayedNumber = null;

    const BINGO_LETTERS = { B: 15, I: 30, N: 45, G: 60, O: 75 };
    const ESTILO_GANADOR = 'bg-gradient-to-br from-emerald-500 to-green-600 text-white scale-110 shadow-lg shadow-emerald-500/50 ring-2 ring-white transform';

    // --- FUNCIÓN PARA REPRODUCIR CUALQUIER MP3 POR RUTA ---
    function playRawAudio(path) {
        try {
            const audio = new Audio(path);
            audio.volume = 1.0; 
            audio.play().catch(error => {
                console.warn(`Error al reproducir audio ${path}: Posible bloqueo de autoplay.`, error.message);
            });
        } catch (error) {
            console.error("Error al inicializar el objeto Audio:", error);
        }
    }

    function lanzarConfeti() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, useWorker: true });
        }
    }

    function mostrarAlertaGanador() {
        if (document.getElementById('winner-alert')) return;
        
        // Obtenemos el patrón para determinar la columna ganadora
        const patronGanador = Sorteo.obtenerPatronGanador();
        // Para las columnas verticales, el número de columna es el primer número del patrón (1-15).
        const columnNumber = patronGanador[0]; 

        // --- REPRODUCCIÓN DEL AUDIO DE GANADOR (ej: GANADOR/9.mp3) ---
        playRawAudio(`/VOZ DE BINGO/GANADOR/${columnNumber}.mp3`);
        
        const overlay = document.createElement('div');
        overlay.id = 'winner-alert';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg p-8 text-center text-white shadow-2xl scale-90 animate-pop-in">
                <h2 class="text-5xl font-black ">¡GANADOR!</h2>
                <p class="mt-2 text-lg">Columna: ${columnNumber}</p>
                <button id="close-alert-btn" class="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 transition-colors shadow-md">Cerrar</button>
            </div>
            <style>
                @keyframes pop-in { to { transform: scale(1); } }
                .animate-pop-in { animation: pop-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
            </style>
        `;
        document.body.appendChild(overlay);
        document.getElementById('close-alert-btn').addEventListener('click', () => overlay.remove());
    }

    function getLetterForNumber(number) {
        if (!number) return '';
        for (const letter in BINGO_LETTERS) {
            if (number <= BINGO_LETTERS[letter]) return letter;
        }
        return '';
    }

    // --- FUNCIÓN LOCUTORA (PARA BOLAS INDIVIDUALES) ---
    function playBingoAudio(number) {
        if (!number) return;
        const letter = getLetterForNumber(number);
        const audioPath = `/VOZ DE BINGO/${letter}/${letter}${number}.mp3`;
        
        try {
            const audio = new Audio(audioPath);
            audio.volume = 1.0; 
            audio.play().catch(error => {
                console.warn(`No se pudo reproducir el audio para ${letter}${number}. Puede que el navegador lo haya bloqueado.`, error.message);
            });
        } catch (error) {
            console.error("Error al inicializar el objeto Audio:", error);
        }
    }
    // --- FIN FUNCIÓN LOCUTORA ---


    function _originalCrearTablero() {
        elementos.tablero.innerHTML = '';
        const letters = Object.keys(BINGO_LETTERS);
        const letterColors = ['letter-B', 'letter-I', 'letter-N', 'letter-G', 'letter-O']; 
        let number = 1;

        letters.forEach((letter, i) => {
            const letterCell = document.createElement('div');
            letterCell.className = `letter-cell font-bold ${letterColors[i]} text-white`;
            letterCell.textContent = letter;
            elementos.tablero.appendChild(letterCell);

            for (let j = 0; j < 15; j++) {
                const ball = document.createElement('div');
                ball.className = 'ball';
                ball.id = `ball-${number}`;
                ball.textContent = number;
                elementos.tablero.appendChild(ball);
                number++;
            }
        });
    }

    function actualizar(estado) {
        const letraActual = getLetterForNumber(estado.ultimoSorteado);
        const letraAnterior = getLetterForNumber(estado.anteriorSorteado);
        
        // --- INTERRUPTOR DE SONIDO ---
        if (estado.ultimoSorteado && estado.ultimoSorteado !== _lastPlayedNumber) {
            playBingoAudio(estado.ultimoSorteado);      
            _lastPlayedNumber = estado.ultimoSorteado;  
        }
        // --- FIN INTERRUPTOR DE SONIDO ---

        elementos.numeroActual.innerHTML = estado.ultimoSorteado ? `<span class="text-6xl text-purple-300">${letraActual}</span> <span class="text-white">${estado.ultimoSorteado}</span>` : '-';
        elementos.numeroAnterior.innerHTML = estado.anteriorSorteado ? `<span class="text-6xl text-purple-400">${letraAnterior}</span> <span class="text-indigo-200">${estado.anteriorSorteado}</span>` : '-';
        
        if (estado.ultimoSorteado) {
            elementos.numeroActual.classList.add('number-pop');
            setTimeout(() => elementos.numeroActual.classList.remove('number-pop'), 400);
        }

        for (let i = 1; i <= estado.totalNumeros; i++) {
            const ball = document.getElementById(`ball-${i}`);
            if (ball) {
                ball.className = 'ball'; 
                if (estado.numerosSorteados.includes(i)) {
                    ball.classList.add('ball-drawn');
                }
            }
        }

        if (estado.sorteoFinalizado && estado.tipoGanador === 'vertical') {
            const patronGanador = Sorteo.obtenerPatronGanador();
            
            if (patronGanador) {
                patronGanador.forEach(num => {
                    const ball = document.getElementById(`ball-${num}`);
                    if (ball) {
                        ball.classList.remove('ball-drawn'); 
                        ESTILO_GANADOR.split(' ').forEach(cls => ball.classList.add(cls));
                    }
                });
            }
            
            mostrarAlertaGanador();
            lanzarConfeti();
        }
    }

    function renderizarHistorial(historial) {
        elementos.contenedorHistorial.innerHTML = ''; 

        if (!historial || historial.length === 0) {
            elementos.contenedorHistorial.innerHTML = '<p class="text-gray-400 text-center py-4">No hay sorteos en el historial.</p>';
            return;
        }

        historial.forEach(entrada => {
            const fecha = new Date(entrada.fecha);
            const fechaFormateada = fecha.toLocaleString('es-VE', { 
                dateStyle: 'long', 
                timeStyle: 'short' 
            });

            const botonPendiente = `
                <button data-id="${entrada.id}" class="status-btn bg-amber-500 hover:bg-amber-400 text-black font-bold py-1 px-3 rounded text-sm transition-colors shadow-sm">
                    Pendiente
                </button>`;
            const botonVerificado = `
                <button class="bg-emerald-500 text-white font-bold py-1 px-3 rounded text-sm cursor-not-allowed opacity-75 shadow-sm">
                    Verificado
                </button>`;

            const entradaHtml = `
                <div class="glass-card p-3 rounded-lg mb-3 flex justify-between items-center text-white">
                    <div>
                        <p class="font-bold text-lg">${fechaFormateada}</p>
                        <p class="text-sm text-gray-300">Patrón: Línea vertical</p>
                        <p class="text-xs text-gray-400">Números: ${entrada.numeros_sorteados}</p>
                    </div>
                    <div>
                        ${entrada.estado === 'pendiente' ? botonPendiente : botonVerificado}
                    </div>
                </div>
            `;
            elementos.contenedorHistorial.innerHTML += entradaHtml;
        });
    }

    return { 
        crearTablero: _originalCrearTablero, 
        actualizar, 
        renderizarHistorial, 
        playRawAudio, // Exportamos para que caller-main.js pueda usarlo.
        elementos 
    };
})();