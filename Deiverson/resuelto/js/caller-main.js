// resuelto/js/caller-main.js

document.addEventListener('DOMContentLoaded', () => {
    let sorteoInterval = null;
    let isPaused = false;
    const SORTEO_SPEED_MS = 1500; 
    const API_URL = '/api/admin/sorteos'; // URL centralizada para la API

    // --- LÓGICA DE API (Reemplaza localStorage) ---
    async function obtenerHistorialDesdeAPI() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            return await response.json();
        } catch (error) {
            console.error("Error al obtener historial:", error);
            return []; // Devuelve un array vacío en caso de error
        }
    }

    async function guardarSorteoEnAPI(sorteoGanador) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sorteoGanador)
            });
            if (!response.ok) throw new Error('No se pudo guardar el sorteo.');
            console.log('Sorteo guardado en la base de datos con éxito.');
        } catch (error) {
            console.error("Error al guardar sorteo:", error);
        }
    }
    
    async function actualizarEstadoEnAPI(id, nuevoEstado) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            if (!response.ok) throw new Error('No se pudo actualizar el estado.');
            return true;
        } catch (error) {
            console.error("Error al actualizar estado:", error);
            return false;
        }
    }

    function cicloDeSorteo() {
        Sorteo.sortearSiguiente();
        const estadoActual = Sorteo.obtenerEstado();
        UI.actualizar(estadoActual);

        if (estadoActual.sorteoFinalizado && estadoActual.tipoGanador) {
            detenerSorteo();
            UI.elementos.botonPausar.disabled = true;
            UI.elementos.botonPausar.textContent = "Pausar";

            // --- REPRODUCCIÓN DEL AUDIO DE DESPEDIDA ---
            UI.playRawAudio('/VOZ DE BINGO/GRACIAS POR PARTICIPAR.mp3');

            // Prepara los datos para enviar a la API
            const nuevaEntrada = {
                patron_ganador: estadoActual.patronGanador.join(', '),
                numeros_sorteados: estadoActual.numerosSorteados.join(', '),
            };
            guardarSorteoEnAPI(nuevaEntrada);
        }
    }

    function iniciarSorteo() {
        detenerSorteo(); 
        Sorteo.iniciar();
        const estadoInicial = Sorteo.obtenerEstado();
        UI.crearTablero();
        
        // --- REPRODUCCIÓN DEL AUDIO DE BIENVENIDA ---
        UI.playRawAudio('/VOZ DE BINGO/BIENVENIDO .mp3');

        UI.actualizar(estadoInicial);
        
        sorteoInterval = setInterval(cicloDeSorteo, SORTEO_SPEED_MS);
        isPaused = false;
        
        UI.elementos.botonPausar.disabled = false;
        UI.elementos.botonPausar.textContent = "Pausar";
    }

    function pausarReanudarSorteo() {
        if (isPaused) {
            sorteoInterval = setInterval(cicloDeSorteo, SORTEO_SPEED_MS);
            UI.elementos.botonPausar.textContent = "Pausar";
            isPaused = false;
        } else {
            clearInterval(sorteoInterval);
            UI.elementos.botonPausar.textContent = "Reanudar";
            isPaused = true;
        }
    }

    function detenerSorteo() {
        clearInterval(sorteoInterval);
        sorteoInterval = null;
    }

    // --- Configuración Inicial y Eventos ---
    UI.crearTablero();
    UI.actualizar(Sorteo.obtenerEstado());

    UI.elementos.botonIniciar.addEventListener('click', iniciarSorteo);
    UI.elementos.botonPausar.addEventListener('click', pausarReanudarSorteo);

    // --- Eventos del Modal de Historial ---
    UI.elementos.botonHistorial.addEventListener('click', async () => {
        const historial = await obtenerHistorialDesdeAPI();
        UI.renderizarHistorial(historial);
        UI.elementos.modalHistorial.classList.remove('hidden');
    });

    UI.elementos.cerrarModalHistorial.addEventListener('click', () => {
        UI.elementos.modalHistorial.classList.add('hidden');
    });

    UI.elementos.contenedorHistorial.addEventListener('click', async function(e) {
        if (e.target.matches('.status-btn')) {
            const entradaId = parseInt(e.target.dataset.id, 10);
            const success = await actualizarEstadoEnAPI(entradaId, 'verificado');
            
            if (success) {
                // Si la actualización fue exitosa, vuelve a cargar y renderizar el historial
                const historialActualizado = await obtenerHistorialDesdeAPI();
                UI.renderizarHistorial(historialActualizado);
            }
        }
    });
});