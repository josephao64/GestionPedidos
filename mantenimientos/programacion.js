const programacionCollection = db.collection('mantenimientos_programados');
const registrosCollection = db.collection('mantenimientos_registros');
const equiposCollection = db.collection('equipos_mantenimiento');
const proveedoresCollection = db.collection('proveedores_mantenimiento');
const sucursalesCollection = db.collection('sucursales');

let cacheEquipos = {};
let cacheProveedores = {};
let cacheSucursales = {};
let programacionesPendientes = []; // Guarda las que necesitan generar orden

async function cargarDependencias() {
    const eSnap = await equiposCollection.get();
    eSnap.forEach(doc => { cacheEquipos[doc.id] = doc.data(); });

    const pSnap = await proveedoresCollection.get();
    pSnap.forEach(doc => { cacheProveedores[doc.id] = doc.data(); });

    const sSnap = await sucursalesCollection.get();
    sSnap.forEach(doc => { cacheSucursales[doc.id] = doc.data().name; });
}

function calcularProximaFecha(fechaAnterior, frecuencia) {
    let m = moment(fechaAnterior);
    switch(frecuencia) {
        case 'Semanal': m.add(1, 'weeks'); break;
        case 'Quincenal': m.add(2, 'weeks'); break;
        case 'Mensual': m.add(1, 'months'); break;
        case 'Trimestral': m.add(3, 'months'); break;
        case 'Semestral': m.add(6, 'months'); break;
        case 'Anual': m.add(1, 'years'); break;
    }
    return m.toDate();
}

function cargarProgramaciones() {
    programacionCollection.onSnapshot(snap => {
        const tbody = document.getElementById('lista-programaciones');
        tbody.innerHTML = '';
        programacionesPendientes = [];
        
        const hoy = moment().startOf('day');

        snap.forEach(doc => {
            const data = doc.data();
            const equipo = cacheEquipos[data.equipoId] || {};
            const equipoNombre = equipo.nombre ? `${equipo.codigoVisible || ''} - ${equipo.nombre}` : 'Equipo Eliminado';
            const sucursalNombre = cacheSucursales[equipo.sucursalId] || 'Desconocida';
            const tecnicoNombre = cacheProveedores[data.tecnicoSugeridoId] ? cacheProveedores[data.tecnicoSugeridoId].nombre : 'Sin asignar';
            
            let proximaFechaStr = 'N/A';
            let fechaClass = 'proxima-ok';
            
            if(data.proximaFecha) {
                const proxima = moment(data.proximaFecha.toDate());
                proximaFechaStr = proxima.format('DD/MM/YYYY');
                
                if (data.estado === 'Activa') {
                    if (proxima.isBefore(hoy)) {
                        fechaClass = 'proxima-vencida';
                        programacionesPendientes.push({ id: doc.id, data: data, equipo: equipo });
                    } else if (proxima.diff(hoy, 'days') <= 7) {
                        fechaClass = 'proxima-alerta'; // Menos de 7 días
                        programacionesPendientes.push({ id: doc.id, data: data, equipo: equipo });
                    }
                }
            }

            let estadoClass = 'badge-activa';
            if(data.estado === 'Pausada') estadoClass = 'badge-pausada';
            if(data.estado === 'Cancelada') estadoClass = 'badge-cancelada';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${equipoNombre}</strong><br><small style="color:#64748b">${sucursalNombre}</small></td>
                    <td>${data.frecuencia}</td>
                    <td class="${fechaClass}">${proximaFechaStr}</td>
                    <td>${tecnicoNombre}</td>
                    <td><span class="badge ${estadoClass}">${data.estado}</span></td>
                    <td>
                        <button class="action-btn" onclick="editarProgramacion('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-btn" onclick="eliminarProgramacion('${doc.id}')" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

async function abrirModalProgramacion() {
    let eqHtml = '<option value="" disabled selected>Seleccione Equipo</option>';
    for(let id in cacheEquipos) {
        const eq = cacheEquipos[id];
        const sucNom = cacheSucursales[eq.sucursalId] || '';
        eqHtml += `<option value="${id}">${eq.codigoVisible || ''} - ${eq.nombre} (${sucNom})</option>`;
    }
    
    let provHtml = '<option value="">Sin Asignar</option>';
    for(let id in cacheProveedores) provHtml += `<option value="${id}">${cacheProveedores[id].nombre}</option>`;

    Swal.fire({
        title: 'Programar Mantenimiento Recurrente',
        width: 600,
        html: `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align:left;">
                <div style="grid-column: span 2">
                    <label>Equipo a Programar</label>
                    <select id="swal-equipo" class="swal2-input" style="margin-top:5px">
                        ${eqHtml}
                    </select>
                </div>
                <div>
                    <label>Frecuencia</label>
                    <select id="swal-frecuencia" class="swal2-input" style="margin-top:5px">
                        <option value="Semanal">Semanal</option>
                        <option value="Quincenal">Quincenal</option>
                        <option value="Mensual">Mensual</option>
                        <option value="Trimestral">Trimestral</option>
                        <option value="Semestral">Semestral</option>
                        <option value="Anual">Anual</option>
                    </select>
                </div>
                <div>
                    <label>Fecha de Inicio (Último o Siguiente)</label>
                    <input type="date" id="swal-fecha" class="swal2-input" style="margin-top:5px">
                </div>
                <div>
                    <label>Técnico Sugerido</label>
                    <select id="swal-tecnico" class="swal2-input" style="margin-top:5px">
                        ${provHtml}
                    </select>
                </div>
                <div>
                    <label>Costo Estimado</label>
                    <input type="number" id="swal-costo" class="swal2-input" style="margin-top:5px" value="0">
                </div>
                <div>
                    <label>Estado</label>
                    <select id="swal-estado" class="swal2-input" style="margin-top:5px">
                        <option value="Activa">Activa</option>
                        <option value="Pausada">Pausada</option>
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        preConfirm: () => {
            const eqId = document.getElementById('swal-equipo').value;
            const fec = document.getElementById('swal-fecha').value;
            if(!eqId || !fec) {
                Swal.showValidationMessage('Debe seleccionar equipo y fecha de inicio');
                return false;
            }

            const frec = document.getElementById('swal-frecuencia').value;
            const fechaInicialObj = new Date(fec + 'T12:00:00');
            
            return {
                equipoId: eqId,
                tipo: 'Preventivo',
                frecuencia: frec,
                fechaInicial: firebase.firestore.Timestamp.fromDate(fechaInicialObj),
                proximaFecha: firebase.firestore.Timestamp.fromDate(calcularProximaFecha(fechaInicialObj, frec)),
                tecnicoSugeridoId: document.getElementById('swal-tecnico').value,
                costoEstimado: Number(document.getElementById('swal-costo').value),
                estado: document.getElementById('swal-estado').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            programacionCollection.add(result.value).then(() => {
                Swal.fire('Guardado', 'Programación creada exitosamente.', 'success');
            });
        }
    });
}

function generarOrdenesPendientes() {
    if(programacionesPendientes.length === 0) {
        Swal.fire('Todo al día', 'No hay mantenimientos programados que requieran generación de orden.', 'info');
        return;
    }

    Swal.fire({
        title: 'Generar Órdenes',
        text: `Hay ${programacionesPendientes.length} programaciones vencidas o próximas (menos de 7 días). ¿Generar órdenes de mantenimiento preventivo para ellas?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Generar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Generando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            
            // Obtener el último número de orden
            const year = new Date().getFullYear();
            const prefijo = `OS-${year}-`;
            const snap = await registrosCollection.where('codigoOrden', '>=', prefijo).where('codigoOrden', '<', prefijo + '\uf8ff').orderBy('codigoOrden', 'desc').limit(1).get();
            let nextNum = 1;
            if (!snap.empty) {
                const lastCode = snap.docs[0].data().codigoOrden;
                if(lastCode) {
                    const parts = lastCode.split('-');
                    if (parts.length === 3) nextNum = parseInt(parts[2]) + 1;
                }
            }

            const batch = db.batch();
            
            programacionesPendientes.forEach(p => {
                const codigoActual = `${prefijo}${String(nextNum).padStart(4, '0')}`;
                nextNum++;

                // 1. Crear nuevo registro en mantenimientos_registros
                const nuevoRegistroRef = registrosCollection.doc();
                batch.set(nuevoRegistroRef, {
                    codigoOrden: codigoActual,
                    programacionId: p.id,
                    frecuencia: p.data.frecuencia,
                    tipo: 'Preventivo',
                    prioridad: 'Media',
                    sucursalId: p.equipo.sucursalId || '',
                    areaId: p.equipo.areaId || '',
                    equipoId: p.data.equipoId,
                    servicioSolicitado: `Mantenimiento Preventivo ${p.data.frecuencia}`,
                    descripcionProblema: 'Generado automáticamente según programación.',
                    tecnicoId: p.data.tecnicoSugeridoId || '',
                    fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                    fechaProgramada: p.data.proximaFecha, // Queda programado para esa fecha
                    estado: 'Programado',
                    costoEstimado: p.data.costoEstimado || 0,
                    costoReal: 0,
                    requierePago: false,
                    estadoPago: 'Pendiente'
                });

                // 2. Actualizar la próxima fecha en la programación
                const proxFecActual = p.data.proximaFecha.toDate();
                const nuevaProximaFec = calcularProximaFecha(proxFecActual, p.data.frecuencia);
                const progRef = programacionCollection.doc(p.id);
                batch.update(progRef, {
                    proximaFecha: firebase.firestore.Timestamp.fromDate(nuevaProximaFec)
                });
            });

            batch.commit().then(() => {
                Swal.fire('Completado', 'Las órdenes se generaron y las próximas fechas fueron actualizadas.', 'success');
            }).catch(e => Swal.fire('Error', e.message, 'error'));
        }
    });
}

function eliminarProgramacion(id) {
    Swal.fire({
        title: '¿Eliminar programación?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí'
    }).then((result) => {
        if (result.isConfirmed) {
            programacionCollection.doc(id).delete().then(() => Swal.fire('Eliminado', '', 'success'));
        }
    });
}

// Inicializar
cargarDependencias().then(() => {
    cargarProgramaciones();
});
