// personali/sorteo/js/caller-logic.js

const Sorteo = (function() {

    const PATRON_GANADOR_PREDEFINIDO = [9, 24, 39, 54, 69];

    const NUMEROS_ALEATORIOS_ENTRE_GANADORES = 3;

    // ===================================================================

    const PATRONES_VERTICALES = Array.from({ length: 15 }, (_, i) => [
        1 + i, 16 + i, 31 + i, 46 + i, 61 + i
    ]);

    let estado = {
        numerosSorteados: [],
        numerosPosibles: [],
        contadorAleatorio: 0,
        ultimoSorteado: null,
        anteriorSorteado: null,
        sorteoFinalizado: true,
        totalNumeros: 75,
        tipoGanador: null,
        patronGanador: null
    };

    function iniciar() {
        estado.numerosSorteados = [];
        const todosLosNumeros = Array.from({ length: estado.totalNumeros }, (_, i) => i + 1);
        
        if (PATRON_GANADOR_PREDEFINIDO && PATRON_GANADOR_PREDEFINIDO.length === 5) {
            const numerosReservados = new Set();
            const patronesPerdedores = PATRONES_VERTICALES.filter(p => 
                JSON.stringify(p) !== JSON.stringify(PATRON_GANADOR_PREDEFINIDO)
            );

            patronesPerdedores.forEach(patron => {
                const indiceAleatorio = Math.floor(Math.random() * patron.length);
                const numeroAReservar = patron[indiceAleatorio];
                numerosReservados.add(numeroAReservar);
            });

            estado.numerosPosibles = todosLosNumeros.filter(n => 
                !PATRON_GANADOR_PREDEFINIDO.includes(n) && !numerosReservados.has(n)
            );
            
        } else {
            estado.numerosPosibles = todosLosNumeros;
        }
        
        estado.contadorAleatorio = 0;
        estado.ultimoSorteado = null;
        estado.anteriorSorteado = null;
        estado.sorteoFinalizado = false;
        estado.patronGanador = null;
        estado.tipoGanador = null;
    }

    function verificarCondicionesDeVictoria() {
        const patronObjetivo = (PATRON_GANADOR_PREDEFINIDO.length === 5) ? PATRON_GANADOR_PREDEFINIDO : null;

        if (patronObjetivo) {
            if (patronObjetivo.every(num => estado.numerosSorteados.includes(num))) {
                estado.patronGanador = patronObjetivo;
                estado.tipoGanador = 'vertical';
                estado.sorteoFinalizado = true;
            }
            return;
        }

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
        if (estado.sorteoFinalizado) return;

        let nuevoNumero;

        if (PATRON_GANADOR_PREDEFINIDO.length === 5) {
            const numerosGanadoresFaltantes = PATRON_GANADOR_PREDEFINIDO.filter(n => !estado.numerosSorteados.includes(n));
            const hayNumerosSeguros = estado.numerosPosibles.length > 0;

            const esMomentoDeSacarGanador = 
                (estado.contadorAleatorio >= NUMEROS_ALEATORIOS_ENTRE_GANADORES && numerosGanadoresFaltantes.length > 0) || 
                (!hayNumerosSeguros && numerosGanadoresFaltantes.length > 0);

            if (esMomentoDeSacarGanador) {
                // ===================================================================
                // ▼▼▼ LÓGICA MEJORADA: SELECCIÓN ALEATORIA DEL NÚMERO GANADOR ▼▼▼
                // ===================================================================
                // En lugar de sacar el primero de la lista, elige uno al azar.
                const indiceGanadorAleatorio = Math.floor(Math.random() * numerosGanadoresFaltantes.length);
                nuevoNumero = numerosGanadoresFaltantes[indiceGanadorAleatorio];
                // ===================================================================
                
                estado.contadorAleatorio = 0;
            } 
            else if (hayNumerosSeguros) {
                const indiceAleatorio = Math.floor(Math.random() * estado.numerosPosibles.length);
                nuevoNumero = estado.numerosPosibles.splice(indiceAleatorio, 1)[0];
                estado.contadorAleatorio++;
            } 
            else {
                estado.sorteoFinalizado = true;
                return;
            }
        } else {
            if (estado.numerosPosibles.length === 0) {
                estado.sorteoFinalizado = true;
                return;
            }
            const indiceAleatorio = Math.floor(Math.random() * estado.numerosPosibles.length);
            nuevoNumero = estado.numerosPosibles.splice(indiceAleatorio, 1)[0];
        }

        estado.anteriorSorteado = estado.ultimoSorteado;
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