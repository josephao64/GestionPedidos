// realizar_pedidos/detallePedidoApp.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');

    if (orderId) {
        loadOrderDetails(orderId);
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se ha proporcionado un ID de pedido.'
        }).then(() => {
            window.history.back();
        });
    }
});

/**
 * Función para cargar los detalles de un pedido específico
 */
async function loadOrderDetails(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (orderDoc.exists) {
            const order = orderDoc.data();
            const orderDetailsDiv = document.getElementById('orderDetails');
            orderDetailsDiv.innerHTML = `
                <p><strong>ID Pedido:</strong> ${escapeHtml(order.orderId)}</p>
                <p><strong>Proveedor:</strong> ${escapeHtml(order.providerName)}</p>
                <p><strong>Sucursal:</strong> ${escapeHtml(order.sucursalName)}</p>
                <p><strong>Fecha de Pedido:</strong> ${escapeHtml(order.orderDate)}</p>
                <p><strong>Estado:</strong> ${escapeHtml(order.status)}</p>
                <h3>Productos:</h3>
                <table border="1" style="width:100%; text-align:left;">
                    <tr>
                        <th>Producto</th>
                        <th>Presentación</th>
                        <th>Cantidad</th>
                        <th>Stock</th>
                    </tr>
                    ${order.products.map(product => `
                        <tr>
                            <td>${escapeHtml(product.name)}</td>
                            <td>${escapeHtml(product.presentation)}</td>
                            <td>${product.quantity}</td>
                            <td>${product.stock}</td>
                        </tr>
                    `).join('')}
                </table>
            `;
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se encontró el pedido.'
            }).then(() => {
                window.history.back();
            });
        }
    } catch (error) {
        console.error('Error al cargar los detalles del pedido:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar los detalles del pedido: ' + error.message
        });
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
