// personali/frontend/js/resultados.js

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const gameSelectionView = document.getElementById('game-selection-view');
    const resultsView = document.getElementById('results-view');
    const showColumnaResultsBtn = document.getElementById('show-columna-results');
    const backToSelectionBtn = document.getElementById('back-to-selection');
    const pageTitle = document.getElementById('page-title');
    const resultsContainer = document.getElementById('results-container');
    
    // MODIFICACIÓN: Usando la variable global SOCKET_URL
    const socket = io(SOCKET_URL); 

    // --- LÓGICA DE NAVEGACIÓN (SIMPLIFICADA Y ROBUSTA) ---
    const showResults = () => {
        pageTitle.innerHTML = `Resultados: <span class="text-yellow-400">Columna Ganadora</span>`;
        gameSelectionView.classList.add('hidden');
        resultsView.classList.remove('hidden');
        loadGameResults(); // Llama a la carga de resultados
    };

    const showSelection = () => {
        pageTitle.innerHTML = 'Resultados';
        resultsView.classList.add('hidden');
        gameSelectionView.classList.remove('hidden');
        // Al volver, SIEMPRE vaciamos el contenedor para asegurar que se recarguen la próxima vez.
        resultsContainer.innerHTML = ''; 
    };

    // --- ASIGNACIÓN DE EVENTOS ---
    if (showColumnaResultsBtn) { 
        showColumnaResultsBtn.addEventListener('click', showResults);
    }
    backToSelectionBtn.addEventListener('click', showSelection);

    // --- LÓGICA DE SOCKET.IO ---
    socket.on('connect', () => {
        console.log('✅ Página de Resultados conectada a Socket.IO.');
    });

    socket.on('new_result_added', (newResult) => {
        console.log('📢 Nuevo resultado recibido en tiempo real:', newResult);
        if (!resultsView.classList.contains('hidden')) {
            const noResultsMessage = document.getElementById('no-results-message');
            if (noResultsMessage) noResultsMessage.remove();
            
            // Re-renderizar para incluir el nuevo encabezado si es de un día nuevo
            loadGameResults(); 
        }
    });


    socket.on('result_unpublished', (data) => {
        console.log('📢 Resultado despublicado recibido:', data);
        const cardToRemove = document.querySelector(`.result-card[data-id='${data.id}']`);
        if (cardToRemove) {
            cardToRemove.remove();
            // Opcional: Re-renderizar si es importante mantener la agrupación de fechas tras eliminar un resultado
            // loadGameResults();
        }
    });


// --- FUNCIONES PARA OBTENER Y MOSTRAR DATOS ---
async function loadGameResults() {
    const resultsContainer = document.getElementById('results-container');
    
    resultsContainer.innerHTML = `
        <div class="col-span-full text-center py-20">
            <svg class="animate-spin h-10 w-10 text-yellow-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-300 text-lg">Cargando resultados...</p>
        </div>`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/results`);
        if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
        
        const results = await response.json();
        resultsContainer.innerHTML = ''; 

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div id="no-results-message" class="col-span-full text-center py-20">
                    <h3 class="text-2xl font-bold text-gray-300">Aún no hay resultados</h3>
                    <p class="text-gray-400 mt-2">Los sorteos finalizados aparecerán aquí.</p>
                </div>`;
            return;
        }
        
        // ** NUEVA LÓGICA DE AGRUPACIÓN POR DÍA **
        let lastDate = null;
        const dateFormatter = new Intl.DateTimeFormat('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        results.forEach((game, index) => {
            const gameDate = new Date(game.created_at);
            const currentDate = gameDate.toLocaleDateString('es-VE'); // Solo la fecha (e.g., '16/10/2025')

            if (currentDate !== lastDate) {
                // Crear y agregar el encabezado de la nueva fecha
                const dateHeader = document.createElement('div');
                dateHeader.className = 'col-span-full mt-6 mb-3 border-b border-gray-600/50 pb-2';
                dateHeader.innerHTML = `<h3 class="text-xl font-bold text-gray-200">${dateFormatter.format(gameDate)}</h3>`;
                resultsContainer.appendChild(dateHeader);
                lastDate = currentDate;
            }

            const card = createResultCard(game, index);
            resultsContainer.appendChild(card);
        });
        // ** FIN NUEVA LÓGICA **

    } catch (error) {
        resultsContainer.innerHTML = `<div class="col-span-full text-center py-20 text-red-400">Error al cargar: ${error.message}</div>`;
        console.error("Detalle del error:", error);
    }
}

function formatDate(dateString) {
    // Solo muestra la hora para no duplicar la información del encabezado del día
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(dateString).toLocaleTimeString('es-VE', options);
}

function createResultCard(game, delayIndex = 0) {
    const card = document.createElement('div');
    card.dataset.id = game.id; 
    
    // Las tarjetas ahora están envueltas en un div de fecha, por lo que la animación debe ser ligera.
    card.className = 'result-card card-style bg-gray-800/60 rounded-xl flex flex-col items-center justify-center text-center p-4 w-48 h-56'; 
    card.style.animationDelay = `${delayIndex * 100}ms`;
    card.classList.add('fade-in-card');

    const columnNumber = parseInt(game.winner);
    // (columna - 1) % 15 + 1 asegura que el número de clase de color sea entre 1 y 15
    const ballColorClass = `ball-${(columnNumber - 1) % 15 + 1}`; 
    
    card.innerHTML = `
        <p class="font-semibold text-xs text-gray-300">${formatDate(game.created_at)}</p>
        <div class="my-3 flex flex-col items-center">
            <p class="text-sm font-bold text-yellow-400 uppercase">COLUMNA GANADORA</p>
            <div class="winner-ball ${ballColorClass} font-black text-6xl rounded-full w-24 h-24 flex items-center justify-center mt-1 transform hover:scale-105 transition-transform duration-300">
                ${game.winner}
            </div>
        </div>
        <p class="font-mono text-xs text-gray-200">Partida # ${game.id_partida}</p>
    `;
    return card;
}
});