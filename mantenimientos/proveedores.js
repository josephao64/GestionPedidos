const proveedoresCollection = db.collection('proveedores_mantenimiento');
const tiposCollection = db.collection('tipos_mantenimiento');

let tiposData = {};

// Cargar tipos para especialidades
async function cargarTipos() {
    const snap = await tiposCollection.get();
    let opciones = {};
    snap.forEach(doc => {
        const data = doc.data();
        opciones[doc.id] = data.name || data.nombre;
        tiposData[doc.id] = data.name || data.nombre;
    });
    return opciones;
}

// Cargar proveedores
function cargarProveedores() {
    proveedoresCollection.onSnapshot(snap => {
        const tbody = document.getElementById('lista-proveedores');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const estadoBadge = data.estado === 'Activo' ? '<span class="badge badge-active">Activo</span>' : '<span class="badge badge-inactive">Inactivo</span>';
            const tipoBadge = `<span class="badge badge-tipo">${data.tipo}</span>`;
            
            // Format especialidades
            let especialidadesHtml = '';
            if(data.especialidades && data.especialidades.length > 0) {
                especialidadesHtml = data.especialidades.map(id => {
                    return `<span style="font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-right:4px;">${tiposData[id] || 'Desconocida'}</span>`;
                }).join('');
            } else {
                especialidadesHtml = '<span style="color:#94a3b8; font-size:0.85rem;">Ninguna</span>';
            }

            tbody.innerHTML += `
                <tr>
                    <td><strong>${data.nombre}</strong></td>
                    <td>${tipoBadge}</td>
                    <td><i class="fas fa-phone fa-sm"></i> ${data.telefono || 'N/A'}<br><i class="fas fa-envelope fa-sm"></i> ${data.correo || 'N/A'}</td>
                    <td>${especialidadesHtml}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <button class="action-btn" onclick="editarProveedor('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn" onclick="eliminarProveedor('${doc.id}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// Crear Proveedor
async function abrirModalProveedor() {
    const tipos = await cargarTipos();
    
    // Generar checkboxes para especialidades
    let checkboxesHtml = '<div style="text-align:left; padding: 10px 20px; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-top:10px;"><strong>Especialidades:</strong><br>';
    for(let id in tipos) {
        checkboxesHtml += `<label style="display:block; margin-top:5px;"><input type="checkbox" class="swal-especialidad" value="${id}"> ${tipos[id]}</label>`;
    }
    checkboxesHtml += '</div>';

    Swal.fire({
        title: 'Nuevo Proveedor / Técnico',
        html: `
            <select id="swal-tipo" class="swal2-input">
                <option value="Interno">Personal Interno</option>
                <option value="Externo">Técnico Externo</option>
                <option value="Empresa">Empresa Proveedora</option>
            </select>
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre completo o Empresa">
            <input id="swal-telefono" class="swal2-input" placeholder="Teléfono">
            <input id="swal-correo" class="swal2-input" placeholder="Correo (Opcional)">
            <input id="swal-tarifa" type="number" class="swal2-input" placeholder="Tarifa base (Opcional)">
            
            ${checkboxesHtml}
            
            <select id="swal-estado" class="swal2-input">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        preConfirm: () => {
            // Recoger checkboxes seleccionados
            const especialidades = Array.from(document.querySelectorAll('.swal-especialidad:checked')).map(cb => cb.value);
            
            return {
                tipo: document.getElementById('swal-tipo').value,
                nombre: document.getElementById('swal-nombre').value,
                telefono: document.getElementById('swal-telefono').value,
                correo: document.getElementById('swal-correo').value,
                tarifaBase: document.getElementById('swal-tarifa').value ? Number(document.getElementById('swal-tarifa').value) : null,
                especialidades: especialidades,
                estado: document.getElementById('swal-estado').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;
            if(!data.nombre) {
                Swal.fire('Error', 'El nombre es requerido.', 'error');
                return;
            }
            proveedoresCollection.add(data).then(() => {
                Swal.fire('Guardado', 'Proveedor registrado exitosamente.', 'success');
            }).catch(error => {
                Swal.fire('Error', error.message, 'error');
            });
        }
    });
}

// Editar Proveedor
async function editarProveedor(id) {
    const doc = await proveedoresCollection.doc(id).get();
    const data = doc.data();
    const tipos = await cargarTipos();
    
    // Generar checkboxes
    let checkboxesHtml = '<div style="text-align:left; padding: 10px 20px; max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-top:10px;"><strong>Especialidades:</strong><br>';
    for(let tId in tipos) {
        const isChecked = (data.especialidades && data.especialidades.includes(tId)) ? 'checked' : '';
        checkboxesHtml += `<label style="display:block; margin-top:5px;"><input type="checkbox" class="swal-especialidad" value="${tId}" ${isChecked}> ${tipos[tId]}</label>`;
    }
    checkboxesHtml += '</div>';

    Swal.fire({
        title: 'Editar Proveedor / Técnico',
        html: `
            <select id="swal-tipo" class="swal2-input">
                <option value="Interno" ${data.tipo === 'Interno' ? 'selected' : ''}>Personal Interno</option>
                <option value="Externo" ${data.tipo === 'Externo' ? 'selected' : ''}>Técnico Externo</option>
                <option value="Empresa" ${data.tipo === 'Empresa' ? 'selected' : ''}>Empresa Proveedora</option>
            </select>
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre" value="${data.nombre}">
            <input id="swal-telefono" class="swal2-input" placeholder="Teléfono" value="${data.telefono || ''}">
            <input id="swal-correo" class="swal2-input" placeholder="Correo" value="${data.correo || ''}">
            <input id="swal-tarifa" type="number" class="swal2-input" placeholder="Tarifa base" value="${data.tarifaBase || ''}">
            
            ${checkboxesHtml}
            
            <select id="swal-estado" class="swal2-input">
                <option value="Activo" ${data.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                <option value="Inactivo" ${data.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        preConfirm: () => {
            const especialidades = Array.from(document.querySelectorAll('.swal-especialidad:checked')).map(cb => cb.value);
            return {
                tipo: document.getElementById('swal-tipo').value,
                nombre: document.getElementById('swal-nombre').value,
                telefono: document.getElementById('swal-telefono').value,
                correo: document.getElementById('swal-correo').value,
                tarifaBase: document.getElementById('swal-tarifa').value ? Number(document.getElementById('swal-tarifa').value) : null,
                especialidades: especialidades,
                estado: document.getElementById('swal-estado').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newData = result.value;
            if(!newData.nombre) {
                Swal.fire('Error', 'El nombre es requerido.', 'error');
                return;
            }
            proveedoresCollection.doc(id).update(newData).then(() => {
                Swal.fire('Actualizado', 'Datos actualizados.', 'success');
            });
        }
    });
}

// Eliminar Proveedor
function eliminarProveedor(id) {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede revertir",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Validar dependencias (Si tiene mantenimientos asignados no se debe borrar, idealmente)
            proveedoresCollection.doc(id).delete().then(() => {
                Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');
            });
        }
    });
}

// Inicializar
cargarTipos().then(() => {
    cargarProveedores();
});
