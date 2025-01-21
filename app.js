// Importar jsPDF desde el objeto global proporcionado por la biblioteca jsPDF
const { jsPDF } = window.jspdf;

/**
 * ================================
 * Variables globales
 * ================================
 */
let db;                         
let userSucursalId = null;      
let userSucursalName = null;    
let userRole = null;           
let currentOrderId = null;      
let editingExistingOrder = false;

/**
 * ================================
 * DOMContentLoaded
 * ================================
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Firebase
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

  // Verificar datos del usuario (rol, sucursal)
  await obtenerSucursalDelUsuario();

  // Si el usuario es administrador, cargar pedidos pendientes y en proceso
  // (Si deseas seguir administrando esos contenedores, 
  //  en tu caso puedes hacerlo, o comentar si ya no es necesario)
  // if (userRole === 'administrador') {
  //   loadPendingOrdersAdmin();
  //   loadInProcessOrdersAdmin();
  // }
});

/**
 * ================================
 * Función: obtenerSucursalDelUsuario
 * ================================
 */
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

      // Obtener nombre de la sucursal
      const sucursalDoc = await db.collection('sucursales').doc(userSucursalId).get();
      if (sucursalDoc.exists) {
        userSucursalName = sucursalDoc.data().name;
      } else {
        userSucursalName = 'Sucursal No Encontrada';
      }

      // Deshabilitar la fecha de pedido para usuarios normales
      if (userRole !== 'administrador') {
        const orderDateInput = document.getElementById('orderDate');
        if (orderDateInput) {
          orderDateInput.disabled = true;
        }
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Usuario No Encontrado',
        text: 'No se encontró información del usuario. Por favor, inicia sesión nuevamente.'
      }).then(() => {
        window.location.href = 'login.html';
      });
    }
  } catch (error) {
    console.error('Error al obtener la sucursal del usuario:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al obtener la información de la sucursal.'
    });
  }
}

/**
 * ================================
 * handleGestionPedidos()
 * => Al dar clic en el botón "Gestión de Pedidos",
 *    abrir directamente la creación de un nuevo pedido
 * ================================
 */
function handleGestionPedidos() {
  editingExistingOrder = false;
  currentOrderId = null;
  showOrderCreationContainer();
}

/**
 * ================================
 * Mostrar Contenedor de Creación
 * ================================
 */
async function showOrderCreationContainer() {
  // Ocultar preSavedOrdersContainer
  document.getElementById('preSavedOrdersContainer').style.display = 'none';

  // Mostrar contenedor de creación
  document.getElementById('orderCreationContainer').style.display = 'block';

  // Asignar la sucursal del usuario y bloquear el select
  const selectSucursal = document.getElementById('newOrderSucursalSelect');
  selectSucursal.innerHTML = '';
  const option = document.createElement('option');
  option.value = userSucursalId;
  option.textContent = userSucursalName;
  selectSucursal.appendChild(option);
  selectSucursal.disabled = true;

  // Cargar proveedores
  loadNewOrderProviders();

  // Colocar fecha de hoy si es admin
  if (userRole === 'administrador') {
    setOrderDateToToday();
  } else {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
  }

  // Generar nuevo ID de pedido
  if (!editingExistingOrder) {
    generateOrderId();
  }

  // Limpiar la tabla de productos
  limpiarFormulario();
}

/**
 * ================================
 * Limpiar Formulario
 * ================================
 */
function limpiarFormulario() {
  document.getElementById('newOrderProviderSelect').disabled = false;
  document.getElementById('newOrderProviderSelect').value = '';
  if (userRole === 'administrador') {
    setOrderDateToToday();
  }
  document.getElementById('orderId').value = '';
  document.getElementById('newOrderTable')
    .getElementsByTagName('tbody')[0].innerHTML = '';
  editingExistingOrder = false;
}

/**
 * ================================
 * Mostrar Pedidos Preguardados
 * ================================
 */
function showPreSavedOrders() {
  document.getElementById('orderCreationContainer').style.display = 'none';
  document.getElementById('preSavedOrdersContainer').style.display = 'block';
  loadPreSavedOrders();
}

/**
 * ================================
 * loadPreSavedOrders
 * (con botón eliminar)
 * ================================
 */
async function loadPreSavedOrders() {
  try {
    const preSavedOrdersSnapshot = await db
      .collection('orders')
      .where('status', '==', 'preSaved')
      .get();

    const preSavedOrdersTableBody = document
      .getElementById('preSavedOrdersTable')
      .getElementsByTagName('tbody')[0];
    preSavedOrdersTableBody.innerHTML = '';

    preSavedOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      const row = preSavedOrdersTableBody.insertRow();

      const cell1 = row.insertCell(0);
      const cell2 = row.insertCell(1);
      const cell3 = row.insertCell(2);
      const cell4 = row.insertCell(3);
      const cell5 = row.insertCell(4);

      cell1.textContent = order.orderId;
      cell2.textContent = order.providerName;
      cell3.textContent = order.sucursalName;
      cell4.textContent = order.orderDate;
      cell5.innerHTML = `
        <button onclick="openPreSavedOrder('${doc.id}')">Abrir Pedido</button>
        <button onclick="deletePreSavedOrder('${doc.id}')">Eliminar</button>
      `;
    });

  } catch (error) {
    console.error('Error al cargar pedidos preguardados:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar pedidos preguardados.'
    });
  }
}

/**
 * ================================
 * Eliminar Pedido Preguardado
 * ================================
 */
function deletePreSavedOrder(orderDocId) {
  Swal.fire({
    title: "¿Eliminar Pedido Preguardado?",
    text: "Esta acción no se puede deshacer.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection("orders").doc(orderDocId).delete();
        Swal.fire({
          icon: "success",
          title: "Pedido Eliminado",
          text: "El pedido preguardado se eliminó correctamente."
        });
        loadPreSavedOrders();
      } catch (error) {
        console.error("Error al eliminar pedido preguardado:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo eliminar el pedido preguardado."
        });
      }
    }
  });
}

/**
 * ================================
 * Abrir un Pedido Preguardado
 * ================================
 */
async function openPreSavedOrder(orderDocId) {
  try {
    const orderDoc = await db.collection('orders').doc(orderDocId).get();
    if (!orderDoc.exists) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El pedido preguardado no existe.'
      });
      return;
    }
    const orderData = orderDoc.data();
    currentOrderId = orderDocId;
    editingExistingOrder = true;

    // Mostrar contenedor
    document.getElementById('preSavedOrdersContainer').style.display = 'none';
    document.getElementById('orderCreationContainer').style.display = 'block';

    // Asignar sucursal + bloquear
    const selectSucursal = document.getElementById('newOrderSucursalSelect');
    selectSucursal.innerHTML = '';
    const option = document.createElement('option');
    option.value = userSucursalId;
    option.textContent = userSucursalName;
    selectSucursal.appendChild(option);
    selectSucursal.disabled = true;

    // Llenar datos
    document.getElementById('newOrderProviderSelect').value = orderData.providerId;
    document.getElementById('orderDate').value = orderData.orderDate;
    document.getElementById('orderId').value = orderData.orderId;

    // Deshabilitar la fecha si no es admin
    if (userRole !== 'administrador') {
      document.getElementById('orderDate').disabled = true;
    }

    // Bloquear proveedor si ya hay productos
    const providerSelect = document.getElementById('newOrderProviderSelect');
    providerSelect.disabled = (orderData.products.length > 0);

    // Limpiar tabla
    const newOrderTableBody = document.getElementById('newOrderTable')
      .getElementsByTagName('tbody')[0];
    newOrderTableBody.innerHTML = '';

    // Cargar productos
    orderData.products.forEach(product => {
      const row = newOrderTableBody.insertRow();
      row.insertCell(0).textContent = product.name;
      row.insertCell(1).textContent = product.presentation;
      row.insertCell(2).textContent = product.quantity;
      row.insertCell(3).textContent = product.stock;
      row.insertCell(4).innerHTML = `
        <button onclick="editNewOrderProduct(this)">Editar</button>
        <button onclick="deleteNewOrderProduct(this)">Eliminar</button>
      `;
    });

    // Cargar proveedores
    loadNewOrderProviders();

  } catch (error) {
    console.error('Error al abrir pedido preguardado:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al abrir el pedido preguardado.'
    });
  }
}

/**
 * ================================
 * Generar ID de Pedido
 * ================================
 */
async function generateOrderId() {
  try {
    const orderCounterRef = db.collection('config').doc('orderCounter');
    const orderCounterDoc = await orderCounterRef.get();

    let newOrderId = 1;
    if (orderCounterDoc.exists) {
      newOrderId = orderCounterDoc.data().lastOrderId + 1;
    }
    await orderCounterRef.set({ lastOrderId: newOrderId });
    document.getElementById('orderId').value = newOrderId;
  } catch (error) {
    console.error('Error al generar ID de pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al generar ID de pedido.'
    });
  }
}

/**
 * ================================
 * setOrderDateToToday
 * ================================
 */
function setOrderDateToToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('orderDate').value = today;
}

/**
 * ================================
 * Cargar proveedores
 * ================================
 */
async function loadNewOrderProviders() {
  try {
    const providersSnapshot = await db.collection('providers').get();
    const newOrderProviderSelect = document.getElementById('newOrderProviderSelect');
    newOrderProviderSelect.innerHTML =
      '<option value="" disabled selected>-- Selecciona un Proveedor --</option>';

    providersSnapshot.forEach(doc => {
      const provider = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = provider.name;
      newOrderProviderSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar proveedores.'
    });
  }
}

/**
 * ================================
 * loadNewOrderProducts
 * ================================
 */
async function loadNewOrderProducts() {
  try {
    const providerId = document.getElementById('newOrderProviderSelect').value;
    if (!providerId) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Por favor, selecciona un proveedor primero.'
      });
      return;
    }

    const productsSnapshot = await db
      .collection('products')
      .where('providerId', '==', providerId)
      .get();

    const productSelectionTableBody = document.getElementById('productSelectionTable')
      .getElementsByTagName('tbody')[0];
    productSelectionTableBody.innerHTML = '';

    productsSnapshot.forEach(doc => {
      const product = doc.data();
      const row = productSelectionTableBody.insertRow();
      const cell1 = row.insertCell(0);
      const cell2 = row.insertCell(1);
      const cell3 = row.insertCell(2);

      cell1.textContent = product.name;
      cell2.textContent = product.presentation;
      cell3.innerHTML = `
        <button 
          onclick="selectProductForOrder(event)" 
          data-id="${doc.id}"
          data-name="${escapeHtml(product.name)}"
          data-presentation="${escapeHtml(product.presentation)}">
          Seleccionar
        </button>
      `;
    });
  } catch (error) {
    console.error('Error al cargar productos:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar productos.'
    });
  }
}

/**
 * ================================
 * escapeHtml
 * ================================
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * ================================
 * Filtrar productos
 * ================================
 */
function filterProducts() {
  const input = document.getElementById('productSearch');
  const filter = input.value.toLowerCase();
  const table = document.getElementById('productSelectionTable');
  const tr = table.getElementsByTagName('tr');

  for (let i = 2; i < tr.length; i++) {
    const td = tr[i].getElementsByTagName('td')[0];
    if (td) {
      const txtValue = td.textContent || td.innerText;
      tr[i].style.display = (txtValue.toLowerCase().indexOf(filter) > -1) ? '' : 'none';
    }
  }
}

/**
 * ================================
 * selectProductForOrder
 * ================================
 */
function selectProductForOrder(event) {
  const btn = event.target;
  const productId = btn.getAttribute('data-id');
  const productName = btn.getAttribute('data-name');
  const productPresentation = btn.getAttribute('data-presentation');

  if (productId && productName && productPresentation) {
    document.getElementById('productNameSelected').value = productName;
    document.getElementById('productPresentationSelected').value = productPresentation;
    closeProductSelectionModal();
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Debe seleccionar un producto.'
    });
  }
}

function closeProductSelectionModal() {
  document.getElementById('productSelectionModal').style.display = 'none';
}

/**
 * ================================
 * Añadir producto
 * ================================
 */
function addProductToNewOrder() {
  const productName = document.getElementById('productNameSelected').value;
  const productPresentation = document.getElementById('productPresentationSelected').value;
  const quantity = document.getElementById('productQuantity').value;
  const stockNA = document.getElementById('stockNA').checked;
  const stockValue = document.getElementById('productStock').value;

  if (productName && productPresentation && quantity && (stockNA || stockValue)) {
    const newOrderTableBody = document.getElementById('newOrderTable')
      .getElementsByTagName('tbody')[0];
    const row = newOrderTableBody.insertRow();

    row.insertCell(0).textContent = productName;
    row.insertCell(1).textContent = productPresentation;
    row.insertCell(2).textContent = quantity;
    row.insertCell(3).textContent = stockNA ? 'N/A' : stockValue;
    row.insertCell(4).innerHTML = `
      <button onclick="editNewOrderProduct(this)">Editar</button>
      <button onclick="deleteNewOrderProduct(this)">Eliminar</button>
    `;

    // Limpiar
    document.getElementById('productNameSelected').value = '';
    document.getElementById('productPresentationSelected').value = '';
    document.getElementById('productQuantity').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('stockNA').checked = false;
    document.getElementById('productStock').disabled = false;

    // Bloquear proveedor
    document.getElementById('newOrderProviderSelect').disabled = true;
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Debe ingresar la cantidad de pedido y el stock actual, o marcar "N/A".'
    });
  }
}

/**
 * ================================
 * Editar / Eliminar producto
 * ================================
 */
function editNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  const cells = row.getElementsByTagName('td');

  const newQuantity = prompt('Nueva cantidad:', cells[2].textContent);
  if (newQuantity === null) return;
  if (newQuantity.trim() === '' || isNaN(newQuantity) || Number(newQuantity) <= 0) {
    Swal.fire({ icon: 'warning', title: 'Valor Inválido', text: 'Cantidad inválida.' });
    return;
  }
  cells[2].textContent = newQuantity;

  const currentStock = cells[3].textContent;
  if (currentStock === 'N/A') {
    const confirmNA = confirm('¿Deseas mantener el stock como "N/A"?');
    if (confirmNA) {
      cells[3].textContent = 'N/A';
      return;
    }
  }
  const newStock = prompt('Nuevo stock (escribe "N/A" si no aplica):', currentStock);
  if (newStock === null) return;
  if (newStock.trim().toUpperCase() === 'N/A') {
    cells[3].textContent = 'N/A';
  } else if (!isNaN(newStock) && Number(newStock) >= 0) {
    cells[3].textContent = newStock;
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Valor Inválido',
      text: 'El stock debe ser un número válido o "N/A".'
    });
  }
}

function deleteNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);

  const tbody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  if (tbody.rows.length === 0) {
    document.getElementById('newOrderProviderSelect').disabled = false;
  }
}

/**
 * ================================
 * Guardar el pedido (nuevo/editar)
 * ================================
 */
async function saveNewOrder() {
  const providerSelect = document.getElementById('newOrderProviderSelect');
  const providerId = providerSelect.value;
  const providerName = providerSelect.options[providerSelect.selectedIndex]?.text || '';

  const sucursalId = userSucursalId;
  const sucursalName = userSucursalName;

  const orderDate = document.getElementById('orderDate').value;
  const orderId = document.getElementById('orderId').value;

  const tableBody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  const rows = tableBody.getElementsByTagName('tr');
  const products = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName('td');
    products.push({
      name: cells[0].textContent,
      presentation: cells[1].textContent,
      quantity: cells[2].textContent,
      stock: cells[3].textContent
    });
  }

  if (!providerId) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Debe seleccionar un proveedor.'
    });
    return;
  }
  if (!orderId) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'No se ha generado un ID de pedido.'
    });
    return;
  }
  if (products.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'No hay productos en el pedido.'
    });
    return;
  }

  let docRef = null;
  if (currentOrderId) {
    docRef = db.collection('orders').doc(currentOrderId);
  }

  Swal.fire({
    title: 'Guardar Pedido',
    text: '¿Cómo deseas guardar tu pedido?',
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Guardar',
    denyButtonText: `Preguardar`,
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        if (docRef) {
          // Editando
          await docRef.update({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            orderId,
            products,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Nuevo
          await db.collection('orders').add({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            orderId,
            products,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        // Mostrar confirm + opciones de exportar
        showOrderConfirmationModal({
          orderId,
          providerName,
          sucursalName,
          orderDate,
          products
        });

        closeOrderCreationContainer();

      } catch (error) {
        console.error('Error al guardar pedido:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al guardar el pedido: ' + error.message
        });
      }
    } else if (result.isDenied) {
      // Preguardar
      try {
        if (docRef) {
          await docRef.update({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            orderId,
            products,
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
            orderId,
            products,
            status: 'preSaved',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        Swal.fire({
          icon: 'success',
          title: 'Pedido Preguardado',
          text: 'El pedido se preguardó exitosamente.'
        });

        closeOrderCreationContainer();
      } catch (error) {
        console.error('Error al preguardar pedido:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al preguardar el pedido: ' + error.message
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

/**
 * ================================
 * Cerrar contenedor de creación
 * ================================
 */
function closeOrderCreationContainer() {
  document.getElementById('orderCreationContainer').style.display = 'none';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';
  document.getElementById('newOrderProviderSelect').disabled = false;

  editingExistingOrder = false;
  currentOrderId = null;
  document.getElementById('newOrderTable').getElementsByTagName('tbody')[0].innerHTML = '';
}

/**
 * ================================
 * Mostrar confirmación y exportar
 * ================================
 */
function showOrderConfirmationModal(orderDetails) {
  let productsRows = '';
  orderDetails.products.forEach(product => {
    productsRows += `
      <tr>
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.presentation)}</td>
        <td>${product.quantity}</td>
        <td>${product.stock}</td>
      </tr>
    `;
  });

  const orderTableHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2>Pedido Confirmado</h2>
    </div>
    <div style="text-align: left;">
      <p><strong>ID Pedido:</strong> 
         <span style="font-size: 18px; font-weight: bold;">
           ${escapeHtml(orderDetails.orderId)}
         </span></p>
      <p><strong>Proveedor:</strong> ${escapeHtml(orderDetails.providerName)}</p>
      <p><strong>Sucursal:</strong> ${escapeHtml(orderDetails.sucursalName)}</p>
      <p><strong>Fecha de Pedido:</strong> ${escapeHtml(orderDetails.orderDate)}</p>
      <h3>Productos:</h3>
      <table border="1" style="width:100%; text-align:left;">
        <tr>
          <th>Producto</th>
          <th>Presentación</th>
          <th>Cantidad</th>
          <th>Stock</th>
        </tr>
        ${productsRows}
      </table>
    </div>
  `;

  Swal.fire({
    title: 'Confirme su Pedido',
    html: orderTableHTML,
    showCancelButton: true,
    confirmButtonText: 'Compartir Pedido',
    cancelButtonText: 'Cerrar',
    width: '600px',
    focusConfirm: false,
    preConfirm: () => 'compartir'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'Compartir Pedido',
        text: '¿Cómo deseas compartir tu pedido?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Exportar como Imagen',
        denyButtonText: `Exportar como PDF`,
        cancelButtonText: 'Cancelar'
      }).then((res2) => {
        if (res2.isConfirmed) {
          exportOrderAsImage(orderDetails);
        } else if (res2.isDenied) {
          exportOrderAsPDF(orderDetails);
        }
      });
    }
  });
}

/**
 * ================================
 * Exportar pedido como Imagen
 * ================================
 */
function exportOrderAsImage(orderDetails) {
  document.getElementById('imgOrderId').textContent = orderDetails.orderId;
  document.getElementById('imgProviderName').textContent = orderDetails.providerName;
  document.getElementById('imgSucursalName').textContent = orderDetails.sucursalName;
  document.getElementById('imgOrderDate').textContent = orderDetails.orderDate;

  const imgProductsTableBody = document.getElementById('imgProductsTableBody');
  imgProductsTableBody.innerHTML = '';
  orderDetails.products.forEach(product => {
    const row = imgProductsTableBody.insertRow();
    row.insertCell(0).textContent = product.name;
    row.insertCell(1).textContent = product.presentation;
    row.insertCell(2).textContent = product.quantity;
    row.insertCell(3).textContent = product.stock;
  });

  const orderDetailsElement = document.getElementById('orderDetailsForImage');
  orderDetailsElement.style.display = 'block';
  orderDetailsElement.style.left = '50%';
  orderDetailsElement.style.transform = 'translateX(-50%)';

  html2canvas(orderDetailsElement, { scale: 2 })
    .then(canvas => {
      canvas.toBlob(blob => {
        if (blob) {
          const imgData = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `Pedido_${orderDetails.orderId}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          Swal.fire({
            icon: 'success',
            title: 'Imagen Exportada',
            text: 'El pedido se exportó como imagen exitosamente.'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al generar la imagen del pedido.'
          });
        }
      }, 'image/jpeg', 0.95);

      orderDetailsElement.style.display = 'none';
      orderDetailsElement.style.left = '-9999px';
    })
    .catch(error => {
      console.error('Error al exportar imagen:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo exportar el pedido como imagen.'
      });
      orderDetailsElement.style.display = 'none';
      orderDetailsElement.style.left = '-9999px';
    });
}

/**
 * ================================
 * Exportar pedido como PDF
 * ================================
 */
function exportOrderAsPDF(orderDetails) {
  document.getElementById('imgOrderId').textContent = orderDetails.orderId;
  document.getElementById('imgProviderName').textContent = orderDetails.providerName;
  document.getElementById('imgSucursalName').textContent = orderDetails.sucursalName;
  document.getElementById('imgOrderDate').textContent = orderDetails.orderDate;

  const imgProductsTableBody = document.getElementById('imgProductsTableBody');
  imgProductsTableBody.innerHTML = '';
  orderDetails.products.forEach(product => {
    const row = imgProductsTableBody.insertRow();
    row.insertCell(0).textContent = product.name;
    row.insertCell(1).textContent = product.presentation;
    row.insertCell(2).textContent = product.quantity;
    row.insertCell(3).textContent = product.stock;
  });

  const orderDetailsElement = document.getElementById('orderDetailsForImage');
  orderDetailsElement.style.display = 'block';
  orderDetailsElement.style.left = '50%';
  orderDetailsElement.style.transform = 'translateX(-50%)';

  html2canvas(orderDetailsElement, { scale: 2 })
    .then(canvas => {
      canvas.toBlob(blob => {
        if (blob) {
          const imgData = URL.createObjectURL(blob);

          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [orderDetailsElement.offsetWidth, orderDetailsElement.offsetHeight]
          });
          pdf.addImage(
            imgData,
            'JPEG',
            0,
            0,
            orderDetailsElement.offsetWidth,
            orderDetailsElement.offsetHeight
          );
          pdf.save(`Pedido_${orderDetails.orderId}.pdf`);

          Swal.fire({
            icon: 'success',
            title: 'PDF Exportado',
            text: 'El pedido se exportó como PDF exitosamente.'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al generar el PDF del pedido.'
          });
        }
      }, 'image/jpeg', 0.95);

      orderDetailsElement.style.display = 'none';
      orderDetailsElement.style.left = '-9999px';
    })
    .catch(error => {
      console.error('Error al exportar PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo exportar el pedido como PDF.'
      });
      orderDetailsElement.style.display = 'none';
      orderDetailsElement.style.left = '-9999px';
    });
}

/**
 * ================================
 * Editar Pedido
 * ================================
 */
async function editOrder(orderId) {
  try {
    const docSnap = await db.collection('orders').doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró el pedido a editar.'
      });
      return;
    }
    const orderData = docSnap.data();
    editingExistingOrder = true;
    currentOrderId = orderId;

    document.getElementById('preSavedOrdersContainer').style.display = 'none';
    document.getElementById('orderCreationContainer').style.display = 'block';

    // Asignar sucursal + bloquear
    const selectSucursal = document.getElementById('newOrderSucursalSelect');
    selectSucursal.innerHTML = '';
    const option = document.createElement('option');
    option.value = userSucursalId;
    option.textContent = userSucursalName;
    selectSucursal.appendChild(option);
    selectSucursal.disabled = true;

    // Proveedor
    document.getElementById('newOrderProviderSelect').disabled = false;
    document.getElementById('newOrderProviderSelect').value = orderData.providerId;
    document.getElementById('orderDate').value = orderData.orderDate;
    document.getElementById('orderId').value = orderData.orderId;

    if (userRole !== 'administrador') {
      document.getElementById('orderDate').disabled = true;
    }

    const tableBody = document.getElementById('newOrderTable')
      .getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    // Cargar productos
    orderData.products.forEach(prod => {
      const row = tableBody.insertRow();
      row.insertCell(0).textContent = prod.name;
      row.insertCell(1).textContent = prod.presentation;
      row.insertCell(2).textContent = prod.quantity;
      row.insertCell(3).textContent = prod.stock;
      row.insertCell(4).innerHTML = `
        <button onclick="editNewOrderProduct(this)">Editar</button>
        <button onclick="deleteNewOrderProduct(this)">Eliminar</button>
      `;
    });

    if (orderData.products.length > 0) {
      document.getElementById('newOrderProviderSelect').disabled = true;
    }

    loadNewOrderProviders();

  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al editar pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Mostrar Pedido Completado
 * ================================
 */
async function showReceivedOrder(orderId) {
  try {
    const docRef = await db.collection('orders').doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el pedido.' });
      return;
    }
    const order = docRef.data();
    const modal = document.getElementById('receivedOrderModal');
    const container = document.getElementById('receivedOrderDetails');

    let html = `
      <p><strong>ID Pedido:</strong> ${order.orderId}</p>
      <p><strong>Proveedor:</strong> ${order.providerName}</p>
      <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
      <p><strong>Fecha:</strong> ${order.orderDate}</p>
    `;

    if (order.status !== 'completed') {
      html += `<p style="color:red;"><strong>Atención:</strong> Este pedido aún no está completado.</p>`;
    }

    html += `
      <table border="1" style="width:100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Cantidad</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
    `;

    order.products.forEach(prod => {
      html += `
        <tr>
          <td>${prod.name}</td>
          <td>${prod.presentation}</td>
          <td>${prod.quantity}</td>
          <td>${prod.stock}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;

    container.innerHTML = html;
    modal.style.display = 'block';

    modal.dataset.exportOrderId = orderId;

  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Error', text: error.message });
  }
}

function closeReceivedOrderModal() {
  document.getElementById('receivedOrderDetails').innerHTML = '';
  document.getElementById('receivedOrderModal').style.display = 'none';
}

/**
 * ================================
 * Exportar Pedido Recibido como Imagen
 * ================================
 */
async function exportReceivedOrderAsImage() {
  try {
    const modal = document.getElementById('receivedOrderModal');
    const orderId = modal.dataset.exportOrderId;
    if (!orderId) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se identificó el pedido.' });
      return;
    }

    // Obtener datos
    const docRef = await db.collection('orders').doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el pedido a exportar.' });
      return;
    }
    const order = docRef.data();

    document.getElementById('imgOrderId').textContent = order.orderId;
    document.getElementById('imgProviderName').textContent = order.providerName;
    document.getElementById('imgSucursalName').textContent = order.sucursalName;
    document.getElementById('imgOrderDate').textContent = order.orderDate;

    const imgProductsTableBody = document.getElementById('imgProductsTableBody');
    imgProductsTableBody.innerHTML = '';
    order.products.forEach(prod => {
      const row = imgProductsTableBody.insertRow();
      row.insertCell(0).textContent = prod.name;
      row.insertCell(1).textContent = prod.presentation;
      row.insertCell(2).textContent = prod.quantity;
      row.insertCell(3).textContent = prod.stock;
    });

    const hiddenContainer = document.getElementById('orderDetailsForImage');
    hiddenContainer.style.display = 'block';
    hiddenContainer.style.left = '50%';
    hiddenContainer.style.transform = 'translateX(-50%)';

    const canvas = await html2canvas(hiddenContainer, { scale: 2 });
    canvas.toBlob(blob => {
      if (blob) {
        const imgData = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `PedidoRecibido_${order.orderId}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
          icon: 'success',
          title: 'Imagen Exportada',
          text: 'El pedido recibido se exportó como imagen exitosamente.'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo generar la imagen del pedido recibido.'
        });
      }

      hiddenContainer.style.display = 'none';
      hiddenContainer.style.left = '-9999px';
      hiddenContainer.style.transform = 'none';
    }, 'image/jpeg', 0.95);

  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el pedido recibido.' });
    console.error(err);
  }
}
