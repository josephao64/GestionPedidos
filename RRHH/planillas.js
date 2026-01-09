
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

        // 2.1 Fetch Active Loans
        const loanSnap = await db.collection('loans').where('status', '==', 'active').get();
        const loansByEmp = {};
        loanSnap.forEach(doc => {
            const data = doc.data();
            if (!loansByEmp[data.employeeId]) loansByEmp[data.employeeId] = [];
            loansByEmp[data.employeeId].push({ id: doc.id, ...data });
        });

        // 3. Process Data
        const daysWorkedDefault = 15;
        const selectedSucursal = sucursalSelect ? sucursalSelect.value : 'all';

        // HEADER UPDATE LOGIC
        const logoImg = document.getElementById('headerCompanyLogo');
        const titleH3 = document.getElementById('headerCompanyTitle');

        // Reset defaults
        titleH3.innerText = "AMERICAN PIZZA";
        logoImg.src = "../Recibos/logo.png";

        if (selectedSucursal !== 'all') {
            try {
                // Fetch Branch to get empresaId
                const branchDoc = await db.collection('sucursales').doc(selectedSucursal).get();
                if (branchDoc.exists) {
                    const branchData = branchDoc.data();
                    // If has empresaId, fetch Company from 'empresas' collection
                    if (branchData.empresaId) {
                        const compDoc = await db.collection('empresas').doc(branchData.empresaId).get();
                        if (compDoc.exists) {
                            const compData = compDoc.data();
                            titleH3.innerText = (compData.name || "AMERICAN PIZZA").toUpperCase();
                            // Try logo field or default
                            if (compData.logo || compData.logoUrl) {
                                logoImg.src = compData.logo || compData.logoUrl;
                            }
                        }
                    } else if (branchData.companyName) {
                        // Fallback if name is directly on branch
                        titleH3.innerText = branchData.companyName.toUpperCase();
                    }
                }
            } catch (err) {
                console.error("Error updating header company info:", err);
            }
        } else {
            titleH3.innerText = "CORPORACIÓN";
        }


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
            // NEW: Calculate Loan Deductions
            // NEW: Calculate Loan Deductions
            let loanDeduction = 0;
            let wageAdvance = 0;
            const appliedLoans = [];

            // Check Period logic for "Mensual" loans (Usually only 2nd quincena)
            const pStartEl = document.getElementById('planillaStart');
            let startDay = 1;

            if (pStartEl && pStartEl.value) {
                startDay = new Date(pStartEl.value).getDate();
            } else {
                // Fallback to Period Selector if custom date not found
                const pPeriod = document.getElementById('planillaPeriod');
                if (pPeriod && pPeriod.value == '2') {
                    startDay = 16;
                }
            }

            const isSecondQuincena = startDay > 15;

            if (loansByEmp[doc.id]) {
                const empLoans = loansByEmp[doc.id];
                empLoans.forEach(loan => {
                    // Skip if not approved (Lifecycle check)
                    // Note: prestamos.js sets approvalStatus: 'approved'.
                    // If property missing (old loans), assume approved or check 'active'.
                    if (loan.approvalStatus && loan.approvalStatus !== 'approved') return;

                    const amountToDeduct = loan.installmentAmount;
                    let deducted = 0;

                    if (loan.type === 'adelanto') {
                        // Logic: If frequency is set, respect it. If not, deduct full.
                        // Usually advances are immediate, but user asked for installments.
                        let apply = true;
                        if (loan.frequency === 'mensual' && !isSecondQuincena) apply = false;

                        if (apply) {
                            deducted = amountToDeduct;
                            // Cap at balance
                            if (deducted > loan.balance) deducted = loan.balance;
                            wageAdvance += deducted;
                        }

                    } else if (loan.type === 'prestamo') {
                        if (loan.frequency === 'quincenal') {
                            deducted = amountToDeduct;
                        } else if (loan.frequency === 'mensual' && isSecondQuincena) {
                            deducted = amountToDeduct;
                        }

                        // Cap at balance
                        if (deducted > loan.balance) deducted = loan.balance;

                        if (deducted > 0) loanDeduction += deducted;
                    }

                    if (deducted > 0) {
                        appliedLoans.push({
                            loanId: loan.id,
                            amount: deducted,
                            type: loan.type
                        });
                    }
                });
            }

            const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
            const igss = periodSalary * igssPct;
            const isr = 0;

            currentPayrollData.push({
                id: doc.id,
                name: emp.fullName,
                days: daysWorkedDefault,
                monthlyBase: monthlySalary,
                monthlyBonusBase: monthlyBonus,
                salary: periodSalary,
                bonus: periodBonus,
                totalSalary: totalSalary,
                igss: igss,
                isr: isr,
                judicial: 0,
                discount: loanDeduction,
                advance: wageAdvance,
                appliedLoans: appliedLoans,
                // New Fields for Additional Income
                extraHours: 0,
                extraAmount: 0,
                otherBonus: 0,
                holidayBonus: 0,
                finalTotal: 0, // Will be calculated
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

        // Fetch ALL to filter safely in memory (Case Insensitive)
        const snap = await db.collection('sucursales').orderBy('name').get();
        select.innerHTML = '<option value="all">Todas las Sucursales</option>';

        const rawBranches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const branches = rawBranches.filter(b => b.status && b.status.toLowerCase() === 'activo');

        // Sort is handled by orderBy if names are consistent, but safe to sort again or skip.
        // branches.sort... (firebase orderBy is usually enough for name)

        branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = b.name;
            select.appendChild(opt);
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

        // Sum Extra
        const totalAdic = row.extraAmount + row.otherBonus + row.holidayBonus;
        const finalPay = liquid + totalAdic;

        row.finalTotal = finalPay; // Store for save


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

            <!-- Extra Income Inputs -->
             <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.5" value="${row.extraHours}" 
                    onchange="updatePlanillaExtra(${index}, 'hours', this.value)"
                    style="width: 40px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
            </td>
            <td style="${numStyle} background: #f0fdf4;">Q${row.extraAmount.toFixed(2)}</td>
            <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.01" value="${row.otherBonus.toFixed(2)}" 
                    onchange="updatePlanillaExtra(${index}, 'other', this.value)"
                    style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
            </td>
             <td style="${cellStyle} padding: 2px;">
                <input type="number" step="0.01" value="${row.holidayBonus.toFixed(2)}" 
                    onchange="updatePlanillaExtra(${index}, 'holiday', this.value)"
                    style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
            </td>
            <td style="${numStyle} font-weight: bold; background: #f0fdf4;">Q${(row.extraAmount + row.otherBonus + row.holidayBonus).toFixed(2)}</td>
            
            <td style="${numStyle} font-weight: bold; background: #dcfce7;">Q${(liquid + row.extraAmount + row.otherBonus + row.holidayBonus).toFixed(2)}</td>
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
                <td style="padding: 6px; border: 1px solid #000;">Q${sumLiquid.toFixed(2)}</td>
                
                <!-- Extra Totals -->
                <td style="padding: 6px; border: 1px solid #000;">-</td>
                 <td style="padding: 6px; border: 1px solid #000;">Q${currentPayrollData.reduce((a, b) => a + b.extraAmount, 0).toFixed(2)}</td>
                 <td style="padding: 6px; border: 1px solid #000;">Q${currentPayrollData.reduce((a, b) => a + b.otherBonus, 0).toFixed(2)}</td>
                 <td style="padding: 6px; border: 1px solid #000;">Q${currentPayrollData.reduce((a, b) => a + b.holidayBonus, 0).toFixed(2)}</td>
                 <td style="padding: 6px; border: 1px solid #000;">Q${currentPayrollData.reduce((a, b) => a + (b.extraAmount + b.otherBonus + b.holidayBonus), 0).toFixed(2)}</td>
                 <td style="padding: 6px; border: 1px solid #000; background: #eee;">Q${currentPayrollData.reduce((a, b) => a + b.finalTotal, 0).toFixed(2)}</td>

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

function updatePlanillaExtra(index, type, value) {
    const val = parseFloat(value) || 0;
    const row = currentPayrollData[index];

    if (type === 'hours') {
        row.extraHours = val;
        // Calc Amount: Base Monthly Salary / 30 / 8 * 1.5 * Hours
        const hourlyRate = (row.monthlyBase / 30) / 8;
        row.extraAmount = hourlyRate * 1.5 * val;
    } else if (type === 'other') {
        row.otherBonus = val;
    } else if (type === 'holiday') {
        row.holidayBonus = val;
    }

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

        // NEW: Process Loan Deductions
        await processLoanPayments(currentPayrollData, payrollId, `${p}/${m}/${y}`);

        alert("Planilla guardada exitosamente y préstamos actualizados.");
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
window.populatePlanillaBranches = populatePlanillaBranches;
window.printPaymentSlips = printPaymentSlips;
window.processLoanPayments = processLoanPayments;

function printPaymentSlips(type) {
    if (currentPayrollData.length === 0) {
        alert("No hay datos cargados para imprimir.");
        return;
    }

    const m = document.getElementById('planillaMonth');
    const p = document.getElementById('planillaPeriod');
    const y = document.getElementById('planillaYear');
    const s = document.getElementById('planillaSucursal');
    // Get Company Title - Fallback to global or derive
    let companyTitle = "AMERICAN PIZZA";
    const headerTitleEl = document.getElementById('headerCompanyTitle');
    if (headerTitleEl && headerTitleEl.innerText) companyTitle = headerTitleEl.innerText;

    // Attempt to get Logo
    let logoSrc = "../Recibos/logo.png";
    const logoEl = document.getElementById('headerCompanyLogo');
    if (logoEl && logoEl.src) logoSrc = logoEl.src;

    const mText = m ? m.options[m.selectedIndex].text : '';
    const yText = y ? y.value : '';
    const pText = p ? (p.value == '1' ? 'Del 01 al 15' : 'Del 16 al ' + new Date(y.value, parseInt(m.value) + 1, 0).getDate()) : '';
    const periodStr = `${pText} de ${mText} ${yText}`;
    const emissionDate = new Date().toLocaleDateString("es-GT");

    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>&nbsp;</title>`);
    w.document.write('<style>');
    w.document.write('body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }');
    w.document.write('@page { margin: 0; }');

    if (type === 'normal') {
        // Table Styles for Normal View
        w.document.write('@page { size: landscape; margin: 0; }');
        w.document.write('body { padding: 10mm; }');
        w.document.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #000; }');
        w.document.write('th { border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; font-size: 10px; }');
        w.document.write('td { border: 1px solid #000; padding: 4px; font-size: 11px; }');
        w.document.write('.amount { text-align: right; }');
        w.document.write('.center { text-align: center; }');
        w.document.write('.header-container { display: flex; align-items: center; margin-bottom: 20px; }');
        w.document.write('.logo { height: 50px; margin-right: 20px; }');
        w.document.write('.title-box { text-align: center; flex: 1; text-transform: uppercase; font-weight: bold; }');
        w.document.write('tfoot { font-weight: bold; background: #f0f0f0; }');

        w.document.write('</style></head><body>');

        // Header
        w.document.write(`
            <div class="header-container">
                <img src="${logoSrc}" class="logo" alt="Logo">
                <div class="title-box">
                    <div>${companyTitle}</div>
                    <div>NÓMINA DE SUELDOS</div>
                    <div>${periodStr}</div>
                </div>
                <div style="width: 70px;"></div>
            </div>
        `);

        // Table Normal
        w.document.write('<table><thead>');
        // Main Headers
        w.document.write(`
            <tr>
                <th rowspan="2" style="width: 200px;">NOMBRE EMPLEADO</th>
                <th colspan="4">SALARIO DEVENGADO</th>
                <th colspan="6">DEDUCCIONES LEGALES</th>
                <th rowspan="2">SALARIO<br>LÍQUIDO</th>
                <th rowspan="2" style="width: 120px;">FIRMA</th>
            </tr>
        `);
        // Sub Headers
        w.document.write(`
            <tr>
                <th>DÍAS<br>TRAB.</th>
                <th>SALARIO</th>
                <th>BONIF.<br>DECRETO</th>
                <th>SALARIO<br>TOTAL</th>
                
                <th>IGSS</th>
                <th>ISR</th>
                <th>JUDICIAL</th>
                <th>DESCUENTO</th>
                <th>ANTICIPO<br>QUINCENA</th>
                <th>TOTAL<br>DEDUCC.</th>
            </tr>
        `);
        w.document.write('</thead><tbody>');

        // Totals
        let tSalary = 0, tBonus = 0, tTotalSal = 0;
        let tIgss = 0, tIsr = 0, tJud = 0, tDisc = 0, tAdv = 0, tTotalDed = 0;
        let tLiquid = 0;

        currentPayrollData.forEach(row => {
            const totalSal = row.salary + row.bonus;
            const totalDed = row.igss + row.isr + row.judicial + row.discount + row.advance;
            const liq = totalSal - totalDed;

            tSalary += row.salary; tBonus += row.bonus; tTotalSal += totalSal;
            tIgss += row.igss; tIsr += row.isr; tJud += row.judicial;
            tDisc += row.discount; tAdv += row.advance; tTotalDed += totalDed;
            tLiquid += liq;

            w.document.write(`
                <tr>
                    <td>${row.name}</td>
                    <td class="center">${row.days}</td>
                    <td class="amount">Q${row.salary.toFixed(2)}</td>
                    <td class="amount">Q${row.bonus.toFixed(2)}</td>
                    <td class="amount">Q${totalSal.toFixed(2)}</td>
                    
                    <td class="amount">Q${row.igss.toFixed(2)}</td>
                    <td class="amount">Q${row.isr.toFixed(2)}</td>
                    <td class="amount">Q${row.judicial.toFixed(2)}</td>
                    <td class="amount">Q${row.discount.toFixed(2)}</td>
                    <td class="amount">Q${row.advance.toFixed(2)}</td>
                    <td class="amount">Q${totalDed.toFixed(2)}</td>
                    
                    <td class="amount">Q${liq.toFixed(2)}</td>
                    <td style="border-bottom: 1px solid #000;"></td>
                </tr>
            `);
        });

        // Footer Totals
        w.document.write(`
            </tbody><tfoot>
                <tr>
                    <td style="text-align:right;">TOTALES:</td>
                    <td>-</td>
                    <td class="amount">Q${tSalary.toFixed(2)}</td>
                    <td class="amount">Q${tBonus.toFixed(2)}</td>
                    <td class="amount">Q${tTotalSal.toFixed(2)}</td>
                    
                    <td class="amount">Q${tIgss.toFixed(2)}</td>
                    <td class="amount">Q${tIsr.toFixed(2)}</td>
                    <td class="amount">Q${tJud.toFixed(2)}</td>
                    <td class="amount">Q${tDisc.toFixed(2)}</td>
                    <td class="amount">Q${tAdv.toFixed(2)}</td>
                    <td class="amount">Q${tTotalDed.toFixed(2)}</td>
                    
                    <td class="amount">Q${tLiquid.toFixed(2)}</td>
                    <td></td>
                </tr>
            </tfoot></table>
        `);

        w.document.write(`<div style="margin-top:20px; font-weight:bold; font-size: 1.2em; text-align:right;">TOTAL PLANILLA: Q${tLiquid.toFixed(2)}</div>`);

    } else {
        // EXTRA SLIPS (Individual)
        w.document.write('@page { size: portrait; margin: 0; }');
        w.document.write('body { padding: 10mm; }');
        w.document.write('.slip-container { border-bottom: 2px dashed #000; padding-bottom: 20px; margin-bottom: 20px; page-break-inside: avoid; }');
        w.document.write('.header { display: flex; justify-content: space-between; margin-bottom: 10px; }');
        w.document.write('.header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }');
        w.document.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 2px solid #000; }');
        w.document.write('th { border: 1px solid #000; padding: 4px; text-align: center; background: #eee; font-weight: bold; }');
        w.document.write('td { border: 1px solid #000; padding: 4px; vertical-align: top; }'); // Align top specifically
        w.document.write('.amount { text-align: right; }');
        w.document.write('.total-box { border: 2px solid #000; padding: 5px 20px; font-weight: bold; font-size: 14px; display: inline-block; margin-top: 10px; }');
        w.document.write('.footer { margin-top: 40px; display: flex; justify-content: space-between; }');
        w.document.write('.signature { border-top: 2px solid #000; width: 40%; text-align: center; padding-top: 5px; }');
        w.document.write('@media print { .slip-container { page-break-after: always; } .slip-container:last-child { page-break-after: auto; } }');
        w.document.write('</style></head><body>');

        currentPayrollData.forEach(row => {
            const hasExtra = (row.extraAmount + row.otherBonus + row.holidayBonus) > 0;
            if (!hasExtra) return;

            // Pass logo logic too if you want logo on slips
            w.document.write(generateSlipHtml(row, 'extra', companyTitle, periodStr, emissionDate));
        });
    }

    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 1000);
}

function generateSlipHtml(row, type, companyName, period, emission) {
    let incomeHtml = '';
    let deductHtml = '';
    let totalIncome = 0;
    let totalDeduct = 0;
    let liquid = 0;

    // NOTE: 'normal' is now handled by Table view above, but we keep this just in case logic is reused or reverted.
    // Logic below handles 'extra' individual slip.

    if (type === 'extra') {
        // EXTRA SLIP
        // Items: Asueto, Horas Extras, Otros

        if (row.holidayBonus > 0) {
            incomeHtml += `<tr><td>Asueto</td><td class="amount">Q${row.holidayBonus.toFixed(2)}</td></tr>`;
            totalIncome += row.holidayBonus;
        }
        if (row.extraAmount > 0) {
            incomeHtml += `<tr><td>Horas Extras (${row.extraHours})</td><td class="amount">Q${row.extraAmount.toFixed(2)}</td></tr>`;
            totalIncome += row.extraAmount;
        }
        if (row.otherBonus > 0) {
            incomeHtml += `<tr><td>Otros Ingresos</td><td class="amount">Q${row.otherBonus.toFixed(2)}</td></tr>`;
            totalIncome += row.otherBonus;
        }

        // Deductions for Extra? Usually none unless configured. 
        deductHtml = '<tr><td colspan="2" style="text-align:center;">-</td></tr>';
        totalDeduct = 0;
        liquid = totalIncome;
    }

    return `
        <div class="slip-container">
            <div class="header">
                <div>
                    <h2>${companyName}</h2>
                    <div>BOLETA DE PAGO (EXTRAS)</div>
                    <div>Periodo: ${period}</div>
                </div>
                <div style="text-align: right;">
                    <div>EMISIÓN: ${emission}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <strong>Código:</strong> ${row.id.substring(0, 6).toUpperCase()} <br>
                <strong>Empleado:</strong> ${row.name}
            </div>

            <table style="border: 2px solid #000;">
                <thead>
                    <tr>
                        <th style="width: 50%;">DETALLE DEVENGADO</th>
                        <th style="width: 50%;">DETALLE DE DESCUENTOS</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 0; border: 0; border-right: 2px solid #000;">
                           <table style="width: 100%; border: 0; margin: 0;">
                                ${incomeHtml}
                                <tr style="font-weight: bold; border-top: 1px solid #000;">
                                    <td>Total Devengado</td>
                                    <td class="amount">Q${totalIncome.toFixed(2)}</td>
                                </tr>
                           </table>
                        </td>
                         <td style="padding: 0; border: 0;">
                           <table style="width: 100%; border: 0; margin: 0;">
                                ${deductHtml}
                                <tr style="font-weight: bold; border-top: 1px solid #000;">
                                    <td>Total Descuentos</td>
                                    <td class="amount">Q${totalDeduct.toFixed(2)}</td>
                                </tr>
                           </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style="text-align: center; margin-top: 15px;">
                <div class="total-box">
                    Líquido Q${liquid.toFixed(2)}
                </div>
            </div>

            <div class="footer">
                <div class="signature">
                    F. __________________________
                </div>
            </div>
        </div>
    `;
}

async function processLoanPayments(payrollRows, payrollId, periodStr) {
    console.log("Procesando pagos de préstamos...");
    const batch = db.batch();
    let updatesCount = 0;

    for (const row of payrollRows) {
        // If no applied loans metadata, skip (unless we want to infer from discount?)
        // For now, only process tracked loans to avoid errors.
        if (!row.appliedLoans || row.appliedLoans.length === 0) continue;

        // Group by type
        const loans = row.appliedLoans.filter(l => l.type === 'prestamo');
        const advances = row.appliedLoans.filter(l => l.type === 'adelanto');

        // Logic for Prestamos (vs row.discount)
        if (loans.length > 0) {
            let totalDiscount = row.discount || 0; // Actual value in payroll

            // Distribute totalDiscount among loans
            for (const loan of loans) {
                if (totalDiscount <= 0) break; // No more money to pay loans

                let payment = loan.amount; // Intended amount
                if (payment > totalDiscount) payment = totalDiscount; // Partial payment if discount reduced

                // Update Loan
                const loanRef = db.collection('loans').doc(loan.loanId);

                // We use increment for safety
                batch.update(loanRef, {
                    balance: firebase.firestore.FieldValue.increment(-payment),
                    installmentsPaid: firebase.firestore.FieldValue.increment(1), // Count as 1 paid installment (or partial?) 
                    // Usually installmentsPaid is just a counter. If partial, maybe we shouldn't increment? 
                    // Let's increment for now, assuming usually it's full. 
                    lastPaymentDate: new Date().toISOString()
                });

                // Record Payment
                const payRef = loanRef.collection('payments').doc();
                batch.set(payRef, {
                    date: new Date().toISOString(),
                    amount: payment,
                    payrollId: payrollId,
                    period: periodStr,
                    note: 'Descuento en Planilla'
                });

                totalDiscount -= payment;
                updatesCount++;
            }
        }

        // Logic for Adelantos (vs row.advance)
        if (advances.length > 0) {
            let totalAdvance = row.advance || 0;

            for (const ad of advances) {
                if (totalAdvance <= 0) break;

                let payment = ad.amount;
                if (payment > totalAdvance) payment = totalAdvance;

                const adRef = db.collection('loans').doc(ad.loanId);
                batch.update(adRef, {
                    balance: firebase.firestore.FieldValue.increment(-payment),
                    installmentsPaid: firebase.firestore.FieldValue.increment(1),
                    lastPaymentDate: new Date().toISOString(),
                    // If balance becomes <= 0, status should be 'paid'. 
                    // We can't check balance in batch easily. 
                    // We rely on a separate cleanup or client checking.
                    // But for now, let's just update.
                });

                const payRef = adRef.collection('payments').doc();
                batch.set(payRef, {
                    date: new Date().toISOString(),
                    amount: payment,
                    payrollId: payrollId,
                    period: periodStr,
                    note: 'Descuento de Anticipo en Planilla'
                });

                totalAdvance -= payment;
                updatesCount++;
            }
        }
    }

    if (updatesCount > 0) {
        await batch.commit();
        console.log("Pagos de préstamos actualizados.");
    }
}
