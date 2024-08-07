document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('pendingOrdersAdminCards')) {
      loadPendingOrdersAdmin();
  }
});

// Inicializa Firebase
var firebaseConfig = {
  apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
  authDomain: "logisticdb-2e63c.firebaseapp.com",
  projectId: "logisticdb-2e63c",
  storageBucket: "logisticdb-2e63c.appspot.com",
  messagingSenderId: "917523682093",
  appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

async function loadPendingOrdersAdmin() {
  try {
      const ordersSnapshot = await db.collection('orders').where('status', '==', 'pending').get();
      const pendingOrdersAdminCards = document.getElementById('pendingOrdersAdminCards');
      pendingOrdersAdminCards.innerHTML = '';

      ordersSnapshot.forEach(doc => {
          const order = doc.data();
          const card = createOrderCard(doc.id, order);
          pendingOrdersAdminCards.appendChild(card);
      });
  } catch (error) {
      console.error('Error al cargar pedidos pendientes:', error);
      alert('Error al cargar pedidos pendientes: ' + error.message);
  }
}

async function confirmOrder(orderId) {
  try {
      await db.collection('orders').doc(orderId).update({ status: 'inProcess' });
      loadPendingOrdersAdmin();
      loadInProcessOrdersAdmin();
  } catch (error) {
      console.error('Error al confirmar el pedido:', error);
      alert('Error al confirmar el pedido: ' + error.message);
  }
}

function createOrderCard(orderId, order) {
  const card = document.createElement('div');
  card.className = 'order-card';
  card.innerHTML = `
      <h3>Pedido ID: ${order.orderId}</h3>
      <p>Proveedor: ${order.providerName}</p>
      <p>Fecha: ${order.orderDate}</p>
      <button onclick="confirmOrder('${orderId}')">Confirmar Pedido</button>
      <button onclick="editOrder('${orderId}')">Editar Pedido</button>
  `;
  return card;
}

async function loadInProcessOrdersAdmin() {
  try {
      const ordersSnapshot = await db.collection('orders').where('status', '==', 'inProcess').get();
      const inProcessOrdersAdminCards = document.getElementById('inProcessOrdersAdminCards');
      inProcessOrdersAdminCards.innerHTML = '';

      ordersSnapshot.forEach(doc => {
          const order = doc.data();
          const card = createOrderCard(doc.id, order);
          inProcessOrdersAdminCards.appendChild(card);
      });
  } catch (error) {
      console.error('Error al cargar pedidos en proceso:', error);
      alert('Error al cargar pedidos en proceso: ' + error.message);
  }
}

function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("container");
  for (let i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
  }
  const tablinks = document.getElementsByClassName("tab-button");
  for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

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
      alert('Error al generar ID de pedido: ' + error.message);
  }
}

function showOrderCreationContainer() {
  document.getElementById('ordersContainer').style.display = 'none';
  document.getElementById('orderCreationContainer').style.display = 'block';
  loadNewOrderProviders();
  loadNewOrderSucursales(); // Cargar sucursales
  setOrderDateToToday();
  createNewOrderTab();
  generateOrderId();
}

function createNewOrderTab() {
  const tabContainer = document.getElementById('tabContainer');
  const newOrderTabButton = document.createElement('button');
  newOrderTabButton.className = 'tab-button active';
  newOrderTabButton.textContent = 'Nuevo Pedido';
  newOrderTabButton.onclick = (event) => openTab(event, 'orderCreationContainer');

  const closeButton = document.createElement('button');
  closeButton.className = 'close-tab';
  closeButton.textContent = '×';
  closeButton.onclick = (event) => {
      event.stopPropagation();
      closeTab(newOrderTabButton, 'orderCreationContainer');
  };

  newOrderTabButton.appendChild(closeButton);
  tabContainer.appendChild(newOrderTabButton);

  // Desactivar otras pestañas y activar la nueva pestaña
  const tabButtons = document.getElementsByClassName('tab-button');
  for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.remove('active');
  }
  newOrderTabButton.classList.add('active');
  openTab({ currentTarget: newOrderTabButton }, 'orderCreationContainer');
}

function closeTab(tabButton, tabName) {
  tabButton.remove();
  document.getElementById(tabName).style.display = 'none';

  // Activar la pestaña anterior
  const tabButtons = document.getElementsByClassName('tab-button');
  if (tabButtons.length > 0) {
      tabButtons[tabButtons.length - 1].click();
  }
}

function showProductSelectionModal() {
  loadNewOrderProducts(); // Carga los productos al abrir la ventana
  document.getElementById('productSelectionModal').style.display = 'block';
}

function closeProductSelectionModal() {
  document.getElementById('productSelectionModal').style.display = 'none';
}

async function loadNewOrderProviders() {
  try {
      var providersSnapshot = await db.collection('providers').get();
      var newOrderProviderSelect = document.getElementById('newOrderProviderSelect');
      newOrderProviderSelect.innerHTML = '';

      providersSnapshot.forEach(function(doc) {
          var provider = doc.data();
          var option = document.createElement('option');
          option.value = doc.id;
          option.textContent = provider.name;
          newOrderProviderSelect.appendChild(option);
      });
  } catch (error) {
      console.error('Error al cargar proveedores del pedido:', error);
      alert('Error al cargar proveedores del pedido: ' + error.message);
  }
}

async function loadNewOrderSucursales() {
  try {
      var sucursalesSnapshot = await db.collection('sucursales').get();
      var newOrderSucursalSelect = document.getElementById('newOrderSucursalSelect');
      newOrderSucursalSelect.innerHTML = '';

      sucursalesSnapshot.forEach(function(doc) {
          var sucursal = doc.data();
          var option = document.createElement('option');
          option.value = doc.id;
          option.textContent = sucursal.name;
          newOrderSucursalSelect.appendChild(option);
      });
  } catch (error) {
      console.error('Error al cargar sucursales del pedido:', error);
      alert('Error al cargar sucursales del pedido: ' + error.message);
  }
}

async function loadNewOrderProducts() {
  try {
      var providerId = document.getElementById('newOrderProviderSelect').value;
      var productsSnapshot = await db.collection('products').where('providerId', '==', providerId).get();
      var productSelectionTableBody = document.getElementById('productSelectionTable').getElementsByTagName('tbody')[0];
      productSelectionTableBody.innerHTML = '';

      productsSnapshot.forEach(function(doc) {
          var product = doc.data();
          var row = productSelectionTableBody.insertRow();
          var cell1 = row.insertCell(0);
          var cell2 = row.insertCell(1);
          var cell3 = row.insertCell(2);
          cell1.textContent = product.name;
          cell2.textContent = product.presentation;
          cell3.innerHTML = `<button onclick="selectProductForOrder('${doc.id}', '${product.name}', '${product.presentation}')">Seleccionar</button>`;
      });
  } catch (error) {
      console.error('Error al cargar productos para el pedido:', error);
      alert('Error al cargar productos para el pedido: ' + error.message);
  }
}

function filterProducts() {
  var input = document.getElementById('productSearch');
  var filter = input.value.toLowerCase();
  var table = document.getElementById('productSelectionTable');
  var tr = table.getElementsByTagName('tr');

  for (var i = 2; i < tr.length; i++) {
      var td = tr[i].getElementsByTagName('td')[0];
      if (td) {
          var txtValue = td.textContent || td.innerText;
          if (txtValue.toLowerCase().indexOf(filter) > -1) {
              tr[i].style.display = '';
          } else {
              tr[i].style.display = 'none';
          }
      }
  }
}

function selectProductForOrder(productId, productName, productPresentation) {
  document.getElementById('productSelectionModal').dataset.selectedProductId = productId;
  document.getElementById('productSelectionModal').dataset.selectedProductName = productName;
  document.getElementById('productSelectionModal').dataset.selectedProductPresentation = productPresentation;
  acceptProductSelection(); // Cierra la ventana y carga el producto seleccionado automáticamente
}

function acceptProductSelection() {
  var productId = document.getElementById('productSelectionModal').dataset.selectedProductId;
  var productName = document.getElementById('productSelectionModal').dataset.selectedProductName;
  var productPresentation = document.getElementById('productSelectionModal').dataset.selectedProductPresentation;

  if (productId && productName && productPresentation) {
      document.getElementById('productNameSelected').value = productName;
      document.getElementById('productPresentationSelected').value = productPresentation;
      closeProductSelectionModal();
  } else {
      alert('Debe seleccionar un producto.');
  }
}

function addProductToNewOrder() {
  var productId = document.getElementById('productSelectionModal').dataset.selectedProductId;
  var productName = document.getElementById('productNameSelected').value;
  var productPresentation = document.getElementById('productPresentationSelected').value;
  var quantity = document.getElementById('productQuantity').value;
  var stock = document.getElementById('productStock').value;

  if (productId && productName && productPresentation && quantity && stock) {
      var newOrderTableBody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
      var row = newOrderTableBody.insertRow();
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      var cell3 = row.insertCell(2);
      var cell4 = row.insertCell(3);
      var cell5 = row.insertCell(4);
      cell1.textContent = productName;
      cell2.textContent = productPresentation;
      cell3.textContent = quantity;
      cell4.textContent = stock;
      cell5.innerHTML = `<button onclick="editNewOrderProduct(this)">Editar</button>
                         <button onclick="deleteNewOrderProduct(this)">Eliminar</button>`;
      document.getElementById('productNameSelected').value = '';
      document.getElementById('productPresentationSelected').value = '';
      document.getElementById('productQuantity').value = '';
      document.getElementById('productStock').value = '';
      document.getElementById('productSelectionModal').dataset.selectedProductId = '';

      // Bloquear el selector de proveedor después de agregar un producto
      document.getElementById('newOrderProviderSelect').disabled = true;
  } else {
      alert('Debe ingresar la cantidad de pedido y el stock actual.');
  }
}

function editNewOrderProduct(button) {
  var row = button.parentNode.parentNode;
  var cells = row.getElementsByTagName('td');
  var newQuantity = prompt('Nueva cantidad:', cells[2].textContent);
  var newStock = prompt('Nuevo stock:', cells[3].textContent);
  if (newQuantity && newStock) {
      cells[2].textContent = newQuantity;
      cells[3].textContent = newStock;
  }
}

function deleteNewOrderProduct(button) {
  var row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);

  // Verificar si aún hay productos en la tabla, si no, desbloquear el selector de proveedor
  var newOrderTableBody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  if (newOrderTableBody.rows.length === 0) {
      document.getElementById('newOrderProviderSelect').disabled = false;
  }
}

async function saveNewOrder() {
  var providerId = document.getElementById('newOrderProviderSelect').value;
  var providerName = document.getElementById('newOrderProviderSelect').options[document.getElementById('newOrderProviderSelect').selectedIndex].text;
  var sucursalId = document.getElementById('newOrderSucursalSelect').value;
  var sucursalName = document.getElementById('newOrderSucursalSelect').options[document.getElementById('newOrderSucursalSelect').selectedIndex].text;
  var orderDate = document.getElementById('orderDate').value;
  var orderId = document.getElementById('orderId').value;
  var newOrderTableBody = document.getElementById('newOrderTable').getElementsByTagName('tbody')[0];
  var rows = newOrderTableBody.getElementsByTagName('tr');
  var products = [];

  for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].getElementsByTagName('td');
      var product = {
          name: cells[0].textContent,
          presentation: cells[1].textContent,
          quantity: cells[2].textContent,
          stock: cells[3].textContent
      };
      products.push(product);
  }

  if (products.length > 0) {
      try {
          await db.collection('orders').add({
              providerId: providerId,
              providerName: providerName,
              sucursalId: sucursalId,
              sucursalName: sucursalName,
              orderDate: orderDate,
              orderId: orderId,
              products: products,
              status: 'pending',
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          alert('Pedido guardado exitosamente');
          closeOrderCreationContainer();
          if (document.getElementById('pendingOrdersAdminCards')) {
              loadPendingOrdersAdmin();
          }
      } catch (error) {
          console.error('Error al guardar el pedido:', error);
          alert('Error al guardar el pedido: ' + error.message);
      }
  } else {
      alert('No hay productos en el pedido');
  }
}

function setOrderDateToToday() {
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('orderDate').value = today;
}

function showOrders() {
  document.getElementById('ordersContainer').style.display = 'block';
  document.getElementById('orderCreationContainer').style.display = 'none';
  loadProviders();
}

function closeOrderCreationContainer() {
  // Oculta el contenedor de creación de pedidos
  document.getElementById('orderCreationContainer').style.display = 'none';
  // Muestra nuevamente el contenedor de pedidos
  document.getElementById('ordersContainer').style.display = 'block';
}
