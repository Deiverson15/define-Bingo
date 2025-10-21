document.addEventListener('DOMContentLoaded', () => {
    const sectionTickets = document.getElementById('section-tickets');
    if (!sectionTickets) return;

    // --- ESTADO LOCAL DEL MÓDULO ---
    let allTickets = [];
    const PRECIO_POR_COLUMNA = 200.00;
    const DESCUENTO_5_COLUMNAS = 40.00;

    // --- ELEMENTOS DEL DOM ---
    const ticketsTableBody = document.getElementById('tickets-table-body');
    const ticketSearchInput = document.getElementById('ticket-search-input');
    const ticketSearchButton = document.getElementById('ticket-search-button');

    // --- LÓGICA DE RECEPCIÓN DE DATOS ---
    document.addEventListener('globalTicketsLoaded', (event) => {
        allTickets = event.detail.tickets;
        filterAndRenderTickets();
        updateIncomeStats(allTickets);
    });

    function filterAndRenderTickets() {
        if (!ticketSearchInput) return;
        const searchTerm = ticketSearchInput.value.trim().toLowerCase();
        
        const filteredTickets = searchTerm
            ? allTickets.filter(ticket => 
                ticket.id.toString().includes(searchTerm) ||
                (ticket.username && ticket.username.toLowerCase().includes(searchTerm))
              )
            : allTickets;
            
        renderTickets(filteredTickets);
    }

    // ▼▼▼ FUNCIÓN MODIFICADA PARA AGRUPAR POR PARTIDA ▼▼▼
    function renderTickets(tickets) {
        if (!ticketsTableBody) return;
        if (tickets.length === 0) {
            ticketsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-[#9fb2b0]">No se encontraron tickets.</td></tr>`;
            return;
        }

        // 1. Agrupar tickets por game_id
        const groupedByGame = tickets.reduce((acc, ticket) => {
            const gameId = ticket.game_id || 'sin-partida';
            if (!acc[gameId]) {
                acc[gameId] = [];
            }
            acc[gameId].push(ticket);
            return acc;
        }, {});

        // 2. Ordenar los IDs de partida (los más nuevos primero)
        const sortedGameIds = Object.keys(groupedByGame).sort((a, b) => {
            if (a === 'sin-partida') return 1;
            if (b === 'sin-partida') return -1;
            // Ordenar numéricamente de mayor a menor
            return Number(b) - Number(a);
        });

        let html = '';

        // 3. Iterar sobre los grupos ordenados y construir el HTML
        sortedGameIds.forEach(gameId => {
            const gameTickets = groupedByGame[gameId];
            const gameDate = gameTickets[0] ? new Date(gameTickets[0].created_at).toLocaleDateString('es-VE') : 'Fecha no disponible';

            // Añadir un encabezado para cada grupo de partida
            html += `
                <tr class="bg-[#0f172a] sticky top-0 z-10">
                    <th colspan="8" class="p-2 text-left text-yellow-400 font-bold text-base border-b border-t border-gray-700">
                        Partida #${gameId === 'sin-partida' ? 'Sin Asignar' : gameId}
                        <span class="text-sm font-normal text-gray-400 ml-2">(${gameDate})</span>
                    </th>
                </tr>
            `;

            // Renderizar las filas de tickets para la partida actual
            html += gameTickets.map(ticket => {
                let statusClass, statusText;
                switch (ticket.status) {
                    case 'pagado':    statusClass = 'badge-green'; statusText = 'Pagado'; break;
                    case 'pendiente': statusClass = 'badge-yellow'; statusText = 'Pendiente'; break;
                    case 'rechazado': statusClass = 'badge-red'; statusText = 'Rechazado'; break;
                    case 'impreso':   statusClass = 'badge-blue'; statusText = 'Impreso'; break;
                    default:          statusClass = 'badge-gray'; statusText = ticket.status;
                }

                const isPrintable = ticket.status === 'pagado' || ticket.status === 'impreso';
                const printActionHtml = isPrintable
                    ? `<a href="#" onclick="ticketActions.print('${ticket.id}')" class="block px-4 py-2 text-sm text-gray-200 hover:bg-[#4338ca]">Imprimir</a>`
                    : `<span class="block px-4 py-2 text-sm text-gray-500 cursor-not-allowed" title="El pago debe estar verificado para poder imprimir">Imprimir</span>`;

                return `
                    <tr class="border-b border-[#1b2742] hover:bg-[#0c1528]/40">
                        <td class="p-3">${ticket.id}</td>
                        <td class="p-3">${ticket.username}</td>
                        <td class="p-3">${Array.isArray(ticket.columns) ? ticket.columns.join(', ') : 'N/A'}</td>
                        <td class="p-3">${parseFloat(ticket.monto).toFixed(2)} Bs</td>
                        <td class="p-3">${ticket.payment_method}</td>
                        <td class="p-3">${new Date(ticket.created_at).toLocaleString('es-VE')}</td>
                        <td class="p-3 text-center"><span class="badge ${statusClass}">${statusText}</span></td>
                        <td class="p-3 text-center">
                            <div class="relative inline-block text-left">
                                <button onclick="UI.toggleActionsMenu(event)" type="button" class="btn btn-neutral py-1 px-3">Acciones</button>
                                <div class="actions-menu origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#0e1730] ring-1 ring-black/50 hidden z-20">
                                    <div class="py-1" role="menu" aria-orientation="vertical">
                                        ${printActionHtml}
                                        <a href="#" onclick="ticketActions.showEditModal('${ticket.id}')" class="block px-4 py-2 text-sm text-gray-200 hover:bg-[#f59e0b] hover:text-black">Modificar</a>
                                        <a href="#" onclick="ticketActions.delete('${ticket.id}')" class="block px-4 py-2 text-sm text-gray-200 hover:bg-[#ef4444]">Eliminar</a>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        });

        ticketsTableBody.innerHTML = html;
    }

    // (El resto del archivo permanece sin cambios)

    function updateIncomeStats(tickets) {
        const safeSetText = (id, text) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        };
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const ingresosHoy = tickets.filter(t => new Date(t.created_at) >= todayStart).reduce((sum, t) => sum + parseFloat(t.monto), 0);
        const ingresosSemanales = tickets.filter(t => new Date(t.created_at) >= weekStart).reduce((sum, t) => sum + parseFloat(t.monto), 0);
        const ingresosMensuales = tickets.filter(t => new Date(t.created_at) >= monthStart).reduce((sum, t) => sum + parseFloat(t.monto), 0);

        safeSetText('ingresos-hoy', `${ingresosHoy.toFixed(2)} Bs`);
        safeSetText('ingresos-semanales', `${ingresosSemanales.toFixed(2)} Bs`);
        safeSetText('ingresos-mensuales', `${ingresosMensuales.toFixed(2)} Bs`);
    }

    const createTicketButton = document.getElementById('create-ticket-button');
    const createTicketForm = document.getElementById('create-ticket-form');
    const cancelCreateTicketButton = document.getElementById('cancel-create-ticket-modal');
    const columnsInput = document.getElementById('create-columns');
    const montoDisplay = document.getElementById('create-monto-display');

    if (createTicketButton) createTicketButton.addEventListener('click', () => UI.openModal('create-ticket-modal'));
    if (cancelCreateTicketButton) cancelCreateTicketButton.addEventListener('click', () => {
        UI.closeModal('create-ticket-modal');
        createTicketForm.reset();
        if (montoDisplay) montoDisplay.textContent = '0.00 Bs';
    });

    if (columnsInput) {
        columnsInput.addEventListener('input', () => {
            const columns = [...new Set(columnsInput.value.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c)))];
            let monto = columns.length * PRECIO_POR_COLUMNA;
            if (columns.length === 5) monto -= DESCUENTO_5_COLUMNAS;
            if (montoDisplay) montoDisplay.textContent = `${monto.toFixed(2)} Bs`;
        });
    }

    if (createTicketForm) {
        createTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('create-username').value;
            const columnsStr = document.getElementById('create-columns').value;
            const paymentMethod = document.getElementById('create-payment').value;
            const columns = [...new Set(columnsStr.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c) && c >= 1 && c <= 15))];

            if (!username.trim() || columns.length === 0) {
                return Swal.fire('Error', 'El nombre de usuario y al menos una columna son requeridos.', 'error');
            }

            const ticketData = { username: username.trim(), columns, paymentMethod, status: 'pagado' };
            Swal.fire({ title: 'Creando Ticket...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const response = await fetch(`${API_BASE_URL}/api/tickets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ticketData)
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.message || 'Error al registrar el ticket.');
                }
                Swal.fire('¡Éxito!', 'El ticket ha sido creado correctamente.', 'success');
                createTicketForm.reset();
                UI.closeModal('create-ticket-modal');
                if (montoDisplay) montoDisplay.textContent = '0.00 Bs';
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    const editModal = document.getElementById('edit-ticket-modal');
    const editForm = document.getElementById('edit-ticket-form');
    if (editModal) {
        document.getElementById('cancel-edit-ticket-modal')?.addEventListener('click', () => UI.closeModal('edit-ticket-modal'));
    }
    
    window.ticketActions = {
        print: (ticketId) => {
            window.open(`print-ticket.html?id=${ticketId}`, '_blank');
        },
        delete: async (ticketId) => {
            const confirmation = await Swal.fire({ title: '¿Estás seguro?', text: "Esta acción eliminará el ticket permanentemente.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, ¡bórralo!' });
            if (confirmation.isConfirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('No se pudo eliminar el ticket.');
                    UI.toast('Ticket eliminado', 'success');
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        },
        showEditModal: (ticketId) => {
            const ticket = allTickets.find(t => t.id == ticketId);
            if (!ticket) return UI.toast("No se encontró el ticket.", "error");
            document.getElementById('edit-ticket-id').value = ticket.id;
            document.getElementById('edit-columns').value = ticket.columns.join(', ');
            document.getElementById('edit-payment').value = ticket.payment_method;
            UI.openModal('edit-ticket-modal');
        }
    };
    
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const ticketId = document.getElementById('edit-ticket-id').value;
          const columns = document.getElementById('edit-columns').value.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
          const paymentMethod = document.getElementById('edit-payment').value;

          if (columns.length === 0) return UI.toast("Introduce al menos una columna válida.", "warning");
          
          try {
              const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ columns, payment_method: paymentMethod })
              });
              if (!response.ok) throw new Error('Error al actualizar.');
              UI.closeModal('edit-ticket-modal');
              UI.toast('Ticket actualizado con éxito.', 'success');
          } catch (error) { Swal.fire('Error', error.message, 'error'); }
      });
    }

    if (ticketSearchButton) ticketSearchButton.addEventListener('click', filterAndRenderTickets);
    if (ticketSearchInput) ticketSearchInput.addEventListener('input', filterAndRenderTickets);

    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'tickets') {
            filterAndRenderTickets();
        }
    });
});