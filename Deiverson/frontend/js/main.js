// personali/frontend/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    const userSessionDiv = document.getElementById('user-session');
    const usernameDisplay = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');
    
    const loginModal = document.getElementById('login-modal');
    const closeModalButton = document.getElementById('close-modal-button');
    const loginForm = document.getElementById('login-form');

    const updateUI = () => {
        const user = Auth.getUser();
        
        // El botón de login se oculta si alguien (admin o normal) está logueado.
        if (user) {
            loginButton.classList.add('hidden');
        } else {
            loginButton.classList.remove('hidden');
        }
        // userSessionDiv y logoutButton están permanentemente ocultos en index.html.
    };
    
    let loadingTimeout = null; 

    if (loginButton) {
        loginButton.addEventListener('click', () => loginModal.classList.remove('hidden'));
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => loginModal.classList.add('hidden'));
    }
    if (loginModal) {
        loginModal.addEventListener('click', (event) => {
            if (event.target === loginModal) {
                loginModal.classList.add('hidden');
            }
        });
    }

    if (loginForm) { 
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            Swal.fire({
                title: 'Ingresando...',
                text: 'Verificando credenciales. Esto no debería tardar.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                    loadingTimeout = setTimeout(() => {
                        if (Swal.isVisible()) {
                            Swal.close();
                            Swal.fire({
                                title: 'Error de Conexión', 
                                text: 'El servidor no respondió a tiempo. Verifique el estado de su backend.', 
                                icon: 'error'
                            });
                            loginModal.classList.add('hidden');
                        }
                    }, 10000); 
                }
            });

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            clearTimeout(loadingTimeout);
            Swal.close();

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            // Guardar la sesión temporalmente para chequear el rol
            Auth.login(result.user); 
            
            loginModal.classList.add('hidden');
            loginForm.reset();
            
            if (Auth.isAdmin()) {
                // Admin: Mostrar advertencia y LIMPIAR la sesión
                Auth.logout(); // *** CLAVE: Borra la sesión para que el botón 'Ingresar' reaparezca. ***
                updateUI(); // Forzar actualización

                Swal.fire({ 
                    icon: 'error', 
                    title: 'Acceso No Permitido', 
                    text: 'Los usuarios administradores deben acceder directamente a través de admin.html.', 
                    showConfirmButton: true,
                    confirmButtonText: 'Aceptar'
                });
            } else {
                // Usuario normal
                updateUI();
                Swal.fire({ 
                    toast: true, 
                    position: 'top-end', 
                    icon: 'success', 
                    title: '¡Sesión iniciada correctamente!', 
                    showConfirmButton: false, 
                    timer: 3000 
                });
            }

        } catch (error) {
            clearTimeout(loadingTimeout);
            Swal.close(); 
            
            let title = 'Error de inicio de sesión';
            let errorMessage = error.message;

            if (!error.message || error.message.includes("Failed to fetch")) {
                title = 'Error de Conexión';
                errorMessage = 'No se pudo conectar con el servidor. Asegúrese de que el backend esté corriendo en la URL configurada.';
            }
            
            Swal.fire({ 
                toast: true, 
                position: 'top-end', 
                icon: 'error', 
                title: title, 
                text: errorMessage,
                showConfirmButton: false, 
                timer: 5000 
            });
            console.error('Login Error:', error); 
        }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            Auth.logout();
            updateUI();
            Swal.fire({ 
                toast: true, 
                position: 'top-end', 
                icon: 'info', 
                title: 'Has cerrado la sesión.', 
                showConfirmButton: false, 
                timer: 2000 
            });
        });
    }

    updateUI();
});