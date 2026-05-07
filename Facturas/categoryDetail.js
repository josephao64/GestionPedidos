// Gestión de Detalle de Categoría: Proveedores, Facturas y Estadísticas
let currentCategoryId = new URLSearchParams(window.location.search).get('id');
let currentCategory = null;
let categoryProviders = [];
let categoryInvoicesRaw = []; // Todas las facturas de la categoría (sin filtrar)
let categoryInvoices = [];    // Facturas filtradas por el periodo/sucursal seleccionado
let allSucursales = [];
let currentUser = localStorage.getItem('usuarioLogueado');

document.addEventListener('DOMContentLoaded', async () => {
  if (!currentUser) {
    window.location.href = '../login.html';
    return;
  }
  if (!currentCategoryId) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('user-display').textContent = `Usuario: ${currentUser}`;
  
  await loadInitialData();
  setupEventListeners();
});

async function loadInitialData() {
  try {
    // 1. Cargar info de la categoría
    const catDoc = await db.collection('invoice_categories').doc(currentCategoryId).get();
    if (!catDoc.exists) {
      Swal.fire('Error', 'Categoría no encontrada', 'error').then(() => window.location.href = 'index.html');
      return;
    }
    currentCategory = { id: catDoc.id, ...catDoc.data() };
    renderCategoryHeader();

    // 2. Cargar Sucursales (para filtros y modales)
    const sucSnap = await db.collection('sucursales').get();
    allSucursales = sucSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderSucursalSelects();

    // 3. Inicializar Filtros de Fecha (Mes/Año)
    initDateFilters();

    // 4. Cargar Facturas de esta categoría
    await loadInvoices();
    
    // 5. Cargar Proveedores
    await loadProviders();

    // 6. Aplicar filtros iniciales y renderizar
    applyFilters();



  } catch (error) {
    console.error("Error loading initial data:", error);
  }
}

function renderCategoryHeader() {
  document.getElementById('category-title').textContent = currentCategory.name;
  const badge = document.getElementById('category-badge');
  badge.textContent = 'Categoría Activa';
  badge.style.backgroundColor = currentCategory.color || '#2563eb';
}

function renderSucursalSelects() {
  const selects = [document.getElementById('filter-sucursal'), document.getElementById('inv-sucursal'), document.getElementById('quick-add-sucursal')];
  selects.forEach(select => {
    if (!select) return;
    const isFilter = select.id === 'filter-sucursal';
    const currentVal = select.value;
    select.innerHTML = isFilter ? '<option value="">Todas las sucursales</option>' : '<option value="">Seleccione sucursal</option>';
    
    allSucursales.sort((a, b) => a.name.localeCompare(b.name)).forEach(suc => {
      const opt = document.createElement('option');
      opt.value = suc.id;
      opt.textContent = suc.name;
      // Compatibilidad con select de Quick Add si ya existía lógica que usa el nombre
      if (select.id === 'quick-add-sucursal') opt.setAttribute('data-id', suc.id); 
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  });
}

function initDateFilters() {
  const now = new Date();
  const monthSelect = document.getElementById('filter-month');
  const yearSelect = document.getElementById('filter-year');
  if (!monthSelect || !yearSelect) return;

  monthSelect.value = now.getMonth();

  const currentYear = now.getFullYear();
  yearSelect.innerHTML = '';
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
  yearSelect.value = currentYear;
}

function applyFilters() {
  const monthSelect = document.getElementById('filter-month');
  const yearSelect = document.getElementById('filter-year');
  if (!monthSelect || !yearSelect) return;

  const selectedMonth = parseInt(monthSelect.value);
  const selectedYear = parseInt(yearSelect.value);
  const selectedSucursal = document.getElementById('filter-sucursal').value;

  categoryInvoices = categoryInvoicesRaw.filter(inv => {
    const fecha = inv.fechaEmision ? (inv.fechaEmision.toDate ? inv.fechaEmision.toDate() : new Date(inv.fechaEmision)) : new Date(0);
    const matchMonth = fecha.getMonth() === selectedMonth;
    const matchYear = fecha.getFullYear() === selectedYear;
    const matchSucursal = selectedSucursal ? inv.sucursalId === selectedSucursal : true;
    return matchMonth && matchYear && matchSucursal;
  });

  categoryInvoices.sort((a, b) => {
    const dA = a.fechaEmision ? (a.fechaEmision.toDate ? a.fechaEmision.toDate() : new Date(a.fechaEmision)) : new Date(0);
    const dB = b.fechaEmision ? (b.fechaEmision.toDate ? b.fechaEmision.toDate() : new Date(b.fechaEmision)) : new Date(0);
    return dB - dA;
  });

  renderInvoices();
  updateStats();
}


// --- TAB MANAGEMENT ---
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick').includes(tabId)) {
      b.classList.add('active');
    }
  });
  
  const targetTab = document.getElementById(`${tabId}-tab`);
  targetTab.classList.add('active');

  const globalFilters = document.querySelector('.global-filters');
  // Se mueve el bloque de filtros dinámicamente a la pestaña activa para diferenciar fuertemente las vistas.
  if (globalFilters) {
    if (tabId === 'providers') {
      globalFilters.style.display = 'none';
    } else {
      globalFilters.style.display = 'flex';
      const header = targetTab.querySelector('.section-header');
      if (header && header.nextSibling) {
        targetTab.insertBefore(globalFilters, header.nextSibling);
      } else {
        targetTab.appendChild(globalFilters);
      }
    }
  }

  if (tabId === 'stats') updateStats();
}




// --- PROVIDERS CRUD ---
let allSystemProviders = []; // Todos los proveedores del sistema

async function loadProviders() {
  // 1. Cargar todos los proveedores del sistema (para referencia interna si es necesario)
  const allSnap = await db.collection('providers').get();
  allSystemProviders = allSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. Filtrar ESTRICTAMENTE los de esta categoría
  categoryProviders = allSystemProviders.filter(p => p.categoryId === currentCategoryId);
  
  renderProviders();
  updateProviderSelect();
}



function renderProviders() {
  const list = document.getElementById('providers-list');
  list.innerHTML = '';
  
  if (categoryProviders.length === 0) {
    list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No hay proveedores en esta categoría.</p>';
    return;
  }

  categoryProviders.forEach(p => {
    const item = document.createElement('div');
    item.className = 'provider-item';
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <strong style="font-size: 1.1rem;">${p.name}</strong>
        <button class="btn-edit-cat" style="opacity:1; position:static;" onclick="openProviderModal('${p.id}')"><i class="fas fa-edit"></i></button>
      </div>
      <span style="font-size: 0.85rem; color: var(--text-muted);">NIT: ${p.nit || 'N/A'}</span>
      <span style="font-size: 0.85rem; color: var(--text-muted);">Contacto: ${p.contact || 'N/A'}</span>
    `;
    list.appendChild(item);
  });
}

function updateProviderSelect() {
  const select = document.getElementById('inv-provider');
  select.innerHTML = '<option value="">Seleccione proveedor</option>';
  // Ordenar alfabéticamente
  categoryProviders.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

}


function openProviderModal(id = null) {
  const modal = document.getElementById('modal-provider');
  modal.style.display = 'block';
  const btnDelete = document.getElementById('btn-delete-provider');

  if (id) {
    const p = categoryProviders.find(x => x.id === id);
    document.getElementById('provider-id').value = p.id;
    document.getElementById('provider-name').value = p.name;
    document.getElementById('provider-nit').value = p.nit || '';
    document.getElementById('provider-contact').value = p.contact || '';
    btnDelete.style.display = 'block';
  } else {
    document.getElementById('form-provider').reset();
    document.getElementById('provider-id').value = '';
    btnDelete.style.display = 'none';
  }
}

function closeProviderModal() {
  document.getElementById('modal-provider').style.display = 'none';
}

async function saveProvider(e) {
  e.preventDefault();
  const id = document.getElementById('provider-id').value;
  const data = {
    name: document.getElementById('provider-name').value.trim().toUpperCase(),
    nit: document.getElementById('provider-nit').value.trim().toUpperCase(),
    contact: document.getElementById('provider-contact').value.trim().toUpperCase(),
    categoryId: currentCategoryId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) await db.collection('providers').doc(id).update(data);
    else await db.collection('providers').add(data);
    
    await loadProviders();
    closeProviderModal();
    Swal.fire('Guardado', 'Proveedor actualizado', 'success');
  } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// --- INVOICES CRUD ---
async function loadInvoices() {
  const snap = await db.collection('facturas_pagar').where('categoryId', '==', currentCategoryId).get();
  categoryInvoicesRaw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  applyFilters();
}




function renderInvoices() {
  const tbody = document.getElementById('invoices-table-body');
  if(!tbody) return;
  tbody.innerHTML = '';

  if (categoryInvoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No se encontraron facturas.</td></tr>';
    return;
  }

  categoryInvoices.forEach(inv => {
    const fecha = inv.fechaEmision ? (inv.fechaEmision.toDate ? inv.fechaEmision.toDate() : new Date(inv.fechaEmision)) : new Date();
    
    // Preparar el desglose
    const prodDesc = (inv.items && inv.items.length > 0) ? inv.items.map(i => i.description || '').join('<br>') : '-';
    const prodQty = (inv.items && inv.items.length > 0) ? inv.items.map(i => i.quantity || 0).join('<br>') : '-';
    const prodPrice = (inv.items && inv.items.length > 0) ? inv.items.map(i => `Q ${(i.unitPrice||0).toFixed(2)}`).join('<br>') : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="vertical-align:top;">${fecha.toLocaleDateString()}</td>
      <td style="vertical-align:top;">${inv.proveedorNombre}</td>
      <td style="vertical-align:top;">${inv.numeroFactura}</td>
      <td style="vertical-align:top;">${inv.sucursalNombre}</td>
      <td style="vertical-align:top; line-height:1.6; max-width: 200px; white-space: normal; word-break: break-all;">${prodDesc}</td>
      <td style="vertical-align:top; line-height:1.6;">${prodQty}</td>
      <td style="vertical-align:top; line-height:1.6;">${prodPrice}</td>
      <td style="font-weight:700; vertical-align:top;">Q ${inv.total.toFixed(2)}</td>
      <td style="vertical-align:top;">
        <button class="btn-edit-cat" style="opacity:1; position:static;" onclick="openInvoiceModal('${inv.id}')"><i class="fas fa-eye"></i></button>
      </td>
    `;
    tbody.appendChild(row);
  });
}


function openInvoiceModal(id = null) {
  const modal = document.getElementById('modal-invoice');
  modal.style.display = 'block';
  const btnDelete = document.getElementById('btn-delete-invoice');

  if (id) {
    const inv = categoryInvoices.find(x => x.id === id);
    document.getElementById('invoice-id').value = inv.id;
    document.getElementById('inv-provider').value = inv.proveedorId;
    document.getElementById('inv-sucursal').value = inv.sucursalId;
    document.getElementById('inv-number').value = inv.numeroFactura;
    document.getElementById('inv-total').value = inv.total;
    
    const fecha = inv.fechaEmision ? (inv.fechaEmision.toDate ? inv.fechaEmision.toDate() : new Date(inv.fechaEmision)) : new Date();
    const fY = fecha.getFullYear();
    const fM = String(fecha.getMonth() + 1).padStart(2, '0');
    const fD = String(fecha.getDate()).padStart(2, '0');
    document.getElementById('inv-date').value = `${fY}-${fM}-${fD}`;
    
    btnDelete.style.display = 'block';
    renderInvoiceItems(inv.items || []);
  } else {
    document.getElementById('form-invoice').reset();
    document.getElementById('invoice-id').value = '';
    const now = new Date();
    document.getElementById('inv-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    btnDelete.style.display = 'none';
    renderInvoiceItems([]); 
  }
}

function renderInvoiceItems(items) {
  const tbody = document.getElementById('invoice-items-body');
  tbody.innerHTML = '';
  
  if (items.length === 0) {
    addItemRow();
  } else {
    items.forEach(item => addItemRow(item));
  }
}

function addItemRow(item = { description: '', quantity: 1, unitPrice: 0 }) {
  const tbody = document.getElementById('invoice-items-body');
  if (!tbody) return;
  const row = document.createElement('tr');
  const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
  
  row.innerHTML = `
    <td><input type="text" class="invoice-item-input item-desc" value="${item.description || ''}" placeholder="Producto/Servicio" required></td>
    <td><input type="number" class="invoice-item-input item-qty" value="${item.quantity || 0}" step="0.01" oninput="calculateRowTotal(this)" required></td>
    <td><input type="number" class="invoice-item-input item-price" value="${item.unitPrice || 0}" step="0.01" oninput="calculateRowTotal(this)" required></td>
    <td class="item-subtotal" style="font-weight: 600;">Q ${subtotal.toFixed(2)}</td>
    <td><button type="button" style="color: #ef4444; border:none; background:none; cursor:pointer;" onclick="this.closest('tr').remove(); calculateInvoiceTotal();"><i class="fas fa-trash"></i></button></td>
  `;
  tbody.appendChild(row);
  calculateInvoiceTotal();
}

function calculateRowTotal(input) {
  const row = input.closest('tr');
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const price = parseFloat(row.querySelector('.item-price').value) || 0;
  const subtotal = qty * price;
  row.querySelector('.item-subtotal').textContent = `Q ${subtotal.toFixed(2)}`;
  calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
  const rows = document.querySelectorAll('#invoice-items-body tr');
  let total = 0;
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    total += qty * price;
  });
  const totalInput = document.getElementById('inv-total');
  if (totalInput) totalInput.value = total.toFixed(2);
}


function closeInvoiceModal() {
  document.getElementById('modal-invoice').style.display = 'none';
}

async function saveInvoice(e) {
  e.preventDefault();
  const id = document.getElementById('invoice-id').value;
  const provSelect = document.getElementById('inv-provider');
  const sucSelect = document.getElementById('inv-sucursal');
  
  const items = [];
  document.querySelectorAll('#invoice-items-body tr').forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim().toUpperCase();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (desc) {
      items.push({ description: desc, quantity: qty, unitPrice: price });
    }
  });

  const selectedSuc = allSucursales.find(s => s.id === sucSelect.value);
  const empresaId = selectedSuc ? selectedSuc.empresaId : '';

  const data = {
    proveedorId: provSelect.value,
    proveedorNombre: provSelect.options[provSelect.selectedIndex].text.toUpperCase(),
    sucursalId: sucSelect.value,
    sucursalNombre: sucSelect.options[sucSelect.selectedIndex].text.toUpperCase(),
    empresaId: empresaId,
    categoryId: currentCategoryId, 
    numeroFactura: document.getElementById('inv-number').value.trim().toUpperCase(),
    total: parseFloat(document.getElementById('inv-total').value),
    saldoPendiente: parseFloat(document.getElementById('inv-total').value),
    estado: 'pendiente',
    items: items, 
    fechaEmision: new Date(document.getElementById('inv-date').value + "T12:00:00Z"),
    fechaVencimiento: new Date(new Date(document.getElementById('inv-date').value + "T12:00:00Z").getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 días
    creadoPor: currentUser,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      // Protect existing estado and saldoPendiente during update
      delete data.estado;
      delete data.saldoPendiente;
      await db.collection('facturas_pagar').doc(id).update(data);
    } else {
      data.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('facturas_pagar').add(data);
    }
    await loadInvoices();
    closeInvoiceModal();
    Swal.fire('Guardado', 'Factura registrada', 'success');
  } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

// --- STATS ---
function updateStats() {
  const totalGlobal = categoryInvoices.reduce((acc, current) => acc + current.total, 0);
  const totalPending = categoryInvoices.filter(i => i.estado === 'pendiente').reduce((acc, current) => acc + current.total, 0);
  const avgInvoice = categoryInvoices.length > 0 ? totalGlobal / categoryInvoices.length : 0;
  
  document.getElementById('stat-total-global').textContent = `Q ${totalGlobal.toFixed(2)}`;
  document.getElementById('stat-total-pending').textContent = `Q ${totalPending.toFixed(2)}`;
  document.getElementById('stat-avg-invoice').textContent = `Q ${avgInvoice.toFixed(2)}`;
  
  document.getElementById('stat-count-month').textContent = categoryInvoices.length;

  renderCharts(totalGlobal);
  renderTopProviders(totalGlobal);
}

let providerChart = null;
let sucursalChart = null;

function renderCharts(totalGlobal) {
  // Gasto por Proveedor
  const provCtx = document.getElementById('categoryChart').getContext('2d');
  if (providerChart) providerChart.destroy();
  
  const provLabels = categoryProviders.map(p => p.name);
  const provData = categoryProviders.map(p => {
    return categoryInvoices.filter(inv => inv.proveedorId === p.id).reduce((sum, inv) => sum + inv.total, 0);
  });

  providerChart = new Chart(provCtx, {
    type: 'bar',
    data: {
      labels: provLabels,
      datasets: [{
        label: 'Gasto por Proveedor',
        data: provData,
        backgroundColor: currentCategory.color || '#2563eb'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }

  });

  // Gasto por Sucursal
  const sucCtx = document.getElementById('sucursalChart').getContext('2d');
  if (sucursalChart) sucursalChart.destroy();

  const sucMap = {};
  categoryInvoices.forEach(inv => {
    sucMap[inv.sucursalNombre] = (sucMap[inv.sucursalNombre] || 0) + inv.total;
  });

  sucursalChart = new Chart(sucCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(sucMap),
      datasets: [{
        data: Object.values(sucMap),
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderTopProviders(totalGlobal) {
  const providersStats = categoryProviders.map(p => {
    const invoices = categoryInvoices.filter(inv => inv.proveedorId === p.id);
    const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
    return { name: p.name, count: invoices.length, total: total };
  });

  providersStats.sort((a, b) => b.total - a.total);
  const top5 = providersStats.slice(0, 5);

  const tbody = document.getElementById('top-providers-body');
  tbody.innerHTML = '';

  top5.forEach(p => {
    if (p.total === 0) return;
    const percent = totalGlobal > 0 ? (p.total / totalGlobal) * 100 : 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.count}</td>
      <td style="font-weight:600;">Q ${p.total.toFixed(2)}</td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="flex:1; height:8px; background:#e2e8f0; border-radius:10px; overflow:hidden;">
            <div style="width:${percent}%; height:100%; background:${currentCategory.color || '#2563eb'};"></div>
          </div>
          <span style="font-size:0.8rem; min-width:35px;">${percent.toFixed(1)}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}


function setupEventListeners() {
  document.getElementById('form-provider').onsubmit = saveProvider;
  document.getElementById('form-invoice').onsubmit = saveInvoice;
}

async function deleteProvider() {
  const id = document.getElementById('provider-id').value;
  if (!id) return;
  const p = categoryProviders.find(x => x.id === id);

  const confirm = await Swal.fire({
    title: '¿Eliminar proveedor?',
    text: `Se eliminará "${p.name}". Asegúrate de que no tenga facturas vinculadas.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirm.isConfirmed) return;

  try {
    const invSnap = await db.collection('facturas_pagar').where('proveedorId', '==', id).limit(1).get();
    if (!invSnap.empty) {
      Swal.fire('No permitido', 'Este proveedor tiene facturas registradas. Anula las facturas antes de eliminar al proveedor.', 'error');
      return;
    }

    await db.collection('providers').doc(id).delete();
    await loadProviders();
    closeProviderModal();
    Swal.fire('Eliminado', 'Proveedor eliminado correctamente', 'success');
  } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

async function deleteInvoice() {
  const id = document.getElementById('invoice-id').value;
  if (!id) return;
  
  const confirm = await Swal.fire({
    title: '¿Anular factura?',
    text: 'Esta acción eliminará el registro de la factura permanentemente.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, anular',
    cancelButtonText: 'Cancelar'
  });

  if (!confirm.isConfirmed) return;

  try {
    await db.collection('facturas_pagar').doc(id).delete();
    await loadInvoices();
    closeInvoiceModal();
    Swal.fire('Anulada', 'La factura ha sido eliminada', 'success');
  } catch (e) { Swal.fire('Error', e.message, 'error'); }
}

function openQuickAddModal() {
  document.getElementById('modal-quick-add').style.display = 'block';
  const select = document.getElementById('quick-add-sucursal');
  select.innerHTML = '<option value="">Seleccione sucursal</option>';
  allSucursales.sort((a, b) => a.name.localeCompare(b.name)).forEach(suc => {
    const opt = document.createElement('option');
    opt.value = suc.name; 
    opt.dataset.id = suc.id;
    opt.textContent = suc.name;
    select.appendChild(opt);
  });
  document.getElementById('quick-add-text').value = '';
}

function closeQuickAddModal() {
  document.getElementById('modal-quick-add').style.display = 'none';
}

async function processQuickAdd() {
  const sucursalSelect = document.getElementById('quick-add-sucursal');
  const sucursalName = sucursalSelect.value;
  const sucursalId = sucursalSelect.options[sucursalSelect.selectedIndex]?.dataset.id;
  const rawText = document.getElementById('quick-add-text').value.trim();
  
  if (!sucursalId || !rawText) {
    Swal.fire('Atención', 'Seleccione sucursal y pegue al menos una línea de texto', 'warning');
    return;
  }

  const lines = rawText.split('\n');
  let successCount = 0;
  let errorCount = 0;

  Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  for (const line of lines) {
    if (!line.trim()) continue;
    const separator = line.includes('\t') ? '\t' : '|';
    const partsRaw = line.split(separator).map(p => p.trim());
    const validParts = partsRaw.filter(p => p !== '');
    
    if (validParts.length < 5) {
      errorCount++;
      continue;
    }

    // Soporte para 5 o 6 columnas
    let fechaStr = validParts[0];
    let providerName = validParts[1].toUpperCase();
    let invoiceNum = validParts.length >= 6 ? validParts[2].toUpperCase() : "S/N";
    let producto = validParts[validParts.length - 3].toUpperCase();
    let cantStr = validParts[validParts.length - 2];
    let precioStr = validParts[validParts.length - 1];

    let d = new Date();
    if (fechaStr.includes('/')) {
      const dp = fechaStr.split('/');
      if (dp.length === 3) d = new Date(`${dp[2]}-${dp[1]}-${dp[0]}T12:00:00Z`);
    } else if (fechaStr.includes('-')) {
      d = new Date(`${fechaStr.trim()}T12:00:00Z`);
    } else {
      d = new Date(fechaStr);
    }

    const cantidad = parseFloat(cantStr) || 1;
    const precioU = parseFloat((precioStr || '').replace('Q', '').replace(',', '').trim()) || 0;
    const total = cantidad * precioU;
    
    // Buscar proveedor por nombre en la categoría actual
    let provider = categoryProviders.find(p => p.name.toLowerCase() === providerName.toLowerCase());
    
    if (!provider) {
      // Si no existe, lo creamos automáticamente en esta categoría
      try {
        const newProvRef = await db.collection('providers').add({
          name: providerName,
          categoryId: currentCategoryId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        provider = { id: newProvRef.id, name: providerName };
        categoryProviders.push(provider);
      } catch (e) {
        errorCount++;
        continue;
      }
    }

    const selectedSuc = allSucursales.find(s => s.id === sucursalId);
    const empresaId = selectedSuc ? selectedSuc.empresaId : '';

    try {
      await db.collection('facturas_pagar').add({
        proveedorId: provider.id,
        proveedorNombre: provider.name,
        sucursalId: sucursalId,
        sucursalNombre: sucursalName,
        empresaId: empresaId,
        categoryId: currentCategoryId, 
        numeroFactura: invoiceNum,
        total: total,
        saldoPendiente: total,
        estado: 'pendiente',
        items: [{
          description: producto,
          quantity: cantidad,
          unitPrice: precioU
        }],
        fechaEmision: isNaN(d.getTime()) ? new Date() : d,
        fechaVencimiento: isNaN(d.getTime()) ? new Date(new Date().getTime() + (30 * 24 * 60 * 60 * 1000)) : new Date(d.getTime() + (30 * 24 * 60 * 60 * 1000)),
        creadoPor: currentUser,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      successCount++;
    } catch (e) {
      errorCount++;
    }
  }

  await loadProviders(); // Recargar al final
  await loadInvoices();
  closeQuickAddModal();
  Swal.fire('Carga Finalizada', `Procesadas: ${successCount}\nErrores: ${errorCount}`, successCount > 0 ? 'success' : 'error');
}

async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    // 1. Título y Encabezado
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Primary color
    doc.text(`Reporte de Categoría: ${currentCategory.name}`, 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 15, 27);
    doc.text(`Generado por: ${currentUser}`, 15, 32);

    // 2. Resumen de Números
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumen General', 15, 45);
    
    const statsData = [
      ['Gasto Total', document.getElementById('stat-total-global').textContent],
      ['Total Pendiente', document.getElementById('stat-total-pending').textContent],
      ['Facturas este Mes', document.getElementById('stat-count-month').textContent],
      ['Promedio por Factura', document.getElementById('stat-avg-invoice').textContent]
    ];

    doc.autoTable({
      startY: 50,
      head: [['Concepto', 'Valor']],
      body: statsData,
      theme: 'grid',
      headStyles: { fillStyle: [37, 99, 235] }
    });

    // 3. Tabla Nativa de Top 5 Proveedores (CON BARRA DE PROGRESO VECTORIAL)
    const totalGlobal = categoryInvoices.reduce((acc, current) => acc + current.total, 0);
    const topData = categoryProviders.map(p => {
      const invs = categoryInvoices.filter(i => i.proveedorId === p.id);
      const sum = invs.reduce((acc, current) => acc + current.total, 0);
      return { name: p.name, count: invs.length, total: sum };
    }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

    const topTableData = topData.map(p => [
      p.name,
      p.count,
      `Q ${p.total.toFixed(2)}`,
      `${((p.total / totalGlobal) * 100).toFixed(1)}`
    ]);

    let currentY = doc.lastAutoTable.finalY + 15;
    if (currentY + 40 > 280) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(14);
    doc.text('Top 5 Proveedores (Mayor Gasto)', 15, currentY);
    
    doc.autoTable({
      startY: currentY + 5,
      head: [['Proveedor', 'Cant. Facturas', 'Total Facturado', '% del Total']],
      body: topTableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      willDrawCell: function(data) {
        if (data.column.index === 3 && data.cell.section === 'body') {
          // Alineamos el porcentaje a la derecha para dejar espacio a la barra
          data.cell.styles.halign = 'right'; 
        }
      },
      didDrawCell: function(data) {
        if (data.column.index === 3 && data.cell.section === 'body') {
          const pctVal = parseFloat(data.cell.raw);
          if (!isNaN(pctVal)) {
            data.doc.text('%', data.cell.x + data.cell.width - 5, data.cell.y + 6);
            const barMaxWidth = data.cell.width - 20;
            const actualWidth = (pctVal / 100) * barMaxWidth;
            data.doc.setFillColor(226, 232, 240);
            data.doc.rect(data.cell.x + 3, data.cell.y + (data.cell.height/2) - 1.5, barMaxWidth, 3, 'F');
            data.doc.setFillColor(37, 99, 235);
            data.doc.rect(data.cell.x + 3, data.cell.y + (data.cell.height/2) - 1.5, actualWidth, 3, 'F');
          }
        }
      }
    });
    
    // 4. Gráficos Nativos (Vectores, NO IMÁGENES)
    currentY = doc.lastAutoTable.finalY + 15;
    if (currentY + 60 > 280) { doc.addPage(); currentY = 20; }
    doc.setFontSize(14);
    doc.text('Análisis Visual (Gráficas Nativas)', 15, currentY);
    currentY += 10;

    // Función auxiliar para dibujar gráfico de barras horizontales nativo
    function drawNativeHorizontalBar(doc, title, labels, values, startX, startY, maxWidth) {
      doc.setFontSize(12);
      doc.setTextColor(50);
      doc.text(title, startX, startY);
      
      const maxVal = Math.max(...values, 1);
      const rowHeight = 8;
      let y = startY + 8;
      
      doc.setFontSize(9);
      labels.forEach((lbl, i) => {
        let val = values[i];
        if (val === 0) return; // Omitir 0
        const shortLbl = lbl.length > 25 ? lbl.substring(0, 22) + '...' : lbl;
        doc.text(shortLbl, startX, y + 4);
        
        const barX = startX + 60;
        const barMaxWidth = maxWidth - 100;
        const actualWidth = (val / maxVal) * barMaxWidth;
        
        doc.setFillColor(226, 232, 240);
        doc.rect(barX, y, barMaxWidth, 4, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(barX, y, actualWidth, 4, 'F');
        
        doc.text(`Q ${val.toFixed(0)}`, barX + barMaxWidth + 5, y + 4);
        y += rowHeight;
      });
      return y;
    }

    // A. Gasto por Proveedor (Barras Nativas)
    const provLabels = categoryProviders.map(p => p.name);
    const provData = categoryProviders.map(p => categoryInvoices.filter(inv => inv.proveedorId === p.id).reduce((sum, inv) => sum + inv.total, 0));
    currentY = drawNativeHorizontalBar(doc, 'Gasto por Proveedor', provLabels, provData, 15, currentY, 180);

    // B. Gasto por Sucursal (Barras Nativas cruzadas desde facturas)
    currentY += 15;
    if (currentY + 40 > 280) { doc.addPage(); currentY = 20; }
    
    const sucMap = {};
    categoryInvoices.forEach(inv => { sucMap[inv.sucursalNombre] = (sucMap[inv.sucursalNombre] || 0) + inv.total; });
    const sucLabels = Object.keys(sucMap);
    const sucData = Object.values(sucMap);
    
    currentY = drawNativeHorizontalBar(doc, 'Gasto por Sucursal', sucLabels, sucData, 15, currentY, 180);


    // 4. Listado Detallado de Facturas (Agrupado por Sucursal en hojas separadas)
    
    // Agrupar facturas por sucursal
    const dictSucursales = {};
    categoryInvoices.forEach(inv => {
      const suc = inv.sucursalNombre || 'Sin Sucursal';
      if (!dictSucursales[suc]) dictSucursales[suc] = [];
      dictSucursales[suc].push(inv);
    });

    const llavesSucursales = Object.keys(dictSucursales).sort();

    if (llavesSucursales.length === 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Detalle de Facturas', 15, 20);
      doc.setFontSize(12);
      doc.text('No hay facturas registradas en este periodo.', 15, 30);
    }

    llavesSucursales.forEach(suc => {
      doc.addPage();
      doc.setFontSize(16);
      doc.text(`Detalle de Facturas - Sucursal: ${suc}`, 15, 20);

      const tableData = [];
      dictSucursales[suc].forEach(inv => {
        const fecha = inv.fechaEmision ? (inv.fechaEmision.toDate ? inv.fechaEmision.toDate() : new Date(inv.fechaEmision)) : new Date();
        const fechaStr = fecha.toLocaleDateString();
        
        if (!inv.items || inv.items.length === 0) {
          tableData.push([
            fechaStr, inv.proveedorNombre, inv.numeroFactura,
            '-', '-', '-', `Q ${inv.total.toFixed(2)}`
          ]);
        } else {
          inv.items.forEach((item, idx) => {
            const isFirst = idx === 0;
            tableData.push([
              isFirst ? fechaStr : '',
              isFirst ? inv.proveedorNombre : '',
              isFirst ? inv.numeroFactura : '',
              item.description,
              item.quantity,
              `Q ${(item.unitPrice || 0).toFixed(2)}`,
              isFirst ? `Q ${inv.total.toFixed(2)}` : ''
            ]);
          });
        }
      });

      doc.autoTable({
        startY: 25,
        head: [['Fecha', 'Proveedor', 'Factura', 'Producto', 'Cant.', 'Precio', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
        columnStyles: {
          3: { cellWidth: 35 } 
        }
      });
    });

    doc.save(`Reporte_Facturas_${currentCategory.name}.pdf`);
    Swal.close();
  } catch (error) {
    console.error("PDF Error:", error);
    Swal.fire('Error', 'No se pudo generar el PDF', 'error');
  }
}
