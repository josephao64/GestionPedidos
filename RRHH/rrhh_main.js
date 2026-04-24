/* rrhh_main.js - Core Navigation and UI Logic for RRHH Module */

/**
 * Switches between different sections of the HR dashboard
 * @param {string} sectionId - The ID of the section to show (without '-section' suffix)
 * @param {HTMLElement} el - The clicked navigation element
 */
function switchSection(sectionId, el) {
    // Hide all sections
    document.querySelectorAll('.hr-section').forEach(s => s.classList.remove('active'));
    
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    // Show target section
    const target = document.getElementById(sectionId + '-section');
    if (target) {
        target.classList.add('active');
    }
    
    // Activate clicked nav item
    if (el) {
        el.classList.add('active');
    }

    // Trigger data load for the specific section if needed
    switch (sectionId) {
        case 'puestos':
            if (typeof loadPositions === 'function') loadPositions();
            break;
        case 'empleados':
            if (typeof loadEmployees === 'function') loadEmployees();
            break;
        case 'dashboard':
            if (typeof initDashboard === 'function') initDashboard();
            break;
        case 'sucursales':
            if (typeof loadSucursales === 'function') loadSucursales();
            break;
        case 'traslados':
            if (typeof loadTraslados === 'function') loadTraslados();
            break;
        case 'config':
            if (window.rrhhConfig) window.rrhhConfig.load();
            break;
        case 'vacaciones':
            if (typeof initVacaciones === 'function') initVacaciones();
            break;
        case 'prestamos':
            if (typeof loadLoans === 'function') loadLoans();
            break;
        case 'planillas':
            if (window.populatePlanillaBranches) window.populatePlanillaBranches();
            break;
        case 'reportes':
            if (window.reports) window.reports.init();
            break;
    }
}

/**
 * Modal handling for Puestos
 */
function openPuestoModal() {
    const modal = document.getElementById('puestoModal');
    if (!modal) return;
    modal.classList.add('active');
    if (typeof openModal === 'function') openModal(); // From puestos.js
}

function closeModal() {
    const modal = document.getElementById('puestoModal');
    if (!modal) return;
    modal.classList.remove('active');
}

// Global Initialization
window.addEventListener('load', () => {
    console.log("RRHH Module Initialized");
    if (window.rrhhConfig) window.rrhhConfig.load();
    if (typeof initDashboard === 'function') initDashboard();
});
