document.addEventListener('DOMContentLoaded', () => {
    loadPendingOrdersAdmin();
    loadInProcessOrdersAdmin();
    loadCompletedOrdersAdmin();
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
  
function goToMainMenu() {
    window.location.href = 'INDEX.html';
}
  
async function loadPendingOrdersAdmin() {
    try {
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'pending').get();
        const pendingOrdersAdminCards = document.getElementById('pendingOrdersAdminCards');
        pendingOrdersAdminCards.innerHTML = '';
  
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const card = createOrderCard(doc.id, order, 'pending');
            pendingOrdersAdminCards.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar pedidos pendientes:', error);
        alert('Error al cargar pedidos pendientes: ' + error.message);
    }
}
  
async function loadInProcessOrdersAdmin() {
    try {
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'inProcess').get();
        const inProcessOrdersAdminCards = document.getElementById('inProcessOrdersAdminCards');
        inProcessOrdersAdminCards.innerHTML = '';
  
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const card = createOrderCard(doc.id, order, 'inProcess');
            inProcessOrdersAdminCards.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar pedidos en proceso:', error);
        alert('Error al cargar pedidos en proceso: ' + error.message);
    }
}
  
async function loadCompletedOrdersAdmin() {
    try {
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'completed').get();
        const completedOrdersAdminCards = document.getElementById('completedOrdersAdminCards');
        completedOrdersAdminCards.innerHTML = '';
  
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const card = createOrderCard(doc.id, order, 'completed');
            completedOrdersAdminCards.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar pedidos completados:', error);
        alert('Error al cargar pedidos completados: ' + error.message);
    }
}
  
function createOrderCard(orderId, order, status) {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
        <h3>Pedido ID: ${order.orderId}</h3>
        <p>Proveedor: ${order.providerName}</p>
        <p>Sucursal: ${order.sucursalName}</p>
        <p>Fecha: ${order.orderDate}</p>
        <button onclick="showOrderDetails('${orderId}')">Mostrar Pedido</button>
        ${status === 'inProcess' ? `<button onclick="confirmOrder('${orderId}')">Confirmar Pedido Recibido</button>` : ''}
        ${status === 'completed' ? `<button onclick="showReceivedOrder('${orderId}')">Mostrar Pedido Recibido</button>` : ''}
        <button onclick="editOrder('${orderId}')">Editar Pedido</button>
        <button onclick="exportOrder('${orderId}')">Exportar Pedido</button>
        <button onclick="deleteOrder('${orderId}')">Eliminar Pedido</button>
        ${status === 'pending' ? `<button onclick="changeOrderStatus('${orderId}', 'inProcess')">Marcar como en Proceso</button>` : ''}
    `;
    return card;
}

async function deleteOrder(orderId) {
    if (confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
        try {
            await db.collection('orders').doc(orderId).delete();
            alert('Pedido eliminado exitosamente');
            loadPendingOrdersAdmin();
            loadInProcessOrdersAdmin();
            loadCompletedOrdersAdmin();
        } catch (error) {
            console.error('Error al eliminar el pedido:', error);
            alert('Error al eliminar el pedido: ' + error.message);
        }
    }
}

async function changeOrderStatus(orderId, newStatus) {
    try {
        await db.collection('orders').doc(orderId).update({ status: newStatus });
        loadPendingOrdersAdmin();
        loadInProcessOrdersAdmin();
        loadCompletedOrdersAdmin();
    } catch (error) {
        console.error('Error al cambiar el estado del pedido:', error);
        alert('Error al cambiar el estado del pedido: ' + error.message);
    }
}

function showOrderDetails(orderId) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
            const order = doc.data();
            let orderDetailsHTML = `
                <p>ID Pedido: ${order.orderId}</p>
                <p>Proveedor: ${order.providerName}</p>
                <p>Sucursal: ${order.sucursalName}</p>
                <p>Fecha: ${order.orderDate}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            order.products.forEach(product => {
                orderDetailsHTML += `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.presentation}</td>
                        <td>${product.quantity}</td>
                    </tr>
                `;
            });
            orderDetailsHTML += `
                    </tbody>
                </table>
            `;
            document.getElementById('orderDetails').innerHTML = orderDetailsHTML;
            document.getElementById('orderDetailsModal').style.display = 'block';

            // Set the exportOrderId for export functionality
            document.getElementById('exportOrderId').value = orderId;
        }
    }).catch(error => {
        console.error('Error al mostrar detalles del pedido:', error);
        alert('Error al mostrar detalles del pedido: ' + error.message);
    });
}

function closeOrderDetailsModal() {
    document.getElementById('orderDetails').innerHTML = '';  // Clear the modal content
    document.getElementById('orderDetailsModal').style.display = 'none';
}

function editOrder(orderId) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
            const order = doc.data();
            let editOrderHTML = `
                <input type="hidden" id="editOrderId" value="${orderId}">
                <p>ID Pedido: ${order.orderId}</p>
                <p>Proveedor: ${order.providerName}</p>
                <p>Sucursal: ${order.sucursalName}</p>
                <p>Fecha: <input type="date" id="editOrderDate" value="${order.orderDate}"></p>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Cantidad</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="editOrderProducts">
            `;
            order.products.forEach((product, index) => {
                editOrderHTML += `
                    <tr>
                        <td><input type="text" value="${product.name}" id="editProductName${index}"></td>
                        <td><input type="text" value="${product.presentation}" id="editProductPresentation${index}"></td>
                        <td><input type="number" value="${product.quantity}" id="editProductQuantity${index}"></td>
                        <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
                    </tr>
                `;
            });
            editOrderHTML += `
                    </tbody>
                </table>
                <button onclick="addProductRow()">Agregar Producto</button>
            `;
            document.getElementById('editOrderDetails').innerHTML = editOrderHTML;
            document.getElementById('editOrderModal').style.display = 'block';
        }
    }).catch(error => {
        console.error('Error al editar pedido:', error);
        alert('Error al editar pedido: ' + error.message);
    });
}

function closeEditOrderModal() {
    document.getElementById('editOrderDetails').innerHTML = '';  // Clear the modal content
    document.getElementById('editOrderModal').style.display = 'none';
}

function addProductRow() {
    const index = document.querySelectorAll('#editOrderProducts tr').length;
    const newRow = `
        <tr>
            <td><input type="text" id="editProductName${index}"></td>
            <td><input type="text" id="editProductPresentation${index}"></td>
            <td><input type="number" id="editProductQuantity${index}"></td>
            <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
        </tr>
    `;
    document.getElementById('editOrderProducts').insertAdjacentHTML('beforeend', newRow);
}

function deleteProductRow(index) {
    document.querySelector(`#editOrderProducts tr:nth-child(${index + 1})`).remove();
}

async function saveEditedOrder() {
    const orderId = document.getElementById('editOrderId').value;
    const orderDate = document.getElementById('editOrderDate').value;
    const productRows = document.querySelectorAll('#editOrderProducts tr');
    const products = Array.from(productRows).map((row, index) => ({
        name: document.getElementById(`editProductName${index}`).value,
        presentation: document.getElementById(`editProductPresentation${index}`).value,
        quantity: document.getElementById(`editProductQuantity${index}`).value
    }));
    try {
        await db.collection('orders').doc(orderId).update({
            orderDate: orderDate,
            products: products
        });
        alert('Pedido actualizado exitosamente');
        closeEditOrderModal();
        loadPendingOrdersAdmin();
        loadInProcessOrdersAdmin();
        loadCompletedOrdersAdmin();
    } catch (error) {
        console.error('Error al guardar cambios en el pedido:', error);
        alert('Error al guardar cambios en el pedido: ' + error.message);
    }
}

function exportOrder(orderId) {
    document.getElementById('exportModal').style.display = 'block';
    document.getElementById('exportModal').dataset.orderId = orderId;
}

function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

async function exportAs(format) {
    const orderId = document.getElementById('exportModal').dataset.orderId || document.getElementById('exportOrderId').value;
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (doc.exists) {
            const order = doc.data();
            const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
            if (format === 'image') {
                exportAsImage(order, fileName);
            } else if (format === 'pdf') {
                exportAsPDF(order, fileName);
            } else if (format === 'excel') {
                exportAsExcel(order, fileName);
            }
        }
    } catch (error) {
        console.error('Error al exportar pedido:', error);
        alert('Error al exportar pedido: ' + error.message);
    }
}

function exportAsImage(order, fileName) {
    const element = document.createElement('div');
    element.innerHTML = `
        <h2>Detalles del Pedido</h2>
        <p>ID Pedido: ${order.orderId}</p>
        <p>Proveedor: ${order.providerName}</p>
        <p>Sucursal: ${order.sucursalName}</p>
        <p>Fecha: ${order.orderDate}</p>
        <table border="1" cellpadding="10" cellspacing="0">
            <thead>
                <tr style="background-color: #f2f2f2;">
                    <th style="padding: 10px;">Producto</th>
                    <th style="padding: 10px;">Presentación</th>
                    <th style="padding: 10px;">Cantidad</th>
                </tr>
            </thead>
            <tbody>
                ${order.products.map(product => `
                    <tr>
                        <td style="padding: 10px;">${product.name}</td>
                        <td style="padding: 10px;">${product.presentation}</td>
                        <td style="padding: 10px;">${product.quantity}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.body.appendChild(element);

    html2canvas(element).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `${fileName}.png`;
        link.click();
        document.body.removeChild(element);
    });

    closeExportModal();
}

function exportAsPDF(order, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Detalles del Pedido', 10, 10);

    doc.setFontSize(12);
    doc.text(`ID Pedido: ${order.orderId}`, 10, 20);
    doc.text(`Proveedor: ${order.providerName}`, 10, 30);
    doc.text(`Sucursal: ${order.sucursalName}`, 10, 40);
    doc.text(`Fecha: ${order.orderDate}`, 10, 50);

    let yOffset = 60;

    doc.autoTable({
        startY: yOffset,
        head: [['Producto', 'Presentación', 'Cantidad']],
        body: order.products.map(product => [product.name, product.presentation, product.quantity]),
        theme: 'striped',
        styles: { cellPadding: 3, fontSize: 10 },
        headStyles: { fillColor: [60, 141, 188] }
    });

    doc.save(`${fileName}.pdf`);
    closeExportModal();
}

function exportAsExcel(order, fileName) {
    const wb = XLSX.utils.book_new();
    const ws_data = [
        ['ID Pedido', order.orderId],
        ['Proveedor', order.providerName],
        ['Sucursal', order.sucursalName],
        ['Fecha', order.orderDate],
        [],
        ['Producto', 'Presentación', 'Cantidad']
    ];
    order.products.forEach(product => {
        ws_data.push([product.name, product.presentation, product.quantity]);
    });
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    closeExportModal();
}

function confirmOrder(orderId) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
            const order = doc.data();
            let confirmOrderHTML = `
                <input type="hidden" id="confirmOrderId" value="${orderId}">
                <p>ID Pedido: ${order.orderId}</p>
                <p>Proveedor: ${order.providerName}</p>
                <p>Sucursal: ${order.sucursalName}</p>
                <p>Fecha: ${order.orderDate}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Cantidad Pedido</th>
                            <th>Cantidad Recibida</th>
                            <th>Comentarios</th>
                        </tr>
                    </thead>
                    <tbody id="confirmOrderProducts">
            `;
            order.products.forEach((product, index) => {
                confirmOrderHTML += `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.presentation}</td>
                        <td>${product.quantity}</td>
                        <td><input type="number" id="receivedQuantity${index}" value="${product.quantity}"></td>
                        <td><input type="text" id="productComments${index}"></td>
                    </tr>
                `;
            });
            confirmOrderHTML += `
                    </tbody>
                </table>
            `;
            document.getElementById('confirmOrderDetails').innerHTML = confirmOrderHTML;
            document.getElementById('confirmOrderModal').style.display = 'block';
        }
    }).catch(error => {
        console.error('Error al confirmar pedido:', error);
        alert('Error al confirmar pedido: ' + error.message);
    });
}

function closeConfirmOrderModal() {
    document.getElementById('confirmOrderDetails').innerHTML = '';  // Clear the modal content
    document.getElementById('confirmOrderModal').style.display = 'none';
}

async function saveConfirmedOrder() {
    const orderId = document.getElementById('confirmOrderId').value;
    const productRows = document.querySelectorAll('#confirmOrderProducts tr');
    const products = Array.from(productRows).map((row, index) => ({
        name: row.cells[0].innerText,
        presentation: row.cells[1].innerText,
        quantity: row.cells[2].innerText,
        receivedQuantity: document.getElementById(`receivedQuantity${index}`).value,
        comments: document.getElementById(`productComments${index}`).value
    }));
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'completed',
            receivedProducts: products
        });
        alert('Recepción del pedido guardada exitosamente');
        closeConfirmOrderModal();
        loadPendingOrdersAdmin();
        loadInProcessOrdersAdmin();
        loadCompletedOrdersAdmin();
    } catch (error) {
        console.error('Error al guardar la recepción del pedido:', error);
        alert('Error al guardar la recepción del pedido: ' + error.message);
    }
}

function showReceivedOrder(orderId) {
    db.collection('orders').doc(orderId).get().then(doc => {
        if (doc.exists) {
            const order = doc.data();
            let receivedOrderHTML = `
                <p>ID Pedido: ${order.orderId}</p>
                <p>Proveedor: ${order.providerName}</p>
                <p>Sucursal: ${order.sucursalName}</p>
                <p>Fecha: ${order.orderDate}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Cantidad Pedido</th>
                            <th>Cantidad Recibida</th>
                            <th>Comentarios</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            order.receivedProducts.forEach(product => {
                receivedOrderHTML += `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.presentation}</td>
                        <td>${product.quantity}</td>
                        <td>${product.receivedQuantity}</td>
                        <td>${product.comments}</td>
                    </tr>
                `;
            });
            receivedOrderHTML += `
                    </tbody>
                </table>
            `;
            document.getElementById('receivedOrderDetails').innerHTML = receivedOrderHTML;
            document.getElementById('receivedOrderModal').style.display = 'block';
        }
    }).catch(error => {
        console.error('Error al mostrar detalles del pedido recibido:', error);
        alert('Error al mostrar detalles del pedido recibido: ' + error.message);
    });
}

function closeReceivedOrderModal() {
    document.getElementById('receivedOrderDetails').innerHTML = '';  // Clear the modal content
    document.getElementById('receivedOrderModal').style.display = 'none';
}
