// Importar jsPDF desde el objeto global proporcionado por la biblioteca jsPDF   
const { jsPDF } = window.jspdf;

/**
 * ================================
 * Variables globales
 * ================================
 */
let db;                  // Firestore DB a nivel global
let userSucursalId = null;     // ID de la sucursal a la que pertenece el usuario
let userSucursalName = null;   // Nombre de la sucursal (para mostrar)
let userRole = null;           // Rol del usuario (administrador / usuario)

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

  // Manejo del checkbox 'N/A' para stock (asumiendo que existe en tu HTML)
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

  // Mostrar el formulario de creación de pedido automáticamente
  showOrderCreationContainer();

  // Añadir manejador de evento al botón de regreso
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', handleBackButton);
  }
});

/**
 * ================================
 * Función: obtenerSucursalDelUsuario
 * ================================
 * Obtiene el rol y la sucursal del usuario que ha iniciado sesión
 * y asigna valores a las variables globales userSucursalId, userSucursalName y userRole.
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
      window.location.href = '../login.html'; // Asegúrate de que esta ruta sea correcta
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
    } else {
      // Usuario no encontrado en la colección 'usuarios'
      Swal.fire({
        icon: 'error',
        title: 'Usuario No Encontrado',
        text: 'No se encontró información del usuario. Por favor, inicia sesión nuevamente.'
      }).then(() => {
        window.location.href = '../login.html'; // Asegúrate de que esta ruta sea correcta
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
 * Función para mostrar el contenedor
 * de creación de nuevo pedido
 * ================================
 */
async function showOrderCreationContainer() {
  // Mostrar contenedor de creación
  document.getElementById('orderCreationContainer').style.display = 'block';

  // Verificar rol para definir la sucursal
  if (userRole === 'administrador') {
    // Cargar todas las sucursales en el select
    cargarSucursalesSelectParaAdmin();
    document.getElementById('newOrderSucursalSelect').disabled = false;
  } else {
    // Usuario normal: asignar su sucursal en un option y bloquear el select
    const selectSucursal = document.getElementById('newOrderSucursalSelect');
    selectSucursal.innerHTML = ''; // Limpia

    const option = document.createElement('option');
    option.value = userSucursalId;
    option.textContent = userSucursalName;
    selectSucursal.appendChild(option);

    selectSucursal.disabled = true;
  }

  // Cargar proveedores
  loadNewOrderProviders();

  // Colocar fecha de hoy
  setOrderDateToToday();

  // Generar nuevo ID de pedido
  generateOrderId();
}

/**
 * Cargar sucursales para admin
 */
async function cargarSucursalesSelectParaAdmin() {
  try {
    const sucursalesSnapshot = await db.collection('sucursales').get();
    const orderSucursalSelect = document.getElementById('newOrderSucursalSelect');
    orderSucursalSelect.innerHTML = '<option value="" disabled selected>-- Selecciona una Sucursal --</option>';

    sucursalesSnapshot.forEach((doc) => {
      const sucursal = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = sucursal.name;
      orderSucursalSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar sucursales para admin:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al cargar sucursales para administrador: ' + error.message
    });
  }
}

/**
 * ================================
 * Funciones para generar ID pedido
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

  for (let i = 2; i < tr.length; i++) { // Asumiendo que la primera fila es de encabezados
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
 * Guardar el nuevo pedido
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

  // Mostrar SweetAlert con opciones: Cancelar, Preguardar, Salir sin guardar, Guardar Pedido
  Swal.fire({
    title: 'Confirmar acción',
    text: '¿Qué deseas hacer con el pedido?',
    icon: 'question',
    html: `
      <div style="display: flex; justify-content: space-around; flex-direction: column; gap: 10px; margin-top: 20px;">
        <button id="cancelarBtn" class="swal2-styled" style="background-color: #d33; width: 100%;">Cancelar</button>
        <button id="preguardarBtn" class="swal2-styled" style="background-color: #f0ad4e; width: 100%;">Preguardar</button>
        <button id="guardarPedidoBtn" class="swal2-styled" style="background-color: #5bc0de; width: 100%;">Guardar Pedido</button>
        <button id="salirBtn" class="swal2-styled" style="background-color: #5cb85c; width: 100%;">Salir sin guardar</button>
      </div>
    `,
    showConfirmButton: false,
    allowOutsideClick: false,
    focusConfirm: false,
    didOpen: () => {
      // Obtener referencias a los botones
      const cancelarBtn = Swal.getPopup().querySelector('#cancelarBtn');
      const preguardarBtn = Swal.getPopup().querySelector('#preguardarBtn');
      const guardarPedidoBtn = Swal.getPopup().querySelector('#guardarPedidoBtn');
      const salirBtn = Swal.getPopup().querySelector('#salirBtn');

      // Cancelar: Cierra el modal y permite continuar en la página
      cancelarBtn.addEventListener('click', () => {
        Swal.close();
      });

      // Preguardar: Guarda el pedido como borrador y cierra el modal
      preguardarBtn.addEventListener('click', async () => {
        Swal.showLoading();
        await preguardarPedido({
          providerId,
          providerName,
          sucursalId,
          sucursalName,
          orderDate,
          orderId,
          products,
          status: 'preguardado'
        });
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: 'Pedido Preguardado',
          text: 'El pedido ha sido guardado como preguardado.'
        });
        // Resetear formulario para permitir agregar nuevos pedidos
        closeOrderCreationContainer();
      });

      // Guardar Pedido: Guarda el pedido y muestra opciones para exportar
      guardarPedidoBtn.addEventListener('click', async () => {
        Swal.showLoading();
        await guardarPedido({
          providerId,
          providerName,
          sucursalId,
          sucursalName,
          orderDate,
          orderId,
          products,
          status: 'guardado'
        });
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: 'Pedido Guardado',
          text: 'El pedido ha sido guardado exitosamente.'
        }).then(() => {
          // Opciones para exportar el pedido
          shareOrder({
            providerId,
            providerName,
            sucursalId,
            sucursalName,
            orderDate,
            orderId,
            products,
            status: 'guardado'
          });
          // Resetear formulario para permitir agregar nuevos pedidos
          closeOrderCreationContainer();
        });
      });

      // Salir sin guardar: Navega al menú principal sin guardar el pedido
      salirBtn.addEventListener('click', () => {
        window.location.href = '../index.html';
      });
    }
  });
}

/**
 * ================================
 * Función para guardar el pedido en Firestore
 * ================================
 */
async function guardarPedido(orderDetails) {
  try {
    await db.collection('orders').add({
      providerId: orderDetails.providerId,
      providerName: orderDetails.providerName,
      sucursalId: orderDetails.sucursalId,
      sucursalName: orderDetails.sucursalName,
      orderDate: orderDetails.orderDate,
      orderId: orderDetails.orderId,
      products: orderDetails.products,
      status: orderDetails.status,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error al guardar el pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al guardar el pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Función para preguardar el pedido
 * ================================
 */
async function preguardarPedido(orderDetails) {
  try {
    await db.collection('orders').add({
      providerId: orderDetails.providerId,
      providerName: orderDetails.providerName,
      sucursalId: orderDetails.sucursalId,
      sucursalName: orderDetails.sucursalName,
      orderDate: orderDetails.orderDate,
      orderId: orderDetails.orderId,
      products: orderDetails.products,
      status: orderDetails.status,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error al preguardar el pedido:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al preguardar el pedido: ' + error.message
    });
  }
}

/**
 * ================================
 * Cerrar contenedor de creación
 * ================================
 */
function closeOrderCreationContainer() {
  document.getElementById('orderCreationContainer').style.display = 'none';
  // Opcional: Mostrar un mensaje de éxito o redirigir
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
 * Función para compartir el pedido
 * ================================
 */
function shareOrder(orderDetails) {
  Swal.fire({
    title: 'Compartir Pedido',
    text: '¿Cómo deseas compartir el pedido?',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Exportar como Imagen',
    denyButtonText: `Exportar como PDF`,
    cancelButtonText: 'Cerrar',
  }).then((result) => {
    if (result.isConfirmed) {
      exportOrderAsImage(orderDetails);
    } else if (result.isDenied) {
      exportOrderAsPDF(orderDetails);
    }
    // Si se cierra o se cancela, no hacer nada
  });
}

/**
 * ================================
 * Función para manejar el clic en el botón de regreso
 * ================================
 */
function handleBackButton(event) {
  if (hasUnsavedOrder()) {
    event.preventDefault();
    Swal.fire({
      title: 'Pedido no guardado',
      text: 'Tienes un pedido en proceso que no se guardará si regresas al menú principal. ¿Qué deseas hacer?',
      icon: 'warning',
      html: `
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
          <button id="cancelarBtn" class="swal2-styled" style="background-color: #d33;">Cancelar</button>
          <button id="preguardarBtn" class="swal2-styled" style="background-color: #f0ad4e;">Preguardar</button>
          <button id="salirBtn" class="swal2-styled" style="background-color: #5cb85c;">Salir sin guardar</button>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      focusConfirm: false,
      didOpen: () => {
        // Obtener referencias a los botones
        const cancelarBtn = Swal.getPopup().querySelector('#cancelarBtn');
        const preguardarBtn = Swal.getPopup().querySelector('#preguardarBtn');
        const salirBtn = Swal.getPopup().querySelector('#salirBtn');

        // Cancelar: Cierra el modal y permite continuar en la página
        cancelarBtn.addEventListener('click', () => {
          Swal.close();
        });

        // Preguardar: Guarda el pedido como borrador y cierra el modal
        preguardarBtn.addEventListener('click', async () => {
          Swal.showLoading();
          await preguardarPedido({
            providerId: document.getElementById('newOrderProviderSelect').value,
            providerName: document.getElementById('newOrderProviderSelect').options[
              document.getElementById('newOrderProviderSelect').selectedIndex
            ]?.text || '',
            sucursalId: document.getElementById('newOrderSucursalSelect').value,
            sucursalName: document.getElementById('newOrderSucursalSelect').options[
              document.getElementById('newOrderSucursalSelect').selectedIndex
            ]?.text || '',
            orderDate: document.getElementById('orderDate').value,
            orderId: document.getElementById('orderId').value,
            products: getCurrentProducts(),
            status: 'preguardado'
          });
          Swal.close();
          Swal.fire({
            icon: 'success',
            title: 'Pedido Preguardado',
            text: 'El pedido ha sido guardado como preguardado.'
          });
          // Resetear formulario para permitir agregar nuevos pedidos
          closeOrderCreationContainer();
          // Navegar al menú principal
          window.location.href = '../index.html';
        });

        // Salir sin guardar: Navega al menú principal sin guardar el pedido
        salirBtn.addEventListener('click', () => {
          window.location.href = '../index.html';
        });
      }
    });
  } else {
    window.location.href = '../index.html';
  }
}

/**
 * ================================
 * Función para verificar si hay un pedido en proceso
 * ================================
 */
function hasUnsavedOrder() {
  // Verificar si hay productos en la tabla
  const newOrderTableBody = document
    .getElementById('newOrderTable')
    .getElementsByTagName('tbody')[0];
  return newOrderTableBody.rows.length > 0;
}

/**
 * ================================
 * Función para obtener los productos actuales del pedido
 * ================================
 */
function getCurrentProducts() {
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
  return products;
}

/**
 * ================================
 * Exportar pedido como Imagen
 * ================================
 */
// (Función ya definida anteriormente, asegurarse de mantener solo una instancia)
/* ... */

/**
 * ================================
 * Exportar pedido como PDF
 * ================================
 */
// (Función ya definida anteriormente, asegurarse de mantener solo una instancia)
/* ... */
