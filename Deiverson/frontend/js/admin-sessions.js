// frontend/js/admin-sessions.js

document.addEventListener('DOMContentLoaded', () => {
    const sectionSessions = document.getElementById('section-sessions');
    if (!sectionSessions) return;
    
    // --- ELEMENTOS DEL DOM ---
    const createSessionForm = document.getElementById('create-session-form');
    const creditsInput = document.getElementById('initial-credits-input');
    const generateButton = document.getElementById('generate-code-button');
    const resultCard = document.getElementById('session-result-card');
    const codeDisplay = document.getElementById('generated-code-display');
    const creditsDisplay = document.getElementById('generated-credits-display');
    
    // Aseguramos que el estado del usuario esté disponible
    const user = Auth.getUser();

    if (!user) {
        console.error("Admin user not found. Cannot create session.");
        return;
    }

    createSessionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const credits = parseFloat(creditsInput.value);
        
        if (isNaN(credits) || credits <= 0) {
            return Swal.fire('Error', 'Por favor, introduce una cantidad de créditos válida.', 'error');
        }

        const sessionData = {
            initial_credits: credits.toFixed(2),
            created_by: user.username // Usamos el nombre del administrador logueado
        };
        
        // Ocultar resultados anteriores
        resultCard.classList.add('hidden');
        
        if(window.UI) UI.toast('Generando código...', 'info');
        
        try {
            generateButton.disabled = true;
            generateButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Generando...`;
            
            const response = await fetch(`${API_BASE_URL}/api/admin/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Error del servidor al crear la sesión.');
            }

            // Mostrar resultado
            codeDisplay.textContent = result.session.session_code;
            creditsDisplay.textContent = `Créditos: ${parseFloat(result.session.credits).toFixed(2)} Bs`;
            resultCard.classList.remove('hidden');
            
            // Limpiar formulario y notificar
            creditsInput.value = '';
            if(window.UI) UI.toast('¡Código de sesión creado!', 'success');

        } catch (error) {
            console.error('Error al generar código:', error);
            if(window.UI) UI.toast(error.message, 'error');
        } finally {
            generateButton.disabled = false;
            generateButton.innerHTML = `<i data-lucide="shield-check"></i> Generar Código Único`;
            // Re-renderizar iconos lucide si es necesario
            if (window.lucide && lucide.createIcons) lucide.createIcons();
        }
    });

    // Carga inicial para asegurarse de que los iconos aparezcan si se navega a la pestaña
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'sessions') {
            // Aseguramos que la navegación se actualice en el admin.js
            const adminNav = document.getElementById('nav-sessions');
            if (adminNav) adminNav.classList.add('nav-link-active');
            
            if (window.lucide && lucide.createIcons) lucide.createIcons();
        }
    });
});