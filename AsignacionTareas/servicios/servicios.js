import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "tareasdb-193f4.firebaseapp.com",
    projectId: "tareasdb-193f4",
    storageBucket: "tareasdb-193f4.appspot.com",
    messagingSenderId: "654977996103",
    appId: "1:654977996103:web:9c246d4d16c1d3c943e862"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    let servicios = [];
    let tiposServicios = [];
    let editarIndex = null;
    let filaSeleccionada = null;

    const servicioTable = document.getElementById("servicioTable").querySelector("tbody");
    const searchInput = document.getElementById('searchInput');
    const editarBtn = document.getElementById('editarBtn');
    const eliminarBtn = document.getElementById('eliminarBtn');

    const filterSucursal = document.getElementById('filterSucursal');
    const filterServicio = document.getElementById('filterServicio');
    const filterEstadoPago = document.getElementById('filterEstadoPago');
    const filterFechaDesde = document.getElementById('filterFechaDesde');
    const filterFechaHasta = document.getElementById('filterFechaHasta');
    const sortOrderSelect = document.getElementById('sortOrder');
    const resetFiltersBtn = document.getElementById('resetFilters');

    const tipoPagoSelect = document.getElementById('tipoPago');
    const tipoPagoFijoFields = document.getElementById('tipoPagoFijoFields');

    // Selector de Año
    const yearSelector = document.getElementById('yearSelector');
    let yearSelected = new Date().getFullYear();
    yearSelector.value = yearSelected;

    // Modales para Recibos
    const registrarReciboModal = document.getElementById('registrarReciboModal');
    const reciboForm = document.getElementById('reciboForm');
    const mesesARegistrarContainer = document.getElementById('mesesARegistrar');
    const confirmarMesesBtn = document.getElementById('confirmarMesesBtn');
    const detalleReciboForm = document.getElementById('detalleReciboForm');
    const detallesPagosContainer = document.getElementById('detallesPagosContainer');
    const nombreServicioSpan = document.getElementById('nombreServicio');

    const verRecibosModal = document.getElementById('verRecibosModal');
    const listaRecibosPorMes = document.getElementById('listaRecibosPorMes');

    const gestionarTiposServicioBtn = document.getElementById('gestionarTiposServicioBtn');
    const tiposServiciosModal = document.getElementById('tiposServiciosModal');
    const tipoServicioForm = document.getElementById('tipoServicioForm');
    const tiposServiciosTableBody = document.getElementById('tiposServiciosTable').querySelector('tbody');
    const agregarTipoServicioBtn = document.getElementById('agregarTipoServicioBtn');

    // Variable para almacenar el ID del servicio seleccionado para recibos
    let servicioSeleccionadoId = null;

    // Array de meses en español
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Mes actual
    const fechaActual = new Date();
    const mesActualIndex = fechaActual.getMonth();
    const mesActualNombre = meses[mesActualIndex];

    // Cargar tipos de servicio desde Firestore
    function cargarTiposServicios() {
        const tiposServiciosRef = collection(db, "tiposServicios");
        const q = query(tiposServiciosRef, orderBy("nombre", "asc"));
        onSnapshot(q, (snapshot) => {
            tiposServicios = [];
            snapshot.forEach((doc) => {
                const tipo = doc.data();
                tipo.id = doc.id;
                tiposServicios.push(tipo);
            });
            actualizarSelectServicios();
            cargarTiposServiciosTabla();
        });
    }

    cargarTiposServicios();

    function actualizarSelectServicios() {
        const servicioSelect = document.getElementById('servicio');
        servicioSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
        tiposServicios.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.nombre;
            option.textContent = tipo.nombre;
            servicioSelect.appendChild(option);
        });

        const filterServicioSelect = document.getElementById('filterServicio');
        filterServicioSelect.innerHTML = '<option value="">Todos los Servicios</option>';
        tiposServicios.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.nombre;
            option.textContent = tipo.nombre;
            filterServicioSelect.appendChild(option);
        });
    }

    function cargarTiposServiciosTabla() {
        tiposServiciosTableBody.innerHTML = "";
        tiposServicios.forEach((tipo) => {
            const fila = document.createElement('tr');
            fila.dataset.id = tipo.id;

            const nombreTd = document.createElement('td');
            nombreTd.textContent = tipo.nombre;

            const accionesTd = document.createElement('td');
            const editarBtn = document.createElement('button');
            editarBtn.textContent = 'Editar';
            editarBtn.classList.add('editar-tipo-btn');
            editarBtn.onclick = () => editarTipoServicio(tipo.id, tipo.nombre);

            const eliminarBtn = document.createElement('button');
            eliminarBtn.textContent = 'Eliminar';
            eliminarBtn.classList.add('eliminar-tipo-btn');
            eliminarBtn.onclick = () => eliminarTipoServicio(tipo.id, tipo.nombre);

            accionesTd.appendChild(editarBtn);
            accionesTd.appendChild(eliminarBtn);

            fila.appendChild(nombreTd);
            fila.appendChild(accionesTd);

            tiposServiciosTableBody.appendChild(fila);
        });
    }

    gestionarTiposServicioBtn.addEventListener('click', function() {
        tiposServiciosModal.style.display = 'block';
    });

    window.cerrarTiposServiciosModal = function() {
        tiposServiciosModal.style.display = 'none';
        tipoServicioForm.reset();
    };

    tipoServicioForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nuevoTipo = document.getElementById('nuevoTipoServicio').value.trim();

        if (!nuevoTipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, ingresa un nombre para el tipo de servicio.',
            });
            return;
        }

        const existe = tiposServicios.some(tipo => tipo.nombre.toLowerCase() === nuevoTipo.toLowerCase());
        if (existe) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Este tipo de servicio ya existe.',
            });
            return;
        }

        try {
            await addDoc(collection(db, "tiposServicios"), { nombre: nuevoTipo });
            Swal.fire({
                icon: 'success',
                title: 'Añadido',
                text: 'El tipo de servicio ha sido agregado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
            tipoServicioForm.reset();
        } catch (error) {
            console.error("Error al agregar tipo de servicio: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al agregar el tipo de servicio.',
            });
        }
    });

    async function editarTipoServicio(id, nombreActual) {
        const { value: nuevoNombre } = await Swal.fire({
            title: `Editar Tipo de Servicio`,
            input: 'text',
            inputLabel: 'Nuevo Nombre',
            inputValue: nombreActual,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value.trim()) {
                    return 'El nombre no puede estar vacío!';
                }
                if (tiposServicios.some(tipo => tipo.nombre.toLowerCase() === value.trim().toLowerCase() && tipo.id !== id)) {
                    return 'Este tipo de servicio ya existe.';
                }
                return null;
            }
        });

        if (nuevoNombre) {
            try {
                const tipoRef = doc(db, "tiposServicios", id);
                await updateDoc(tipoRef, { nombre: nuevoNombre.trim() });
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'El tipo de servicio ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error("Error al editar tipo de servicio: ", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al editar el tipo de servicio.',
                });
            }
        }
    }

    async function eliminarTipoServicio(id, nombre) {
        const serviciosAsociados = servicios.some(servicio => servicio.servicio === nombre);
        if (serviciosAsociados) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se puede eliminar este tipo de servicio porque está asociado a uno o más servicios.',
            });
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: `Eliminar Tipo de Servicio`,
            text: `¿Estás seguro de eliminar el tipo de servicio "${nombre}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            try {
                const tipoRef = doc(db, "tiposServicios", id);
                await deleteDoc(tipoRef);
                Swal.fire({
                    icon: 'success',
                    title: 'Eliminado',
                    text: 'El tipo de servicio ha sido eliminado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error("Error al eliminar tipo de servicio: ", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al eliminar el tipo de servicio.',
                });
            }
        }
    }

    function cargarServicios() {
        const serviciosRef = collection(db, "servicios");
        onSnapshot(serviciosRef, (snapshot) => {
            servicios = [];
            snapshot.forEach((docu) => {
                const servicio = docu.data();
                servicio.id = docu.id;
                servicios.push(servicio);
            });
            actualizarTabla();
        });
    }

    cargarServicios();

    yearSelector.addEventListener('change', function() {
        yearSelected = parseInt(this.value, 10);
        if (isNaN(yearSelected) || yearSelected < 2000 || yearSelected > 2100) {
            Swal.fire({
                icon: 'error',
                title: 'Año inválido',
                text: 'Por favor, ingresa un año válido entre 2000 y 2100.',
            });
            this.value = new Date().getFullYear();
            yearSelected = parseInt(this.value, 10);
        }
        actualizarTabla();
    });

    window.abrirModal = function(index = null) {
        editarIndex = index;
        const modal = document.getElementById('servicioModal');
        const form = document.getElementById('servicioForm');
        form.reset();
        tipoPagoFijoFields.style.display = 'none';

        if (index !== null) {
            const servicio = servicios[index];
            document.getElementById('modalTitle').innerText = 'Editar Servicio';
            document.getElementById('sucursal').value = servicio.sucursal;
            document.getElementById('servicio').value = servicio.servicio;
            document.getElementById('ubicacion').value = servicio.ubicacion || '';
            document.getElementById('tipoPago').value = servicio.tipoPago;
            document.getElementById('proveedorServicio').value = servicio.proveedorServicio || '';

            if (servicio.tipoPago === 'Fijo') {
                tipoPagoFijoFields.style.display = 'block';
                document.getElementById('fechaPagoFijo').value = servicio.fechaPago || '';
                document.getElementById('montoAPagar').value = servicio.montoAPagar || '';
            }

            if (servicio.lapsoPago) {
                document.getElementById('lapsoPagoDesde').value = servicio.lapsoPago.desde;
                document.getElementById('lapsoPagoHasta').value = servicio.lapsoPago.hasta;
            }
        } else {
            document.getElementById('modalTitle').innerText = 'Agregar Servicio';
        }

        modal.style.display = 'block';
    };

    tipoPagoSelect.addEventListener('change', function() {
        if (this.value === 'Fijo') {
            tipoPagoFijoFields.style.display = 'block';
            document.getElementById('fechaPagoFijo').required = true;
            document.getElementById('montoAPagar').required = true;
        } else {
            tipoPagoFijoFields.style.display = 'none';
            document.getElementById('fechaPagoFijo').required = false;
            document.getElementById('montoAPagar').required = false;
            document.getElementById('fechaPagoFijo').value = '';
            document.getElementById('montoAPagar').value = '';
        }
    });

    window.cerrarModal = function() {
        document.getElementById('servicioModal').style.display = 'none';
    };

    document.getElementById('servicioForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const sucursal = document.getElementById('sucursal').value.trim();
        const servicioNombre = document.getElementById('servicio').value.trim();
        const ubicacion = document.getElementById('ubicacion').value.trim();
        const tipoPago = document.getElementById('tipoPago').value;
        const fechaPagoFijo = document.getElementById('fechaPagoFijo').value;
        const montoAPagar = parseFloat(document.getElementById('montoAPagar').value);
        const proveedorServicio = document.getElementById('proveedorServicio').value.trim();

        const lapsoPagoDesde = parseInt(document.getElementById('lapsoPagoDesde').value, 10);
        const lapsoPagoHasta = parseInt(document.getElementById('lapsoPagoHasta').value, 10);

        if (
            isNaN(lapsoPagoDesde) || isNaN(lapsoPagoHasta) ||
            lapsoPagoDesde < 1 || lapsoPagoDesde > 31 ||
            lapsoPagoHasta < 1 || lapsoPagoHasta > 31
        ) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, ingresa días válidos para el lapso de pago (entre 1 y 31).',
            });
            return;
        }

        if (lapsoPagoDesde > lapsoPagoHasta) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El día "Desde" no puede ser mayor que el día "Hasta".',
            });
            return;
        }

        if (!sucursal || !servicioNombre || !ubicacion || !tipoPago || !proveedorServicio ||
            (tipoPago === 'Fijo' && (!fechaPagoFijo || isNaN(montoAPagar) || montoAPagar < 0))) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, completa todos los campos requeridos correctamente.',
            });
            return;
        }

        const servicioData = {
            sucursal,
            servicio: servicioNombre,
            ubicacion,
            tipoPago,
            fechaPago: tipoPago === 'Fijo' ? fechaPagoFijo : '',
            montoAPagar: tipoPago === 'Fijo' ? montoAPagar : 0,
            proveedorServicio,
            estadoPago: 'Pendiente',
            historialPagos: [],
            mesesPagados: [],
            lapsoPago: {
                desde: lapsoPagoDesde,
                hasta: lapsoPagoHasta
            },
            fechaCreacion: new Date().toISOString()
        };

        try {
            if (editarIndex !== null) {
                const servicioActualizado = {
                    ...servicios[editarIndex],
                    ...servicioData
                };
                const servicioRef = doc(db, "servicios", servicioActualizado.id);
                await updateDoc(servicioRef, servicioActualizado);

                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'El servicio ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                await addDoc(collection(db, "servicios"), servicioData);

                Swal.fire({
                    icon: 'success',
                    title: 'Añadido',
                    text: 'El servicio ha sido agregado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            cerrarModal();
        } catch (error) {
            console.error("Error al guardar el servicio: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al guardar el servicio.',
            });
        }
    });

    function actualizarTabla() {
        servicioTable.innerHTML = "";
        let serviciosFiltrados = servicios.slice();
        serviciosFiltrados = serviciosFiltrados.filter(servicio => filtrarServicio(servicio));

        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'fechaPagoAsc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(a.fechaPago) - new Date(b.fechaPago);
            });
        } else if (sortOrder === 'fechaPagoDesc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(b.fechaPago) - new Date(a.fechaPago);
            });
        } else if (sortOrder === 'fechaCreacionDesc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(b.fechaCreacion || '1970-01-01') - new Date(a.fechaCreacion || '1970-01-01');
            });
        } else if (sortOrder === 'fechaCreacionAsc') {
            serviciosFiltrados.sort((a, b) => {
                return new Date(a.fechaCreacion || '9999-12-31') - new Date(b.fechaCreacion || '9999-12-31');
            });
        }

        serviciosFiltrados.forEach((servicio, index) => {
            const fila = document.createElement("tr");
            fila.dataset.index = index;
            fila.dataset.id = servicio.id;

            let estadoPagoActual = 'Pendiente';
            const recibosMesActual = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mesActualNombre && pago.anio === yearSelected) : [];
            if (recibosMesActual.length > 0) {
                const todosPagados = recibosMesActual.every(pago => pago.estadoPago === 'Pagado');
                estadoPagoActual = todosPagados ? 'Pagado' : 'Pendiente';
            }

            const sucursalTd = document.createElement('td');
            sucursalTd.textContent = servicio.sucursal;

            const servicioTd = document.createElement('td');
            servicioTd.textContent = servicio.servicio;

            const proveedorTd = document.createElement('td');
            proveedorTd.textContent = servicio.proveedorServicio;

            const ubicacionTd = document.createElement('td');
            ubicacionTd.textContent = servicio.ubicacion;

            const tipoPagoTd = document.createElement('td');
            tipoPagoTd.textContent = servicio.tipoPago;

            const estadoPagoTd = document.createElement('td');
            estadoPagoTd.textContent = estadoPagoActual;

            const lapsoPagoTd = document.createElement('td');
            if (servicio.lapsoPago && servicio.lapsoPago.desde && servicio.lapsoPago.hasta) {
                lapsoPagoTd.textContent = `Del día ${servicio.lapsoPago.desde} al ${servicio.lapsoPago.hasta}`;
            } else {
                lapsoPagoTd.textContent = '-';
            }

            const mesesTd = meses.map(mes => {
                const recibosDelMes = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mes && pago.anio === yearSelected) : [];
                let simbolo = '×';
                let bgColor = 'status-none';

                if (recibosDelMes.length > 0) {
                    const todosPagados = recibosDelMes.every(pago => pago.estadoPago === 'Pagado');
                    if (todosPagados) {
                        simbolo = '✓';
                        bgColor = 'status-paid';
                    } else {
                        simbolo = '⚠';
                        bgColor = 'status-pending';
                    }
                }

                const td = document.createElement('td');
                td.textContent = simbolo;
                td.classList.add(bgColor);
                return td;
            });

            const accionesTd = document.createElement('td');
            const verRecibosBtn = `<button class="ver-recibos-btn" onclick="abrirVerRecibosModal('${servicio.id}')">Ver Recibos</button>`;
            const registrarReciboBtn = `<button class="registrar-recibo-btn" onclick="abrirRegistrarReciboModal('${servicio.id}')">Registrar Recibo</button>`;
            accionesTd.innerHTML = `${verRecibosBtn} ${registrarReciboBtn}`;

            fila.appendChild(sucursalTd);
            fila.appendChild(servicioTd);
            fila.appendChild(proveedorTd);
            fila.appendChild(ubicacionTd);
            fila.appendChild(tipoPagoTd);
            fila.appendChild(estadoPagoTd);
            fila.appendChild(lapsoPagoTd);
            mesesTd.forEach(td => fila.appendChild(td));
            fila.appendChild(accionesTd);

            fila.addEventListener('click', function(e) {
                if (e.target.classList.contains('ver-recibos-btn') || e.target.classList.contains('registrar-recibo-btn')) {
                    return;
                }
                seleccionarFila(this, servicios.indexOf(servicio));
            });

            servicioTable.appendChild(fila);
        });

        if (filaSeleccionada) {
            const seleccionadaVisible = Array.from(servicioTable.children).some(fila => parseInt(fila.dataset.index) === parseInt(filaSeleccionada.dataset.index));
            if (!seleccionadaVisible) {
                filaSeleccionada = null;
                editarBtn.disabled = true;
                eliminarBtn.disabled = true;
            }
        }
    }

    function filtrarServicio(servicio) {
        const filtroSucursal = filterSucursal.value;
        const filtroServicio = filterServicio.value;
        const filtroEstadoPago = filterEstadoPago.value;
        const filtroFechaDesde = filterFechaDesde.value;
        const filtroFechaHasta = filterFechaHasta.value;
        const searchTerm = searchInput.value.toLowerCase();

        let cumple = true;

        if (filtroSucursal && servicio.sucursal !== filtroSucursal) {
            cumple = false;
        }

        if (filtroServicio && servicio.servicio !== filtroServicio) {
            cumple = false;
        }

        if (filtroEstadoPago) {
            let estadoPagoActual = 'Pendiente';
            const recibosAnio = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.anio === yearSelected) : [];
            if (recibosAnio.length > 0) {
                const todosPagados = recibosAnio.every(pago => pago.estadoPago === 'Pagado');
                estadoPagoActual = todosPagados ? 'Pagado' : 'Pendiente';
            }
            if (estadoPagoActual !== filtroEstadoPago) {
                cumple = false;
            }
        }

        if (filtroFechaDesde && servicio.fechaPago < filtroFechaDesde) {
            cumple = false;
        }

        if (filtroFechaHasta && servicio.fechaPago > filtroFechaHasta) {
            cumple = false;
        }

        if (searchTerm) {
            const contiene = servicio.sucursal.toLowerCase().includes(searchTerm) ||
                servicio.servicio.toLowerCase().includes(searchTerm) ||
                servicio.ubicacion.toLowerCase().includes(searchTerm) ||
                servicio.tipoPago.toLowerCase().includes(searchTerm) ||
                servicio.proveedorServicio.toLowerCase().includes(searchTerm) ||
                (servicio.fechaPago || '').toLowerCase().includes(searchTerm) ||
                (servicio.montoAPagar && (`Q. ${servicio.montoAPagar.toFixed(2)}`).includes(searchTerm)) ||
                (servicio.estadoPago || '').toLowerCase().includes(searchTerm);
            if (!contiene) {
                cumple = false;
            }
        }

        return cumple;
    }

    function seleccionarFila(fila, index) {
        if (filaSeleccionada) {
            filaSeleccionada.classList.remove('selected');
        }

        fila.classList.add('selected');
        filaSeleccionada = fila;

        editarBtn.disabled = false;
        eliminarBtn.disabled = false;

        filaSeleccionada.dataset.index = index;
    }

    editarBtn.addEventListener('click', function() {
        if (filaSeleccionada) {
            const index = parseInt(filaSeleccionada.dataset.index, 10);
            abrirModal(index);
        }
    });

    eliminarBtn.addEventListener('click', function() {
        if (filaSeleccionada) {
            const index = parseInt(filaSeleccionada.dataset.index, 10);
            Swal.fire({
                title: '¿Estás seguro?',
                text: "¡No podrás revertir esto!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const servicio = servicios[index];
                    const servicioRef = doc(db, "servicios", servicio.id);
                    await deleteDoc(servicioRef);

                    filaSeleccionada = null;
                    editarBtn.disabled = true;
                    eliminarBtn.disabled = true;

                    Swal.fire(
                        'Eliminado!',
                        'El servicio ha sido eliminado.',
                        'success'
                    );
                }
            });
        }
    });

    window.abrirRegistrarReciboModal = function(servicioId) {
        const modal = document.getElementById('registrarReciboModal');
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        servicioSeleccionadoId = servicioId;
        nombreServicioSpan.innerText = `${servicio.servicio} - ${servicio.sucursal}`;
        generarChecklistMeses(servicioId);
        modal.style.display = 'block';
    };

    function generarChecklistMeses(servicioId) {
        mesesARegistrarContainer.innerHTML = "";
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) return;

        meses.forEach((mes, idx) => {
            const checkboxId = `mesARegistrar${idx}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.value = mes;

            const yaRegistrado = servicio.historialPagos && servicio.historialPagos.some(pago => pago.mes === mes && pago.anio === yearSelected);
            if (yaRegistrado) {
                checkbox.disabled = true;
            }

            const label = document.createElement('label');
            label.htmlFor = checkboxId;
            label.innerText = mes;

            const wrapper = document.createElement('div');
            wrapper.classList.add('checkbox-wrapper');
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);

            mesesARegistrarContainer.appendChild(wrapper);
        });
    }

    confirmarMesesBtn.addEventListener('click', function() {
        const checkboxes = mesesARegistrarContainer.querySelectorAll('input[type="checkbox"]');
        const mesesSeleccionados = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                mesesSeleccionados.push(cb.value);
            }
        });

        if (mesesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un mes.',
            });
            return;
        }

        detallesPagosContainer.innerHTML = "";
        mesesSeleccionados.forEach((mes, idx) => {
            const detalleDiv = document.createElement('div');
            detalleDiv.classList.add('detalle-pago');

            detalleDiv.innerHTML = `
                <h4>${mes} ${yearSelected}</h4>
                <label for="numeroRecibo${idx}">Número de Recibo:</label>
                <input type="text" id="numeroRecibo${idx}" required>

                <label for="fechaPago${idx}">Fecha de Pago:</label>
                <input type="date" id="fechaPago${idx}" required>

                <label for="cantidadAPagar${idx}">Cantidad a Pagar (Q.):</label>
                <input type="number" id="cantidadAPagar${idx}" min="0" step="0.01" required>
            `;

            detallesPagosContainer.appendChild(detalleDiv);
        });

        detalleReciboForm.style.display = 'block';
    });

    detalleReciboForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!servicioSeleccionadoId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no seleccionado.',
            });
            return;
        }

        const servicio = servicios.find(s => s.id === servicioSeleccionadoId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        const checkboxes = mesesARegistrarContainer.querySelectorAll('input[type="checkbox"]');
        const mesesSeleccionados = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                mesesSeleccionados.push(cb.value);
            }
        });

        const nuevosPagos = [];
        for (let i = 0; i < mesesSeleccionados.length; i++) {
            const mes = mesesSeleccionados[i];
            const numeroRecibo = document.getElementById(`numeroRecibo${i}`).value.trim();
            const fechaPago = document.getElementById(`fechaPago${i}`).value;
            const cantidadAPagar = parseFloat(document.getElementById(`cantidadAPagar${i}`).value);

            if (!numeroRecibo || isNaN(cantidadAPagar) || cantidadAPagar < 0 || !fechaPago) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `Por favor, completa todos los campos para el mes de ${mes}.`,
                });
                return;
            }

            const existeRecibo = servicio.historialPagos && servicio.historialPagos.some(pago => pago.numeroRecibo === numeroRecibo && pago.anio === yearSelected);
            if (existeRecibo) {
                Swal.fire({
                    icon: 'error',
                    title: 'Recibo Duplicado',
                    text: `Ya existe un recibo con el número "${numeroRecibo}" para ${mes} ${yearSelected}.`,
                });
                return;
            }

            nuevosPagos.push({
                mes,
                anio: yearSelected,
                numeroRecibo,
                fechaPago,
                cantidadAPagar,
                estadoPago: 'Pendiente',
                boletaPago: null
            });
        }

        Swal.fire({
            title: 'Confirmar Registro de Recibos',
            html: generarHTMLConfirmacionRecibos(nuevosPagos),
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            width: '600px'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const historialPagosActualizado = servicio.historialPagos ? [...servicio.historialPagos, ...nuevosPagos] : [...nuevosPagos];
                const mesesPagadosActualizados = servicio.mesesPagados ? [...new Set([...servicio.mesesPagados, ...mesesSeleccionados])] : [...mesesSeleccionados];
                const estadoPagoActualizado = historialPagosActualizado.length > 0 ? "Pendiente" : "Pendiente";

                const servicioRef = doc(db, "servicios", servicioSeleccionadoId);
                await updateDoc(servicioRef, {
                    historialPagos: historialPagosActualizado,
                    mesesPagados: mesesPagadosActualizados,
                    estadoPago: estadoPagoActualizado
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Recibos Registrados',
                    text: 'Los recibos han sido registrados exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });

                cerrarReciboModal();
            }
        });
    });

    function generarHTMLConfirmacionRecibos(nuevosPagos) {
        let html = '<ul>';
        nuevosPagos.forEach(pago => {
            html += `<li><strong>${pago.mes} ${pago.anio}:</strong> Recibo ${pago.numeroRecibo}, Fecha de Pago: ${new Date(pago.fechaPago).toLocaleDateString('es-ES')}, Cantidad: Q. ${pago.cantidadAPagar.toFixed(2)}</li>`;
        });
        html += '</ul>';
        return html;
    }

    window.cerrarReciboModal = function() {
        registrarReciboModal.style.display = 'none';
        reciboForm.reset();
        detalleReciboForm.style.display = 'none';
        detallesPagosContainer.innerHTML = "";
        nombreServicioSpan.innerText = '-';
        servicioSeleccionadoId = null;
    };

    window.abrirVerRecibosModal = function(servicioId) {
        const modal = document.getElementById('verRecibosModal');
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Servicio no encontrado.',
            });
            return;
        }

        servicioSeleccionadoId = servicioId;
        generarListaRecibosPorMes(servicio);
        modal.style.display = 'block';
    };

    window.cerrarVerRecibosModal = function() {
        verRecibosModal.style.display = 'none';
        listaRecibosPorMes.innerHTML = "";
        servicioSeleccionadoId = null;
    };

    function generarListaRecibosPorMes(servicio) {
        listaRecibosPorMes.innerHTML = "";
        meses.forEach(mes => {
            const recibosDelMes = servicio.historialPagos ? servicio.historialPagos.filter(pago => pago.mes === mes && pago.anio === yearSelected) : [];
            if (recibosDelMes.length > 0) {
                const mesDiv = document.createElement('div');
                mesDiv.classList.add('mes-recibos');

                const mesTitle = document.createElement('h3');
                mesTitle.innerText = `${mes} ${yearSelected}`;
                mesDiv.appendChild(mesTitle);

                recibosDelMes.forEach((recibo) => {
                    const reciboDiv = document.createElement('div');
                    reciboDiv.classList.add('recibo');

                    let boletaInfo = '';
                    if (recibo.boletaPago) {
                        boletaInfo = `
                            <p><strong>Banco:</strong> ${recibo.boletaPago.banco}</p>
                            <p><strong>Número de Boleta:</strong> ${recibo.boletaPago.numeroBoleta}</p>
                            <p><strong>Fecha:</strong> ${new Date(recibo.boletaPago.fecha).toLocaleDateString('es-ES')}</p>
                            <p><strong>Tipo de Pago:</strong> ${recibo.boletaPago.tipoPago}</p>
                            ${
                                recibo.boletaPago.cantidadPagada !== undefined && !isNaN(recibo.boletaPago.cantidadPagada)
                                ? `<p><strong>Cantidad Pagada:</strong> Q. ${parseFloat(recibo.boletaPago.cantidadPagada).toFixed(2)}</p>`
                                : ''
                            }
                        `;
                    }

                    reciboDiv.innerHTML = `
                        <p><strong>Número de Recibo:</strong> ${recibo.numeroRecibo}</p>
                        <p><strong>Fecha de Pago:</strong> ${new Date(recibo.fechaPago).toLocaleDateString('es-ES')}</p>
                        ${
                            recibo.cantidadAPagar !== undefined && !isNaN(recibo.cantidadAPagar)
                            ? `<p><strong>Cantidad a Pagar:</strong> Q. ${parseFloat(recibo.cantidadAPagar).toFixed(2)}</p>`
                            : ''
                        }
                        <p><strong>Estado de Pago:</strong> <span class="${recibo.estadoPago === 'Pagado' ? 'estado-pagado' : 'estado-pendiente'}">${recibo.estadoPago}</span></p>
                        ${boletaInfo}
                    `;

                    const botonesRecibo = document.createElement('div');
                    botonesRecibo.classList.add('botones-recibo');

                    const editarReciboBtn = document.createElement('button');
                    editarReciboBtn.classList.add('editar-recibo-btn');
                    editarReciboBtn.innerText = 'Editar Recibo';
                    editarReciboBtn.onclick = () => editarRecibo(servicio.id, recibo.numeroRecibo);

                    const eliminarReciboBtn = document.createElement('button');
                    eliminarReciboBtn.classList.add('eliminar-recibo-btn');
                    eliminarReciboBtn.innerText = 'Eliminar Recibo';
                    eliminarReciboBtn.onclick = () => eliminarRecibo(servicio.id, recibo.numeroRecibo);

                    botonesRecibo.appendChild(editarReciboBtn);
                    botonesRecibo.appendChild(eliminarReciboBtn);

                    if (recibo.estadoPago === 'Pendiente') {
                        const registrarPagoBtn = document.createElement('button');
                        registrarPagoBtn.classList.add('registrar-pago-btn');
                        registrarPagoBtn.innerText = 'Registrar Pago';
                        registrarPagoBtn.onclick = () => registrarPagoRecibo(servicio.id, recibo.numeroRecibo);
                        botonesRecibo.appendChild(registrarPagoBtn);
                    }

                    reciboDiv.appendChild(botonesRecibo);
                    mesDiv.appendChild(reciboDiv);
                });

                listaRecibosPorMes.appendChild(mesDiv);
            }
        });
    }

    // Listeners para filtros y ordenamiento
    sortOrderSelect.addEventListener('change', actualizarTabla);
    searchInput.addEventListener('input', actualizarTabla);
    filterSucursal.addEventListener('change', actualizarTabla);
    filterServicio.addEventListener('change', actualizarTabla);
    filterEstadoPago.addEventListener('change', actualizarTabla);
    filterFechaDesde.addEventListener('change', actualizarTabla);
    filterFechaHasta.addEventListener('change', actualizarTabla);

    resetFiltersBtn.addEventListener('click', function() {
        filterSucursal.value = "";
        filterServicio.value = "";
        filterEstadoPago.value = "";
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        searchInput.value = "";
        sortOrderSelect.value = "fechaPagoAsc";
        yearSelector.value = new Date().getFullYear();
        yearSelected = parseInt(yearSelector.value, 10);
        actualizarTabla();
        Swal.fire({
            icon: 'info',
            title: 'Filtros Reseteados',
            text: 'Todos los filtros han sido reseteados.',
            timer: 1500,
            showConfirmButton: false
        });
    });

    window.onclick = function(event) {
        const modal = document.getElementById('servicioModal');
        if (event.target == modal) {
            cerrarModal();
        }

        const reciboModal = document.getElementById('registrarReciboModal');
        if (event.target == reciboModal) {
            cerrarReciboModal();
        }

        const verRecibosModalTarget = document.getElementById('verRecibosModal');
        if (event.target == verRecibosModalTarget) {
            cerrarVerRecibosModal();
        }

        const tiposServiciosModalTarget = document.getElementById('tiposServiciosModal');
        if (event.target == tiposServiciosModalTarget) {
            cerrarTiposServiciosModal();
        }
    };

    // ===================== FUNCIONES PARA EDITAR/ELIMINAR/REGISTRAR PAGO DE RECIBOS =====================

    window.editarRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Servicio no encontrado.' });
            return;
        }

        const recibo = servicio.historialPagos.find(r => r.numeroRecibo === numeroRecibo && r.anio === yearSelected);
        if (!recibo) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Recibo no encontrado.' });
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Editar Recibo',
            html:
                `<label>Número de Recibo:</label><input id="swal-input-numero" class="swal2-input" value="${recibo.numeroRecibo}">` +
                `<label>Fecha de Pago:</label><input id="swal-input-fecha" type="date" class="swal2-input" value="${recibo.fechaPago}">` +
                `<label>Cantidad a Pagar (Q.):</label><input id="swal-input-cantidad" type="number" class="swal2-input" min="0" step="0.01" value="${recibo.cantidadAPagar}">`,
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                const numero = document.getElementById('swal-input-numero').value.trim();
                const fecha = document.getElementById('swal-input-fecha').value;
                const cantidad = parseFloat(document.getElementById('swal-input-cantidad').value);
                if (!numero || !fecha || isNaN(cantidad) || cantidad < 0) {
                    Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
                    return false;
                }
                return { numero, fecha, cantidad };
            }
        });

        if (formValues) {
            const { numero, fecha, cantidad } = formValues;

            if (numero !== recibo.numeroRecibo) {
                const existeOtro = servicio.historialPagos.some(r => r.numeroRecibo === numero && r.anio === yearSelected && r.numeroRecibo !== recibo.numeroRecibo);
                if (existeOtro) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Recibo Duplicado',
                        text: `Ya existe un recibo con el número "${numero}" en ${yearSelected}.`,
                    });
                    return;
                }
            }

            const indice = servicio.historialPagos.findIndex(r => r.numeroRecibo === numeroRecibo && r.anio === yearSelected);
            if (indice >= 0) {
                servicio.historialPagos[indice].numeroRecibo = numero;
                servicio.historialPagos[indice].fechaPago = fecha;
                servicio.historialPagos[indice].cantidadAPagar = cantidad;
            }

            const servicioRef = doc(db, "servicios", servicioId);
            await updateDoc(servicioRef, {
                historialPagos: servicio.historialPagos
            });

            Swal.fire({
                icon: 'success',
                title: 'Recibo Actualizado',
                text: 'El recibo ha sido actualizado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

            generarListaRecibosPorMes(servicio);
        }
    };

    window.eliminarRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Servicio no encontrado.' });
            return;
        }

        const indice = servicio.historialPagos.findIndex(r => r.numeroRecibo === numeroRecibo && r.anio === yearSelected);
        if (indice < 0) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Recibo no encontrado.' });
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Eliminar Recibo',
            text: `¿Estás seguro de eliminar el recibo ${numeroRecibo}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            servicio.historialPagos.splice(indice, 1);

            const servicioRef = doc(db, "servicios", servicioId);
            await updateDoc(servicioRef, {
                historialPagos: servicio.historialPagos
            });

            Swal.fire({
                icon: 'success',
                title: 'Recibo Eliminado',
                text: 'El recibo ha sido eliminado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

            generarListaRecibosPorMes(servicio);
        }
    };

    window.registrarPagoRecibo = async function(servicioId, numeroRecibo) {
        const servicio = servicios.find(s => s.id === servicioId);
        if (!servicio) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Servicio no encontrado.' });
            return;
        }

        const recibo = servicio.historialPagos.find(r => r.numeroRecibo === numeroRecibo && r.anio === yearSelected);
        if (!recibo) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Recibo no encontrado.' });
            return;
        }

        // Primero preguntamos el tipo de pago
        const { value: tipoPagoSeleccionado } = await Swal.fire({
            title: 'Tipo de Pago',
            input: 'select',
            inputOptions: {
                'Efectivo': 'Efectivo',
                'Transferencia': 'Transferencia',
                'Depósito': 'Depósito'
            },
            inputPlaceholder: 'Selecciona un tipo de pago',
            showCancelButton: true,
            confirmButtonText: 'Siguiente',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value) {
                    return 'Por favor selecciona un tipo de pago'
                }
            }
        });

        if (!tipoPagoSeleccionado) {
            return; // El usuario canceló
        }

        if (tipoPagoSeleccionado === 'Efectivo') {
            // Si es efectivo, solo marcamos como pagado sin pedir más datos
            recibo.boletaPago = null;
            recibo.estadoPago = 'Pagado';

            const servicioRef = doc(db, "servicios", servicioId);
            await updateDoc(servicioRef, {
                historialPagos: servicio.historialPagos
            });

            Swal.fire({
                icon: 'success',
                title: 'Pago Registrado',
                text: 'El pago en efectivo ha sido registrado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

            generarListaRecibosPorMes(servicio);
        } else {
            // Si es Transferencia o Depósito, pedimos los datos
            const { value: formValues } = await Swal.fire({
                title: `Registrar Pago por ${tipoPagoSeleccionado}`,
                html:
                    `<label>Banco:</label><input id="swal-input-banco" class="swal2-input">` +
                    `<label>Número de Boleta:</label><input id="swal-input-boleta" class="swal2-input">` +
                    `<label>Fecha de Boleta:</label><input id="swal-input-fecha" type="date" class="swal2-input">` +
                    `<label>Cantidad Pagada (Q.):</label><input id="swal-input-cantidad" type="number" min="0" step="0.01" class="swal2-input">`,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Registrar Pago',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const banco = document.getElementById('swal-input-banco').value.trim();
                    const boleta = document.getElementById('swal-input-boleta').value.trim();
                    const fecha = document.getElementById('swal-input-fecha').value;
                    const cantidadPagada = parseFloat(document.getElementById('swal-input-cantidad').value);

                    if (!banco || !boleta || !fecha || isNaN(cantidadPagada) || cantidadPagada < 0) {
                        Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
                        return false;
                    }

                    return { banco, boleta, fecha, cantidadPagada };
                }
            });

            if (formValues) {
                const { banco, boleta, fecha, cantidadPagada } = formValues;

                recibo.boletaPago = {
                    banco,
                    numeroBoleta: boleta,
                    fecha,
                    tipoPago: tipoPagoSeleccionado,
                    cantidadPagada
                };
                recibo.estadoPago = 'Pagado';

                const servicioRef = doc(db, "servicios", servicioId);
                await updateDoc(servicioRef, {
                    historialPagos: servicio.historialPagos
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Pago Registrado',
                    text: `El pago por ${tipoPagoSeleccionado.toLowerCase()} ha sido registrado exitosamente.`,
                    timer: 1500,
                    showConfirmButton: false
                });

                generarListaRecibosPorMes(servicio);
            }
        }
    };
});
