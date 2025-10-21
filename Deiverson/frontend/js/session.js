// personali/frontend/js/session.js

// Creamos un objeto global para no contaminar el scope
const Auth = {
    /**
     * Guarda los datos del usuario en localStorage.
     * @param {object} userData - El objeto del usuario a guardar.
     */
    login: function(userData) {
        localStorage.setItem('user', JSON.stringify(userData));
    },

    /**
     * Elimina los datos del usuario de localStorage.
     */
    logout: function() {
        localStorage.removeItem('user');
    },

    /**
     * Obtiene los datos del usuario guardados.
     * @returns {object|null} El objeto del usuario o null si no hay sesión.
     */
    getUser: function() {
        const userJSON = localStorage.getItem('user');
        return userJSON ? JSON.parse(userJSON) : null;
    },

    /**
     * Comprueba si hay un usuario con sesión iniciada.
     * @returns {boolean}
     */
    isLoggedIn: function() {
        return this.getUser() !== null;
    },

    /**
     * Comprueba si el usuario es administrador.
     * @returns {boolean}
     */
    isAdmin: function() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }
};