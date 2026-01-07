
// planillas.js - Payroll Logic

let currentPayrollData = [];
let isHistoryMode = false;
let currentLoadedId = null; // If viewing/editing a saved payroll

document.addEventListener('DOMContentLoaded', () => {
    // Populate Year
    const yearSelect = document.getElementById('planillaYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option><option value="${currentYear - 1}">${currentYear - 1}</option>`;
    }
});

// Called when switching to 'planillas' section or manually
async function loadPlanillaTable() {
    isHistoryMode = false;
    currentLoadedId = null;

    // Ensure view is correct
    document.getElementById('planillaMainView').style.display = 'block';
    document.getElementById('planillaHistoryView').style.display = 'none';
    document.getElementById('planillaControls').style.display = 'flex';

    // Ensure branches are populated if empty
    const sucursalSelect = document.getElementById('planillaSucursal');
    if (sucursalSelect && sucursalSelect.options.length <= 1) {
        await populatePlanillaBranches();
    }

    const tbody = document.getElementById('planillaBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px;">Cargando planilla...</td></tr>';
    const tfoot = document.getElementById('planillaFooter');
    if (tfoot) tfoot.style.display = 'none';

    try {
        // 1. Fetch Active Employees
        const empSnap = await db.collection('employees')
            .where('status', '==', 'active')
            .get();

        if (empSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px;">No hay empleados activos.</td></tr>';
            return;
        }

        // 2. Fetch Positions to get Salary Info
        const posSnap = await db.collection('positions').get();
        const positions = {};
        posSnap.forEach(doc => {
            positions[doc.id] = doc.data();
        });

        // 3. Process Data
        const daysWorkedDefault = 15;
        const selectedSucursal = sucursalSelect ? sucursalSelect.value : 'all';

        currentPayrollData = [];

        empSnap.forEach(doc => {
            const emp = doc.data();

            // Filter by Sucursal
            if (selectedSucursal !== 'all' && emp.sucursalId !== selectedSucursal) return;

            const pos = positions[emp.positionId] || {};

            // Priority: Min Wage (Dynamic) -> Employee Snapshot -> Position -> 0
            // Note: Check if 'pos' uses 'salario' or 'baseSalary'.
            let monthlySalary = parseFloat(emp.baseSalary || pos.salario || pos.baseSalary || 0);

            // Dynamic Min Wage Override
            if (pos.salaryTypeId === 'min_wage') {
                const config = window.rrhhConfig.get ? window.rrhhConfig.get() : {};
                if (config.minWageMonthly) monthlySalary = parseFloat(config.minWageMonthly);
            }
            const monthlyBonus = parseFloat(pos.bonificacion || pos.bonus || (window.rrhhConfig.get().bonus) || 250);

            // Calculations
            // Default 15 days = Full Pay (Monthly / 2)
            const periodSalary = monthlySalary / 2;
            const periodBonus = monthlyBonus / 2;

            const totalSalary = periodSalary + periodBonus;
            // Dynamic IGSS from Config
            const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
            const igss = periodSalary * igssPct;
            const isr = 0;

            currentPayrollData.push({
                id: doc.id,
                name: emp.fullName,
                days: daysWorkedDefault,
                monthlyBase: monthlySalary, // Store base for recalculation
                monthlyBonusBase: monthlyBonus, // Store base bonus
                salary: periodSalary,
                bonus: periodBonus,
                totalSalary: totalSalary,
                igss: igss,
                isr: isr,
                judicial: 0,
                discount: 0,
                advance: 0,
                isNew: true
            });
        });

        if (currentPayrollData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 20px;">No se encontraron empleados para esta sucursal.</td></tr>';
            return;
        }

        // Sort by Name
        currentPayrollData.sort((a, b) => a.name.localeCompare(b.name));

        renderPlanillaRows();

    } catch (e) {
        console.error("Error generating payroll:", e);
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:red; padding: 20px;">Error: ${e.message}</td></tr>`;
    }
}

async function populatePlanillaBranches() {
    try {
        const select = document.getElementById('planillaSucursal');
        if (!select) return;

        const snap = await db.collection('sucursales').orderBy('name').get();
        select.innerHTML = '<option value="all">Todas las Sucursales</option>';
        snap.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
        });
    } catch (e) {
        console.error("Error loading branches for payroll:", e);
    }
}

function renderPlanillaRows() {
    const tbody = document.getElementById('planillaBody');
    const tfoot = document.getElementById('planillaFooter');
    tbody.innerHTML = '';

    // Totals Accumulators
    let sumSalary = 0;
    let sumBonus = 0;
    let sumTotalSalary = 0;
    let sumIgss = 0;
    let sumIsr = 0;
    let sumJudicial = 0;
    let sumDiscount = 0;
    let sumAdvance = 0;
    let sumTotalDeductions = 0;
    let sumLiquid = 0;

    currentPayrollData.forEach((row, index) => {
        // Calculate dynamic totals based on potentially edited values
        const totalDeductions = row.igss + row.isr + row.judicial + row.discount + row.advance;
        const liquid = row.totalSalary - totalDeductions;

        // Accumulate
        sumSalary += row.salary;
        sumBonus += row.bonus;
        sumTotalSalary += row.totalSalary;
        sumIgss += row.igss;
        sumIsr += row.isr;
        sumJudicial += row.judicial;
        sumDiscount += row.discount;
        sumAdvance += row.advance;
        sumTotalDeductions += totalDeductions;
        sumLiquid += liquid;

        const tr = document.createElement('tr');
        tr.style.background = '#fff';

        const cellStyle = 'padding: 6px; border: 1px solid #000; text-align: center;';
        const numStyle = 'padding: 6px; border: 1px solid #000; text-align: center;';

        tr.innerHTML = `
            <td style="${cellStyle} text-align: left; width: 220px;">${row.name}</td>
            
            <!-- Editable Days -->
            <td style="${cellStyle} padding: 2px;">
                 <input type="number" min="0" max="31" value="${row.days}" 
                    onchange="updatePlanillaDays(${index}, this.value)"
                    style="width: 40px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
            </td>

            <td style="${numStyle}">Q${row.salary.toFixed(2)}</td>
            <td style="${numStyle}">Q${row.bonus.toFixed(2)}</td>
            <td style="${numStyle}">Q${row.totalSalary.toFixed(2)}</td>
            
            <td style="${numStyle}">Q${row.igss.toFixed(2)}</td>
            <td style="${numStyle}">Q${row.isr.toFixed(2)}</td>
            
            <!-- Editable Deductions -->
            <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.01" value="${row.judicial.toFixed(2)}" 
                    onchange="updatePlanillaRow(${index}, 'judicial', this.value)"
                    style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
            </td>
            <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.01" value="${row.discount.toFixed(2)}" 
                    onchange="updatePlanillaRow(${index}, 'discount', this.value)"
                    style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
            </td>
            <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.01" value="${row.advance.toFixed(2)}" 
                    onchange="updatePlanillaRow(${index}, 'advance', this.value)"
                    style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
            </td>

            <td style="${numStyle}">Q${totalDeductions.toFixed(2)}</td>
            <td style="${numStyle}">Q${liquid.toFixed(2)}</td>
            <td style="${cellStyle} border-bottom: 2px solid #000;">____________</td>
        `;

        tbody.appendChild(tr);
    });

    // Render Footer
    if (tfoot) {
        tfoot.style.display = 'table-footer-group';
        tfoot.innerHTML = `
            <tr style="text-align: center; font-weight: bold; ">
                <td style="padding: 6px; border: 1px solid #000; text-align: right;">TOTALES:</td>
                <td style="padding: 6px; border: 1px solid #000;">-</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumSalary.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumBonus.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumTotalSalary.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumIgss.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumIsr.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumJudicial.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumDiscount.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumAdvance.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumTotalDeductions.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000; background: #eee;">Q${sumLiquid.toFixed(2)}</td>
                <td style="border: 1px solid #000;"></td>
            </tr>
        `;
    }

    // Update Header Text for View (Immediate Feedback)
    updateHeaderInfo();
}

function updatePlanillaDays(index, value) {
    const days = parseFloat(value) || 0;
    const row = currentPayrollData[index];

    row.days = days;

    // Recalculate Proportional Salary & Bonus
    // Rule: IF days >= 15, assume Full Fortnight Pay (Monthly / 2)
    // Rule: IF days < 15, use 365-day Daily Rate

    if (days >= 15) {
        row.salary = row.monthlyBase / 2;
        row.bonus = row.monthlyBonusBase / 2;
    } else {
        const dailyRate365 = (row.monthlyBase * 12) / 365;
        const dailyBonus365 = (row.monthlyBonusBase * 12) / 365;

        row.salary = dailyRate365 * days;
        row.bonus = dailyBonus365 * days;
    }

    // Recalculate derived
    row.totalSalary = row.salary + row.bonus;
    const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
    row.igss = row.salary * igssPct;

    renderPlanillaRows();
}


function updatePlanillaRow(index, field, value) {
    const val = parseFloat(value) || 0;
    currentPayrollData[index][field] = val;
    renderPlanillaRows();
}

function updateHeaderInfo() {
    const header = document.getElementById('planillaHeaderInfo');
    const table = document.getElementById('planillaTable');

    const m = document.getElementById('planillaMonth');
    const p = document.getElementById('planillaPeriod');
    const y = document.getElementById('planillaYear');
    const s = document.getElementById('planillaSucursal');

    // If saving/loading history, we might not rely on selectors, but for now we do.
    const mText = m.options[m.selectedIndex].text;
    const pText = p.value == '1' ? 'DEL 01' : 'DEL 16';
    const pEndText = p.value == '1' ? 'AL 15' : 'AL ' + new Date(y.value, parseInt(m.value) + 1, 0).getDate();

    const branchName = (s && s.options[s.selectedIndex].text !== 'Todas las Sucursales') ? s.options[s.selectedIndex].text : 'GENERAL';

    const titleNode = document.getElementById('planillaTitleNode');
    if (titleNode) titleNode.innerText = `NÓMINA DE SUELDOS ${branchName.toUpperCase()}`;

    document.getElementById('planillaDateDisplay').innerText = `${pText}/${(parseInt(m.value) + 1).toString().padStart(2, '0')}/${y.value} ${pEndText}/${(parseInt(m.value) + 1).toString().padStart(2, '0')}/${y.value}`;
}

function exportPlanillaPDF() {
    updateHeaderInfo(); // Ensure latest
    const header = document.getElementById('planillaHeaderInfo');
    if (header) header.style.display = 'flex';
    window.print();
    // Header stays visible in DOM for simplicity or can be hidden. 
    // CSS @media print handles visibility mostly, but we toggle display:none here.
}


// --- SAVE & HISTORY LOGIC ---

async function savePlanilla() {
    if (currentPayrollData.length === 0) {
        alert("No hay datos para guardar.");
        return;
    }

    const m = document.getElementById('planillaMonth').value;
    const p = document.getElementById('planillaPeriod').value;
    const y = document.getElementById('planillaYear').value;
    const s = document.getElementById('planillaSucursal').value;
    const sName = document.getElementById('planillaSucursal').options[document.getElementById('planillaSucursal').selectedIndex].text;

    const payrollId = currentLoadedId || `PAY-${y}-${m}-${p}-${s}`; // Unique ID or Update existing

    const payload = {
        month: parseInt(m),
        year: parseInt(y),
        period: parseInt(p),
        sucursalId: s,
        sucursalName: sName,
        createdAt: new Date().toISOString(),
        rows: currentPayrollData
    };

    try {
        await db.collection('payrolls').doc(payrollId).set(payload);
        alert("Planilla guardada exitosamente.");
        currentLoadedId = payrollId; // Set as current context
    } catch (e) {
        console.error("Error saving payroll:", e);
        alert("Error al guardar planilla: " + e.message);
    }
}

async function togglePlanillaHistory() {
    const mainView = document.getElementById('planillaMainView');
    const histView = document.getElementById('planillaHistoryView');
    const controls = document.getElementById('planillaControls');

    if (mainView.style.display === 'none') {
        // Show Main, Hide History
        mainView.style.display = 'block';
        histView.style.display = 'none';
        controls.style.display = 'flex';
    } else {
        // Show History, Hide Main
        mainView.style.display = 'none';
        histView.style.display = 'block';
        controls.style.display = 'none'; // Hide generation controls
        await loadHistoryList();
    }
}

async function loadHistoryList() {
    const tbody = document.getElementById('planillaHistoryBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando historial...</td></tr>';

    try {
        const snap = await db.collection('payrolls').orderBy('createdAt', 'desc').get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay planillas guardadas.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const date = new Date(data.createdAt).toLocaleDateString();
            const period = `${data.period === 1 ? '1ra' : '2da'} Quincena - ${getMonthName(data.month)} ${data.year}`;

            // Calc Total Liquid for summary
            let totalLiquid = 0;
            if (data.rows) {
                totalLiquid = data.rows.reduce((acc, row) => acc + (row.salary + row.bonus - (row.igss + row.isr + row.judicial + row.discount + row.advance)), 0);
            }

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${date}</td>
                    <td style="padding: 10px;">${period}</td>
                    <td style="padding: 10px;">${data.sucursalName}</td>
                    <td style="padding: 10px; text-align: right;">Q${totalLiquid.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button class="btn btn-sm btn-primary" onclick="loadSavedPlanilla('${doc.id}')"><i class="fas fa-eye"></i> Ver/Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSavedPlanilla('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error("Error loading history:", e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Error: ${e.message}</td></tr>`;
    }
}

function getMonthName(idx) {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return months[idx] || "Desconocido";
}

async function loadSavedPlanilla(id) {
    try {
        const doc = await db.collection('payrolls').doc(id).get();
        if (!doc.exists) {
            alert("Planilla no encontrada.");
            return;
        }

        const data = doc.data();
        currentPayrollData = data.rows || [];
        currentLoadedId = id;

        // Restore Selectors to match info
        document.getElementById('planillaMonth').value = data.month;
        document.getElementById('planillaYear').value = data.year;
        document.getElementById('planillaPeriod').value = data.period;
        document.getElementById('planillaSucursal').value = data.sucursalId;

        // Switch View Back
        document.getElementById('planillaMainView').style.display = 'block';
        document.getElementById('planillaHistoryView').style.display = 'none';
        document.getElementById('planillaControls').style.display = 'flex';

        renderPlanillaRows();
        updateHeaderInfo();

    } catch (e) {
        console.error("Error loading saved planilla:", e);
        alert("Error al cargar planilla.");
    }
}

async function deleteSavedPlanilla(id) {
    if (!confirm("¿Está seguro de eliminar esta planilla guardada?")) return;

    try {
        await db.collection('payrolls').doc(id).delete();
        loadHistoryList(); // Refresh
    } catch (e) {
        alert("Error al eliminar: " + e.message);
    }
}

// Expose functions globally
window.loadPlanillaTable = loadPlanillaTable;
window.togglePlanillaHistory = togglePlanillaHistory;
window.exportPlanillaPDF = exportPlanillaPDF;
window.loadSavedPlanilla = loadSavedPlanilla;
window.deleteSavedPlanilla = deleteSavedPlanilla;
window.updatePlanillaRow = updatePlanillaRow;
window.updatePlanillaDays = updatePlanillaDays;
