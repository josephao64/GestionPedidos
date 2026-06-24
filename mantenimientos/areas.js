const areasCollection = db.collection('areas_mantenimiento');

// Cargar áreas
function cargarAreas() {
    areasCollection.onSnapshot(snap => {
        const tbody = document.getElementById('lista-areas');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const estadoBadge = data.estado === 'Activa' ? '<span class="badge badge-active">Activa</span>' : '<span class="badge badge-inactive">Inactiva</span>';
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${data.nombre}</strong></td>
                    <td>${data.responsable || 'N/A'}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <button class="action-btn" onclick="editarArea('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn" onclick="eliminarArea('${doc.id}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// Crear Área
async function abrirModalArea() {
    Swal.fire({
        title: 'Nueva Área',
        html: `
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre del área (Ej: Cocina)">
            <input id="swal-responsable" class="swal2-input" placeholder="Responsable (Opcional)">
            <select id="swal-estado" class="swal2-input">
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                responsable: document.getElementById('swal-responsable').value,
                estado: document.getElementById('swal-estado').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const data = result.value;
            if(!data.nombre) {
                Swal.fire('Error', 'Nombre es requerido.', 'error');
                return;
            }
            areasCollection.add(data).then(() => {
                Swal.fire('Guardado', 'El área se ha creado exitosamente.', 'success');
            }).catch(error => {
                Swal.fire('Error', error.message, 'error');
            });
        }
    });
}

// Editar Área
async function editarArea(id) {
    const doc = await areasCollection.doc(id).get();
    const data = doc.data();

    Swal.fire({
        title: 'Editar Área',
        html: `
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre" value="${data.nombre}">
            <input id="swal-responsable" class="swal2-input" placeholder="Responsable" value="${data.responsable || ''}">
            <select id="swal-estado" class="swal2-input">
                <option value="Activa" ${data.estado === 'Activa' ? 'selected' : ''}>Activa</option>
                <option value="Inactiva" ${data.estado === 'Inactiva' ? 'selected' : ''}>Inactiva</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                responsable: document.getElementById('swal-responsable').value,
                estado: document.getElementById('swal-estado').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const newData = result.value;
            if(!newData.nombre) {
                Swal.fire('Error', 'Nombre es requerido.', 'error');
                return;
            }
            areasCollection.doc(id).update(newData).then(() => {
                Swal.fire('Actualizado', 'El área se ha actualizado.', 'success');
            });
        }
    });
}

// Eliminar Área
function eliminarArea(id) {
    // Nota: Lógica futura requerirá verificar que no haya equipos usando esta área antes de borrar.
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
            // Verificar si hay equipos asociados
            const equiposUsando = await db.collection('equipos_mantenimiento').where('areaId', '==', id).get();
            if(!equiposUsando.empty) {
                Swal.fire('Error', 'No puedes eliminar esta área porque hay equipos asociados a ella.', 'error');
                return;
            }

            areasCollection.doc(id).delete().then(() => {
                Swal.fire('Eliminado', 'El área ha sido eliminada.', 'success');
            });
        }
    });
}

// Inicializar
cargarAreas();
