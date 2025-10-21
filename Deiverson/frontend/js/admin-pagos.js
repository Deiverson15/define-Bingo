// /frontend/js/admin-pagos.js - ACTUALIZADO CON BÚSQUEDA INTELIGENTE Y ORDENAMIENTO POR RELEVANCIA

document.addEventListener('DOMContentLoaded', () => {
    const seccionPagos = document.getElementById('section-pagos');
    if (!seccionPagos) return;

    let localTickets = []; 

    // ======================================================
    // SELECCIÓN DE ELEMENTOS DEL DOM
    // ======================================================
    const paymentsTableBody = document.getElementById('payments-table-body');
    const paymentSearchInput = document.getElementById('payment-search');
    const paymentDateSort = document.getElementById('payment-date-sort');
    const paymentDateFilter = document.getElementById('payment-date-filter'); 
    
    const closePaymentDetailsModal = document.getElementById('close-payment-details-modal');
    if(closePaymentDetailsModal) {
        closePaymentDetailsModal.addEventListener('click', () => UI.closeModal('payment-details-modal'));
    }

    // ======================================================
    // LÓGICA DE CARGA, FILTRADO Y RENDERIZADO
    // ======================================================

    document.addEventListener('globalTicketsLoaded', (event) => {
        localTickets = event.detail.tickets.filter(ticket => ticket.payment_method);
        applyPaymentFiltersAndRender();
    });

    function applyPaymentFiltersAndRender() {
        let filtered = [...localTickets];
        const searchTerm = paymentSearchInput.value.trim();
        const filterDate = paymentDateFilter.value;
        
        // 1. Filtrar por ID de Ticket o Partida (Búsqueda eficiente)
        if (searchTerm) {
            filtered = filtered.filter(ticket => 
                ticket.id.toString().includes(searchTerm) || 
                (ticket.game_id && ticket.game_id.toString().includes(searchTerm))
            );
        }

        // 2. Filtrar por Fecha
        if (filterDate) {
            filtered = filtered.filter(ticket => ticket.created_at.split('T')[0] === filterDate);
        }

        // 3. Renderizar la tabla pasando el término de búsqueda para el ordenamiento
        renderPaymentsTable(filtered, searchTerm);
    }

    paymentSearchInput.addEventListener('input', applyPaymentFiltersAndRender);
    paymentDateFilter.addEventListener('change', applyPaymentFiltersAndRender);
    paymentDateSort.addEventListener('change', applyPaymentFiltersAndRender);

    // --- FUNCIÓN DE RENDERIZADO CON ORDENAMIENTO INTELIGENTE ---
    function renderPaymentsTable(tickets, searchTerm = '') {
        if (!paymentsTableBody) return;

        if (tickets.length === 0) {
            paymentsTableBody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-[#9fb2b0]">No se encontraron pagos.</td></tr>';
            return;
        }

        const groupedByGame = tickets.reduce((acc, ticket) => {
            const gameId = ticket.game_id || 'sin-partida';
            if (!acc[gameId]) acc[gameId] = [];
            acc[gameId].push(ticket);
            return acc;
        }, {});
        
        const getRelevanceScore = (value, term) => {
            const sValue = value.toString();
            if (sValue === term) return 3;
            if (sValue.startsWith(term)) return 2;
            if (sValue.includes(term)) return 1;
            return 0;
        };

        // Ordenar los IDs de partida (grupos)
        const sortedGameIds = Object.keys(groupedByGame).sort((a, b) => {
            if (a === 'sin-partida') return 1;
            if (b === 'sin-partida') return -1;
            
            if (searchTerm) {
                const maxScoreA = Math.max(getRelevanceScore(a, searchTerm), ...groupedByGame[a].map(t => getRelevanceScore(t.id, searchTerm)));
                const maxScoreB = Math.max(getRelevanceScore(b, searchTerm), ...groupedByGame[b].map(t => getRelevanceScore(t.id, searchTerm)));

                if (maxScoreA !== maxScoreB) {
                    return maxScoreB - maxScoreA; // Prioridad por relevancia
                }
                
                // Si la relevancia es igual, ordenar numéricamente para obtener 1, 11, 12... 81, 91
                return Number(a) - Number(b);
            }
            
            // Orden por defecto: las partidas más nuevas primero
            return Number(b) - Number(a);
        });

        let html = '';
        const sortOrder = paymentDateSort.value;

        sortedGameIds.forEach(gameId => {
            const gameTickets = groupedByGame[gameId];
            
            gameTickets.sort((a, b) => {
                // Desempate por orden de fecha seleccionado por el usuario
                return sortOrder === 'asc' 
                    ? new Date(a.created_at) - new Date(b.created_at) 
                    : new Date(b.created_at) - new Date(a.created_at);
            });

            const gameDate = gameTickets[0] ? new Date(gameTickets[0].created_at).toLocaleDateString('es-VE') : '';

            html += `
                <tr class="bg-[#0f172a] sticky top-0 z-10">
                    <th colspan="9" class="p-2 text-left text-yellow-400 font-bold text-base border-b border-t border-gray-700">
                        Partida #${gameId === 'sin-partida' ? 'Sin Asignar' : gameId}
                        <span class="text-sm font-normal text-gray-400 ml-2">(${gameDate})</span>
                    </th>
                </tr>
            `;
            
            html += gameTickets.map(ticket => {
                let statusClass, statusText;
                switch (ticket.status) {
                    case 'pagado':    statusClass = 'badge-green'; statusText = 'Pagado'; break;
                    case 'pendiente': statusClass = 'badge-yellow'; statusText = 'Pendiente'; break;
                    case 'rechazado': statusClass = 'badge-red'; statusText = 'Rechazado'; break;
                    case 'impreso':   statusClass = 'badge-blue'; statusText = 'Impreso'; break;
                    default:          statusClass = 'badge-gray'; statusText = ticket.status;
                }
                const actionButton = `<button onclick="openPaymentDetailsModal('${ticket.id}')" class="btn btn-accent py-1 px-3 text-xs">Detalles</button>`;
                return `
                    <tr class="border-b border-[#1b2742] hover:bg-[#0c1528]/40">
                        <td class="p-3">${ticket.id}</td>
                        <td class="p-3">${ticket.username}</td>
                        <td class="p-3 font-mono text-xs">${ticket.payment_reference || '---'}</td>
                        <td class="p-3 text-xs">${ticket.payment_bank || '---'}</td>
                        <td class="p-3">${parseFloat(ticket.monto).toFixed(2)} Bs</td>
                        <td class="p-3">${ticket.payment_method}</td>
                        <td class="p-3 text-xs">${new Date(ticket.created_at).toLocaleString('es-VE')}</td>
                        <td class="p-3"><span class="badge ${statusClass}">${statusText}</span></td>
                        <td class="p-3 text-center">${actionButton}</td>
                    </tr>`;
            }).join('');
        });
            
        paymentsTableBody.innerHTML = html;
    }

    // El resto de las funciones (modales y acciones) no necesitan cambios
    window.openPaymentDetailsModal = (ticketId) => {
        const ticket = localTickets.find(t => t.id == ticketId);
        if (!ticket) return UI.toast("Ticket no encontrado.", "error");
        const contentEl = document.getElementById('payment-details-content');
        const actionsEl = document.getElementById('payment-details-actions');
        let detailsHtml = `<p><strong>ID Ticket:</strong> ${ticket.id}</p><p><strong>Usuario:</strong> ${ticket.username}</p><p><strong>Monto:</strong> <span class="font-bold text-emerald-300">${parseFloat(ticket.monto).toFixed(2)} Bs</span></p><p><strong>Método:</strong> ${ticket.payment_method}</p><p><strong>Fecha:</strong> ${new Date(ticket.created_at).toLocaleString('es-VE')}</p><p><strong>Columnas:</strong> ${ticket.columns.join(', ')}</p>`;
        if (ticket.payment_method === 'Pago Móvil') {
            detailsHtml += `<hr class="border-[#1b2742] my-2"><p class="text-yellow-300"><strong>Referencia:</strong> ${ticket.payment_reference || '---'}</p><p class="text-yellow-300"><strong>Banco:</strong> ${ticket.payment_bank || '---'}</p>`;
        }
        contentEl.innerHTML = detailsHtml;
        let actionsHtml = '';
        if (ticket.status === 'pendiente') {
            actionsHtml = `<button onclick="handlePaymentAction('${ticket.id}', 'rechazado')" class="btn btn-danger">Rechazar</button><button onclick="handlePaymentAction('${ticket.id}', 'pagado')" class="btn btn-success">Aprobar</button>`;
        } else {
            actionsHtml = `<button onclick="handlePaymentAction('${ticket.id}', 'pendiente')" class="btn btn-neutral">Revertir</button>`;
        }
        actionsEl.innerHTML = actionsHtml;
        UI.openModal('payment-details-modal');
    };

    window.handlePaymentAction = (ticketId, status) => {
        UI.closeModal('payment-details-modal'); 
        const actionText = {
            pagado: { title: '¿Aprobar Pago?', text: 'El ticket se marcará como pagado.', confirm: 'Sí, ¡aprobar!' },
            rechazado: { title: '¿Rechazar Pago?', text: 'El ticket será marcado como rechazado.', confirm: 'Sí, ¡rechazar!' },
            pendiente: { title: '¿Revertir a Pendiente?', text: 'El estado del ticket volverá a ser pendiente.', confirm: 'Sí, revertir' }
        };
        const config = actionText[status];
        Swal.fire({
            title: config.title, text: config.text, icon: 'warning',
            showCancelButton: true, confirmButtonText: config.confirm,
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: status })
                    });
                    if (!response.ok) throw new Error('Error del servidor.');
                    Swal.fire('¡Actualizado!', 'El estado del pago ha sido modificado.', 'success');
                } catch (error) {
                    Swal.fire('Error', error.message, 'error');
                }
            }
        });
    };
    
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'pagos') {
            applyPaymentFiltersAndRender();
        }
    });
});