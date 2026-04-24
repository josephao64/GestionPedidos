
// prestamos.js - Gestión de Adelantos del Personal y Anticipos

let allLoans = [];
let loanSubsCheck = false;
let allActiveEmployeesForLoans = [];

document.addEventListener('DOMContentLoaded', () => {
    // Optional init
});

async function loadLoans() {
    console.log("Cargando adelantos...");
    const tbody = document.getElementById('loansTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">Cargando...</td></tr>';

    try {
        const snap = await db.collection('loans')
            .orderBy('createdAt', 'desc')
            .get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No hay adelantos activos.</td></tr>';
            allLoans = [];
            return;
        }

        allLoans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderLoansTable();

    } catch (error) {
        console.error("Error loading loans:", error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Error: ${error.message}</td></tr>`;
    }
}

function renderLoansTable() {
    const tbody = document.getElementById('loansTableBody');
    const filterBranch = document.getElementById('loanFilterBranch').value;
    const filterType = document.getElementById('loanFilterType').value;
    const search = document.getElementById('loanSearch').value.toLowerCase();

    // Populate Branch Filter if needed
    const branchSelect = document.getElementById('loanFilterBranch');
    if (branchSelect.options.length === 1) {
        db.collection('sucursales').orderBy('name').get().then(snap => {
            snap.forEach(doc => {
                const s = doc.data();
                branchSelect.innerHTML += `<option value="${doc.id}">${s.name}</option>`;
            });
        }).catch(e => console.error("Error loading branches for filter:", e));
    }

    let filtered = allLoans.filter(l => {
        if (filterBranch !== 'all' && l.sucursalId !== filterBranch) return false;
        if (filterType !== 'all' && l.type !== filterType) return false;
        if (filterBranch !== 'all' && l.sucursalId !== filterBranch) return false;
        if (filterType !== 'all' && l.type !== filterType) return false;

        if (search) {
            const searchSource = `${l.employeeName} ${l.sucursalName || ''} ${l.employeeCode || ''}`.toLowerCase();
            if (!searchSource.includes(search)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No se encontraron resultados.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(loan => {
        const typeLabel = loan.type === 'adelanto'
            ? '<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:4px; font-size:0.8em;">Adelanto</span>'
            : '<span style="background:#fce7f3; color:#9d174d; padding:2px 8px; border-radius:4px; font-size:0.8em;">Anticipo</span>';

        const statusLabel = loan.status === 'paid'
            ? '<span style="color:green; font-weight:bold;">Pagado</span>'
            : (loan.approvalStatus === 'pending' ? '<span style="color:orange;">Pendiente</span>'
                : (loan.approvalStatus === 'rejected' ? '<span style="color:red;">Rechazado</span>' : '<span style="color:blue;">Activo</span>'));

        const progress = `${loan.installmentsPaid || 0} / ${loan.installments || 1}`;

        // Action Buttons
        let actions = '';

        // Print Request (Always Available)
        actions += `<button class="btn btn-sm btn-info" onclick="printRequestForm('${loan.id}')" title="Exportar Solicitud"><i class="fas fa-file-alt"></i></button>`;

        if (loan.approvalStatus === 'pending') {
            // Approve/Reject
            actions += `
                <button class="btn btn-sm btn-success" onclick="approveLoan('${loan.id}', true)" title="Aprobar"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-warning" onclick="approveLoan('${loan.id}', false)" title="Rechazar"><i class="fas fa-times"></i></button>
            `;
        }

        // Print Authorization/Voucher (If Approved or Paid or Active)
        if (loan.approvalStatus === 'approved' || loan.status === 'active' || loan.status === 'paid') {
            actions += `
                <button class="btn btn-sm btn-primary" onclick="printAuthLetter('${loan.id}')" title="Exportar Comprobante"><i class="fas fa-file-contract"></i></button>
            `;
        }

        // Always allow delete if active/pending (or handle restrictions)
        if (loan.status !== 'paid') {
            actions += `
                <button class="btn btn-sm btn-danger" onclick="deleteLoan('${loan.id}')" title="Eliminar/Cancelar">
                    <i class="fas fa-trash"></i>
                </button>
             `;
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td style="padding:12px; font-weight:500;">${loan.employeeName}</td>
            <td style="padding:12px; font-size:0.9em; color:#64748b;">${loan.sucursalName || '-'}</td>
            <td style="padding:12px;">${typeLabel}</td>
            <td style="padding:12px;">Q${loan.amount.toFixed(2)}</td>
            <td style="padding:12px; font-weight:bold;">Q${loan.balance.toFixed(2)}</td>
            <td style="padding:12px; text-align:center;">${loan.type === 'prestamo' ? progress : '-'}</td>
            <td style="padding:12px;">${statusLabel}</td>
            <td style="padding:12px; display:flex; gap:5px; justify-content:center;">
                ${actions}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL & FORM ---

async function openLoanModal() {
    const modal = document.getElementById('loanModal');
    const empSelect = document.getElementById('loan_employee');

    document.getElementById('loanForm').reset();
    document.getElementById('loan_details').style.display = 'none';

    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; modal.style.pointerEvents = 'auto'; }, 10);

    // Load Employees
    empSelect.innerHTML = '<option value="">Cargando...</option>';
    try {
        const snap = await db.collection('employees').where('status', '==', 'active').get();
        allActiveEmployeesForLoans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        allActiveEmployeesForLoans.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Populate branches filter
        const branchSelect = document.getElementById('loan_branch_filter');
        const branches = new Set(allActiveEmployeesForLoans.map(e => (e.isTempTransfer && e.tempSucursalName) ? e.tempSucursalName : e.sucursalName).filter(Boolean));
        branchSelect.innerHTML = '<option value="">Todas las Sucursales</option>';
        [...branches].sort().forEach(b => {
             branchSelect.innerHTML += `<option value="${b}">${b}</option>`;
        });

        document.getElementById('loan_employee_search').value = '';
        document.getElementById('loan_branch_filter').value = '';

        filterLoanEmployees();

    } catch (e) {
        console.error(e);
        empSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function filterLoanEmployees() {
    const search = document.getElementById('loan_employee_search').value.toLowerCase();
    const branchFilter = document.getElementById('loan_branch_filter').value;
    const empSelect = document.getElementById('loan_employee');
    
    empSelect.innerHTML = '<option value="">Seleccione Empleado...</option>';
    
    allActiveEmployeesForLoans.forEach(e => {
        const branch = (e.isTempTransfer && e.tempSucursalName) ? e.tempSucursalName : e.sucursalName;
        
        if (branchFilter && branch !== branchFilter) return;
        if (search && !(e.fullName.toLowerCase().includes(search) || (e.dpi && e.dpi.includes(search)) || (e.employeeCode && (e.employeeCode+'').toLowerCase().includes(search)))) return;
        
        const option = document.createElement('option');
        option.value = e.id;
        option.dataset.name = e.fullName;
        option.dataset.code = e.employeeCode || '';
        option.dataset.sucursalId = (e.isTempTransfer && e.tempSucursalId) ? e.tempSucursalId : e.sucursalId;
        option.dataset.sucursalName = branch;
        option.textContent = `${e.fullName} (${branch})`;
        empSelect.appendChild(option);
    });
}

function closeLoanModal() {
    const modal = document.getElementById('loanModal');
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    setTimeout(() => modal.style.display = 'none', 300);
}

function toggleLoanFields() {
    // User requested installments for both types, so we always show the details block.
    // We can keep the function in case we need specific logic later, but for now we unhide.
    const details = document.getElementById('loan_details');
    details.style.display = 'block';
}

// Init fields on load
document.addEventListener('DOMContentLoaded', () => {
    // ...
    // Ensure default state matches
});

document.getElementById('loanForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const empSelect = document.getElementById('loan_employee');
    const empId = empSelect.value;
    const empName = empSelect.options[empSelect.selectedIndex].dataset.name;
    const empCode = empSelect.options[empSelect.selectedIndex].dataset.code || '';
    const sucursalId = empSelect.options[empSelect.selectedIndex].dataset.sucursalId;
    const sucursalName = empSelect.options[empSelect.selectedIndex].dataset.sucursalName;

    const type = document.getElementById('loan_type').value;
    const amount = parseFloat(document.getElementById('loan_amount').value);
    const comments = document.getElementById('loan_comments').value;

    let installments = 1;
    let frequency = 'quincenal';

    // Unified logic: Read installments for BOTH types
    installments = parseInt(document.getElementById('loan_installments').value) || 1;
    frequency = document.getElementById('loan_frequency').value;

    // Safety check just in case
    if (installments < 1) installments = 1;

    if (!empId || amount <= 0) return;

    try {
        Swal.showLoading();

        const payload = {
            employeeId: empId,
            employeeName: empName,
            employeeCode: empCode,
            sucursalId: sucursalId,
            sucursalName: sucursalName,
            type: type,
            amount: amount,
            balance: amount,
            installments: installments,
            installmentsPaid: 0,
            installmentAmount: amount / installments,
            frequency: frequency,
            status: 'active',
            approvalStatus: 'pending',
            comments: comments,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('loans').add(payload);

        Swal.fire('Solicitud Creada', 'La solicitud ha sido creada y está pendiente de aprobación.', 'success');
        closeLoanModal();
        loadLoans();

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo guardar.', 'error');
    }
});

async function deleteLoan(id) {
    const result = await Swal.fire({
        title: '¿Eliminar?',
        text: "Esta acción eliminará el registro de este adelanto/anticipo. Úselo solo si fue un error.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('loans').doc(id).delete();
            Swal.fire('Eliminado', 'Registro eliminado.', 'success');
            loadLoans();
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
}

async function approveLoan(id, isApproved) {
    try {
        await db.collection('loans').doc(id).update({
            approvalStatus: isApproved ? 'approved' : 'rejected',
            infoAuth: isApproved ? { date: new Date().toISOString(), user: 'admin' } : null
        });
        Swal.fire(isApproved ? 'Aprobado' : 'Rechazado', 'El estado ha sido actualizado.', 'success');
        loadLoans();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
}

async function printAuthLetter(loanId) {
    const loan = allLoans.find(l => l.id === loanId);
    if (!loan) return;

    // Fetch Letterhead
    let letterheadImg = 'membrete vipizza.png'; // Default
    let branchName = 'Poptún'; // Default
    try {
        if (loan.sucursalId) {
            const sDoc = await db.collection('sucursales').doc(loan.sucursalId).get();
            if (sDoc.exists) {
                const sData = sDoc.data();
                if (sData.membrete) letterheadImg = sData.membrete;
                if (sData.name) branchName = sData.name;
            }
        }
    } catch (e) { console.error("Error fetching letterhead", e); }

    const win = window.open('', '_blank');
    const today = new Date();
    const dateStr = `${branchName}, ${today.getDate()} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][today.getMonth()]} de ${today.getFullYear()}`;

    // Deduction Text Logic
    const paymentText = loan.installments > 1
        ? `en ${loan.installments} cuotas de Q${loan.installmentAmount.toFixed(2)} cada una`
        : `en 1 pago de Q${loan.amount.toFixed(2)}`;

    const freqBase = loan.frequency === 'quincenal' ? 'quincena' : 'mensualidad';
    const freqPlural = loan.installments > 1 ? `${freqBase}s` : freqBase;
    const nextText = loan.installments > 1 ? 'las próximas' : 'la próxima';

    // "... en las próximas 5 quincenas" / "... en la próxima quincena"
    const durationText = `${nextText} ${loan.installments > 1 ? loan.installments + ' ' : ''}${freqPlural}`;

    // HTML Content update below uses this durationText variable
    win.document.write(`
        <html>
        <head>
            <title>Carta de Adelanto</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
                
                @page { margin: 0; size: auto; }
                
                body { 
                    font-family: 'Roboto', Arial, sans-serif; 
                    margin: 0; 
                    padding: 0;
                    color: #000;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .page {
                    width: 8.5in;
                    height: 11in;
                    padding: 1in;
                    box-sizing: border-box;
                    background-image: url('../resources/images/${letterheadImg}');
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    position: relative;
                }

                .header-date {
                    text-align: right;
                    margin-top: 1in;
                    margin-bottom: 40px;
                    font-size: 1.1em;
                }

                .title {
                    font-size: 1.4em;
                    font-weight: bold;
                    text-decoration: underline;
                    text-transform: uppercase;
                    margin-bottom: 40px;
                    text-align: center;
                }

                .content {
                    font-size: 1.1em;
                    text-align: justify;
                    line-height: 1.8;
                }

                .signatures {
                    margin-top: 100px;
                    display: flex;
                    justify-content: center;
                    gap: 50px;
                }

                .sig-block {
                    text-align: center;
                    width: 250px;
                    border-top: 1px solid black;
                    padding-top: 10px;
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header-date">${dateStr}</div>
                
                <div class="title">CARTA DE ADELANTO</div>

                <div class="content">
                    <p>Yo, <strong>${loan.employeeName}</strong>, recibo la cantidad de <strong>Q${loan.amount.toFixed(2)}</strong> en concepto de adelanto salarial.</p>
                    
                    <p>Por este medio, me comprometo formalmente a pagar la totalidad de la cantidad adelantada a la empresa.</p>

                    <p>El descuento se realizará ${paymentText}, el cual será deducido de mi salario en ${durationText} de forma consecutiva a partir de la presente fecha o en la fecha de pago más próxima.</p>
                    
                    <p>Autorizo expresamente a la empresa para que realice dichos descuentos en mi planilla de pago.</p>
                </div>

                <div class="signatures">
                    <div class="sig-block">
                        Firma del Empleado<br>
                        <strong>${loan.employeeName}</strong>
                    </div>
                </div>
            </div>
            
            <script>
                // Auto print after images load
                window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
            </script>
        </body>
        </html>
    `);
    win.document.close();
}

async function printRequestForm(loanId) {
    const loan = allLoans.find(l => l.id === loanId);
    if (!loan) return;

    // Fetch Letterhead
    let letterheadImg = 'membrete vipizza.png'; // Default
    let branchName = 'GestionPedidos';
    try {
        if (loan.sucursalId) {
            const sDoc = await db.collection('sucursales').doc(loan.sucursalId).get();
            if (sDoc.exists) {
                const sData = sDoc.data();
                if (sData.membrete) letterheadImg = sData.membrete;
                if (sData.name) branchName = sData.name;
            }
        }
    } catch (e) { console.error("Error fetching letterhead", e); }

    const win = window.open('', '_blank');
    const dateStr = loan.createdAt ? new Date(loan.createdAt.seconds * 1000).toLocaleDateString('es-GT') : new Date().toLocaleDateString('es-GT');

    win.document.write(`
        <html>
        <head>
            <title>Solicitud de ${loan.type === 'prestamo' ? 'Anticipo' : 'Adelanto'}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
                
                @page { margin: 0; size: auto; }
                
                body { 
                    font-family: 'Roboto', Arial, sans-serif; 
                    margin: 0; 
                    padding: 0;
                    color: #000;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .page {
                    width: 8.5in;
                    height: 11in;
                    padding: 1in;
                    box-sizing: border-box;
                    background-image: url('../resources/images/${letterheadImg}');
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    position: relative;
                }

                .header-date {
                    text-align: right;
                    margin-top: 1in;
                    margin-bottom: 20px;
                    font-size: 1.1em;
                }

                .title {
                    font-size: 1.4em;
                    font-weight: bold;
                    text-decoration: underline;
                    text-transform: uppercase;
                    margin-bottom: 40px;
                    text-align: center;
                }

                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 1.1em; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #333; }
                .value { border-bottom: 1px dotted #999; padding-bottom: 5px; display:inline-block; min-width: 50%; }

                .comments { margin: 30px 0; border: 1px solid #ddd; padding: 15px; background: rgba(255,255,255,0.8); }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header-date">
                    ${branchName}<br>
                    Fecha: ${dateStr}
                </div>
                
                <div class="title">SOLICITUD DE ${loan.type === 'prestamo' ? 'ANTICIPO' : 'ADELANTO'}</div>

                <div class="grid">
                    <div class="field">
                        <span class="label">Empleado Solicitante:</span><br>
                        <span class="value">${loan.employeeName}</span>
                    </div>
                    <div class="field">
                        <span class="label">Monto Solicitado:</span><br>
                        <span class="value">Q${loan.amount.toFixed(2)}</span>
                    </div>
                    <div class="field">
                        <span class="label">Tipo:</span><br>
                        <span class="value">${loan.type === 'adelanto' ? 'Adelanto Salarial' : 'Anticipo Personal'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Plan de Pago:</span><br>
                        <span class="value">${loan.installments} cuotas ${loan.frequency}es</span>
                    </div>
                    <div class="field">
                        <span class="label">Cuota Aproximada:</span><br>
                        <span class="value">Q${loan.installmentAmount.toFixed(2)}</span>
                    </div>
                </div>

                <div class="comments">
                    <div class="label">Motivo / Comentarios:</div>
                    <p>${loan.comments || 'Sin comentarios adicionales.'}</p>
                </div>

                <p style="font-size: 12px; text-align: center; margin-top: 50px;">
                    Declaro que la información es correcta y autorizo el trámite de esta solicitud.
                </p>
                
                <!-- Signatures removed as requested -->
            </div>
            
            <script>
                window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
            </script>
        </body>
        </html>
    `);
    win.document.close();
}
