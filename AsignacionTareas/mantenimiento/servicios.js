// servicios.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Configuración de Firebase (Reemplaza con tus propias credenciales)
const firebaseConfig = {
    apiKey: "AIzaSyCc_XNSGWjrl8eOmOvbSpxvsmgoLunI_pk",
    authDomain: "tareasdb-193f4.firebaseapp.com",
    projectId: "tareasdb-193f4",
    storageBucket: "tareasdb-193f4.appspot.com",
    messagingSenderId: "654977996103",
    appId: "1:654977996103:web:9c246d4d16c1d3c943e862"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales
let equipos = [];
let editarIndex = null;
let filaSeleccionada = null;
let equipoSeleccionadoId = null;

// Elementos del DOM
const equipoTableBody = document.getElementById("servicioTable").querySelector("tbody");
const searchInput = document.getElementById('searchInput');
const editarBtn = document.getElementById('editarBtn');
const eliminarBtn = document.getElementById('eliminarBtn');

const filterSucursal = document.getElementById('filterSucursal');
const filterEstadoPago = document.getElementById('filterEstadoPago');
const filterFechaDesde = document.getElementById('filterFechaDesde');
const filterFechaHasta = document.getElementById('filterFechaHasta');
const sortOrderSelect = document.getElementById('sortOrder');
const resetFiltersBtn = document.getElementById('resetFilters');

const tipoPagoSelect = document.getElementById('tipoPago');
const tipoPagoFijoFields = document.getElementById('tipoPagoFijoFields');

const yearSelector = document.getElementById('yearSelector');
let yearSelected = new Date().getFullYear(); // Año actual por defecto
yearSelector.value = yearSelected;

// Modales
const servicioModal = document.getElementById('servicioModal');
const servicioForm = document.getElementById('servicioForm');

const registrarReciboModal = document.getElementById('registrarReciboModal');
const reciboForm = document.getElementById('reciboForm');
const diasARegistrarInput = document.getElementById('diasARegistrar');
const confirmarDiasBtn = document.getElementById('confirmarDiasBtn');
const detalleReciboForm = document.getElementById('detalleReciboForm');
const detallesPagosContainer = document.getElementById('detallesPagosContainer');
const nombreEquipoSpan = document.getElementById('nombreEquipo');

const verRecibosModal = document.getElementById('verRecibosModal');
const listaRecibos = document.getElementById('listaRecibos');

const tiposServiciosModal = document.getElementById('tiposServiciosModal');
const tipoServicioForm = document.getElementById('tipoServicioForm');
const tiposServiciosTableBody = document.getElementById('tiposServiciosTable').querySelector('tbody');

// Array de meses en español
const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Evento cuando el documento está listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar equipos desde Firestore
    cargarEquipos();

    // Abrir el modal para Agregar/Editar Equipo
    window.abrirModal = function(index = null) {
        editarIndex = index;
        servicioForm.reset();
        tipoPagoFijoFields.style.display = 'none';

        if (index !== null) {
            // Modo edición
            const equipo = equipos[index];
            document.getElementById('modalTitle').innerText = 'Editar Equipo';
            document.getElementById('sucursal').value = equipo.sucursal;
            document.getElementById('equipo').value = equipo.equipo;
            document.getElementById('ubicacion').value = equipo.ubicacion || '';
            document.getElementById('tipoPago').value = equipo.tipoPago;
            document.getElementById('proveedorServicio').value = equipo.proveedorServicio || '';
            document.getElementById('contactoProveedor').value = equipo.contactoProveedor || '';
            document.getElementById('diasFrecuencia').value = equipo.diasFrecuencia || '';

            // Mostrar campos de Pago Fijo si es necesario
            if (equipo.tipoPago === 'Fijo') {
                tipoPagoFijoFields.style.display = 'block';
                document.getElementById('fechaPagoFijo').value = equipo.fechaPagoFijo || '';
                document.getElementById('montoAPagar').value = equipo.montoAPagar || '';
            }
        } else {
            // Modo agregar
            document.getElementById('modalTitle').innerText = 'Agregar Equipo';
        }

        servicioModal.style.display = 'block';
    };

    // Mostrar/Ocultar campos según Tipo de Pago
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

    // Cerrar el modal de Agregar/Editar Equipo
    window.cerrarModal = function() {
        servicioModal.style.display = 'none';
    };

    // Manejar el formulario de Agregar/Editar Equipo
    servicioForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Obtener datos del formulario
        const sucursal = document.getElementById('sucursal').value.trim();
        const equipoNombre = document.getElementById('equipo').value.trim();
        const ubicacion = document.getElementById('ubicacion').value.trim();
        const tipoPago = document.getElementById('tipoPago').value;
        const fechaPagoFijo = document.getElementById('fechaPagoFijo').value;
        const montoAPagar = parseFloat(document.getElementById('montoAPagar').value);
        const proveedorServicio = document.getElementById('proveedorServicio').value.trim();
        const contactoProveedor = document.getElementById('contactoProveedor').value.trim();
        const diasFrecuencia = parseInt(document.getElementById('diasFrecuencia').value, 10);

        // Validaciones
        if (
            !sucursal || !equipoNombre || !ubicacion || !tipoPago || !proveedorServicio ||
            !contactoProveedor || isNaN(diasFrecuencia) || diasFrecuencia < 1 ||
            (tipoPago === 'Fijo' && (!fechaPagoFijo || isNaN(montoAPagar) || montoAPagar < 0))
        ) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, completa todos los campos requeridos correctamente.',
            });
            return;
        }

        // Preparar objeto del equipo
        const equipoData = {
            sucursal,
            equipo: equipoNombre,
            ubicacion,
            tipoPago,
            fechaPagoFijo: tipoPago === 'Fijo' ? fechaPagoFijo : '',
            montoAPagar: tipoPago === 'Fijo' ? montoAPagar : 0,
            proveedorServicio,
            contactoProveedor,
            diasFrecuencia,
            historialMantenimientos: [],
            comentarios: [],
            fechaCreacion: new Date().toISOString()
        };

        try {
            if (editarIndex !== null) {
                // Actualizar equipo existente
                const equipoActualizado = {
                    ...equipos[editarIndex],
                    ...equipoData
                };
                const equipoRef = doc(db, "equipos", equipoActualizado.id);
                await updateDoc(equipoRef, equipoActualizado);

                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'El equipo ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                // Agregar nuevo equipo
                await addDoc(collection(db, "equipos"), equipoData);

                Swal.fire({
                    icon: 'success',
                    title: 'Añadido',
                    text: 'El equipo ha sido agregado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

            cerrarModal();
        } catch (error) {
            console.error("Error al guardar el equipo: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al guardar el equipo.',
            });
        }
    });

    // Cargar equipos desde Firestore
    function cargarEquipos() {
        const equiposRef = collection(db, "equipos");
        const q = query(equiposRef, orderBy("fechaCreacion", "desc"));
        onSnapshot(q, (snapshot) => {
            equipos = [];
            snapshot.forEach((doc) => {
                const equipo = doc.data();
                equipo.id = doc.id;
                equipos.push(equipo);
            });
            actualizarTabla();
        });
    }

    // Actualizar la tabla con los equipos
    function actualizarTabla() {
        equipoTableBody.innerHTML = "";

        // Aplicar filtros y ordenamiento
        let equiposFiltrados = equipos.slice();

        // Aplicar filtros
        equiposFiltrados = equiposFiltrados.filter(equipo => filtrarEquipo(equipo));

        // Ordenar equipos
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'fechaMantenimientoAsc') {
            equiposFiltrados.sort((a, b) => {
                const nextMantenimientoA = obtenerProximoMantenimiento(a);
                const nextMantenimientoB = obtenerProximoMantenimiento(b);
                return new Date(nextMantenimientoA.fechaMantenimiento) - new Date(nextMantenimientoB.fechaMantenimiento);
            });
        } else if (sortOrder === 'fechaMantenimientoDesc') {
            equiposFiltrados.sort((a, b) => {
                const nextMantenimientoA = obtenerProximoMantenimiento(a);
                const nextMantenimientoB = obtenerProximoMantenimiento(b);
                return new Date(nextMantenimientoB.fechaMantenimiento) - new Date(nextMantenimientoA.fechaMantenimiento);
            });
        } else if (sortOrder === 'fechaCreacionDesc') {
            equiposFiltrados.sort((a, b) => {
                return new Date(b.fechaCreacion || '1970-01-01') - new Date(a.fechaCreacion || '1970-01-01');
            });
        } else if (sortOrder === 'fechaCreacionAsc') {
            equiposFiltrados.sort((a, b) => {
                return new Date(a.fechaCreacion || '9999-12-31') - new Date(b.fechaCreacion || '9999-12-31');
            });
        }

        // Recorrer los equipos filtrados y crear filas en la tabla
        equiposFiltrados.forEach((equipo, index) => {
            const fila = document.createElement("tr");
            fila.dataset.index = index;
            fila.dataset.id = equipo.id;

            // Estado de Pago actual
            let estadoPagoActual = 'Pendiente';
            const mantenimientosPendientes = equipo.historialMantenimientos ? equipo.historialMantenimientos.filter(mantenimiento => mantenimiento.estadoPago === 'Pendiente') : [];
            if (mantenimientosPendientes.length === 0 && equipo.historialMantenimientos.length > 0) {
                estadoPagoActual = 'Completado';
            }

            // Crear celdas
            const sucursalTd = document.createElement('td');
            sucursalTd.textContent = equipo.sucursal;

            const equipoTd = document.createElement('td');
            equipoTd.textContent = equipo.equipo;

            const proveedorTd = document.createElement('td');
            proveedorTd.textContent = equipo.proveedorServicio;

            const contactoProveedorTd = document.createElement('td');
            contactoProveedorTd.textContent = equipo.contactoProveedor;

            const ubicacionTd = document.createElement('td');
            ubicacionTd.textContent = equipo.ubicacion;

            const tipoPagoTd = document.createElement('td');
            tipoPagoTd.textContent = equipo.tipoPago;

            const diasFrecuenciaTd = document.createElement('td');
            diasFrecuenciaTd.textContent = `Cada ${equipo.diasFrecuencia} días`;

            // Botones de Acción
            const accionesTd = document.createElement('td');
            const verMantenimientosBtn = `<button class="ver-recibos-btn" onclick="abrirVerRecibosModal('${equipo.id}')">Ver Mantenimientos</button>`;
            const programarMantenimientoBtn = `<button class="registrar-recibo-btn" onclick="abrirRegistrarReciboModal('${equipo.id}')">Programar Mantenimiento</button>`;
            accionesTd.innerHTML = `${verMantenimientosBtn} ${programarMantenimientoBtn}`;

            // Agregar todas las celdas a la fila
            fila.appendChild(sucursalTd);
            fila.appendChild(equipoTd);
            fila.appendChild(proveedorTd);
            fila.appendChild(contactoProveedorTd);
            fila.appendChild(ubicacionTd);
            fila.appendChild(tipoPagoTd);
            fila.appendChild(diasFrecuenciaTd);
            fila.appendChild(accionesTd);

            // Evento de selección de fila
            fila.addEventListener('click', function(e) {
                if (e.target.classList.contains('ver-recibos-btn') || e.target.classList.contains('registrar-recibo-btn')) {
                    return;
                }
                seleccionarFila(this, equipos.indexOf(equipo));
            });

            equipoTableBody.appendChild(fila);
        });

        // Verificar si la fila seleccionada sigue visible
        if (filaSeleccionada) {
            const seleccionadaVisible = Array.from(equipoTableBody.children).some(fila => parseInt(fila.dataset.index) === parseInt(filaSeleccionada.dataset.index));
            if (!seleccionadaVisible) {
                filaSeleccionada = null;
                editarBtn.disabled = true;
                eliminarBtn.disabled = true;
            }
        }
    }

    // Filtrar equipo según los filtros activos
    function filtrarEquipo(equipo) {
        const filtroSucursalVal = filterSucursal.value;
        const filtroEstadoPagoVal = filterEstadoPago.value;
        const filtroFechaDesdeVal = filterFechaDesde.value;
        const filtroFechaHastaVal = filterFechaHasta.value;
        const searchTerm = searchInput.value.toLowerCase();

        let cumple = true;

        // Filtro por Sucursal
        if (filtroSucursalVal && equipo.sucursal !== filtroSucursalVal) {
            cumple = false;
        }

        // Filtro por Estado de Pago
        if (filtroEstadoPagoVal) {
            let estadoPagoActual = 'Pendiente';
            const mantenimientosPendientes = equipo.historialMantenimientos ? equipo.historialMantenimientos.filter(mantenimiento => mantenimiento.estadoPago === 'Pendiente') : [];
            if (mantenimientosPendientes.length === 0 && equipo.historialMantenimientos.length > 0) {
                estadoPagoActual = 'Completado';
            }
            if (estadoPagoActual !== filtroEstadoPagoVal) {
                cumple = false;
            }
        }

        // Filtro por Fecha Desde (Fecha de Próximo Mantenimiento)
        if (filtroFechaDesdeVal) {
            const proximoMantenimiento = obtenerProximoMantenimiento(equipo);
            if (proximoMantenimiento && proximoMantenimiento.fechaMantenimiento < filtroFechaDesdeVal) {
                cumple = false;
            }
        }

        // Filtro por Fecha Hasta (Fecha de Próximo Mantenimiento)
        if (filtroFechaHastaVal) {
            const proximoMantenimiento = obtenerProximoMantenimiento(equipo);
            if (proximoMantenimiento && proximoMantenimiento.fechaMantenimiento > filtroFechaHastaVal) {
                cumple = false;
            }
        }

        // Búsqueda general
        if (searchTerm) {
            const contiene = equipo.sucursal.toLowerCase().includes(searchTerm) ||
                             equipo.equipo.toLowerCase().includes(searchTerm) ||
                             equipo.ubicacion.toLowerCase().includes(searchTerm) ||
                             equipo.tipoPago.toLowerCase().includes(searchTerm) ||
                             equipo.proveedorServicio.toLowerCase().includes(searchTerm) ||
                             equipo.contactoProveedor.toLowerCase().includes(searchTerm);
            if (!contiene) {
                cumple = false;
            }
        }

        return cumple;
    }

    // Obtener el próximo mantenimiento basado en la frecuencia de días
    function obtenerProximoMantenimiento(equipo) {
        if (!equipo.historialMantenimientos || equipo.historialMantenimientos.length === 0) {
            return null;
        }

        // Obtener el último mantenimiento
        const ultimoMantenimiento = equipo.historialMantenimientos.reduce((prev, current) => {
            return (new Date(prev.fechaMantenimiento) > new Date(current.fechaMantenimiento)) ? prev : current;
        });

        // Calcular la próxima fecha de mantenimiento
        const fechaUltimo = new Date(ultimoMantenimiento.fechaMantenimiento);
        const diasFrecuencia = equipo.diasFrecuencia;
        const proximaFecha = new Date(fechaUltimo.getTime() + diasFrecuencia * 24 * 60 * 60 * 1000);

        return {
            ...ultimoMantenimiento,
            fechaMantenimiento: proximaFecha.toISOString().split('T')[0] // Formato YYYY-MM-DD
        };
    }

    // Seleccionar una fila en la tabla
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

    // Editar Equipo
    editarBtn.addEventListener('click', function() {
        if (filaSeleccionada) {
            const index = parseInt(filaSeleccionada.dataset.index, 10);
            abrirModal(index);
        }
    });

    // Eliminar Equipo
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
                    const equipo = equipos[index];
                    const equipoRef = doc(db, "equipos", equipo.id);
                    await deleteDoc(equipoRef);

                    filaSeleccionada = null;
                    editarBtn.disabled = true;
                    eliminarBtn.disabled = true;

                    Swal.fire(
                        'Eliminado!',
                        'El equipo ha sido eliminado.',
                        'success'
                    );
                }
            });
        }
    });

    // Abrir el modal para Programar Mantenimiento
    window.abrirRegistrarReciboModal = function(equipoId) {
        const modal = registrarReciboModal;

        // Obtener el equipo correspondiente
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        // Almacenar el ID del equipo seleccionado
        equipoSeleccionadoId = equipoId;

        // Mostrar el nombre del equipo seleccionado
        nombreEquipoSpan.innerText = `${equipo.equipo} - ${equipo.sucursal}`;

        // Mostrar el formulario de días de frecuencia
        registrarReciboModal.style.display = 'block';
        detalleReciboForm.style.display = 'none';
        detallesPagosContainer.innerHTML = "";
    };

    // Confirmar días seleccionados para programar mantenimientos
    confirmarDiasBtn.addEventListener('click', function() {
        const diasFrecuencia = parseInt(diasARegistrarInput.value, 10);

        if (isNaN(diasFrecuencia) || diasFrecuencia < 1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, ingresa un número válido de días.',
            });
            return;
        }

        // Generar formularios para cada mantenimiento programado
        detallesPagosContainer.innerHTML = "";

        // Definir cuántos mantenimientos se programarán, por ejemplo, 5 próximos mantenimientos
        const cantidadMantenimientos = 5;
        const equipo = equipos.find(e => e.id === equipoSeleccionadoId);
        if (!equipo) return;

        let fechaInicio = new Date();
        // Si hay mantenimientos anteriores, iniciar desde el último
        if (equipo.historialMantenimientos && equipo.historialMantenimientos.length > 0) {
            const ultimoMantenimiento = equipo.historialMantenimientos.reduce((prev, current) => {
                return (new Date(prev.fechaMantenimiento) > new Date(current.fechaMantenimiento)) ? prev : current;
            });
            fechaInicio = new Date(ultimoMantenimiento.fechaMantenimiento);
        }

        for (let i = 1; i <= cantidadMantenimientos; i++) {
            const fechaMantenimiento = new Date(fechaInicio.getTime() + diasFrecuencia * i * 24 * 60 * 60 * 1000);
            const detalleDiv = document.createElement('div');
            detalleDiv.classList.add('detalle-pago');

            detalleDiv.innerHTML = `
                <h4>Mantenimiento ${i}</h4>
                <p><strong>Fecha de Mantenimiento:</strong> ${fechaMantenimiento.toISOString().split('T')[0]}</p>
                <button type="button" onclick="agregarMantenimiento('${equipo.id}', '${fechaMantenimiento.toISOString().split('T')[0]}')">Agregar Mantenimiento</button>
            `;

            detallesPagosContainer.appendChild(detalleDiv);
        }

        detalleReciboForm.style.display = 'block';
    });

    // Agregar Mantenimiento automáticamente
    window.agregarMantenimiento = async function(equipoId, fechaMantenimiento) {
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        const numeroMantenimiento = `M${Date.now()}`; // Generar un número único
        const cantidadAPagar = equipo.montoAPagar; // Asignar monto a pagar según el equipo

        const nuevoMantenimiento = {
            numeroMantenimiento,
            fechaMantenimiento,
            estadoPago: 'Pendiente',
            comentario: ''
        };

        try {
            const equipoRef = doc(db, "equipos", equipoId);
            const historialActualizado = equipo.historialMantenimientos ? [...equipo.historialMantenimientos, nuevoMantenimiento] : [nuevoMantenimiento];
            await updateDoc(equipoRef, {
                historialMantenimientos: historialActualizado
            });

            Swal.fire({
                icon: 'success',
                title: 'Mantenimiento Agregado',
                text: `El mantenimiento programado para el ${fechaMantenimiento} ha sido agregado exitosamente.`,
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al agregar mantenimiento: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al agregar el mantenimiento.',
            });
        }
    };

    // Cerrar el modal de Programar Mantenimiento
    window.cerrarReciboModal = function() {
        registrarReciboModal.style.display = 'none';
        reciboForm.reset();
        detalleReciboForm.style.display = 'none';
        detallesPagosContainer.innerHTML = "";
        nombreEquipoSpan.innerText = '-';
        equipoSeleccionadoId = null;
    };

    // Abrir el modal para Ver Mantenimientos
    window.abrirVerRecibosModal = function(equipoId) {
        const modal = verRecibosModal;

        // Obtener el equipo correspondiente
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        // Almacenar el ID del equipo seleccionado
        equipoSeleccionadoId = equipoId;

        // Generar la lista de mantenimientos
        generarListaRecibos(equipo);

        modal.style.display = 'block';
    };

    // Cerrar el modal de Ver Mantenimientos
    window.cerrarVerRecibosModal = function() {
        verRecibosModal.style.display = 'none';
        listaRecibos.innerHTML = "";
        equipoSeleccionadoId = null;
    };

    // Generar la lista de mantenimientos
    function generarListaRecibos(equipo) {
        listaRecibos.innerHTML = "";
        equipo.historialMantenimientos.forEach((mantenimiento, idx) => {
            const mantenimientoDiv = document.createElement('div');
            mantenimientoDiv.classList.add('recibo');

            mantenimientoDiv.innerHTML = `
                <p><strong>Número de Mantenimiento:</strong> ${mantenimiento.numeroMantenimiento}</p>
                <p><strong>Fecha de Mantenimiento:</strong> ${new Date(mantenimiento.fechaMantenimiento).toLocaleDateString('es-ES')}</p>
                <p><strong>Estado de Pago:</strong> <span class="${mantenimiento.estadoPago === 'Pagado' ? 'estado-pagado' : 'estado-pendiente'}">${mantenimiento.estadoPago}</span></p>
                <p><strong>Comentario:</strong> ${mantenimiento.comentario || 'N/A'}</p>
            `;

            // Botones para marcar como completado y agregar comentario
            const botonesMantenimiento = document.createElement('div');
            botonesMantenimiento.classList.add('botones-recibo');

            if (mantenimiento.estadoPago === 'Pendiente') {
                const completarBtn = document.createElement('button');
                completarBtn.classList.add('completar-recibo-btn');
                completarBtn.innerText = 'Marcar como Completado';
                completarBtn.onclick = () => marcarComoCompletado(equipo.id, mantenimiento.numeroMantenimiento);
                botonesMantenimiento.appendChild(completarBtn);
            }

            const agregarComentarioBtn = document.createElement('button');
            agregarComentarioBtn.classList.add('comentario-recibo-btn');
            agregarComentarioBtn.innerText = 'Agregar Comentario';
            agregarComentarioBtn.onclick = () => agregarComentario(equipo.id, mantenimiento.numeroMantenimiento);
            botonesMantenimiento.appendChild(agregarComentarioBtn);

            mantenimientoDiv.appendChild(botonesMantenimiento);

            listaRecibos.appendChild(mantenimientoDiv);
        });
    }

    // Marcar Mantenimiento como Completado
    async function marcarComoCompletado(equipoId, numeroMantenimiento) {
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        const mantenimientoIndex = equipo.historialMantenimientos.findIndex(m => m.numeroMantenimiento === numeroMantenimiento);
        if (mantenimientoIndex === -1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Mantenimiento no encontrado.',
            });
            return;
        }

        try {
            equipo.historialMantenimientos[mantenimientoIndex].estadoPago = 'Completado';

            const equipoRef = doc(db, "equipos", equipoId);
            await updateDoc(equipoRef, {
                historialMantenimientos: equipo.historialMantenimientos
            });

            Swal.fire({
                icon: 'success',
                title: 'Actualizado',
                text: 'El mantenimiento ha sido marcado como completado.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al marcar como completado: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al actualizar el mantenimiento.',
            });
        }
    }

    // Agregar Comentario a Mantenimiento
    async function agregarComentario(equipoId, numeroMantenimiento) {
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        const mantenimientoIndex = equipo.historialMantenimientos.findIndex(m => m.numeroMantenimiento === numeroMantenimiento);
        if (mantenimientoIndex === -1) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Mantenimiento no encontrado.',
            });
            return;
        }

        const { value: comentario } = await Swal.fire({
            title: `Agregar Comentario al Mantenimiento ${numeroMantenimiento}`,
            input: 'textarea',
            inputLabel: 'Comentario',
            inputPlaceholder: 'Escribe tu comentario aquí...',
            inputAttributes: {
                'aria-label': 'Escribe tu comentario aquí'
            },
            showCancelButton: true
        });

        if (comentario) {
            try {
                equipo.historialMantenimientos[mantenimientoIndex].comentario = comentario;

                const equipoRef = doc(db, "equipos", equipoId);
                await updateDoc(equipoRef, {
                    historialMantenimientos: equipo.historialMantenimientos
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Comentario Agregado',
                    text: 'El comentario ha sido agregado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error("Error al agregar comentario: ", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al agregar el comentario.',
                });
            }
        }
    }

    // Gestionar Equipos (CRUD)
    window.abrirGestionarEquiposModal = function() {
        const modal = tiposServiciosModal;
        modal.style.display = 'block';
        cargarTiposServicios();
    };

    // Cerrar el modal de Gestionar Equipos
    window.cerrarGestionarEquiposModal = function() {
        tiposServiciosModal.style.display = 'none';
        tipoServicioForm.reset();
    };

    // Manejar el formulario de Gestionar Equipos
    tipoServicioForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nuevoEquipo = document.getElementById('nuevoTipoServicio').value.trim();

        if (!nuevoEquipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, ingresa un nombre para el equipo.',
            });
            return;
        }

        try {
            // Agregar un nuevo equipo con solo el nombre (puedes ajustar según tus necesidades)
            await addDoc(collection(db, "equipos"), {
                equipo: nuevoEquipo,
                sucursal: '',
                ubicacion: '',
                tipoPago: '',
                fechaPagoFijo: '',
                montoAPagar: 0,
                proveedorServicio: '',
                contactoProveedor: '',
                diasFrecuencia: 0,
                historialMantenimientos: [],
                comentarios: [],
                fechaCreacion: new Date().toISOString()
            });

            Swal.fire({
                icon: 'success',
                title: 'Añadido',
                text: 'El equipo ha sido agregado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

            tipoServicioForm.reset();
            cargarTiposServicios();
        } catch (error) {
            console.error("Error al agregar equipo desde Administración: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al agregar el equipo.',
            });
        }
    });

    // Cargar equipos en la tabla de Administración
    function cargarTiposServicios() {
        tiposServiciosTableBody.innerHTML = "";

        equipos.forEach((equipo, index) => {
            const fila = document.createElement("tr");
            fila.dataset.index = index;
            fila.dataset.id = equipo.id;

            const equipoTd = document.createElement('td');
            equipoTd.textContent = equipo.equipo;

            const accionesTd = document.createElement('td');
            const editarBtn = `<button class="editar-servicio-btn" onclick="editarTipoServicio('${equipo.id}')">Editar</button>`;
            const eliminarBtn = `<button class="eliminar-servicio-btn" onclick="eliminarTipoServicio('${equipo.id}')">Eliminar</button>`;
            accionesTd.innerHTML = `${editarBtn} ${eliminarBtn}`;

            fila.appendChild(equipoTd);
            fila.appendChild(accionesTd);

            tiposServiciosTableBody.appendChild(fila);
        });
    }

    // Editar Tipo de Servicio (Equipo)
    window.editarTipoServicio = function(equipoId) {
        const equipo = equipos.find(e => e.id === equipoId);
        if (!equipo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Equipo no encontrado.',
            });
            return;
        }

        Swal.fire({
            title: 'Editar Equipo',
            input: 'text',
            inputLabel: 'Nombre del Equipo',
            inputValue: equipo.equipo,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value.trim()) {
                    return 'El nombre del equipo no puede estar vacío.';
                }
                return null;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value.trim()) {
                try {
                    equipo.equipo = result.value.trim();
                    const equipoRef = doc(db, "equipos", equipoId);
                    await updateDoc(equipoRef, {
                        equipo: equipo.equipo
                    });

                    Swal.fire({
                        icon: 'success',
                        title: 'Actualizado',
                        text: 'El equipo ha sido actualizado exitosamente.',
                        timer: 1500,
                        showConfirmButton: false
                    });

                    cargarTiposServicios();
                } catch (error) {
                    console.error("Error al editar equipo: ", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Hubo un problema al editar el equipo.',
                    });
                }
            }
        });
    };

    // Eliminar Tipo de Servicio (Equipo)
    window.eliminarTipoServicio = function(equipoId) {
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
                try {
                    const equipoRef = doc(db, "equipos", equipoId);
                    await deleteDoc(equipoRef);

                    Swal.fire(
                        'Eliminado!',
                        'El equipo ha sido eliminado.',
                        'success'
                    );

                    cargarTiposServicios();
                } catch (error) {
                    console.error("Error al eliminar equipo: ", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Hubo un problema al eliminar el equipo.',
                    });
                }
            }
        });
    };

    // Listeners para filtros y ordenamiento
    sortOrderSelect.addEventListener('change', actualizarTabla);
    searchInput.addEventListener('input', actualizarTabla);
    filterSucursal.addEventListener('change', actualizarTabla);
    filterEstadoPago.addEventListener('change', actualizarTabla);
    filterFechaDesde.addEventListener('change', actualizarTabla);
    filterFechaHasta.addEventListener('change', actualizarTabla);

    // Resetear filtros
    resetFiltersBtn.addEventListener('click', function() {
        filterSucursal.value = "";
        filterEstadoPago.value = "";
        filterFechaDesde.value = "";
        filterFechaHasta.value = "";
        searchInput.value = "";
        sortOrderSelect.value = "fechaMantenimientoAsc";
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

    // Actualizar el año seleccionado
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

    // Cerrar los modales al hacer clic fuera de ellos
    window.onclick = function(event) {
        if (event.target == servicioModal) {
            cerrarModal();
        }

        if (event.target == registrarReciboModal) {
            cerrarReciboModal();
        }

        if (event.target == verRecibosModal) {
            cerrarVerRecibosModal();
        }

        if (event.target == tiposServiciosModal) {
            cerrarGestionarEquiposModal();
        }
    };
});
