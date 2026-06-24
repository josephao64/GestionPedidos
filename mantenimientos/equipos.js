const equiposCollection = db.collection('equipos_mantenimiento');
const sucursalesCollection = db.collection('sucursales');
const areasCollection = db.collection('areas_mantenimiento');
const tiposCollection = db.collection('tipos_mantenimiento');

let cacheSucursales = {};
let cacheAreas = {};
let cacheTipos = {};

async function cargarDependencias() {
    // Cargar Sucursales
    const snapS = await sucursalesCollection.get();
    const selectSucursal = document.getElementById('filter-sucursal');
    snapS.forEach(doc => {
        cacheSucursales[doc.id] = doc.data().name;
        selectSucursal.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });

    // Cargar Áreas
    const snapA = await areasCollection.get();
    const selectArea = document.getElementById('filter-area');
    snapA.forEach(doc => {
        cacheAreas[doc.id] = doc.data(); // store full object to filter by sucursal later
        selectArea.innerHTML += `<option value="${doc.id}">${doc.data().nombre}</option>`;
    });

    // Cargar Tipos
    const snapT = await tiposCollection.get();
    snapT.forEach(doc => {
        cacheTipos[doc.id] = doc.data().nombre;
    });
}

function cargarEquipos() {
    const filterSucursal = document.getElementById('filter-sucursal').value;
    const filterArea = document.getElementById('filter-area').value;

    let query = equiposCollection;
    if (filterSucursal) query = query.where('sucursalId', '==', filterSucursal);
    if (filterArea) query = query.where('areaId', '==', filterArea);

    query.onSnapshot(snap => {
        const tbody = document.getElementById('lista-equipos');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            
            // Resolve names
            const sucursalNom = cacheSucursales[data.sucursalId] || 'Desconocida';
            const areaNom = cacheAreas[data.areaId] ? cacheAreas[data.areaId].nombre : 'Desconocida';
            const tipoNom = cacheTipos[data.tipoEquipoId] || 'Desconocido';

            // Badge color
            let badgeClass = 'badge-activo';
            if(data.estadoEquipo === 'Dañado') badgeClass = 'badge-danado';
            else if(data.estadoEquipo === 'En reparación') badgeClass = 'badge-reparacion';
            else if(data.estadoEquipo === 'Dado de baja') badgeClass = 'badge-baja';

            const detalles = [];
            if(data.marca) detalles.push(data.marca);
            if(data.modelo) detalles.push(`Mod: ${data.modelo}`);
            if(data.serie) detalles.push(`SN: ${data.serie}`);

            tbody.innerHTML += `
                <tr>
                    <td><span class="codigo-text">${data.codigoVisible || 'N/A'}</span></td>
                    <td><strong>${data.nombre}</strong><br><small style="color:#64748b">${tipoNom}</small></td>
                    <td>${sucursalNom}<br><small style="color:#64748b">${areaNom}</small></td>
                    <td><small>${detalles.join(' | ') || 'Sin detalles'}</small></td>
                    <td><span class="badge ${badgeClass}">${data.estadoEquipo}</span></td>
                    <td>
                        <button class="action-btn" onclick="editarEquipo('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn" onclick="eliminarEquipo('${doc.id}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// Para que los selects dinámicos se actualicen (Ya no filtra por sucursal)
function getAreasOptionsHtml(currentAreaId = '') {
    let html = '<option value="" disabled selected>Seleccione un Área</option>';
    for(let id in cacheAreas) {
        const selected = id === currentAreaId ? 'selected' : '';
        html += `<option value="${id}" ${selected}>${cacheAreas[id].nombre}</option>`;
    }
    return html;
}

// Crear Equipo
async function abrirModalEquipo() {
    // Generar opciones estáticas
    let tiposHtml = '<option value="" disabled selected>Seleccione Tipo de Equipo</option>';
    for(let id in cacheTipos) tiposHtml += `<option value="${id}">${cacheTipos[id]}</option>`;

    let sucursalesHtml = '<option value="" disabled selected>Seleccione Sucursal</option>';
    for(let id in cacheSucursales) sucursalesHtml += `<option value="${id}">${cacheSucursales[id]}</option>`;

    Swal.fire({
        title: 'Registrar Equipo',
        width: 600,
        html: `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align:left;">
                <div>
                    <label>Código Visible</label>
                    <input id="swal-codigo" class="swal2-input" style="margin-top:5px" placeholder="Ej: AC-SE-001">
                </div>
                <div>
                    <label>Nombre del Equipo</label>
                    <input id="swal-nombre" class="swal2-input" style="margin-top:5px" placeholder="Ej: Aire cocina">
                </div>
                <div>
                    <label>Sucursal</label>
                    <select id="swal-sucursal" class="swal2-input" style="margin-top:5px">
                        ${sucursalesHtml}
                    </select>
                </div>
                <div>
                    <label>Área</label>
                    <select id="swal-area" class="swal2-input" style="margin-top:5px">
                        ${getAreasOptionsHtml()}
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Tipo de Equipo</label>
                    <select id="swal-tipo" class="swal2-input" style="margin-top:5px">
                        ${tiposHtml}
                    </select>
                </div>
                <div>
                    <label>Marca (Opcional)</label>
                    <input id="swal-marca" class="swal2-input" style="margin-top:5px">
                </div>
                <div>
                    <label>Modelo (Opcional)</label>
                    <input id="swal-modelo" class="swal2-input" style="margin-top:5px">
                </div>
                <div>
                    <label>No. Serie (Opcional)</label>
                    <input id="swal-serie" class="swal2-input" style="margin-top:5px">
                </div>
                <div>
                    <label>Estado</label>
                    <select id="swal-estado" class="swal2-input" style="margin-top:5px">
                        <option value="Activo">Activo</option>
                        <option value="Dañado">Dañado</option>
                        <option value="En reparación">En reparación</option>
                        <option value="Dado de baja">Dado de baja</option>
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Observaciones</label>
                    <textarea id="swal-obs" class="swal2-textarea" style="margin-top:5px"></textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        didOpen: () => {
            // Bind context specific function inside sweetalert modal
            window.getAreasOptionsHtml = getAreasOptionsHtml;
        },
        preConfirm: () => {
            return {
                codigoVisible: document.getElementById('swal-codigo').value,
                nombre: document.getElementById('swal-nombre').value,
                sucursalId: document.getElementById('swal-sucursal').value,
                areaId: document.getElementById('swal-area').value,
                tipoEquipoId: document.getElementById('swal-tipo').value,
                marca: document.getElementById('swal-marca').value,
                modelo: document.getElementById('swal-modelo').value,
                serie: document.getElementById('swal-serie').value,
                estadoEquipo: document.getElementById('swal-estado').value,
                observaciones: document.getElementById('swal-obs').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;
            if(!data.codigoVisible || !data.nombre || !data.sucursalId || !data.areaId || !data.tipoEquipoId) {
                Swal.fire('Error', 'Debe llenar todos los campos obligatorios (Código, Nombre, Sucursal, Área, Tipo).', 'error');
                return;
            }
            equiposCollection.add(data).then(() => {
                Swal.fire('Guardado', 'Equipo registrado exitosamente.', 'success');
            }).catch(error => {
                Swal.fire('Error', error.message, 'error');
            });
        }
    });
}

// Editar Equipo
async function editarEquipo(id) {
    const doc = await equiposCollection.doc(id).get();
    const data = doc.data();

    let tiposHtml = '';
    for(let tId in cacheTipos) tiposHtml += `<option value="${tId}" ${tId === data.tipoEquipoId ? 'selected' : ''}>${cacheTipos[tId]}</option>`;

    let sucursalesHtml = '';
    for(let sId in cacheSucursales) sucursalesHtml += `<option value="${sId}" ${sId === data.sucursalId ? 'selected' : ''}>${cacheSucursales[sId]}</option>`;

    Swal.fire({
        title: 'Editar Equipo',
        width: 600,
        html: `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align:left;">
                <div>
                    <label>Código Visible</label>
                    <input id="swal-codigo" class="swal2-input" style="margin-top:5px" value="${data.codigoVisible || ''}">
                </div>
                <div>
                    <label>Nombre del Equipo</label>
                    <input id="swal-nombre" class="swal2-input" style="margin-top:5px" value="${data.nombre}">
                </div>
                <div>
                    <label>Sucursal</label>
                    <select id="swal-sucursal" class="swal2-input" style="margin-top:5px">
                        ${sucursalesHtml}
                    </select>
                </div>
                <div>
                    <label>Área</label>
                    <select id="swal-area" class="swal2-input" style="margin-top:5px">
                        ${getAreasOptionsHtml(data.areaId)}
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Tipo de Equipo</label>
                    <select id="swal-tipo" class="swal2-input" style="margin-top:5px">
                        ${tiposHtml}
                    </select>
                </div>
                <div>
                    <label>Marca (Opcional)</label>
                    <input id="swal-marca" class="swal2-input" style="margin-top:5px" value="${data.marca || ''}">
                </div>
                <div>
                    <label>Modelo (Opcional)</label>
                    <input id="swal-modelo" class="swal2-input" style="margin-top:5px" value="${data.modelo || ''}">
                </div>
                <div>
                    <label>No. Serie (Opcional)</label>
                    <input id="swal-serie" class="swal2-input" style="margin-top:5px" value="${data.serie || ''}">
                </div>
                <div>
                    <label>Estado</label>
                    <select id="swal-estado" class="swal2-input" style="margin-top:5px">
                        <option value="Activo" ${data.estadoEquipo === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Dañado" ${data.estadoEquipo === 'Dañado' ? 'selected' : ''}>Dañado</option>
                        <option value="En reparación" ${data.estadoEquipo === 'En reparación' ? 'selected' : ''}>En reparación</option>
                        <option value="Dado de baja" ${data.estadoEquipo === 'Dado de baja' ? 'selected' : ''}>Dado de baja</option>
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Observaciones</label>
                    <textarea id="swal-obs" class="swal2-textarea" style="margin-top:5px">${data.observaciones || ''}</textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        didOpen: () => { window.getAreasOptionsHtml = getAreasOptionsHtml; },
        preConfirm: () => {
            return {
                codigoVisible: document.getElementById('swal-codigo').value,
                nombre: document.getElementById('swal-nombre').value,
                sucursalId: document.getElementById('swal-sucursal').value,
                areaId: document.getElementById('swal-area').value,
                tipoEquipoId: document.getElementById('swal-tipo').value,
                marca: document.getElementById('swal-marca').value,
                modelo: document.getElementById('swal-modelo').value,
                serie: document.getElementById('swal-serie').value,
                estadoEquipo: document.getElementById('swal-estado').value,
                observaciones: document.getElementById('swal-obs').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newData = result.value;
            if(!newData.codigoVisible || !newData.nombre || !newData.sucursalId || !newData.areaId || !newData.tipoEquipoId) {
                Swal.fire('Error', 'Debe llenar todos los campos obligatorios.', 'error');
                return;
            }
            equiposCollection.doc(id).update(newData).then(() => {
                Swal.fire('Actualizado', 'Equipo actualizado.', 'success');
            });
        }
    });
}

// Eliminar Equipo
function eliminarEquipo(id) {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "Se eliminará el equipo del sistema",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            equiposCollection.doc(id).delete().then(() => {
                Swal.fire('Eliminado', 'El equipo ha sido eliminado.', 'success');
            });
        }
    });
}

// Inicializar
cargarDependencias().then(() => {
    cargarEquipos();
});
