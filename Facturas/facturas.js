// Variables globales
let currentUser = null;
let allProviders = [];
let allSucursales = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  await loadData();
  setupEventListeners();
});

async function initSession() {
  currentUser = localStorage.getItem('usuarioLogueado');
  if (!currentUser) {
    window.location.href = '../login.html';
    return;
  }
  document.getElementById('user-display').textContent = `Usuario: ${currentUser}`;
}

async function loadData() {
  try {
    // Cargar Sucursales
    const sucSnap = await db.collection('sucursales').get();
    allSucursales = sucSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Cargar Proveedores
    const provSnap = await db.collection('providers').get();
    allProviders = provSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderSucursalSelects();
    renderProviders(allProviders);
  } catch (error) {
    console.error("Error cargando datos:", error);
    Swal.fire('Error', 'No se pudieron cargar los datos iniciales', 'error');
  }
}

function renderSucursalSelects() {
  const selects = [document.getElementById('select-sucursal'), document.getElementById('input-sucursal')];
  selects.forEach(select => {
    if (!select) return;
    // Limpiar excepto el primero si es de filtro
    const isFilter = select.id === 'select-sucursal';
    select.innerHTML = isFilter ? '<option value="">Todas las Sucursales</option>' : '<option value="">Seleccione sucursal</option>';
    
    allSucursales.sort((a, b) => a.name.localeCompare(b.name)).forEach(suc => {
      const option = document.createElement('option');
      option.value = suc.id;
      option.textContent = suc.name;
      select.appendChild(option);
    });
  });
}

function renderProviders(providers) {
  const grid = document.getElementById('proveedores-grid');
  grid.innerHTML = '';

  if (providers.length === 0) {
    grid.innerHTML = '<div class="loading-spinner">No se encontraron proveedores.</div>';
    return;
  }

  providers.sort((a, b) => a.name.localeCompare(b.name)).forEach(prov => {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.innerHTML = `
      <div class="provider-icon"><i class="fas fa-building"></i></div>
      <div class="provider-name">${prov.name}</div>
    `;
    card.onclick = () => openAddInvoiceModal(prov);
    grid.appendChild(card);
  });
}

function setupEventListeners() {
  // Filtro de búsqueda
  document.getElementById('search-provider')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allProviders.filter(p => p.name.toLowerCase().includes(term));
    renderProviders(filtered);
  });

  // Filtro de sucursal (placeholder para lógica futura de filtrado de facturas históricas si se añade)
  
  // Submit del formulario
  document.getElementById('form-factura').onsubmit = async (e) => {
    e.preventDefault();
    await saveInvoice();
  };
}

function openAddInvoiceModal(provider) {
  document.getElementById('modal-factura').style.display = 'block';
  document.getElementById('modal-title').textContent = `Nueva Factura: ${provider.name}`;
  document.getElementById('input-proveedor-id').value = provider.id;
  document.getElementById('display-proveedor').value = provider.name;
  
  // Resetear campos
  document.getElementById('input-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('input-numero').value = '';
  document.getElementById('input-total').value = '';
  document.getElementById('input-sucursal').value = '';
}

function closeModal() {
  document.getElementById('modal-factura').style.display = 'none';
}

async function saveInvoice() {
  const providerId = document.getElementById('input-proveedor-id').value;
  const providerName = document.getElementById('display-proveedor').value;
  const sucursalId = document.getElementById('input-sucursal').value;
  const sucursalName = document.getElementById('input-sucursal').options[document.getElementById('input-sucursal').selectedIndex].text;
  const fecha = document.getElementById('input-fecha').value;
  const numero = document.getElementById('input-numero').value;
  const total = parseFloat(document.getElementById('input-total').value);

  if (!sucursalId || !fecha || !numero || isNaN(total)) {
    Swal.fire('Atención', 'Por favor complete todos los campos obligatorios', 'warning');
    return;
  }

  Swal.fire({
    title: 'Guardando factura...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const selectedSuc = allSucursales.find(s => s.id === sucursalId);
    const empresaId = selectedSuc ? selectedSuc.empresaId : '';

    const invoiceData = {
      proveedorId: providerId,
      proveedorNombre: providerName,
      sucursalId: sucursalId,
      sucursalNombre: sucursalName,
      empresaId: empresaId,
      fechaEmision: new Date(fecha),
      fechaVencimiento: calculateDueDate(fecha),
      numeroFactura: numero,
      total: total,
      saldoPendiente: total,
      estado: 'pendiente',
      creadoPor: currentUser,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('facturas_pagar').add(invoiceData);

    Swal.fire({
      icon: 'success',
      title: 'Guardado',
      text: 'La factura ha sido registrada exitosamente',
      timer: 2000
    });

    closeModal();
  } catch (error) {
    console.error("Error guardando factura:", error);
    Swal.fire('Error', 'No se pudo guardar la factura: ' + error.message, 'error');
  }
}

function calculateDueDate(fechaStr) {
  const date = new Date(fechaStr);
  date.setDate(date.getDate() + 30); // Default 30 días
  return date;
}
