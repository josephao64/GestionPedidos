// app.js

document.addEventListener('DOMContentLoaded', () => {
    // Enlaces de navegación
    const dashboardLink = document.getElementById('dashboard-link');
    const comprasLink = document.getElementById('compras-link');
    const ventasLink = document.getElementById('ventas-link');
    const proveedoresLink = document.getElementById('proveedores-link');
    const productosLink = document.getElementById('productos-link');

    // Secciones
    const dashboard = document.getElementById('dashboard');
    const compras = document.getElementById('compras');
    const ventas = document.getElementById('ventas');
    const proveedores = document.getElementById('proveedores');
    const productos = document.getElementById('productos');

    // Función para mostrar una sección y ocultar las demás
    function showSection(section) {
        dashboard.classList.add('hidden');
        compras.classList.add('hidden');
        ventas.classList.add('hidden');
        proveedores.classList.add('hidden');
        productos.classList.add('hidden');

        section.classList.remove('hidden');

        // Actualizar el estado activo en la navegación
        document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
        if (section === dashboard) {
            dashboardLink.classList.add('active');
        } else if (section === compras) {
            comprasLink.classList.add('active');
        } else if (section === ventas) {
            ventasLink.classList.add('active');
        } else if (section === proveedores) {
            proveedoresLink.classList.add('active');
        } else if (section === productos) {
            productosLink.classList.add('active');
        }
    }

    // Eventos de clic para navegación
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(dashboard);
        loadDashboardData();
    });

    comprasLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(compras);
        cargarSelectsCompra();
        listarCompras();
    });

    ventasLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(ventas);
        cargarSelectsVenta();
        listarVentas();
    });

    proveedoresLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(proveedores);
        listarProveedores();
    });

    productosLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(productos);
        listarProductos();
    });

    // Cargar el Dashboard por defecto
    showSection(dashboard);
    loadDashboardData();

    // Manejo de conexión
    window.addEventListener('online', syncLocalData);
    window.addEventListener('offline', () => {
        Swal.fire({
            icon: 'warning',
            title: 'Sin conexión',
            text: 'Estás sin conexión. Los datos se guardarán localmente.',
            confirmButtonText: 'Aceptar'
        });
    });

    // Funciones del Dashboard
    async function loadDashboardData() {
        try {
            // Obtener ventas de los últimos 5 meses
            const ventasSnapshot = await db.collection('ventas').get();
            const ventasData = ventasSnapshot.docs.map(doc => doc.data());

            // Procesar datos para los últimos 5 meses
            const meses = getLastFiveMonths();
            const ventasPorMes = meses.map(mes => {
                return ventasData
                    .filter(v => v.mes === mes)
                    .reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
            });

            // Actualizar gráfica de Ventas de los Últimos 5 Meses
            const ctx = document.getElementById('ventas-chart').getContext('2d');
            if (window.ventasChart) {
                window.ventasChart.destroy();
            }
            window.ventasChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: meses,
                    datasets: [{
                        label: 'Ventas',
                        data: ventasPorMes,
                        backgroundColor: 'rgba(52, 152, 219, 0.5)',
                        borderColor: 'rgba(41, 128, 185, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true
                }
            });

            // Calcular totales del mes actual
            const mesActual = getCurrentMonth();
            const ventasMes = ventasData.filter(v => v.mes === mesActual);
            const totalVentasMes = ventasMes.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);

            // Obtener compras del mes actual
            const comprasSnapshot = await db.collection('compras')
                .where('fecha', '>=', getMonthStartDate())
                .where('fecha', '<=', getMonthEndDate())
                .get();
            const comprasData = comprasSnapshot.docs.map(doc => doc.data());
            const totalComprasMes = comprasData.reduce((acc, curr) => {
                const totalFactura = curr.listaProductos.reduce((sum, p) => sum + parseFloat(p.total), 0);
                return acc + totalFactura;
            }, 0);

            // Actualizar tarjetas
            document.getElementById('total-ventas-mes').innerHTML = `<i class="fas fa-dollar-sign"></i> Total Ventas del Mes: $${totalVentasMes.toFixed(2)}`;
            document.getElementById('total-compras-mes').innerHTML = `<i class="fas fa-dollar-sign"></i> Total Compras del Mes: $${totalComprasMes.toFixed(2)}`;
            document.getElementById('sobrante').innerHTML = `<i class="fas fa-wallet"></i> Sobrante: $${(totalVentasMes - totalComprasMes).toFixed(2)}`;

            // Promedio de ventas diarias
            const diasConVentas = ventasMes.length;
            const promedioVentas = diasConVentas > 0 ? (totalVentasMes / diasConVentas).toFixed(2) : 0;
            document.getElementById('promedio-ventas').innerHTML = `<i class="fas fa-chart-pie"></i> Promedio Ventas Diarias: $${promedioVentas}`;

            // Mejor día de ventas
            if (ventasMes.length > 0) {
                const mejorDia = ventasMes.reduce((prev, current) => (parseFloat(prev.monto) > parseFloat(current.monto)) ? prev : current);
                const fechaMejorDia = mejorDia.fecha.toDate().toLocaleDateString();
                document.getElementById('mejor-dia').innerHTML = `<i class="fas fa-star"></i> Mejor Día de Ventas: ${mejorDia.nombreDia} (${fechaMejorDia}) - $${parseFloat(mejorDia.monto).toFixed(2)}`;
            } else {
                document.getElementById('mejor-dia').innerHTML = `<i class="fas fa-star"></i> Mejor Día de Ventas: N/A`;
            }

            // Cargar gráficas adicionales
            await loadAdditionalCharts();
        } catch (error) {
            console.error('Error al cargar datos del Dashboard:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al cargar datos del Dashboard.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Función para cargar y renderizar gráficas adicionales en el Dashboard
    async function loadAdditionalCharts() {
        try {
            // 1. Gráfica de Ventas Diarias del Mes Actual (Línea)
            const mesActual = getCurrentMonth();
            const ventasDiariasSnapshot = await db.collection('ventas')
                .where('mes', '==', mesActual)
                .get();
            const ventasDiariasData = ventasDiariasSnapshot.docs.map(doc => doc.data());
            
            // Ordenar por fecha
            ventasDiariasData.sort((a, b) => a.fecha.toDate() - b.fecha.toDate());
            
            const fechasDiarias = ventasDiariasData.map(v => v.fecha.toDate().toLocaleDateString());
            const montosDiarios = ventasDiariasData.map(v => parseFloat(v.monto));
            
            const ctxDiarias = document.getElementById('ventas-diarias-chart').getContext('2d');
            if (window.ventasDiariasChart) {
                window.ventasDiariasChart.destroy();
            }
            window.ventasDiariasChart = new Chart(ctxDiarias, {
                type: 'line',
                data: {
                    labels: fechasDiarias,
                    datasets: [{
                        label: 'Ventas Diarias',
                        data: montosDiarios,
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        borderColor: 'rgba(39, 174, 96, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true
                }
            });

            // 2. Gráfica de Sobrante Mensual (Pie)
            const sobranteData = await getSobranteMensual();
            const ctxSobrante = document.getElementById('sobrante-chart').getContext('2d');
            if (window.sobranteChart) {
                window.sobranteChart.destroy();
            }
            window.sobranteChart = new Chart(ctxSobrante, {
                type: 'pie',
                data: {
                    labels: ['Ventas', 'Compras'],
                    datasets: [{
                        data: [sobranteData.totalVentasMes, sobranteData.totalComprasMes],
                        backgroundColor: [
                            'rgba(52, 152, 219, 0.7)',
                            'rgba(231, 76, 60, 0.7)'
                        ],
                        borderColor: [
                            'rgba(52, 152, 219, 1)',
                            'rgba(231, 76, 60, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true
                }
            });
        } catch (error) {
            console.error('Error al cargar gráficas adicionales:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar las gráficas adicionales.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Función para obtener Sobrante Mensual
    async function getSobranteMensual() {
        try {
            const mesActual = getCurrentMonth();
            
            // Obtener ventas del mes actual
            const ventasSnapshot = await db.collection('ventas')
                .where('mes', '==', mesActual)
                .get();
            const ventasData = ventasSnapshot.docs.map(doc => doc.data());
            const totalVentasMes = ventasData.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
            
            // Obtener compras del mes actual
            const comprasSnapshot = await db.collection('compras')
                .where('fecha', '>=', getMonthStartDate())
                .where('fecha', '<=', getMonthEndDate())
                .get();
            const comprasData = comprasSnapshot.docs.map(doc => doc.data());
            const totalComprasMes = comprasData.reduce((acc, curr) => {
                const totalFactura = curr.listaProductos.reduce((sum, p) => sum + parseFloat(p.total), 0);
                return acc + totalFactura;
            }, 0);
            
            return { totalVentasMes, totalComprasMes };
        } catch (error) {
            console.error('Error al obtener sobrante mensual:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo calcular el sobrante mensual.',
                confirmButtonText: 'Aceptar'
            });
            return { totalVentasMes: 0, totalComprasMes: 0 };
        }
    }

    // Funciones auxiliares
    function getLastFiveMonths() {
        const meses = [];
        const date = new Date();
        for (let i = 4; i >= 0; i--) {
            const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
            const month = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();
            meses.push(`${month} ${year}`);
        }
        return meses;
    }

    function getCurrentMonth() {
        const d = new Date();
        const month = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear();
        return `${month} ${year}`;
    }

    function getMonthStartDate() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    function getMonthEndDate() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }

    // Manejo de LocalStorage
    function saveDataLocally(collection, data) {
        let localData = JSON.parse(localStorage.getItem('localData')) || {};
        if (!localData[collection]) {
            localData[collection] = [];
        }
        localData[collection].push(data);
        localStorage.setItem('localData', JSON.stringify(localData));
    }

    async function syncLocalData() {
        const localData = JSON.parse(localStorage.getItem('localData'));
        if (localData) {
            try {
                for (const collection in localData) {
                    for (const doc of localData[collection]) {
                        await db.collection(collection).add(doc);
                    }
                }
                localStorage.removeItem('localData');
                Swal.fire({
                    icon: 'success',
                    title: 'Sincronización Exitosa',
                    text: 'Los datos guardados localmente han sido sincronizados.',
                    confirmButtonText: 'Aceptar'
                });
                // Actualizar el Dashboard después de la sincronización
                loadDashboardData();
            } catch (error) {
                console.error('Error al sincronizar datos locales:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudieron sincronizar los datos locales.',
                    confirmButtonText: 'Aceptar'
                });
            }
        }
    }

    // Funciones para Compras
    const formCompra = document.getElementById('form-compra');
    const agregarProductoBtn = document.getElementById('agregar-producto');
    const productosCompraDiv = document.getElementById('productos-compra');
    const listaCompras = document.getElementById('lista-compras');

    // Agregar producto dinámicamente en Compras
    agregarProductoBtn.addEventListener('click', () => {
        const productoItem = document.createElement('div');
        productoItem.classList.add('producto-item');
        productoItem.innerHTML = `
            <div class="form-group">
                <label><i class="fas fa-box"></i> Producto:</label>
                <select class="producto-select" required>
                    <option value="">Selecciona Producto</option>
                    <!-- Opciones dinámicas -->
                </select>
            </div>
            <div class="form-group">
                <label><i class="fas fa-sort-numeric-up"></i> Cantidad:</label>
                <input type="number" class="cantidad" placeholder="Cantidad" required min="1">
            </div>
            <div class="form-group">
                <label><i class="fas fa-dollar-sign"></i> Precio Unitario:</label>
                <input type="number" class="precio-unitario" placeholder="Precio Unitario" required min="0.01" step="0.01">
            </div>
            <span class="total-parcial"><i class="fas fa-calculator"></i> Total: $0.00</span>
            <button type="button" class="eliminar-producto"><i class="fas fa-trash-alt"></i> Eliminar</button>
        `;
        productosCompraDiv.appendChild(productoItem);
        cargarSelectsCompra();
    });

    // Eliminar producto en Compras
    productosCompraDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('eliminar-producto') || e.target.closest('.eliminar-producto')) {
            Swal.fire({
                title: '¿Estás seguro?',
                text: "¿Quieres eliminar este producto?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#c0392b',
                cancelButtonColor: '#7f8c8d',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    e.target.closest('.producto-item').remove();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'El producto ha sido eliminado.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            });
        }
    });

    // Calcular total parcial en Compras
    productosCompraDiv.addEventListener('input', (e) => {
        if (e.target.classList.contains('cantidad') || e.target.classList.contains('precio-unitario')) {
            const productoItem = e.target.closest('.producto-item');
            const cantidad = parseInt(productoItem.querySelector('.cantidad').value) || 0;
            const precio = parseFloat(productoItem.querySelector('.precio-unitario').value) || 0;
            const total = cantidad * precio;
            productoItem.querySelector('.total-parcial').innerText = `Total: $${total.toFixed(2)}`;
        }
    });

    // Manejar el envío del formulario de Compras
    formCompra.addEventListener('submit', async (e) => {
        e.preventDefault();

        const numeroFactura = document.getElementById('numero-factura').value.trim();
        const fechaCompra = document.getElementById('fecha-compra').value;
        const tipoPago = document.getElementById('tipo-pago').value;
        const proveedor = document.getElementById('proveedor').value;

        // Obtener productos
        const productosItems = document.querySelectorAll('.producto-item');
        const listaProductos = [];
        productosItems.forEach(item => {
            const productoId = item.querySelector('.producto-select').value;
            const cantidad = parseInt(item.querySelector('.cantidad').value);
            const precioUnitario = parseFloat(item.querySelector('.precio-unitario').value);
            const total = cantidad * precioUnitario;
            if (productoId && cantidad > 0 && precioUnitario > 0) {
                listaProductos.push({
                    producto: productoId,
                    cantidad,
                    precioUnitario,
                    total: total.toFixed(2)
                });
            }
        });

        if (listaProductos.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Agrega al menos un producto válido.',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        const compra = {
            numeroFactura,
            fecha: firebase.firestore.Timestamp.fromDate(new Date(fechaCompra)),
            tipoPago,
            proveedor,
            listaProductos
        };

        // Guardar en Firestore o LocalStorage
        if (navigator.onLine) {
            try {
                await db.collection('compras').add(compra);
                Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: 'Compra guardada exitosamente.',
                    confirmButtonText: 'Aceptar'
                });
                formCompra.reset();
                productosCompraDiv.innerHTML = `
                    <h3><i class="fas fa-box-open"></i> Productos</h3>
                    <div class="producto-item">
                        <div class="form-group">
                            <label><i class="fas fa-box"></i> Producto:</label>
                            <select class="producto-select" required>
                                <option value="">Selecciona Producto</option>
                                <!-- Opciones dinámicas -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-sort-numeric-up"></i> Cantidad:</label>
                            <input type="number" class="cantidad" placeholder="Cantidad" required min="1">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-dollar-sign"></i> Precio Unitario:</label>
                            <input type="number" class="precio-unitario" placeholder="Precio Unitario" required min="0.01" step="0.01">
                        </div>
                        <span class="total-parcial"><i class="fas fa-calculator"></i> Total: $0.00</span>
                        <button type="button" class="eliminar-producto"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                listarCompras();
                cargarSelectsCompra();
                loadDashboardData();
            } catch (error) {
                console.error('Error al guardar la compra:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al guardar la compra.',
                    confirmButtonText: 'Aceptar'
                });
            }
        } else {
            saveDataLocally('compras', compra);
            Swal.fire({
                icon: 'warning',
                title: 'Sin conexión',
                text: 'Estás sin conexión. La compra se guardó localmente.',
                confirmButtonText: 'Aceptar'
            });
            formCompra.reset();
            productosCompraDiv.innerHTML = `
                <h3><i class="fas fa-box-open"></i> Productos</h3>
                <div class="producto-item">
                    <div class="form-group">
                        <label><i class="fas fa-box"></i> Producto:</label>
                        <select class="producto-select" required>
                            <option value="">Selecciona Producto</option>
                            <!-- Opciones dinámicas -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-sort-numeric-up"></i> Cantidad:</label>
                        <input type="number" class="cantidad" placeholder="Cantidad" required min="1">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-dollar-sign"></i> Precio Unitario:</label>
                        <input type="number" class="precio-unitario" placeholder="Precio Unitario" required min="0.01" step="0.01">
                    </div>
                    <span class="total-parcial"><i class="fas fa-calculator"></i> Total: $0.00</span>
                    <button type="button" class="eliminar-producto"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            `;
            listarCompras();
            cargarSelectsCompra();
            loadDashboardData();
        }
    });

    // Listar Compras
    async function listarCompras() {
        listaCompras.innerHTML = '';
        try {
            const snapshot = await db.collection('compras').orderBy('fecha', 'desc').get();
            snapshot.forEach(doc => {
                const compra = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span><strong><i class="fas fa-file-invoice-dollar"></i> Factura:</strong> ${compra.numeroFactura} | <strong><i class="fas fa-calendar-alt"></i> Fecha:</strong> ${compra.fecha.toDate().toLocaleDateString()} | <strong><i class="fas fa-money-bill-wave"></i> Pago:</strong> ${compra.tipoPago} | <strong><i class="fas fa-truck-loading"></i> Proveedor:</strong> ${compra.proveedor} | <strong><i class="fas fa-dollar-sign"></i> Total:</strong> $${compra.listaProductos.reduce((sum, p) => sum + parseFloat(p.total), 0).toFixed(2)}</span>
                    <div>
                        <button class="edit"><i class="fas fa-edit"></i> Editar</button>
                        <button class="delete"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                // Editar Compra
                li.querySelector('.edit').addEventListener('click', () => editarCompra(doc.id, compra));
                // Eliminar Compra
                li.querySelector('.delete').addEventListener('click', () => eliminarCompra(doc.id));
                listaCompras.appendChild(li);
            });
        } catch (error) {
            console.error('Error al listar compras:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al listar compras.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Editar Compra (Implementación básica con SweetAlert2)
    function editarCompra(id, compra) {
        Swal.fire({
            title: 'Editar Compra',
            html: `
                <div class="form-group">
                    <label><i class="fas fa-file-invoice-dollar"></i> Número de Factura:</label>
                    <input type="text" id="edit-numero-factura" class="swal2-input" placeholder="Número de Factura" value="${compra.numeroFactura}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> Fecha de Compra:</label>
                    <input type="date" id="edit-fecha-compra" class="swal2-input" value="${compra.fecha.toDate().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-money-bill-wave"></i> Tipo de Pago:</label>
                    <select id="edit-tipo-pago" class="swal2-input">
                        <option value="">Selecciona Tipo de Pago</option>
                        <option value="Contado" ${compra.tipoPago === 'Contado' ? 'selected' : ''}>Contado</option>
                        <option value="Crédito" ${compra.tipoPago === 'Crédito' ? 'selected' : ''}>Crédito</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-truck-loading"></i> Proveedor:</label>
                    <select id="edit-proveedor" class="swal2-input">
                        <option value="">Selecciona Proveedor</option>
                        <!-- Opciones dinámicas -->
                    </select>
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const numeroFactura = document.getElementById('edit-numero-factura').value.trim();
                const fechaCompra = document.getElementById('edit-fecha-compra').value;
                const tipoPago = document.getElementById('edit-tipo-pago').value;
                const proveedor = document.getElementById('edit-proveedor').value;

                if (!numeroFactura || !fechaCompra || !tipoPago || !proveedor) {
                    Swal.showValidationMessage('Por favor, completa todos los campos.');
                    return false;
                }

                return { numeroFactura, fechaCompra, tipoPago, proveedor };
            },
            didOpen: async () => {
                // Cargar proveedores en el select de edición
                const editProveedorSelect = document.getElementById('edit-proveedor');
                editProveedorSelect.innerHTML = '<option value="">Selecciona Proveedor</option>';
                try {
                    const proveedoresSnapshot = await db.collection('proveedores').get();
                    proveedoresSnapshot.forEach(doc => {
                        const proveedor = doc.data();
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = proveedor.nombre;
                        if (proveedor.nombre === compra.proveedor) {
                            option.selected = true;
                        }
                        editProveedorSelect.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error al cargar proveedores:', error);
                    Swal.showValidationMessage('Error al cargar proveedores.');
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { numeroFactura, fechaCompra, tipoPago, proveedor } = result.value;
                try {
                    await db.collection('compras').doc(id).update({
                        numeroFactura,
                        fecha: firebase.firestore.Timestamp.fromDate(new Date(fechaCompra)),
                        tipoPago,
                        proveedor
                    });
                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'La compra ha sido actualizada.',
                        confirmButtonText: 'Aceptar'
                    });
                    listarCompras();
                    loadDashboardData();
                } catch (error) {
                    console.error('Error al actualizar la compra:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo actualizar la compra.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Eliminar Compra con SweetAlert2
    async function eliminarCompra(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres eliminar esta compra?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#7f8c8d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await db.collection('compras').doc(id).delete();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'La compra ha sido eliminada.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    listarCompras();
                    loadDashboardData();
                } catch (error) {
                    console.error('Error al eliminar compra:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo eliminar la compra.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Funciones para Ventas
    const formVenta = document.getElementById('form-venta');
    const agregarVentaBtn = document.getElementById('agregar-venta');
    const ventasDiasDiv = document.getElementById('ventas-dias');
    const listaVentas = document.getElementById('lista-ventas');

    // Agregar día de venta dinámicamente
    agregarVentaBtn.addEventListener('click', () => {
        const ventaItem = document.createElement('div');
        ventaItem.classList.add('venta-item');
        ventaItem.innerHTML = `
            <div class="form-group">
                <label><i class="fas fa-calendar-day"></i> Fecha:</label>
                <input type="date" class="fecha-dia" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-id-badge"></i> Nombre del Día:</label>
                <input type="text" class="nombre-dia" placeholder="Nombre del Día" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-dollar-sign"></i> Monto de Venta:</label>
                <input type="number" class="monto-venta" placeholder="Monto de Venta" required min="0" step="0.01">
            </div>
            <button type="button" class="eliminar-venta"><i class="fas fa-trash-alt"></i> Eliminar</button>
        `;
        ventasDiasDiv.appendChild(ventaItem);
    });

    // Eliminar día de venta con SweetAlert2
    ventasDiasDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('eliminar-venta') || e.target.closest('.eliminar-venta')) {
            Swal.fire({
                title: '¿Estás seguro?',
                text: "¿Quieres eliminar este día de venta?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#c0392b',
                cancelButtonColor: '#7f8c8d',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    e.target.closest('.venta-item').remove();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'El día de venta ha sido eliminado.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            });
        }
    });

    // Manejar el envío del formulario de Ventas
    formVenta.addEventListener('submit', async (e) => {
        e.preventDefault();

        const mesVenta = document.getElementById('mes-venta').value;

        // Obtener días de venta
        const ventasItems = document.querySelectorAll('.venta-item');
        const listaVentasDia = [];
        ventasItems.forEach(item => {
            const fecha = item.querySelector('.fecha-dia').value;
            const nombreDia = item.querySelector('.nombre-dia').value.trim();
            const monto = parseFloat(item.querySelector('.monto-venta').value);
            if (fecha && nombreDia && !isNaN(monto)) {
                listaVentasDia.push({
                    mes: mesVenta,
                    dia: new Date(fecha).getDate(),
                    nombreDia,
                    fecha: firebase.firestore.Timestamp.fromDate(new Date(fecha)),
                    monto: monto.toFixed(2)
                });
            }
        });

        if (listaVentasDia.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Agrega al menos una venta válida.',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        // Guardar en Firestore o LocalStorage
        if (navigator.onLine) {
            try {
                const batch = db.batch();
                listaVentasDia.forEach(venta => {
                    const docRef = db.collection('ventas').doc();
                    batch.set(docRef, venta);
                });
                await batch.commit();
                Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: 'Ventas guardadas exitosamente.',
                    confirmButtonText: 'Aceptar'
                });
                formVenta.reset();
                ventasDiasDiv.innerHTML = `
                    <h3><i class="fas fa-calendar-check"></i> Ventas por Día</h3>
                    <div class="venta-item">
                        <div class="form-group">
                            <label><i class="fas fa-calendar-day"></i> Fecha:</label>
                            <input type="date" class="fecha-dia" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-id-badge"></i> Nombre del Día:</label>
                            <input type="text" class="nombre-dia" placeholder="Nombre del Día" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-dollar-sign"></i> Monto de Venta:</label>
                            <input type="number" class="monto-venta" placeholder="Monto de Venta" required min="0" step="0.01">
                        </div>
                        <button type="button" class="eliminar-venta"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                listarVentas();
                loadDashboardData();
            } catch (error) {
                console.error('Error al guardar las ventas:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al guardar las ventas.',
                    confirmButtonText: 'Aceptar'
                });
            }
        } else {
            listaVentasDia.forEach(venta => {
                saveDataLocally('ventas', venta);
            });
            Swal.fire({
                icon: 'warning',
                title: 'Sin conexión',
                text: 'Estás sin conexión. Las ventas se guardaron localmente.',
                confirmButtonText: 'Aceptar'
            });
            formVenta.reset();
            ventasDiasDiv.innerHTML = `
                <h3><i class="fas fa-calendar-check"></i> Ventas por Día</h3>
                <div class="venta-item">
                    <div class="form-group">
                        <label><i class="fas fa-calendar-day"></i> Fecha:</label>
                        <input type="date" class="fecha-dia" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-id-badge"></i> Nombre del Día:</label>
                        <input type="text" class="nombre-dia" placeholder="Nombre del Día" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-dollar-sign"></i> Monto de Venta:</label>
                        <input type="number" class="monto-venta" placeholder="Monto de Venta" required min="0" step="0.01">
                    </div>
                    <button type="button" class="eliminar-venta"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            `;
            listarVentas();
            loadDashboardData();
        }
    });

    // Listar Ventas
    async function listarVentas() {
        listaVentas.innerHTML = '';
        try {
            const snapshot = await db.collection('ventas').orderBy('fecha', 'desc').get();
            snapshot.forEach(doc => {
                const venta = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span><strong><i class="fas fa-calendar-alt"></i> Mes:</strong> ${venta.mes} | <strong><i class="fas fa-calendar-day"></i> Fecha:</strong> ${venta.fecha.toDate().toLocaleDateString()} | <strong><i class="fas fa-id-badge"></i> Día:</strong> ${venta.nombreDia} | <strong><i class="fas fa-dollar-sign"></i> Monto:</strong> $${parseFloat(venta.monto).toFixed(2)}</span>
                    <div>
                        <button class="edit"><i class="fas fa-edit"></i> Editar</button>
                        <button class="delete"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                // Editar Venta
                li.querySelector('.edit').addEventListener('click', () => editarVenta(doc.id, venta));
                // Eliminar Venta
                li.querySelector('.delete').addEventListener('click', () => eliminarVenta(doc.id));
                listaVentas.appendChild(li);
            });
        } catch (error) {
            console.error('Error al listar ventas:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al listar ventas.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Editar Venta (Implementación básica con SweetAlert2)
    function editarVenta(id, venta) {
        Swal.fire({
            title: 'Editar Venta',
            html: `
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> Mes de Venta:</label>
                    <select id="edit-mes-venta" class="swal2-input">
                        <option value="">Selecciona Mes</option>
                        ${getLastFiveMonths().map(mes => `<option value="${mes}" ${mes === venta.mes ? 'selected' : ''}>${mes}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-day"></i> Fecha:</label>
                    <input type="date" id="edit-fecha-dia" class="swal2-input" value="${venta.fecha.toDate().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-id-badge"></i> Nombre del Día:</label>
                    <input type="text" id="edit-nombre-dia" class="swal2-input" placeholder="Nombre del Día" value="${venta.nombreDia}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-dollar-sign"></i> Monto de Venta:</label>
                    <input type="number" id="edit-monto-venta" class="swal2-input" placeholder="Monto de Venta" value="${venta.monto}" min="0" step="0.01">
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const mesVenta = document.getElementById('edit-mes-venta').value;
                const fechaDia = document.getElementById('edit-fecha-dia').value;
                const nombreDia = document.getElementById('edit-nombre-dia').value.trim();
                const montoVenta = parseFloat(document.getElementById('edit-monto-venta').value);

                if (!mesVenta || !fechaDia || !nombreDia || isNaN(montoVenta)) {
                    Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
                    return false;
                }

                return { mesVenta, fechaDia, nombreDia, montoVenta };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { mesVenta, fechaDia, nombreDia, montoVenta } = result.value;
                try {
                    await db.collection('ventas').doc(id).update({
                        mes: mesVenta,
                        fecha: firebase.firestore.Timestamp.fromDate(new Date(fechaDia)),
                        nombreDia,
                        monto: montoVenta.toFixed(2)
                    });
                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'La venta ha sido actualizada.',
                        confirmButtonText: 'Aceptar'
                    });
                    listarVentas();
                    loadDashboardData();
                } catch (error) {
                    console.error('Error al actualizar la venta:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo actualizar la venta.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Eliminar Venta con SweetAlert2
    async function eliminarVenta(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres eliminar esta venta?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#7f8c8d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await db.collection('ventas').doc(id).delete();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'La venta ha sido eliminada.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    listarVentas();
                    loadDashboardData();
                } catch (error) {
                    console.error('Error al eliminar venta:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo eliminar la venta.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Funciones para Proveedores
    const formProveedor = document.getElementById('form-proveedor');
    const listaProveedores = document.getElementById('lista-proveedores');

    // Manejar el envío del formulario de Proveedores
    formProveedor.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombre-proveedor').value.trim();
        const contacto = document.getElementById('contacto-proveedor').value.trim();

        const proveedor = {
            nombre,
            contacto
        };

        // Guardar en Firestore o LocalStorage
        if (navigator.onLine) {
            try {
                await db.collection('proveedores').add(proveedor);
                Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: 'Proveedor agregado exitosamente.',
                    confirmButtonText: 'Aceptar'
                });
                formProveedor.reset();
                listarProveedores();
            } catch (error) {
                console.error('Error al agregar proveedor:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al agregar proveedor.',
                    confirmButtonText: 'Aceptar'
                });
            }
        } else {
            saveDataLocally('proveedores', proveedor);
            Swal.fire({
                icon: 'warning',
                title: 'Sin conexión',
                text: 'Estás sin conexión. El proveedor se guardó localmente.',
                confirmButtonText: 'Aceptar'
            });
            formProveedor.reset();
            listarProveedores();
        }
    });

    // Listar Proveedores
    async function listarProveedores() {
        listaProveedores.innerHTML = '';
        try {
            const snapshot = await db.collection('proveedores').get();
            snapshot.forEach(doc => {
                const proveedor = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span><i class="fas fa-user-tie"></i> ${proveedor.nombre} - ${proveedor.contacto}</span>
                    <div>
                        <button class="edit"><i class="fas fa-edit"></i> Editar</button>
                        <button class="delete"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                // Editar Proveedor
                li.querySelector('.edit').addEventListener('click', () => editarProveedor(doc.id, proveedor));
                // Eliminar Proveedor
                li.querySelector('.delete').addEventListener('click', () => eliminarProveedor(doc.id));
                listaProveedores.appendChild(li);
            });
        } catch (error) {
            console.error('Error al listar proveedores:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al listar proveedores.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Editar Proveedor con SweetAlert2
    function editarProveedor(id, proveedor) {
        Swal.fire({
            title: 'Editar Proveedor',
            html: `
                <div class="form-group">
                    <label><i class="fas fa-user-tie"></i> Nombre del Proveedor:</label>
                    <input type="text" id="edit-nombre-proveedor" class="swal2-input" placeholder="Nombre del Proveedor" value="${proveedor.nombre}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-phone-alt"></i> Información de Contacto:</label>
                    <input type="text" id="edit-contacto-proveedor" class="swal2-input" placeholder="Información de Contacto" value="${proveedor.contacto}">
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const nombre = document.getElementById('edit-nombre-proveedor').value.trim();
                const contacto = document.getElementById('edit-contacto-proveedor').value.trim();

                if (!nombre || !contacto) {
                    Swal.showValidationMessage('Por favor, completa todos los campos.');
                    return false;
                }

                return { nombre, contacto };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { nombre, contacto } = result.value;
                try {
                    await db.collection('proveedores').doc(id).update({
                        nombre,
                        contacto
                    });
                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'Proveedor actualizado exitosamente.',
                        confirmButtonText: 'Aceptar'
                    });
                    listarProveedores();
                    cargarSelectsCompra(); // Actualizar selects de compras si es necesario
                } catch (error) {
                    console.error('Error al actualizar proveedor:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo actualizar el proveedor.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Eliminar Proveedor con SweetAlert2
    async function eliminarProveedor(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres eliminar este proveedor?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#7f8c8d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await db.collection('proveedores').doc(id).delete();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'Proveedor eliminado.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    listarProveedores();
                    cargarSelectsCompra(); // Actualizar selects de compras si es necesario
                } catch (error) {
                    console.error('Error al eliminar proveedor:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo eliminar el proveedor.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Funciones para Productos
    const formProducto = document.getElementById('form-producto');
    const listaProductos = document.getElementById('lista-productos');

    // Manejar el envío del formulario de Productos
    formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombre-producto').value.trim();
        const precio = parseFloat(document.getElementById('precio-base').value);
        const stock = parseInt(document.getElementById('stock').value);

        const producto = {
            nombre,
            precioBase: precio,
            stock
        };

        // Guardar en Firestore o LocalStorage
        if (navigator.onLine) {
            try {
                await db.collection('productos').add(producto);
                Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: 'Producto agregado exitosamente.',
                    confirmButtonText: 'Aceptar'
                });
                formProducto.reset();
                listarProductos();
                cargarSelectsCompra(); // Actualizar selects de compras si es necesario
            } catch (error) {
                console.error('Error al agregar producto:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al agregar producto.',
                    confirmButtonText: 'Aceptar'
                });
            }
        } else {
            saveDataLocally('productos', producto);
            Swal.fire({
                icon: 'warning',
                title: 'Sin conexión',
                text: 'Estás sin conexión. El producto se guardó localmente.',
                confirmButtonText: 'Aceptar'
            });
            formProducto.reset();
            listarProductos();
            cargarSelectsCompra(); // Actualizar selects de compras si es necesario
        }
    });

    // Listar Productos
    async function listarProductos() {
        listaProductos.innerHTML = '';
        try {
            const snapshot = await db.collection('productos').get();
            snapshot.forEach(doc => {
                const producto = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span><i class="fas fa-box"></i> ${producto.nombre} - $${producto.precioBase.toFixed(2)} - Stock: ${producto.stock}</span>
                    <div>
                        <button class="edit"><i class="fas fa-edit"></i> Editar</button>
                        <button class="delete"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                `;
                // Editar Producto
                li.querySelector('.edit').addEventListener('click', () => editarProducto(doc.id, producto));
                // Eliminar Producto
                li.querySelector('.delete').addEventListener('click', () => eliminarProducto(doc.id));
                listaProductos.appendChild(li);
            });
        } catch (error) {
            console.error('Error al listar productos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al listar productos.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Editar Producto con SweetAlert2
    function editarProducto(id, producto) {
        Swal.fire({
            title: 'Editar Producto',
            html: `
                <div class="form-group">
                    <label><i class="fas fa-box"></i> Nombre del Producto:</label>
                    <input type="text" id="edit-nombre-producto" class="swal2-input" placeholder="Nombre del Producto" value="${producto.nombre}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-dollar-sign"></i> Precio Base:</label>
                    <input type="number" id="edit-precio-base" class="swal2-input" placeholder="Precio Base" value="${producto.precioBase}" min="0.01" step="0.01">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-warehouse"></i> Stock:</label>
                    <input type="number" id="edit-stock" class="swal2-input" placeholder="Stock" value="${producto.stock}" min="0">
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const nombre = document.getElementById('edit-nombre-producto').value.trim();
                const precioBase = parseFloat(document.getElementById('edit-precio-base').value);
                const stock = parseInt(document.getElementById('edit-stock').value);

                if (!nombre || isNaN(precioBase) || isNaN(stock)) {
                    Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
                    return false;
                }

                return { nombre, precioBase, stock };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { nombre, precioBase, stock } = result.value;
                try {
                    await db.collection('productos').doc(id).update({
                        nombre,
                        precioBase: precioBase,
                        stock: stock
                    });
                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'Producto actualizado exitosamente.',
                        confirmButtonText: 'Aceptar'
                    });
                    listarProductos();
                    cargarSelectsCompra(); // Actualizar selects de compras si es necesario
                } catch (error) {
                    console.error('Error al actualizar producto:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo actualizar el producto.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Eliminar Producto con SweetAlert2
    async function eliminarProducto(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres eliminar este producto?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#c0392b',
            cancelButtonColor: '#7f8c8d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await db.collection('productos').doc(id).delete();
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'Producto eliminado.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    listarProductos();
                    cargarSelectsCompra(); // Actualizar selects de compras si es necesario
                } catch (error) {
                    console.error('Error al eliminar producto:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo eliminar el producto.',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    }

    // Cargar Selects en Compras
    async function cargarSelectsCompra() {
        try {
            // Cargar Proveedores
            const proveedorSelect = document.getElementById('proveedor');
            proveedorSelect.innerHTML = '<option value="">Selecciona Proveedor</option>';
            const proveedoresSnapshot = await db.collection('proveedores').get();
            proveedoresSnapshot.forEach(doc => {
                const proveedor = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = proveedor.nombre;
                proveedorSelect.appendChild(option);
            });

            // Cargar Productos en cada producto-select
            const productoSelects = document.querySelectorAll('.producto-select');
            productoSelects.forEach(async (select) => {
                // Guardar la opción seleccionada para evitar duplicados
                const selectedValue = select.value;
                select.innerHTML = '<option value="">Selecciona Producto</option>';
                const productosSnapshot = await db.collection('productos').get();
                productosSnapshot.forEach(doc => {
                    const producto = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = producto.nombre;
                    select.appendChild(option);
                });
                select.value = selectedValue;
            });
        } catch (error) {
            console.error('Error al cargar selects de compras:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los selects de compras.',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Cargar Selects en Ventas (Meses)
    function cargarSelectsVenta() {
        const mesVentaSelect = document.getElementById('mes-venta');
        if (mesVentaSelect.children.length === 1) { // Evitar duplicados
            const meses = getLastFiveMonths();
            meses.forEach(mes => {
                const option = document.createElement('option');
                option.value = mes;
                option.textContent = mes;
                mesVentaSelect.appendChild(option);
            });
        }
    }
});
