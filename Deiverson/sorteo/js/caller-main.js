// sorteo/js/caller-main.js

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

    // --- NUEVAS FUNCIONES DE CONTROL DE INTERVALO ---
    
    function detenerIntervalo() {
        clearInterval(sorteoInterval);
        sorteoInterval = null;
    }
    
    // Función que se llama como callback al terminar el audio de Bienvenida
    function comenzarIntervaloDeSorteo() {
        detenerIntervalo(); // Asegura que no haya dos corriendo
        sorteoInterval = setInterval(cicloDeSorteo, SORTEO_SPEED_MS);
        isPaused = false;
        UI.elementos.botonPausar.disabled = false;
        UI.elementos.botonPausar.textContent = "Pausar";
        console.log("¡Sorteo automático iniciado después de la bienvenida!");
    }


    function cicloDeSorteo() {
        Sorteo.sortearSiguiente();
        const estadoActual = Sorteo.obtenerEstado();
        UI.actualizar(estadoActual);

        if (estadoActual.sorteoFinalizado && estadoActual.tipoGanador) {
            detenerIntervalo(); // SOLO DETENEMOS EL SORTEO. No el audio.
            UI.elementos.botonPausar.disabled = true;
            UI.elementos.botonPausar.textContent = "Pausar";

            // --- REPRODUCCIÓN DEL AUDIO DE DESPEDIDA ENCOLADO ---
            // Este audio se encola y se reproducirá DESPUÉS del audio del ganador.
            UI.AudioPlayer.queueAndPlay('/VOZ DE BINGO/GRACIAS POR PARTICIPAR.mp3');

            // Prepara los datos para enviar a la API
            const nuevaEntrada = {
                patron_ganador: estadoActual.patronGanador.join(', '),
                numeros_sorteados: estadoActual.numerosSorteados.join(', '),
            };
            guardarSorteoEnAPI(nuevaEntrada);
        }
    }

    function iniciarSorteo() {
        detenerIntervalo(); 
        UI.AudioPlayer.stopAndClear(); // Limpiamos audio antes de empezar
        Sorteo.iniciar();
        UI.crearTablero();
        
        // 1. Encolamos la Bienvenida. El callback inicia el sorteo automático.
        UI.AudioPlayer.queueAndPlay('/VOZ DE BINGO/BIENVENIDO .mp3', comenzarIntervaloDeSorteo);

        // 2. La UI se actualiza para mostrar el estado inicial.
        UI.actualizar(Sorteo.obtenerEstado());
    }

    function pausarReanudarSorteo() {
        if (isPaused) {
            comenzarIntervaloDeSorteo();
        } else {
            detenerIntervalo();
            UI.elementos.botonPausar.textContent = "Reanudar";
            isPaused = true;
        }
    }

    function detenerSorteo() {
        detenerIntervalo();
        UI.AudioPlayer.stopAndClear(); 
        isPaused = false;
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