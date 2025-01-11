// editarPedidoApp.js

// Configuración de Firebase con tus credenciales
const firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com",
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };
  
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
  // Importar jsPDF (ya incluido en el HTML)
  const { jsPDF } = window.jspdf;
  
  // Evento que se dispara cuando el DOM está cargado
  document.addEventListener('DOMContentLoaded', loadOrder);
  
  /**
   * Función para cargar los datos del pedido
   */
  async function loadOrder() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderDocId = urlParams.get('orderId'); // ID del documento en Firestore
  
    if (!orderDocId) {
      Swal.fire('Error', 'No se proporcionó un ID de pedido válido.', 'error').then(() => {
        window.location.href = 'pedidosPguardados.html';
      });
      return;
    }
  
    try {
      const docRef = db.collection('orders').doc(orderDocId);
      const doc = await docRef.get();
  
      if (!doc.exists) {
        Swal.fire('Error', 'El pedido no existe.', 'error').then(() => {
          window.location.href = 'pedidosPguardados.html';
        });
        return;
      }
  
      const orderData = doc.data();
      document.getElementById('editOrderId').value = orderData.orderId || '';
      document.getElementById('editOrderDate').value = orderData.orderDate || '';
      fillProductsTable(orderData.products || []);
  
      // Llenar los selects de proveedor y sucursal
      await loadProviders();
  
      if (orderData.providerId) {
        document.getElementById('editOrderProviderSelect').value = orderData.providerId;
        await loadProductsFromProvider();
      }
  
      if (orderData.sucursalId) {
        document.getElementById('editOrderSucursalSelect').value = orderData.sucursalId;
      }
  
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      Swal.fire('Error', `No se pudo cargar el pedido: ${error.message}`, 'error').then(() => {
        window.location.href = 'pedidosPguardados.html';
      });
    }
  }
  
  /**
   * Función para llenar la tabla de productos
   * @param {Array} products - Lista de productos del pedido
   */
  function fillProductsTable(products) {
    const tableBody = document.getElementById('editOrderTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
  
    products.forEach(product => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.presentation)}</td>
        <td>${escapeHtml(product.quantity)}</td>
        <td>${escapeHtml(product.stock)}</td>
        <td>
          <button onclick="editProductRow(this)">Editar</button>
          <button onclick="deleteProductRow(this)">Eliminar</button>
        </td>
      `;
    });
  }
  
  /**
   * Función para cargar los proveedores y sucursales
   */
  async function loadProviders() {
    const providerSelect = document.getElementById('editOrderProviderSelect');
    const sucursalSelect = document.getElementById('editOrderSucursalSelect');
  
    providerSelect.innerHTML = '<option value="" disabled selected>-- Selecciona un Proveedor --</option>';
    sucursalSelect.innerHTML = '<option value="" disabled selected>-- Selecciona una Sucursal --</option>';
  
    try {
      const providersSnapshot = await db.collection('providers').get();
      providersSnapshot.forEach(doc => {
        const provider = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = provider.name;
        providerSelect.appendChild(option);
      });
  
      const sucursalesSnapshot = await db.collection('sucursales').get();
      sucursalesSnapshot.forEach(doc => {
        const sucursal = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = sucursal.name;
        sucursalSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error al cargar proveedores y sucursales:', error);
      Swal.fire('Error', 'No se pudieron cargar proveedores y sucursales.', 'error');
    }
  }
  
  /**
   * Función para mostrar el modal de selección de productos
   */
  function showProductSelectionModal() {
    loadProductsFromProvider();
    document.getElementById('productSelectionModal').style.display = 'block';
  }
  
  /**
   * Función para cerrar el modal de selección de productos
   */
  function closeProductSelectionModal() {
    document.getElementById('productSelectionModal').style.display = 'none';
  }
  
  /**
   * Función para cargar productos del proveedor seleccionado
   */
  async function loadProductsFromProvider() {
    const providerId = document.getElementById('editOrderProviderSelect').value;
    if (!providerId) {
      Swal.fire('Advertencia', 'Selecciona un proveedor primero.', 'warning');
      return;
    }
  
    try {
      const productsSnapshot = await db.collection('products').where('providerId', '==', providerId).get();
      const tableBody = document.getElementById('productSelectionTable').getElementsByTagName('tbody')[0];
      tableBody.innerHTML = '';
  
      if (productsSnapshot.empty) {
        const row = tableBody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 3;
        cell.textContent = 'No hay productos disponibles para este proveedor.';
        cell.style.textAlign = 'center';
        return;
      }
  
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        const row = tableBody.insertRow();
        row.innerHTML = `
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.presentation)}</td>
          <td>
            <button onclick="selectProductForOrder('${escapeHtml(product.name)}', '${escapeHtml(product.presentation)}')">Seleccionar</button>
          </td>
        `;
      });
  
    } catch (error) {
      console.error('Error al cargar productos:', error);
      Swal.fire('Error', 'No se pudieron cargar los productos.', 'error');
    }
  }
  
  /**
   * Función para seleccionar un producto del modal
   * @param {string} name - Nombre del producto
   * @param {string} presentation - Presentación del producto
   */
  function selectProductForOrder(name, presentation) {
    document.getElementById('productNameSelected').value = name;
    document.getElementById('productPresentationSelected').value = presentation;
    closeProductSelectionModal();
  }
  
  /**
   * Función para agregar un producto a la tabla de edición
   */
  function addProductToOrder() {
    const name = document.getElementById('productNameSelected').value.trim();
    const presentation = document.getElementById('productPresentationSelected').value.trim();
    const quantity = document.getElementById('productQuantity').value.trim();
    const stockNA = document.getElementById('stockNA').checked;
    const stockValue = document.getElementById('productStock').value.trim();
  
    if (!name || !presentation || !quantity || (!stockNA && !stockValue)) {
      Swal.fire('Advertencia', 'Completa todos los campos del producto.', 'warning');
      return;
    }
  
    // Validaciones
    if (isNaN(quantity) || Number(quantity) <= 0) {
      Swal.fire('Advertencia', 'La cantidad debe ser un número positivo.', 'warning');
      return;
    }
  
    if (!stockNA) {
      if (isNaN(stockValue) || Number(stockValue) < 0) {
        Swal.fire('Advertencia', 'El stock debe ser un número igual o mayor a 0.', 'warning');
        return;
      }
    }
  
    const tableBody = document.getElementById('editOrderTable').getElementsByTagName('tbody')[0];
    
    // Verificar si el producto ya existe en la tabla
    const existingRows = tableBody.getElementsByTagName('tr');
    for (let i = 0; i < existingRows.length; i++) {
      const cells = existingRows[i].getElementsByTagName('td');
      if (cells[0].textContent === name && cells[1].textContent === presentation) {
        Swal.fire('Advertencia', 'Este producto ya está agregado al pedido.', 'warning');
        return;
      }
    }
  
    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(presentation)}</td>
      <td>${escapeHtml(quantity)}</td>
      <td>${stockNA ? 'N/A' : escapeHtml(stockValue)}</td>
      <td>
        <button onclick="editProductRow(this)">Editar</button>
        <button onclick="deleteProductRow(this)">Eliminar</button>
      </td>
    `;
  
    // Limpiar campos de producto
    document.getElementById('productNameSelected').value = '';
    document.getElementById('productPresentationSelected').value = '';
    document.getElementById('productQuantity').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('stockNA').checked = false;
    document.getElementById('productStock').disabled = false;
  }
  
  /**
   * Función para editar una fila de la tabla
   * @param {HTMLElement} button - Botón que dispara la función
   */
  function editProductRow(button) {
    const row = button.parentNode.parentNode;
    const cells = row.getElementsByTagName('td');
  
    // Editar Cantidad
    const newQuantity = prompt('Nueva cantidad:', cells[2].textContent);
    if (newQuantity === null) return;
    if (isNaN(newQuantity) || Number(newQuantity) <= 0) {
      Swal.fire('Advertencia', 'La cantidad debe ser un número positivo.', 'warning');
      return;
    }
    cells[2].textContent = newQuantity;
  
    // Editar Stock
    let newStock = prompt('Nuevo stock (o "N/A"):', cells[3].textContent);
    if (newStock === null) return;
    if (newStock.toUpperCase() === 'N/A') {
      cells[3].textContent = 'N/A';
    } else if (!isNaN(newStock) && Number(newStock) >= 0) {
      cells[3].textContent = newStock;
    } else {
      Swal.fire('Advertencia', 'Stock inválido.', 'warning');
    }
  }
  
  /**
   * Función para eliminar una fila de la tabla
   * @param {HTMLElement} button - Botón que dispara la función
   */
  function deleteProductRow(button) {
    const row = button.parentNode.parentNode;
    const productName = row.getElementsByTagName('td')[0].textContent;
    Swal.fire({
      title: '¿Eliminar Producto?',
      text: `¿Estás seguro de que deseas eliminar "${productName}" del pedido?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        row.parentNode.removeChild(row);
        Swal.fire('Eliminado', 'El producto ha sido eliminado del pedido.', 'success');
      }
    });
  }
  
  /**
   * Función para manejar la acción de guardar cambios
   * Muestra una ventana con opciones: Cancelar, Preguardar, Guardar Pedido
   */
  async function handleSaveChanges() {
    const { isConfirmed, isDenied } = await Swal.fire({
      title: 'Guardar Cambios',
      text: '¿Qué deseas hacer con el pedido?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Guardar Pedido',
      denyButtonText: 'Preguardar',
      cancelButtonText: 'Cancelar'
    });
  
    if (isDenied) {
      // Preguardar
      await preguardarPedido();
    } else if (isConfirmed) {
      // Guardar Pedido
      await guardarPedido();
    }
    // Si se cancela, no hacer nada
  }
  
  /**
   * Función para preguardar el pedido (guardar con estado 'preguardado')
   */
  async function preguardarPedido() {
    const orderDocId = getOrderDocIdFromURL();
    const providerId = document.getElementById('editOrderProviderSelect').value;
    const sucursalId = document.getElementById('editOrderSucursalSelect').value;
    const orderDate = document.getElementById('editOrderDate').value;
  
    if (!providerId || !sucursalId || !orderDate) {
      Swal.fire('Advertencia', 'Completa todos los campos del pedido.', 'warning');
      return;
    }
  
    const products = [];
    const tableRows = document.getElementById('editOrderTable').getElementsByTagName('tr');
  
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i].getElementsByTagName('td');
      if (cells.length < 5) continue; // Salta filas incompletas
  
      const name = cells[0].textContent;
      const presentation = cells[1].textContent;
      const quantity = cells[2].textContent;
      const stock = cells[3].textContent;
  
      products.push({ name, presentation, quantity, stock });
    }
  
    if (products.length === 0) {
      Swal.fire('Advertencia', 'Añade al menos un producto al pedido.', 'warning');
      return;
    }
  
    try {
      // Actualizar el documento en Firestore con estado 'preguardado'
      await db.collection('orders').doc(orderDocId).update({
        providerId,
        sucursalId,
        orderDate,
        products,
        status: 'preguardado'
      });
  
      Swal.fire('Preguardado', 'El pedido ha sido preguardado exitosamente.', 'info');
  
    } catch (error) {
      console.error('Error al preguardar pedido:', error);
      Swal.fire('Error', `No se pudo preguardar el pedido: ${error.message}`, 'error');
    }
  }
  
  /**
   * Función para guardar el pedido (guardar con estado 'guardado') y exportarlo
   */
  async function guardarPedido() {
    const orderDocId = getOrderDocIdFromURL();
    const providerId = document.getElementById('editOrderProviderSelect').value;
    const sucursalId = document.getElementById('editOrderSucursalSelect').value;
    const orderDate = document.getElementById('editOrderDate').value;
  
    if (!providerId || !sucursalId || !orderDate) {
      Swal.fire('Advertencia', 'Completa todos los campos del pedido.', 'warning');
      return;
    }
  
    const products = [];
    const tableRows = document.getElementById('editOrderTable').getElementsByTagName('tr');
  
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i].getElementsByTagName('td');
      if (cells.length < 5) continue; // Salta filas incompletas
  
      const name = cells[0].textContent;
      const presentation = cells[1].textContent;
      const quantity = cells[2].textContent;
      const stock = cells[3].textContent;
  
      products.push({ name, presentation, quantity, stock });
    }
  
    if (products.length === 0) {
      Swal.fire('Advertencia', 'Añade al menos un producto al pedido.', 'warning');
      return;
    }
  
    try {
      // Actualizar el documento en Firestore con estado 'guardado'
      await db.collection('orders').doc(orderDocId).update({
        providerId,
        sucursalId,
        orderDate,
        products,
        status: 'guardado'
      });
  
      // Mostrar opciones de exportación
      const exportResult = await Swal.fire({
        title: 'Pedido Guardado',
        text: '¿Deseas exportar el pedido ahora?',
        icon: 'success',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Exportar como Imagen',
        denyButtonText: 'Exportar como PDF',
        cancelButtonText: 'Cerrar'
      });
  
      if (exportResult.isConfirmed) {
        // Obtener los detalles del pedido para el ticket
        const orderDetails = await getOrderDetails(orderDocId);
        generateTicketImage(orderDetails);
      } else if (exportResult.isDenied) {
        exportOrderAsPDF(orderDocId);
      }
  
      // Redirigir a la lista de pedidos preguardados después de un breve retraso
      setTimeout(() => {
        window.location.href = 'pedidosPguardados.html';
      }, 1000);
  
    } catch (error) {
      console.error('Error al guardar pedido:', error);
      Swal.fire('Error', `No se pudo guardar el pedido: ${error.message}`, 'error');
    }
  }
  
  /**
   * Función para exportar el pedido como imagen usando el nuevo ticket
   * @param {Object} orderDetails - Detalles del pedido
   */
  function generateTicketImage(orderDetails) {
      // Llenar los campos del ticket con los detalles del pedido
      document.getElementById('ticketOrderId').textContent = orderDetails.orderId;
      document.getElementById('ticketOrderDate').textContent = orderDetails.orderDate;
      document.getElementById('ticketSucursalName').textContent = orderDetails.sucursalName;
      document.getElementById('ticketProviderName').textContent = orderDetails.providerName;
  
      // Limpiar la tabla de productos
      const ticketProductsTableBody = document.getElementById('ticketProductsTableBody');
      ticketProductsTableBody.innerHTML = '';
  
      // Insertar cada producto en la tabla
      orderDetails.products.forEach(product => {
          const row = document.createElement('tr');
  
          const cellName = document.createElement('td');
          cellName.textContent = product.name;
          row.appendChild(cellName);
  
          const cellPresentation = document.createElement('td');
          cellPresentation.textContent = product.presentation;
          row.appendChild(cellPresentation);
  
          const cellQuantity = document.createElement('td');
          cellQuantity.textContent = product.quantity;
          row.appendChild(cellQuantity);
  
          const cellStock = document.createElement('td');
          cellStock.textContent = product.stock;
          row.appendChild(cellStock);
  
          ticketProductsTableBody.appendChild(row);
      });
  
      // Mostrar el contenedor del ticket
      const ticketContainer = document.getElementById('ticketContainer');
      ticketContainer.style.display = 'block';
  
      // Utilizar html2canvas para capturar el ticket y descargarlo como imagen
      html2canvas(ticketContainer, { scale: 2 })
          .then(canvas => {
              canvas.toBlob((blob) => {
                  if (blob) {
                      const imgURL = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = imgURL;
                      link.download = `Pedido_${orderDetails.orderId}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
  
                      Swal.fire({
                          icon: 'success',
                          title: 'Imagen Exportada',
                          text: 'El ticket ha sido exportado como imagen exitosamente.'
                      });
                  } else {
                      Swal.fire({
                          icon: 'error',
                          title: 'Error',
                          text: 'Error al generar la imagen del ticket.'
                      });
                  }
              }, 'image/jpeg', 0.95);
          })
          .catch(error => {
              console.error('Error al generar la imagen del ticket:', error);
              Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: 'Error al generar la imagen del ticket.'
              });
          })
          .finally(() => {
              // Ocultar el contenedor del ticket después de la captura
              ticketContainer.style.display = 'none';
          });
  }
  
  /**
   * Función para exportar el pedido como PDF
   * @param {string} orderDocId - ID del documento del pedido
   */
  function exportOrderAsPDF(orderDocId) {
    const doc = new jsPDF();
  
    const orderDetailsElement = document.getElementById('ticketContainer');
    
    // Obtener detalles del pedido desde los campos actuales
    const orderId = document.getElementById('editOrderId').value;
    const providerId = document.getElementById('editOrderProviderSelect').value;
    const sucursalId = document.getElementById('editOrderSucursalSelect').value;
    const orderDate = document.getElementById('editOrderDate').value;
  
    // Obtener los nombres de proveedor y sucursal seleccionados
    const providerName = document.querySelector('#editOrderProviderSelect option:checked').textContent;
    const sucursalName = document.querySelector('#editOrderSucursalSelect option:checked').textContent;
  
    // Obtener los productos de la tabla
    const products = [];
    const tableRows = document.getElementById('editOrderTable').getElementsByTagName('tr');
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i].getElementsByTagName('td');
      if (cells.length < 5) continue; // Salta filas incompletas
      const product = {
        name: cells[0].textContent,
        presentation: cells[1].textContent,
        quantity: cells[2].textContent,
        stock: cells[3].textContent
      };
      products.push(product);
    }
  
    // Población del contenedor oculto con los detalles del pedido
    populateTicketContainer({
      orderId,
      providerName,
      sucursalName,
      orderDate,
      products
    });
  
    // Mostrar el contenedor oculto temporalmente
    orderDetailsElement.style.display = 'block';
  
    // Utilizar html2canvas para capturar el ticket y generar la imagen
    html2canvas(orderDetailsElement, { scale: 2 })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // Tamaño A4 en mm
        const pageHeight = 297;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
  
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
  
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
  
        doc.save(`Pedido_${orderId}.pdf`);
      })
      .catch(error => {
        console.error('Error al exportar como PDF:', error);
        Swal.fire('Error', 'No se pudo exportar el pedido como PDF.', 'error');
      })
      .finally(() => {
        // Ocultar nuevamente el contenedor oculto
        orderDetailsElement.style.display = 'none';
      });
  }
  
  /**
   * Función para obtener el ID del documento desde la URL
   * @returns {string} - ID del documento
   */
  function getOrderDocIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('orderId');
  }
  
  /**
   * Función para escapar caracteres HTML y evitar inyecciones
   * @param {string} text - Texto a escapar
   * @returns {string} - Texto escapado
   */
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
  
  /**
   * Función para poblar el contenedor oculto con los detalles del pedido para el ticket
   * @param {Object} orderDetails - Detalles del pedido
   */
  function populateTicketContainer(orderDetails) {
    document.getElementById('ticketOrderId').textContent = orderDetails.orderId;
    document.getElementById('ticketOrderDate').textContent = orderDetails.orderDate;
    document.getElementById('ticketSucursalName').textContent = orderDetails.sucursalName;
    document.getElementById('ticketProviderName').textContent = orderDetails.providerName;
  
    const ticketProductsTableBody = document.getElementById('ticketProductsTableBody');
    ticketProductsTableBody.innerHTML = ''; // Limpiar contenido previo
  
    orderDetails.products.forEach(product => {
      const row = document.createElement('tr');
  
      const cellName = document.createElement('td');
      cellName.textContent = product.name;
      row.appendChild(cellName);
  
      const cellPresentation = document.createElement('td');
      cellPresentation.textContent = product.presentation;
      row.appendChild(cellPresentation);
  
      const cellQuantity = document.createElement('td');
      cellQuantity.textContent = product.quantity;
      row.appendChild(cellQuantity);
  
      const cellStock = document.createElement('td');
      cellStock.textContent = product.stock;
      row.appendChild(cellStock);
  
      ticketProductsTableBody.appendChild(row);
    });
  }
  