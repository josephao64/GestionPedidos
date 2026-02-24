
// empleados.js
let currentEmpleadoId = null;

// Helper to update total in modal
function updateSettlementTotal() {
    const ag = parseFloat(document.getElementById('set_aguinaldo')?.value) || 0;
    const bo = parseFloat(document.getElementById('set_bono14')?.value) || 0;
    const va = parseFloat(document.getElementById('set_vacations')?.value) || 0;
    const pe = parseFloat(document.getElementById('set_pendingSalary')?.value) || 0;
    const ind = parseFloat(document.getElementById('set_indemnization')?.value) || 0;

    const total = ag + bo + va + pe + ind;
    const totalEl = document.getElementById('set_total');
    if (totalEl) totalEl.value = total.toFixed(2);
}
// Make it global so HTML oninput can see it
window.updateSettlementTotal = updateSettlementTotal;

document.addEventListener('DOMContentLoaded', () => {
    // Note: rrhh.html will call loadEmployees() when switchSection('empleados') is triggered
    initFilters();

    // Auto-generate code when Sucursal changes in Form
    const sucursalSelect = document.getElementById('emp_sucursalId');
    if (sucursalSelect) {
        sucursalSelect.addEventListener('change', () => {
            const codeInput = document.getElementById('emp_employeeCode');
            if (!currentEmpleadoId || !codeInput.value) {
                const name = sucursalSelect.options[sucursalSelect.selectedIndex].text;
                if (name && name !== 'Seleccione Sucursal...') {
                    codeInput.value = generateEmployeeCode(name);
                }
            }
        });
    }

    // Termination Reason Logic in Form
    const termReason = document.getElementById('emp_terminationReason');
    const termJust = document.getElementById('emp_terminationJustification');
    if (termReason && termJust) {
        // Find parent container (div)
        const termJustContainer = termJust.parentElement;

        function toggleJustification() {
            if (termReason.value === 'Despido') {
                termJustContainer.style.visibility = 'visible';
            } else {
                termJustContainer.style.visibility = 'hidden';
            }
        }

        termReason.addEventListener('change', toggleJustification);
    }
});

// Helper to generate initials
function getBranchInitials(name) {
    if (!name) return 'EMP';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    return words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
}

function generateEmployeeCode(sucursalName) {
    const prefix = getBranchInitials(sucursalName);
    const random = Math.floor(1000 + Math.random() * 9000); // 4 digit random
    return `${prefix}-${random}`;
}

async function initFilters() {
    try {
        const branchSelect = document.getElementById('filterSucursal');
        const positionSelect = document.getElementById('filterPuesto');
        if (!branchSelect || !positionSelect) return;

        // Reset
        branchSelect.innerHTML = '<option value="all">Todas</option>';
        positionSelect.innerHTML = '<option value="all">Todos</option>';

        const branchesSnap = await db.collection('sucursales').orderBy('name').get();
        const rawBranches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const branches = rawBranches.filter(b => b.status && b.status.toLowerCase() === 'activo');

        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });

        const positionsSnap = await db.collection('positions').orderBy('name').get();
        positionsSnap.forEach(doc => {
            positionSelect.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
        });
    } catch (e) {
        console.error("Error init filters:", e);
    }
}

async function loadEmployees() {
    const container = document.getElementById('employees-container');
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Cargando empleados...</p>
        </div>
    `;

    try {
        const snapshot = await db.collection('employees').get();

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No hay empleados registrados.</p>';
            return;
        }

        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

        // Get Filters
        const filterSucursal = document.getElementById('filterSucursal') ? document.getElementById('filterSucursal').value : 'all';
        const filterPuesto = document.getElementById('filterPuesto') ? document.getElementById('filterPuesto').value : 'all';
        const filterEstado = document.getElementById('filterEstado') ? document.getElementById('filterEstado').value : 'active';

        // Get Config for Probation
        const settings = window.rrhhConfig ? window.rrhhConfig.get() : { probationDays: 60 };
        const probationMs = settings.probationDays * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();

        // Apply Filters
        const filtered = employees.filter(emp => {
            // Sucursal Filter with Temporary Logic
            if (filterSucursal !== 'all') {
                const belongsToBranch = emp.sucursalId === filterSucursal;
                const matchesTempBranch = emp.isTempTransfer && emp.tempSucursalId === filterSucursal;

                // If filtering by branch, show:
                // 1. Employees who belong to this branch (unless filtered out by other means, but here we usually show them even if lent out, with a note).
                // 2. Employees from OTHER branches who are temporarily here.

                if (!belongsToBranch && !matchesTempBranch) return false;
            }

            // Puesto Filter
            if (filterPuesto !== 'all' && emp.positionId !== filterPuesto) return false;

            // Estado Filter
            if (filterEstado === 'all') return true;
            if (filterEstado === 'inactive') return emp.status === 'inactive';

            if (emp.status === 'inactive') return false;

            // Determine dynamic status
            // Calculate Probation per Employee Branch
            let isProbation = false;
            if (emp.startDate) {
                const settings = window.rrhhConfig.getBranchSettings(emp.sucursalId);
                const probationMs = settings.probationDays * 24 * 60 * 60 * 1000;

                const start = new Date(emp.startDate).getTime();
                if (now - start < probationMs) isProbation = true;
            }

            if (filterEstado === 'probation') return isProbation;
            if (filterEstado === 'active') return true;

            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No se encontraron empleados con los filtros seleccionados.</p>';
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead id="employeesTableHeader">
                    <tr style="text-align: left; border-bottom: 2px solid var(--border);">
                        <th style="padding: 12px;">Nombre</th>
                        <th style="padding: 12px;">DPI / Código</th>
                        <th style="padding: 12px;">Sucursal</th>
                        <th style="padding: 12px;">Puesto</th>
                        <th style="padding: 12px;">Estado</th>
                        <th style="padding: 12px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="employeesTableBody">
        `;

        filtered.forEach(data => {
            let statusLabel = '';

            if (data.status === 'inactive') {
                statusLabel = '<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600;">Inactivo</span>';
            } else {
                // Check probation
                let isProbation = false;
                let probationEndDateStr = '';

                if (data.startDate) {
                    const settings = window.rrhhConfig.getBranchSettings(data.sucursalId);
                    const probationMs = settings.probationDays * 24 * 60 * 60 * 1000;

                    const start = new Date(data.startDate).getTime();
                    if (now - start < probationMs) {
                        isProbation = true;
                        const endDate = new Date(start + probationMs);
                        probationEndDateStr = endDate.toLocaleDateString("es-GT");
                    }
                }

                if (isProbation) {
                    statusLabel = `
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="background: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600;">En Prueba</span>
                            <span style="font-size: 0.65rem; color: #92400e; margin-top: 2px;">Fin: ${probationEndDateStr}</span>
                        </div>`;
                } else {
                    statusLabel = '<span style="background: #ecfdf5; color: #10b981; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600;">Activo</span>';
                }
            }

            const displayCode = data.employeeCode || data.nit || 'Sin Código';

            // Sub-Empresa Indicator
            let nameContent = `<div style="font-weight: 600;">${data.fullName || 'Sin Nombre'}</div>`;
            if (data.subEmpresa === 'Pedidos Flash') {
                nameContent += `<div style="font-size: 0.7rem; color: #d97706; background: #fffbeb; display: inline-block; padding: 2px 6px; border-radius: 4px; margin-top: 2px;"><i class="fas fa-bolt"></i> Pedidos Flash</div>`;
            }

            // Transfer Indicators
            // Transfer Indicators
            let sucursalDisplay = '';

            if (data.isTempTransfer) {
                // Always show where they ARE physically
                sucursalDisplay = `<span style="font-weight:bold;">${data.tempSucursalName}</span>`;
                sucursalDisplay += `<div style="font-size: 0.7rem; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                    <i class="fas fa-info-circle"></i> De: ${data.sucursalName} (Temporal)
                 </div>`;
            } else {
                sucursalDisplay = data.sucursalName || 'N/A';
            }


            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 12px;">
                        ${nameContent}
                    </td>
                    <td style="padding: 12px;">
                        <div>${data.dpi || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight:bold;">${displayCode}</div>
                    </td>
                    <td style="padding: 12px;">${sucursalDisplay}</td>
                    <td style="padding: 12px;">${data.positionName || 'N/A'}</td>
                    <td style="padding: 12px;">${statusLabel}</td>
                    <td style="padding: 12px;">
                        <button class="btn btn-info" style="padding: 4px 8px; font-size: 0.75rem; background: #3b82f6; border: none;" onclick="viewEmployeeDetails('${data.id}')" title="Ver Detalles"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editEmpleado('${data.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #8b5cf6; border: none;" onclick="openTransferModal('${data.id}')" title="Trasladar"><i class="fas fa-exchange-alt"></i></button>
                        ${data.status !== 'inactive' ? `<button class="btn btn-warning" style="padding: 4px 8px; font-size: 0.75rem;" onclick="inactivateEmpleado('${data.id}', '${data.fullName}')" title="Dar de Baja"><i class="fas fa-user-slash"></i></button>` : ''}
                        
                        ${data.isTempTransfer ? `<button class="btn btn-success" style="padding: 4px 8px; font-size: 0.75rem; background: #10b981; border: none;" onclick="endTempTransfer('${data.id}', '${data.fullName}', '${data.tempSucursalName}', '${data.sucursalName}')" title="Finalizar Préstamo (Regresar)"><i class="fas fa-undo-alt"></i></button>` : ''}
                        
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteEmpleado('${data.id}', '${data.fullName}')" title="Eliminar Permanentemente"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading employees:", error);
        container.innerHTML = '<p style="color: red;">Error al cargar datos.</p>';
    }
}

async function viewEmployeeDetails(id) {
    try {
        const doc = await db.collection('employees').doc(id).get();
        if (!doc.exists) {
            Swal.fire('Error', 'No se encontrÃ³ el empleado', 'error');
            return;
        }
        const data = doc.data();
        let terminationInfo = '';
        let letterHtml = ''; // We will generate this if needed for printing

        // Logic for Inactive Employees
        if (data.status === 'inactive') {
            const sData = data.settlementData || { aguinaldo: 0, bono14: 0, vacations: 0, pendingSalary: 0, indemnization: 0, total: 0 };

            // Format dates
            const endDateFormatted = data.endDate ? new Date(data.endDate).toLocaleDateString("es-GT") : 'N/A';
            const todayFormatted = new Date().toLocaleDateString("es-GT", { year: 'numeric', month: 'long', day: 'numeric' });

            // Build Termination Info for Standard View
            terminationInfo = `
                <tr><td colspan="2" style="padding:10px; background:#fee2e2; font-weight:bold; color:#b91c1c; text-align:center;">InformaciÃ³n de Baja</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Fecha Baja:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${endDateFormatted}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Motivo:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.terminationReason || 'N/A'}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>CalificaciÃ³n:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.terminationJustification || 'N/A'}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Comentarios:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.terminationComments || 'N/A'}</td></tr>
            `;

            // If settlement data exists, add the breakdown
            if (data.settlementData) {
                terminationInfo += `
                    <tr><td colspan="2" style="padding:10px; background:#e0f2fe; font-weight:bold; color:#0369a1; text-align:center; border-top: 2px solid #fff;">CÃ¡lculo de LiquidaciÃ³n</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;">Aguinaldo:</td><td style="padding:8px; border-bottom:1px solid #eee;">Q${(sData.aguinaldo || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;">Bono 14:</td><td style="padding:8px; border-bottom:1px solid #eee;">Q${(sData.bono14 || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;">Vacaciones:</td><td style="padding:8px; border-bottom:1px solid #eee;">Q${(sData.vacations || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;">Salario Pendiente:</td><td style="padding:8px; border-bottom:1px solid #eee;">Q${(sData.pendingSalary || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee;">IndemnizaciÃ³n:</td><td style="padding:8px; border-bottom:1px solid #eee;">Q${(sData.indemnization || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold; font-size:1.1em;">TOTAL:</td><td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold; font-size:1.1em; color:#16a34a;">Q${(sData.total || 0).toFixed(2)}</td></tr>
                `;

                // Prepare Letter HTML for Printing
                const total = (sData.total || 0).toFixed(2);
                letterHtml = `
                    <div style="font-family: 'Times New Roman', serif; text-align: left; padding: 40px; line-height: 1.5; color: #000;">
                        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
                            <h2 style="margin: 0; text-transform: uppercase;">${data.subEmpresa || 'EMPRESA PROPIA'}</h2>
                            <p style="margin: 5px 0;">LIQUIDACIÃ“N LABORAL Y FINIQUITO</p>
                        </div>
                        <p style="text-align: right;">Guatemala, ${todayFormatted}</p>
                        <p>
                            <strong>Nombre:</strong> ${data.fullName}<br>
                            <strong>DPI:</strong> ${data.dpi} <br>
                            <strong>CÃ³digo:</strong> ${data.employeeCode || data.nit || 'N/A'}<br>
                            <strong>Fecha de Baja:</strong> ${endDateFormatted} <br>
                            <strong>Motivo:</strong> ${data.terminationReason} (${data.terminationJustification || ''})
                        </p>
                        <p>Por medio de la presente se detalla el cÃ¡lculo de prestaciones laborales correspondientes hasta la fecha de finalizaciÃ³n de la relaciÃ³n laboral:</p>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #000;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="border: 1px solid #000; padding: 8px; text-align: left;">Concepto</th>
                                    <th style="border: 1px solid #000; padding: 8px; text-align: right;">Monto (Q)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style="border: 1px solid #000; padding: 8px;">Aguinaldo Proporcional</td><td style="border: 1px solid #000; padding: 8px; text-align: right;">${(sData.aguinaldo || 0).toFixed(2)}</td></tr>
                                <tr><td style="border: 1px solid #000; padding: 8px;">Bono 14 Proporcional</td><td style="border: 1px solid #000; padding: 8px; text-align: right;">${(sData.bono14 || 0).toFixed(2)}</td></tr>
                                <tr><td style="border: 1px solid #000; padding: 8px;">Vacaciones Pendientes</td><td style="border: 1px solid #000; padding: 8px; text-align: right;">${(sData.vacations || 0).toFixed(2)}</td></tr>
                                <tr><td style="border: 1px solid #000; padding: 8px;">Salario Pendiente</td><td style="border: 1px solid #000; padding: 8px; text-align: right;">${(sData.pendingSalary || 0).toFixed(2)}</td></tr>
                                ${(sData.indemnization > 0) ? `<tr><td style="border: 1px solid #000; padding: 8px;">IndemnizaciÃ³n</td><td style="border: 1px solid #000; padding: 8px; text-align: right;">${sData.indemnization.toFixed(2)}</td></tr>` : ''}
                                <tr style="font-weight: bold; background: #e5e7eb;">
                                    <td style="border: 1px solid #000; padding: 8px; text-align: right;">TOTAL A RECIBIR</td>
                                    <td style="border: 1px solid #000; padding: 8px; text-align: right;">Q${total}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="margin-top: 30px;">
                            RecibÃ­ a mi entera satisfacciÃ³n la cantidad de <strong>Q${total}</strong>, declarando que con este pago la empresa no me adeuda ninguna otra cantidad por concepto de prestaciones laborales, salarios o indemnizaciones.
                        </p>
                        <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                            <div style="text-align: center; width: 45%;">
                                <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                                <p>Firma del Empleado</p>
                                <p style="font-size: 0.8em;">DPI: ${data.dpi}</p>
                            </div>
                            <div style="text-align: center; width: 45%;">
                                <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                                <p>Por la Empresa</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Fetch Transfer History
        let historyHtml = '';
        try {
            const histSnap = await db.collection('employees').doc(id).collection('transferHistory').orderBy('date', 'desc').get();
            if (!histSnap.empty) {
                historyHtml = `
                    <div style="margin-top: 20px; border-top: 2px solid var(--border); padding-top: 15px;">
                        <h4 style="margin-bottom: 10px; color: var(--primary);">Historial de Traslados</h4>
                        <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="background: #f8fafc; text-align: left;">
                                    <th style="padding: 6px; border-bottom: 1px solid var(--border);">Fecha</th>
                                    <th style="padding: 6px; border-bottom: 1px solid var(--border);">Tipo</th>
                                    <th style="padding: 6px; border-bottom: 1px solid var(--border);">Origen</th>
                                    <th style="padding: 6px; border-bottom: 1px solid var(--border);">Destino</th>
                                    <th style="padding: 6px; border-bottom: 1px solid var(--border);">Comentarios</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                histSnap.forEach(hDoc => {
                    const h = hDoc.data();
                    const dateStr = h.date ? new Date(h.date.seconds * 1000).toLocaleDateString() : 'N/A';
                    const typeLabel = h.type === 'fixed' ? '<span style="color: purple; font-weight: bold;">Definitivo</span>' : '<span style="color: orange; font-weight: bold;">Temporal</span>';

                    historyHtml += `
                        <tr>
                            <td style="padding: 6px; border-bottom: 1px solid #eee;">${dateStr}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #eee;">${typeLabel}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #eee;">${h.fromSucursalName || 'N/A'}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #eee;">${h.toSucursalName || 'N/A'}</td>
                            <td style="padding: 6px; border-bottom: 1px solid #eee;">${h.comments || '-'}</td>
                        </tr>
                    `;
                });
                historyHtml += `</tbody></table></div>`;
            } else {
                historyHtml = '<p style="margin-top: 15px; font-size: 0.9em; color: var(--text-muted);">Sin historial de traslados.</p>';
            }
        } catch (e) {
            console.error("Error loading history:", e);
        }

        // Standard Active/Inactive View
        const html = `
            <table style="width:100%; text-align:left; border-collapse: collapse;">
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Nombre:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.fullName}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>CÃ³digo:</strong></td><td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold;">${data.employeeCode || data.nit || 'N/A'}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>DPI:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.dpi}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Sucursal:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">
                    ${data.sucursalName}
                    ${data.isTempTransfer ? `<div style="font-size: 0.8rem; color: #d97706; background: #fef3c7; border: 1px solid #fcd34d; padding: 2px 4px; border-radius: 4px; margin-top: 4px; display: inline-block;">Prestado a: ${data.tempSucursalName}</div>` : ''}
                </td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Empresa:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.subEmpresa || 'Propia'}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Puesto:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.positionName}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Fecha Inicio:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.startDate}</td></tr>
                <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Estado:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${data.status === 'active' ? 'Activo' : 'Inactivo'}</td></tr>
                ${terminationInfo}
            </table>
            ${historyHtml}
        `;

        Swal.fire({
            title: 'Detalles del Empleado',
            html: html,
            width: '600px',
            showCloseButton: true,
            showDenyButton: !!letterHtml, // Only show Print if we have the letter
            confirmButtonText: 'Cerrar',
            denyButtonText: 'Imprimir Carta',
            denyButtonColor: '#3085d6',
            confirmButtonColor: '#6c757d',
        }).then((result) => {
            if (result.isDenied && letterHtml) {
                const printWindow = window.open('', '', 'width=900,height=700');
                printWindow.document.write('<html><head><title>LiquidaciÃ³n</title></head><body>');
                printWindow.document.write(letterHtml);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            }
        });

    } catch (e) {
        console.error("View details error:", e);
    }
}

async function openEmpleadoModal(id = null) {
    currentEmpleadoId = id;
    const modal = document.getElementById('empleadoModal');
    const form = document.getElementById('empleadoForm');
    form.reset();
    document.getElementById('empleadoModalTitle').textContent = id ? 'Editar Empleado' : 'Registrar Nuevo Empleado';

    // Hide Termination Section by default
    document.getElementById('terminationSection').style.display = 'none';
    const setSection = document.getElementById('settlementEditSection');
    if (setSection) setSection.style.display = 'none';

    // Load dynamic data safely
    try {
        await Promise.all([loadSucursalesSelect(), loadPositionsSelect()]);
    } catch (e) {
        console.error("Error loading dropdowns:", e);
        Swal.fire({
            icon: 'error',
            title: 'Error de Carga',
            text: 'No se pudieron cargar sucursales o puestos. Intente recargar la pÃ¡gina.'
        });
        return;
    }

    if (id) {
        try {
            const doc = await db.collection('employees').doc(id).get();
            const data = doc.data();
            // Map data to form
            form.fullName.value = data.fullName;
            form.dpi.value = data.dpi;
            form.nit.value = data.nit || '';

            // Populate Code
            if (form.employeeCode) {
                form.employeeCode.value = data.employeeCode || data.nit || '';
            }

            form.igss.value = data.igss || '';
            form.phone.value = data.phone;
            form.phoneEmergency.value = data.phoneEmergency;
            form.address.value = data.address;
            form.sucursalId.value = data.sucursalId;
            form.positionId.value = data.positionId;
            form.startDate.value = data.startDate;
            form.contractType.value = data.contractType;
            if (form.sexo) form.sexo.value = data.sexo || '';

            // Sub Empresa
            if (form.subEmpresa) {
                form.subEmpresa.value = data.subEmpresa || 'Propia';
            }

            // Show Termination Data if inactive
            if (data.status === 'inactive') {
                document.getElementById('terminationSection').style.display = 'block';
                if (form.terminationDate) form.terminationDate.value = data.endDate || '';
                if (form.terminationReason) form.terminationReason.value = data.terminationReason || '';
                if (form.terminationJustification) form.terminationJustification.value = data.terminationJustification || '';
                if (form.terminationComments) form.terminationComments.value = data.terminationComments || '';

                // Toggle Justification Visibility based on loaded reason
                const termJust = document.getElementById('emp_terminationJustification');
                if (termJust) {
                    const reason = data.terminationReason || '';
                    if (reason === 'Despido') {
                        termJust.parentElement.style.visibility = 'visible';
                    } else {
                        termJust.parentElement.style.visibility = 'hidden';
                    }
                }

                // Show Settlement Data for editing
                if (setSection) {
                    setSection.style.display = 'block';
                    const sData = data.settlementData || { aguinaldo: 0, bono14: 0, vacations: 0, pendingSalary: 0, indemnization: 0 };

                    const setAg = document.getElementById('set_aguinaldo');
                    const setBo = document.getElementById('set_bono14');
                    const setVa = document.getElementById('set_vacations');
                    const setPe = document.getElementById('set_pendingSalary');
                    const setIn = document.getElementById('set_indemnization');

                    if (setAg) setAg.value = (sData.aguinaldo || 0).toFixed(2);
                    if (setBo) setBo.value = (sData.bono14 || 0).toFixed(2);
                    if (setVa) setVa.value = (sData.vacations || 0).toFixed(2);
                    if (setPe) setPe.value = (sData.pendingSalary || 0).toFixed(2);
                    if (setIn) setIn.value = (sData.indemnization || 0).toFixed(2);

                    if (window.updateSettlementTotal) window.updateSettlementTotal();
                }
            }

        } catch (e) {
            console.error("Error loading employee detail:", e);
        }
    } else {
        // Clear code for new
        if (form.employeeCode) form.employeeCode.value = '';
        if (form.subEmpresa) form.subEmpresa.value = 'Propia';
    }

    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; modal.style.pointerEvents = 'auto'; }, 10);
}

function closeEmpleadoModal() {
    const modal = document.getElementById('empleadoModal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.style.display = 'none', 300);
}

async function loadSucursalesSelect() {
    const select = document.getElementById('emp_sucursalId');
    select.innerHTML = '<option value="">Seleccione Sucursal...</option>';
    const snap = await db.collection('sucursales').get();
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}

async function loadPositionsSelect() {
    const select = document.getElementById('emp_positionId');
    select.innerHTML = '<option value="">Seleccione Puesto...</option>';
    const snap = await db.collection('positions').get();
    snap.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
    });
}




// ------ Updated openEmpleadoModal ------



// ------ Updated Form Submit Listener ------
document.getElementById('empleadoForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    // Get Selected Names
    const sucursalName = form.sucursalId.options[form.sucursalId.selectedIndex].text;
    const positionName = form.positionId.options[form.positionId.selectedIndex].text;




    // Ensure code exists
    let empCode = form.employeeCode ? form.employeeCode.value : '';
    if (!empCode) {
        empCode = generateEmployeeCode(sucursalName);
    }

    const data = {
        fullName: form.fullName.value.trim(),
        dpi: form.dpi.value.trim(),
        employeeCode: empCode,
        nit: empCode,
        sexo: form.sexo ? form.sexo.value : '',

        igss: form.igss.value.trim(),
        phone: form.phone.value.trim(),
        phoneEmergency: form.phoneEmergency.value.trim(),
        address: form.address.value.trim(),
        sucursalId: form.sucursalId.value,
        sucursalName: sucursalName,
        positionId: form.positionId.value,
        positionName: positionName,
        subEmpresa: form.subEmpresa ? form.subEmpresa.value : 'Propia',

        startDate: form.startDate.value,
        contractType: form.contractType.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // If Editing and Inactive, save Termination + Settlement Data
    const terminationSection = document.getElementById('terminationSection');
    if (currentEmpleadoId && terminationSection.style.display !== 'none') {
        data.endDate = form.terminationDate.value;
        data.terminationReason = form.terminationReason.value;
        data.terminationJustification = form.terminationJustification.value;
        data.terminationComments = form.terminationComments.value;

        // Save Editable Settlement Data
        data.settlementData = {
            aguinaldo: parseFloat(document.getElementById('set_aguinaldo').value) || 0,
            bono14: parseFloat(document.getElementById('set_bono14').value) || 0,
            vacations: parseFloat(document.getElementById('set_vacations').value) || 0,
            pendingSalary: parseFloat(document.getElementById('set_pendingSalary').value) || 0,
            indemnization: parseFloat(document.getElementById('set_indemnization').value) || 0,
            total: parseFloat(document.getElementById('set_total').value) || 0
        };
    }

    try {
        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

        if (currentEmpleadoId) {
            await db.collection('employees').doc(currentEmpleadoId).update(data);
            Swal.fire('Actualizado', 'Datos de empleado actualizados.', 'success');
        } else {
            data.status = 'active';
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('employees').add(data);
            Swal.fire('Registrado', `Empleado registrado. CÃ³digo: ${empCode}`, 'success');
        }

        closeEmpleadoModal();
        loadEmployees();
        if (typeof initDashboard === 'function') initDashboard();

    } catch (error) {
        console.error("Error saving employee:", error);
        Swal.fire('Error', 'No se pudo guardar el registro.', 'error');
    }
});

async function inactivateEmpleado(id, name) {
    // 1. Fetch Employee Record to check dates
    let employeeData = null;
    let positionData = null;
    try {
        const doc = await db.collection('employees').doc(id).get();
        if (doc.exists) {
            employeeData = { id: doc.id, ...doc.data() };
            if (employeeData.positionId) {
                const posDoc = await db.collection('positions').doc(employeeData.positionId).get();
                if (posDoc.exists) positionData = posDoc.data();
            }
        }
    } catch (e) {
        console.error("Error fetching emp/pos for inactive:", e);
    }

    if (!employeeData) {
        Swal.fire('Error', 'No se encontraron datos del empleado.', 'error');
        return;
    }

    const defaultSalary = positionData ? (parseFloat(positionData.salario) || 0) + (parseFloat(positionData.bonificacion) || 0) : 0;

    // Calculate Estimated Pending Vacation (Approximate)
    let estimVacations = 0;
    if (employeeData.startDate) {
        const start = new Date(employeeData.startDate);
        const today = new Date();
        const years = (today - start) / (1000 * 60 * 60 * 24 * 365);
        const earned = years * 15;
        // Simple heuristic: Assume 0 taken if not tracked, or leave for user to input.
        estimVacations = Math.floor(earned);
    }

    // 2. Ask for Date and Reason with Enhanced Form
    const { value: formValues } = await Swal.fire({
        title: 'Procesar Baja y LiquidaciÃ³n',
        html: `
            <div style="text-align:left; font-size: 0.9rem;">
                <div style="background:#f3f4f6; padding:8px; border-radius:8px; margin-bottom:12px;">
                    <strong>Salario Base + Boni (Mes):</strong> Q${defaultSalary.toFixed(2)}
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div>
                        <label>Fecha de Baja:</label>
                        <input id="swal-end-date" class="swal2-input" type="date" style="width:100%; box-sizing:border-box;" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div>
                        <label>DÃ­as Trab. (Mes Actual):</label>
                        <input id="swal-days-worked" class="swal2-input" type="number" style="width:100%; box-sizing:border-box;" value="0">
                    </div>
                </div>
                
                <div style="margin-top:10px;">
                    <label>DÃ­as Vacaciones Pendientes:</label>
                    <input id="swal-vacations" class="swal2-input" type="number" style="width:100%; box-sizing:border-box;" value="${estimVacations}">
                </div>

                <label style="margin-top:10px; display:block;">Motivo:</label>
                <select id="swal-reason" class="swal2-select" style="display:block; width:100%; margin-top:5px;">
                    <option value="Renuncia">Renuncia</option>
                    <option value="Despido">Despido</option>
                    <option value="Abandono">Abandono de Labores</option>
                </select>
                
                <div id="swal-justification-container" style="display:none; margin-top:10px;">
                    <label>CalificaciÃ³n (Solo Despidos):</label>
                    <select id="swal-justification" class="swal2-select" style="display:block; width:100%; margin-top:5px;">
                        <option value="Justificado">Justificado</option>
                        <option value="Injustificado">Injustificado</option>
                    </select>
                </div>

                <label style="margin-top:10px; display:block;">Comentarios:</label>
                <textarea id="swal-comments" class="swal2-textarea" placeholder="Observaciones..." style="resize:none; height:60px;"></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Calcular',
        confirmButtonColor: '#3b82f6',
        didOpen: () => {
            // Set days worked default based on today's date
            const today = new Date();
            document.getElementById('swal-days-worked').value = today.getDate();

            const reasonSelect = document.getElementById('swal-reason');
            const justContainer = document.getElementById('swal-justification-container');

            // Initial check
            if (reasonSelect.value === 'Despido') justContainer.style.display = 'block';

            reasonSelect.addEventListener('change', () => {
                if (reasonSelect.value === 'Despido') {
                    justContainer.style.display = 'block';
                } else {
                    justContainer.style.display = 'none';
                }
            });
        },
        preConfirm: () => {
            return {
                endDate: document.getElementById('swal-end-date').value,
                daysWorked: parseInt(document.getElementById('swal-days-worked').value) || 0,
                vacationDays: parseFloat(document.getElementById('swal-vacations').value) || 0,
                reason: document.getElementById('swal-reason').value,
                justification: document.getElementById('swal-justification').value,
                comments: document.getElementById('swal-comments').value,
                salary: defaultSalary
            };
        }
    });

    if (!formValues) return;

    // 3. Perform Calculations
    const calc = calculateSettlement(formValues.salary, formValues.endDate, formValues.daysWorked, formValues.vacationDays, formValues.reason, formValues.justification, employeeData.startDate);

    // 4. Show Confirmation with Breakdown
    const { isConfirmed } = await Swal.fire({
        title: 'Confirmar LiquidaciÃ³n',
        html: `
            <div style="text-align:left; font-size:0.95rem;">
                <p><strong>Total a Pagar:</strong> <span style="color:green; font-size:1.2rem;">Q${calc.total.toFixed(2)}</span></p>
                <hr>
                <table style="width:100%; border-collapse:collapse;">
                    <tr><td>Aguinaldo (Dic-Baja):</td><td style="text-align:right;">Q${calc.aguinaldo.toFixed(2)}</td></tr>
                    <tr><td>Bono 14 (Jul-Baja):</td><td style="text-align:right;">Q${calc.bono14.toFixed(2)}</td></tr>
                    <tr><td>Vacaciones (${formValues.vacationDays} dÃ­as):</td><td style="text-align:right;">Q${calc.vacations.toFixed(2)}</td></tr>
                    <tr><td>Salario Pendiente (${formValues.daysWorked} dÃ­as):</td><td style="text-align:right;">Q${calc.pendingSalary.toFixed(2)}</td></tr>
                    <tr style="color:${calc.indemnization > 0 ? 'red' : 'inherit'};"><td>IndemnizaciÃ³n:</td><td style="text-align:right;">Q${calc.indemnization.toFixed(2)}</td></tr>
                </table>
                <br>
                <p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Â¿Proceder con la baja y guardar registro?</p>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Baja',
        confirmButtonColor: '#ef4444'
    });

    if (isConfirmed) {
        // 5. Save Logic
        await proceedToInactivate(id, formValues, calc);
    }
}

function calculateSettlement(salary, endDateStr, daysWorkedMonth, vacationDaysPending, reason, justification, startDateStr) {
    // Salary = Monthly Total (Base + Boni)
    // Daily Average = Salary / 30 (Labor Code usually uses 30 for monthly calc, but 365 for annual)
    // Actually, Aguinaldo/Bono14 use (Salary / 365 * days).
    // Let's use standard commercial year (360) or 365? Law says 365 for Aguinaldo proportionality.

    const dailySalary = salary / 30; // Usage for Vacations and Salary Pending
    const dailySalaryAnnual = salary / 365; // Usage for Aguinaldo/Bono14

    const endDate = new Date(endDateStr);

    // 1. Aguinaldo (Dec 1 - EndDate)
    // Find Dec 1 before EndDate
    let aguinaldoStart = new Date(endDate.getFullYear(), 11, 1); // Dec 1 of current year
    if (endDate < aguinaldoStart) {
        aguinaldoStart = new Date(endDate.getFullYear() - 1, 11, 1); // Dec 1 of previous year
    }
    const daysAguinaldo = Math.max(0, (endDate - aguinaldoStart) / (1000 * 60 * 60 * 24)) + 1; // Inclusive
    const payAguinaldo = dailySalaryAnnual * daysAguinaldo;

    // 2. Bono 14 (July 1 - EndDate)
    let bonoStart = new Date(endDate.getFullYear(), 6, 1); // July 1
    if (endDate < bonoStart) {
        bonoStart = new Date(endDate.getFullYear() - 1, 6, 1);
    }
    const daysBono = Math.max(0, (endDate - bonoStart) / (1000 * 60 * 60 * 24)) + 1;
    const payBono = dailySalaryAnnual * daysBono;

    // 3. Vacations
    const payVacations = dailySalary * vacationDaysPending;

    // 4. Pending Salary
    const payPendingSalary = dailySalary * daysWorkedMonth;

    // 5. Indemnization
    let payIndemnization = 0;
    if (reason === 'Despido' && justification === 'Injustificado') {
        // Formula: (Avg Salary / 12) * Years Worked ?? No.
        // Formula: 1 salary per year.
        // (Salary * TotalDaysWorked) / 365.
        const start = new Date(startDateStr);
        const totalDays = Math.max(0, (endDate - start) / (1000 * 60 * 60 * 24));
        payIndemnization = (salary * totalDays) / 365;
    }

    return {
        aguinaldo: payAguinaldo,
        bono14: payBono,
        vacations: payVacations,
        pendingSalary: payPendingSalary,
        indemnization: payIndemnization,
        total: payAguinaldo + payBono + payVacations + payPendingSalary + payIndemnization
    };
}

async function proceedToInactivate(id, values, calcData) {
    try {
        await db.collection('employees').doc(id).update({
            status: 'inactive',
            endDate: values.endDate,
            terminationReason: values.reason,
            terminationJustification: values.justification || 'Justificado',
            terminationComments: values.comments || '',
            settlementData: calcData, // Store the calculation snapshot
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire('Inactivado', 'Baja procesada y liquidaciÃ³n calculada.', 'success');
        loadEmployees();
        if (typeof initDashboard === 'function') initDashboard();
    } catch (error) {
        console.error("Error terminating:", error);
        Swal.fire('Error', 'No se pudo procesar la baja.', 'error');
    }
}

function editEmpleado(id) {
    openEmpleadoModal(id);
}

async function deleteEmpleado(id, name) {
    const result = await Swal.fire({
        title: 'Â¿Eliminar Empleado?',
        text: `Se eliminarÃ¡ permanentemente a "${name}". Esta acciÃ³n NO se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'SÃ­, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('employees').doc(id).delete();
            Swal.fire('Eliminado', 'El empleado ha sido eliminado.', 'success');
            loadEmployees();
            if (typeof initDashboard === 'function') initDashboard();
        } catch (error) {
            console.error("Error deleting employee:", error);
            Swal.fire('Error', 'No se pudo eliminar el empleado.', 'error');
        }
    }
}

// BULK IMPORT LOGIC (Keep existing - no changes needed for this task)
function openImportModal() {
    const modal = document.getElementById('importModal');
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; modal.style.pointerEvents = 'auto'; }, 10);

    // Load Sucursales
    const selectSucursal = document.getElementById('importSucursal');
    selectSucursal.innerHTML = '<option value="">Cargando...</option>';

    db.collection('sucursales').get().then(snap => {
        selectSucursal.innerHTML = '<option value="">Seleccione Sucursal...</option>';
        const sucursalList = [];
        snap.forEach(doc => sucursalList.push({ id: doc.id, ...doc.data() }));
        sucursalList.sort((a, b) => a.name.localeCompare(b.name));
        sucursalList.forEach(s => {
            selectSucursal.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    });

    // Load Puestos
    const selectPuesto = document.getElementById('importPuesto');
    if (selectPuesto) {
        selectPuesto.innerHTML = '<option value="">Cargando...</option>';

        db.collection('positions').get().then(snap => {
            console.log(`[Import] Loaded ${snap.size} positions.`);
            selectPuesto.innerHTML = '<option value="">Seleccione Puesto...</option>';
            const puestoList = [];
            snap.forEach(doc => {
                const data = doc.data();
                puestoList.push({ id: doc.id, name: data.name || 'Sin Nombre' });
            });

            puestoList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            puestoList.forEach(p => {
                selectPuesto.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });
        }).catch(err => {
            console.error("Error loading positions for import:", err);
            selectPuesto.innerHTML = '<option value="">Error al cargar</option>';
        });
    } else {
        console.error("Element #importPuesto not found!");
    }
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('importData').value = '';
        document.getElementById('importResults').style.display = 'none';
    }, 300);
}

async function processImport() {
    const sucursalSelect = document.getElementById('importSucursal');
    const puestoSelect = document.getElementById('importPuesto');
    const rawData = document.getElementById('importData').value.trim();
    const resultsDiv = document.getElementById('importResults');

    // 1. Validate Inputs
    if (!sucursalSelect.value) {
        Swal.fire('AtenciÃ³n', 'Seleccione una sucursal destino.', 'warning');
        return;
    }
    if (!puestoSelect.value) {
        Swal.fire('AtenciÃ³n', 'Seleccione un puesto para los empleados.', 'warning');
        return;
    }
    if (!rawData) {
        Swal.fire('AtenciÃ³n', 'Ingrese la lista de empleados.', 'warning');
        return;
    }

    const sucursalId = sucursalSelect.value;
    const sucursalName = sucursalSelect.options[sucursalSelect.selectedIndex].text;
    const positionId = puestoSelect.value;
    const positionName = puestoSelect.options[puestoSelect.selectedIndex].text;

    try {
        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

        // 2. Prepare Data Lookups (Employees for Dup check only)
        const empSnap = await db.collection('employees').get();
        const existingDPIs = new Set();
        empSnap.forEach(doc => {
            if (doc.data().dpi) existingDPIs.add(doc.data().dpi.trim());
        });

        // 3. Parse Data
        const lines = rawData.split('\n');
        const batch = db.batch();
        let successCount = 0;
        let errors = [];

        lines.forEach((line, index) => {
            line = line.trim();
            if (!line) return;

            // Format: Name, DPI, Date, Phone
            const parts = line.split(',').map(p => p.trim());
            const lineNum = index + 1;

            if (parts.length < 2) {
                errors.push(`LÃ­nea ${lineNum}: Formato incorrecto. MÃ­nimo Nombre y DPI.`);
                return;
            }

            // Destructuring with defaults
            const fullName = parts[0];
            const dpi = parts[1];
            const startDate = parts[2] || new Date().toISOString().split('T')[0];
            const phone = parts[3] || '';

            // Validate DPI
            if (dpi.length !== 13) {
                errors.push(`LÃ­nea ${lineNum}: DPI invÃ¡lido (${dpi}). Debe tener 13 dÃ­gitos.`);
                return;
            }
            if (existingDPIs.has(dpi)) {
                errors.push(`LÃ­nea ${lineNum}: El DPI ${dpi} ya existe en el sistema.`);
                return;
            }

            // Generate Employee Code
            const empCode = generateEmployeeCode(sucursalName);

            // Create Doc
            const docRef = db.collection('employees').doc();
            batch.set(docRef, {
                fullName: fullName,
                dpi: dpi,
                employeeCode: empCode,
                nit: empCode,
                sucursalId: sucursalId,
                sucursalName: sucursalName,
                positionId: positionId,
                positionName: positionName,
                subEmpresa: 'Propia',
                status: 'active',
                startDate: startDate,
                phone: phone,
                contractType: 'Indefinido',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            existingDPIs.add(dpi);
            successCount++;
        });

        // 4. Execute Batch
        if (successCount > 0) {
            await batch.commit();
        }

        // 5. Show Results
        Swal.close();

        let resultHTML = `<p style="color: green; font-weight: bold;">Se importaron ${successCount} empleados correctamente.</p>`;
        if (errors.length > 0) {
            resultHTML += `<ul style="color: #ef4444; margin-top: 10px; padding-left: 20px;">`;
            errors.forEach(err => resultHTML += `<li>${err}</li>`);
            resultHTML += `</ul>`;
        }

        resultsDiv.innerHTML = resultHTML;
        resultsDiv.style.display = 'block';

        if (successCount > 0) {
            loadEmployees();
            if (typeof initDashboard === 'function') initDashboard();
        }

        if (successCount > 0 && errors.length === 0) {
            Swal.fire('Éxito', `Se importaron ${successCount} empleados.`, 'success');
            setTimeout(closeImportModal, 2000);
        }

    } catch (error) {
        console.error("Import error:", error);
        Swal.fire('Error', 'Falló la importación: ' + error.message, 'error');
    }
}

// ------------------------------------------------------------------
// LOGICA DE TRASLADOS (FIJOS Y TEMPORALES)
// ------------------------------------------------------------------

async function endTempTransfer(empId, empName, currentTempBranch, originBranch) {
    const result = await Swal.fire({
        title: '¿Finalizar Préstamo?',
        html: `El empleado <strong>${empName}</strong> regresará oficialmente a <strong>${originBranch}</strong>.<br><br>Se eliminará su asignación temporal en ${currentTempBranch}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, finalizar préstamo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
        try {
            Swal.showLoading();

            const updateData = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isTempTransfer: false,
                tempSucursalId: firebase.firestore.FieldValue.delete(),
                tempSucursalName: firebase.firestore.FieldValue.delete(),
                tempStartDate: firebase.firestore.FieldValue.delete(),
                tempEndDate: firebase.firestore.FieldValue.delete()
            };

            await db.collection('employees').doc(empId).update(updateData);

            // Log History for End of Loan
            // We need to fetch the employee doc first to get current branch IDs if we want to be precise, 
            // but we can pass them as args or just log the event.
            // Let's rely on args passed for names, but IDs might be needed for strict consistency if we queried.
            // For simplicity and speed in this interaction, we'll log the event.

            // To be safe, let's just log "Fin Prestamo"
            const docSnap = await db.collection('employees').doc(empId).get();
            const data = docSnap.data();

            await db.collection('employees').doc(empId).collection('transferHistory').add({
                type: 'end_temp',
                fromSucursalId: data.sucursalId, // Origin is the 'home' branch
                fromSucursalName: originBranch,
                toSucursalId: data.sucursalId, // Destination is also 'home' branch (return)
                toSucursalName: originBranch,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                comments: `Fin de préstamo temporal en ${currentTempBranch}. Retorno a sucursal origen.`,
                user: 'admin',
                employeeName: empName,
                employeeId: empId
            });

            await Swal.fire('Préstamo Finalizado', 'El empleado ha retornado a su sucursal de origen.', 'success');
            loadEmployees(); // Reload list

        } catch (e) {
            console.error("Error ending temp transfer:", e);
            Swal.fire('Error', 'No se pudo finalizar el préstamo.', 'error');
        }
    }
}

async function openTransferModal(employeeId) {
    try {
        const doc = await db.collection('employees').doc(employeeId).get();
        if (!doc.exists) return;
        const data = doc.data();

        document.getElementById('transfer_employeeId').value = employeeId;
        document.getElementById('transfer_employeeName').value = data.fullName;
        document.getElementById('transfer_currentSucursalId').value = data.sucursalId;
        document.getElementById('transfer_currentSucursalName').value = data.sucursalName || 'N/A';

        // Reset Form
        document.getElementById('transferForm').reset();

        // Load target branches (exclude current)
        const select = document.getElementById('transfer_targetSucursal');
        select.innerHTML = '<option value="">Seleccione Sucursal...</option>';

        const snap = await db.collection('sucursales').get();
        snap.forEach(sDoc => {
            if (sDoc.id !== data.sucursalId) {
                select.innerHTML += `<option value="${sDoc.id}">${sDoc.data().name}</option>`;
            }
        });

        const modal = document.getElementById('transferModal');
        modal.style.display = 'flex';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);

        toggleTransferType(); // Update UI visibility

    } catch (e) {
        console.error("Error opening transfer modal:", e);
    }
}

function closeTransferModal() {
    const modal = document.getElementById('transferModal');
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function toggleTransferType() {
    const type = document.querySelector('input[name="transferType"]:checked').value;
    const tempFields = document.getElementById('transfer_temp_fields');
    const startInput = document.getElementById('transfer_startDate');

    if (type === 'temp') {
        tempFields.style.display = 'block';
        startInput.value = new Date().toISOString().split('T')[0];
        startInput.required = true;
    } else {
        tempFields.style.display = 'none';
        startInput.required = false;
    }
}

document.getElementById('transferForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const empId = document.getElementById('transfer_employeeId').value;
    const targetSucursalId = document.getElementById('transfer_targetSucursal').value;
    const selectTarget = document.getElementById('transfer_targetSucursal');
    const targetSucursalName = selectTarget.options[selectTarget.selectedIndex].text;
    const type = document.querySelector('input[name="transferType"]:checked').value;
    const comments = document.getElementById('transfer_comments').value;

    if (!targetSucursalId) {
        Swal.fire('Error', 'Seleccione una sucursal destino', 'warning');
        return;
    }

    try {
        Swal.fire({ title: 'Procesando Traslado...', didOpen: () => Swal.showLoading() });

        const updateData = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastTransferDate: firebase.firestore.FieldValue.serverTimestamp(),
            lastTransferComments: comments
        };

        if (type === 'fixed') {
            // Traslado Fijo: Cambia la sucursal dueña
            updateData.sucursalId = targetSucursalId;
            updateData.sucursalName = targetSucursalName;

            // Limpiar datos temporales si existían
            updateData.isTempTransfer = false;
            updateData.tempSucursalId = firebase.firestore.FieldValue.delete();
            updateData.tempSucursalName = firebase.firestore.FieldValue.delete();
            updateData.tempStartDate = firebase.firestore.FieldValue.delete();
            updateData.tempEndDate = firebase.firestore.FieldValue.delete();

        } else {
            // Traslado Temporal
            updateData.isTempTransfer = true;
            updateData.tempSucursalId = targetSucursalId;
            updateData.tempSucursalName = targetSucursalName;
            updateData.tempStartDate = document.getElementById('transfer_startDate').value;

            const endDate = document.getElementById('transfer_endDate').value;
            updateData.tempEndDate = endDate ? endDate : null; // Null if indefinite
        }

        await db.collection('employees').doc(empId).update(updateData);

        // Log History (Optional)
        await db.collection('employees').doc(empId).collection('transferHistory').add({
            type: type,
            fromSucursalId: document.getElementById('transfer_currentSucursalId').value,
            fromSucursalName: document.getElementById('transfer_currentSucursalName').value,
            toSucursalId: targetSucursalId,
            toSucursalName: targetSucursalName,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            comments: comments,
            user: 'admin',
            employeeName: document.getElementById('transfer_employeeName').value,
            employeeId: empId // Redundant but useful for indexing/querying directly
        });

        await Swal.fire('Éxito', 'Traslado realizado correctamente.', 'success');
        closeTransferModal();
        loadEmployees();

    } catch (e) {
        console.error("Error processing transfer:", e);
        Swal.fire('Error', 'No se pudo realizar el traslado.', 'error');
    }
});
