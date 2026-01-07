// gestionar.js - SIA Rediseño Corporativo
// db is already initialized in connection.js

// Global State
let providersData = [];
let productsData = [];

// DOM Elements
const providersGrid = document.getElementById('providersGrid');
const productsGrid = document.getElementById('productsGrid');
const providerSearchInput = document.getElementById('providerSearchInput');
const productSearchInput = document.getElementById('productSearchInput');
const productProviderFilter = document.getElementById('productProviderFilter');
const providerSelect = document.getElementById('providerSelect');

// -- Initialization --
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    await loadInitialData();
    renderDashboard();
}

async function loadInitialData() {
    try {
        const [provSnap, prodSnap] = await Promise.all([
            db.collection('providers').get(),
            db.collection('products').get()
        ]);

        providersData = provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        productsData = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort data
        providersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        productsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        populateProviderDropdowns();
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

// -- Tab Management --
function switchTab(tab) {
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Views
    document.querySelectorAll('.tab-view').forEach(view => view.style.display = 'none');
    document.getElementById(`view-${tab}`).style.display = 'block';

    // Load content
    if (tab === 'resumen') renderDashboard();
    if (tab === 'proveedores') renderProviders();
    if (tab === 'productos') renderProducts();
}

// -- Dashboard --
function renderDashboard() {
    document.getElementById('count-providers').textContent = providersData.length;
    document.getElementById('count-products').textContent = productsData.length;

    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    // Count products per provider
    const counts = {};
    productsData.forEach(p => {
        const provider = providersData.find(prov => prov.id === p.providerId);
        const name = provider ? provider.name : 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    // Destroy existing chart if any
    if (window.dashChart) window.dashChart.destroy();

    window.dashChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Productos por Proveedor',
                data: data,
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// -- Provider Management --
function renderProviders() {
    providersGrid.innerHTML = '';
    const filter = providerSearchInput.value.toLowerCase();

    const filtered = providersData.filter(p =>
        (p.name || '').toLowerCase().includes(filter) ||
        (p.sellerName || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
        providersGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron proveedores.</div>`;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-header">
                <h3 class="item-title">${p.name}</h3>
                <span class="item-badge">${(p.type || 'General')}</span>
            </div>
            <div class="item-details">
                <div class="detail-row"><i class="fas fa-map-marker-alt"></i> ${p.address || 'N/A'}</div>
                <div class="detail-row"><i class="fas fa-phone"></i> ${p.phone || 'N/A'}</div>
                <div class="detail-row"><i class="fas fa-user-tie"></i> ${p.sellerName || 'N/A'} (${p.sellerPhone || ''})</div>
                <div class="detail-row"><i class="fas fa-credit-card"></i> ${p.preferredPaymentMethod || 'N/A'} - ${p.paymentTerms || ''}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewProviderDetails('${p.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="showEditProviderForm('${p.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" style="padding: 8px 12px;" onclick="deleteProvider('${p.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        providersGrid.appendChild(card);
    });
}

function filterProviders() {
    renderProviders();
}

async function addProvider() {
    // Handled by form submission in redesigned version
}

// Fixed logic for modals
function showModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'none';
    if (id === 'addProviderModal') document.getElementById('addProviderForm').reset();
    if (id === 'addProductModal') {
        document.getElementById('productForm').reset();
        document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
        document.getElementById('editProductId').value = '';
    }
}

// -- Form Listeners --
document.getElementById('addProviderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('providerName').value,
        phone: document.getElementById('providerPhone').value,
        email: document.getElementById('providerEmail').value,
        address: document.getElementById('providerAddress').value,
        sellerName: document.getElementById('sellerName').value,
        sellerPhone: document.getElementById('sellerPhone').value,
        preferredPaymentMethod: document.getElementById('preferredPaymentMethod').value,
        paymentTerms: document.getElementById('providerPaymentTerms').value,
        additionalNotes: document.getElementById('additionalNotes').value
    };

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await db.collection('providers').add(data);
        await loadInitialData();
        closeModal('addProviderModal');
        Swal.fire('Éxito', 'Proveedor guardado correctamente', 'success');
        if (document.getElementById(`tab-proveedores`).classList.contains('active')) renderProviders();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
});

// -- Product Management --
function renderProducts() {
    productsGrid.innerHTML = '';
    const search = productSearchInput.value.toLowerCase();
    const provFilter = productProviderFilter.value;

    const filtered = productsData.filter(p => {
        const matchesSearch = (p.name || '').toLowerCase().includes(search) || (p.presentation || '').toLowerCase().includes(search);
        const matchesProv = !provFilter || p.providerId === provFilter;
        return matchesSearch && matchesProv;
    });

    if (filtered.length === 0) {
        productsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron productos.</div>`;
        return;
    }

    filtered.forEach(p => {
        const provider = providersData.find(prov => prov.id === p.providerId);
        const providerName = provider ? provider.name : 'Desconocido';

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-header">
                <div>
                    <h3 class="item-title">${p.name}</h3>
                    <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-top: 4px;">
                        ${providerName}
                    </div>
                </div>
                <i class="fas fa-box" style="color: #cbd5e1; font-size: 1.25rem;"></i>
            </div>
            <div class="item-details">
                <div class="detail-row"><i class="fas fa-layer-group"></i> ${p.presentation || 'Sin presentación'}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="showEditProductForm('${p.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" style="padding: 8px 12px;" onclick="deleteProduct('${p.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

function filterProducts() {
    renderProducts();
}

function populateProviderDropdowns() {
    providerSelect.innerHTML = '<option value="">Seleccione un proveedor</option>';
    productProviderFilter.innerHTML = '<option value="">Todos los Proveedores</option>';

    providersData.forEach(p => {
        const opt = `<option value="${p.id}">${p.name}</option>`;
        providerSelect.innerHTML += opt;
        productProviderFilter.innerHTML += opt;
    });
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editProductId').value;
    const data = {
        name: document.getElementById('productName').value,
        presentation: document.getElementById('productPresentation').value,
        providerId: document.getElementById('providerSelect').value
    };

    try {
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        if (id) {
            await db.collection('products').doc(id).update(data);
        } else {
            await db.collection('products').add(data);
        }

        await loadInitialData();
        closeModal('addProductModal');
        Swal.fire('Éxito', 'Producto guardado correctamente', 'success');
        if (document.getElementById(`tab-productos`).classList.contains('active')) renderProducts();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
});

// -- Edit/Delete/View Helpers --
async function showEditProviderForm(id) {
    const p = providersData.find(item => item.id === id);
    if (!p) return;

    // We reuse addProviderModal for editing in this simplified redesign, but for consistency with original fields:
    // Actually, let's just use Swal for quick edit or implement a dedicated modal.
    // Given the variety of fields, Swal.fire with custom HTML is better for "Quick Edit"
    // or just populate the existing modal.

    document.getElementById('providerName').value = p.name || '';
    document.getElementById('providerPhone').value = p.phone || '';
    document.getElementById('providerEmail').value = p.email || '';
    document.getElementById('providerAddress').value = p.address || '';
    document.getElementById('sellerName').value = p.sellerName || '';
    document.getElementById('sellerPhone').value = p.sellerPhone || '';
    document.getElementById('preferredPaymentMethod').value = p.preferredPaymentMethod || '';
    document.getElementById('providerPaymentTerms').value = p.paymentTerms || '';
    document.getElementById('additionalNotes').value = p.additionalNotes || '';

    // Change title and button for submt
    document.querySelector('#addProviderModal h2').textContent = 'Editar Proveedor';
    const form = document.getElementById('addProviderForm');

    // Create a one-time submit handler to update instead of add
    const originalHandler = form.onsubmit;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const updatedData = {
            name: document.getElementById('providerName').value,
            phone: document.getElementById('providerPhone').value,
            email: document.getElementById('providerEmail').value,
            address: document.getElementById('providerAddress').value,
            sellerName: document.getElementById('sellerName').value,
            sellerPhone: document.getElementById('sellerPhone').value,
            preferredPaymentMethod: document.getElementById('preferredPaymentMethod').value,
            paymentTerms: document.getElementById('providerPaymentTerms').value,
            additionalNotes: document.getElementById('additionalNotes').value
        };
        try {
            await db.collection('providers').doc(id).update(updatedData);
            await loadInitialData();
            closeModal('addProviderModal');
            Swal.fire('Actualizado', 'Datos actualizados', 'success');
            renderProviders();
            form.onsubmit = null; // Reset
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }

    showModal('addProviderModal');
}

async function deleteProvider(id) {
    const result = await Swal.fire({
        title: '¿Eliminar proveedor?',
        text: "Esto no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('providers').doc(id).delete();
            await loadInitialData();
            renderProviders();
            Swal.fire('Eliminado', 'El proveedor ha sido quitado', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
}

function showEditProductForm(id) {
    const p = productsData.find(item => item.id === id);
    if (!p) return;

    document.getElementById('editProductId').value = id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productPresentation').value = p.presentation;
    document.getElementById('providerSelect').value = p.providerId;
    document.getElementById('productModalTitle').textContent = 'Editar Producto';

    showModal('addProductModal');
}

async function deleteProduct(id) {
    const result = await Swal.fire({
        title: '¿Eliminar producto?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('products').doc(id).delete();
            await loadInitialData();
            renderProducts();
            Swal.fire('Eliminado', 'Producto eliminado', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
}

function viewProviderDetails(id) {
    const p = providersData.find(item => item.id === id);
    if (!p) return;

    Swal.fire({
        title: `<strong>${p.name}</strong>`,
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <p><b>Dirección:</b> ${p.address || 'N/A'}</p>
                <p><b>Teléfono:</b> ${p.phone || 'N/A'}</p>
                <p><b>Email:</b> ${p.email || 'N/A'}</p>
                <hr>
                <p><b>Vendedor:</b> ${p.sellerName || 'N/A'}</p>
                <p><b>Tel Vendedor:</b> ${p.sellerPhone || 'N/A'}</p>
                <p><b>Pago:</b> ${p.preferredPaymentMethod || 'N/A'}</p>
                <p><b>Términos:</b> ${p.paymentTerms || 'N/A'}</p>
                <hr>
                <p><b>Notas:</b> ${p.additionalNotes || 'Ninguna'}</p>
            </div>
        `,
        confirmButtonText: 'Cerrar'
    });
}