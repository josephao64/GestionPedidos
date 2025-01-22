// Importar jsPDF desde el objeto global proporcionado por la biblioteca jsPDF   
const { jsPDF } = window.jspdf;

/**
 * ================================
 * Variables globales
 * ================================
 */
let db;                         // Firestore DB a nivel global
let userSucursalId = null;      // ID de la sucursal a la que pertenece el usuario
let userSucursalName = null;    // Nombre de la sucursal (para mostrar)
let userRole = null;            // Rol del usuario (administrador / usuario)
let currentOrderId = null;      // ID del pedido actual (nuevo o preguardado)

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
  if (userRole === 'administrador') {
    loadPendingOrdersAdmin();
    loadInProcessOrdersAdmin();
  }

  // Manejo del checkbox 'N/A' para stock
  const stockNA = document.getElementById('stockNA');
  const stockInput = document.getElementById('productStock');
  if (stockNA && stockInput) {
    stockNA.addEventListener('change', function () {
      if (this.checked) {
        stockInput.value = 'N/A';
        stockInput.disabled = true;
      } else {
        stockInput.value = '';
        stockInput.disabled = false;
      }
    });
  }

  // Inicialmente, solo se muestran los botones principales
  // Las secciones están ocultas hasta que se presione un botón
  document.getElementById('ordersContainer').style.display = 'none';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';
  document.getElementById('pendingOrdersAdminCards').style.display = 'none';
  document.getElementById('inProcessOrdersAdminCards').style.display = 'none';
  document.getElementById('orderCreationContainer').style.display = 'none';
});

/**
 * ================================
 * Función: obtenerSucursalDelUsuario
 * ================================
 */
async function obtenerSucursalDelUsuario() {
  const usuarioLogueado = localStorage.getItem('usuarioLogueado');

  // Si no hay usuario logueado, redirigir a login.
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

      // Asignar automáticamente la sucursal en el formulario y deshabilitar el selector para usuarios normales
      const selectSucursal = document.getElementById('newOrderSucursalSelect');
      if (selectSucursal) {
        selectSucursal.innerHTML = ''; // Limpia
        const option = document.createElement('option');
        option.value = userSucursalId;
        option.textContent = userSucursalName;
        selectSucursal.appendChild(option);
        if (userRole !== 'administrador') {
          selectSucursal.disabled = true; // Deshabilitar para usuarios normales
        } else {
          selectSucursal.disabled = false; // Habilitar para administradores
          cargarSucursalesSelectParaAdmin();
        }
      }

      // Deshabilitar la fecha de pedido para usuarios normales
      if (userRole !== 'administrador') {
        const orderDateInput = document.getElementById('orderDate');
        if (orderDateInput) {
          orderDateInput.disabled = true;
        }
      }

    } else {
      // Usuario no encontrado en la colección 'usuarios'
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
      text: 'Error al obtener la información de la sucursal. Inténtalo nuevamente.'
    });
  }
}

/**
 * ================================
 * Funciones para cargar Pedidos (Admin)
 * ================================
 */

// Cargar pedidos pendientes
async function loadPendingOrdersAdmin() {
  try {
    const ordersSnapshot = await db
      .collection('orders')
      .where('status', '==', 'pending')
      .get();

    const pendingOrdersAdminCards = document.getElementById('pendingOrdersAdminCards');
    if (!pendingOrdersAdminCards) return; // Si no existe en tu HTML, salir

    pendingOrdersAdminCards.innerHTML = '';

    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order);
      pendingOrdersAdminCards.appendChild(card);
    });

    // Mostrar el contenedor solo si hay pedidos pendientes
    if (ordersSnapshot.empty) {
      pendingOrdersAdminCards.style.display = 'none';
    } else {
      pendingOrdersAdminCards.style.display = 'block';
    }

  } catch (error) {
    console.error('Error al cargar pedidos pendientes:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar pedidos pendientes: ' + error.message
    });
  }
}

// Cargar pedidos en proceso
async function loadInProcessOrdersAdmin() {
  try {
    // Filtrar por varios estados
    const ordersSnapshot = await db
      .collection('orders')
      .where('status', 'in', [
        'pedidoTomado',
        'caminoABodega',
        'pedidoEnBodega',
        'caminoATienda'
      ])
      .get();

    const inProcessOrdersAdminCards = document.getElementById('inProcessOrdersAdminCards');
    if (!inProcessOrdersAdminCards) return; // Si no existe en tu HTML, salir

    inProcessOrdersAdminCards.innerHTML = '';

    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order);
      inProcessOrdersAdminCards.appendChild(card);
    });

    // Mostrar el contenedor solo si hay pedidos en proceso
    if (ordersSnapshot.empty) {
      inProcessOrdersAdminCards.style.display = 'none';
    } else {
      inProcessOrdersAdminCards.style.display = 'block';
    }

  } catch (error) {
    console.error('Error al cargar pedidos en proceso:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar pedidos en proceso: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para crear tarjeta de pedido
 * ================================
 */
function createOrderCard(orderId, order) {
  const card = document.createElement('div');
  card.className = 'order-card';
  card.innerHTML = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
    ${
      order.status === 'pending'
        ? `<button onclick="confirmOrder('${orderId}')">Confirmar Pedido</button>`
        : ''
    }
    <button onclick="editOrder('${orderId}')">Editar Pedido</button>
  `;
  return card;
}

/**
 * ================================
 * Función para confirmar pedido
 * Cambia el estado de 'pending' a 'pedidoTomado'
 * ================================
 */
async function confirmOrder(orderId) {
  try {
    // Cambiar el estado a 'pedidoTomado'
    await db.collection('orders').doc(orderId).update({ status: 'pedidoTomado' });
    loadPendingOrdersAdmin();
    loadInProcessOrdersAdmin();
    Swal.fire({
      icon: 'success',
      title: 'Pedido Confirmado',
      text: 'El pedido ha sido confirmado exitosamente.'
    });
  } catch (error) {
    console.error('Error al confirmar el pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al confirmar el pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para mostrar el contenedor
 * de creación de nuevo pedido
 * ================================
 */
async function showOrderCreationContainer() {
  // Mostrar contenedor de creación
  document.getElementById('orderCreationContainer').style.display = 'block';
  document.getElementById('ordersContainer').style.display = 'block';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';

  // Cargar proveedores
  loadNewOrderProviders();

  // Colocar fecha de hoy (solo si el usuario es administrador)
  if (userRole === 'administrador') {
    setOrderDateToToday();
  } else {
    // Para usuarios normales, la fecha ya está fijada y deshabilitada
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
  }

  // Generar nuevo ID de pedido
  generateOrderId();

  // Limpiar cualquier pedido actual
  currentOrderId = null;
  limpiarFormulario();
}

/**
 * ================================
 * Función para mostrar Pedidos Preguardados
 * ================================
 */
async function showPreSavedOrders() {
  // Ocultar otras secciones
  document.getElementById('ordersContainer').style.display = 'none';
  document.getElementById('orderCreationContainer').style.display = 'none';
  // Mostrar contenedor de pedidos preguardados
  document.getElementById('preSavedOrdersContainer').style.display = 'block';

  // Cargar pedidos preguardados
  loadPreSavedOrders();
}

/**
 * ================================
 * Función para cargar Pedidos Preguardados
 * ================================
 */
async function loadPreSavedOrders() {
  try {
    const preSavedOrdersSnapshot = await db
      .collection('orders')
      .where('status', '==', 'preSaved')
      .get();

    const preSavedOrdersTableBody = document.getElementById('preSavedOrdersTable')
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
        <button onclick="deletePreSavedOrder('${doc.id}')">Eliminar Pedido</button>
      `;
    });

    // Mostrar el contenedor solo si hay pedidos preguardados
    if (preSavedOrdersSnapshot.empty) {
      document.getElementById('preSavedOrdersContainer').style.display = 'none';
    } else {
      document.getElementById('preSavedOrdersContainer').style.display = 'block';
    }

  } catch (error) {
    console.error('Error al cargar pedidos preguardados:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar pedidos preguardados: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para abrir un Pedido Preguardado
 * ================================
 */
async function openPreSavedOrder(orderDocId) {
  try {
    const orderDoc = await db.collection('orders').doc(orderDocId).get();
    if (orderDoc.exists) {
      const orderData = orderDoc.data();
      currentOrderId = orderDocId; // Guardar el ID del pedido actual

      // Ocultar otras secciones y mostrar el formulario de creación de pedidos
      document.getElementById('ordersContainer').style.display = 'none';
      document.getElementById('preSavedOrdersContainer').style.display = 'none';
      document.getElementById('orderCreationContainer').style.display = 'block';

      // Cargar datos del pedido en el formulario
      document.getElementById('newOrderProviderSelect').value = orderData.providerId;
      document.getElementById('newOrderSucursalSelect').value = orderData.sucursalId;
      document.getElementById('orderDate').value = orderData.orderDate;
      document.getElementById('orderId').value = orderData.orderId;

      // Deshabilitar la fecha de pedido si no es administrador
      if (userRole !== 'administrador') {
        document.getElementById('orderDate').disabled = true;
      }

      // Bloquear el selector de proveedor si ya hay productos
      if (orderData.products.length > 0) {
        document.getElementById('newOrderProviderSelect').disabled = true;
      }

      // Limpiar la tabla de productos actual
      const newOrderTableBody = document
        .getElementById('newOrderTable')
        .getElementsByTagName('tbody')[0];
      newOrderTableBody.innerHTML = '';

      // Cargar productos del pedido en la tabla
      orderData.products.forEach(product => {
        const row = newOrderTableBody.insertRow();

        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);
        const cell5 = row.insertCell(4);

        cell1.textContent = product.name;
        cell2.textContent = product.presentation;
        cell3.textContent = product.quantity;
        cell4.textContent = product.stock;
        cell5.innerHTML = `
          <button onclick="editNewOrderProduct(this)">Editar</button>
          <button onclick="deleteNewOrderProduct(this)">Eliminar</button>
        `;
      });

      // Cargar proveedores (para asegurar que el proveedor seleccionado esté disponible)
      loadNewOrderProviders();

    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El pedido preguardado no existe.'
      });
    }
  } catch (error) {
    console.error('Error al abrir el pedido preguardado:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al abrir el pedido preguardado: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para generar ID pedido
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
      text: 'Error al generar ID de pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para colocar la fecha de hoy
 * ================================
 */
function setOrderDateToToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('orderDate').value = today;
}

/**
 * ================================
 * Función para cargar proveedores
 * ================================
 */
async function loadNewOrderProviders() {
  try {
    const providersSnapshot = await db.collection('providers').get();
    const newOrderProviderSelect = document.getElementById('newOrderProviderSelect');
    newOrderProviderSelect.innerHTML = '<option value="" disabled selected>-- Selecciona un Proveedor --</option>';

    providersSnapshot.forEach(function(doc) {
      const provider = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = provider.name;
      newOrderProviderSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar proveedores del pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar proveedores del pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para mostrar tabla de productos
 * según el proveedor seleccionado
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

    const productSelectionTableBody = document
      .getElementById('productSelectionTable')
      .getElementsByTagName('tbody')[0];

    productSelectionTableBody.innerHTML = '';

    productsSnapshot.forEach((doc) => {
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
    console.error('Error al cargar productos para el pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar productos para el pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para escapar HTML
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
 * Filtrar productos en la búsqueda
 * ================================
 */
function filterProducts() {
  const input = document.getElementById('productSearch');
  const filter = input.value.toLowerCase();
  const table = document.getElementById('productSelectionTable');
  const tr = table.getElementsByTagName('tr');

  for (let i = 2; i < tr.length; i++) { // Iniciar desde 2 para omitir el campo de búsqueda
    const td = tr[i].getElementsByTagName('td')[0];
    if (td) {
      const txtValue = td.textContent || td.innerText;
      tr[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? '' : 'none';
    }
  }
}

/**
 * ================================
 * Función para seleccionar producto
 * ================================
 */
function selectProductForOrder(event) {
  const button = event.target;
  const productId = button.getAttribute('data-id');
  const productName = button.getAttribute('data-name');
  const productPresentation = button.getAttribute('data-presentation');

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

/**
 * ================================
 * Función para mostrar modal
 * de selección de producto
 * ================================
 */
function showProductSelectionModal() {
  loadNewOrderProducts();
  document.getElementById('productSelectionModal').style.display = 'block';
}

/**
 * ================================
 * Función para cerrar modal
 * de selección de producto
 * ================================
 */
function closeProductSelectionModal() {
  document.getElementById('productSelectionModal').style.display = 'none';
}

/**
 * ================================
 * Añadir producto al nuevo pedido
 * ================================
 */
function addProductToNewOrder() {
  const productName = document.getElementById('productNameSelected').value;
  const productPresentation = document.getElementById('productPresentationSelected').value;
  const quantity = document.getElementById('productQuantity').value;
  const stockNA = document.getElementById('stockNA').checked;
  const stockValue = document.getElementById('productStock').value;

  if (productName && productPresentation && quantity && (stockNA || stockValue)) {
    const newOrderTableBody = document
      .getElementById('newOrderTable')
      .getElementsByTagName('tbody')[0];
    const row = newOrderTableBody.insertRow();

    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3);
    const cell5 = row.insertCell(4);

    cell1.textContent = productName;
    cell2.textContent = productPresentation;
    cell3.textContent = quantity;
    cell4.textContent = stockNA ? 'N/A' : stockValue;
    cell5.innerHTML = `
      <button onclick="editNewOrderProduct(this)">Editar</button>
      <button onclick="deleteNewOrderProduct(this)">Eliminar</button>
    `;

    // Limpiar campos
    document.getElementById('productNameSelected').value = '';
    document.getElementById('productPresentationSelected').value = '';
    document.getElementById('productQuantity').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('stockNA').checked = false;
    document.getElementById('productStock').disabled = false;

    // Bloquear el selector de proveedor después de agregar el primer producto
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
 * Editar producto en la tabla
 * ================================
 */
function editNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  const cells = row.getElementsByTagName('td');

  // Cantidad
  const newQuantity = prompt('Nueva cantidad:', cells[2].textContent);
  if (newQuantity === null) return; 
  if (newQuantity.trim() === '' || isNaN(newQuantity) || Number(newQuantity) <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Valor Inválido',
      text: 'La cantidad debe ser un número positivo.'
    });
    return;
  }
  cells[2].textContent = newQuantity;

  // Stock
  const currentStock = cells[3].textContent;
  if (currentStock === 'N/A') {
    // Preguntar si lo mantiene N/A
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

/**
 * ================================
 * Eliminar producto del pedido
 * ================================
 */
function deleteNewOrderProduct(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);

  // Si no hay más productos, desbloquear el proveedor
  const newOrderTableBody = document
    .getElementById('newOrderTable')
    .getElementsByTagName('tbody')[0];
  if (newOrderTableBody.rows.length === 0) {
    document.getElementById('newOrderProviderSelect').disabled = false;
  }
}

/**
 * ================================
 * Guardar el nuevo pedido con opciones
 * ================================
 */
async function saveNewOrder() {
  const providerId = document.getElementById('newOrderProviderSelect').value;
  const providerName =
    document.getElementById('newOrderProviderSelect').options[
      document.getElementById('newOrderProviderSelect').selectedIndex
    ]?.text || '';
  
  const sucursalId = document.getElementById('newOrderSucursalSelect').value;
  const sucursalName =
    document.getElementById('newOrderSucursalSelect').options[
      document.getElementById('newOrderSucursalSelect').selectedIndex
    ]?.text || '';
  
  const orderDate = document.getElementById('orderDate').value;
  const orderId = document.getElementById('orderId').value;

  const newOrderTableBody = document
    .getElementById('newOrderTable')
    .getElementsByTagName('tbody')[0];
  const rows = newOrderTableBody.getElementsByTagName('tr');

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

  if (products.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'No hay productos en el pedido'
    });
    return;
  }

  // Mostrar opciones Guardar, Preguardar, Cancelar
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
      // Opción Guardar
      try {
        if (currentOrderId) {
          // Si existe un pedido actual (preguardado), actualizarlo y cambiar estado a 'pending'
          await db.collection('orders').doc(currentOrderId).update({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            products,
            status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Nuevo pedido
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

        // Mostrar alerta de confirmación con opciones para compartir
        showOrderConfirmationModal({
          orderId,
          providerName,
          sucursalName,
          orderDate,
          products
        });

        // Resetear formulario
        closeOrderCreationContainer();
        if (document.getElementById('pendingOrdersAdminCards')) {
          loadPendingOrdersAdmin();
        }

      } catch (error) {
        console.error('Error al guardar el pedido:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al guardar el pedido: ' + error.message
        });
      }
    } else if (result.isDenied) {
      // Opción Preguardar
      try {
        if (currentOrderId) {
          // Actualizar pedido existente y mantener estado como 'preSaved'
          await db.collection('orders').doc(currentOrderId).update({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            products,
            status: 'preSaved',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Crear nuevo pedido con estado 'preSaved'
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
          text: 'El pedido ha sido preguardado exitosamente.'
        });

        // Resetear formulario
        closeOrderCreationContainer();
        // Actualizar la lista de pedidos preguardados si está visible
        if (document.getElementById('preSavedOrdersContainer').style.display === 'block') {
          loadPreSavedOrders();
        }

      } catch (error) {
        console.error('Error al preguardar el pedido:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al preguardar el pedido: ' + error.message
        });
      }
    } else {
      // Opción Cancelar
      Swal.fire({
        icon: 'info',
        title: 'Operación Cancelada',
        text: 'Puedes seguir agregando productos a tu pedido.'
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
  document.getElementById('ordersContainer').style.display = 'block';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';

  // Desbloquear el selector de proveedor y limpiar la tabla
  document.getElementById('newOrderProviderSelect').disabled = false;
  document.getElementById('newOrderTable').getElementsByTagName('tbody')[0].innerHTML = '';
}

/**
 * ================================
 * Mostrar la alerta de confirmación
 * usando SweetAlert2
 * ================================
 */
function showOrderConfirmationModal(orderDetails) {
  // Construir la tabla HTML de productos
  let productsRows = '';
  orderDetails.products.forEach((product) => {
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
      <p><strong>ID Pedido:</strong> <span style="font-size: 18px; font-weight: bold;">
        ${escapeHtml(orderDetails.orderId)}</span></p>
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
      // Mostrar opciones para compartir: Exportar como Imagen o PDF
      Swal.fire({
        title: 'Compartir Pedido',
        text: '¿Cómo deseas compartir tu pedido?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Exportar como Imagen',
        denyButtonText: `Exportar como PDF`,
        cancelButtonText: 'Cancelar'
      }).then((result2) => {
        if (result2.isConfirmed) {
          exportOrderAsImage(orderDetails);
        } else if (result2.isDenied) {
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
  // Llenar contenedor oculto
  document.getElementById('imgOrderId').textContent = orderDetails.orderId;
  document.getElementById('imgProviderName').textContent = orderDetails.providerName;
  document.getElementById('imgSucursalName').textContent = orderDetails.sucursalName;
  document.getElementById('imgOrderDate').textContent = orderDetails.orderDate;

  // Limpiar tabla de productos en el contenedor
  const imgProductsTableBody = document.getElementById('imgProductsTableBody');
  imgProductsTableBody.innerHTML = '';

  orderDetails.products.forEach(product => {
    const row = imgProductsTableBody.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3);
    cell1.textContent = product.name;
    cell2.textContent = product.presentation;
    cell3.textContent = product.quantity;
    cell4.textContent = product.stock;
  });

  const orderDetailsElement = document.getElementById('orderDetailsForImage');
  orderDetailsElement.style.display = 'block';
  orderDetailsElement.style.left = '50%';
  orderDetailsElement.style.transform = 'translateX(-50%)';

  html2canvas(orderDetailsElement, { scale: 2 })
    .then(canvas => {
      canvas.toBlob((blob) => {
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
            text: 'El pedido ha sido exportado como imagen exitosamente.'
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
      console.error('Error al exportar la imagen:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al exportar la imagen del pedido.'
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
  // Rellenar contenedor oculto
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
      canvas.toBlob((blob) => {
        if (blob) {
          const imgData = URL.createObjectURL(blob);

          // Crear pdf
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [
              orderDetailsElement.offsetWidth,
              orderDetailsElement.offsetHeight
            ]
          });
          pdf.addImage(
            imgData,
            'JPEG',
            0,
            0,
            orderDetailsElement.offsetWidth,
            orderDetailsElement.offsetHeight
          );

          // Descargar
          pdf.save(`Pedido_${orderDetails.orderId}.pdf`);

          Swal.fire({
            icon: 'success',
            title: 'PDF Exportado',
            text: 'El pedido ha sido exportado como PDF exitosamente.'
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
      console.error('Error al exportar el PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al exportar el PDF del pedido.'
      });
      orderDetailsElement.style.display = 'none';
      orderDetailsElement.style.left = '-9999px';
    });
}

/**
 * ================================
 * Función para editar pedido (no implementado)
 * ================================
 */
function editOrder(orderId) {
  Swal.fire({
    icon: 'info',
    title: 'Funcionalidad No Implementada',
    text: 'La funcionalidad de editar pedidos aún no está implementada.'
  });
}

/**
 * ================================
 * Función para mostrar la lista de pedidos
 * ================================
 */
function showOrders() {
  // Muestra la sección principal de “Gestión de Pedidos”
  document.getElementById('ordersContainer').style.display = 'block';
  document.getElementById('preSavedOrdersContainer').style.display = 'none';
  document.getElementById('orderCreationContainer').style.display = 'block';

  // Cargar y mostrar el formulario de creación de pedidos
  showOrderCreationContainer();

  // Si el usuario es administrador, asegurarse de que las tarjetas de pedidos pendientes y en proceso estén visibles
  if (userRole === 'administrador') {
    document.getElementById('pendingOrdersAdminCards').style.display = 'block';
    document.getElementById('inProcessOrdersAdminCards').style.display = 'block';
  }
}

/**
 * ================================
 * Función para cargar Pedidos Preguardados
 * ================================
 */
// Ya está definida anteriormente como loadPreSavedOrders()

/**
 * ================================
 * Función para abrir un Pedido Preguardado
 * ================================
 */
// Ya está definida anteriormente como openPreSavedOrder(orderDocId)

/**
 * ================================
 * Función para editar pedido (no implementado)
 * ================================
 */
// Ya está definida anteriormente como editOrder(orderId)

/**
 * ================================
 * Función para eliminar un Pedido Preguardado
 * ================================
 */
async function deletePreSavedOrder(orderDocId) {
  try {
    // Confirmar eliminación con el usuario
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará el pedido preguardado permanentemente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      // Eliminar el pedido de Firestore
      await db.collection('orders').doc(orderDocId).delete();

      Swal.fire({
        icon: 'success',
        title: 'Eliminado',
        text: 'El pedido preguardado ha sido eliminado exitosamente.'
      });

      // Recargar la lista de pedidos preguardados
      loadPreSavedOrders();
    }
  } catch (error) {
    console.error('Error al eliminar el pedido preguardado:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al eliminar el pedido preguardado: ' + error.message
    });
  }
}

/**
 * ================================
 * Cargar lista de sucursales (Admin)
 * ================================
 */
async function cargarSucursalesSelectParaAdmin() {
  try {
    const sucursalesSnap = await db.collection('sucursales').get();
    const selectSucursal = document.getElementById('newOrderSucursalSelect');
    selectSucursal.innerHTML = '<option value="" disabled selected>-- Selecciona una Sucursal --</option>';

    sucursalesSnap.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;         
      option.textContent = data.name;
      selectSucursal.appendChild(option);
    });

  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error al cargar sucursales',
      text: error.message,
      confirmButtonText: 'Ok'
    });
  }
}

/**
 * ================================
 * Función para limpiar el formulario
 * ================================
 */
function limpiarFormulario() {
  document.getElementById('newOrderProviderSelect').value = '';
  // La sucursal ya está asignada automáticamente y deshabilitada
  // No es necesario cambiarla
  if (userRole === 'administrador') {
    setOrderDateToToday();
  } else {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
  }
  document.getElementById('orderId').value = '';
  document.getElementById('newOrderTable').getElementsByTagName('tbody')[0].innerHTML = '';
}

/**
 * ================================
 * Función para mostrar la lista de pedidos
 * ================================
 */
// Ya está definida anteriormente como showOrders()

