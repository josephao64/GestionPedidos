// pedidosPguardadosApp.js

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
  
  // Evento que se dispara cuando el DOM está cargado
  document.addEventListener('DOMContentLoaded', loadSavedOrders);
  
  /**
   * Función para cargar los pedidos preguardados y mostrarlos en la tabla
   */
  async function loadSavedOrders() {
    try {
      const ordersSnapshot = await db.collection('orders').where('status', '==', 'preguardado').get();
      const tableBody = document.getElementById('savedOrdersTable').getElementsByTagName('tbody')[0];
      tableBody.innerHTML = ''; // Limpia la tabla antes de llenarla
  
      if (ordersSnapshot.empty) {
        const row = tableBody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 5;
        cell.textContent = 'No hay pedidos pre-guardados.';
        cell.style.textAlign = 'center';
        return;
      }
  
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        const row = tableBody.insertRow();
  
        const cell1 = row.insertCell(0); // ID Pedido
        const cell2 = row.insertCell(1); // Proveedor
        const cell3 = row.insertCell(2); // Sucursal
        const cell4 = row.insertCell(3); // Fecha
        const cell5 = row.insertCell(4); // Acciones
  
        cell1.textContent = order.orderId || 'Sin ID';
        cell2.textContent = order.providerName || 'Sin Proveedor';
        cell3.textContent = order.sucursalName || 'Sin Sucursal';
        cell4.textContent = order.orderDate || 'Sin Fecha';
  
        // Botones de acciones
        cell5.innerHTML = `
          <button onclick="viewOrder('${doc.id}')">Ver</button>
          <button onclick="deleteOrder('${doc.id}')">Eliminar</button>
        `;
      });
  
    } catch (error) {
      console.error('Error al cargar pedidos preguardados:', error);
      Swal.fire('Error', 'No se pudieron cargar los pedidos preguardados.', 'error');
    }
  }
  
  /**
   * Función para ver un pedido (redirige a editarPedido.html con el ID del documento en la URL)
   * @param {string} docId - ID del documento en Firestore
   */
  function viewOrder(docId) {
    window.location.href = `editarPedido.html?orderId=${docId}`;
  }
  
  /**
   * Función para eliminar un pedido preguardado
   * @param {string} docId - ID del documento en Firestore
   */
  async function deleteOrder(docId) {
    const confirmation = await Swal.fire({
      title: '¿Eliminar Pedido?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
  
    if (confirmation.isConfirmed) {
      try {
        await db.collection('orders').doc(docId).delete();
        Swal.fire('Eliminado', 'El pedido ha sido eliminado.', 'success');
        loadSavedOrders(); // Recargar la lista después de eliminar
      } catch (error) {
        console.error('Error al eliminar pedido:', error);
        Swal.fire('Error', 'No se pudo eliminar el pedido.', 'error');
      }
    }
  }
  