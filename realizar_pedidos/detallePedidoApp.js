// realizar_pedidos/detallePedidoApp.js

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar Firebase
    const firebaseConfig = {
      // Tus credenciales
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
  
    // Obtener orderId de la URL
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
  
    if (!orderId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se proporcionó un ID de pedido válido'
      }).then(() => {
        window.location.href = 'pedidosPguardados.html';
      });
      return;
    }
  
    // Consultar el pedido en Firestore
    try {
      const docRef = db.collection('orders').doc(orderId);
      const docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        Swal.fire({
          icon: 'error',
          title: 'No encontrado',
          text: 'El pedido no existe o fue eliminado'
        }).then(() => {
          window.location.href = 'pedidosPguardados.html';
        });
        return;
      }
  
      const orderData = docSnapshot.data();
      renderOrderDetails(orderData);
    } catch (error) {
      console.error('Error al obtener el detalle del pedido:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `No se pudo obtener el pedido: ${error.message}`
      }).then(() => {
        window.location.href = 'pedidosPguardados.html';
      });
    }
  });
  
  /**
   * Función para mostrar la info del pedido en la página
   */
  function renderOrderDetails(orderData) {
    const orderDetailsDiv = document.getElementById('orderDetails');
    
    const html = `
      <p><strong>ID Pedido:</strong> ${orderData.orderId || 'N/A'}</p>
      <p><strong>Proveedor:</strong> ${orderData.providerName || 'N/A'}</p>
      <p><strong>Sucursal:</strong> ${orderData.sucursalName || 'N/A'}</p>
      <p><strong>Fecha:</strong> ${orderData.orderDate || 'N/A'}</p>
      <p><strong>Estado:</strong> ${orderData.status || 'N/A'}</p>
      <h3>Productos:</h3>
      <ul>
        ${
          (orderData.products || [])
            .map(prod => 
              `<li>${prod.name} - ${prod.presentation} (Cant: ${prod.quantity}, Stock: ${prod.stock})</li>`
            )
            .join('')
        }
      </ul>
    `;
  
    orderDetailsDiv.innerHTML = html;
  }
  