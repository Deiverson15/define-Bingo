// sorteo/js/caller-logic.js

const Sorteo = (function() {
    // Define los 15 patrones verticales posibles (las columnas del 1 al 15)
    const PATRONES_VERTICALES = Array.from({ length: 15 }, (_, i) => [
        1 + i,
        16 + i,
        31 + i,
        46 + i,
        61 + i
    ]);

    let estado = {
        numerosSorteados: [],
        numerosPosibles: [],
        ultimoSorteado: null,
        anteriorSorteado: null,
        sorteoFinalizado: true,
        totalNumeros: 75,
        tipoGanador: null,
        patronGanador: null
    };

    function iniciar() {
        estado.numerosSorteados = [];
        // Carga todos los números del 1 al 75 para un sorteo aleatorio completo
        estado.numerosPosibles = Array.from({ length: estado.totalNumeros }, (_, i) => i + 1); 
        estado.ultimoSorteado = null;
        estado.anteriorSorteado = null;
        estado.sorteoFinalizado = false;
        estado.patronGanador = null;
        estado.tipoGanador = null;
    }

    function verificarCondicionesDeVictoria() {
        // Verifica si alguna de las 15 columnas verticales está completa
        for (const patron of PATRONES_VERTICALES) {
            if (patron.every(num => estado.numerosSorteados.includes(num))) {
                estado.patronGanador = patron;
                estado.tipoGanador = 'vertical';
                estado.sorteoFinalizado = true;
                return;
            }
        }
    }

    function sortearSiguiente() {
        if (estado.numerosPosibles.length === 0 || estado.sorteoFinalizado) {
            estado.sorteoFinalizado = true;
            return;
        }

        estado.anteriorSorteado = estado.ultimoSorteado;
        const indiceAleatorio = Math.floor(Math.random() * estado.numerosPosibles.length);
        const nuevoNumero = estado.numerosPosibles[indiceAleatorio];

        estado.numerosPosibles.splice(indiceAleatorio, 1);
        estado.numerosSorteados.push(nuevoNumero);
        estado.ultimoSorteado = nuevoNumero;

        verificarCondicionesDeVictoria();
    }

    function obtenerEstado() {
        return { ...estado };
    }
    
    function obtenerPatronGanador() {
        return estado.patronGanador;
    }

    return { iniciar, sortearSiguiente, obtenerEstado, obtenerPatronGanador };
})();