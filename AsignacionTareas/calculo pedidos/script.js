// script.js

// Array para almacenar los pedidos
let orders = [];

// Obtener referencias a los elementos del DOM
const productForm = document.getElementById('product-form');
const ordersTableBody = document.querySelector('#products-table tbody');
const totalTypeA = document.getElementById('total-type-a');
const totalTypeB = document.getElementById('total-type-b');
const totalGeneral = document.getElementById('total-general');

// Función para cargar pedidos desde localStorage
function loadOrders() {
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) {
        orders = JSON.parse(storedOrders);
    }
}

// Función para guardar pedidos en localStorage
function saveOrders() {
    localStorage.setItem('orders', JSON.stringify(orders));
}

// Función para generar un ID único para cada pedido
function generateID() {
    return Date.now();
}

// Función para determinar el tipo de producto basado en la sucursal
function getProductType(branch) {
    const typeA = ['Jalapa', 'Zacapa', 'Poptun'];
    const typeB = ['Santa Elena', 'Pinula', 'Escala'];

    if (typeA.includes(branch)) return 'Tipo A';
    if (typeB.includes(branch)) return 'Tipo B';
    return 'Desconocido';
}

// Función para calcular días restantes entre dos fechas
function calculateDaysRemaining(requiredDate) {
    const currentDate = new Date();
    const reqDate = new Date(requiredDate);
    const timeDiff = reqDate - currentDate;
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysRemaining;
}

// Función para calcular consumo proyectado
function calculateProjectedConsumption(monthlyAverage, daysRemaining) {
    const dailyAverage = monthlyAverage / 30;
    return (dailyAverage * daysRemaining).toFixed(2);
}

// Función para calcular cantidad a pedir
function calculateQuantityToOrder(projectedConsumption, currentStock) {
    const quantity = projectedConsumption - currentStock;
    return quantity > 0 ? Math.ceil(quantity) : 0;
}

// Función para agregar un pedido al array y actualizar la tabla
function addOrder(e) {
    e.preventDefault();

    // Obtener valores del formulario
    const branch = document.getElementById('branch').value;
    const monthlyAverage = parseFloat(document.getElementById('monthly-average').value);
    const currentStock = parseInt(document.getElementById('current-stock').value);
    const requiredDate = document.getElementById('required-date').value;

    // Validar entradas
    if (!branch || isNaN(monthlyAverage) || isNaN(currentStock) || !requiredDate) {
        alert('Por favor, completa todos los campos correctamente.');
        return;
    }

    // Determinar tipo de producto
    const productType = getProductType(branch);

    // Calcular campos adicionales
    const currentDate = new Date().toISOString().split('T')[0];
    const daysRemaining = calculateDaysRemaining(requiredDate);
    const projectedConsumption = calculateProjectedConsumption(monthlyAverage, daysRemaining);
    const quantityToOrder = calculateQuantityToOrder(projectedConsumption, currentStock);

    // Crear objeto de pedido
    const order = {
        id: generateID(),
        branch,
        productType,
        monthlyAverage,
        currentStock,
        currentDate,
        requiredDate,
        daysRemaining,
        projectedConsumption,
        quantityToOrder,
        status: quantityToOrder > 0 ? 'Pendiente' : 'Suficiente'
    };

    // Agregar al array de pedidos
    orders.push(order);

    // Guardar en localStorage
    saveOrders();

    // Actualizar la tabla y el resumen
    renderOrders();

    // Resetear el formulario
    productForm.reset();
}

// Función para renderizar los pedidos en la tabla
function renderOrders() {
    // Limpiar el cuerpo de la tabla
    ordersTableBody.innerHTML = '';

    // Variables para el resumen
    let totalA = 0;
    let totalB = 0;

    // Iterar sobre los pedidos y crear filas
    orders.forEach(order => {
        const tr = document.createElement('tr');

        // Crear celdas
        tr.innerHTML = `
            <td>${order.id}</td>
            <td>${order.branch}</td>
            <td>${order.productType}</td>
            <td>${order.monthlyAverage}</td>
            <td>${order.currentStock}</td>
            <td>${order.currentDate}</td>
            <td>${order.requiredDate}</td>
            <td>${order.daysRemaining}</td>
            <td>${order.projectedConsumption}</td>
            <td>${order.quantityToOrder}</td>
            <td>
                <span class="status ${getStatusClass(order.status)}">${order.status}</span>
            </td>
            <td>
                <button class="action-button edit-button" onclick="editOrder(${order.id})">Editar</button>
                <button class="action-button delete-button" onclick="deleteOrder(${order.id})">Eliminar</button>
            </td>
        `;

        // Agregar la fila al cuerpo de la tabla
        ordersTableBody.appendChild(tr);

        // Sumar para el resumen
        if (order.productType === 'Tipo A') {
            totalA += order.quantityToOrder;
        } else if (order.productType === 'Tipo B') {
            totalB += order.quantityToOrder;
        }
    });

    // Actualizar el resumen
    totalTypeA.textContent = totalA;
    totalTypeB.textContent = totalB;
    totalGeneral.textContent = totalA + totalB;
}

// Función para obtener la clase CSS según el estado
function getStatusClass(status) {
    switch(status) {
        case 'Pendiente':
            return 'status-pending';
        case 'En Proceso':
            return 'status-process';
        case 'Recibido':
            return 'status-received';
        case 'Suficiente':
            return 'status-received';
        default:
            return '';
    }
}

// Función para eliminar un pedido
function deleteOrder(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
        orders = orders.filter(order => order.id !== id);
        saveOrders();
        renderOrders();
    }
}

// Función para editar un pedido
function editOrder(id) {
    const order = orders.find(o => o.id === id);
    if (order) {
        // Rellenar el formulario con los datos del pedido
        document.getElementById('branch').value = order.branch;
        document.getElementById('monthly-average').value = order.monthlyAverage;
        document.getElementById('current-stock').value = order.currentStock;
        document.getElementById('required-date').value = order.requiredDate;

        // Cambiar el evento del formulario para actualizar en lugar de agregar
        productForm.removeEventListener('submit', addOrder);
        productForm.addEventListener('submit', function updateOrder(e) {
            e.preventDefault();

            // Obtener valores actualizados
            const updatedBranch = document.getElementById('branch').value;
            const updatedMonthlyAverage = parseFloat(document.getElementById('monthly-average').value);
            const updatedCurrentStock = parseInt(document.getElementById('current-stock').value);
            const updatedRequiredDate = document.getElementById('required-date').value;

            // Validar entradas
            if (!updatedBranch || isNaN(updatedMonthlyAverage) || isNaN(updatedCurrentStock) || !updatedRequiredDate) {
                alert('Por favor, completa todos los campos correctamente.');
                return;
            }

            // Determinar tipo de producto
            const updatedProductType = getProductType(updatedBranch);

            // Calcular campos adicionales
            const updatedCurrentDate = new Date().toISOString().split('T')[0];
            const updatedDaysRemaining = calculateDaysRemaining(updatedRequiredDate);
            const updatedProjectedConsumption = calculateProjectedConsumption(updatedMonthlyAverage, updatedDaysRemaining);
            const updatedQuantityToOrder = calculateQuantityToOrder(updatedProjectedConsumption, updatedCurrentStock);

            // Actualizar el pedido
            order.branch = updatedBranch;
            order.productType = updatedProductType;
            order.monthlyAverage = updatedMonthlyAverage;
            order.currentStock = updatedCurrentStock;
            order.currentDate = updatedCurrentDate;
            order.requiredDate = updatedRequiredDate;
            order.daysRemaining = updatedDaysRemaining;
            order.projectedConsumption = updatedProjectedConsumption;
            order.quantityToOrder = updatedQuantityToOrder;
            order.status = updatedQuantityToOrder > 0 ? 'Pendiente' : 'Suficiente';

            // Guardar en localStorage
            saveOrders();

            // Resetear el formulario y eventos
            productForm.reset();
            productForm.removeEventListener('submit', updateOrder);
            productForm.addEventListener('submit', addOrder);

            // Renderizar la tabla y el resumen
            renderOrders();
        });
    }
}

// Evento al enviar el formulario
productForm.addEventListener('submit', addOrder);

// Inicializar la tabla y el resumen si hay pedidos en el almacenamiento local
window.onload = function() {
    loadOrders();
    renderOrders();
};
