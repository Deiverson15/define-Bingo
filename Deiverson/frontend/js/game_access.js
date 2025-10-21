// personali/frontend/js/game_access.js
document.addEventListener('DOMContentLoaded', () => {
    const salasListContainer = document.getElementById('salas-list-container');

    const fetchSalas = async () => {
        try {
            // Llama a la nueva ruta pública para obtener solo las salas activas
            const response = await fetch(`${API_BASE_URL}/api/salas`);
            if (!response.ok) throw new Error('No se pudieron cargar las salas activas.');
            
            const salas = await response.json();
            renderSalas(salas);
        } catch (error) {
            salasListContainer.innerHTML = `<p class="text-center text-red-500">${error.message}</p>`;
        }
    };

    const renderSalas = (salas) => {
        if (salas.length === 0) {
            salasListContainer.innerHTML = `<p class="text-center text-gray-400">No hay salas activas en este momento.</p>`;
            return;
        }
        // Crea un botón por cada sala activa encontrada
        salasListContainer.innerHTML = salas.map(sala => `
            <button onclick="promptForCode(${sala.id}, '${sala.nombre_sala}')" class="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <span class="text-lg font-bold text-white">${sala.nombre_sala}</span>
            </button>
        `).join('');
    };

    // Función que se dispara al hacer clic en una sala
    window.promptForCode = async (salaId, nombreSala) => {
        const { value: codigo } = await Swal.fire({
            title: `Ingresar a "${nombreSala}"`,
            input: 'text',
            inputLabel: 'Introduce tu código de acceso personal',
            inputPlaceholder: 'CÓDIGO DE 6 DÍGITOS',
            inputAttributes: {
                maxlength: 6,
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Entrar',
        });

        if (codigo) {
            try {
                Swal.fire({ title: 'Verificando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                // Llama al endpoint de login con el código
                const response = await fetch(`${API_BASE_URL}/api/salas/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codigo })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                // Guarda los datos del jugador en el almacenamiento local
                localStorage.setItem('sala_virtual_session', JSON.stringify(result.jugador));
                
                // Muestra la bienvenida profesional
                Swal.fire({
                    icon: 'success',
                    title: `¡Bienvenido, ${result.jugador.nombre}!`,
                    html: `
                        <div class="text-left space-y-2">
                            <p><strong>Estado:</strong> <span class="text-green-400 font-semibold">Activo</span></p>
                            <p><strong>Saldo Inicial:</strong> <span class="text-yellow-400 font-bold text-lg">${parseFloat(result.jugador.monto).toFixed(2)} Bs</span></p>
                        </div>
                        <p class="mt-4 text-sm text-gray-400">Serás redirigido al juego en breve...</p>
                    `,
                    timer: 3000,
                    showConfirmButton: false,
                    willClose: () => {
                        // Redirige a la nueva página del juego de bingo de la sala
                        window.location.href = 'sala-bingo.html';
                    }
                });

            } catch (error) {
                Swal.fire('Acceso Denegado', error.message, 'error');
            }
        }
    };

    // Carga inicial de las salas al entrar en la página
    fetchSalas();
});