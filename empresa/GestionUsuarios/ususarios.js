// ususarios.js - Rediseño Corporativo SIA
// db is already initialized in connection.js or initialized here if not present

// Global State
let usersData = [];
let branchesData = [];
let selectedUserId = null;
let userToDelete = null;

// DOM Elements
const usersGrid = document.getElementById('usersGrid');
const userForm = document.getElementById('user-form');
const userSelect = document.getElementById('sucursal');
const roleSelect = document.getElementById('rol');
const cancelEditBtn = document.getElementById('cancel-edit');

// Checkboxes
const permChangeStatus = document.getElementById('permChangeStatus');
const permEditOrder = document.getElementById('permEditOrder');
const permDeleteOrder = document.getElementById('permDeleteOrder');
const permDeleteReceipt = document.getElementById('permDeleteReceipt');

// Checkboxes Finanzas
const permFinViewHistorial = document.getElementById('permFinViewHistorial');
const permFinRegistrarPagos = document.getElementById('permFinRegistrarPagos');
const permFinManageSucursales = document.getElementById('permFinManageSucursales');
const permFinManageProveedores = document.getElementById('permFinManageProveedores');
const permFinManageUsuarios = document.getElementById('permFinManageUsuarios');

// -- Initialization --
document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
});

async function verificarAdmin() {
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    if (!usuarioLogueado) {
        window.location.href = "../../login.html";
        return;
    }

    try {
        const snap = await db.collection('usuarios').where('username', '==', usuarioLogueado).limit(1).get();
        if (snap.empty) {
            window.location.href = "../../login.html";
            return;
        }

        const userData = snap.docs[0].data();
        if (userData.rol !== 'administrador' && userData.rol !== 'bodega' && userData.rol !== 'view') {
            Swal.fire('Acceso Denegado', 'No tienes permisos para esta sección', 'error').then(() => {
                window.location.href = "../../empresa/empresaMenu.html";
            });
            return;
        }

        init();
    } catch (e) {
        console.error("Auth error:", e);
        window.location.href = "../../login.html";
    }
}

async function init() {
    await loadInitialData();
    renderDashboard();
}

async function loadInitialData() {
    try {
        const [usersSnap, branchesSnap] = await Promise.all([
            db.collection('usuarios').get(),
            db.collection('sucursales').get()
        ]);

        usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        branchesData = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        populateBranchSelect();
    } catch (e) {
        console.error("Load error:", e);
    }
}

// -- Tab Management --
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    document.querySelectorAll('.tab-view').forEach(view => view.style.display = 'none');
    document.getElementById(`view-${tab}`).style.display = 'block';

    if (tab === 'resumen') renderDashboard();
    if (tab === 'usuarios') renderUsers();
}

// -- Dashboard --
function renderDashboard() {
    document.getElementById('count-total-users').textContent = usersData.length;

    const rolesCount = { administrador: 0, usuario: 0, bodega: 0, view: 0 };
    usersData.forEach(u => {
        if (rolesCount[u.rol] !== undefined) rolesCount[u.rol]++;
    });

    document.getElementById('count-admins').textContent = rolesCount.administrador;
    document.getElementById('count-standard').textContent = rolesCount.usuario;

    renderRoleChart(rolesCount);
}

function renderRoleChart(counts) {
    const ctx = document.getElementById('rolesChart').getContext('2d');
    if (window.rolesChartInstance) window.rolesChartInstance.destroy();

    window.rolesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Admin', 'Usuario', 'Bodega', 'Solo Ver'],
            datasets: [{
                data: [counts.administrador, counts.usuario, counts.bodega, counts.view],
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#64748b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '70%'
        }
    });
}

// -- User Rendering --
function renderUsers() {
    usersGrid.innerHTML = '';
    const filter = document.getElementById('userSearchInput').value.toLowerCase();

    const filtered = usersData.filter(u => u.username.toLowerCase().includes(filter));

    if (filtered.length === 0) {
        usersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron usuarios.</div>';
        return;
    }

    filtered.forEach(u => {
        const branch = branchesData.find(b => b.id === u.sucursalId);
        const branchName = branch ? branch.name : 'N/A';
        const roleLabel = getRoleLabel(u.rol);

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-avatar" style="background: ${getRoleColor(u.rol)}15; color: ${getRoleColor(u.rol)};">
                    <i class="fas fa-user"></i>
                </div>
                <div>
                    <h3 class="item-title">${u.username}</h3>
                    <span class="user-role-badge" style="background: ${getRoleColor(u.rol)}15; color: ${getRoleColor(u.rol)};">${roleLabel}</span>
                </div>
            </div>
            <div class="item-details">
                <div class="detail-row"><i class="fas fa-store"></i> <b>Sucursal:</b> ${branchName}</div>
                <div class="detail-row"><i class="fas fa-key"></i> <b>Permisos:</b> ${countPermissions(u.permisos)} activos</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewUserDetails('${u.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="showEditUserForm('${u.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" style="padding: 8px 12px;" onclick="deleteUser('${u.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        usersGrid.appendChild(card);
    });
}

function getRoleLabel(role) {
    const roles = { administrador: 'Admin', usuario: 'Usuario', bodega: 'Bodega', view: 'Solo Ver' };
    return roles[role] || role;
}

function getRoleColor(role) {
    const colors = { administrador: '#4f46e5', usuario: '#10b981', bodega: '#f59e0b', view: '#64748b' };
    return colors[role] || '#4f46e5';
}

function countPermissions(p) {
    if (!p) return 0;
    return Object.values(p).filter(v => v === true).length;
}

// -- Form Management --
function populateBranchSelect() {
    userSelect.innerHTML = '<option value="" disabled selected>Selecciona una Sucursal</option>';
    branchesData.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        userSelect.appendChild(opt);
    });
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const rol = roleSelect.value;
    const sucursalId = userSelect.value;

    if (!username || (!id && !password) || !rol || !sucursalId) {
        Swal.fire('Error', 'Todos los campos marcados con * son obligatorios', 'error');
        return;
    }

    const permisos = {
        canChangeStatus: permChangeStatus.checked,
        canEditOrder: permEditOrder.checked,
        canDeleteOrder: permDeleteOrder.checked,
        canDeleteReceipt: permDeleteReceipt.checked
    };

    const permisosFinanzas = {
        canViewHistorialPagos: permFinViewHistorial.checked,
        canRegistrarPagos: permFinRegistrarPagos.checked,
        canManageSucursales: permFinManageSucursales.checked,
        canManageProveedores: permFinManageProveedores.checked,
        canManageUsuarios: permFinManageUsuarios.checked
    };

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const data = {
            username,
            rol,
            sucursalId,
            permisos,
            permisosFinanzas
        };

        if (password) {
            data.password = CryptoJS.SHA256(password).toString();
        }

        if (id) {
            await db.collection('usuarios').doc(id).update(data);
        } else {
            // Check duplicate
            const check = await db.collection('usuarios').where('username', '==', username).limit(1).get();
            if (!check.empty) throw new Error('El nombre de usuario ya existe');
            await db.collection('usuarios').add(data);
        }

        await loadInitialData();
        closeModal('addUserModal');
        Swal.fire('Éxito', id ? 'Usuario actualizado' : 'Usuario creado', 'success');
        if (document.getElementById('tab-usuarios').classList.contains('active')) renderUsers();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// -- Helpers --
function showModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    if (id === 'addUserModal') resetUserForm();
}

function resetUserForm() {
    userForm.reset();
    document.getElementById('user-id').value = '';
    document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
    document.getElementById('password').required = true;
    enableCheckboxes(true);
}

function showEditUserForm(id) {
    const u = usersData.find(item => item.id === id);
    if (!u) return;

    document.getElementById('user-id').value = u.id;
    document.getElementById('username').value = u.username;
    document.getElementById('password').value = '';
    document.getElementById('password').required = false; // Optional on edit
    roleSelect.value = u.rol;
    userSelect.value = u.sucursalId;

    if (u.permisos) {
        permChangeStatus.checked = !!u.permisos.canChangeStatus;
        permEditOrder.checked = !!u.permisos.canEditOrder;
        permDeleteOrder.checked = !!u.permisos.canDeleteOrder;
        permDeleteReceipt.checked = !!u.permisos.canDeleteReceipt;
    }

    if (u.permisosFinanzas) {
        permFinViewHistorial.checked = !!u.permisosFinanzas.canViewHistorialPagos;
        permFinRegistrarPagos.checked = !!u.permisosFinanzas.canRegistrarPagos;
        permFinManageSucursales.checked = !!u.permisosFinanzas.canManageSucursales;
        permFinManageProveedores.checked = !!u.permisosFinanzas.canManageProveedores;
        permFinManageUsuarios.checked = !!u.permisosFinanzas.canManageUsuarios;
    } else {
        // Modo por defecto si es antiguo
        permFinViewHistorial.checked = false;
        permFinRegistrarPagos.checked = false;
        permFinManageSucursales.checked = false;
        permFinManageProveedores.checked = false;
        permFinManageUsuarios.checked = false;
    }

    document.getElementById('userModalTitle').textContent = 'Editar Usuario';
    handleRoleChange(); // Update disables
    showModal('addUserModal');
}

async function deleteUser(id) {
    const res = await Swal.fire({
        title: '¿Eliminar usuario?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'Sí, eliminar'
    });

    if (res.isConfirmed) {
        try {
            await db.collection('usuarios').doc(id).delete();
            await loadInitialData();
            renderUsers();
            Swal.fire('Eliminado', 'Usuario borrado exitosamente', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
}

function viewUserDetails(id) {
    const u = usersData.find(item => item.id === id);
    if (!u) return;

    Swal.fire({
        title: `<strong>${u.username}</strong>`,
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <p><b>Rol:</b> ${getRoleLabel(u.rol)}</p>
                <p><b>Sucursal:</b> ${branchesData.find(b => b.id === u.sucursalId)?.name || 'N/A'}</p>
                <hr>
                <p><b>Permisos:</b></p>
                <ul>
                    <li>Cambiar Estado: ${u.permisos?.canChangeStatus ? '✅' : '❌'}</li>
                    <li>Editar Pedido: ${u.permisos?.canEditOrder ? '✅' : '❌'}</li>
                    <li>Eliminar Pedido: ${u.permisos?.canDeleteOrder ? '✅' : '❌'}</li>
                    <li>Eliminar Recibo: ${u.permisos?.canDeleteReceipt ? '✅' : '❌'}</li>
                </ul>
                <hr>
                <p style="font-size: 0.7rem; color: #999;">Hash: ${u.password}</p>
            </div>
        `,
        confirmButtonText: 'Cerrar'
    });
}

function handleRoleChange() {
    const role = roleSelect.value;
    if (role === 'bodega' || role === 'view') {
        enableCheckboxes(false);
    } else {
        enableCheckboxes(true);
    }
}

function enableCheckboxes(enabled) {
    const boxes = [
        permChangeStatus, permEditOrder, permDeleteOrder, permDeleteReceipt,
        permFinViewHistorial, permFinRegistrarPagos, permFinManageSucursales,
        permFinManageProveedores, permFinManageUsuarios
    ];
    boxes.forEach(b => {
        b.disabled = !enabled;
        if (!enabled) b.checked = false;
    });
}

function filterUsers() {
    renderUsers();
}
