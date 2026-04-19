
// -----------------------------------------------------------------------------------
// GLOBAL TRANSFERS LOGIC
// -----------------------------------------------------------------------------------

console.log("Traslados module loaded");

let globalTransferData = []; // Store loaded data for client-side filtering

async function loadTraslados() {
    console.log("loadTraslados called");
    const tableBody = document.getElementById('globalTransfersBody_v2');
    if (!tableBody) {
        console.error("Critical: globalTransfersBody_v2 not found in DOM");
        return;
    }
    tableBody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center;"><div class="loading-spinner"></div> Cargando historial global...</td></tr>';
    globalTransferData = []; // Reset

    try {
        // Optimisation: Fetch all employees names to a Map first
        const empSnap = await db.collection('employees').get();
        const empMap = {};
        empSnap.forEach(doc => empMap[doc.id] = doc.data().fullName);

        // Fetch Global History using Collection Group Query
        const snapshot = await db.collectionGroup('transferHistory').orderBy('date', 'desc').limit(100).get();

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center;">No hay traslados registrados.</td></tr>';
            return;
        }

        const rawData = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Resolve Employee ID
            const empId = data.employeeId || (doc.ref.parent && doc.ref.parent.parent ? doc.ref.parent.parent.id : 'unknown');
            const empName = data.employeeName || empMap[empId] || 'Desconocido';

            rawData.push({
                ...data,
                resolvedName: empName,
                dateObj: data.date ? new Date(data.date.seconds * 1000) : null
            });
        });

        globalTransferData = rawData;
        renderTrasladoTable(globalTransferData);

        loadActiveLoans();

    } catch (e) {
        console.error("Error loading global transfers:", e);
        let msg = e.message;
        let actionHtml = '';

        if (e.code === 'failed-precondition') {
            msg = "Falta índice compuesto en Firestore para ordenar por fecha.";
            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; color:#b91c1c; text-align:left; display:inline-block;">
                    <strong>Acción Requerida (Admin):</strong><br>
                    Abra la consola del navegador (F12 > Console) y haga clic en el enlace generado por Firebase para crear el índice automáticamente.
                    <br><br>
                    <em>El enlace se ve como: "https://console.firebase.google.com/..."</em>
                </div>
            `;
        }
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="padding:40px; text-align:center; color: red;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
                    <strong>Error al cargar historial</strong><br>
                    ${msg}
                    ${actionHtml}
                </td>
            </tr>
        `;
    }
}

function renderTrasladoTable(dataList) {
    const tableBody = document.getElementById('globalTransfersBody_v2');
    if (!dataList || dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center;">No se encontraron resultados.</td></tr>';
        return;
    }

    let html = '';
    dataList.forEach(item => {
        const dateStr = item.dateObj ? item.dateObj.toLocaleDateString("es-GT") + ' ' + item.dateObj.toLocaleTimeString("es-GT") : 'N/A';

        const typeLabel = item.type === 'fixed' ?
            '<span class="badge badge-purple">Definitivo</span>' :
            '<span class="badge badge-orange">Temporal</span>';

        html += `
            <tr>
                <td>${dateStr}</td>
                <td style="font-weight: 500;">${item.resolvedName}</td>
                <td>${typeLabel}</td>
                <td>${item.fromSucursalName || '<span style="color:#ccc;">N/A</span>'}</td>
                <td style="font-weight:bold;">${item.toSucursalName || 'N/A'}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${item.comments || '-'}</td>
                <td style="font-size: 0.85em; color: var(--text-muted);">${item.user || 'Sistema'}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function filterTrasladoTable() {
    const term = document.getElementById('transferSearchInput').value.toLowerCase();
    const filtered = globalTransferData.filter(item => {
        return (item.resolvedName || '').toLowerCase().includes(term) ||
            (item.toSucursalName || '').toLowerCase().includes(term);
    });
    renderTrasladoTable(filtered);
}

async function loadActiveLoans() {
    const tableBody = document.getElementById('activeLoansBody');
    if (!tableBody) return;

    try {
        const snapshot = await db.collection('employees').where('isTempTransfer', '==', true).get();
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color: #aaa;">No hay préstamos activos actualmente.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const startStr = data.tempStartDate ? new Date(data.tempStartDate).toLocaleDateString("es-GT") : 'N/A';
            const endStr = data.tempEndDate ? new Date(data.tempEndDate).toLocaleDateString("es-GT") : 'Indefinido';

            html += `
                <tr>
                    <td style="font-weight: bold;">${data.fullName}</td>
                    <td>${data.sucursalName}</td>
                    <td style="color: #ea580c; font-weight: 500;">${data.tempSucursalName}</td>
                    <td>${startStr}</td>
                    <td>${endStr}</td>
                    <td>
                        <button class="btn btn-success btn-sm" 
                            onclick="endTempTransfer('${doc.id}', '${data.fullName}', '${data.tempSucursalName}', '${data.sucursalName}')">
                            <i class="fas fa-undo-alt"></i> Finalizar
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (e) {
        console.error("Error loading active loans:", e);
        tableBody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center; color: red;">Error al cargar préstamos activos.</td></tr>';
    }
}
