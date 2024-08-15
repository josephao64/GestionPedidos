// Configuración de Firebase
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

// Funciones para abrir y cerrar modales
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function openAddFacturaModal() {
    loadEmpresasSelectOptions('empresaSelect', 'sucursalSelect');
    loadProveedoresSelectOptions('proveedorSelect');
    openModal('addFacturaModal');
}

// Carga las opciones de empresas y sucursales en los selects
async function loadEmpresasSelectOptions(empresaSelectId, sucursalSelectId) {
    try {
        var empresasSnapshot = await db.collection('empresas').get();
        var empresaSelect = document.getElementById(empresaSelectId);
        var sucursalSelect = document.getElementById(sucursalSelectId);
        empresaSelect.innerHTML = '<option value="">Selecciona una Empresa</option>';
        sucursalSelect.innerHTML = '<option value="">Selecciona una Sucursal</option>';

        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.name;
            empresaSelect.appendChild(option);
        });

        empresaSelect.addEventListener('change', function() {
            loadSucursalesSelectOptions(sucursalSelectId, empresaSelect.value);
        });

    } catch (error) {
        console.error('Error al cargar opciones de empresas:', error);
        alert('Error al cargar opciones de empresas: ' + error.message);
    }
}

async function loadSucursalesSelectOptions(sucursalSelectId, empresaId) {
    try {
        var sucursalesSnapshot = await db.collection('sucursales').where('empresaId', '==', empresaId).get();
        var sucursalSelect = document.getElementById(sucursalSelectId);
        sucursalSelect.innerHTML = '<option value="">Selecciona una Sucursal</option>';

        sucursalesSnapshot.forEach(function(doc) {
            var sucursal = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = sucursal.name;
            sucursalSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar opciones de sucursales:', error);
        alert('Error al cargar opciones de sucursales: ' + error.message);
    }
}

async function loadProveedoresSelectOptions(proveedorSelectId) {
    try {
        var proveedoresSnapshot = await db.collection('providers').get();
        var proveedorSelect = document.getElementById(proveedorSelectId);
        proveedorSelect.innerHTML = '<option value="">Selecciona un Proveedor</option>';

        proveedoresSnapshot.forEach(function(doc) {
            var proveedor = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = proveedor.name;
            proveedorSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar opciones de proveedores:', error);
        alert('Error al cargar opciones de proveedores: ' + error.message);
    }
}

async function addFactura() {
    try {
        var facturaNumero = document.getElementById('facturaNumero').value;
        var empresaId = document.getElementById('empresaSelect').value;
        var sucursalId = document.getElementById('sucursalSelect').value;
        var proveedorId = document.getElementById('proveedorSelect').value;
        var fechaEmision = document.getElementById('facturaFechaEmision').value;
        var fechaVencimiento = document.getElementById('facturaFechaVencimiento').value;
        var montoTotal = document.getElementById('facturaMontoTotal').value;
        var estadoPago = document.getElementById('facturaEstadoPago').value;
        var archivoFactura = document.getElementById('facturaArchivo').files[0];
        var descuentos = document.getElementById('facturaDescuentos').value || 0;
        var montoNeto = document.getElementById('facturaMontoNeto').value || montoTotal - descuentos;
        var metodoPago = document.getElementById('facturaMetodoPago').value;
        var notasAdicionales = document.getElementById('facturaNotas').value;

        if (!facturaNumero) throw new Error('El número de la factura no puede estar vacío');
        if (!empresaId || !sucursalId || !proveedorId) throw new Error('Debe seleccionar empresa, sucursal y proveedor');

        await db.collection('facturas').add({
            numero: facturaNumero,
            empresaId: empresaId,
            sucursalId: sucursalId,
            proveedorId: proveedorId,
            fechaEmision: fechaEmision,
            fechaVencimiento: fechaVencimiento,
            montoTotal: montoTotal,
            estadoPago: estadoPago,
            archivoFactura: archivoFactura ? archivoFactura.name : null,
            descuentos: descuentos,
            montoNeto: montoNeto,
            metodoPago: metodoPago,
            notasAdicionales: notasAdicionales
        });

        closeModal('addFacturaModal');
        alert('Factura agregada con éxito');
        // Carga nuevamente las facturas para mostrar la recién agregada
        loadFacturas();
    } catch (error) {
        console.error('Error al agregar factura:', error);
        alert('Error al agregar factura: ' + error.message);
    }
}

async function updateFactura() {
    try {
        var id = document.getElementById('editFacturaId').value;
        var facturaNumero = document.getElementById('editFacturaNumero').value;
        var empresaId = document.getElementById('editEmpresaSelect').value;
        var sucursalId = document.getElementById('editSucursalSelect').value;
        var proveedorId = document.getElementById('editProveedorSelect').value;
        var fechaEmision = document.getElementById('editFacturaFechaEmision').value;
        var fechaVencimiento = document.getElementById('editFacturaFechaVencimiento').value;
        var montoTotal = document.getElementById('editFacturaMontoTotal').value;
        var estadoPago = document.getElementById('editFacturaEstadoPago').value;
        var archivoFactura = document.getElementById('editFacturaArchivo').files[0];
        var descuentos = document.getElementById('editFacturaDescuentos').value || 0;
        var montoNeto = document.getElementById('editFacturaMontoNeto').value || montoTotal - descuentos;
        var metodoPago = document.getElementById('editFacturaMetodoPago').value;
        var notasAdicionales = document.getElementById('editFacturaNotas').value;

        if (!facturaNumero) throw new Error('El número de la factura no puede estar vacío');

        await db.collection('facturas').doc(id).update({
            numero: facturaNumero,
            empresaId: empresaId,
            sucursalId: sucursalId,
            proveedorId: proveedorId,
            fechaEmision: fechaEmision,
            fechaVencimiento: fechaVencimiento,
            montoTotal: montoTotal,
            estadoPago: estadoPago,
            archivoFactura: archivoFactura ? archivoFactura.name : null,
            descuentos: descuentos,
            montoNeto: montoNeto,
            metodoPago: metodoPago,
            notasAdicionales: notasAdicionales
        });

        closeModal('editFacturaModal');
        loadFacturas();
        alert('Factura actualizada con éxito');
    } catch (error) {
        console.error('Error al actualizar factura:', error);
        alert('Error al actualizar factura: ' + error.message);
    }
}

async function deleteFactura(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta factura?')) {
        try {
            await db.collection('facturas').doc(id).delete();
            loadFacturas();
        } catch (error) {
            console.error('Error al eliminar factura:', error);
            alert('Error al eliminar factura: ' + error.message);
        }
    }
}

async function loadFacturas() {
    try {
        var facturasSnapshot = await db.collection('facturas').get();
        var facturasTableBody = document.getElementById('facturasTable').getElementsByTagName('tbody')[0];
        facturasTableBody.innerHTML = '';

        // Obtener todas las empresas, sucursales y proveedores de una vez
        var empresasSnapshot = await db.collection('empresas').get();
        var sucursalesSnapshot = await db.collection('sucursales').get();
        var proveedoresSnapshot = await db.collection('providers').get();

        var empresasMap = new Map();
        var sucursalesMap = new Map();
        var proveedoresMap = new Map();

        empresasSnapshot.forEach(function(doc) {
            empresasMap.set(doc.id, doc.data().name);
        });

        sucursalesSnapshot.forEach(function(doc) {
            sucursalesMap.set(doc.id, doc.data().name);
        });

        proveedoresSnapshot.forEach(function(doc) {
            proveedoresMap.set(doc.id, doc.data().name);
        });

        facturasSnapshot.forEach(function(doc) {
            let factura = doc.data();
            let empresaName = empresasMap.get(factura.empresaId) || 'Empresa no encontrada';
            let sucursalName = sucursalesMap.get(factura.sucursalId) || 'Sucursal no encontrada';
            let proveedorName = proveedoresMap.get(factura.proveedorId) || 'Proveedor no encontrado';

            let row = facturasTableBody.insertRow();
            row.insertCell(0).textContent = factura.numero;
            row.insertCell(1).textContent = empresaName;
            row.insertCell(2).textContent = sucursalName;
            row.insertCell(3).textContent = proveedorName;
            row.insertCell(4).textContent = factura.fechaEmision;
            row.insertCell(5).textContent = factura.fechaVencimiento;
            row.insertCell(6).textContent = factura.montoTotal;
            row.insertCell(7).textContent = factura.estadoPago;
            row.insertCell(8).innerHTML = `
                <button onclick="openEditFacturaModal('${doc.id}')">Editar</button>
                <button onclick="deleteFactura('${doc.id}')">Eliminar</button>
                <button onclick="viewFacturaDetails('${doc.id}')">Ver Detalles</button>
            `;
        });
    } catch (error) {
        console.error('Error al cargar facturas:', error);
        alert('Error al cargar facturas: ' + error.message);
    }
}

function filterFacturas() {
    var numero = document.getElementById('searchNumero').value.toUpperCase();
    var proveedor = document.getElementById('searchProveedor').value.toUpperCase();
    var empresa = document.getElementById('searchEmpresa').value.toUpperCase();
    var sucursal = document.getElementById('searchSucursal').value.toUpperCase();
    var table = document.getElementById('facturasTable');
    var tr = table.getElementsByTagName('tr');

    for (var i = 1; i < tr.length; i++) {
        var tdNumero = tr[i].getElementsByTagName('td')[0];
        var tdEmpresa = tr[i].getElementsByTagName('td')[1];
        var tdSucursal = tr[i].getElementsByTagName('td')[2];
        var tdProveedor = tr[i].getElementsByTagName('td')[3];
        if (tdNumero && tdEmpresa && tdSucursal && tdProveedor) {
            var txtNumero = tdNumero.textContent || tdNumero.innerText;
            var txtEmpresa = tdEmpresa.textContent || tdEmpresa.innerText;
            var txtSucursal = tdSucursal.textContent || tdSucursal.innerText;
            var txtProveedor = tdProveedor.textContent || tdProveedor.innerText;

            if (txtNumero.toUpperCase().indexOf(numero) > -1 && 
                txtEmpresa.toUpperCase().indexOf(empresa) > -1 &&
                txtSucursal.toUpperCase().indexOf(sucursal) > -1 &&
                txtProveedor.toUpperCase().indexOf(proveedor) > -1) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }       
    }
}

function openEditFacturaModal(id) {
    db.collection('facturas').doc(id).get().then(function(doc) {
        if (doc.exists) {
            var factura = doc.data();
            document.getElementById('editFacturaId').value = id;
            document.getElementById('editFacturaNumero').value = factura.numero;
            loadEmpresasSelectOptions('editEmpresaSelect', 'editSucursalSelect').then(function() {
                document.getElementById('editEmpresaSelect').value = factura.empresaId;
                loadSucursalesSelectOptions('editSucursalSelect', factura.empresaId).then(function() {
                    document.getElementById('editSucursalSelect').value = factura.sucursalId;
                });
            });
            loadProveedoresSelectOptions('editProveedorSelect').then(function() {
                document.getElementById('editProveedorSelect').value = factura.proveedorId;
            });
            document.getElementById('editFacturaFechaEmision').value = factura.fechaEmision;
            document.getElementById('editFacturaFechaVencimiento').value = factura.fechaVencimiento;
            document.getElementById('editFacturaMontoTotal').value = factura.montoTotal;
            document.getElementById('editFacturaEstadoPago').value = factura.estadoPago;
            document.getElementById('editFacturaDescuentos').value = factura.descuentos;
            document.getElementById('editFacturaMontoNeto').value = factura.montoNeto;
            document.getElementById('editFacturaMetodoPago').value = factura.metodoPago;
            document.getElementById('editFacturaNotas').value = factura.notasAdicionales;
            openModal('editFacturaModal');
        } else {
            alert('Factura no encontrada');
        }
    }).catch(function(error) {
        console.error('Error al obtener factura:', error);
        alert('Error al obtener factura: ' + error.message);
    });
}

function viewFacturaDetails(id) {
    db.collection('facturas').doc(id).get().then(function(doc) {
        if (doc.exists) {
            var factura = doc.data();
            var detalles = `
                Número de Factura: ${factura.numero}
                Empresa: ${factura.empresaId}
                Sucursal: ${factura.sucursalId}
                Proveedor: ${factura.proveedorId}
                Fecha de Emisión: ${factura.fechaEmision}
                Fecha de Vencimiento: ${factura.fechaVencimiento}
                Monto Total: ${factura.montoTotal}
                Estado de Pago: ${factura.estadoPago}
                Descuentos: ${factura.descuentos}
                Monto Neto: ${factura.montoNeto}
                Método de Pago: ${factura.metodoPago}
                Notas Adicionales: ${factura.notasAdicionales}
            `;
            alert(detalles);
        } else {
            alert('Factura no encontrada');
        }
    }).catch(function(error) {
        console.error('Error al obtener los detalles de la factura:', error);
        alert('Error al obtener los detalles de la factura: ' + error.message);
    });
}

// Inicializa la carga de facturas al cargar la página
window.onload = loadFacturas;
