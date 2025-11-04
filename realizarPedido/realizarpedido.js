// Archivo: realizarpedido.js

// Importar jsPDF desde el objeto global
const { jsPDF } = window.jspdf;

// Variables globales (db se define en connection.js)
let userSucursalId = null;
let userSucursalName = null;
let userRole = null;
let selectedProduct = null;
let orderAlreadySaved = false;
let isSaving = false; // NUEVO: evita doble guardado

// Variable global para almacenar el ID generado y evitar que cambie
let generatedOrderId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await obtenerSucursalDelUsuario();
  document.getElementById('orderCreationContainer').style.display = 'none';
  setupInitialProductTable();
  // Cargar selects del modal de promedios
  await initUsageAverageModalControls();
});

async function obtenerSucursalDelUsuario() {
  const usuarioLogueado = localStorage.getItem('usuarioLogueado');
  if (!usuarioLogueado) {
    Swal.fire({
      icon: 'error',
      title: 'No Autenticado',
      text: 'No has iniciado sesión. Por favor, inicia sesión para continuar.'
    }).then(() => {
      window.location.href = '../login.html';
    });
    return;
  }
  try {
    const userSnapshot = await db.collection('usuarios')
      .where('username', '==', usuarioLogueado)
      .limit(1)
      .get();
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      userSucursalId = userData.sucursalId;
      userRole = userData.rol;

      const sucursalDoc = await db.collection('sucursales').doc(userSucursalId).get();
      userSucursalName = sucursalDoc.exists ? sucursalDoc.data().name : 'Sucursal No Encontrada';

      if (userRole === 'administrador') {
        document.getElementById('newOrderSucursalSelect').style.display = 'inline-block';
        document.getElementById('newOrderSucursalText').style.display = 'none';
        document.getElementById('orderDate').style.display = 'inline-block';
        document.getElementById('orderDateText').style.display = 'none';
        document.getElementById('orderId').style.display = 'inline-block';
        document.getElementById('orderIdText').style.display = 'none';
        cargarSucursalesSelectParaAdmin();
        document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
      } else {
        document.getElementById('newOrderSucursalSelect').style.display = 'none';
        document.getElementById('newOrderSucursalText').style.display = 'none';
        document.getElementById('orderDate').style.display = 'none';
        document.getElementById('orderDateText').style.display = 'inline-block';
        document.getElementById('orderId').style.display = 'none';
        document.getElementById('orderIdText').style.display = 'inline-block';
        document.getElementById('orderDateText').textContent = new Date().toISOString().split('T')[0];
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Usuario No Encontrado',
        text: 'No se encontró información del usuario.'
      }).then(() => {
        window.location.href = '../login.html';
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al obtener la información de la sucursal: ' + error.message
    });
  }
}

function setupInitialProductTable() {
  const tbody = document.getElementById('newOrderTable').querySelector('tbody');
  tbody.innerHTML = '';
  document.getElementById('newOrderProviderSelect').disabled = false;
  orderAlreadySaved = false;
  isSaving = false;
}

async function showNewOrderForm() {
  document.getElementById('orderCreationContainer').style.display = 'block';
  await loadNewOrderProviders();
  if (userRole === 'administrador') {
    document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
  } else {
    document.getElementById('orderDateText').textContent = new Date().toISOString().split('T')[0];
  }
  if (generatedOrderId === null) {
    await generateOrderIdOnce();
  }
  setupInitialProductTable();
}

function showProductSelectionModal() {
  const providerId = document.getElementById('newOrderProviderSelect').value;
  if (!providerId) {
    Swal.fire({
      icon: 'warning',
      title: 'Proveedor requerido',
      text: 'Debes seleccionar un proveedor antes de elegir productos.'
    });
    document.getElementById('newOrderProviderSelect').focus();
    return;
  }
  loadProductsForProvider(providerId);
  document.getElementById('productSelectionModal').style.display = 'block';
}

function closeProductSelectionModal() {
  document.getElementById('productSelectionModal').style.display = 'none';
}

async function loadNewOrderProviders() {
  try {
    const snap = await db.collection('providers').get();
    const sel = document.getElementById('newOrderProviderSelect');
    sel.innerHTML = '<option value="" disabled selected>-- Selecciona un Proveedor --</option>';
    snap.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.name;
      sel.appendChild(option);
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar proveedores: ' + error.message
    });
  }
}

async function loadProductsForProvider(providerId) {
  try {
    const snap = await db.collection('products').where('providerId', '==', providerId).get();
    const tbody = document.getElementById('productSelectionTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const prod = doc.data();
      const row = tbody.insertRow();
      row.setAttribute('data-id', doc.id);
      row.setAttribute('data-name', escapeHtml(prod.name));
      row.setAttribute('data-pres', escapeHtml(prod.presentation));
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <td>${escapeHtml(prod.name)}</td>
        <td>${escapeHtml(prod.presentation)}</td>
      `;
      row.addEventListener('click', () => {
        selectedProduct = {
          id: doc.id,
          name: prod.name,
          presentation: prod.presentation
        };
        closeProductSelectionModal();
        addSelectedProductToTable();
      });
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar productos: ' + error.message
    });
  }
}

function filterProducts() {
  const input = document.getElementById('productSearch');
  const filter = input.value.toLowerCase();
  const table = document.getElementById('productSelectionTable');
  const tr = table.getElementsByTagName('tr');
  for (let i = 2; i < tr.length; i++) {
    const td = tr[i].getElementsByTagName('td')[0];
    if (td) {
      const txt = td.textContent || td.innerText;
      tr[i].style.display = txt.toLowerCase().indexOf(filter) > -1 ? '' : 'none';
    }
  }
}

function addSelectedProductToTable() {
  const tbody = document.getElementById('newOrderTable').querySelector('tbody');
  if (tbody.rows.length > 0) {
    const lastRow = tbody.rows[tbody.rows.length - 1];
    const qtyInput = lastRow.querySelector('input.qty-input') || lastRow.querySelector('input[type="number"]');
    if (!qtyInput.value || isNaN(qtyInput.value) || Number(qtyInput.value) <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad requerida',
        text: 'Debes ingresar la cantidad del producto anterior antes de agregar otro.'
      });
      qtyInput.focus();
      return;
    }
  }
  if (!selectedProduct) {
    Swal.fire({
      icon: 'warning',
      title: 'Sin producto',
      text: 'No se ha seleccionado ningún producto.'
    });
    return;
  }
  const existingRows = tbody.getElementsByTagName('tr');
  for (let i = 0; i < existingRows.length; i++) {
    if (existingRows[i].getAttribute('data-id') === selectedProduct.id) {
      Swal.fire({
        icon: 'warning',
        title: 'Producto duplicado',
        text: 'Este producto ya ha sido agregado al pedido.'
      });
      selectedProduct = null;
      return;
    }
  }
  const row = tbody.insertRow();
  row.setAttribute('data-id', selectedProduct.id);
  const cell1 = row.insertCell(0);
  const cell2 = row.insertCell(1);
  const cellAvg = row.insertCell(2);
  const cellInv = row.insertCell(3);
  const cell3 = row.insertCell(4);
  const cell4 = row.insertCell(5);

  cell1.textContent = selectedProduct.name;
  cell2.textContent = selectedProduct.presentation;
  cellAvg.innerHTML = `<span class="avg-value" style="font-weight:bold;">-</span>`;
  cellInv.innerHTML = `<input type="number" min="0" step="1" class="inventory-input" placeholder="Inventario" />`;
  cell3.innerHTML = `<input type="number" min="1" step="1" class="qty-input" placeholder="Cantidad" />`; // step=1 para enteros
  cell4.innerHTML = `
    <button class="action-button edit-button" onclick="editNewOrderProduct(this)">
      <i class="fas fa-edit"></i>
    </button>
    <button class="action-button delete-button" onclick="deleteNewOrderProduct(this)">
      <i class="fas fa-trash-alt"></i>
    </button>
  `;
  document.getElementById('newOrderProviderSelect').disabled = true;
  selectedProduct = null;

  // Cargar promedio y mostrarlo
  const providerId = document.getElementById('newOrderProviderSelect').value;
  const sucursalId = (userRole === 'administrador')
    ? document.getElementById('newOrderSucursalSelect').value || userSucursalId
    : userSucursalId;
  fetchUsageAverageValue(sucursalId, providerId, row.getAttribute('data-id'))
    .then(avg => {
      const span = row.querySelector('.avg-value');
      span.textContent = (avg != null) ? Number(avg).toFixed(0) : '-';
      span.setAttribute('data-avg', (avg != null) ? String(avg) : '');
    })
    .catch(() => {
      const span = row.querySelector('.avg-value');
      span.textContent = '-';
      span.removeAttribute('data-avg');
    });
}

function editNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  const input = row.querySelector('input.qty-input') || row.querySelector('input[type="number"]');
  const currentQuantity = input.value;
  const newQuantity = prompt('Nueva cantidad (entera y > 0):', currentQuantity);
  if (newQuantity === null) return;
  const qty = Number(newQuantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Valor inválido',
      text: 'La cantidad debe ser un número entero positivo.'
    });
    return;
  }
  input.value = qty;
}

function deleteNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);
  const tbody = document.getElementById('newOrderTable').querySelector('tbody');
  if (tbody.rows.length === 0) {
    document.getElementById('newOrderProviderSelect').disabled = false;
  }
}

function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * Genera el ID de pedido UNA SOLA VEZ por sesión con transacción atómica.
 */
async function generateOrderIdOnce() {
  if (generatedOrderId !== null) return generatedOrderId;
  try {
    const configRef = db.collection('config').doc('orderCounter');
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(configRef);
      let newId;
      if (!doc.exists) {
        newId = 1;
        transaction.set(configRef, { lastOrderId: newId });
      } else {
        newId = doc.data().lastOrderId + 1;
        transaction.update(configRef, { lastOrderId: newId });
      }
      generatedOrderId = newId;
    });
    if (userRole === 'administrador') {
      document.getElementById('orderId').value = generatedOrderId;
    } else {
      document.getElementById('orderIdText').textContent = generatedOrderId;
    }
    return generatedOrderId;
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al generar ID: ' + error.message
    });
    throw error;
  }
}

async function saveNewOrder() {
  if (orderAlreadySaved || isSaving) return;
  isSaving = true;

  const providerSelect = document.getElementById('newOrderProviderSelect');
  const providerId = providerSelect.value;
  const providerName = providerSelect.options[providerSelect.selectedIndex]?.text || '';

  // VALIDACIONES GENERALES
  if (!providerId) {
    isSaving = false;
    Swal.fire({ icon: 'warning', title: 'Proveedor requerido', text: 'Selecciona un proveedor.' });
    providerSelect.focus();
    return;
  }

  let sucursalId, sucursalName, orderDate, orderIdValue;

  if (userRole === 'administrador') {
    const sucSel = document.getElementById('newOrderSucursalSelect');
    sucursalId = sucSel.value;
    sucursalName = sucSel.options[sucSel.selectedIndex]?.text || '';
    orderDate = document.getElementById('orderDate').value;
    orderIdValue = document.getElementById('orderId').value;

    // VALIDACIÓN: Sucursal obligatoria para admin
    if (!sucursalId) {
      isSaving = false;
      Swal.fire({
        icon: 'warning',
        title: 'Sucursal requerida',
        text: 'Debes seleccionar una sucursal antes de guardar.'
      });
      sucSel.focus();
      return;
    }

    // Fecha obligatoria para admin
    if (!orderDate) {
      isSaving = false;
      Swal.fire({ icon: 'warning', title: 'Fecha requerida', text: 'Selecciona la fecha del pedido.' });
      document.getElementById('orderDate').focus();
      return;
    }
  } else {
    // Usuarios no admin: validar que su sucursal esté disponible
    if (!userSucursalId || !userSucursalName) {
      isSaving = false;
      Swal.fire({
        icon: 'error',
        title: 'Sucursal no disponible',
        text: 'No se encontró la sucursal del usuario. Cierra sesión e inicia nuevamente.'
      });
      return;
    }
    sucursalId = userSucursalId;
    sucursalName = userSucursalName;
    orderDate = document.getElementById('orderDateText').textContent || new Date().toISOString().split('T')[0];
    orderIdValue = document.getElementById('orderIdText').textContent || generatedOrderId || '';
  }

  // Asegurar que exista un ID de pedido
  if (!orderIdValue) {
    try {
      await generateOrderIdOnce();
      orderIdValue = (userRole === 'administrador')
        ? document.getElementById('orderId').value
        : document.getElementById('orderIdText').textContent;
    } catch {
      isSaving = false;
      return;
    }
  }

  // VALIDACIÓN DE PRODUCTOS
  const tbody = document.getElementById('newOrderTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  const products = [];
  const inventoryByProductId = {};
  for (let i = 0; i < rows.length; i++) {
    const productId = rows[i].getAttribute('data-id');
    if (!productId) continue;
    const tds = rows[i].getElementsByTagName('td');
    const invInput = rows[i].querySelector('input.inventory-input');
    const qtyInput = rows[i].querySelector('input.qty-input') || rows[i].querySelector('input[type="number"]');
    if (!qtyInput || !invInput) continue;
    const inv = Number(invInput.value);
    const qty = Number(qtyInput.value);
    if (!Number.isInteger(inv) || inv < 0) {
      isSaving = false;
      Swal.fire({
        icon: 'warning',
        title: 'Inventario inválido',
        text: 'El inventario debe ser un número entero mayor o igual a 0.'
      });
      invInput.focus();
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      isSaving = false;
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'Todas las cantidades deben ser enteras y mayores a 0.'
      });
      qtyInput.focus();
      return;
    }
    inventoryByProductId[productId] = inv;
    products.push({
      id: productId,
      name: tds[0].textContent,
      presentation: tds[1].textContent,
      inventory: inv,
      quantity: qty
    });
  }
  if (products.length === 0) {
    isSaving = false;
    Swal.fire({
      icon: 'warning',
      title: 'Sin productos',
      text: 'Agrega al menos un producto válido al pedido.'
    });
    return;
  }

  // Fecha y hora actual formateada
  const now = new Date();
  const saveDate = formatDateTime(now);

  const details = {
    orderId: orderIdValue,
    providerName,
    sucursalName,
    orderDate,
    savedDate: saveDate,
    products
  };

  // Resumen para confirmar
  let rowsHtml = '';
  details.products.forEach(p => {
    rowsHtml += `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.presentation)}</td>
        <td>${p.quantity}</td>
      </tr>
    `;
  });
  const htmlTxt = `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2>Confirmar Pedido</h2>
    </div>
    <div style="text-align: left;">
      <p><strong>ID Pedido:</strong> <span style="font-weight: bold;">${escapeHtml(details.orderId)}</span></p>
      <p><strong>Proveedor:</strong> ${escapeHtml(details.providerName)}</p>
      <p><strong>Sucursal:</strong> ${escapeHtml(details.sucursalName)}</p>
      <p><strong>Fecha de Pedido:</strong> ${escapeHtml(details.orderDate)}</p>
      <p><strong>Fecha y Hora de Registro:</strong> ${escapeHtml(details.savedDate)}</p>
      <h3>Productos:</h3>
      <table border="1" style="width: 100%; text-align: left;">
        <tr>
          <th>Producto</th>
          <th>Presentación</th>
          <th>Cantidad</th>
        </tr>
        ${rowsHtml}
      </table>
    </div>
  `;

  // Paso 1: Confirmar pedido
  Swal.fire({
    title: 'Confirmar Pedido',
    html: htmlTxt,
    icon: 'info',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Confirmar'
  }).then(async result => {
    if (!result.isConfirmed) { isSaving = false; return; }

    // Advertencias por desviación de promedio antes de elegir destino
    try {
      const warnings = await buildAverageWarnings(details, sucursalId, providerId, inventoryByProductId);
      if (warnings.length > 0) {
        const listHtml = warnings.map(w => `<li><strong>${escapeHtml(w.name)}</strong>: pedido ${w.quantity}, sugerido ${w.suggested}</li>`).join('');
        const warnRes = await Swal.fire({
          title: 'Advertencia de Promedios',
          html: `<p>Considerando inventario actual, algunos productos se desvían del sugerido.</p><ul style="text-align:left;">${listHtml}</ul><p>¿Desea continuar?</p>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Continuar',
          cancelButtonText: 'Revisar'
        });
        if (!warnRes.isConfirmed) { isSaving = false; return; }
      }
    } catch (e) {
      // Si falla la validación de promedio, permitimos continuar
    }

    // Paso 2: Seleccionar destino (Bodega o Tienda)
    Swal.fire({
      title: 'Destino del Pedido',
      text: 'Seleccione el destino',
      icon: 'question',
      showCloseButton: true,
      showCancelButton: false,
      confirmButtonText: 'Bodega',
      denyButtonText: 'Tienda',
      showDenyButton: true
    }).then(async destResult => {
      if (!destResult.isConfirmed && !destResult.isDenied) { isSaving = false; return; }

      const destination = destResult.isConfirmed ? 'Bodega' : 'Tienda';
      details.destination = destination;

      try {
        await db.collection('orders').add({
          providerId,
          providerName,
          sucursalId,
          sucursalName,
          orderDate,
          orderId: orderIdValue,
          products,
          destination,
          savedDate: saveDate,
          status: 'pending',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        generatedOrderId = null;
        orderAlreadySaved = true;
        showOrderConfirmationModal(details);
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      } finally {
        isSaving = false;
      }
    });
  });
}

function showOrderConfirmationModal(det) {
  let rowsHtml = '';
  det.products.forEach(p => {
    rowsHtml += `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.presentation)}</td>
        <td>${p.quantity}</td>
      </tr>
    `;
  });
  const htmlTxt = `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2>Pedido Guardado</h2>
    </div>
    <div style="text-align: left;">
      <p><strong>ID Pedido:</strong> <span style="font-weight: bold;">${escapeHtml(det.orderId)}</span></p>
      <p><strong>Proveedor:</strong> ${escapeHtml(det.providerName)}</p>
      <p><strong>Sucursal:</strong> ${escapeHtml(det.sucursalName)}</p>
      <p><strong>Fecha de Pedido:</strong> ${escapeHtml(det.orderDate)}</p>
      <p><strong>Fecha y Hora de Registro:</strong> ${escapeHtml(det.savedDate)}</p>
      <p><strong>Destino:</strong> ${escapeHtml(det.destination)}</p>
      <h3>Productos:</h3>
      <table border="1" style="width: 100%; text-align: left;">
        <tr>
          <th>Producto</th>
          <th>Presentación</th>
          <th>Cantidad</th>
        </tr>
        ${rowsHtml}
      </table>
    </div>
  `;
  Swal.fire({
    title: 'Pedido Guardado',
    html: htmlTxt,
    icon: 'success',
    showCloseButton: true,
    confirmButtonText: 'Compartir Pedido'
  }).then(r => {
    if (r.isConfirmed) {
      exportOrderAsImage(det).catch(e => console.error(e));
    }
    setupInitialProductTable();
    document.getElementById('orderCreationContainer').style.display = 'none';
  });
}

function exportOrderAsImage(details) {
  return new Promise((resolve, reject) => {
    document.getElementById('imgOrderId').textContent = details.orderId;
    document.getElementById('imgProviderName').textContent = details.providerName;
    document.getElementById('imgSucursalName').textContent = details.sucursalName;
    document.getElementById('imgDestination').textContent = details.destination;
    document.getElementById('imgSaveDate').textContent = details.savedDate;

    const tBody = document.getElementById('imgProductsTableBody');
    tBody.innerHTML = '';
    details.products.forEach(p => {
      const row = tBody.insertRow();
      row.insertCell(0).textContent = p.name;
      row.insertCell(1).textContent = p.presentation;
      row.insertCell(2).textContent = p.quantity;
    });

    const ticket = document.getElementById('orderDetailsForImage');
    ticket.style.display = 'block';
    ticket.style.left = '50%';
    ticket.style.transform = 'translateX(-50%)';

    html2canvas(ticket, { scale: 2 })
      .then(canvas => {
        canvas.toBlob(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Pedido_${details.orderId}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire({
              icon: 'success',
              title: 'Imagen Exportada',
              text: 'El pedido ha sido exportado como imagen exitosamente.'
            }).then(() => {
              setupInitialProductTable();
              document.getElementById('orderCreationContainer').style.display = 'none';
              Swal.fire({
                icon: 'success',
                title: 'Pedido Completado',
                text: 'El sistema ha sido reiniciado para un nuevo pedido.'
              });
              resolve();
            });
          } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar la imagen.' }).then(() => reject('Blob vacío.'));
          }
        }, 'image/jpeg', 0.95);

        ticket.style.display = 'none';
        ticket.style.left = '-9999px';
      })
      .catch(err => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error al exportar la imagen.' }).then(() => reject(err));
        ticket.style.display = 'none';
        ticket.style.left = '-9999px';
      });
  });
}

async function cargarSucursalesSelectParaAdmin() {
  try {
    const snap = await db.collection('sucursales').get();
    const sel = document.getElementById('newOrderSucursalSelect');
    sel.innerHTML = '<option value="" disabled selected>-- Selecciona una Sucursal --</option>';
    snap.forEach(doc => {
      const d = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      sel.appendChild(opt);
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error al cargar sucursales',
      text: error.message
    });
  }
}

function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

// =======================
// PROMEDIOS DE USO (Firestore)
// =======================

async function initUsageAverageModalControls() {
  try {
    // Sucursales
    const sucSel = document.getElementById('avgSucursalSelect');
    if (!sucSel) return; // Modal no cargado aún
    sucSel.innerHTML = '';
    if (userRole === 'administrador') {
      const snapSuc = await db.collection('sucursales').get();
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = '-- Selecciona una Sucursal --';
      defOpt.disabled = true; defOpt.selected = true;
      sucSel.appendChild(defOpt);
      snapSuc.forEach(doc => {
        const d = doc.data();
        const o = document.createElement('option');
        o.value = doc.id; o.textContent = d.name;
        sucSel.appendChild(o);
      });
    } else {
      const o = document.createElement('option');
      o.value = userSucursalId; o.textContent = userSucursalName || 'Mi Sucursal';
      sucSel.appendChild(o);
      sucSel.disabled = true;
    }

    // Proveedores
    const provSel = document.getElementById('avgProviderSelect');
    provSel.innerHTML = '';
    const snapProv = await db.collection('providers').get();
    const defP = document.createElement('option');
    defP.value = '';
    defP.textContent = '-- Selecciona un Proveedor --';
    defP.disabled = true; defP.selected = true;
    provSel.appendChild(defP);
    snapProv.forEach(doc => {
      const d = doc.data();
      const o = document.createElement('option');
      o.value = doc.id; o.textContent = d.name;
      provSel.appendChild(o);
    });
  } catch (e) {
    // Ignorar errores de carga inicial
  }
}

function showUsageAverageModal() {
  const m = document.getElementById('usageAverageModal');
  if (!m) return;
  m.style.display = 'block';
  // Preseleccionar sucursal si no admin
  const sucSel = document.getElementById('avgSucursalSelect');
  if (sucSel && userRole !== 'administrador') {
    sucSel.value = userSucursalId;
  }
}

function closeUsageAverageModal() {
  const m = document.getElementById('usageAverageModal');
  if (!m) return;
  m.style.display = 'none';
}

async function loadProductsForAverage(providerId) {
  if (!providerId) return;
  try {
    const sucSel = document.getElementById('avgSucursalSelect');
    const sucursalIdSel = sucSel?.value || userSucursalId;
    const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
    tbody.innerHTML = '';
    const snap = await db.collection('products').where('providerId', '==', providerId).get();
    for (const doc of snap.docs) {
      const prod = doc.data();
      const tr = tbody.insertRow();
      tr.setAttribute('data-id', doc.id);
      tr.innerHTML = `
        <td>${escapeHtml(prod.name || '')}</td>
        <td>${escapeHtml(prod.presentation || '')}</td>
        <td><input type="number" min="0" step="1" class="avg-input" placeholder="0" /></td>
      `;
      // Cargar valor existente
      const avg = await fetchUsageAverageValue(sucursalIdSel, providerId, doc.id);
      const input = tr.querySelector('.avg-input');
      if (avg != null) input.value = Number(avg);
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cargar productos: ' + e.message });
  }
}

function filterAvgProducts() {
  const v = (document.getElementById('avgProductSearch')?.value || '').toLowerCase();
  const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  for (let i = 0; i < rows.length; i++) {
    const nameTd = rows[i].getElementsByTagName('td')[0];
    const txt = (nameTd?.textContent || '').toLowerCase();
    rows[i].style.display = txt.indexOf(v) > -1 ? '' : 'none';
  }
}

async function saveUsageAverages() {
  const sucursalIdSel = document.getElementById('avgSucursalSelect')?.value || userSucursalId;
  const providerIdSel = document.getElementById('avgProviderSelect')?.value || '';
  if (!sucursalIdSel) {
    Swal.fire({ icon: 'warning', title: 'Sucursal requerida', text: 'Seleccione una sucursal.' });
    return;
  }
  if (!providerIdSel) {
    Swal.fire({ icon: 'warning', title: 'Proveedor requerido', text: 'Seleccione un proveedor.' });
    return;
  }
  const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  const batch = db.batch();
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const productId = rows[i].getAttribute('data-id');
    const input = rows[i].querySelector('.avg-input');
    const val = Number(input?.value || 0);
    const docId = `${sucursalIdSel}__${providerIdSel}__${productId}`;
    const ref = db.collection('usageAverages').doc(docId);
    if (val > 0) {
      batch.set(ref, {
        sucursalId: sucursalIdSel,
        providerId: providerIdSel,
        productId,
        weeklyAverage: Math.round(val),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      count++;
    } else {
      // Si es 0, eliminamos el doc para limpiar
      batch.delete(ref);
    }
  }
  try {
    await batch.commit();
    Swal.fire({ icon: 'success', title: 'Guardado', text: `Promedios guardados (${count}).` });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al guardar promedios: ' + e.message });
  }
}

async function fetchUsageAverageValue(sucursalId, providerId, productId) {
  if (!sucursalId || !providerId || !productId) return null;
  const docId = `${sucursalId}__${providerId}__${productId}`;
  const ref = await db.collection('usageAverages').doc(docId).get();
  if (!ref.exists) return null;
  const data = ref.data();
  return typeof data.weeklyAverage === 'number' ? data.weeklyAverage : null;
}

async function buildAverageWarnings(details, sucursalId, providerId, inventoryByProductId) {
  // sugerido = max(promedio - inventario, 0)
  // Advertir: cantidad > 150% del sugerido, o cantidad < 50% del sugerido (si sugerido > 0)
  const warnings = [];
  for (const p of details.products) {
    try {
      const avg = await fetchUsageAverageValue(sucursalId, providerId, p.id);
      const inv = Number(inventoryByProductId[p.id] ?? 0);
      if (avg != null && avg >= 0 && inv >= 0) {
        const suggested = Math.max(Math.round(avg) - inv, 0);
        if (suggested === 0 && p.quantity > 0) {
          warnings.push({ name: p.name, quantity: p.quantity, suggested });
        } else if (suggested > 0) {
          if (p.quantity > Math.ceil(suggested * 1.5) || p.quantity < Math.floor(suggested * 0.5)) {
            warnings.push({ name: p.name, quantity: p.quantity, suggested });
          }
        }
      }
    } catch {}
  }
  return warnings;
}
