// sucursales.js

let orgData = {
    branches: [],
    employees: [],
    positions: []
};

let orgChartInstance = null;

window.sucursales = {
    init: async function () {
        console.log("Inicializando Organización...");
        await loadOrgData();
        this.switchTab('dashboard');
    },

    switchTab: function (tab) {
        // Hide all views
        ['dashboard', 'sucursales', 'quotas'].forEach(t => {
            const view = document.getElementById(`view-org-${t}`);
            const btn = document.getElementById(`tab-org-${t}`);
            if (view) view.style.display = 'none';
            if (btn) {
                btn.classList.remove('active');
                btn.style.color = 'var(--text-muted)';
                btn.style.borderBottom = '1px solid transparent';
            }
        });

        // Show selected
        const activeView = document.getElementById(`view-org-${tab}`);
        const activeBtn = document.getElementById(`tab-org-${tab}`);
        if (activeView) activeView.style.display = 'block';
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.color = 'var(--primary)';
            activeBtn.style.borderBottom = '2px solid var(--primary)';
        }

        if (tab === 'dashboard') renderOrgDashboard();
        if (tab === 'sucursales') renderOrgGrid();
        if (tab === 'quotas') loadSucursales();
    }
};

async function loadOrgData() {
    try {
        const [sucSnap, empSnap, posSnap] = await Promise.all([
            db.collection('sucursales').get(),
            db.collection('employees').where('status', '==', 'active').get(),
            db.collection('positions').get()
        ]);

        orgData.branches = sucSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        orgData.employees = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        orgData.positions = posSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        orgData.branches.sort((a, b) => a.name.localeCompare(b.name));

    } catch (e) {
        console.error("Error loading org data:", e);
        Swal.fire('Error', 'No se pudieron cargar los datos de la organización', 'error');
    }
}

function renderOrgDashboard() {
    // Metrics
    const totalSucursales = orgData.branches.length;
    const totalEmployees = orgData.employees.length;

    // Calculate Quotas vs Actual
    let totalQuotas = 0;
    orgData.branches.forEach(b => {
        const quotas = b.quotas || {};
        totalQuotas += Object.values(quotas).reduce((sum, val) => sum + (Number(val) || 0), 0);
    });

    // Fill Rate
    const fillRate = totalQuotas > 0 ? Math.round((totalEmployees / totalQuotas) * 100) : 0;

    document.getElementById('metric-total-sucursales').textContent = totalSucursales;
    document.getElementById('metric-total-active-emp').textContent = totalEmployees;
    document.getElementById('metric-fill-rate').textContent = `${fillRate}%`;

    // Chart: Employees per Branch
    renderOrgChart();
}

function renderOrgChart() {
    const ctx = document.getElementById('orgChartBranches');
    if (!ctx) return;

    // Count employees per branch
    const counts = {};
    orgData.branches.forEach(b => counts[b.id] = 0);

    orgData.employees.forEach(e => {
        const effectiveBranchId = (e.isTempTransfer && e.tempSucursalId) ? e.tempSucursalId : e.sucursalId;
        if (effectiveBranchId && counts[effectiveBranchId] !== undefined) {
            counts[effectiveBranchId]++;
        }
    });

    const labels = orgData.branches.map(b => b.name);
    const data = orgData.branches.map(b => counts[b.id]);

    if (orgChartInstance) orgChartInstance.destroy();

    orgChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Empleados Activos',
                data: data,
                backgroundColor: '#6f42c1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderOrgGrid() {
    const container = document.getElementById('sucursales-grid');
    container.innerHTML = '';

    // Count employees per branch
    const counts = {};
    orgData.branches.forEach(b => counts[b.id] = 0);
    orgData.employees.forEach(e => {
        const effectiveBranchId = (e.isTempTransfer && e.tempSucursalId) ? e.tempSucursalId : e.sucursalId;
        if (effectiveBranchId) counts[effectiveBranchId] = (counts[effectiveBranchId] || 0) + 1;
    });

    orgData.branches.forEach(b => {
        const empCount = counts[b.id] || 0;
        const totalQuotas = Object.values(b.quotas || {}).reduce((s, v) => s + (Number(v) || 0), 0);

        // Status
        let statusColor = '#10b981'; // Green
        let statusText = 'Óptimo';
        if (empCount < totalQuotas) {
            statusColor = '#f59e0b'; // Yellow (Understaffed)
            statusText = 'Faltante';
        } else if (empCount > totalQuotas && totalQuotas > 0) {
            statusColor = '#ef4444'; // Red (Overstaffed)
            statusText = 'Excedente';
        } else if (totalQuotas === 0) {
            statusColor = '#64748b'; // Gray
            statusText = 'Sin Plazas';
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '10px';
        card.style.borderTop = `4px solid ${statusColor}`;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h3 style="margin: 0; font-size: 1.1rem;">${b.name}</h3>
                    <small style="color: var(--text-muted);">ID: ${b.id}</small>
                </div>
                <div style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">
                    ${statusText}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center;">
                    <span style="display: block; font-size: 1.2rem; font-weight: bold;">${empCount}</span>
                    <small style="color: var(--text-muted);">Empleados</small>
                </div>
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center;">
                    <span style="display: block; font-size: 1.2rem; font-weight: bold;">${totalQuotas}</span>
                    <small style="color: var(--text-muted);">Plazas Meta</small>
                </div>
            </div>

            <div style="margin-top: auto; padding-top: 15px;">
                <button class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center;"
                    onclick="openQuotaModal('${b.id}', '${b.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-cog"></i> Configurar Plazas
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}


// --- Legacy / Global Functions ---

async function loadSucursales() {
    const tableBody = document.getElementById('sucursalesTableBody');
    if (!tableBody) return; // Not in quotas view

    tableBody.innerHTML = '';

    if (orgData.branches.length === 0) await loadOrgData();

    // Emp counts for table
    const counts = {};
    orgData.employees.forEach(e => {
        const effectiveBranchId = (e.isTempTransfer && e.tempSucursalId) ? e.tempSucursalId : e.sucursalId;
        if (effectiveBranchId) counts[effectiveBranchId] = (counts[effectiveBranchId] || 0) + 1;
    });

    orgData.branches.forEach(s => {
        const quotas = s.quotas || {};
        const totalQuotas = Object.values(quotas).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const activeCount = counts[s.id] || 0;

        let statusHtml = '<span style="color: #10b981;">Completo</span>';
        if (activeCount < totalQuotas) statusHtml = `<span style="color: #f59e0b;">Faltan ${totalQuotas - activeCount}</span>`;
        if (activeCount > totalQuotas && totalQuotas > 0) statusHtml = `<span style="color: #ef4444;">Excede ${activeCount - totalQuotas}</span>`;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td style="padding: 12px;"><strong>${s.name}</strong></td>
            <td style="padding: 12px; text-align: center;">
                <span style="background: var(--primary-light); color: var(--primary); padding: 4px 12px; border-radius: 20px; font-weight: 600;">
                    ${totalQuotas} plazas
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">${activeCount}</td>
             <td style="padding: 12px; text-align: center;">${statusHtml}</td>
            <td style="padding: 12px; text-align: center;">
                <button class="btn btn-secondary btn-sm" onclick="openQuotaModal('${s.id}', '${s.name.replace(/'/g, "\\'")}')" style="padding: 6px 12px; font-size: 0.85rem;">
                    <i class="fas fa-edit"></i> Editar
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Keep existing modal logic
async function openQuotaModal(sucursalId, sucursalName) {
    const modal = document.getElementById('quotaModal');
    const container = document.getElementById('quotaInputsContainer');
    const nameSpan = document.getElementById('targetSucursalName');
    const idInput = document.getElementById('quotaSucursalId');

    nameSpan.textContent = sucursalName;
    idInput.value = sucursalId;
    container.innerHTML = '<p class="text-muted">Cargando puestos...</p>';

    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; modal.style.pointerEvents = 'auto'; }, 10);

    try {
        // Reuse orgData if available, allowing lighter loads
        let sucursal = orgData.branches.find(b => b.id === sucursalId);
        if (!sucursal) {
            const doc = await db.collection('sucursales').doc(sucursalId).get();
            sucursal = { id: doc.id, ...doc.data() };
        }

        const currentQuotas = sucursal.quotas || {};

        let positions = orgData.positions;
        if (positions.length === 0) {
            const pSnap = await db.collection('positions').get();
            positions = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            orgData.positions = positions;
        }

        container.innerHTML = '';
        positions.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
            const quotaValue = currentQuotas[p.id] || 0;
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.padding = '8px';
            div.style.background = '#f8fafc';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid var(--border)';

            div.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-main);">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${p.departamento || ''}</div>
                </div>
                <div style="width: 80px;">
                    <input type="number" class="quota-input" data-position-id="${p.id}" value="${quotaValue}" min="0"
                        style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; text-align: center; font-weight: 600;">
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error("Error opening quota modal:", error);
        container.innerHTML = '<p style="color: var(--danger);">Error al cargar puestos.</p>';
    }
}

function closeQuotaModal() {
    const modal = document.getElementById('quotaModal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.style.display = 'none', 300);
}

async function saveQuotas() {
    const sucursalId = document.getElementById('quotaSucursalId').value;
    const inputs = document.querySelectorAll('.quota-input');
    const quotas = {};

    inputs.forEach(input => {
        const posId = input.getAttribute('data-position-id');
        const value = parseInt(input.value) || 0;
        if (value > 0) quotas[posId] = value;
    });

    try {
        Swal.fire({
            title: 'Guardando plazas...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        await db.collection('sucursales').doc(sucursalId).update({
            quotas: quotas
        });

        // Update local cache
        const index = orgData.branches.findIndex(b => b.id === sucursalId);
        if (index > -1) orgData.branches[index].quotas = quotas;

        Swal.fire({
            icon: 'success',
            title: 'Plazas actualizadas',
            timer: 1500,
            showConfirmButton: false
        });

        closeQuotaModal();

        // Refresh Current View
        const activeTab = document.querySelector('.btn-tab.active');
        if (activeTab && activeTab.id === 'tab-org-dashboard') renderOrgDashboard();
        if (activeTab && activeTab.id === 'tab-org-sucursales') renderOrgGrid();
        if (activeTab && activeTab.id === 'tab-org-quotas') loadSucursales();

    } catch (error) {
        console.error("Error saving quotas:", error);
        Swal.fire('Error', 'No se pudieron guardar las plazas', 'error');
    }
}
