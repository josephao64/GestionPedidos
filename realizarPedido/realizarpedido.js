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
      text: 'No has iniciado sesiÃ³n. Por favor, inicia sesiÃ³n para continuar.'
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
        text: 'No se encontrÃ³ informaciÃ³n del usuario.'
      }).then(() => {
        window.location.href = '../login.html';
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al obtener la informaciÃ³n de la sucursal: ' + error.message
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
      text: 'No se ha seleccionado ningÃºn producto.'
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
      title: 'Valor invÃ¡lido',
      text: 'La cantidad debe ser un nÃºmero entero positivo.'
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
 * Genera el ID de pedido UNA SOLA VEZ por sesiÃ³n con transacciÃ³n atÃ³mica.
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
    console.warn("Failed to generate global ID (likely quota exceeded). Using temporary ID.", error);
    // Fallback: Generate a local temporary ID
    generatedOrderId = 'TEMP-' + Math.floor(Math.random() * 100000);

    if (userRole === 'administrador') {
      const idField = document.getElementById('orderId');
      if (idField) idField.value = generatedOrderId;
    } else {
      const idText = document.getElementById('orderIdText');
      if (idText) idText.textContent = generatedOrderId;
    }

    Swal.fire({
      icon: 'warning',
      title: 'Modo Offline / Cuota Excedida',
      text: 'No se pudo generar un ID global. Se usará un ID temporal: ' + generatedOrderId,
      timer: 3000
    });
    return generatedOrderId;
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

    // VALIDACIÃ“N: Sucursal obligatoria para admin
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
    // Usuarios no admin: validar que su sucursal estÃ© disponible
    if (!userSucursalId || !userSucursalName) {
      isSaving = false;
      Swal.fire({
        icon: 'error',
        title: 'Sucursal no disponible',
        text: 'No se encontrÃ³ la sucursal del usuario. Cierra sesiÃ³n e inicia nuevamente.'
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

  // VALIDACIÃ“N DE PRODUCTOS
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
        title: 'Inventario invÃ¡lido',
        text: 'El inventario debe ser un nÃºmero entero mayor o igual a 0.'
      });
      invInput.focus();
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      isSaving = false;
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad invÃ¡lida',
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
      text: 'Agrega al menos un producto vÃ¡lido al pedido.'
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
          <th>PresentaciÃ³n</th>
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

    // Advertencias por desviaciÃ³n de promedio antes de elegir destino
    try {
      const warnings = await buildAverageWarnings(details, sucursalId, providerId, inventoryByProductId);
      if (warnings.length > 0) {
        const listHtml = warnings.map(w => `<li><strong>${escapeHtml(w.name)}</strong>: pedido ${w.quantity}, sugerido ${w.suggested}</li>`).join('');
        const warnRes = await Swal.fire({
          title: 'Advertencia de Promedios',
          html: `<p>Considerando inventario actual, algunos productos se desvÃ­an del sugerido.</p><ul style="text-align:left;">${listHtml}</ul><p>Â¿Desea continuar?</p>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Continuar',
          cancelButtonText: 'Revisar'
        });
        if (!warnRes.isConfirmed) { isSaving = false; return; }
      }
    } catch (e) {
      // Si falla la validaciÃ³n de promedio, permitimos continuar
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
          <th>PresentaciÃ³n</th>
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

    html2canvas(ticket, { scale: 1 })
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
              html: 'La imagen se ha comprimido y descargado.<br>¿Deseas notificar por WhatsApp?',
              showCancelButton: true,
              confirmButtonText: '<i class="fab fa-whatsapp"></i> WhatsApp',
              cancelButtonText: 'Cerrar',
              confirmButtonColor: '#25D366'
            }).then((result) => {
              if (result.isConfirmed) {
                const msg = `*Pedido #${details.orderId}*\nProveedor: ${details.providerName}\nSucursal: ${details.sucursalName}\nFecha: ${details.savedDate}\n(Adjuntar imagen descargada)`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }
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
            Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar la imagen.' }).then(() => reject('Blob vacÃ­o.'));
          }
        }, 'image/jpeg', 0.6);

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
    if (!sucSel) return; // Modal no cargado aÃºn
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
    // Batch fetch averages
    let averagesMap = {};
    if (sucursalIdSel) {
      try {
        const avgsSnap = await db.collection('usageAverages')
          .where('sucursalId', '==', sucursalIdSel)
          .where('providerId', '==', providerId)
          .get();
        avgsSnap.forEach(d => {
          const dat = d.data();
          if (dat.productId) averagesMap[dat.productId] = dat.weeklyAverage;
        });
      } catch (err) { console.error(err); }
    }

    for (const doc of snap.docs) {
      const prod = doc.data();
      const tr = tbody.insertRow();
      tr.setAttribute('data-id', doc.id);
      tr.innerHTML = `
        <td>${escapeHtml(prod.name || '')}</td>
        <td>${escapeHtml(prod.presentation || '')}</td>
        <td><input type="number" min="0" step="1" class="avg-input" placeholder="0" /></td>
      `;
      // Cargar valor existente desde mapa
      const avg = averagesMap[doc.id];
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
    } catch { }
  }
  return warnings;
}


// =======================
// PEDIDO POR FORMULARIO
// =======================

// ============================================
// MULTI-PROVIDER BULK ORDER LOGIC
// ============================================

async function showBulkOrderForm() {
  document.getElementById('orderCreationContainer').style.display = 'none';
  document.getElementById('bulkOrderContainer').style.display = 'block';

  // Logic for Admin vs User
  if (userRole === 'administrador') {
    document.getElementById('bulkOrderSucursalSelect').style.display = 'inline-block';
    document.getElementById('bulkOrderSucursalText').style.display = 'none';
    document.getElementById('bulkOrderDate').style.display = 'inline-block';
    document.getElementById('bulkOrderDateText').style.display = 'none';
    document.getElementById('bulkOrderId').style.display = 'inline-block';
    document.getElementById('bulkOrderIdText').style.display = 'none';

    await cargarSucursalesSelectParaBulk();
    document.getElementById('bulkOrderDate').value = new Date().toISOString().split('T')[0];

    // Show Config Button for Admin
    const btnConfig = document.getElementById('btnConfigBulk');
    if (btnConfig) btnConfig.style.display = 'inline-block';
  } else {
    document.getElementById('bulkOrderSucursalSelect').style.display = 'none';
    document.getElementById('bulkOrderSucursalText').style.display = 'none';
    document.getElementById('bulkOrderDate').style.display = 'none';
    document.getElementById('bulkOrderDateText').style.display = 'inline-block';
    document.getElementById('bulkOrderId').style.display = 'none';
    document.getElementById('bulkOrderIdText').style.display = 'inline-block';

    document.getElementById('bulkOrderDateText').textContent = new Date().toISOString().split('T')[0];
  }

  // Load all providers and products NOW (after sucursales loaded for admin)
  // Note: For admin, sucursal might still be unselected ("-- Selecciona --"). 
  // loadAllProvidersAndProducts handles empty sucursalId by defaulting averages to 0 or null.
  await loadAllProvidersAndProducts();

  if (generatedOrderId === null) {
    await generateOrderIdOnce();
  }
  // Sync ID display
  if (userRole === 'administrador') {
    document.getElementById('bulkOrderId').value = generatedOrderId;
  } else {
    document.getElementById('bulkOrderIdText').textContent = generatedOrderId;
  }
}

async function cargarSucursalesSelectParaBulk() {
  try {
    const snap = await db.collection('sucursales').get();
    const sel = document.getElementById('bulkOrderSucursalSelect');
    sel.innerHTML = '<option value="" disabled selected>-- Selecciona una Sucursal --</option>';
    snap.forEach(doc => {
      const d = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = d.name;
      sel.appendChild(opt);
    });
  } catch (error) {
    console.error("Error loading sucursales for bulk", error);
  }
}

async function loadAllProvidersAndProducts() {
  const tbody = document.getElementById('bulkOrderTable').querySelector('tbody');
  tbody.innerHTML = ''; // Clear table

  const sucursalId = (userRole === 'administrador')
    ? document.getElementById('bulkOrderSucursalSelect').value
    : userSucursalId;

  if (!sucursalId && userRole === 'administrador') {
    // Admin hasn't selected a sucursal yet, maybe wait or just return?
    // Assuming 'init' logic handles re-load on change. Use select value.
  }

  try {
    const providersSnap = await db.collection('providers').get();
    if (providersSnap.empty) {
      tbody.innerHTML = '<tr><td colspan="5">No hay proveedores registrados.</td></tr>';
      return;
    }

    // Loop through each provider
    for (const provDoc of providersSnap.docs) {
      const provData = provDoc.data();
      const providerId = provDoc.id;
      const providerName = provData.name;

      if (provData.visibleInBulk === false) continue;

      // Fetch products for this provider
      const productsSnap = await db.collection('products').where('providerId', '==', providerId).get();

      if (!productsSnap.empty) {
        // Render Provider Header (Colspan 5 for new warning column)
        const headerRow = tbody.insertRow();
        headerRow.classList.add('provider-header-row');
        headerRow.style.backgroundColor = '#f0f0f0';
        headerRow.style.fontWeight = 'bold';
        headerRow.innerHTML = `
                    <td colspan="5" style="text-align: center; text-transform: uppercase; padding: 10px;">
                        ${escapeHtml(providerName)}
                    </td>
                `;

        // Process products 
        // Batched fetch of usage averages for this provider to avoid N+1 queries
        const averagesMap = {};
        if (sucursalId) {
          try {
            const avgsSnap = await db.collection('usageAverages')
              .where('sucursalId', '==', sucursalId)
              .where('providerId', '==', providerId)
              .get();

            avgsSnap.forEach(doc => {
              const d = doc.data();
              if (d.productId) {
                averagesMap[d.productId] = d.weeklyAverage;
              }
            });
          } catch (e) {
            console.error("Error fetching batch averages for provider " + providerId, e);
            // averagesMap remains empty, so all avgs will be null/undefined, effectively 0. Safe fallback.
          }
        }

        // Map products using the pre-fetched averages
        const productsData = productsSnap.docs.map(prodDoc => {
          const prod = prodDoc.data();
          if (prod.visibleInBulk === false) return null;

          // Get average from map (undefined checks differ from null checks, keeping strict logic)
          const avg = (averagesMap[prodDoc.id] !== undefined) ? averagesMap[prodDoc.id] : null;
          return { doc: prodDoc, data: prod, avg: avg };
        });

        productsData.forEach(item => {
          if (!item) return; // filtered out
          const prod = item.data;
          const avgVal = item.avg !== null ? item.avg : 0;

          const row = tbody.insertRow();
          row.setAttribute('data-id', item.doc.id);
          row.setAttribute('data-provider-id', providerId);
          row.setAttribute('data-provider-name', providerName);
          row.setAttribute('data-avg', avgVal); // Store average

          row.innerHTML = `
                      <td>${escapeHtml(prod.name)}</td>
                      <td>${escapeHtml(prod.presentation)}</td>
                      <td><input type="number" min="0" step="1" class="bulk-inventory-input" placeholder="Inv" oninput="onBulkInventoryChange(this)" /></td>
                      <td>
                          <input type="number" min="1" step="1" class="bulk-qty-input" placeholder="Cant" oninput="onBulkQuantityChange(this)" />
                          <div class="bulk-suggestion-text" style="font-size: 0.85em; color: #666; margin-top: 2px; font-style: italic;"></div>
                      </td>
                      <td class="bulk-warning-cell" style="font-size: 0.9em; font-weight: bold;"></td>
                    `;
        });
      }
    }

  } catch (error) {
    console.error("Error loading all providers/products:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar los datos: ' + error.message
    });
  }
}

function onBulkInventoryChange(input) {
  const row = input.closest('tr');
  const avg = Number(row.getAttribute('data-avg')) || 0;
  const invVal = input.value;
  const qtyInput = row.querySelector('.bulk-qty-input');
  const suggDiv = row.querySelector('.bulk-suggestion-text');

  if (invVal === '') {
    // Clear suggestion if inventory cleared
    suggDiv.textContent = '';
    updateWarning(row);
    return;
  }

  const inv = Number(invVal);
  // Suggested = Average - Inventory (Max 0)
  let suggested = Math.max(Math.round(avg) - inv, 0);

  // Update Reference Text (No Auto-fill)
  suggDiv.textContent = `Sugerido: ${suggested}`;

  // Update Warning (compares current Empty input vs Suggested)
  updateWarning(row);
}

function onBulkQuantityChange(input) {
  const row = input.closest('tr');
  updateWarning(row);
}

function updateWarning(row) {
  const invInput = row.querySelector('.bulk-inventory-input');
  const qtyInput = row.querySelector('.bulk-qty-input');
  const warnCell = row.querySelector('.bulk-warning-cell');

  const avg = Number(row.getAttribute('data-avg')) || 0;
  const invVal = invInput.value;
  const qtyVal = qtyInput.value;

  warnCell.textContent = '';
  warnCell.style.color = '';

  if (invVal === '') return; // No warning if no inventory entered logic? Or "Necesario llenar"?

  const inv = Number(invVal);
  const qty = Number(qtyVal);
  const suggested = Math.max(Math.round(avg) - inv, 0);

  // Logic requested: Show recommendation explicitly

  if (suggested > 0 && qty === 0) {
    warnCell.textContent = `No realiza pedido y necesita producto (Sug: ${suggested})`;
    warnCell.style.color = 'red';
    return;
  }

  if (qty < suggested) {
    warnCell.textContent = `Pide menos de lo recomendado (${suggested})`;
    warnCell.style.color = '#e67300'; // Dark Orange
  } else if (qty > suggested) {
    warnCell.textContent = `Pide más de lo recomendado (${suggested})`;
    warnCell.style.color = '#e6b800'; // Dark Yellow
  } else {
    warnCell.textContent = `Igual a lo recomendado (${suggested})`;
    warnCell.style.color = 'green';
  }
}

async function saveBulkOrder() {
  if (orderAlreadySaved || isSaving) return;
  isSaving = true;

  // VALIDATE GENERAL FIELDS
  let sucursalId, sucursalName, orderDate, initialOrderId;

  if (userRole === 'administrador') {
    const sucSel = document.getElementById('bulkOrderSucursalSelect');
    sucursalId = sucSel.value;
    sucursalName = sucSel.options[sucSel.selectedIndex]?.text || '';
    orderDate = document.getElementById('bulkOrderDate').value;
    initialOrderId = document.getElementById('bulkOrderId').value;

    if (!sucursalId) {
      isSaving = false;
      Swal.fire({ icon: 'warning', title: 'Sucursal requerida', text: 'Debes seleccionar una sucursal.' });
      return;
    }
    if (!orderDate) {
      isSaving = false;
      Swal.fire({ icon: 'warning', title: 'Fecha requerida', text: 'Selecciona la fecha.' });
      return;
    }
  } else {
    if (!userSucursalId || !userSucursalName) {
      isSaving = false;
      Swal.fire({ icon: 'error', title: 'Error', text: 'Sucursal no disponible.' });
      return;
    }
    sucursalId = userSucursalId;
    sucursalName = userSucursalName;
    orderDate = document.getElementById('bulkOrderDateText').textContent;
    initialOrderId = document.getElementById('bulkOrderIdText').textContent;
  }

  if (!initialOrderId) {
    try {
      await generateOrderIdOnce();
      initialOrderId = (userRole === 'administrador') ? document.getElementById('bulkOrderId').value : document.getElementById('bulkOrderIdText').textContent;
    } catch {
      isSaving = false; return;
    }
  }

  // SCRAPE & GROUP PRODUCTS
  const tbody = document.getElementById('bulkOrderTable').querySelector('tbody');
  const rows = tbody.querySelectorAll('tr[data-id]'); // Select only product rows
  const ordersByProvider = {}; // Map<providerId, { providerName, products: [] }>
  const inventoryByProductId = {};

  for (const row of rows) {
    const productId = row.getAttribute('data-id');
    const providerId = row.getAttribute('data-provider-id');
    const providerName = row.getAttribute('data-provider-name');

    const name = row.cells[0].textContent;
    const pres = row.cells[1].textContent;
    const invInput = row.querySelector('.bulk-inventory-input');
    const qtyInput = row.querySelector('.bulk-qty-input');

    const invVal = invInput.value.trim();
    const qtyVal = qtyInput.value.trim();

    // LOGIC: If Inventory entered => Quantity is MANDATORY (can be 0 if intentional, but must be filled)
    // User message: "es necesisario llenar todas las cantidades"

    if (invVal !== '') {
      if (qtyVal === '') {
        isSaving = false;
        Swal.fire({
          icon: 'warning',
          title: 'Falta Cantidad',
          text: `Si ingresas inventario para "${name}", debes confirmar la cantidad (aunque sea 0).`
        });
        qtyInput.focus();
        return;
      }
    }

    if (qtyVal && Number(qtyVal) > 0) {
      const qty = Number(qtyVal);
      const inv = (invVal === '') ? 0 : Number(invVal);

      if (invVal !== '' && (!Number.isInteger(inv) || inv < 0)) {
        isSaving = false;
        Swal.fire({ icon: 'warning', title: 'Inventario invÃ¡lido', text: `Inventario invÃ¡lido para ${name}` });
        invInput.focus();
        return;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        // Technically > 0 check above covers this, but double check integer
        isSaving = false;
        Swal.fire({ icon: 'warning', title: 'Cantidad invÃ¡lida', text: `Cantidad invÃ¡lida para ${name}` });
        qtyInput.focus();
        return;
      }

      if (!ordersByProvider[providerId]) {
        ordersByProvider[providerId] = {
          providerName: providerName,
          products: []
        };
      }

      inventoryByProductId[productId] = inv;
      ordersByProvider[providerId].products.push({
        id: productId,
        name: name,
        presentation: pres,
        inventory: inv,
        quantity: qty
      });
    } else if (invVal !== '' && Number(qtyVal) === 0) {
      // Valid case: Inventory entered, Qty 0. Do not order, but don't error.
      // Logic check: "si no realiza pedido y necesita producto" -> Advertencia was shown. Allow save?
      // Yes, user decides.
      continue;
    }
  }

  const providerIds = Object.keys(ordersByProvider);
  if (providerIds.length === 0) {
    isSaving = false;
    Swal.fire({ icon: 'warning', title: 'Sin productos', text: 'Ingresa al menos una cantidad de pedido.' });
    return;
  }

  // CONFIRM MULTI-ORDER
  const totalOrders = providerIds.length;
  let htmlTxt = `<div style="text-align:center;"><h3>Se crearÃ¡n <b>${totalOrders}</b> pedido(s)</h3>`;
  htmlTxt += `<ul style="text-align:left;">`;
  providerIds.forEach(pid => {
    const pOrder = ordersByProvider[pid];
    htmlTxt += `<li><b>${escapeHtml(pOrder.providerName)}</b>: ${pOrder.products.length} producto(s)</li>`;
  });
  htmlTxt += `</ul><p>Â¿Desea continuar?</p></div>`;

  const confirmRes = await Swal.fire({
    title: 'Confirmar Pedidos MÃºltiples',
    html: htmlTxt,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: 'Generar Pedidos',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmRes.isConfirmed) {
    isSaving = false;
    return;
  }

  // PROCESS SAVE LOOP
  // We reuse executeOrderSave logic but we have to handle the ID generation for 2nd+ orders.
  // The first order can use 'initialOrderId'. Others need new IDs.

  // We will do a custom save loop here to avoid the specific UI flows of executeOrderSave (like confirming EACH order).
  // Instead we confirm ONCE (above) and then just warn/save.

  // Destination Selection (ONCE for all? Or per order? Logic usually implies destination is for the session/batch)
  // Let's ask destination once.
  const destResult = await Swal.fire({
    title: 'Destino de los Pedidos',
    text: 'Seleccione el destino para TODOS los pedidos',
    icon: 'question',
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonText: 'Bodega',
    denyButtonText: 'Tienda',
    showDenyButton: true
  });

  if (!destResult.isConfirmed && !destResult.isDenied) {
    isSaving = false;
    return;
  }
  const destination = destResult.isConfirmed ? 'Bodega' : 'Tienda';
  const now = new Date();
  const savedDate = formatDateTime(now);

  try {
    let currentOrderId = initialOrderId; // Use the one on screen for first
    let ordersCreated = 0;

    for (let i = 0; i < providerIds.length; i++) {
      const pid = providerIds[i];
      const pData = ordersByProvider[pid];

      // Generate NEW ID for subsequent orders
      if (i > 0) {
        // We need a strictly new ID.
        const configRef = db.collection('config').doc('orderCounter');
        await db.runTransaction(async (t) => {
          const doc = await t.get(configRef);
          let seq = doc.exists ? doc.data().sequence : 0;
          seq++;
          t.set(configRef, { sequence: seq }, { merge: true });
          currentOrderId = String(seq).padStart(6, '0');
        });
      }

      // Warnings check (silent or summary? Let's skip interactive warning for bulk to flow faster, or log it?)
      // If we want to support warnings, it gets complex in a loop.
      // For now, we proceed. simpler for bulk. OR we can await buildAverageWarnings and if ANY fail, we stop?
      // Let's skip warnings for this bulk implementation or user will be bombarded. 
      // OR we just save.

      await db.collection('orders').add({
        providerId: pid,
        providerName: pData.providerName,
        sucursalId,
        sucursalName,
        orderDate,
        orderId: currentOrderId,
        products: pData.products,
        destination,
        savedDate,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      ordersCreated++;
    }

    generatedOrderId = null;
    orderAlreadySaved = true;

    Swal.fire({
      icon: 'success',
      title: 'Pedidos Creados',
      text: `Se crearon exitosamente ${ordersCreated} pedidos.`
    }).then(() => {
      // Optional: Reload or clear form
      location.reload();
    });

  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error guardando pedidos: ' + err.message });
  } finally {
    isSaving = false;
  }
}

// ============================================
// GRANULAR BULK CONFIGURATION (PROVIDERS & PRODUCTS)
// ============================================

async function openBulkConfigModal() {
  const listDiv = document.getElementById('bulkConfigProviderList');
  listDiv.innerHTML = '<p>Cargando datos...</p>';
  document.getElementById('bulkConfigModal').style.display = 'block';

  try {
    // Fetch Providers and Products in parallel for performance
    const [provSnap, prodSnap] = await Promise.all([
      db.collection('providers').get(),
      db.collection('products').get()
    ]);

    listDiv.innerHTML = '';

    if (provSnap.empty) {
      listDiv.innerHTML = '<p>No hay proveedores.</p>';
      return;
    }

    // Group products by providerId
    const productsByProvider = {};
    prodSnap.forEach(doc => {
      const p = doc.data();
      // Default visible if undefined
      p.id = doc.id;
      if (!productsByProvider[p.providerId]) {
        productsByProvider[p.providerId] = [];
      }
      productsByProvider[p.providerId].push(p);
    });

    // Build UI
    const container = document.createElement('div');

    provSnap.forEach(doc => {
      const provData = doc.data();
      const provId = doc.id;
      const isProvVisible = (provData.visibleInBulk !== false);
      const products = productsByProvider[provId] || [];

      // Provider Row
      const provDiv = document.createElement('div');
      provDiv.style.marginBottom = '10px';
      provDiv.style.borderBottom = '1px solid #eee';
      provDiv.style.paddingBottom = '5px';

      provDiv.innerHTML = `
                <div style="font-weight: bold; padding: 5px; background: #f9f9f9; display: flex; align-items: center;">
                    <input type="checkbox" class="config-prov-check" id="chk_prov_${provId}" value="${provId}" ${isProvVisible ? 'checked' : ''} onchange="toggleProviderProducts('${provId}', this.checked)">
                    <label for="chk_prov_${provId}" style="margin-left: 8px; cursor: pointer; flex: 1;">${escapeHtml(provData.name)}</label>
                    <span style="font-size: 0.8em; color: #666; margin-right: 10px;">(${products.length} productos)</span>
                    <button type="button" onclick="setProviderProductsState('${provId}', true)" style="font-size: 0.7em; margin-right: 5px; cursor: pointer;">Todas</button>
                    <button type="button" onclick="setProviderProductsState('${provId}', false)" style="font-size: 0.7em; cursor: pointer;">Ninguna</button>
                </div>
            `;

      // Products Container
      const prodContainer = document.createElement('div');
      prodContainer.id = `prod_container_${provId}`;
      prodContainer.style.marginLeft = '25px';
      prodContainer.style.display = isProvVisible ? 'block' : 'none'; // Hide if provider hidden

      if (products.length > 0) {
        products.forEach(prod => {
          const isProdVisible = (prod.visibleInBulk !== false);
          const pRow = document.createElement('div');
          pRow.style.padding = '2px';
          pRow.innerHTML = `
                        <input type="checkbox" class="config-prod-check prod-check-${provId}" id="chk_prod_${prod.id}" value="${prod.id}" ${isProdVisible ? 'checked' : ''}>
                        <label for="chk_prod_${prod.id}" style="margin-left: 5px; cursor: pointer; font-size: 0.9em;">${escapeHtml(prod.name)} (${escapeHtml(prod.presentation)})</label>
                    `;
          prodContainer.appendChild(pRow);
        });
      } else {
        prodContainer.innerHTML = '<div style="font-style:italic; font-size: 0.8em; padding: 5px;">Sin productos</div>';
      }

      provDiv.appendChild(prodContainer);
      container.appendChild(provDiv);
    });

    listDiv.appendChild(container);

  } catch (error) {
    console.error(error);
    listDiv.innerHTML = '<p style="color:red">Error cargando configuracion.</p>';
  }
}

function toggleProviderProducts(provId, checked) {
  const container = document.getElementById(`prod_container_${provId}`);
  if (container) {
    container.style.display = checked ? 'block' : 'none';

    // Propagate selection to all children
    const checks = container.querySelectorAll('.config-prod-check');
    checks.forEach(c => c.checked = checked);
  }
}

function setProviderProductsState(provId, state) {
  const container = document.getElementById(`prod_container_${provId}`);
  if (container) {
    // Ensure container is visible if we are selecting something? 
    // Logic: if select all, probably want to see it. If deselect all, maybe keep as is.
    // But if provider was unchecked (hidden), and we click "Select All" (Todas), we probably want to check the provider too.

    const provChk = document.getElementById(`chk_prov_${provId}`);
    if (provChk && state === true && !provChk.checked) {
      provChk.checked = true;
      container.style.display = 'block';
    }

    const checks = container.querySelectorAll('.config-prod-check');
    checks.forEach(c => c.checked = state);
  }
}

async function saveBulkConfig() {
  // 1. Providers
  const provChecks = document.querySelectorAll('.config-prov-check');
  // 2. Products
  const prodChecks = document.querySelectorAll('.config-prod-check');

  const btn = document.querySelector('button[onclick="saveBulkConfig()"]');
  const originalText = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const batch = db.batch(); // Use batch for atomic writes (limit 500, beware)
    // If > 500, we might need multiple batches or simple Promise.all. 
    // Given potentially thousands of products, let's use Promise.all chunks or serial.
    // But we only need to update CHANGED items to save writes? 
    // For simplicity in this env, Promise.all updates is robust enough for verified size?
    // Let's use Promise.all.

    const updates = [];

    // Update Providers
    provChecks.forEach(chk => {
      updates.push(db.collection('providers').doc(chk.value).update({ visibleInBulk: chk.checked }));
    });

    // Update Products
    prodChecks.forEach(chk => {
      updates.push(db.collection('products').doc(chk.value).update({ visibleInBulk: chk.checked }));
    });

    await Promise.all(updates);

    document.getElementById('bulkConfigModal').style.display = 'none';
    Swal.fire({
      icon: 'success',
      title: 'Guardado',
      text: 'ConfiguraciÃƒÂ³n actualizada correctamente.',
      timer: 1500,
      showConfirmButton: false
    });

    await loadAllProvidersAndProducts();

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al guardando: ' + error.message });
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
