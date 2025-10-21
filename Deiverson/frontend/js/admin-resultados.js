document.addEventListener('DOMContentLoaded', () => {
    const seccionResultados = document.getElementById('section-resultados');
    if (!seccionResultados) return;

    let allResultados = [];
    const API_URL = `${API_BASE_URL}/api/admin/resultados`;

    // --- Selección de Elementos del DOM ---
    const createForm = document.getElementById('create-resultado-form');
    const historyTableBody = document.getElementById('resultados-history-table-body');
    const refreshButton = document.getElementById('refresh-resultados-history');
    
    // --- Modales ---
    const viewModal = document.getElementById('view-resultado-modal');
    const editModal = document.getElementById('edit-resultado-modal');
    const editForm = document.getElementById('edit-resultado-form');
    const actionsModal = document.getElementById('actions-resultado-modal');
    const actionsModalContent = document.getElementById('actions-modal-content');

    // --- Botones para cerrar modales ---
    const closeViewModalButton = document.getElementById('close-view-resultado-modal');
    const cancelEditModalButton = document.getElementById('cancel-edit-resultado-modal');
    const closeActionsModalButton = document.getElementById('close-actions-resultado-modal');


    const socket = io(SOCKET_URL);
    socket.on('connect', () => console.log('✅ Módulo de Resultados conectado a Socket.IO.'));
    socket.on('resultados_updated', () => {
        console.log('📢 Recibida actualización de resultados. Refrescando historial...');
        if (window.UI) UI.toast('El historial de resultados se actualizó', 'info');
        fetchResultados();
    });

    const fetchResultados = async () => {
        try {
            historyTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-[#9fb2b0]">Cargando...</td></tr>`;
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            allResultados = await response.json();
            renderTable(allResultados);
        } catch (error) {
            historyTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-400">${error.message}</td></tr>`;
        }
    };

    const renderTable = (resultados) => {
        if (resultados.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-[#9fb2b0]">No hay resultados.</td></tr>`;
            return;
        }
        historyTableBody.innerHTML = resultados.map(r => {
            const isPublished = r.status === 'publicado';
            const statusClass = isPublished ? 'badge-green' : 'badge-yellow';
            const statusText = isPublished ? 'Publicado' : 'Borrador';
            return `
                <tr class="border-b border-[#1b2742] hover:bg-[#0c1528]/40">
                    <td class="p-3">${r.id_partida}</td>
                    <td class="p-3 font-bold text-yellow-400">${r.columna_ganadora}</td>
                    <td class="p-3"><span class="badge ${statusClass}">${statusText}</span></td>
                    <td class="p-3 text-center">
                        <button onclick="openActionsModal(${r.id})" class="btn btn-neutral py-1 px-3">Acciones</button>
                    </td>
                </tr>
            `;
        }).join('');
    };
    
    const handleFetchError = async (response) => {
        const errorData = await response.json().catch(() => ({ message: `Error: ${response.status}` }));
        return errorData.message;
    };


    window.openActionsModal = (id) => {
        const r = allResultados.find(res => res.id === id);
        if (!r) return;
        const isPublished = r.status === 'publicado';
        let buttonsHTML = isPublished
            ? `<button onclick="unpublishResultado(${id})" class="btn btn-warning w-full">Quitar Publicación</button>`
            : `<button onclick="publishResultado(${id})" class="btn btn-success w-full">Publicar</button>`;
        buttonsHTML += `<button onclick="viewResultadoDetails(${id})" class="btn btn-accent w-full">Ver Detalles</button><button onclick="showEditResultadoModal(${id})" class="btn btn-primary w-full">Editar</button><button onclick="deleteResultado(${id})" class="btn btn-danger w-full">Eliminar</button>`;
        actionsModalContent.innerHTML = buttonsHTML;
        if(actionsModal) actionsModal.classList.remove('hidden');
    };

    window.publishResultado = (id) => {
        if(actionsModal) actionsModal.classList.add('hidden');
        Swal.fire({ title: '¿Publicar Resultado?', icon: 'info', showCancelButton: true, confirmButtonText: 'Sí, ¡publicar!' })
        .then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${API_URL}/${id}/publish`, { method: 'PATCH' });
                    if (!response.ok) throw new Error(await handleFetchError(response));
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    };

    window.unpublishResultado = (id) => {
        if(actionsModal) actionsModal.classList.add('hidden');
        Swal.fire({ title: '¿Quitar Publicación?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, quitar' })
        .then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${API_URL}/${id}/unpublish`, { method: 'PATCH' });
                    if (!response.ok) throw new Error(await handleFetchError(response));
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    };
    
    window.viewResultadoDetails = (id) => {
        if(actionsModal) actionsModal.classList.add('hidden'); 
        const r = allResultados.find(res => res.id === id); 
        if (!r) return;
        document.getElementById('view-resultado-content').innerHTML = `<p><strong>ID:</strong> ${r.id}</p><p><strong>Partida:</strong> ${r.id_partida}</p><p><strong>Columna:</strong> ${r.columna_ganadora}</p><p><strong>Fecha:</strong> ${new Date(r.fecha).toLocaleString('es-VE')}</p><p><strong>Estado:</strong> ${r.status}</p>`;
        if(viewModal) viewModal.classList.remove('hidden'); 
    };

    window.showEditResultadoModal = (id) => {
        if(actionsModal) actionsModal.classList.add('hidden'); 
        const r = allResultados.find(res => res.id === id); 
        if (!r) return;
        document.getElementById('edit-resultado-id').value = r.id;
        document.getElementById('edit-resultado-partida').value = r.id_partida;
        document.getElementById('edit-resultado-columna').value = r.columna_ganadora;
        const date = new Date(r.fecha);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        document.getElementById('edit-resultado-fecha').value = date.toISOString().slice(0, 16);
        if(editModal) editModal.classList.remove('hidden');
    };

    window.deleteResultado = (id) => {
        if(actionsModal) actionsModal.classList.add('hidden');
        Swal.fire({ title: '¿Estás seguro?', text: "Esta acción es irreversible.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, ¡bórralo!' })
        .then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error(await handleFetchError(response));
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    };

    // --- EVENT LISTENERS PARA FORMULARIOS Y MODALES ---
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                id_partida: parseInt(document.getElementById('resultado-partida-id').value, 10),
                columna_ganadora: parseInt(document.getElementById('resultado-columna').value, 10),
                fecha: document.getElementById('resultado-fecha').value,
            };
            Swal.fire({ title: 'Guardando...', text: 'Por favor, espera.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!response.ok) throw new Error(await handleFetchError(response));
                Swal.fire('¡Guardado!', 'El borrador del resultado fue creado.', 'success');
                createForm.reset();
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-resultado-id').value;
            const data = {
                id_partida: parseInt(document.getElementById('edit-resultado-partida').value, 10),
                columna_ganadora: parseInt(document.getElementById('edit-resultado-columna').value, 10),
                fecha: document.getElementById('edit-resultado-fecha').value
            };
            try {
                const response = await fetch(`${API_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!response.ok) throw new Error(await handleFetchError(response));
                if(editModal) editModal.classList.add('hidden'); 
                Swal.fire('¡Guardado!', 'El resultado se actualizó correctamente.', 'success');
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
                if(editModal) editModal.classList.add('hidden'); 
            }
        });
    }
    
    // *** CORRECCIÓN: AÑADIR LISTENERS PARA CERRAR MODALES ***
    if (closeViewModalButton) {
        closeViewModalButton.addEventListener('click', () => viewModal.classList.add('hidden'));
    }
    if (cancelEditModalButton) {
        cancelEditModalButton.addEventListener('click', () => editModal.classList.add('hidden'));
    }
    if (closeActionsModalButton) {
        closeActionsModalButton.addEventListener('click', () => actionsModal.classList.add('hidden'));
    }
    if (refreshButton) {
        refreshButton.addEventListener('click', fetchResultados);
    }
    
    // --- CARGA INICIAL ---
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'resultados') {
            fetchResultados();
        }
    });

    if (seccionResultados && !seccionResultados.classList.contains('hidden')) {
        fetchResultados();
    }
});