// Importar jsPDF desde el objeto global
const { jsPDF } = window.jspdf;

let db;
let userSucursalId = null;
let userSucursalName = null;
let userRole = null;
let currentOrderId = null;
let selectedProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
  const firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com",
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  await obtenerSucursalDelUsuario();
  document.getElementById('orderCreationContainer').style.display = 'none';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';

  // Inicializa la tabla de productos
  setupInitialProductTable();
});

async function obtenerSucursalDelUsuario() {
  const usuarioLogueado = localStorage.getItem('usuarioLogueado');
  if (!usuarioLogueado) {
    Swal.fire({
      icon: 'error',
      title: 'No Autenticado',
      text: 'No has iniciado sesión. Por favor, inicia sesión para continuar.'
    }).then(() => {
      window.location.href = 'login.html';
    });
    return;
  }
  try {
    const userSnapshot = await db
      .collection('usuarios')
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
        window.location.href = 'login.html';
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
}

/* Mostrar la sección de nuevo pedido */
function showNewOrderForm() {
  document.getElementById('orderCreationContainer').style.display = 'block';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';
  loadNewOrderProviders().then(() => {
    if (userRole === 'administrador') {
      document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    } else {
      document.getElementById('orderDateText').textContent = new Date().toISOString().split('T')[0];
    }
    generateOrderId();
    currentOrderId = null;
    setupInitialProductTable();
  });
}

/* Mostrar la sección de pedidos preguardados */
function showPreSavedOrders() {
  document.getElementById('orderCreationContainer').style.display = 'none';
  document.getElementById('preSavedOrdersContainer').style.display = 'block';
  loadPreSavedOrders();
}

async function loadPreSavedOrders() {
  try {
    const snap = await db.collection('orders').where('status', '==', 'preSaved').get();
    const tbody = document
      .getElementById('preSavedOrdersTable')
      .getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const row = tbody.insertRow();
      row.setAttribute('data-id', doc.id);

      const c1 = row.insertCell(0);
      const c2 = row.insertCell(1);
      const c3 = row.insertCell(2);
      const c4 = row.insertCell(3);
      const c5 = row.insertCell(4);

      c1.textContent = data.orderId;
      c2.textContent = data.providerName;
      c3.textContent = data.sucursalName;
      c4.textContent = data.orderDate;
      c5.innerHTML = `
        <button class="action-button edit-button" onclick="openPreSavedOrder('${doc.id}')">
          <i class="fas fa-folder-open"></i>
        </button>
        <button class="action-button delete-button" onclick="deletePreSavedOrder('${doc.id}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
    });
    if (snap.empty) {
      document.getElementById('preSavedOrdersContainer').style.display = 'none';
      Swal.fire({
        icon: 'info',
        title: 'Sin Pedidos Preguardados',
        text: 'No hay pedidos preguardados para mostrar.'
      });
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar pedidos preguardados: ' + error.message
    });
  }
}

async function openPreSavedOrder(docId) {
  try {
    const docRef = await db.collection('orders').doc(docId).get();
    if (!docRef.exists) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El pedido preguardado no existe.'
      });
      return;
    }
    const data = docRef.data();
    currentOrderId = docId;

    document.getElementById('orderCreationContainer').style.display = 'block';
    document.getElementById('preSavedOrdersContainer').style.display = 'none';
    await loadNewOrderProviders();

    document.getElementById('newOrderProviderSelect').value = data.providerId;
    if (userRole === 'administrador') {
      document.getElementById('newOrderSucursalSelect').value = data.sucursalId;
      document.getElementById('orderDate').value = data.orderDate;
      document.getElementById('orderId').value = data.orderId;
    } else {
      document.getElementById('orderDateText').textContent = data.orderDate;
      document.getElementById('orderIdText').textContent = data.orderId;
    }
    document.getElementById('newOrderProviderSelect').disabled = data.products.length > 0;

    setupInitialProductTable();
    const tbody = document.getElementById('newOrderTable').querySelector('tbody');
    data.products.forEach(prod => {
      const row = tbody.insertRow();
      row.setAttribute('data-id', prod.id);
      const c1 = row.insertCell(0);
      const c2 = row.insertCell(1);
      const c3 = row.insertCell(2);
      const c4 = row.insertCell(3);

      c1.textContent = prod.name;
      c2.textContent = prod.presentation;
      c3.innerHTML = `<input type="number" min="1" value="${prod.quantity}" />`;
      c4.innerHTML = `
        <button class="action-button edit-button" onclick="editNewOrderProduct(this)">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-button delete-button" onclick="deleteNewOrderProduct(this)">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al abrir pedido preguardado: ' + error.message
    });
  }
}

async function generateOrderId() {
  try {
    const ref = db.collection('config').doc('orderCounter');
    const docSnap = await ref.get();
    let newId = 1;
    if (docSnap.exists) {
      newId = docSnap.data().lastOrderId + 1;
    }
    await ref.set({ lastOrderId: newId });

    if (userRole === 'administrador') {
      document.getElementById('orderId').value = newId;
    } else {
      document.getElementById('orderIdText').textContent = newId;
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al generar ID: ' + error.message
    });
  }
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

function showProductSelectionModal() {
  const providerId = document.getElementById('newOrderProviderSelect').value;
  if (!providerId) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Debes seleccionar un proveedor primero.'
    });
    return;
  }
  loadProductsForProvider(providerId);
  document.getElementById('productSelectionModal').style.display = 'block';
}

function closeProductSelectionModal() {
  document.getElementById('productSelectionModal').style.display = 'none';
}

async function loadProductsForProvider(providerId) {
  try {
    const snap = await db
      .collection('products')
      .where('providerId', '==', providerId)
      .get();
    const tbody = document
      .getElementById('productSelectionTable')
      .getElementsByTagName('tbody')[0];
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
  if (!selectedProduct) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'No se ha seleccionado ningún producto.'
    });
    return;
  }
  const tbody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  const existingRows = tbody.getElementsByTagName('tr');
  for (let i = 0; i < existingRows.length; i++) {
    if (existingRows[i].getAttribute('data-id') === selectedProduct.id) {
      Swal.fire({
        icon: 'warning',
        title: 'Producto Duplicado',
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
  const cell3 = row.insertCell(2);
  const cell4 = row.insertCell(3);

  cell1.textContent = selectedProduct.name;
  cell2.textContent = selectedProduct.presentation;
  cell3.innerHTML = `<input type="number" min="1" placeholder="Cantidad" />`;
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
}

function editNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  const input = row.querySelector('input[type="number"]');
  const currentQuantity = input.value;
  const newQuantity = prompt('Nueva cantidad:', currentQuantity);
  if (newQuantity === null) return;
  if (!newQuantity.trim() || isNaN(newQuantity) || Number(newQuantity) <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Valor Inválido',
      text: 'La cantidad debe ser un número positivo.'
    });
    return;
  }
  input.value = newQuantity;
}

function deleteNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);

  const tbody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  if (tbody.rows.length === 0) {
    document.getElementById('newOrderProviderSelect').disabled = false;
  }
}

async function saveNewOrder() {
  const providerId = document.getElementById('newOrderProviderSelect').value;
  const providerName =
    document.getElementById('newOrderProviderSelect').options[
      document.getElementById('newOrderProviderSelect').selectedIndex
    ]?.text || '';

  let sucursalId, sucursalName, orderDate, orderIdValue;
  if (userRole === 'administrador') {
    sucursalId = document.getElementById('newOrderSucursalSelect').value;
    sucursalName =
      document.getElementById('newOrderSucursalSelect').options[
        document.getElementById('newOrderSucursalSelect').selectedIndex
      ]?.text || '';
    orderDate = document.getElementById('orderDate').value;
    orderIdValue = document.getElementById('orderId').value;
  } else {
    sucursalId = userSucursalId;
    sucursalName = userSucursalName;
    orderDate = document.getElementById('orderDateText').textContent;
    orderIdValue = document.getElementById('orderIdText').textContent;
  }

  const tbody = document.getElementById('newOrderTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  const products = [];
  for (let i = 0; i < rows.length; i++) {
    const productId = rows[i].getAttribute('data-id');
    if (!productId) continue;
    const tds = rows[i].getElementsByTagName('td');
    const qtyInput = rows[i].querySelector('input[type="number"]');
    if (!qtyInput || !qtyInput.value.trim() || isNaN(qtyInput.value) || Number(qtyInput.value) <= 0) {
      continue;
    }
    products.push({
      id: productId,
      name: tds[0].textContent,
      presentation: tds[1].textContent,
      quantity: qtyInput.value
    });
  }
  if (products.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'No hay productos válidos en el pedido.'
    });
    return;
  }

  const saveDate = new Date().toISOString().split('T')[0];

  // *** MODIFICACIÓN: Destino de Pedido sin botón Cancelar, con X en la esquina ***
  const destResult = await Swal.fire({
    title: 'Destino del Pedido',
    text: '¿El pedido se enviará a Bodega o directamente a Tienda?',
    icon: 'question',
    showDenyButton: true,
    showCancelButton: false,       // Quitar el botón de cancelar
    showCloseButton: true,         // Mostrar la "X" en la esquina
    confirmButtonText: 'Bodega',
    denyButtonText: 'Tienda'
  });

  let destination = null;
  if (destResult.isConfirmed) {
    destination = 'Bodega';
  } else if (destResult.isDenied) {
    destination = 'Tienda';
  } else {
    // Si cierra con la X, simplemente regresa
    Swal.fire({
      icon: 'info',
      title: 'Operación Cancelada',
      text: 'Puedes seguir editando tu pedido.'
    });
    return;
  }

  Swal.fire({
    title: 'Guardar Pedido',
    text: '¿Cómo deseas guardar tu pedido?',
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Guardar',
    denyButtonText: 'Preguardar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        if (currentOrderId) {
          await db.collection('orders').doc(currentOrderId).update({
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
        } else {
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
        }
        showOrderConfirmationModal({
          orderId: orderIdValue,
          providerName,
          sucursalName,
          destination,
          savedDate: saveDate,
          products
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message
        });
      }
    } else if (result.isDenied) {
      try {
        if (currentOrderId) {
          await db.collection('orders').doc(currentOrderId).update({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            orderId: orderIdValue,
            products,
            destination,
            savedDate: saveDate,
            status: 'preSaved',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
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
            status: 'preSaved',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        Swal.fire({
          icon: 'success',
          title: 'Pedido Preguardado',
          text: 'El pedido se ha preguardado exitosamente.'
        });
        setupInitialProductTable();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message
        });
      }
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Operación Cancelada',
        text: 'Puedes seguir editando tu pedido.'
      });
    }
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
      <h2>Pedido Confirmado</h2>
    </div>
    <div style="text-align: left;">
      <p><strong>ID Pedido:</strong> <span style="font-weight: bold;">${escapeHtml(det.orderId)}</span></p>
      <p><strong>Proveedor:</strong> ${escapeHtml(det.providerName)}</p>
      <p><strong>Sucursal:</strong> ${escapeHtml(det.sucursalName)}</p>
      <p><strong>Entrega en:</strong> ${escapeHtml(det.destination)}</p>
      <p><strong>Fecha de Registro:</strong> ${escapeHtml(det.savedDate)}</p>
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
    title: 'Confirme su Pedido',
    html: htmlTxt,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: 'Compartir Pedido',
    cancelButtonText: 'Cerrar',
    width: '600px'
  }).then(r => {
    if (r.isConfirmed) {
      Swal.fire({
        title: 'Compartir Pedido',
        text: '¿Cómo deseas compartir tu pedido?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Exportar como Imagen',
        cancelButtonText: 'Cancelar'
      }).then(r2 => {
        if (r2.isConfirmed) {
          exportOrderAsImage(det).catch(e => console.error(e));
        }
      });
    }
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
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Error al generar la imagen.'
            }).then(() => reject('Blob vacío.'));
          }
        }, 'image/jpeg', 0.95);

        ticket.style.display = 'none';
        ticket.style.left = '-9999px';
      })
      .catch(err => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al exportar la imagen.'
        }).then(() => reject(err));
        ticket.style.display = 'none';
        ticket.style.left = '-9999px';
      });
  });
}

function deletePreSavedOrder(docId) {
  Swal.fire({
    title: '¿Estás seguro?',
    text: 'Esto eliminará el pedido preguardado permanentemente.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  }).then(async (r) => {
    if (r.isConfirmed) {
      try {
        await db.collection('orders').doc(docId).delete();
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Pedido preguardado eliminado.'
        });
        loadPreSavedOrders();
      } catch (e) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: e.message
        });
      }
    }
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
