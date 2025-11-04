/**********************************************************
 * MÓDULO INTEGRAL DE CUENTAS POR PAGAR
 * Diseño Compacto y Optimizado
 **********************************************************/

// Variables Globales
let currentUser = null;
let currentUserRole = null;
let empresas = [];
let proveedores = [];
let sucursales = [];

// Estado de Filtros
const filterState = {
  empresa: '',
  sucursal: '',
  proveedor: '',
  estado: '',
  fechaEmisionInicio: '',
  fechaEmisionFin: '',
  fechaVencInicio: '',
  fechaVencFin: '',
  montoMin: '',
  montoMax: '',
  search: ''
};

// Datos Actuales
let facturas = [];
let facturasFiltradas = [];

// Estado del Modal
let currentReviewFactura = null;

/**************************************************************************
 * INICIALIZACIÓN
 *************************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  await initUser();
  await loadMasterData();
  await loadFacturas();
  updateDashboard();
  wireEventListeners();
});

/**************************************************************************
 * GESTIÓN DE USUARIO
 *************************************************************************/
async function initUser() {
  currentUser = localStorage.getItem('usuarioLogueado');
  if (!currentUser) {
    window.location.href = '../login.html';
    return;
  }
  
  // Mostrar usuario
  document.getElementById('welcome-user').textContent = `Usuario: ${currentUser}`;
  
  // TODO: Obtener rol del usuario desde Firebase
  currentUserRole = 'supervisor'; // Temporal
}

/**************************************************************************
 * CARGA DE DATOS MAESTROS
 *************************************************************************/
async function loadMasterData() {
  try {
    // Cargar empresas desde colección 'empresas'
    try {
      const empresasSnap = await db.collection('empresas').get();
      empresas = empresasSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
      
      const empresaSelect = document.getElementById('filter-empresa');
      empresas.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        empresaSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error cargando empresas:', err);
    }
    
    // Cargar sucursales desde colección 'sucursales'
    try {
      const sucursalesSnap = await db.collection('sucursales').get();
      sucursales = sucursalesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
      
      // Llamar a updateSucursalFilter para inicializar las opciones de sucursal
      updateSucursalFilter();
    } catch (err) {
      console.error('Error cargando sucursales:', err);
    }
    
    // Cargar proveedores desde la colección de órdenes (se obtienen de las orders existentes)
    try {
      const proveedoresSnap = await db.collection('orders').get();
      const proveedoresSet = new Set();
      proveedoresSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.providerName) {
          proveedoresSet.add(data.providerName);
        }
      });
      
      proveedores = Array.from(proveedoresSet).map(name => ({id: name, nombre: name}));
      
      const proveedorSelect = document.getElementById('filter-proveedor');
      proveedores.forEach(prov => {
        const option = document.createElement('option');
        option.value = prov.id;
        option.textContent = prov.nombre;
        proveedorSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error cargando proveedores:', err);
    }
    
  } catch (error) {
    console.error('Error cargando datos maestros:', error);
  }
}

/**************************************************************************
 * CARGA DE FACTURAS
 *************************************************************************/
async function loadFacturas() {
  try {
    facturas = [];
    
    // Intentar cargar facturas de la colección 'facturas_pagar' si existe
    try {
      const facturasSnap = await db.collection('facturas_pagar').get();
      facturas = facturasSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (err) {
      console.log('Colección facturas_pagar no existe o hay error:', err.message);
    }
    
    // Si no hay facturas en la colección dedicada, buscar en orders con invoices
    if (facturas.length === 0) {
      console.log('No se encontraron facturas en facturas_pagar, buscando en orders...');
      
      try {
        const ordersSnap = await db.collection('orders').get();
        
        ordersSnap.docs.forEach(doc => {
          const order = doc.data();
          if (order.invoices && Array.isArray(order.invoices) && order.invoices.length > 0) {
            order.invoices.forEach((invoice, index) => {
              if (invoice.invoiceNumber) {
                facturas.push({
                  id: `${doc.id}_${index}`,
                  numeroFactura: invoice.invoiceNumber,
                  pedidoId: doc.id,
                  orderId: order.orderId,
                  proveedorId: order.providerName,
                  proveedorNombre: order.providerName,
                  fechaEmision: invoice.invoiceDate || new Date(),
                  fechaVencimiento: calculateDueDate(invoice.invoiceDate),
                  total: parseFloat(order.invoiceTotal || 0),
                  saldoPendiente: parseFloat(order.invoiceTotal || 0),
                  estado: 'pendiente',
                  empresaId: order.sucursalId,
                  sucursalId: order.sucursalId
                });
              }
            });
          }
        });
      } catch (ordersErr) {
        console.error('Error al cargar orders:', ordersErr);
      }
    }
    
    facturasFiltradas = [...facturas];
    
    // Renderizar tabs según el tab activo
    if (document.querySelector('.tab-button.active')) {
      const activeTab = document.querySelector('.tab-button.active');
      if (activeTab.textContent.includes('Pendientes')) {
        renderPendientes();
      } else if (activeTab.textContent.includes('Confirmadas')) {
        renderConfirmadas();
      } else if (activeTab.textContent.includes('Todas')) {
        renderTodas();
      }
    } else {
      // Por defecto, mostrar pendientes
      renderPendientes();
    }
    
    updateDashboard();
  } catch (error) {
    console.error('Error cargando facturas:', error);
    // No mostrar error si es solo que la colección no existe
    if (error.code !== 'not-found') {
      Swal.fire({icon: 'error', title: 'Error', text: 'Error al cargar facturas'});
    }
  }
}

function calculateDueDate(invoiceDate) {
  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  date.setDate(date.getDate() + 30); // 30 días después de la emisión
  return date;
}

/**************************************************************************
 * FILTROS
 *************************************************************************/
function wireEventListeners() {
  document.getElementById('search-box').addEventListener('input', debounce(applyFilters, 300));
  
  ['filter-empresa', 'filter-proveedor', 'filter-estado'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (id === 'filter-empresa') {
        updateSucursalFilter();
      }
      applyFilters();
    });
  });
  
  document.getElementById('filter-sucursal').addEventListener('change', applyFilters);
  
  ['filter-fecha-emision-inicio', 'filter-fecha-emision-fin', 
    'filter-fecha-venc-inicio', 'filter-fecha-venc-fin',
    'filter-monto-min', 'filter-monto-max'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
}

function updateSucursalFilter() {
  const empresaSeleccionada = document.getElementById('filter-empresa').value;
  const sucursalSelect = document.getElementById('filter-sucursal');
  
  // Limpiar opciones actuales
  sucursalSelect.innerHTML = '<option value="">Todas</option>';
  
  if (empresaSeleccionada) {
    // Filtrar sucursales por empresa
    const sucursalesDeEmpresa = sucursales.filter(s => s.empresaId === empresaSeleccionada);
    sucursalesDeEmpresa.forEach(suc => {
      const option = document.createElement('option');
      option.value = suc.id;
      option.textContent = suc.name;
      sucursalSelect.appendChild(option);
    });
  } else {
    // Mostrar todas las sucursales
    sucursales.forEach(suc => {
      const option = document.createElement('option');
      option.value = suc.id;
      option.textContent = suc.name;
      sucursalSelect.appendChild(option);
    });
  }
}

function applyFilters() {
  const searchTerm = document.getElementById('search-box').value.toLowerCase();
  
  facturasFiltradas = facturas.filter(fact => {
    // Buscar por texto
    if (searchTerm && !fact.numeroFactura.toLowerCase().includes(searchTerm) && 
        !fact.pedidoId.toLowerCase().includes(searchTerm)) {
      return false;
    }
    
    // Filtros
    if (filterState.empresa && fact.empresaId !== filterState.empresa) return false;
    if (filterState.proveedor && fact.proveedorId !== filterState.proveedor) return false;
    if (filterState.estado && fact.estado !== filterState.estado) return false;
    
    // Rango fechas
    if (filterState.fechaEmisionInicio && fact.fechaEmision < filterState.fechaEmisionInicio) return false;
    if (filterState.fechaEmisionFin && fact.fechaEmision > filterState.fechaEmisionFin) return false;
    if (filterState.fechaVencInicio && fact.fechaVencimiento < filterState.fechaVencInicio) return false;
    if (filterState.fechaVencFin && fact.fechaVencimiento > filterState.fechaVencFin) return false;
    
    // Rango montos
    if (filterState.montoMin && fact.total < parseFloat(filterState.montoMin)) return false;
    if (filterState.montoMax && fact.total > parseFloat(filterState.montoMax)) return false;
    
    return true;
  });
  
  renderFacturas();
  updateDashboard();
}

function clearFilters() {
  filterState.empresa = '';
  filterState.sucursal = '';
  filterState.proveedor = '';
  filterState.estado = '';
  filterState.fechaEmisionInicio = '';
  filterState.fechaEmisionFin = '';
  filterState.fechaVencInicio = '';
  filterState.fechaVencFin = '';
  filterState.montoMin = '';
  filterState.montoMax = '';
  filterState.search = '';
  
  document.getElementById('search-box').value = '';
  document.getElementById('filter-empresa').value = '';
  document.getElementById('filter-sucursal').value = '';
  document.getElementById('filter-proveedor').value = '';
  document.getElementById('filter-estado').value = '';
  document.getElementById('filter-fecha-emision-inicio').value = '';
  document.getElementById('filter-fecha-emision-fin').value = '';
  document.getElementById('filter-fecha-venc-inicio').value = '';
  document.getElementById('filter-fecha-venc-fin').value = '';
  document.getElementById('filter-monto-min').value = '';
  document.getElementById('filter-monto-max').value = '';
  
  applyFilters();
}

/**************************************************************************
 * DASHBOARD
 *************************************************************************/
function updateDashboard() {
  const hoy = new Date();
  const sieteDias = new Date();
  sieteDias.setDate(hoy.getDate() + 7);
  
  let vencidas = 0, hoyVencen = 0, sieteDiasMonto = 0, pendientes = 0, confirmadas = 0, pagadas = 0;
  
  facturasFiltradas.forEach(fact => {
    const fechaVen = new Date(fact.fechaVencimiento);
    const monto = parseFloat(fact.saldoPendiente || fact.total);
    
    if (fechaVen < hoy) vencidas += monto;
    else if (fechaVen.toDateString() === hoy.toDateString()) hoyVencen += monto;
    else if (fechaVen <= sieteDias) sieteDiasMonto += monto;
    
    if (fact.estado === 'pendiente') pendientes += monto;
    if (fact.estado === 'confirmada') confirmadas += monto;
    if (fact.estado === 'pagada') pagadas += monto;
  });
  
  document.getElementById('widget-vencidas').textContent = `Q ${formatAmount(vencidas)}`;
  document.getElementById('widget-hoy').textContent = `Q ${formatAmount(hoyVencen)}`;
  document.getElementById('widget-7dias').textContent = `Q ${formatAmount(sieteDiasMonto)}`;
  document.getElementById('widget-pendientes').textContent = `Q ${formatAmount(pendientes)}`;
  document.getElementById('widget-confirmadas').textContent = `Q ${formatAmount(confirmadas)}`;
  document.getElementById('widget-pagadas').textContent = `Q ${formatAmount(pagadas)}`;
}

/**************************************************************************
 * MODAL: REVISIÓN DE FACTURA
 *************************************************************************/
async function reviewInvoice(facturaId) {
  const factura = facturas.find(f => f.id === facturaId);
  if (!factura) return;
  
  currentReviewFactura = factura;
  
  // Cargar datos del pedido
  const pedidoSnap = await db.collection('orders').doc(factura.pedidoId).get();
  const pedidoData = pedidoSnap.data();
  
  // Completar sección de pedido
  document.getElementById('pedido-link').textContent = pedidoData.orderId;
  document.getElementById('pedido-proveedor').textContent = pedidoData.providerName;
  document.getElementById('pedido-fecha').textContent = formatDate(pedidoData.orderDate);
  
  renderPedidoItems(pedidoData.products);
  calculatePedidoTotals(pedidoData.products);
  
  // Completar sección de factura
  document.getElementById('factura-numero').textContent = factura.numeroFactura;
  document.getElementById('factura-emision').textContent = formatDate(factura.fechaEmision);
  document.getElementById('factura-vencimiento').textContent = formatDate(factura.fechaVencimiento);
  
  renderFacturaItems(factura.items || []);
  calculateFacturaTotals(factura.items || []);
  
  // Validación
  performValidation(pedidoData.total, factura.total);
  
  // Cargar crédito a favor
  await loadCreditoFavor(factura.proveedorId);
  
  document.getElementById('modal-revision').style.display = 'block';
}

function performValidation(totalEsperado, totalFacturado) {
  const diff = totalFacturado - totalEsperado;
  const resultDiv = document.getElementById('comparison-result');
  
  resultDiv.className = 'comparison-result';
  
  if (diff === 0) {
    resultDiv.className += ' success';
    resultDiv.innerHTML = '<i class="fa fa-check-circle"></i> COINCIDE';
  } else {
    resultDiv.className += ' error';
    resultDiv.innerHTML = `<i class="fa fa-exclamation-circle"></i> DISCREPANCIA: Q ${formatAmount(Math.abs(diff))} ${diff > 0 ? 'MAS' : 'MENOS'}`;
  }
}

async function confirmInvoice() {
  const notes = document.getElementById('review-notes').value;
  if (!notes) {
    Swal.fire({icon: 'warning', title: 'Notas Requeridas', text: 'Debe ingresar notas de revisión'});
    return;
  }
  
  try {
    const facturaRef = db.collection('facturas_pagar').doc(currentReviewFactura.id);
    const facturaDoc = await facturaRef.get();
    
    if (facturaDoc.exists) {
      // Si el documento existe, actualizar
      await facturaRef.update({
        estado: 'confirmada',
        revisadoPor: currentUser,
        fechaRevision: new Date(),
        notasRevision: notes
      });
    } else {
      // Si el documento no existe, crearlo
      await facturaRef.set({
        numeroFactura: currentReviewFactura.numeroFactura,
        pedidoId: currentReviewFactura.pedidoId,
        orderId: currentReviewFactura.orderId,
        proveedorId: currentReviewFactura.proveedorId,
        proveedorNombre: currentReviewFactura.proveedorNombre,
        fechaEmision: currentReviewFactura.fechaEmision,
        fechaVencimiento: currentReviewFactura.fechaVencimiento,
        total: currentReviewFactura.total,
        saldoPendiente: currentReviewFactura.saldoPendiente,
        estado: 'confirmada',
        empresaId: currentReviewFactura.empresaId,
        sucursalId: currentReviewFactura.sucursalId,
        revisadoPor: currentUser,
        fechaRevision: new Date(),
        notasRevision: notes,
        fechaCreacion: new Date()
      });
    }
    
    Swal.fire({icon: 'success', title: 'Confirmada', text: 'Factura confirmada exitosamente'});
    closeReviewModal();
    await loadFacturas();
  } catch (error) {
    console.error('Error confirmando factura:', error);
    Swal.fire({icon: 'error', title: 'Error', text: error.message});
  }
}

async function rejectInvoice() {
  const {value: motivo} = await Swal.fire({
    title: 'Motivo del Rechazo',
    input: 'text',
    inputPlaceholder: 'Ingrese el motivo del rechazo...',
    showCancelButton: true
  });
  
  if (!motivo) return;
  
  try {
    const facturaRef = db.collection('facturas_pagar').doc(currentReviewFactura.id);
    const facturaDoc = await facturaRef.get();
    
    if (facturaDoc.exists) {
      // Si el documento existe, actualizar
      await facturaRef.update({
        estado: 'rechazada',
        motivoRechazo: motivo,
        revisadoPor: currentUser,
        fechaRevision: new Date()
      });
    } else {
      // Si el documento no existe, crearlo
      await facturaRef.set({
        numeroFactura: currentReviewFactura.numeroFactura,
        pedidoId: currentReviewFactura.pedidoId,
        orderId: currentReviewFactura.orderId,
        proveedorId: currentReviewFactura.proveedorId,
        proveedorNombre: currentReviewFactura.proveedorNombre,
        fechaEmision: currentReviewFactura.fechaEmision,
        fechaVencimiento: currentReviewFactura.fechaVencimiento,
        total: currentReviewFactura.total,
        saldoPendiente: currentReviewFactura.saldoPendiente,
        estado: 'rechazada',
        empresaId: currentReviewFactura.empresaId,
        sucursalId: currentReviewFactura.sucursalId,
        motivoRechazo: motivo,
        revisadoPor: currentUser,
        fechaRevision: new Date(),
        fechaCreacion: new Date()
      });
    }
    
    Swal.fire({icon: 'success', title: 'Rechazada', text: 'Factura rechazada'});
    closeReviewModal();
    await loadFacturas();
  } catch (error) {
    console.error('Error rechazando factura:', error);
    Swal.fire({icon: 'error', title: 'Error', text: error.message});
  }
}

function closeReviewModal() {
  document.getElementById('modal-revision').style.display = 'none';
  currentReviewFactura = null;
}

/**************************************************************************
 * FUNCIONES AUXILIARES
 *************************************************************************/
function formatAmount(value) {
  return parseFloat(value || 0).toFixed(2);
}

function formatDate(date) {
  if (!date) return '-';
  const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
  return d.toLocaleDateString('es-GT');
}

function calculateDaysOverdue(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const fecha = new Date(fechaVencimiento);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));
}

function getEstadoClass(estado) {
  const classes = {
    'pendiente': 'badge-warning',
    'confirmada': 'badge-info',
    'pago_parcial': 'badge-orange',
    'pagada': 'badge-success',
    'rechazada': 'badge-danger'
  };
  return classes[estado] || 'badge-secondary';
}

function renderPedidoItems(products) {
  const tbody = document.getElementById('pedido-items');
  tbody.innerHTML = '';
  products.forEach(p => {
    const total = parseFloat(p.quantity) * parseFloat(p.unitPrice || p.price || 0);
    tbody.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${p.quantity}</td>
        <td>Q ${formatAmount(p.unitPrice || p.price)}</td>
        <td>Q ${formatAmount(total)}</td>
      </tr>
    `;
  });
}

function calculatePedidoTotals(products) {
  let subtotal = 0;
  products.forEach(p => {
    subtotal += parseFloat(p.quantity) * parseFloat(p.unitPrice || p.price || 0);
  });
  const impuestos = subtotal * 0.12; // IVA 12%
  
  document.getElementById('pedido-subtotal').textContent = `Q ${formatAmount(subtotal)}`;
  document.getElementById('pedido-impuestos').textContent = `Q ${formatAmount(impuestos)}`;
  document.getElementById('pedido-total').textContent = `Q ${formatAmount(subtotal + impuestos)}`;
  
  document.getElementById('comparison-expected').textContent = `Q ${formatAmount(subtotal + impuestos)}`;
}

function renderFacturaItems(items) {
  const tbody = document.getElementById('factura-items');
  tbody.innerHTML = '';
  items.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>Q ${formatAmount(item.precio)}</td>
        <td>Q ${formatAmount(item.total)}</td>
      </tr>
    `;
  });
}

function calculateFacturaTotals(items) {
  let subtotal = 0;
  items.forEach(item => {
    subtotal += parseFloat(item.total || 0);
  });
  const impuestos = subtotal * 0.12;
  
  document.getElementById('factura-subtotal').textContent = `Q ${formatAmount(subtotal)}`;
  document.getElementById('factura-impuestos').textContent = `Q ${formatAmount(impuestos)}`;
  document.getElementById('factura-total').textContent = `Q ${formatAmount(subtotal + impuestos)}`;
  
  document.getElementById('comparison-actual').textContent = `Q ${formatAmount(subtotal + impuestos)}`;
}

async function loadCreditoFavor(proveedorId) {
  // TODO: Implementar consulta de crédito a favor
  document.getElementById('credito-favor').textContent = 'Q 0.00';
}

function registerPayment(facturaId) {
  Swal.fire({icon: 'info', title: 'Próximamente', text: 'Funcionalidad de pagos en desarrollo'});
}

function viewDetails(facturaId) {
  const factura = facturas.find(f => f.id === facturaId);
  let detalles = `
    <div style="text-align: left;">
      <h3>Detalles de la Factura</h3>
      <p><strong># Factura:</strong> ${factura.numeroFactura}</p>
      <p><strong>Proveedor:</strong> ${factura.proveedorNombre}</p>
      <p><strong>Total:</strong> Q ${formatAmount(factura.total)}</p>
      <p><strong>Saldo Pendiente:</strong> Q ${formatAmount(factura.saldoPendiente)}</p>
      <p><strong>Estado:</strong> ${factura.estado}</p>
      <p><strong>Fecha Emisión:</strong> ${formatDate(factura.fechaEmision)}</p>
      <p><strong>Fecha Vencimiento:</strong> ${formatDate(factura.fechaVencimiento)}</p>
    </div>
  `;
  
  Swal.fire({
    html: detalles,
    width: '600px'
  });
}

function viewOrderDetails(pedidoId) {
  window.location.href = `../gestionPedidos/pedidos.html?pedido=${pedidoId}`;
}

function exportReport() {
  const data = facturasFiltradas.map(f => ({
    'N° Factura': f.numeroFactura,
    'Proveedor': f.proveedorNombre,
    'N° Pedido': f.pedidoId,
    'Fecha Emisión': formatDate(f.fechaEmision),
    'Fecha Vencimiento': formatDate(f.fechaVencimiento),
    'Total': f.total,
    'Saldo Pendiente': f.saldoPendiente,
    'Estado': f.estado
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, 'Cuentas_Por_Pagar.xlsx');
}

function goBackToMainMenu() {
  window.location.href = '../INDEX.HTML';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**************************************************************************
 * MÓDULO: GESTIÓN DE TABS
 *************************************************************************/
function switchTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Desactivar todos los botones
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Mostrar el tab seleccionado
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  // Activar el botón correspondiente
  document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
  
  // Renderizar el contenido correspondiente
  if (tabName === 'pendientes') {
    renderPendientes();
  } else if (tabName === 'confirmadas') {
    renderConfirmadas();
  } else if (tabName === 'todas') {
    renderTodas();
  }
}

function renderPendientes() {
  const pendientes = facturasFiltradas.filter(f => f.estado === 'pendiente');
  const tbody = document.getElementById('pendientes-tbody');
  tbody.innerHTML = '';
  
  if (pendientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay facturas pendientes</td></tr>';
    return;
  }
  
  pendientes.forEach(fact => {
    const row = `
      <tr>
        <td><span class="badge badge-warning">${fact.estado}</span></td>
        <td>${fact.numeroFactura || '-'}</td>
        <td>${fact.proveedorNombre || '-'}</td>
        <td><a href="#" class="link" onclick="viewOrderDetails('${fact.pedidoId}')">${fact.orderId || '-'}</a></td>
        <td>${formatDate(fact.fechaEmision)}</td>
        <td>${formatDate(fact.fechaVencimiento)}</td>
        <td class="text-amount">Q ${formatAmount(fact.total)}</td>
        <td class="action-buttons">
          <button class="btn-mini btn-primary" onclick="reviewInvoice('${fact.id}')">
            <i class="fa fa-eye"></i> Revisar y Confirmar
          </button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
}

function renderConfirmadas() {
  const confirmadas = facturasFiltradas.filter(f => f.estado === 'confirmada' || f.estado === 'pago_parcial');
  const tbody = document.getElementById('confirmadas-tbody');
  tbody.innerHTML = '';
  
  if (confirmadas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No hay facturas confirmadas para pagar</td></tr>';
    return;
  }
  
  confirmadas.forEach(fact => {
    const diasVencidos = calculateDaysOverdue(fact.fechaVencimiento);
    const diasClass = diasVencidos > 0 ? 'text-danger' : diasVencidos === 0 ? 'text-warning' : '';
    const estadoClass = fact.estado === 'pago_parcial' ? 'badge-orange' : 'badge-info';
    
    const row = `
      <tr>
        <td><span class="badge ${estadoClass}">${fact.estado}</span></td>
        <td>${fact.numeroFactura || '-'}</td>
        <td>${fact.proveedorNombre || '-'}</td>
        <td><a href="#" class="link" onclick="viewOrderDetails('${fact.pedidoId}')">${fact.orderId || '-'}</a></td>
        <td>${formatDate(fact.fechaEmision)}</td>
        <td>${formatDate(fact.fechaVencimiento)}</td>
        <td class="text-amount">Q ${formatAmount(fact.total)}</td>
        <td class="text-amount">Q ${formatAmount(fact.saldoPendiente)}</td>
        <td class="${diasClass}">${diasVencidos !== null ? (diasVencidos > 0 ? `${diasVencidos} días` : diasVencidos === 0 ? 'Hoy' : Math.abs(diasVencidos)) : '-'}</td>
        <td class="action-buttons">
          <button class="btn-mini btn-success" onclick="registerPayment('${fact.id}')">
            <i class="fa fa-money-check"></i> Pagar
          </button>
          <button class="btn-mini btn-info" onclick="viewDetails('${fact.id}')">
            <i class="fa fa-info-circle"></i>
          </button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
}

function renderTodas() {
  const tbody = document.getElementById('todas-tbody');
  tbody.innerHTML = '';
  
  if (facturasFiltradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No hay facturas que mostrar</td></tr>';
    return;
  }
  
  facturasFiltradas.forEach(fact => {
    const diasVencidos = calculateDaysOverdue(fact.fechaVencimiento);
    const estadoClass = getEstadoClass(fact.estado);
    const diasClass = diasVencidos > 0 ? 'text-danger' : diasVencidos === 0 ? 'text-warning' : '';
    
    const row = `
      <tr>
        <td><span class="badge ${estadoClass}">${fact.estado}</span></td>
        <td>${fact.numeroFactura || '-'}</td>
        <td>${fact.proveedorNombre || '-'}</td>
        <td><a href="#" class="link" onclick="viewOrderDetails('${fact.pedidoId}')">${fact.orderId || '-'}</a></td>
        <td>${formatDate(fact.fechaEmision)}</td>
        <td>${formatDate(fact.fechaVencimiento)}</td>
        <td class="text-amount">Q ${formatAmount(fact.total)}</td>
        <td class="text-amount">Q ${formatAmount(fact.saldoPendiente)}</td>
        <td class="${diasClass}">${diasVencidos !== null ? (diasVencidos > 0 ? `${diasVencidos} días` : diasVencidos === 0 ? 'Hoy' : Math.abs(diasVencidos)) : '-'}</td>
        <td class="action-buttons">
          ${fact.estado === 'pendiente' ? `<button class="btn-mini btn-primary" onclick="reviewInvoice('${fact.id}')"><i class="fa fa-eye"></i> Revisar</button>` : ''}
          ${fact.estado === 'confirmada' || fact.estado === 'pago_parcial' ? `<button class="btn-mini btn-success" onclick="registerPayment('${fact.id}')"><i class="fa fa-money-check"></i> Pagar</button>` : ''}
          <button class="btn-mini btn-info" onclick="viewDetails('${fact.id}')"><i class="fa fa-info-circle"></i></button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
}

/**************************************************************************
 * MÓDULO: GESTIÓN DE PAGOS
 *************************************************************************/
let currentPaymentFactura = null;

function registerPayment(facturaId) {
  const factura = facturas.find(f => f.id === facturaId);
  if (!factura) return;
  
  currentPaymentFactura = factura;
  
  // Llenar información de la factura
  document.getElementById('payment-factura-numero').textContent = factura.numeroFactura;
  document.getElementById('payment-proveedor').textContent = factura.proveedorNombre;
  document.getElementById('payment-total-factura').textContent = `Q ${formatAmount(factura.total)}`;
  document.getElementById('payment-saldo-pendiente').textContent = `Q ${formatAmount(factura.saldoPendiente)}`;
  
  // Establecer valores por defecto
  document.getElementById('payment-amount').value = factura.saldoPendiente;
  document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('payment-method').value = '';
  document.getElementById('payment-reference').value = '';
  document.getElementById('payment-notes').value = '';
  
  document.getElementById('modal-pagos').style.display = 'block';
}

function closePaymentsModal() {
  document.getElementById('modal-pagos').style.display = 'none';
  currentPaymentFactura = null;
}

async function savePayment() {
  const monto = parseFloat(document.getElementById('payment-amount').value);
  const fecha = document.getElementById('payment-date').value;
  const metodo = document.getElementById('payment-method').value;
  const referencia = document.getElementById('payment-reference').value;
  const notas = document.getElementById('payment-notes').value;
  
  // Validaciones
  if (!monto || monto <= 0) {
    Swal.fire({icon: 'warning', title: 'Monto Inválido', text: 'Debe ingresar un monto mayor a 0'});
    return;
  }
  
  if (!fecha) {
    Swal.fire({icon: 'warning', title: 'Fecha Requerida', text: 'Debe seleccionar una fecha de pago'});
    return;
  }
  
  if (!metodo) {
    Swal.fire({icon: 'warning', title: 'Método Requerido', text: 'Debe seleccionar un método de pago'});
    return;
  }
  
  if (monto > currentPaymentFactura.saldoPendiente) {
    Swal.fire({icon: 'warning', title: 'Monto Excesivo', text: 'El monto excede el saldo pendiente'});
    return;
  }
  
  try {
    const nuevaSaldo = currentPaymentFactura.saldoPendiente - monto;
    const nuevoEstado = nuevaSaldo === 0 ? 'pagada' : 'pago_parcial';
    
    // Actualizar la factura
    const facturaRef = db.collection('facturas_pagar').doc(currentPaymentFactura.id);
    await facturaRef.update({
      saldoPendiente: nuevaSaldo,
      estado: nuevoEstado
    });
    
    // Registrar el pago en la subcolección de pagos
    await facturaRef.collection('pagos').add({
      monto: monto,
      fecha: new Date(fecha),
      metodo: metodo,
      referencia: referencia,
      notas: notas,
      registradoPor: currentUser,
      fechaRegistro: new Date()
    });
    
    Swal.fire({icon: 'success', title: 'Pago Registrado', text: 'El pago ha sido registrado exitosamente'});
    closePaymentsModal();
    
    // Recargar datos
    await loadFacturas();
    if (document.querySelector('.tab-button.active')) {
      const activeTab = document.querySelector('.tab-button.active').textContent;
      if (activeTab.includes('Confirmadas')) {
        renderConfirmadas();
      } else if (activeTab.includes('Todas')) {
        renderTodas();
      }
    }
  } catch (error) {
    console.error('Error guardando pago:', error);
    Swal.fire({icon: 'error', title: 'Error', text: error.message});
  }
}

// Event listeners
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});
