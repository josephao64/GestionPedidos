// realizar_pedidos/pedidosApp.js

// Asegúrate de que Firebase ya esté inicializado en app.js y que este archivo se cargue después

document.addEventListener('DOMContentLoaded', () => {
    loadSavedOrders();
});

/**
 * Función para cargar pedidos preguardados
 */
async function loadSavedOrders() {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        const ordersTableBody = document.getElementById('savedOrdersTable').getElementsByTagName('tbody')[0];
        ordersTableBody.innerHTML = '';

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const row = ordersTableBody.insertRow();
            row.innerHTML = `
                <td>${escapeHtml(order.orderId)}</td>
                <td>${escapeHtml(order.providerName)}</td>
                <td>${escapeHtml(order.sucursalName)}</td>
                <td>${escapeHtml(order.orderDate)}</td>
                <td>${escapeHtml(order.status)}</td>
                <td>
                    <button onclick="viewOrder('${doc.id}')">Ver</button>
                    <button onclick="deleteOrder('${doc.id}')">Eliminar</button>
                </td>
            `;
        });
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
 * Función para ver detalles de un pedido
 */
function viewOrder(orderId) {
    // Redirigir a una página de detalles o mostrar un modal
    window.location.href = `detallePedido.html?orderId=${orderId}`;
}

/**
 * Función para eliminar un pedido
 */
async function deleteOrder(orderId) {
    const confirmDelete = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¿Quieres eliminar este pedido?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmDelete.isConfirmed) {
        try {
            await db.collection('orders').doc(orderId).delete();
            Swal.fire(
                'Eliminado!',
                'El pedido ha sido eliminado.',
                'success'
            );
            loadSavedOrders(); // Recargar la tabla
        } catch (error) {
            console.error('Error al eliminar el pedido:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al eliminar el pedido: ' + error.message
            });
        }
    }
}

/**
 * Función para escapar HTML
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
