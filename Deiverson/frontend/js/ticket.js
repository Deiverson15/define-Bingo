// personali/frontend/js/ticket.js

// --- Función para calcular y mostrar el total ---
function calculateAndDisplayTotal(columns) {
    const BASE_PRICE_PER_COLUMN = 200;
    const DISCOUNT = 40;
    const count = columns.length;
    let total = count * BASE_PRICE_PER_COLUMN;
    let discountApplied = 0;

    if (count === 5) {
        total -= DISCOUNT;
        discountApplied = DISCOUNT;
    }

    const totalDisplay = document.getElementById('total-amount-display');
    const discountDisplay = document.getElementById('discount-info-display');

    if (totalDisplay) {
        totalDisplay.textContent = `${total.toFixed(2)} Bs`;
    }
    if (discountDisplay) {
        discountDisplay.textContent = discountApplied > 0 ? `¡Descuento de ${discountApplied.toFixed(2)} Bs aplicado!` : '';
    }

    return total; // Devuelve el total calculado
}
// ----------------------------------------------------


document.addEventListener('DOMContentLoaded', () => {
    const socket = io(SOCKET_URL);
    socket.on('connect', () => console.log('✅ Pantalla de ticket conectada.'));

    // --- Selección de Elementos del DOM ---
    const columnsContainer = document.getElementById('ticket-columns-container');
    const ticketDatetime = document.getElementById('ticket-datetime');
    const cancelButton = document.getElementById('cancel-button');
    const confirmButton = document.getElementById('confirm-button');
    const successOverlay = document.getElementById('success-overlay');
    const successData = document.getElementById('success-data');
    const printRequestArea = document.getElementById('print-request-area');
    const pagoMovilModal = document.getElementById('pago-movil-modal');
    const pagoMovilForm = document.getElementById('pago-movil-form');
    const closePagoMovilModalButton = document.getElementById('close-pago-movil-modal');
    const manualPrintSpinnerModal = document.getElementById('manual-print-spinner-modal');
    const ticketGameIdDisplay = document.getElementById('ticket-game-id-display'); // NUEVO

    let currentTicketId = null; 
    let manualPrintTimeout = null; 

    // --- Carga de Datos del Ticket Pendiente y Lógica de Botones (sin cambios) ---
    const pendingTicketJSON = localStorage.getItem('pendingTicketData');
    if (!pendingTicketJSON) {
        alert("No se ha encontrado un ticket. Serás redirigido.");
        window.location.href = 'bingo.html';
        return;
    }
    const pendingTicketData = JSON.parse(pendingTicketJSON);
    
    // Renderiza la información inicial del ticket
    const selectedColumns = pendingTicketData.columns || [];
    if (selectedColumns.length > 0) {
        selectedColumns.forEach(col => {
            const cell = document.createElement('div');
            cell.className = 'column-cell';
            cell.textContent = col;
            columnsContainer.appendChild(cell);
        });
    }

    // AÑADIDO: Mostrar ID de la partida
    if (ticketGameIdDisplay && pendingTicketData.gameId) {
        ticketGameIdDisplay.textContent = pendingTicketData.gameId;
    }


    const now = new Date();
    ticketDatetime.textContent = `${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

    // 🚨 AÑADIDO: Muestra el monto total al cargar la página
    calculateAndDisplayTotal(selectedColumns); 

    // Manejadores de botones (cancel, confirm, pago movil) ...
    cancelButton.addEventListener('click', () => {
        localStorage.removeItem('pendingTicketData'); // Limpiar al cancelar
        window.location.href = 'bingo.html';
    });

    confirmButton.addEventListener('click', () => {
        if (pendingTicketData.paymentMethod === 'Pago Móvil') {
            pagoMovilModal.classList.remove('hidden');
            document.getElementById('payment-reference').focus(); 
        } else {
            finalizePurchase(pendingTicketData);
        }
    });

    pagoMovilForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const reference = document.getElementById('payment-reference').value;
        const bank = document.getElementById('payment-bank').value;
        if (!reference || !bank || reference.length > 12) {
             Swal.fire('Error', 'Verifica la referencia y el banco.', 'error');
             return;
        }
        const fullTicketData = { ...pendingTicketData, payment_reference: reference, payment_bank: bank };
        pagoMovilModal.classList.add('hidden');
        finalizePurchase(fullTicketData);
    });

    closePagoMovilModalButton.addEventListener('click', () => {
        pagoMovilModal.classList.add('hidden');
    });
    // --- Fin Lógica de Botones ---

    async function finalizePurchase(ticketData) {
        // En modo automático, marcamos el ticket como 'pagado' desde el inicio.
        // En modo manual, el ticket se marca como 'pendiente' (que es el valor por defecto en el backend).
        const initialStatus = window.AUTO_PRINT_ENABLED === true ? 'pagado' : 'pendiente';
        const finalTicketData = { 
            ...ticketData, 
            status: initialStatus 
            // gameId ya está en ticketData si viene de bingo.js
        };

        try {
            Swal.fire({ title: 'Procesando Compra...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const response = await fetch(`${API_BASE_URL}/api/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalTicketData)
            });
            const createdTicket = await response.json();
            if (!response.ok) throw new Error(createdTicket.message);

            const ticketId = createdTicket.ticket.id;
            currentTicketId = ticketId; 
            
            // Si el modo es automático, disparamos la impresión de inmediato.
            if (window.AUTO_PRINT_ENABLED === true) {
                Swal.close();
                handleAutomaticPrinting(createdTicket.ticket);
                return;
            }

            // Si el modo es manual, nos suscribimos y esperamos la aprobación del admin.
            socket.emit('subscribe_to_ticket_status', ticketId);

            // Cambiamos el mensaje de SweetAlert a "Esperando Verificación" (ya está abierto)

            socket.on('ticket_status_updated', (data) => {
                if (data.id === currentTicketId) {
                    if (data.status === 'pagado') {
                        Swal.close(); 
                        handleManualPrinting(createdTicket.ticket);
                    } else if (data.status === 'impreso') {
                        // Lógica de éxito en el spinner del modo manual
                        if (manualPrintTimeout) clearTimeout(manualPrintTimeout);
                        if (manualPrintSpinnerModal && !manualPrintSpinnerModal.classList.contains('hidden')) {
                            Swal.fire({
                                title: '¡Ticket Impreso con Éxito!',
                                text: 'El administrador ha completado la impresión. Serás redirigido al inicio.',
                                icon: 'success',
                                showConfirmButton: false,
                                timer: 2500
                            }).then(() => {
                                window.location.href = 'index.html';
                            });
                        }
                    } else if (data.status === 'rechazado') {
                        if (manualPrintTimeout) clearTimeout(manualPrintTimeout);
                        Swal.fire('Pago Rechazado', 'Tu pago ha sido rechazado.', 'error');
                        localStorage.removeItem('pendingTicketData');
                    }
                }
            });

        } catch (error) {
            Swal.fire('Error en la Compra', `No se pudo finalizar la compra: ${error.message}`, 'error');
            localStorage.removeItem('pendingTicketData');
        }
    }

    // --- FUNCIÓN MANUAL (Modo: AUTO_PRINT_ENABLED = false) ---
    function handleManualPrinting(finalTicket) {
        localStorage.removeItem('pendingTicketData');

        successOverlay.classList.remove('hidden');
        
        successData.innerHTML = `
            <div class="bg-gray-900/70 rounded-lg px-3 py-2 text-left text-sm text-white space-y-1 border border-gray-600">
                <div><strong>ID Ticket:</strong> <span class="font-mono">${finalTicket.id}</span></div>
                <div><strong>ID Partida:</strong> <span class="font-mono">${finalTicket.game_id || 'N/A'}</span></div>
                <div><strong>Usuario:</strong> ${finalTicket.username}</div>
                <div><strong>Columnas:</strong> <span class="font-bold text-yellow-400">${finalTicket.columns.join(', ')}</span></div>
                <div><strong>Monto:</strong> ${parseFloat(finalTicket.monto).toFixed(2)} Bs</div>
                <div><strong>Estado:</strong> <span class="font-bold text-green-400">Pagado</span></div>
            </div>`;

        printRequestArea.innerHTML = `<button id="request-print-btn" class="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-6 rounded-lg text-base transition-colors w-full">Solicitar Impresión</button>`;
        
        document.getElementById('request-print-btn').addEventListener('click', () => {
            successOverlay.classList.add('hidden'); 
            document.getElementById('manual-spinner-ticket-id').textContent = finalTicket.id;
            manualPrintSpinnerModal.classList.remove('hidden');

            socket.emit('print_request_submitted', { ticketId: finalTicket.id });

            const TIMEOUT_MS = 30000; 
            manualPrintTimeout = setTimeout(() => {
                if (manualPrintSpinnerModal && !manualPrintSpinnerModal.classList.contains('hidden')) {
                    manualPrintSpinnerModal.classList.add('hidden');
                    Swal.fire({
                        title: 'Ticket Pendiente',
                        html: `El tiempo de espera ha terminado. Su ticket **#${finalTicket.id}** sigue como **Pagado**.<br> **Verifique con el administrador** para su impresión.`,
                        icon: 'warning',
                        showConfirmButton: true,
                        confirmButtonText: 'Regresar al inicio',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = 'index.html';
                    });
                }
            }, TIMEOUT_MS);
        });
        
        const returnButton = successOverlay.querySelector('a[href="index.html"]');
        if (returnButton) {
            returnButton.onclick = (e) => {
                e.preventDefault();
                window.location.href = 'index.html';
            };
        }
    }
    
    // --- FUNCIÓN AUTOMÁTICA (Modo: AUTO_PRINT_ENABLED = true) ---
    function handleAutomaticPrinting(finalTicket) {
        localStorage.removeItem('pendingTicketData');
        
        // 1. Notificación Rápida de éxito (no bloquea)
        if (window.Swal) {
            Swal.fire({ 
                icon: 'success', 
                title: '¡Ticket Aprobado!', 
                text: 'Iniciando impresión automática...',
                toast: true,
                position: 'top-end',
                showConfirmButton: false, 
                timer: 2000 
            });
        }
        
        // 2. Abre la ventana de impresión, la cual contiene la lógica para llamar a window.print()
        window.open(`print-ticket.html?id=${finalTicket.id}`, '_blank');
        
        // 3. Redirige la ventana actual (ticket.html) al inicio inmediatamente.
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000); 
    }
});