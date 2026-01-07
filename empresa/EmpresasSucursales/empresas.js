// empresas.js - Redesigned
// db is already initialized in connection.js

// Global State
let companiesData = [];
let branchesData = [];
let employeesData = [];

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    initDashboard();
});

function switchTab(tabId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    // Deselect tabs
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    // Show Target
    const target = document.getElementById(`view-${tabId}`);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }

    // Select Tab Button
    const btn = document.querySelector(`.nav-tab[onclick*="${tabId}"]`);
    if (btn) btn.classList.add('active');

    // Trigger Loaders
    if (tabId === 'dashboard') loadDashboardMetrics();
    if (tabId === 'empresas') loadEmpresas();
    if (tabId === 'sucursales') loadSucursales();
}

async function initDashboard() {
    await Promise.all([
        loadEmpresasSelectOptions(), // For modals
        loadDashboardMetrics()
    ]);
}

async function loadDashboardMetrics() {
    try {
        const [empSnap, sucSnap, emplSnap] = await Promise.all([
            db.collection('empresas').get(),
            db.collection('sucursales').get(),
            db.collection('employees').where('status', '==', 'active').get()
        ]);

        companiesData = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        branchesData = sucSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        employeesData = emplSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Render Metrics
        document.getElementById('dashTotalEmpresas').textContent = companiesData.length;
        document.getElementById('dashTotalSucursales').textContent = branchesData.length;
        document.getElementById('dashTotalEmployees').textContent = employeesData.length;

        renderDashboardChart();

    } catch (error) {
        console.error("Dashboard Error:", error);
    }
}

function renderDashboardChart() {
    const ctx = document.getElementById('chartEmpresas');
    if (!ctx) return;

    // Count branches per company
    const counts = {};
    companiesData.forEach(c => counts[c.id] = 0);
    branchesData.forEach(b => {
        if (counts[b.empresaId] !== undefined) counts[b.empresaId]++;
    });

    const labels = companiesData.map(c => c.name);
    const data = companiesData.map(c => counts[c.id] || 0);

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sucursales',
                data: data,
                backgroundColor: '#4f46e5',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

// === EMPRESAS VIEW ===

async function loadEmpresas() {
    const container = document.getElementById('empresasGrid');
    container.innerHTML = '<p>Cargando...</p>';

    try {
        const snap = await db.collection('empresas').get();
        companiesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        container.innerHTML = '';
        companiesData.forEach(comp => {
            const card = document.createElement('div');
            card.className = 'item-card';

            const statusClass = comp.status === 'activo' ? 'status-active' : 'status-inactive';

            card.innerHTML = `
                <div class="item-card-header">
                    <div class="item-icon"><i class="fas fa-building"></i></div>
                    <span class="status-badge ${statusClass}">${comp.status}</span>
                </div>
                <div class="item-title">${comp.name}</div>
                <div class="item-subtitle">${comp.phone || 'Sin teléfono'}</div>
                <div class="item-body">
                    <p>${comp.address || ''}</p>
                    <small style="color:var(--text-muted)">${comp.email || ''}</small>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="openEditEmpresaModal('${comp.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEmpresa('${comp.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:red">Error al cargar empresas</p>';
    }
}

// === SUCURSALES VIEW ===

async function loadSucursales() {
    const container = document.getElementById('sucursalesGrid');
    const filter = document.getElementById('sucursalFilter').value;

    container.innerHTML = '<p>Cargando...</p>';

    try {
        let query = db.collection('sucursales');
        if (filter) query = query.where('empresaId', '==', filter);

        const snap = await query.get();
        const branches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Get company names map if not loaded
        if (companiesData.length === 0) {
            const cSnap = await db.collection('empresas').get();
            companiesData = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        const compMap = {};
        companiesData.forEach(c => compMap[c.id] = c.name);

        container.innerHTML = '';
        branches.forEach(br => {
            const card = document.createElement('div');
            card.className = 'item-card';
            const statusClass = br.status === 'activo' ? 'status-active' : 'status-inactive';
            const compName = compMap[br.empresaId] || 'Sin Empresa';

            card.innerHTML = `
                <div class="item-card-header">
                    <div class="item-icon" style="background:#fef3c7; color:#d97706;">
                        <i class="fas fa-store"></i>
                    </div>
                    <span class="status-badge ${statusClass}">${br.status}</span>
                </div>
                <div class="item-title">${br.name}</div>
                <div class="item-subtitle">${compName}</div>
                <div class="item-body">
                    <p><strong>Enc:</strong> ${br.encargado || '-'}</p>
                    <p style="font-size:0.85em">${br.address || ''}</p>
                    <small style="color:var(--text-muted)">${br.phone || ''}</small>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-sm" onclick="openQuotaModal('${br.id}', '${br.name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-users"></i> Plazas
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditSucursalModal('${br.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSucursal('${br.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:red">Error al cargar sucursales</p>';
    }
}

// === CRUD OPERATIONS (Retrofitted) ===

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function addEmpresa() {
    const data = {
        name: document.getElementById('empresaName').value,
        address: document.getElementById('empresaAddress').value,
        phone: document.getElementById('empresaPhone').value,
        email: document.getElementById('empresaEmail').value,
        creationDate: document.getElementById('empresaCreationDate').value,
        description: document.getElementById('empresaDescription').value,
        status: document.getElementById('empresaStatus').value
    };

    if (!data.name) return Swal.fire('Error', 'Nombre requerido', 'error');

    try {
        await db.collection('empresas').add(data);
        closeModal('addEmpresaModal');
        Swal.fire('Éxito', 'Empresa agregada', 'success');
        loadEmpresas();
        loadEmpresasSelectOptions();
        loadDashboardMetrics();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', e.message, 'error');
    }
}

async function addSucursal() {
    const data = {
        empresaId: document.getElementById('empresaSelect').value,
        name: document.getElementById('sucursalName').value,
        address: document.getElementById('sucursalAddress').value,
        phone: document.getElementById('sucursalPhone').value,
        email: document.getElementById('sucursalEmail').value,
        creationDate: document.getElementById('sucursalCreationDate').value,
        encargado: document.getElementById('sucursalEncargado').value,
        description: document.getElementById('sucursalDescription').value,
        status: document.getElementById('sucursalStatus').value
    };

    if (!data.name || !data.empresaId) return Swal.fire('Error', 'Nombre y Empresa requeridos', 'error');

    try {
        await db.collection('sucursales').add(data);
        closeModal('addSucursalModal');
        Swal.fire('Éxito', 'Sucursal agregada', 'success');
        loadSucursales();
        loadDashboardMetrics();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', e.message, 'error');
    }
}

// Populators for Edit
async function openEditEmpresaModal(id) {
    const doc = await db.collection('empresas').doc(id).get();
    const data = doc.data();

    document.getElementById('editEmpresaId').value = id;
    document.getElementById('editEmpresaName').value = data.name;
    document.getElementById('editEmpresaAddress').value = data.address;
    document.getElementById('editEmpresaPhone').value = data.phone;
    document.getElementById('editEmpresaEmail').value = data.email;
    document.getElementById('editEmpresaCreationDate').value = data.creationDate;
    document.getElementById('editEmpresaDescription').value = data.description;
    document.getElementById('editEmpresaStatus').value = data.status;

    openModal('editEmpresaModal');
}

async function openEditSucursalModal(id) {
    const doc = await db.collection('sucursales').doc(id).get();
    const data = doc.data();

    document.getElementById('editSucursalId').value = id;
    document.getElementById('editEmpresaSelect').value = data.empresaId;
    document.getElementById('editSucursalName').value = data.name;
    document.getElementById('editSucursalAddress').value = data.address;
    document.getElementById('editSucursalPhone').value = data.phone;
    document.getElementById('editSucursalEmail').value = data.email;
    document.getElementById('editSucursalCreationDate').value = data.creationDate;
    document.getElementById('editSucursalEncargado').value = data.encargado;
    document.getElementById('editSucursalDescription').value = data.description;
    document.getElementById('editSucursalStatus').value = data.status;

    openModal('editSucursalModal');
}

async function updateEmpresa() {
    const id = document.getElementById('editEmpresaId').value;
    const data = {
        name: document.getElementById('editEmpresaName').value,
        address: document.getElementById('editEmpresaAddress').value,
        phone: document.getElementById('editEmpresaPhone').value,
        email: document.getElementById('editEmpresaEmail').value,
        creationDate: document.getElementById('editEmpresaCreationDate').value,
        description: document.getElementById('editEmpresaDescription').value,
        status: document.getElementById('editEmpresaStatus').value
    };

    try {
        await db.collection('empresas').doc(id).update(data);
        closeModal('editEmpresaModal');
        Swal.fire('Actualizado', 'Datos guardados', 'success');
        loadEmpresas();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function updateSucursal() {
    const id = document.getElementById('editSucursalId').value;
    const data = {
        empresaId: document.getElementById('editEmpresaSelect').value,
        name: document.getElementById('editSucursalName').value,
        address: document.getElementById('editSucursalAddress').value,
        phone: document.getElementById('editSucursalPhone').value,
        email: document.getElementById('editSucursalEmail').value,
        creationDate: document.getElementById('editSucursalCreationDate').value,
        encargado: document.getElementById('editSucursalEncargado').value,
        description: document.getElementById('editSucursalDescription').value,
        status: document.getElementById('editSucursalStatus').value
    };

    try {
        await db.collection('sucursales').doc(id).update(data);
        closeModal('editSucursalModal');
        Swal.fire('Actualizado', 'Datos guardados', 'success');
        loadSucursales();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function deleteEmpresa(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Empresa?',
        text: "No se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await db.collection('empresas').doc(id).delete();
        loadEmpresas();
        Swal.fire('Eliminado', '', 'success');
    }
}

async function deleteSucursal(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Sucursal?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await db.collection('sucursales').doc(id).delete();
        loadSucursales();
        Swal.fire('Eliminado', '', 'success');
    }
}

// Helpers
async function loadEmpresasSelectOptions() {
    try {
        const snap = await db.collection('empresas').get();
        const selects = [document.getElementById('empresaSelect'), document.getElementById('editEmpresaSelect'), document.getElementById('sucursalFilter')];

        // Reset
        selects[0].innerHTML = '';
        selects[1].innerHTML = '';
        selects[2].innerHTML = '<option value="">Todas las Empresas</option>';

        snap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().name;
            selects[0].appendChild(opt.cloneNode(true));
            selects[1].appendChild(opt.cloneNode(true));
            selects[2].appendChild(opt.cloneNode(true));
        });
    } catch (e) {
        console.error(e);
    }
}

// Quota Logic Reuse (Simplified for Card View)
async function openQuotaModal(sucursalId, sucursalName) {
    document.getElementById('quotaSucursalId').value = sucursalId;
    document.getElementById('quotaModalSucursalName').textContent = sucursalName;
    const container = document.getElementById('quotaListContainer');
    container.innerHTML = '<p>Cargando puesto...</p>';

    openModal('quotaModal');

    // Load data
    const [posSnap, sucDoc, empSnap] = await Promise.all([
        db.collection('positions').orderBy('name').get(),
        db.collection('sucursales').doc(sucursalId).get(),
        db.collection('employees').where('sucursalId', '==', sucursalId).get()
    ]);

    const quotas = sucDoc.data().quotas || {};
    const employees = empSnap.docs.map(d => ({ ...d.data(), id: d.id }));

    let html = '';
    posSnap.forEach(doc => {
        const p = doc.data();
        const q = quotas[doc.id] || 0;
        const current = employees.filter(e => e.positionId === doc.id && e.status !== 'inactive').length;

        let color = '#ccc';
        if (q > 0) {
            if (current < q) color = '#f59e0b'; // missing
            else if (current > q) color = '#ef4444'; // over
            else color = '#10b981'; // ok
        }

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border-bottom:1px solid #eee;">
                <div>
                    <div style="font-weight:bold">${p.name}</div>
                    <div style="font-size:0.8em; color:#666">Actual: ${current}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:0.8em">Meta:</span>
                    <input type="number" class="quota-input form-control" data-pid="${doc.id}" value="${q}" style="width:70px; padding:4px;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${color}"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function saveQuotas() {
    const sid = document.getElementById('quotaSucursalId').value;
    const inputs = document.querySelectorAll('.quota-input');
    const quotas = {};
    inputs.forEach(i => {
        const val = parseInt(i.value) || 0;
        if (val > 0) quotas[i.dataset.pid] = val;
    });

    await db.collection('sucursales').doc(sid).update({ quotas });
    Swal.fire('Guardado', 'Plazas actualizadas', 'success');
    closeModal('quotaModal');
}
