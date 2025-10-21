// /frontend/js/admin-ganador.js - CORREGIDO Y ACTUALIZADO

document.addEventListener('DOMContentLoaded', () => {
    const seccionGanador = document.getElementById('section-ganador');
    if (!seccionGanador) return;


    const socket = io(SOCKET_URL);

    // Escucha el evento del backend y actualiza la tabla
    socket.on('ganadores_updated', () => {
        console.log('📢 Recibida actualización de ganadores. Refrescando historial...');
        if (window.UI) UI.toast('El historial de ganadores se actualizó', 'info');
        fetchWinnerHistory();
    });



    socket.on('connect', () => {
        console.log('✅ Módulo de Ganadores conectado a Socket.IO.');
    });


        // ▼▼▼ AÑADE ESTE CÓDIGO ▼▼▼
    const viewModal = document.getElementById('view-ganador-modal');
    const closeViewModalButton = document.getElementById('close-view-ganador-modal');

    if (closeViewModalButton) {
        closeViewModalButton.addEventListener('click', () => {
            if (viewModal) {
                viewModal.classList.add('hidden');
            }
        });
    }

    let allGanadores = []; // Almacena el historial para editar/ver
    const API_URL = `${API_BASE_URL}/api/admin/ganadores`;

    // --- ELEMENTOS DEL DOM ---
    const declareButton = document.getElementById('declare-winner-button-main');
    const refreshButton = document.getElementById('refresh-winner-history');
    const historyTableBody = document.getElementById('winner-history-table-body');
    const editForm = document.getElementById('edit-ganador-form');

    // --- LÓGICA PRINCIPAL ---
    async function handleDeclareWinner() {
        const nameInput = document.getElementById("winner-name-input");
        const gameIdInput = document.getElementById("winner-game-id-input");
        const columnInput = document.getElementById("winner-column-input");
        const ticketIdInput = document.getElementById("winner-ticket-id-input"); // Nuevo campo

        const name = nameInput.value.trim();
        const gameId = parseInt(gameIdInput.value);
        const column = parseInt(columnInput.value);
        const ticketId = parseInt(ticketIdInput.value); // Nuevo valor

        if (!name || !gameId || !column || column < 1 || column > 15 || !ticketId) {
            return Swal.fire("Datos incompletos", "Completa todos los campos correctamente, incluyendo el ID del Ticket.", "warning");
        }

        const winnerData = {
            nombre_ganador: name, 
            id_partida: gameId, 
            columna_ganadora: column, 
            ticket_id: ticketId, // CLAVE: Se añade el ID del ticket
            fecha: new Date().toISOString()
        };

        try {
            if(window.UI) UI.setLoading(declareButton, true, 'Validando...');
            const response = await fetch(API_URL, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(winnerData)
            });
            
            const err = await response.json(); 
            
            if (!response.ok) { 
                // Manejo de errores de validación y duplicados (409)
                Swal.fire({
                    title: "Error de Validación",
                    text: err.message || "No se pudo registrar el ganador por un error desconocido.",
                    icon: "error",
                    confirmButtonText: "Entendido"
                });
                throw new Error(err.message || "Fallo en la validación.");
            }
            
            if (response.ok) { // Mostrar éxito solo si la respuesta fue OK
                if(window.UI) UI.toast("Ganador validado y agregado con éxito", "success");
                nameInput.value = ''; 
                gameIdInput.value = ''; 
                columnInput.value = '';
                ticketIdInput.value = ''; // Limpiar nuevo campo
            }

        } catch (e) {
            console.error(e);
        } finally {
            if(window.UI) UI.setLoading(declareButton, false);
        }
    }


    async function fetchWinnerHistory() {
        if (!historyTableBody) return;
        historyTableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-[#9fb2b0]">Cargando...</td></tr>`;
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            allGanadores = await response.json();
            if (allGanadores.length === 0) {
                historyTableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-[#9fb2b0]">Sin registros de ganadores</td></tr>`;
                return;
            }
            historyTableBody.innerHTML = allGanadores.map(w => `
                <tr class="border-b border-[#1b2742] hover:bg-[#0c1528]/40">
                    <td class="p-3">${w.nombre_ganador}</td>
                    <td class="p-3">${w.id_partida || "-"}</td>
                    <td class="p-3 font-bold text-emerald-300">${w.columna_ganadora || "-"}</td>
                    <td class="p-3 text-xs">${new Date(w.fecha).toLocaleString("es-VE")}</td>
                    <td class="p-3 text-center">
                        <div class="inline-flex gap-2">

                        </div>
                    </td>
                </tr>
            `).join("");
        } catch (e) {
            console.error(e);
            historyTableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-400">Error al cargar el historial</td></tr>`;
        }
    }

    // --- FUNCIONES GLOBALES PARA BOTONES ---
    window.viewWinner = (id) => {
        const winner = allGanadores.find(w => w.id === id);
        if (!winner) return;
        const content = document.getElementById("view-ganador-content");
        if (content) {
            content.innerHTML = `
                <p><strong>Nombre:</strong> ${winner.nombre_ganador}</p>
                <p><strong>ID Partida:</strong> ${winner.id_partida || "-"}</p>
                <p><strong>Columna:</strong> ${winner.columna_ganadora || "-"}</p>
                <p><strong>Fecha Registro:</strong> ${new Date(winner.fecha).toLocaleString("es-VE")}</p>
            `;
        }
        if (window.UI) UI.openModal("view-ganador-modal");
    };

    window.editWinner = (id) => {
        const winner = allGanadores.find(w => w.id === id);
        if (!winner) return;
        document.getElementById("edit-ganador-id").value = winner.id;
        document.getElementById("edit-ganador-name").value = winner.nombre_ganador || "";
        document.getElementById("edit-ganador-partida").value = winner.id_partida || "";
        document.getElementById("edit-ganador-columna").value = winner.columna_ganadora || "";
        if (window.UI) UI.openModal("edit-ganador-modal");
    };

    window.deleteWinner = async (id) => {
        const result = await Swal.fire({
            title: "¿Eliminar este ganador?",
            text: "Esta acción es irreversible.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, ¡eliminar!'
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
                if (!response.ok) throw new Error("No se pudo eliminar.");
                if (window.UI) UI.toast("Ganador eliminado", "success");
                fetchWinnerHistory();
            } catch (e) {
                if (window.UI) UI.toast(e.message, "error");
            }
        }
    };
    
    // --- EVENT LISTENERS ---
    if (declareButton) declareButton.addEventListener("click", handleDeclareWinner);
    if (refreshButton) refreshButton.addEventListener("click", fetchWinnerHistory);

    if (editForm) {
      editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-ganador-id").value;
        const data = {
          nombre_ganador: document.getElementById("edit-ganador-name").value.trim(),
          id_partida: parseInt(document.getElementById("edit-ganador-partida").value),
          columna_ganadora: parseInt(document.getElementById("edit-ganador-columna").value)
        };
        try {
          const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
          if (!response.ok) throw new Error("No se pudo actualizar el ganador.");
          if (window.UI) UI.closeModal("edit-ganador-modal");
          if (window.UI) UI.toast("Ganador actualizado", "success");
          fetchWinnerHistory();
        } catch (e) {
          console.error(e);
          if (window.UI) UI.toast(e.message, "error");
        }
      });
    }

    // --- CARGA INICIAL ---
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'ganador') {
            fetchWinnerHistory();
        }
    });

    if (seccionGanador && !seccionGanador.classList.contains('hidden')) {
        fetchWinnerHistory();
    }
});