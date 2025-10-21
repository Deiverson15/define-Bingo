// frontend/js/auth-admin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('admin-login-form'); // Asegúrate de usar el ID correcto
    const closeModalButton = document.getElementById('close-modal-button');
    const adminContent = document.getElementById('admin-main-content');
    
    // Función auxiliar para mostrar/ocultar el contenido principal
    const toggleAdminContent = (isVisible) => {
        if (adminContent) {
            if (isVisible) {
                adminContent.classList.remove('hidden');
                document.body.style.overflow = 'auto'; 
            } else {
                adminContent.classList.add('hidden');
                document.body.style.overflow = 'hidden';
            }
        }
    }

    // 1. Verificar la sesión y el rol.
    const user = Auth.getUser();

    if (!user) {
        // No hay sesión: Ocultar contenido y mostrar modal de login.
        toggleAdminContent(false);
        if (loginModal) loginModal.classList.remove('hidden');

        // Lógica para cerrar el modal (redirigir a index si se cierra sin login)
        const handleModalClose = () => window.location.href = 'index.html';
        if (closeModalButton) closeModalButton.addEventListener('click', handleModalClose);
        if (loginModal) loginModal.addEventListener('click', (event) => {
            if (event.target === loginModal) handleModalClose();
        });
        
        // --- MANEJADOR DE LOGIN EN EL MODAL ---
        if (loginForm) {
             loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                
                // Asegurarse de usar los IDs correctos para el formulario de admin
                const username = document.getElementById('admin-username').value; 
                const password = document.getElementById('admin-password').value;
                
                Swal.fire({ title: 'Ingresando...', text: 'Verificando credenciales.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                try {
                    const response = await fetch(`${API_BASE_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });

                    const result = await response.json();
                    
                    if (!response.ok) {
                        Swal.close();
                        Swal.fire({ 
                            toast: true, position: 'top-end', icon: 'error', 
                            title: 'Error de Acceso', 
                            text: result.message || 'Credenciales inválidas. Intente de nuevo.', 
                            showConfirmButton: false, timer: 4000 
                        });
                        document.getElementById('admin-password').value = ''; 
                        return;
                    }
                    
                    // --- VALIDACIÓN DE ROL DESPUÉS DEL LOGIN ---
                    if (result.user.role !== 'admin') {
                        Swal.close();
                        Auth.logout(); // Limpiar la sesión inmediatamente
                        Swal.fire('Acceso Denegado', 'Solo administradores pueden acceder a este panel.', 'error');
                        document.getElementById('admin-password').value = '';
                        return;
                    }
                    
                    // ÉXITO: Guardar sesión y recargar para cargar el dashboard
                    Auth.login(result.user); 
                    
                    Swal.close();
                    
                    Swal.fire({ 
                        toast: true, position: 'top-end', icon: 'success', 
                        title: '¡Sesión iniciada! Cargando panel...', 
                        showConfirmButton: false, timer: 500 
                    }).then(() => {
                         // Recargar la página es la acción final para cargar el panel
                         window.location.reload(); 
                    });
                    
                } catch (error) {
                    Swal.close();
                    Swal.fire({ 
                        toast: true, position: 'top-end', icon: 'error', 
                        title: 'Error de Conexión', text: 'No se pudo conectar con el servidor. Verifique la URL.', 
                        showConfirmButton: false, timer: 4000 
                    });
                }
            });
        }
        
        return; // Detener la ejecución del resto del script
    }
    
    // 2. Si SÍ hay sesión, verificar el rol (Protección contra manipulación)
    if (user.role !== 'admin') {
        alert('Acceso denegado. Debes ser administrador para ver esta página.');
        Auth.logout(); // Limpiar la sesión incorrecta
        window.location.replace('index.html');
        return;
    }
    
    // Si la sesión es válida y es admin, cargar el dashboard
    toggleAdminContent(true);
    
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Bienvenido de nuevo, ${user.username}`;
    }

    const logoutButton = document.getElementById('logout-button-sidebar'); 
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            Auth.logout();
            window.location.href = 'index.html';
        });
    }
    
    // Llamar a la carga inicial del dashboard (si el resto de admin.js está configurado para hacerlo)
    // El script admin.js es el responsable de llamar a fetchAllAdminData()
});