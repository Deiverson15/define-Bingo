// /frontend/js/admin-sorteo.js - CORREGIDO Y ACTUALIZADO

document.addEventListener('DOMContentLoaded', () => {
    const seccionSorteo = document.getElementById('section-sorteo');
    if (!seccionSorteo) return;

    const user = Auth.getUser();
    const API_URL = `${API_BASE_URL}/api/admin/sorteos`;
    const socket = io(SOCKET_URL);

    // --- MÓDULO DE UI (Manejo de la Interfaz) ---
    const UI = (() => {
        const elementos = {
            tablero: document.getElementById('sorteo-board-container'),
            numeroActual: document.getElementById('sorteo-current-number'),
            numeroAnterior: document.getElementById('sorteo-previous-number'),
            contenedorGanador: document.getElementById('sorteo-winner-container'),
            historial: document.getElementById('sorteo-history-list'),
            btnRefrescarHistorial: document.getElementById('sorteo-refresh-history'),
            btnPausar: document.getElementById('sorteo-pause-button'),
        };
        const ESTILO_GANADOR = 'bg-emerald-400 text-black scale-110 shadow-lg';
        const BINGO_LETTERS = { B: 15, I: 30, N: 45, G: 60, O: 75 };

        function getLetterForNumber(n) { if (!n) return ''; for (const l in BINGO_LETTERS) { if (n <= BINGO_LETTERS[l]) return l; } return ''; }
        
        function crearTablero() {
            if (!elementos.tablero) return;
            elementos.tablero.innerHTML = '';
            let num = 1;
            Object.keys(BINGO_LETTERS).forEach((letter, i) => {
                const letterCell = document.createElement('div');
                letterCell.className = `letter-cell font-bold ${['bg-blue-600', 'bg-red-600', 'bg-purple-600', 'bg-orange-600', 'bg-teal-600'][i]}`;
                letterCell.textContent = letter;
                elementos.tablero.appendChild(letterCell);
                for (let j = 0; j < 15; j++) {
                    const ball = document.createElement('div');
                    ball.className = 'ball text-gray-400';
                    ball.id = `sorteo-ball-${num}`;
                    ball.textContent = num++;
                    elementos.tablero.appendChild(ball);
                }
            });
        }

        function actualizar(estado) {
            if (!elementos.numeroActual) return;
            elementos.numeroActual.innerHTML = estado.ultimoSorteado ? `<span class="text-4xl">${getLetterForNumber(estado.ultimoSorteado)}</span> ${estado.ultimoSorteado}` : '-';
            elementos.numeroAnterior.innerHTML = estado.anteriorSorteado ? `<span class="text-4xl">${getLetterForNumber(estado.anteriorSorteado)}</span> ${estado.anteriorSorteado}` : '-';
            
            for (let i = 1; i <= 75; i++) {
                const ball = document.getElementById(`sorteo-ball-${i}`);
                if (ball) {
                    ball.className = 'ball text-gray-400';
                    if (estado.numerosSorteados && estado.numerosSorteados.includes(i)) {
                        ball.classList.add('ball-drawn');
                    }
                }
            }
            
            elementos.btnPausar.disabled = estado.sorteoFinalizado;
            elementos.btnPausar.textContent = estado.isRunning ? "Pausar" : "Reanudar";

            if (estado.sorteoFinalizado && estado.patronGanador) {
                estado.patronGanador.forEach(num => document.getElementById(`sorteo-ball-${num}`)?.classList.add(...ESTILO_GANADOR.split(' ')));
                elementos.contenedorGanador.innerHTML = `<h3 class="font-bold text-xl text-emerald-300">¡Ganador: Línea ${estado.patronGanador.join(', ')}!</h3>`;
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            } else {
                elementos.contenedorGanador.innerHTML = '';
            }
        }
        
        async function cargarHistorial() {
            if (!elementos.historial) return;
            try {
                elementos.historial.innerHTML = '<p class="text-sm text-[#9fb2b0]">Cargando historial...</p>';
                const response = await fetch(API_URL);
                if (!response.ok) throw new Error('Error de red al cargar historial.');
                const sorteos = await response.json();
                
                elementos.historial.innerHTML = '';
                if (sorteos.length === 0) {
                    elementos.historial.innerHTML = '<p class="text-sm text-[#9fb2b0]">No hay sorteos previos.</p>';
                    return;
                }
                
                sorteos.forEach(s => agregarEntradaAlHistorial(s, false));
            } catch (error) {
                elementos.historial.innerHTML = `<p class="text-sm text-red-400">${error.message}</p>`;
            }
        }

        function agregarEntradaAlHistorial(sorteo, alPrincipio = true) {
            const noSorteosMsg = elementos.historial.querySelector('p');
            if (noSorteosMsg) noSorteosMsg.remove();
            
            const item = document.createElement('div');
            item.className = 'bg-[#0c1528] p-2 rounded-lg text-sm';
            item.innerHTML = `<p class="font-bold">Ganador: <span class="text-yellow-400">${sorteo.patron_ganador}</span></p><p class="text-xs text-gray-400">${new Date(sorteo.fecha).toLocaleString('es-VE')}</p>`;
            
            if (alPrincipio) elementos.historial.prepend(item);
            else elementos.historial.appendChild(item);
        }

        elementos.btnRefrescarHistorial.addEventListener('click', cargarHistorial);
        return { crearTablero, actualizar, cargarHistorial, agregarEntradaAlHistorial };
    })();

    // --- CONTROLADOR Y LÓGICA DE WEBSOCKETS ---
    const btnIniciar = document.getElementById('sorteo-start-button');
    const btnPausar = document.getElementById('sorteo-pause-button');
    
    let ultimoGanadorGuardado = null;
    
    btnIniciar.addEventListener('click', () => {
        ultimoGanadorGuardado = null; 
        socket.emit('admin_sorteo_start');
    });

    btnPausar.addEventListener('click', () => {
        socket.emit('admin_sorteo_pause_resume');
    });

    socket.on('admin_sorteo_update', (estado) => {
        UI.actualizar(estado);
        if (estado.sorteoFinalizado && estado.patronGanador) {
            guardarSorteoSiNoExiste(estado);
        }
    });

    socket.on('admin_sorteo_history_update', (nuevoSorteo) => {
        UI.agregarEntradaAlHistorial(nuevoSorteo);
    });
    
    async function guardarSorteoSiNoExiste(estado) {
        const idGanador = estado.patronGanador.join(',');
        if (ultimoGanadorGuardado === idGanador) return;
        
        ultimoGanadorGuardado = idGanador;
        
        const datos = {
            patron_ganador: estado.patronGanador.join(', '),
            numeros_sorteados: estado.numerosSorteados.join(', '),
            realizado_por: user.username,
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error del servidor al guardar sorteo.');
            }
            console.log("✅ Sorteo guardado. El historial se actualizará por WebSocket.");
        } catch (error) {
            console.error("❌ Error al guardar el sorteo:", error);
            Swal.fire('Error', `No se pudo guardar el sorteo: ${error.message}`, 'error');
        }
    }

    // --- INICIALIZACIÓN ---
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'sorteo') {
            UI.cargarHistorial();
            // Solicitar el estado actual del sorteo al cambiar a la pestaña
            socket.emit('admin_request_sorteo_state'); 
        }
    });

    UI.crearTablero();
    // Carga inicial si la pestaña es visible por defecto
    if(seccionSorteo && !seccionSorteo.classList.contains('hidden')) {
        UI.cargarHistorial();
        socket.emit('admin_request_sorteo_state');
    }
});