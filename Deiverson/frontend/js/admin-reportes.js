// personali/frontend/js/admin-reportes.js

document.addEventListener('DOMContentLoaded', () => {
    const sectionReportes = document.getElementById('section-reportes');
    if (!sectionReportes) return;

    // --- SELECCIÓN DE ELEMENTOS ---
    const calculateCierreButton = document.getElementById('calculate-cierre-button');
    const executeCierreButton = document.getElementById('execute-cierre-button');
    const historyContainer = document.getElementById('cierre-history-container');
    
    // --- Elementos del modal de reportes ---
    const openReportModalButton = document.getElementById('open-report-modal-button');
    const reportModal = document.getElementById('report-modal');
    const closeReportModalButton = document.getElementById('close-report-modal-button');
    const reportTypeSelect = document.getElementById('report-type-select');
    const downloadExcelButton = document.getElementById('download-excel-button');
    const downloadPdfButton = document.getElementById('download-pdf-button');

    // --- LÓGICA DEL MODAL DE REPORTES ---
    if (openReportModalButton) {
        openReportModalButton.addEventListener('click', () => reportModal.classList.remove('hidden'));
    }
    if (closeReportModalButton) {
        closeReportModalButton.addEventListener('click', () => reportModal.classList.add('hidden'));
    }
    
    const triggerDownload = (format) => {
        const type = reportTypeSelect.value;
        if (!type) {
            return UI.toast('Por favor, selecciona un tipo de reporte.', 'warning');
        }
        
        UI.toast(`Generando reporte de ${type} en formato ${format}...`, 'info');
        
        const url = `/api/admin/reports/download?type=${type}&format=${format}`;
        const downloadLink = document.createElement('a');
        downloadLink.href = `${API_BASE_URL}${url}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        reportModal.classList.add('hidden');
    };

    if (downloadExcelButton) {
        downloadExcelButton.addEventListener('click', () => triggerDownload('excel'));
    }
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => triggerDownload('pdf'));
    }


    // --- LÓGICA DE CIERRE DE CAJA ---
    const updateCierreUI = (period, data) => {
        const setVal = (elemId, value) => {
            const elem = document.getElementById(elemId);
            if(elem) elem.textContent = `${value} Bs`;
        }
        setVal(`cierre-${period}-ingresos`, data.ingresosBrutos);
        setVal(`cierre-${period}-premios`, data.premiosPagados);
        setVal(`cierre-${period}-ganancia`, data.gananciaNeta);
    };

    const handleCalculateCierre = async () => {
        if (!calculateCierreButton) return;
        
        calculateCierreButton.disabled = true;
        calculateCierreButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Actualizando...`;
        if (window.lucide) lucide.createIcons();

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/reports/cierre`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Error del servidor.');
            }
            const stats = await response.json();
            
            updateCierreUI('hoy', stats.hoy);
            updateCierreUI('semana', stats.semana);
            updateCierreUI('mes', stats.mes);
            UI.toast('Vista de cierre actualizada.', 'success');

        } catch (error) {
            UI.toast(`Error al actualizar: ${error.message}`, 'error');
        } finally {
            calculateCierreButton.disabled = false;
            calculateCierreButton.innerHTML = `<i data-lucide="refresh-cw"></i> Actualizar Vista`;
            if (window.lucide) lucide.createIcons();
        }
    };
    
    const handleExecuteCierre = async () => {
        const result = await Swal.fire({
            title: '¿Confirmar Cierre Diario?',
            text: "Esta acción guardará las ganancias y pérdidas de hoy como un registro permanente. No se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, ejecutar cierre',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            UI.toast('Procesando cierre definitivo...', 'info');
            try {
                const user = Auth.getUser();
                const response = await fetch(`${API_BASE_URL}/api/admin/reports/execute-cierre`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        periodo: 'diario',
                        realizado_por: user ? user.username : 'admin'
                    })
                });

                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.message);

                Swal.fire('¡Éxito!', 'El cierre diario ha sido guardado permanentemente.', 'success');
                
                handleCalculateCierre();
                fetchCierreHistory();

            } catch (error) {
                Swal.fire('Error', `No se pudo ejecutar el cierre: ${error.message}`, 'error');
            }
        }
    };

    const fetchCierreHistory = async () => {
        if (!historyContainer) return;
        historyContainer.innerHTML = `<p class="text-sm text-[#9fb2b0]">Cargando historial...</p>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/reports/cierres-history`);
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            
            const history = await response.json();

            if(history.length === 0) {
                historyContainer.innerHTML = `<p class="text-sm text-center text-[#9fb2b0]">No hay cierres registrados.</p>`;
                return;
            }

            historyContainer.innerHTML = history.map(cierre => `
                <div class="bg-[#0f172a] p-3 rounded-lg mb-2">
                    <div class="flex justify-between items-center">
                        <p class="font-bold text-white">${cierre.periodo}</p>
                        <p class="text-xs text-gray-400">${new Date(cierre.fecha_cierre).toLocaleString('es-VE')}</p>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center mt-2 border-t border-gray-700 pt-2">
                         <div><p class="text-xs text-[#9fb2b0]">Ingresos</p><p class="font-bold text-emerald-300">${cierre.ingresos_brutos} Bs</p></div>
                         <div><p class="text-xs text-[#9fb2b0]">Premios</p><p class="font-bold text-red-400">${cierre.premios_pagados} Bs</p></div>
                         <div><p class="text-xs text-white">Ganancia</p><p class="font-bold text-yellow-400">${cierre.ganancia_neta} Bs</p></div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            historyContainer.innerHTML = `<p class="text-sm text-red-400">Error al cargar historial.</p>`;
        }
    };
    
    // --- ASIGNACIÓN DE EVENTOS Y CARGA INICIAL ---
    if (calculateCierreButton) {
        calculateCierreButton.addEventListener('click', handleCalculateCierre);
    }
    if (executeCierreButton) {
        executeCierreButton.addEventListener('click', handleExecuteCierre);
    }
    
    document.addEventListener('tabChanged', (e) => {
        if (e.detail.activeTab === 'reportes') {
            handleCalculateCierre();
            fetchCierreHistory();
        }
    });
});