const tiposCollection = db.collection('tipos_mantenimiento');

// Cargar tipos
function cargarTipos() {
    tiposCollection.onSnapshot(snap => {
        const tbody = document.getElementById('lista-tipos');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const estadoBadge = data.estado === 'Activo' ? '<span class="badge badge-active">Activo</span>' : '<span class="badge badge-inactive">Inactivo</span>';
            const reqExterno = data.requiereTecnicoExterno ? 'Sí' : 'No';
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${data.nombre}</strong><br><small style="color:#64748b">${data.descripcion || ''}</small></td>
                    <td>${data.frecuenciaSugerida || 'N/A'}</td>
                    <td>${reqExterno}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <button class="action-btn" onclick="editarTipo('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn" onclick="eliminarTipo('${doc.id}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// Crear Tipo
function abrirModalTipo() {
    Swal.fire({
        title: 'Nuevo Tipo de Mantenimiento',
        html: `
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre (Ej: Aire acondicionado)">
            <input id="swal-descripcion" class="swal2-input" placeholder="Descripción (Opcional)">
            <select id="swal-frecuencia" class="swal2-input">
                <option value="" disabled selected>Frecuencia Sugerida</option>
                <option value="Mensual">Mensual</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Semestral">Semestral</option>
                <option value="Anual">Anual</option>
                <option value="Bajo Demanda">Bajo Demanda</option>
            </select>
            <div style="margin-top: 15px; text-align: left; padding: 0 20px;">
                <label><input type="checkbox" id="swal-externo"> Requiere técnico externo</label>
            </div>
            <select id="swal-estado" class="swal2-input">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                descripcion: document.getElementById('swal-descripcion').value,
                frecuenciaSugerida: document.getElementById('swal-frecuencia').value,
                requiereTecnicoExterno: document.getElementById('swal-externo').checked,
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
            tiposCollection.add(data).then(() => {
                Swal.fire('Guardado', 'El tipo de mantenimiento se ha creado exitosamente.', 'success');
            }).catch(error => {
                Swal.fire('Error', error.message, 'error');
            });
        }
    });
}

// Editar Tipo
async function editarTipo(id) {
    const doc = await tiposCollection.doc(id).get();
    const data = doc.data();

    Swal.fire({
        title: 'Editar Tipo',
        html: `
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre" value="${data.nombre}">
            <input id="swal-descripcion" class="swal2-input" placeholder="Descripción" value="${data.descripcion || ''}">
            <select id="swal-frecuencia" class="swal2-input">
                <option value="Mensual" ${data.frecuenciaSugerida === 'Mensual' ? 'selected' : ''}>Mensual</option>
                <option value="Trimestral" ${data.frecuenciaSugerida === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
                <option value="Semestral" ${data.frecuenciaSugerida === 'Semestral' ? 'selected' : ''}>Semestral</option>
                <option value="Anual" ${data.frecuenciaSugerida === 'Anual' ? 'selected' : ''}>Anual</option>
                <option value="Bajo Demanda" ${data.frecuenciaSugerida === 'Bajo Demanda' ? 'selected' : ''}>Bajo Demanda</option>
            </select>
            <div style="margin-top: 15px; text-align: left; padding: 0 20px;">
                <label><input type="checkbox" id="swal-externo" ${data.requiereTecnicoExterno ? 'checked' : ''}> Requiere técnico externo</label>
            </div>
            <select id="swal-estado" class="swal2-input">
                <option value="Activo" ${data.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                <option value="Inactivo" ${data.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                descripcion: document.getElementById('swal-descripcion').value,
                frecuenciaSugerida: document.getElementById('swal-frecuencia').value,
                requiereTecnicoExterno: document.getElementById('swal-externo').checked,
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
            tiposCollection.doc(id).update(newData).then(() => {
                Swal.fire('Actualizado', 'El tipo se ha actualizado.', 'success');
            });
        }
    });
}

// Eliminar Tipo
function eliminarTipo(id) {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede revertir",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Verificar dependencias con equipos en el futuro
            const equiposUsando = await db.collection('equipos_mantenimiento').where('tipoEquipoId', '==', id).get();
            if(!equiposUsando.empty) {
                Swal.fire('Error', 'No puedes eliminar este tipo porque hay equipos asociados a él.', 'error');
                return;
            }

            tiposCollection.doc(id).delete().then(() => {
                Swal.fire('Eliminado', 'El tipo ha sido eliminado.', 'success');
            });
        }
    });
}

// Inicializar
cargarTipos();
