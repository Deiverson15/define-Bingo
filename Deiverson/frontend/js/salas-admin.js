// personali/frontend/js/salas-admin.js

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const createSalaForm = document.getElementById('create-sala-form');
    const salasContainer = document.getElementById('salas-container');
    const user = Auth.getUser();

    // Redirige si no es un admin logueado
    if (!user || !Auth.isAdmin()) {
        window.location.href = 'admin.html';
        return;
    }

    // --- FUNCIÓN PRINCIPAL PARA RENDERIZAR TODO ---
    const fetchAndRenderAll = async () => {
        try {
            salasContainer.innerHTML = `<p class="text-center text-gray-400">Cargando salas...</p>`;
            const response = await fetch(`${API_BASE_URL}/api/admin/salas`);
            const salas = await response.json();

            if (salas.length === 0) {
                salasContainer.innerHTML = `<p class="text-center text-gray-400">No hay salas creadas. ¡Crea una para empezar!</p>`;
                return;
            }

            salasContainer.innerHTML = ''; // Limpiar antes de renderizar
            for (const sala of salas) {
                const salaElement = document.createElement('div');
                salaElement.className = 'bg-[#0f172a] p-4 rounded-lg border border-gray-800';
                
                const isActive = sala.activa === true;
                const statusClass = isActive ? 'text-green-400' : 'text-red-400';
                const statusIcon = isActive ? 'power' : 'power-off';
                const statusText = isActive ? 'Desactivar Sala' : 'Activar Sala';

                salaElement.innerHTML = `
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <div>
                            <h3 class="text-xl font-bold text-white">${sala.nombre_sala}</h3>
                            <span class="text-xs font-mono text-gray-500">ID: ${sala.id}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="actions.addJugador(${sala.id},'${sala.nombre_sala}')" class="btn btn-accent flex items-center gap-2"><i data-lucide="user-plus" class="w-4 h-4"></i> Añadir Jugador</button>
                            <button onclick="actions.toggleStatus(${sala.id})" class="btn btn-neutral flex items-center gap-2" title="${statusText}"><i data-lucide="${statusIcon}" class="w-4 h-4 ${statusClass}"></i></button>
                            <button onclick="actions.deleteSala(${sala.id})" class="btn btn-danger flex items-center gap-2" title="Eliminar Sala"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                    <div id="jugadores-sala-${sala.id}" class="mt-4"></div>
                `;
                salasContainer.appendChild(salaElement);
                await renderJugadores(sala.id); // Cargar los jugadores de esta sala
            }
            lucide.createIcons();

        } catch (error) {
            salasContainer.innerHTML = `<p class="text-center text-red-500">Error al cargar las salas.</p>`;
        }
    };

    const renderJugadores = async (salaId) => {
        const jugadoresContainer = document.getElementById(`jugadores-sala-${salaId}`);
        try {
            jugadoresContainer.innerHTML = `<p class="text-sm text-gray-500">Cargando jugadores...</p>`;
            const response = await fetch(`${API_BASE_URL}/api/admin/salas/${salaId}/jugadores`);
            const jugadores = await response.json();

            if (jugadores.length === 0) {
                jugadoresContainer.innerHTML = `<p class="text-sm text-center text-gray-500 italic mt-2">Aún no hay jugadores en esta sala.</p>`;
                return;
            }

            jugadoresContainer.innerHTML = `
                <table class="w-full text-sm">
                    <thead class="border-b border-gray-700 text-gray-400">
                        <tr>
                            <th class="p-2 text-left">Código</th>
                            <th class="p-2 text-left">Jugador</th>
                            <th class="p-2 text-left">Monto</th>
                            <th class="p-2 text-center">Estado</th>
                            <th class="p-2 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${jugadores.map(j => {
                            const isActive = j.status === 'activo';
                            return `
                                <tr class="border-b border-gray-800 last:border-b-0">
                                    <td class="p-2 font-mono text-yellow-400">${j.codigo}</td>
                                    <td class="p-2">${j.nombre_jugador}</td>
                                    <td class="p-2">${parseFloat(j.monto).toFixed(2)} Bs</td>
                                    <td class="p-2 text-center">
                                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                                            ${j.status}
                                        </span>
                                    </td>
                                    <td class="p-2 text-center">
                                        <button onclick="actions.openJugadorMenu(${j.id}, '${j.nombre_jugador}', ${j.sala_id}, ${isActive})" class="btn btn-neutral py-1 px-2 text-xs">Menú</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            jugadoresContainer.innerHTML = `<p class="text-sm text-red-500">Error al cargar jugadores.</p>`;
        }
    };

    // --- LÓGICA DE ACCIONES (GLOBAL) ---
    window.actions = {
        // --- ACCIONES DE SALA ---
        addJugador: async (salaId, nombreSala) => {
             const { value: formValues } = await Swal.fire({
                title: `Añadir Jugador a "${nombreSala}"`,
                html: `<input id="swal-nombre" class="swal2-input" placeholder="Nombre del Jugador"><input id="swal-monto" type="number" class="swal2-input" placeholder="Monto en Bs">`,
                focusConfirm: false,
                preConfirm: () => ({ nombre_jugador: document.getElementById('swal-nombre').value, monto: document.getElementById('swal-monto').value })
            });

            if (formValues && formValues.nombre_jugador && formValues.monto > 0) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/salas/jugadores`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sala_id: salaId, nombre_jugador: formValues.nombre_jugador, monto: formValues.monto, created_by: user.username })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message);
                    Swal.fire({ title: '¡Código Generado!', html: `Código para <strong>${result.jugador.nombre_jugador}</strong>:<br><div class="my-4 p-3 bg-gray-900 rounded-lg text-yellow-400 text-4xl font-mono">${result.jugador.codigo}</div>`, icon: 'success' });
                    renderJugadores(salaId);
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        },
        toggleStatus: async (salaId) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/salas/${salaId}/toggle`, { method: 'PATCH' });
                if (!response.ok) throw new Error((await response.json()).message);
                fetchAndRenderAll();
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        },
        deleteSala: (salaId) => {
            Swal.fire({ title: '¿Eliminar esta Sala?', text: "Se borrarán todos los jugadores dentro. Esta acción es irreversible.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, ¡eliminar!', confirmButtonColor: '#ef4444' })
               .then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/admin/salas/${salaId}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error((await response.json()).message);
                        Swal.fire('Eliminada', 'La sala y sus jugadores han sido eliminados.', 'success');
                        fetchAndRenderAll();
                    } catch (error) { Swal.fire('Error', error.message, 'error'); }
                }
            });
        },
        
        // --- ACCIONES DE JUGADOR ---
        openJugadorMenu: (jugadorId, nombreJugador, salaId, isActive) => {
            const statusText = isActive ? 'Desactivar Jugador' : 'Activar Jugador';
            Swal.fire({
                title: `Acciones para ${nombreJugador}`,
                html: `
                    <div class="flex flex-col gap-2 mt-4">
                        <button id="swal-adjust" class="swal2-confirm swal2-styled">Aumentar/Disminuir Crédito</button>
                        <button id="swal-edit" class="swal2-cancel swal2-styled" style="background-color: #3b82f6; color: white;">Modificar Nombre</button>
                        <button id="swal-toggle" class="swal2-confirm swal2-styled" style="background-color: #f59e0b;">${statusText}</button>
                        <button id="swal-delete" class="swal2-deny swal2-styled">Eliminar Jugador</button>
                    </div>`,
                showConfirmButton: false,
                showCancelButton: false,
                showDenyButton: false,
            });
            document.getElementById('swal-adjust').onclick = () => actions.adjustCredits(jugadorId, salaId);
            document.getElementById('swal-edit').onclick = () => actions.editJugador(jugadorId, salaId);
            document.getElementById('swal-toggle').onclick = () => actions.toggleJugadorStatus(jugadorId, salaId);
            document.getElementById('swal-delete').onclick = () => actions.deleteJugador(jugadorId, salaId);
        },
        adjustCredits: async (jugadorId, salaId) => {
            await Swal.close();
            const { value: amount } = await Swal.fire({
                title: 'Ajustar Créditos',
                input: 'number',
                inputLabel: 'Monto a agregar (positivo) o restar (negativo)',
                inputPlaceholder: 'Ej: 100 o -50',
                showCancelButton: true
            });
            if (amount) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/jugadores/${jugadorId}/credits`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: parseFloat(amount) })
                    });
                    if (!response.ok) throw new Error((await response.json()).message);
                    Swal.fire('¡Éxito!', 'Créditos actualizados.', 'success');
                    renderJugadores(salaId);
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        },
        editJugador: async (jugadorId, salaId) => {
            await Swal.close();
            const { value: newName } = await Swal.fire({
                title: 'Modificar Nombre del Jugador',
                input: 'text',
                inputLabel: 'Nuevo nombre',
                showCancelButton: true,
                inputValidator: (value) => !value && '¡Necesitas escribir un nombre!'
            });
            if (newName) {
                 try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/jugadores/${jugadorId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nombre_jugador: newName })
                    });
                    if (!response.ok) throw new Error((await response.json()).message);
                    Swal.fire('¡Guardado!', 'El nombre del jugador se actualizó.', 'success');
                    renderJugadores(salaId);
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        },
        deleteJugador: (jugadorId, salaId) => {
            Swal.close();
            Swal.fire({
                title: '¿Eliminar este Jugador?', text: "Esta acción es irreversible.", icon: 'warning',
                showCancelButton: true, confirmButtonText: 'Sí, ¡eliminar!', confirmButtonColor: '#ef4444'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/admin/jugadores/${jugadorId}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error((await response.json()).message);
                        Swal.fire('Eliminado', 'El jugador ha sido eliminado de la sala.', 'success');
                        renderJugadores(salaId);
                    } catch (error) { Swal.fire('Error', error.message, 'error'); }
                }
            });
        },
        toggleJugadorStatus: async (jugadorId, salaId) => {
            await Swal.close();
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/jugadores/${jugadorId}/toggle`, { method: 'PATCH' });
                if (!response.ok) throw new Error((await response.json()).message);
                renderJugadores(salaId);
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        },
    };

    // --- EVENT LISTENERS ---
    createSalaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreSalaInput = document.getElementById('sala-nombre');
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/salas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_sala: nombreSalaInput.value })
            });
            if (!response.ok) throw new Error((await response.json()).message);
            nombreSalaInput.value = '';
            fetchAndRenderAll();
            Swal.fire('¡Éxito!', `La sala ha sido creada.`, 'success');
        } catch (error) { Swal.fire('Error', error.message, 'error'); }
    });

    // Carga inicial
    fetchAndRenderAll();
});