// personali/frontend/js/print-ticket.js (MODIFICADO con Lógica de Reintento)

document.addEventListener('DOMContentLoaded', async () => {
    // 🚨 Este 'io' ahora está definido gracias a la modificación en el HTML
    const socket = io(SOCKET_URL); 

    const ticketContent = document.getElementById('ticket-content');
    const loadingMessage = document.getElementById('loading-message');
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('id');

    const setText = (id, text) => {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    };
    
    // Función para mostrar un error claro en lugar de solo cargar
    const displayError = (message) => {
        if (loadingMessage) {
            loadingMessage.innerHTML = `<span style="color: red; font-weight: bold;">❌ Error de Carga ❌</span><br><br>${message}<br><br><span style="font-size: 0.8em;">Verifica que la dirección ${API_BASE_URL} esté accesible.</span>`;
            loadingMessage.style.color = '#333';
        }
        if (ticketContent) ticketContent.classList.add('hidden');
    };

    if (!ticketId) {
        setText('loading-message', 'Error: No se especificó un ID de ticket.');
        return;
    }

    // --- Lógica de Carga y Reintento ---
    const MAX_RETRIES = 3;
    let attempts = 0;
    let ticket = null;

    while (attempts < MAX_RETRIES && !ticket) {
        attempts++;
        try {
            const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`); 
            
            if (response.ok) {
                ticket = await response.json();
                break; // Éxito, salimos del bucle
            } else if (attempts < MAX_RETRIES) {
                // Si falla la API pero quedan reintentos, esperamos un poco
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            } else {
                const errorText = await response.text();
                throw new Error(`Respuesta del Servidor Fallida (${response.status}): ${errorText.substring(0, 50)}...`);
            }
        } catch (error) {
            if (attempts >= MAX_RETRIES) {
                // Si el error es de red o después del último reintento, lanzamos el error
                throw new Error(`Error de conexión al servidor: ${error.message}`);
            }
        }
    }

    // --- Renderizado y Flujo de Impresión ---
    try {
        if (!ticket) {
            throw new Error("No se pudieron cargar los datos después de varios reintentos.");
        }
        
        // Renderizado del ticket
        const subtotal = (parseFloat(ticket.monto) || 0) + (parseFloat(ticket.discount) || 0);

        setText('ticket-id', ticket.id);
        setText('ticket-user', ticket.username);
        setText('ticket-date', new Date(ticket.created_at).toLocaleString('es-VE'));
        setText('ticket-subtotal', subtotal.toFixed(2));
        setText('ticket-discount', (parseFloat(ticket.discount) || 0).toFixed(2));
        setText('ticket-monto', (parseFloat(ticket.monto) || 0).toFixed(2));
        setText('ticket-payment', ticket.payment_method);
        setText('ticket-game-id', ticket.game_id || 'N/A');

        const columnsContainer = document.getElementById('columns-list-container');
        if (columnsContainer && Array.isArray(ticket.columns)) {
            columnsContainer.innerHTML = ticket.columns.map(col => 
                `<span class="column-cell-number">${col}</span>`
            ).join('');
        }

        if(ticketContent) ticketContent.classList.remove('hidden');
        if(loadingMessage) loadingMessage.classList.add('hidden');
        
        // ************ IMPRESIÓN ************
        setTimeout(() => {
            window.print();
        }, 100); 

    } catch (error) {
        console.error('Error FATAL al cargar el ticket para imprimir:', error.message);
        displayError(error.message);
    }

    // --- LÓGICA DE ACTUALIZACIÓN DE ESTADO DESPUÉS DE IMPRESIÓN ---
    window.onafterprint = async () => {
        const idFromUrl = new URLSearchParams(window.location.search).get('id');
        if (!idFromUrl) return window.close();

        try {
            await fetch(`${API_BASE_URL}/api/tickets/${idFromUrl}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'impreso' })
            });
            
            // El servidor ahora emite el socket de notificación
            window.close(); 
            
        } catch (error) {
            console.error('Error al actualizar el estado del ticket después de imprimir:', error);
            window.close();
        }
    };
});

