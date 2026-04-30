// checklist.js  
import { db } from '../firebase-config.js';
import { 
    collection, addDoc, getDocs, onSnapshot, updateDoc, deleteDoc, doc, query, where, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    // **Variables y Elementos del DOM**
    const checklistModal = document.getElementById('checklistModal');
    const openChecklistModalBtn = document.getElementById('openChecklistModal');
    const closeChecklistModalBtn = document.getElementById('closeChecklistModal');
    const checklistForm = document.getElementById('checklistForm');
    const checklistTareasDiv = document.getElementById('checklistTareas');
    const checklistResponsablesSelect = document.getElementById('checklistResponsables');
    // const checklistTableBody = document.getElementById('checklistTable').querySelector('tbody'); // **ELIMINAR**

    const viewChecklistModal = document.getElementById('viewChecklistModal');
    const closeViewChecklistModalBtn = document.getElementById('closeViewChecklistModal');
    const viewChecklistTitulo = document.getElementById('viewChecklistTitulo');
    const viewChecklistFecha = document.getElementById('viewChecklistFecha');
    const viewChecklistResponsables = document.getElementById('viewChecklistResponsables');
    const viewChecklistTareasList = document.getElementById('viewChecklistTareas');
    const viewProgressBar = document.getElementById('viewProgressBar');
    const viewProgressText = document.getElementById('viewProgressText');
    const addManualTaskViewBtn = document.getElementById('addManualTaskViewBtn'); // Botón en el modal de visualización
    const saveManualTasksViewBtn = document.getElementById('saveManualTasksViewBtn'); // Botón para guardar tareas manuales

    // **Botón para Agregar Tarea Manual en el Modal de Creación/Edición**
    const addManualTaskBtn = document.getElementById('addManualTaskBtn');

    let checklists = [];
    let tareasDisponibles = [];
    let responsables = [];

    let isEditMode = false;
    let currentEditChecklistId = null;

    // **Variables para el Modal de Visualización**
    let currentViewChecklistId = null;

    // **Nuevo: Elemento del DOM para las columnas de responsables**
    const checklistsContainer = document.getElementById('checklistsContainer');

    // **Funciones para Manejar el Modal de Crear/Editar Checklist**
    openChecklistModalBtn.addEventListener('click', function() {
        isEditMode = false;
        currentEditChecklistId = null;
        checklistForm.reset();
        checklistResponsablesSelect.selectedIndex = -1;
        checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        cargarResponsables();
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
        checklistModal.style.display = 'block';
    });

    closeChecklistModalBtn.addEventListener('click', function() {
        checklistModal.style.display = 'none';
        checklistForm.reset();
        // Reiniciar los selects y checkboxes
        checklistResponsablesSelect.selectedIndex = -1;
        checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        isEditMode = false;
        currentEditChecklistId = null;
        document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
    });

    closeViewChecklistModalBtn.addEventListener('click', function() {
        viewChecklistModal.style.display = 'none';
        currentViewChecklistId = null;
    });

    // Cerrar los modales al hacer clic fuera de ellos
    window.addEventListener('click', function(event) {
        if (event.target == checklistModal) {
            checklistModal.style.display = 'none';
            checklistForm.reset();
            checklistResponsablesSelect.selectedIndex = -1;
            checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            isEditMode = false;
            currentEditChecklistId = null;
            document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
        }
        if (event.target == viewChecklistModal) {
            viewChecklistModal.style.display = 'none';
            currentViewChecklistId = null;
        }
    });

    // **Cargar Responsables Existentes**
    async function cargarResponsables() {
        try {
            const tareasRef = collection(db, "tareas");
            const snapshot = await getDocs(tareasRef);
            const responsablesSet = new Set();

            snapshot.forEach(docu => {
                const tarea = docu.data();
                if (Array.isArray(tarea.responsable)) {
                    tarea.responsable.forEach(responsable => responsablesSet.add(responsable));
                }
            });

            responsables = Array.from(responsablesSet).sort(); // Ordenar alfabéticamente

            // Llenar el select de responsables
            checklistResponsablesSelect.innerHTML = ''; // Limpiar opciones
            responsables.forEach(responsable => {
                const option = document.createElement('option');
                option.value = responsable;
                option.textContent = responsable;
                checklistResponsablesSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar responsables:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los responsables.',
            });
        }
    }

    cargarResponsables();

    // **Cargar Tareas Disponibles Filtradas por Responsables Seleccionados**
    async function cargarTareasDisponibles(responsablesSeleccionados) {
        try {
            const tareasRef = collection(db, "tareas");
            // Crear una consulta donde 'responsable' contiene cualquiera de los seleccionados
            const q = query(tareasRef, where("responsable", "array-contains-any", responsablesSeleccionados));
            const snapshot = await getDocs(q);
            tareasDisponibles = [];
            snapshot.forEach(docu => {
                const tarea = docu.data();
                tarea.id = docu.id;
                // Solo incluir tareas que no están completadas ni en revisión
                if (tarea.estado !== "Revisión" && tarea.estado !== "Completado") {
                    tareasDisponibles.push(tarea);
                }
            });

            // Llenar el div de tareas con checkboxes
            checklistTareasDiv.innerHTML = ''; // Limpiar contenido

            if (tareasDisponibles.length === 0) {
                checklistTareasDiv.innerHTML = '<p class="info-message">No hay tareas disponibles para los responsables seleccionados</p>';
                return;
            }

            tareasDisponibles.forEach(tarea => {
                const label = document.createElement('label');
                label.style.display = 'block';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = tarea.id;
                checkbox.name = 'tareas';
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${tarea.tipo}: ${tarea.descripcion}`));
                checklistTareasDiv.appendChild(label);
            });
        } catch (error) {
            console.error("Error al cargar tareas disponibles:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar las tareas disponibles.',
            });
        }
    }

    // **Manejar Cambio de Responsables en el Formulario de Checklist**
    checklistResponsablesSelect.addEventListener('change', function() {
        const selectedOptions = Array.from(this.selectedOptions).map(option => option.value);
        if (selectedOptions.length > 0) {
            cargarTareasDisponibles(selectedOptions);
            escucharCambiosTareas(selectedOptions);
        } else {
            checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
        }
    });

    // **Manejar el Envío del Formulario de Checklist**
    checklistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const titulo = document.getElementById('checklistTitulo').value.trim();
        const fecha = document.getElementById('checklistFecha').value;
        const responsablesSeleccionados = Array.from(checklistResponsablesSelect.selectedOptions).map(option => option.value);
        const tareasSeleccionadas = Array.from(document.querySelectorAll('input[name="tareas"]:checked')).map(checkbox => checkbox.value);

        // Validaciones
        if (!titulo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El título del checklist no puede estar vacío.',
            });
            return;
        }

        if (!fecha) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona una fecha.',
            });
            return;
        }

        if (responsablesSeleccionados.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos un responsable.',
            });
            return;
        }

        if (tareasSeleccionadas.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, selecciona al menos una tarea.',
            });
            return;
        }

        // Obtener las tareas manuales ingresadas
        const manualTareasInputs = document.querySelectorAll('#manualTasksContainer .manual-task-input input');
        const manualTareas = Array.from(manualTareasInputs).map(input => ({
            descripcion: input.value.trim(),
            completado: false
        })).filter(tarea => tarea.descripcion !== "");

        // Crear el objeto del checklist
        const checklistData = {
            titulo,
            fecha,
            responsables: responsablesSeleccionados,
            tareas: tareasSeleccionadas.map(tareaId => ({ id: tareaId, completado: false })),
            manualTareas: manualTareas
        };

        if (isEditMode && currentEditChecklistId) {
            // Modo Edición: Actualizar el checklist existente
            try {
                const checklistRef = doc(db, "checklists", currentEditChecklistId);
                const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", currentEditChecklistId))).then(snapshot => {
                    let found = null;
                    snapshot.forEach(docu => {
                        if (docu.id === currentEditChecklistId) {
                            found = docu.data();
                            found.id = docu.id;
                        }
                    });
                    return found;
                });

                if (!checklistSnap) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Checklist no encontrado.',
                    });
                    return;
                }

                const tareasActuales = checklistSnap.tareas.map(t => t.id);
                const tareasNuevas = tareasSeleccionadas;
                const tareasAgregadas = tareasNuevas.filter(t => !tareasActuales.includes(t));
                const tareasEliminadas = tareasActuales.filter(t => !tareasNuevas.includes(t));

                // Actualizar el checklist en Firestore
                await updateDoc(checklistRef, {
                    titulo: checklistData.titulo,
                    fecha: checklistData.fecha,
                    responsables: checklistData.responsables,
                    tareas: checklistData.tareas,
                    manualTareas: checklistData.manualTareas
                });

                // Actualizar el estado de las tareas agregadas
                for (const tareaId of tareasAgregadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "En Progreso" });
                }

                // Opcional: Si deseas revertir el estado de las tareas eliminadas
                for (const tareaId of tareasEliminadas) {
                    const tareaRef = doc(db, "tareas", tareaId);
                    await updateDoc(tareaRef, { estado: "Pendiente" }); // O el estado que corresponda
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido actualizado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
                isEditMode = false;
                currentEditChecklistId = null;
                document.getElementById('modalTitle').textContent = 'Crear Nuevo Checklist';
            } catch (error) {
                console.error("Error al actualizar checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al actualizar el checklist.',
                });
            }
        } else {
            // Modo Creación: Crear un nuevo checklist
            try {
                await addDoc(collection(db, "checklists"), checklistData);
                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'El checklist ha sido creado exitosamente.',
                    timer: 1500,
                    showConfirmButton: false
                });
                checklistForm.reset();
                checklistModal.style.display = 'none';
                checklistTareasDiv.innerHTML = '<p class="info-message">Selecciona uno o más responsables primero</p>';
            } catch (error) {
                console.error("Error al crear checklist:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al crear el checklist.',
                });
            }
        }
    });

    // **Cargar Checklists Existentes**
    function cargarChecklists() {
        const checklistsRef = collection(db, "checklists");
        onSnapshot(checklistsRef, (snapshot) => {
            checklists = [];
            snapshot.forEach(docu => {
                const checklist = docu.data();
                checklist.id = docu.id;
                checklists.push(checklist);
            });
            actualizarColumnasChecklists();
        }, (error) => {
            console.error("Error al cargar checklists:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar los checklists.',
            });
        });
    }

    cargarChecklists();

    // **Actualizar las Columnas de Checklists por Responsable**
    function actualizarColumnasChecklists() {
        // Limpiar el contenedor de checklists
        checklistsContainer.innerHTML = '';

        if (responsables.length === 0) {
            checklistsContainer.innerHTML = '<p class="info-message">No hay responsables disponibles.</p>';
            return;
        }

        // Crear un mapa de responsables a sus checklists
        const responsableMap = {};

        responsables.forEach(responsable => {
            responsableMap[responsable] = [];
        });

        checklists.forEach(checklist => {
            checklist.responsables.forEach(responsable => {
                if (responsableMap[responsable]) {
                    responsableMap[responsable].push(checklist);
                }
            });
        });

        // Crear columnas para cada responsable
        for (const [responsable, checklistsAsignados] of Object.entries(responsableMap)) {
            const columna = document.createElement('div');
            columna.classList.add('responsable-column');

            const encabezado = document.createElement('h2');
            encabezado.textContent = responsable;
            columna.appendChild(encabezado);

            // Ordenar los checklists por fecha (más antiguos al principio)
            const checklistsOrdenados = checklistsAsignados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            if (checklistsOrdenados.length === 0) {
                const mensaje = document.createElement('p');
                mensaje.classList.add('info-message');
                mensaje.textContent = 'No hay checklists asignados.';
                columna.appendChild(mensaje);
            } else {
                checklistsOrdenados.forEach(checklist => {
                    const checklistDiv = document.createElement('div');
                    checklistDiv.classList.add('checklist-item');

                    const titulo = document.createElement('div');
                    titulo.classList.add('checklist-title');
                    titulo.textContent = checklist.titulo;
                    checklistDiv.appendChild(titulo);

                    const fecha = document.createElement('div');
                    fecha.classList.add('checklist-date');
                    fecha.textContent = `Fecha: ${checklist.fecha}`;
                    checklistDiv.appendChild(fecha);

                    const acciones = document.createElement('div');
                    acciones.classList.add('checklist-actions');

                    const verBtn = document.createElement('button');
                    verBtn.classList.add('action-btn', 'view-btn');
                    verBtn.innerHTML = '<i class="fas fa-eye"></i> Ver';
                    verBtn.onclick = () => verChecklist(checklist.id);
                    acciones.appendChild(verBtn);

                    const editarBtn = document.createElement('button');
                    editarBtn.classList.add('action-btn', 'edit-btn');
                    editarBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
                    editarBtn.onclick = () => editarChecklist(checklist.id);
                    acciones.appendChild(editarBtn);

                    const eliminarBtn = document.createElement('button');
                    eliminarBtn.classList.add('action-btn', 'delete-btn');
                    eliminarBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
                    eliminarBtn.onclick = () => eliminarChecklist(checklist.id);
                    acciones.appendChild(eliminarBtn);

                    checklistDiv.appendChild(acciones);

                    columna.appendChild(checklistDiv);
                });
            }

            checklistsContainer.appendChild(columna);
        }
    }

    // **Función para Ver un Checklist**
    window.verChecklist = async function(checklistId) {
        currentViewChecklistId = checklistId; // Guardar el ID actual
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Calcular el progreso
            const totalTareas = checklistSnap.tareas.length + (checklistSnap.manualTareas ? checklistSnap.manualTareas.length : 0);
            const tareasCompletadas = checklistSnap.tareas.filter(t => t.completado).length + 
                                        (checklistSnap.manualTareas ? checklistSnap.manualTareas.filter(t => t.completado).length : 0);
            const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

            // Actualizar la barra de progreso en el modal
            viewProgressBar.style.width = `${progreso}%`;
            viewProgressText.textContent = `${progreso}% Completado`;

            viewChecklistTitulo.textContent = checklistSnap.titulo;
            viewChecklistFecha.textContent = `Fecha: ${checklistSnap.fecha}`;
            viewChecklistResponsables.textContent = `Responsables: ${checklistSnap.responsables.join(', ')}`;
            viewChecklistTareasList.innerHTML = '';

            if (checklistSnap.tareas.length === 0 && (!checklistSnap.manualTareas || checklistSnap.manualTareas.length === 0)) {
                viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
            } else {
                // Manejar tareas globales
                if (checklistSnap.tareas.length > 0) {
                    // Optimización: Crear una única consulta para todas las tareas
                    const tareaIds = checklistSnap.tareas.map(t => t.id);
                    let tareasMap = {};

                    // Firestore permite un máximo de 10 elementos en 'in', así que si hay más, dividimos en múltiples consultas
                    const chunks = [];
                    const size = 10;
                    for (let i = 0; i < tareaIds.length; i += size) {
                        chunks.push(tareaIds.slice(i, i + size));
                    }

                    for (const chunk of chunks) {
                        const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                        const tareasSnapshot = await getDocs(tareasQuery);
                        tareasSnapshot.forEach(docu => {
                            tareasMap[docu.id] = docu.data();
                        });
                    }

                    checklistSnap.tareas.forEach(tareaItem => {
                        const tarea = tareasMap[tareaItem.id];
                        const tareaDescripcion = tarea ? `${tarea.tipo}: ${tarea.descripcion}` : 'Descripción no disponible';

                        const li = document.createElement('li');
                        li.innerHTML = `
                            <label>
                                <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" data-manual="false" ${tareaItem.completado ? 'checked' : ''}>
                                ${tareaDescripcion}
                            </label>
                        `;
                        viewChecklistTareasList.appendChild(li);
                    });
                }

                // Manejar tareas manuales
                if (checklistSnap.manualTareas && checklistSnap.manualTareas.length > 0) {
                    checklistSnap.manualTareas.forEach((manualTarea, index) => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <label>
                                <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${index}" data-manual="true" ${manualTarea.completado ? 'checked' : ''}>
                                ${manualTarea.descripcion}
                            </label>
                        `;
                        viewChecklistTareasList.appendChild(li);
                    });
                }
            }

            // Escuchar cambios en las tareas del checklist en tiempo real
            onSnapshot(doc(db, "checklists", checklistId), (docu) => {
                const updatedChecklist = docu.data();
                if (updatedChecklist) {
                    // Calcular el progreso actualizado
                    const totalTareas = updatedChecklist.tareas.length + (updatedChecklist.manualTareas ? updatedChecklist.manualTareas.length : 0);
                    const tareasCompletadas = updatedChecklist.tareas.filter(t => t.completado).length + 
                                                (updatedChecklist.manualTareas ? updatedChecklist.manualTareas.filter(t => t.completado).length : 0);
                    const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

                    // Actualizar la barra de progreso en el modal
                    viewProgressBar.style.width = `${progreso}%`;
                    viewProgressText.textContent = `${progreso}% Completado`;

                    // Actualizar la información del checklist
                    viewChecklistTitulo.textContent = updatedChecklist.titulo;
                    viewChecklistFecha.textContent = `Fecha: ${updatedChecklist.fecha}`;
                    viewChecklistResponsables.textContent = `Responsables: ${updatedChecklist.responsables.join(', ')}`;
                    viewChecklistTareasList.innerHTML = '';

                    if (updatedChecklist.tareas.length === 0 && (!updatedChecklist.manualTareas || updatedChecklist.manualTareas.length === 0)) {
                        viewChecklistTareasList.innerHTML = '<li class="info-message">Este checklist no tiene tareas asignadas.</li>';
                    } else {
                        // Manejar tareas globales
                        if (updatedChecklist.tareas.length > 0) {
                            const tareaIds = updatedChecklist.tareas.map(t => t.id);
                            let tareasMap = {};

                            const chunks = [];
                            const size = 10;
                            for (let i = 0; i < tareaIds.length; i += size) {
                                chunks.push(tareaIds.slice(i, i + size));
                            }

                            (async () => {
                                for (const chunk of chunks) {
                                    const tareasQuery = query(collection(db, "tareas"), where("__name__", "in", chunk));
                                    const tareasSnapshot = await getDocs(tareasQuery);
                                    tareasSnapshot.forEach(docu => {
                                        tareasMap[docu.id] = docu.data();
                                    });
                                }

                                updatedChecklist.tareas.forEach(tareaItem => {
                                    const tarea = tareasMap[tareaItem.id];
                                    const tareaDescripcion = tarea ? `${tarea.tipo}: ${tarea.descripcion}` : 'Descripción no disponible';

                                    const li = document.createElement('li');
                                    li.innerHTML = `
                                        <label>
                                            <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${tareaItem.id}" data-manual="false" ${tareaItem.completado ? 'checked' : ''}>
                                            ${tareaDescripcion}
                                        </label>
                                    `;
                                    viewChecklistTareasList.appendChild(li);
                                });
                            })().catch(error => {
                                console.error("Error al cargar tareas actualizadas:", error);
                            });
                        }

                        // Manejar tareas manuales
                        if (updatedChecklist.manualTareas && updatedChecklist.manualTareas.length > 0) {
                            updatedChecklist.manualTareas.forEach((manualTarea, index) => {
                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <label>
                                        <input type="checkbox" data-checklist-id="${checklistId}" data-tarea-id="${index}" data-manual="true" ${manualTarea.completado ? 'checked' : ''}>
                                        ${manualTarea.descripcion}
                                    </label>
                                `;
                                viewChecklistTareasList.appendChild(li);
                            });
                        }
                    }

                    // **Actualizar las columnas después de cualquier cambio**
                    actualizarColumnasChecklists();
                }
            });

            viewChecklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al ver checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist.',
            });
        }
    }

    // **Función para Editar un Checklist**
    window.editarChecklist = async function(checklistId) {
        try {
            const checklistRef = doc(db, "checklists", checklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", checklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === checklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Configurar el modal en modo edición
            isEditMode = true;
            currentEditChecklistId = checklistId;

            // Llenar el formulario con los datos existentes
            document.getElementById('checklistTitulo').value = checklistSnap.titulo;
            document.getElementById('checklistFecha').value = checklistSnap.fecha;

            // Seleccionar los responsables existentes
            Array.from(checklistResponsablesSelect.options).forEach(option => {
                option.selected = checklistSnap.responsables.includes(option.value);
            });

            // Cargar tareas disponibles basadas en los responsables seleccionados
            cargarTareasDisponibles(checklistSnap.responsables);

            // Esperar a que las tareas se carguen y luego marcar las que ya están en el checklist
            setTimeout(() => {
                checklistSnap.tareas.forEach(tareaItem => {
                    const checkbox = document.querySelector(`input[name="tareas"][value="${tareaItem.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }, 500); // Ajusta el tiempo según la carga de tareas

            // Cargar las tareas manuales existentes
            const manualTasksContainer = document.getElementById('manualTasksContainer');
            manualTasksContainer.innerHTML = ''; // Limpiar tareas manuales existentes
            if (checklistSnap.manualTareas && checklistSnap.manualTareas.length > 0) {
                checklistSnap.manualTareas.forEach(manualTarea => {
                    const div = document.createElement('div');
                    div.classList.add('manual-task-input');
                    div.innerHTML = `
                        <input type="text" value="${manualTarea.descripcion}" readonly>
                        <button type="button" class="remove-manual-task-btn"><i class="fas fa-trash"></i></button>
                    `;
                    manualTasksContainer.appendChild(div);

                    // Agregar evento para eliminar la tarea manual
                    div.querySelector('.remove-manual-task-btn').addEventListener('click', function() {
                        manualTasksContainer.removeChild(div);
                    });
                });
            }

            // Cambiar el título del modal
            document.getElementById('modalTitle').textContent = 'Editar Checklist';

            // Abrir el modal
            checklistModal.style.display = 'block';
        } catch (error) {
            console.error("Error al editar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al cargar el checklist para editar.',
            });
        }
    }

    // **Función para Eliminar un Checklist**
    window.eliminarChecklist = function(checklistId) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción eliminará el checklist de forma permanente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                eliminarChecklistConfirm(checklistId);
            }
        });
    }

    async function eliminarChecklistConfirm(checklistId) {
        try {
            await deleteDoc(doc(db, "checklists", checklistId));
            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'El checklist ha sido eliminado exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error al eliminar checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al eliminar el checklist.',
            });
        }
    }

    // **Escuchar Cambios en las Tareas Disponibles en Tiempo Real**
    async function escucharCambiosTareas(responsablesSeleccionados) {
        try {
            const tareasRef = collection(db, "tareas");
            const q = query(tareasRef, where("responsable", "array-contains-any", responsablesSeleccionados));
            onSnapshot(q, (snapshot) => {
                tareasDisponibles = [];
                snapshot.forEach(docu => {
                    const tarea = docu.data();
                    tarea.id = docu.id;
                    if (tarea.estado !== "Revisión" && tarea.estado !== "Completado") {
                        tareasDisponibles.push(tarea);
                    }
                });
                // Si el modal está abierto y el usuario ha seleccionado responsables, actualizar las tareas mostradas
                if (checklistModal.style.display === 'block') {
                    cargarTareasDisponibles(responsablesSeleccionados);
                }
            }, (error) => {
                console.error("Error al escuchar cambios en tareas disponibles:", error);
            });
        } catch (error) {
            console.error("Error al configurar escucha de tareas disponibles:", error);
        }
    }

    // **Agregar Tarea Manual en el Modal de Creación/Edición**
    addManualTaskBtn.addEventListener('click', async function() {
        const { value: descripcion } = await Swal.fire({
            title: 'Agregar Tarea Manual',
            input: 'text',
            inputLabel: 'Descripción de la tarea',
            inputPlaceholder: 'Escribe la descripción de la tarea',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return 'La descripción no puede estar vacía!';
                }
            }
        });

        if (descripcion) {
            const manualTasksContainer = document.getElementById('manualTasksContainer');
            const div = document.createElement('div');
            div.classList.add('manual-task-input');
            div.innerHTML = `
                <input type="text" value="${descripcion}" readonly>
                <button type="button" class="remove-manual-task-btn"><i class="fas fa-trash"></i></button>
            `;
            manualTasksContainer.appendChild(div);

            // Agregar evento para eliminar la tarea manual
            div.querySelector('.remove-manual-task-btn').addEventListener('click', function() {
                manualTasksContainer.removeChild(div);
            });
        }
    });

    // **Agregar Tarea Manual en el Modal de Visualización**
    addManualTaskViewBtn.addEventListener('click', async function() {
        if (!currentViewChecklistId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo determinar el checklist actual.',
            });
            return;
        }

        const { value: descripcion } = await Swal.fire({
            title: 'Agregar Tarea Manual',
            input: 'text',
            inputLabel: 'Descripción de la tarea',
            inputPlaceholder: 'Escribe la descripción de la tarea',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return 'La descripción no puede estar vacía!';
                }
            }
        });

        if (descripcion) {
            try {
                const checklistRef = doc(db, "checklists", currentViewChecklistId);
                await updateDoc(checklistRef, {
                    manualTareas: arrayUnion({
                        descripcion: descripcion,
                        completado: false
                    })
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Éxito',
                    text: 'La tarea manual ha sido agregada.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error("Error al agregar tarea manual:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Hubo un problema al agregar la tarea manual.',
                });
            }
        }
    });

    // **Guardar Tareas Manuales desde el Modal de Visualización**
    saveManualTasksViewBtn.addEventListener('click', async function() {
        if (!currentViewChecklistId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo determinar el checklist actual.',
            });
            return;
        }

        try {
            const checklistRef = doc(db, "checklists", currentViewChecklistId);
            const checklistSnap = await getDocs(query(collection(db, "checklists"), where("__name__", "==", currentViewChecklistId))).then(snapshot => {
                let found = null;
                snapshot.forEach(docu => {
                    if (docu.id === currentViewChecklistId) {
                        found = docu.data();
                        found.id = docu.id;
                    }
                });
                return found;
            });

            if (!checklistSnap) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Checklist no encontrado.',
                });
                return;
            }

            // Manejar cambios en tareas globales
            const tareasGlobales = checklistSnap.tareas;
            const tareasGlobalesActualizadas = [...tareasGlobales];

            document.querySelectorAll('input[data-manual="false"]').forEach(checkbox => {
                const tareaId = checkbox.getAttribute('data-tarea-id');
                const completado = checkbox.checked;
                const tareaIndex = tareasGlobalesActualizadas.findIndex(t => t.id === tareaId);
                if (tareaIndex !== -1) {
                    tareasGlobalesActualizadas[tareaIndex].completado = completado;
                }
            });

            // Manejar cambios en tareas manuales
            const tareasManuales = checklistSnap.manualTareas || [];
            const tareasManualesActualizadas = [...tareasManuales];

            document.querySelectorAll('input[data-manual="true"]').forEach(checkbox => {
                const tareaIndex = parseInt(checkbox.getAttribute('data-tarea-id'));
                const completado = checkbox.checked;
                if (!isNaN(tareaIndex) && tareasManualesActualizadas[tareaIndex]) {
                    tareasManualesActualizadas[tareaIndex].completado = completado;
                }
            });

            // Actualizar el checklist en Firestore
            await updateDoc(checklistRef, {
                tareas: tareasGlobalesActualizadas,
                manualTareas: tareasManualesActualizadas
            });

            Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: 'Los cambios han sido guardados exitosamente.',
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Error al guardar cambios en el checklist:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al guardar los cambios.',
            });
        }
    });

    // **Función para Obtener el ID del Checklist Actual**
    function getCurrentChecklistId() {
        return currentViewChecklistId;
    }

});
