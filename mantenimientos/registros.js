const registrosCollection = db.collection('mantenimientos_registros');
const equiposCollection = db.collection('equipos_mantenimiento');
const proveedoresCollection = db.collection('proveedores_mantenimiento');
const sucursalesCollection = db.collection('sucursales');
const areasCollection = db.collection('areas_mantenimiento');

let cacheSucursales = {};
let cacheAreas = {};
let cacheEquipos = {};
let cacheProveedores = {};

// Generar OS-YYYY-XXXX
async function generarCodigoOrden() {
    const year = new Date().getFullYear();
    const prefijo = `OS-${year}-`;
    const snap = await registrosCollection.where('codigoOrden', '>=', prefijo).where('codigoOrden', '<', prefijo + '\uf8ff').orderBy('codigoOrden', 'desc').limit(1).get();
    
    let nextNum = 1;
    if (!snap.empty) {
        const lastCode = snap.docs[0].data().codigoOrden;
        const parts = lastCode.split('-');
        if (parts.length === 3) {
            nextNum = parseInt(parts[2]) + 1;
        }
    }
    return `${prefijo}${String(nextNum).padStart(4, '0')}`;
}

// Cargar dependencias para mostrar nombres y poblar selects
async function cargarDependencias() {
    const sSnap = await sucursalesCollection.get();
    const selectSucursal = document.getElementById('filter-sucursal');
    sSnap.forEach(doc => {
        cacheSucursales[doc.id] = doc.data().name;
        selectSucursal.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });

    const aSnap = await areasCollection.get();
    aSnap.forEach(doc => { cacheAreas[doc.id] = doc.data(); });

    const eSnap = await equiposCollection.get();
    eSnap.forEach(doc => { cacheEquipos[doc.id] = doc.data(); });

    const pSnap = await proveedoresCollection.get();
    pSnap.forEach(doc => { cacheProveedores[doc.id] = doc.data(); });
}

function cargarMantenimientos() {
    const fEstado = document.getElementById('filter-estado').value;
    const fSucursal = document.getElementById('filter-sucursal').value;
    const fTipo = document.getElementById('filter-tipo').value;

    let query = registrosCollection;
    if (fEstado) query = query.where('estado', '==', fEstado);
    if (fSucursal) query = query.where('sucursalId', '==', fSucursal);
    if (fTipo) query = query.where('tipo', '==', fTipo);

    // Ordenar por fecha de solicitud descendente
    query.orderBy('fechaSolicitud', 'desc').onSnapshot(snap => {
        const tbody = document.getElementById('lista-registros');
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            
            const equipo = cacheEquipos[data.equipoId] || {};
            const equipoNombre = equipo.nombre ? `${equipo.codigoVisible || ''} - ${equipo.nombre}` : 'Equipo Eliminado';
            const sucursalNombre = cacheSucursales[data.sucursalId] || 'Desconocida';
            const proveedorNombre = cacheProveedores[data.tecnicoId] ? cacheProveedores[data.tecnicoId].nombre : 'Sin asignar';
            
            const fechaStr = data.fechaSolicitud ? new Date(data.fechaSolicitud.toDate()).toLocaleDateString() : 'N/A';
            
            let estadoClass = 'estado-solicitado';
            const e = data.estado.toLowerCase();
            if(e.includes('programado')) estadoClass = 'estado-programado';
            if(e.includes('proceso')) estadoClass = 'estado-proceso';
            if(e.includes('finalizado')) estadoClass = 'estado-finalizado';
            if(e.includes('validado')) estadoClass = 'estado-validado';
            if(e.includes('pagado')) estadoClass = 'estado-pagado';
            if(e.includes('cancelado')) estadoClass = 'estado-cancelado';

            let prioClass = 'prioridad-baja';
            if(data.prioridad === 'Media') prioClass = 'prioridad-media';
            if(data.prioridad === 'Alta') prioClass = 'prioridad-alta';
            if(data.prioridad === 'Urgente') prioClass = 'prioridad-urgente';

            tbody.innerHTML += `
                <tr>
                    <td><span style="font-family: monospace; font-weight: bold; color: #0284c7; background: #e0f2fe; padding: 4px 8px; border-radius: 4px;">${data.codigoOrden || 'S/N'}</span></td>
                    <td>${fechaStr}<br><small style="color:#64748b">${data.tipo}</small></td>
                    <td><strong>${equipoNombre}</strong><br><small style="color:#64748b">${sucursalNombre}</small></td>
                    <td>${data.servicioSolicitado}</td>
                    <td>${proveedorNombre}</td>
                    <td class="${prioClass}">${data.prioridad}</td>
                    <td><span class="badge ${estadoClass}">${data.estado}</span></td>
                    <td>
                        <button class="action-btn" onclick="imprimirOrden('${doc.id}')" title="Imprimir Orden"><i class="fas fa-print"></i></button>
                        <button class="action-btn" onclick="gestionarRegistro('${doc.id}')" title="Gestionar / Ver Detalles"><i class="fas fa-tasks"></i></button>
                    </td>
                </tr>
            `;
        });
    });
}

// Helpers para selects dinámicos en el modal
function getAreas(currentAreaId = '') {
    let html = '<option value="" disabled selected>Seleccione Área</option>';
    for(let id in cacheAreas) {
        const selected = id === currentAreaId ? 'selected' : '';
        html += `<option value="${id}" ${selected}>${cacheAreas[id].nombre}</option>`;
    }
    return html;
}

function getEquipos(areaId) {
    let html = '<option value="" disabled selected>Seleccione Equipo</option>';
    for(let id in cacheEquipos) {
        if(cacheEquipos[id].areaId === areaId) {
            html += `<option value="${id}">${cacheEquipos[id].codigoVisible || ''} - ${cacheEquipos[id].nombre}</option>`;
        }
    }
    return html;
}

async function abrirModalRegistro() {
    let sucursalesHtml = '<option value="" disabled selected>Seleccione Sucursal</option>';
    for(let id in cacheSucursales) sucursalesHtml += `<option value="${id}">${cacheSucursales[id]}</option>`;
    
    let provHtml = '<option value="">Sin Asignar</option>';
    for(let id in cacheProveedores) provHtml += `<option value="${id}">${cacheProveedores[id].nombre}</option>`;

    Swal.fire({
        title: 'Nueva Solicitud de Mantenimiento',
        width: 700,
        html: `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align:left;">
                <div>
                    <label>Tipo</label>
                    <select id="swal-tipo" class="swal2-input" style="margin-top:5px">
                        <option value="Correctivo">Correctivo (Falla detectada)</option>
                        <option value="Preventivo">Preventivo (Programado)</option>
                    </select>
                </div>
                <div>
                    <label>Prioridad</label>
                    <select id="swal-prioridad" class="swal2-input" style="margin-top:5px">
                        <option value="Baja">Baja</option>
                        <option value="Media" selected>Media</option>
                        <option value="Alta">Alta</option>
                        <option value="Urgente">Urgente</option>
                    </select>
                </div>
                <div>
                    <label>Sucursal</label>
                    <select id="swal-sucursal" class="swal2-input" style="margin-top:5px">
                        ${sucursalesHtml}
                    </select>
                </div>
                <div>
                    <label>Área</label>
                    <select id="swal-area" class="swal2-input" style="margin-top:5px" onchange="document.getElementById('swal-equipo').innerHTML = getEquipos(this.value)">
                        ${getAreas()}
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Equipo</label>
                    <select id="swal-equipo" class="swal2-input" style="margin-top:5px">
                        <option value="" disabled selected>Seleccione Equipo</option>
                    </select>
                </div>
                <div style="grid-column: span 2">
                    <label>Servicio Solicitado</label>
                    <input id="swal-servicio" class="swal2-input" style="margin-top:5px" placeholder="Ej: El aire no enfría / Revisión mensual">
                </div>
                <div style="grid-column: span 2">
                    <label>Descripción del Problema</label>
                    <textarea id="swal-desc" class="swal2-textarea" style="margin-top:5px; height:80px;"></textarea>
                </div>
                <div>
                    <label>Técnico / Proveedor</label>
                    <select id="swal-tecnico" class="swal2-input" style="margin-top:5px">
                        ${provHtml}
                    </select>
                </div>
                <div>
                    <label>Fecha Programada (Opcional)</label>
                    <input type="date" id="swal-fecha-prog" class="swal2-input" style="margin-top:5px">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        didOpen: () => {
            window.getAreas = getAreas;
            window.getEquipos = getEquipos;
        },
        preConfirm: async () => {
            const equipoId = document.getElementById('swal-equipo').value;
            const servicio = document.getElementById('swal-servicio').value;
            if(!equipoId || !servicio) {
                Swal.showValidationMessage('Debe seleccionar un equipo y escribir el servicio solicitado');
                return false;
            }
            
            const fp = document.getElementById('swal-fecha-prog').value;
            let fechaProgramada = null;
            if(fp) {
                // Convertir a firestore timestamp si hay fecha (evitar timezones raros agregando horas)
                fechaProgramada = firebase.firestore.Timestamp.fromDate(new Date(fp + 'T12:00:00'));
            }

            const tecId = document.getElementById('swal-tecnico').value;
            let estado = 'Solicitado';
            if(fp || tecId) estado = 'Programado';

            const nextCodigo = await generarCodigoOrden();

            return {
                codigoOrden: nextCodigo,
                tipo: document.getElementById('swal-tipo').value,
                prioridad: document.getElementById('swal-prioridad').value,
                sucursalId: document.getElementById('swal-sucursal').value,
                areaId: document.getElementById('swal-area').value,
                equipoId: equipoId,
                servicioSolicitado: servicio,
                descripcionProblema: document.getElementById('swal-desc').value,
                tecnicoId: tecId,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaProgramada: fechaProgramada,
                estado: estado,
                costoEstimado: 0,
                costoReal: 0,
                requierePago: false,
                estadoPago: 'Pendiente',
                fotoAntesUrl: '',
                fotoDespuesUrl: '',
                observaciones: ''
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            registrosCollection.add(result.value).then(() => {
                Swal.fire('Guardado', 'Solicitud registrada.', 'success');
            });
        }
    });
}

// Gestionar Registro (Vista Detallada para cambiar estados)
async function gestionarRegistro(id) {
    const doc = await registrosCollection.doc(id).get();
    const data = doc.data();

    let provHtml = '<option value="">Sin Asignar</option>';
    for(let pid in cacheProveedores) {
        provHtml += `<option value="${pid}" ${pid === data.tecnicoId ? 'selected' : ''}>${cacheProveedores[pid].nombre}</option>`;
    }

    const formatDateForInput = (ts) => {
        if(!ts) return '';
        const d = ts.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    Swal.fire({
        title: 'Gestión de Mantenimiento',
        width: 800,
        html: `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align:left; max-height: 65vh; overflow-y:auto; padding-right:10px;">
                
                <div style="grid-column: span 2; background: #f8fafc; padding: 15px; border-radius: 8px;">
                    <h4 style="margin:0 0 10px 0; color:#1e293b;">Detalles Actuales</h4>
                    <p style="margin:0; font-size:0.9rem;"><strong>Servicio:</strong> ${data.servicioSolicitado}</p>
                    <p style="margin:5px 0 0 0; font-size:0.9rem;"><strong>Equipo:</strong> ${cacheEquipos[data.equipoId] ? cacheEquipos[data.equipoId].nombre : 'N/A'}</p>
                </div>

                <div>
                    <label>Estado del Servicio</label>
                    <select id="swal-estado" class="swal2-input" style="margin-top:5px; background: #fef3c7;">
                        <option value="Solicitado" ${data.estado === 'Solicitado' ? 'selected' : ''}>Solicitado</option>
                        <option value="Programado" ${data.estado === 'Programado' ? 'selected' : ''}>Programado</option>
                        <option value="En proceso" ${data.estado === 'En proceso' ? 'selected' : ''}>En proceso</option>
                        <option value="Finalizado" ${data.estado === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                        <option value="Validado" ${data.estado === 'Validado' ? 'selected' : ''}>Validado (Admin)</option>
                        <option value="Pagado" ${data.estado === 'Pagado' ? 'selected' : ''}>Pagado</option>
                        <option value="Cancelado" ${data.estado === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
                <div>
                    <label>Técnico / Proveedor</label>
                    <select id="swal-tecnico" class="swal2-input" style="margin-top:5px">
                        ${provHtml}
                    </select>
                </div>

                <div>
                    <label>Fecha Programada</label>
                    <input type="date" id="swal-fecha-prog" class="swal2-input" style="margin-top:5px" value="${formatDateForInput(data.fechaProgramada)}">
                </div>
                <div>
                    <label>Fecha Finalizado</label>
                    <input type="date" id="swal-fecha-fin" class="swal2-input" style="margin-top:5px" value="${formatDateForInput(data.fechaFinalizado)}">
                </div>

                <div style="grid-column: span 2; margin-top:10px;">
                    <hr style="border:1px solid #f1f5f9;">
                    <h4 style="margin:10px 0; color:#1e293b;">Costos y Evidencias</h4>
                </div>

                <div>
                    <label>Costo Estimado</label>
                    <input type="number" id="swal-costo-est" class="swal2-input" style="margin-top:5px" value="${data.costoEstimado || 0}">
                </div>
                <div>
                    <label>Costo Real</label>
                    <input type="number" id="swal-costo-real" class="swal2-input" style="margin-top:5px; border-color: #10b981;" value="${data.costoReal || 0}">
                </div>

                <div style="grid-column: span 2;">
                    <label><input type="checkbox" id="swal-req-pago" ${data.requierePago ? 'checked' : ''}> Requiere Pago</label>
                    <select id="swal-estado-pago" class="swal2-input" style="margin-top:5px; width: 50%; display:inline-block; margin-left: 20px;">
                        <option value="Pendiente" ${data.estadoPago === 'Pendiente' ? 'selected' : ''}>Pago Pendiente</option>
                        <option value="Parcial" ${data.estadoPago === 'Parcial' ? 'selected' : ''}>Pago Parcial</option>
                        <option value="Pagado" ${data.estadoPago === 'Pagado' ? 'selected' : ''}>Pagado Completamente</option>
                    </select>
                </div>

                <div>
                    <label>Foto Evidencia (URL Antes)</label>
                    <input id="swal-foto-antes" class="swal2-input" style="margin-top:5px; font-size: 0.8rem;" placeholder="Link a Google Drive o Imgur" value="${data.fotoAntesUrl || ''}">
                </div>
                <div>
                    <label>Foto Evidencia (URL Después)</label>
                    <input id="swal-foto-despues" class="swal2-input" style="margin-top:5px; font-size: 0.8rem;" placeholder="Link a Google Drive o Imgur" value="${data.fotoDespuesUrl || ''}">
                </div>

                <div style="grid-column: span 2">
                    <label>Observaciones del Técnico/Admin</label>
                    <textarea id="swal-obs" class="swal2-textarea" style="margin-top:5px; height:80px;">${data.observaciones || ''}</textarea>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        preConfirm: () => {
            const fp = document.getElementById('swal-fecha-prog').value;
            const ff = document.getElementById('swal-fecha-fin').value;

            return {
                estado: document.getElementById('swal-estado').value,
                tecnicoId: document.getElementById('swal-tecnico').value,
                fechaProgramada: fp ? firebase.firestore.Timestamp.fromDate(new Date(fp + 'T12:00:00')) : null,
                fechaFinalizado: ff ? firebase.firestore.Timestamp.fromDate(new Date(ff + 'T12:00:00')) : null,
                costoEstimado: Number(document.getElementById('swal-costo-est').value),
                costoReal: Number(document.getElementById('swal-costo-real').value),
                requierePago: document.getElementById('swal-req-pago').checked,
                estadoPago: document.getElementById('swal-estado-pago').value,
                fotoAntesUrl: document.getElementById('swal-foto-antes').value,
                fotoDespuesUrl: document.getElementById('swal-foto-despues').value,
                observaciones: document.getElementById('swal-obs').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            registrosCollection.doc(id).update(result.value).then(() => {
                
                // LÓGICA DE PROGRAMACIÓN AUTOMÁTICA
                if ((result.value.estado === 'Finalizado' || result.value.estado === 'Pagado') && data.programacionId && data.frecuencia) {
                    const fechaBase = result.value.fechaFinalizado ? result.value.fechaFinalizado.toDate() : new Date();
                    let m = moment(fechaBase);
                    switch(data.frecuencia) {
                        case 'Semanal': m.add(1, 'weeks'); break;
                        case 'Quincenal': m.add(2, 'weeks'); break;
                        case 'Mensual': m.add(1, 'months'); break;
                        case 'Trimestral': m.add(3, 'months'); break;
                        case 'Semestral': m.add(6, 'months'); break;
                        case 'Anual': m.add(1, 'years'); break;
                    }
                    db.collection('mantenimientos_programados').doc(data.programacionId).update({
                        proximaFecha: firebase.firestore.Timestamp.fromDate(m.toDate())
                    });
                }

                Swal.fire('Actualizado', 'El estado y datos del mantenimiento han sido actualizados.', 'success');
            }).catch(e => Swal.fire('Error', e.message, 'error'));
        }
    });
}

// Imprimir Orden de Servicio
async function imprimirOrden(id) {
    const doc = await registrosCollection.doc(id).get();
    const data = doc.data();

    const equipo = cacheEquipos[data.equipoId] || {};
    const sucursalNom = cacheSucursales[data.sucursalId] || 'Desconocida';
    const areaNom = cacheAreas[data.areaId] ? cacheAreas[data.areaId].nombre : 'Desconocida';
    const tecnicoNom = cacheProveedores[data.tecnicoId] ? cacheProveedores[data.tecnicoId].nombre : 'Sin asignar';
    const fechaEmision = new Date().toLocaleDateString();

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Orden de Servicio ${data.codigoOrden || ''}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                .header h2 { margin: 5px 0 0 0; font-size: 18px; color: #666; }
                .row { display: flex; justify-content: space-between; margin-bottom: 15px; }
                .box { border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                .box-title { font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; color: #666; }
                .field { margin-bottom: 8px; }
                .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
                .sign-box { text-align: center; width: 250px; }
                .sign-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ORDEN DE SERVICIO</h1>
                <h2>No. ${data.codigoOrden || 'S/N'}</h2>
            </div>
            
            <div class="row">
                <div><strong>Fecha de Emisión:</strong> ${fechaEmision}</div>
                <div><strong>Prioridad:</strong> ${data.prioridad}</div>
                <div><strong>Estado:</strong> ${data.estado}</div>
            </div>

            <div class="box">
                <div class="box-title">Ubicación y Equipo</div>
                <div class="field"><strong>Sucursal:</strong> ${sucursalNom}</div>
                <div class="field"><strong>Área:</strong> ${areaNom}</div>
                <div class="field"><strong>Equipo:</strong> ${equipo.codigoVisible || ''} - ${equipo.nombre || 'N/A'}</div>
                ${equipo.marca ? `<div class="field"><strong>Marca/Modelo:</strong> ${equipo.marca} / ${equipo.modelo || ''}</div>` : ''}
            </div>

            <div class="box">
                <div class="box-title">Detalles del Trabajo</div>
                <div class="field"><strong>Tipo de Mantenimiento:</strong> ${data.tipo}</div>
                <div class="field"><strong>Técnico Asignado:</strong> ${tecnicoNom}</div>
                <div class="field"><strong>Servicio Solicitado:</strong><br>${data.servicioSolicitado}</div>
                <div class="field" style="margin-top: 10px;"><strong>Descripción del Problema:</strong><br>${data.descripcionProblema || 'N/A'}</div>
            </div>

            <div class="box" style="min-height: 100px;">
                <div class="box-title">Observaciones / Reporte del Técnico</div>
                <p>${data.observaciones || ''}</p>
            </div>

            <div class="signatures">
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div>Firma del Técnico</div>
                </div>
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <div>Firma del Responsable / Gerente</div>
                </div>
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Inicializar
cargarDependencias().then(() => {
    cargarMantenimientos();
});
