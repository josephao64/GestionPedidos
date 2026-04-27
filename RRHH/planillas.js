
// --- PERSONALIZED SLIP LOGIC ---

async function openPersonalizedSlipModal() {
    const modal = document.getElementById('personalizedSlipModal');
    if (!modal) return;
    
    const branchSelect = document.getElementById('customSlipBranchSelect');
    const form = document.getElementById('personalizedSlipForm');

    // Reset Form if exists
    if (form) form.reset();

    // Set default date to today comfortably
    const dateTextInput = document.getElementById('customSlipDateText');
    if (dateTextInput) dateTextInput.value = new Date().toLocaleDateString('es-GT');
    
    const emissionDateInput = document.getElementById('customSlipEmissionDate');
    if (emissionDateInput) emissionDateInput.value = new Date().toISOString().split('T')[0];

    // Show Modal using premium class
    modal.classList.add('active');

    // Populate Branches
    if (branchSelect) {
        branchSelect.innerHTML = '<option value="">Cargando...</option>';
        try {
            // Fetch branches from Firestore
            const snap = await db.collection('sucursales').orderBy('name').get();
            branchSelect.innerHTML = '<option value="">Seleccione para Autocompletar...</option>';

            snap.forEach(doc => {
                const data = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                // Store additional data for printing
                option.dataset.name = data.name;
                option.dataset.membrete = data.membrete || '';
                option.dataset.logo = data.logo || '';
                option.dataset.company = data.companyName ? data.companyName.toUpperCase() : data.name.toUpperCase();
                option.textContent = data.name;
                branchSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Error loading branches:", e);
            branchSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
    }
}

function closePersonalizedSlipModal() {
    const modal = document.getElementById('personalizedSlipModal');
    if (modal) modal.classList.remove('active');
}

async function printPersonalizedSlip() {
    // Gather Data
    // Logic updated to support the new Editable Inputs
    const companyInput = document.getElementById('customSlipBranchInput').value;
    const titleInput = document.getElementById('customSlipTitle').value || 'BOLETA DE PAGO';
    const name = document.getElementById('customSlipName').value;
    const dateText = document.getElementById('customSlipDateText').value;
    const amount = parseFloat(document.getElementById('customSlipAmount').value) || 0;
    const details = document.getElementById('customSlipDetail').value;
    const rawEmissionDate = document.getElementById('customSlipEmissionDate').value;

    // Logo URL from hidden input or fallback
    const logoUrl = document.getElementById('customSlipLogoUrl').value || '../Recibos/logo.png';

    /* 
       Format: Tabular Style (American Pizza Boleta)
       Header: Left Logo + Title + Period info. Right: Emision Date.
       Table: Detalle Devengado | Detalle Descuentos
    */

    const win = window.open('', '_blank');

    // Format emission date
    let emissionDate = new Date().toLocaleDateString('es-GT');
    if (rawEmissionDate) {
        const [year, month, day] = rawEmissionDate.split('-');
        emissionDate = `${day}/${month}/${year}`;
    }

    win.document.write(`
        <html>
        <head>
            <title>${titleInput}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
                @page { margin: 0; size: letter; }
                body { font-family: 'Roboto', Arial, sans-serif; padding: 40px; font-size: 13px; color: #000; }
                
                .header-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }
                .company-name {
                    font-size: 18px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .doc-type {
                    font-size: 14px;
                    margin-top: 5px;
                }
                .period-line {
                    font-size: 13px;
                    margin-top: 5px;
                }
                .emission-line {
                    font-size: 12px;
                    text-align: right;
                }
                
                .emp-info {
                    margin-bottom: 15px;
                }
                .emp-line {
                    margin-bottom: 4px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    border: 2px solid #000;
                }
                th {
                    border: 1px solid #000;
                    padding: 4px 8px;
                    text-align: center;
                    font-weight: bold;
                    text-transform: uppercase;
                    background: #fff;
                }
                td {
                    border: 1px solid #000;
                    padding: 4px 8px;
                    vertical-align: top;
                    height: 24px; /* Min height for empty look */
                }
                .col-money {
                    text-align: right;
                    width: 100px;
                }
                .footer-liquid {
                    display: flex;
                    justify-content: center;
                    margin-top: 10px;
                    margin-bottom: 60px;
                }
                .liquid-box {
                    border: 2px solid #000;
                    padding: 8px 30px;
                    font-weight: bold;
                    font-size: 16px;
                }
                
                .signatures {
                    margin-top: 80px;
                    border-top: 2px solid #000;
                    width: 300px;
                }
            </style>
        </head>
        <body>
            
            <div class="header-section">
                <div>
                    <div class="company-name">${companyInput}</div>
                    <div class="doc-type">${titleInput}</div>
                    <div class="period-line">Periodo/Fecha: ${dateText}</div>
                </div>
                <div class="emission-line">
                    EMISIÓN: ${emissionDate}
                </div>
            </div>

            <div class="emp-info">
                <div class="emp-line"><strong>Empleado:</strong> ${name}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th colspan="2">DETALLE DEVENGADO</th>
                        <th colspan="2">DETALLE DE DESCUENTOS</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Row 1: The Main Item -->
                    <tr>
                        <td>${details || 'Pago Regular'}</td>
                        <td class="col-money">Q${amount.toFixed(2)}</td>
                        <td>-</td>
                        <td class="col-money">Q0.00</td>
                    </tr>
                    <!-- Row 2: Totals Header inside table -->
                    <tr style="font-weight:bold;">
                        <td>Total Devengado</td>
                        <td class="col-money">Q${amount.toFixed(2)}</td>
                        <td>Total Descuentos</td>
                        <td class="col-money">Q0.00</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer-liquid">
                <div class="liquid-box">Líquido Q${amount.toFixed(2)}</div>
            </div>

            <div class="signatures">
                <div style="margin-top: 5px; font-size: 11px;">F. __________________________________</div>
            </div>

            <script>window.print();</script>
        </body>
        </html>
    `);
    win.document.close();
}
// planillas.js - Payroll Logic

let currentPayrollData = [];
let isHistoryMode = false;
let currentLoadedId = null; // If viewing/editing a saved payroll
let currentDeleteId = null; // ID of payroll to delete

document.addEventListener('DOMContentLoaded', () => {
    // Populate Year
    const yearSelect = document.getElementById('planillaYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option><option value="${currentYear - 1}">${currentYear - 1}</option>`;
    }

    // Period Change Listener
    const periodSelect = document.getElementById('planillaPeriod');
    if (periodSelect) {
        periodSelect.addEventListener('change', togglePeriodInputs);
    }
});

// Toggle Custom Date Inputs
function togglePeriodInputs() {
    const period = document.getElementById('planillaPeriod').value;
    const container = document.getElementById('customPeriodContainer');
    const monthSelect = document.getElementById('planillaMonth');
    const yearSelect = document.getElementById('planillaYear');

    if (period === 'custom') {
        container.style.display = 'flex';
        // Hide standard Month/Year selectors as they might be confusing or redundant if we pick specific dates?
        // Actually, let's keep them visible but maybe disable them or just let the date inputs override.
        // User requested "fecha inicio fecha fin", implying exact dates.
        // Let's rely on the inputs.
    } else {
        container.style.display = 'none';
    }
}

// Called when switching to 'planillas' section or manually
// Main Logic
async function loadPlanillaTable() {
    isHistoryMode = false;
    currentLoadedId = null;

    // Ensure view is correct - Modified for new Container
    document.getElementById('planillaMainView').style.display = 'block';
    document.getElementById('planillaHistoryView').style.display = 'none';
    document.getElementById('planillaControls').style.display = 'flex';

    // Force close modals
    if (window.closePayrollTotalsModal) window.closePayrollTotalsModal();
    if (window.closeSaveModal) window.closeSaveModal();
    if (window.closeDeleteModal) window.closeDeleteModal();

    // Ensure branches are populated
    const sucursalSelect = document.getElementById('planillaSucursal');
    if (sucursalSelect && sucursalSelect.options.length <= 1) {
        await populatePlanillaBranches();
    }

    const tbodyContainer = document.getElementById('planillaTablesContainer');
    if (!tbodyContainer) return;

    tbodyContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Cargando planilla...</div>';

    try {
        // 1. Fetch Active Employees
        const empSnap = await db.collection('employees').where('status', '==', 'active').get();
        if (empSnap.empty) {
            tbodyContainer.innerHTML = '<div style="text-align:center; padding: 20px;">No hay empleados activos.</div>';
            return;
        }

        // 2. Fetch Positions
        const posSnap = await db.collection('positions').get();
        const positions = {};
        posSnap.forEach(doc => positions[doc.id] = doc.data());

        // 3. Fetch Active Loans (Wrapper function or direct)
        const loansByEmp = await fetchActiveLoansForPayroll();

        // 4. Process Data Setup
        let daysWorked = 15;
        const selectedSucursal = sucursalSelect ? sucursalSelect.value : 'all';
        const periodVal = document.getElementById('planillaPeriod').value;
        const yearVal = parseInt(document.getElementById('planillaYear').value);
        const monthVal = parseInt(document.getElementById('planillaMonth').value);

        let startDate, endDate;

        if (periodVal === 'custom') {
            const pStart = document.getElementById('planillaStart').value;
            const pEnd = document.getElementById('planillaEnd').value;
            if (!pStart || !pEnd) {
                alert("Por favor seleccione fechas de inicio y fin.");
                tbodyContainer.innerHTML = '';
                return;
            }
            startDate = new Date(pStart + 'T12:00:00');
            endDate = new Date(pEnd + 'T12:00:00');

            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            daysWorked = diffDays; // Custom days
        } else {
            // Standard Quincena Logic
            if (periodVal == '1') {
                startDate = new Date(yearVal, monthVal, 1);
                endDate = new Date(yearVal, monthVal, 15);
                daysWorked = 15;
            } else {
                startDate = new Date(yearVal, monthVal, 16);
                endDate = new Date(yearVal, monthVal + 1, 0); // Last day
                daysWorked = 15; // Standardize 2nd fortnight as 15 days even if 28/31
            }
        }
        // Fetch Branch Info (for headers) once
        let mainBranchInfo = { name: "CORPORACION DE ALIMENTOS, S.A.", logo: "../Recibos/logo.png" };
        if (selectedSucursal !== 'all') {
            try {
                const branchDoc = await db.collection('sucursales').doc(selectedSucursal).get();
                if (branchDoc.exists) {
                    const bData = branchDoc.data();
                    if (bData.empresaId) {
                        const cDoc = await db.collection('empresas').doc(bData.empresaId).get();
                        if (cDoc.exists) {
                            mainBranchInfo.name = cDoc.data().name || "CORPORACION DE ALIMENTOS, S.A.";
                            if (cDoc.data().logo) mainBranchInfo.logo = cDoc.data().logo;
                        }
                    } else if (bData.companyName) {
                        mainBranchInfo.name = bData.companyName.toUpperCase();
                    }
                }
            } catch (e) { console.error(e); }
        }


        currentPayrollData = [];

        empSnap.forEach(doc => {
            const emp = doc.data();

            // 1. FILTER: Skip if hired AFTER the payroll period
            if (emp.startDate) {
                // Parse date robustly (DD/MM/YYYY or YYYY-MM-DD or T-formatted)
                let sDate = emp.startDate;
                let hireD = null;
                let parts = sDate.split('-');
                if (parts.length < 3) parts = sDate.split('/');
                if (parts.length === 3) {
                    if (parts[0].length === 4) hireD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    else hireD = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                } else {
                    hireD = new Date(sDate);
                }

                if (!isNaN(hireD.getTime()) && hireD > endDate) {
                    return; // Han't started yet as of this period's end
                }
            }

            // Filter by Sucursal (Modified for Transferred Employees)
            // Determine effective branch: if transferred, use temp branch; otherwise use origin.
            const effectiveSucursalId = emp.isTempTransfer ? emp.tempSucursalId : emp.sucursalId;

            if (selectedSucursal !== 'all' && effectiveSucursalId !== selectedSucursal) return;

            const pos = positions[emp.positionId] || {};

            // Priority: Min Wage (Dynamic) -> Employee Snapshot -> Position -> 0
            // Note: Check if 'pos' uses 'salario' or 'baseSalary'.
            let monthlySalary = parseFloat(emp.baseSalary || pos.salario || pos.baseSalary || 0);

            // Dynamic Min Wage Override
            if (pos.salaryTypeId === 'min_wage') {
                const config = window.rrhhConfig.get ? window.rrhhConfig.get() : {};
                if (config.minWageMonthly) monthlySalary = parseFloat(config.minWageMonthly);
            }

            // Capture Global Overtime Rate
            const globalOvertimeRate = parseFloat(window.rrhhConfig.get ? (window.rrhhConfig.get().overtimeRate || 0) : 0);
            let overtimeRateOverride = 0;

            // Pedidos Flash Overrides (Salary, Bonus, Overtime Rate)
            const empSettings = window.rrhhConfig.getBranchSettings(effectiveSucursalId);

            // --- PROBATION CHECK (Robust) ---
            let isProbation = false;
            const effectiveStartDate = emp.startDate || emp.hiringDate || emp.fechaIngreso;
            if (effectiveStartDate) {
                let hireDate = null;
                // Handle Firestore Timestamp, Date object, or String
                if (typeof effectiveStartDate === 'object' && effectiveStartDate.toDate) {
                    hireDate = effectiveStartDate.toDate();
                } else if (effectiveStartDate instanceof Date) {
                    hireDate = effectiveStartDate;
                } else if (typeof effectiveStartDate === 'string') {
                    let sDate = effectiveStartDate.trim();
                    let parts = sDate.split('-');
                    if (parts.length < 3) parts = sDate.split('/');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) hireDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        else hireDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    } else {
                        hireDate = new Date(sDate);
                    }
                }

                if (hireDate && !isNaN(hireDate.getTime())) {
                    hireDate.setHours(0, 0, 0, 0);

                    // Period End comparison
                    const refDate = new Date(endDate);
                    refDate.setHours(0, 0, 0, 0);
                    const diffTimeP = refDate - hireDate;
                    const diffDaysP = Math.ceil(diffTimeP / (1000 * 60 * 60 * 24));

                    // Current Date comparison (consistency with Badge)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffTimeT = today - hireDate;
                    const diffDaysT = Math.ceil(diffTimeT / (1000 * 60 * 60 * 24));

                    let pDays = 60; // Default
                    if (empSettings && empSettings.probationDays !== undefined && empSettings.probationDays !== '') {
                        pDays = parseInt(empSettings.probationDays);
                    } else if (window.rrhhConfig.get().probationDays) {
                        pDays = parseInt(window.rrhhConfig.get().probationDays);
                    }

                    // If in probation during the period OR currently in probation
                    if ((diffDaysP >= 0 && diffDaysP <= pDays) || (diffDaysT >= 0 && diffDaysT <= pDays)) {
                        isProbation = true;

                        // Overrides
                        if (empSettings.probationSalary && empSettings.probationSalary > 0) {
                            monthlySalary = parseFloat(empSettings.probationSalary);
                        }
                        if (empSettings.probationOvertimeRate && empSettings.probationOvertimeRate > 0) {
                            overtimeRateOverride = parseFloat(empSettings.probationOvertimeRate);
                        }
                    }

                    if (emp.fullName.toLowerCase().includes('kevin')) {
                        console.log(`[DEBUG PROBATION] Kevin: hireDate=${hireDate.toISOString()}, diffDaysP=${diffDaysP}, diffDaysT=${diffDaysT}, pDays=${pDays}, isProbation=${isProbation}`);
                    }
                }
            }
            // --------------------------------

            const subEmpresaRaw = (emp.subEmpresa || 'Propia').trim();
            const isPedidosFlash = (subEmpresaRaw.toUpperCase() === 'PEDIDOS FLASH');

            // Initialize Bonus from Position or Global Default
            let monthlyBonus = parseFloat(pos.bonificacion || pos.bonus || (window.rrhhConfig.get().bonus) || 250);

            if (isPedidosFlash) {
                if (empSettings.pedidosSalary && empSettings.pedidosSalary > 0) {
                    monthlySalary = parseFloat(empSettings.pedidosSalary);
                }
                if (empSettings.pedidosBonus !== undefined) {
                    const bVal = parseFloat(empSettings.pedidosBonus);
                    if (!isNaN(bVal)) monthlyBonus = bVal;
                }
                if (empSettings.pedidosOvertime && empSettings.pedidosOvertime > 0) {
                    overtimeRateOverride = parseFloat(empSettings.pedidosOvertime);
                }
            }

            // Calculations
            let periodSalary = 0;
            let periodBonus = 0;

            if (daysWorked >= 15) {
                periodSalary = monthlySalary / 2;
                periodBonus = monthlyBonus / 2;
            } else {
                const dailyRate = (monthlySalary * 12) / 365;
                periodSalary = dailyRate * daysWorked;
                const dailyBonus = (monthlyBonus * 12) / 365;
                periodBonus = dailyBonus * daysWorked;
            }

            const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
            let igss = periodSalary * igssPct;

            // --- FINAL PROBATION OVERRIDE ---
            if (isProbation) {
                igss = 0;
                periodBonus = 0;
            }
            // --------------------------------

            const totalSalary = periodSalary + periodBonus;
            // Dynamic IGSS from Config
            // NEW: Calculate Loan Deductions
            // NEW: Calculate Loan Deductions
            let loanDeduction = 0;
            let wageAdvance = 0;
            const appliedLoans = [];

            // Check Period logic for "Mensual" loans (Usually only 2nd quincena)
            // Use resolved startDate from above
            const startDay = startDate.getDate();

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

            const isr = 0;

            currentPayrollData.push({
                id: doc.id,
                name: emp.fullName,
                days: daysWorked,
                monthlyBase: monthlySalary,
                monthlyBonusBase: monthlyBonus,
                salary: periodSalary,
                bonus: periodBonus,
                totalSalary: totalSalary,
                igss: igss,
                overtimeRate: overtimeRateOverride, // Can be 0 if not set
                globalOvertimeRate: globalOvertimeRate, // New Global Config
                isr: isr,
                judicial: 0,
                discount: loanDeduction,
                advance: wageAdvance,
                appliedLoans: appliedLoans,
                extraHours: 0,
                extraAmount: 0,
                otherBonus: 0,
                otherBonusDesc: "", // Description for Other Income
                holidayBonus: 0,
                finalTotal: 0, // Will be calculated
                isNew: true,
                subEmpresa: isProbation ? 'EN PRUEBA' : subEmpresaRaw,
                branchName: mainBranchInfo.name,
                branchLogo: mainBranchInfo.logo
            });
        });

        if (currentPayrollData.length === 0) {
            tbodyContainer.innerHTML = '<div style="text-align:center; padding: 20px;">No se encontraron empleados para esta sucursal.</div>';
            return;
        }

        // Sort by Name
        currentPayrollData.sort((a, b) => a.name.localeCompare(b.name));

        renderPlanillaRows();

    } catch (e) {
        console.error("Error generating payroll:", e);
        tbodyContainer.innerHTML = `<div style="text-align:center; color:red; padding: 20px;">Error: ${e.message}</div>`;
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

// Render rows grouped by subEmpresa (split Pedidos Flash)
function renderPlanillaRows() {
    const container = document.getElementById('planillaTablesContainer');
    if (!container) return;
    container.innerHTML = '';

    // Group Data
    const groups = {};
    // Ensure we process "Propia" first, then others? Or just order keys.
    const defaultKey = 'Propia';

    currentPayrollData.forEach((row, index) => {
        const key = row.subEmpresa || defaultKey;
        if (!groups[key]) groups[key] = [];
        // Store original index to bind events correctly
        groups[key].push({ ...row, originalIndex: index });
    });

    const keys = Object.keys(groups).sort((a, b) => {
        if (a === defaultKey) return -1;
        if (b === defaultKey) return 1;
        return a.localeCompare(b);
    });

    keys.forEach((groupKey, groupIdx) => {
        const groupRows = groups[groupKey];

        // Container for this table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'planilla-sheet';
        if (groupIdx > 0) {
            tableWrapper.style.pageBreakBefore = 'always';
            tableWrapper.style.marginTop = '40px';
            // Add a visual separator for screen view
            const sep = document.createElement('hr');
            sep.style.margin = '40px 0';
            sep.style.borderTop = '2px dashed #ccc';
            // Only visible on screen, print uses page-break
            sep.className = 'screen-only-separator';
            container.appendChild(sep);
        }

        // 1. Header Generation
        const headerTemplate = document.getElementById('planillaHeaderTemplate');
        const header = headerTemplate.cloneNode(true);
        header.id = '';
        header.style.display = 'flex'; // Make visible

        // Customize Header
        const titleH3 = header.querySelector('h3');
        const logoImg = header.querySelector('img');
        const dateP = header.querySelector('p'); // #planillaDateDisplayTemplate

        // Set Date
        // We need to reconstruct date string or read from hidden template?
        // Better: reconstruct.
        const m = document.getElementById('planillaMonth');
        const p = document.getElementById('planillaPeriod');
        const y = document.getElementById('planillaYear');
        let dateText = "";
        if (p.value === 'custom') {
            const s = new Date(document.getElementById('planillaStart').value);
            const e = new Date(document.getElementById('planillaEnd').value);
            // Simple format
            const f = d => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
            dateText = `${f(s)} - ${f(e)}`;
        } else {
            const pText = p.value == '1' ? 'DEL 01' : 'DEL 16';
            const pEndText = p.value == '1' ? 'AL 15' : 'AL ' + new Date(y.value, parseInt(m.value) + 1, 0).getDate();
            dateText = `${pText}/${(parseInt(m.value) + 1).toString().padStart(2, '0')}/${y.value} ${pEndText}/${(parseInt(m.value) + 1).toString().padStart(2, '0')}/${y.value}`;
        }
        dateP.innerText = dateText;

        // Set Company Name
        if (groupKey.toUpperCase() === 'PEDIDOS FLASH') {
            titleH3.innerText = "PEDIDOS FLASH";
            logoImg.src = "../resources/images/PEDIDOS FLASH.png";
        } else {
            // Use the one from the first row (common branch info)
            titleH3.innerText = groupRows[0].branchName || "CORPORACION DE ALIMENTOS, S.A.";
            if (groupKey === 'EN PRUEBA') {
                titleH3.innerText += " (EN PERIODO DE PRUEBA)";
            }
            if (groupRows[0].branchLogo) logoImg.src = groupRows[0].branchLogo;
        }

        tableWrapper.appendChild(header);

        // 2. Table Generation
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'Arial, sans-serif';
        table.style.fontSize = '0.75rem';
        table.style.color = '#000';

        // Header HTML (Static copy from HTML)
        table.innerHTML = `
            <thead>
                <tr style="border: 2px solid #000;">
                    <th rowspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; width: 220px;">NOMBRE EMPLEADO</th>
                    <th colspan="4" style="border: 1px solid #000; padding: 4px; text-align: center; border-bottom: 2px solid #000;">SALARIO DEVENGADO</th>
                    <th colspan="6" style="border: 1px solid #000; padding: 4px; text-align: center; border-bottom: 2px solid #000;">DEDUCCIONES LEGALES</th>
                    <th rowspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; background: #fff; width: 80px;">SALARIO<br>LÍQUIDO</th>
                    <th colspan="5" style="border: 1px solid #000; padding: 4px; text-align: center; border-bottom: 2px solid #000; background: #f0fdf4;">INGRESOS ADICIONALES</th>
                    <th rowspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; font-weight: bold; background: #dcfce7;">TOTAL<br>A RECIBIR</th>
                    <th rowspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; width: 150px;">FIRMA</th>
                </tr>
                <tr style="border: 2px solid #000; border-top: none;">
                    <th style="border: 1px solid #000; padding: 4px; width: 50px;">DÍAS<br>TRAB.</th>
                    <th style="border: 1px solid #000; padding: 4px;">SALARIO</th>
                    <th style="border: 1px solid #000; padding: 4px;">BONIF.<br>DECRETO</th>
                    <th style="border: 1px solid #000; padding: 4px; font-weight: bold;">SALARIO<br>TOTAL</th>
                    <th style="border: 1px solid #000; padding: 4px;">IGSS</th>
                    <th style="border: 1px solid #000; padding: 4px;">ISR</th>
                    <th style="border: 1px solid #000; padding: 4px;">JUDICIAL</th>
                    <th style="border: 1px solid #000; padding: 4px;">DESCUENTO</th>
                    <th style="border: 1px solid #000; padding: 4px;">ANTICIPO<br>QUINCENA</th>
                    <th style="border: 1px solid #000; padding: 4px; font-weight: bold;">TOTAL<br>DEDUCC.</th>
                    <th style="border: 1px solid #000; padding: 4px;">HORAS<br>EXTRAS</th>
                    <th style="border: 1px solid #000; padding: 4px;">MONTO<br>H. EXTRAS</th>
                    <th style="border: 1px solid #000; padding: 4px;">OTROS<br>INGRESOS</th>
                    <th style="border: 1px solid #000; padding: 4px;">ASUETO</th>
                    <th style="border: 1px solid #000; padding: 4px; font-weight: bold;">TOTAL<br>ADIC.</th>
                </tr>
            </thead>
            <tbody></tbody>
            <tfoot style="font-weight: bold; background: #fff;"></tfoot>
        `;

        const tbody = table.querySelector('tbody');
        const tfoot = table.querySelector('tfoot');

        // Accumulators
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

        // Extra Accumulators
        let sumExtraAmount = 0;
        let sumOtherBonus = 0;
        let sumHolidayBonus = 0;
        let sumTotalAdic = 0;
        let sumFinalTotal = 0;

        groupRows.forEach(row => {
            const index = row.originalIndex; // Vital for inputs

            // Calculate dynamic totals based on potentially edited values (live from currentPayrollData)
            // We use 'row' but 'row' is from 'groupRows' which is a shallow copy of currentPayrollData?
            // No, in the map we did { ...row }. This splits references for top level!
            // ISSUE: editing inputs updates currentPayrollData[index], but NOT groupRows[i].
            // FIX: We must read from currentPayrollData[index] to get latest values.
            const liveRow = currentPayrollData[index];

            const totalDeductions = liveRow.igss + liveRow.isr + liveRow.judicial + liveRow.discount + liveRow.advance;
            const liquid = liveRow.totalSalary - totalDeductions;

            const totalAdic = liveRow.extraAmount + liveRow.otherBonus + liveRow.holidayBonus;
            const finalPay = liquid + totalAdic;
            liveRow.finalTotal = finalPay;

            // Accumulate
            // Accumulate (Rounding to 2 decimals to ensure visual sum matches actual sum)
            sumSalary += Number(liveRow.salary.toFixed(2));
            sumBonus += Number(liveRow.bonus.toFixed(2));
            sumTotalSalary += Number(liveRow.totalSalary.toFixed(2));
            sumIgss += Number(liveRow.igss.toFixed(2));
            sumIsr += Number(liveRow.isr.toFixed(2));
            sumJudicial += Number(liveRow.judicial.toFixed(2));
            sumDiscount += Number(liveRow.discount.toFixed(2));
            sumAdvance += Number(liveRow.advance.toFixed(2));
            sumTotalDeductions += Number(totalDeductions.toFixed(2));
            sumLiquid += Number(liquid.toFixed(2));

            sumExtraAmount += Number(liveRow.extraAmount.toFixed(2));
            sumOtherBonus += Number(liveRow.otherBonus.toFixed(2));
            sumHolidayBonus += Number(liveRow.holidayBonus.toFixed(2));
            sumTotalAdic += Number(totalAdic.toFixed(2));
            sumFinalTotal += Number(finalPay.toFixed(2));

            const tr = document.createElement('tr');
            tr.style.background = '#fff';
            // Increase padding for signature space (even more)
            const cellStyle = 'padding: 20px 6px; border: 1px solid #000; text-align: center;';
            const numStyle = 'padding: 20px 6px; border: 1px solid #000; text-align: center;';

            tr.innerHTML = `
                <td style="${cellStyle} text-align: left; width: 220px;">${liveRow.name}</td>
                <td style="${cellStyle} padding: 2px;">
                     <input type="number" min="0" max="31" value="${liveRow.days}" 
                        onchange="updatePlanillaDays(${index}, this.value)"
                        style="width: 40px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.salary.toFixed(2)}"
                        onchange="updatePlanillaRowSalary(${index}, this.value)"
                        title="Salario Devengado (Calculado o Manual)"
                        style="width: 70px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.bonus.toFixed(2)}"
                        onchange="updatePlanillaRowBonus(${index}, this.value)"
                        title="Bonificación (Calculado o Manual)"
                        style="width: 70px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${numStyle}">Q${liveRow.totalSalary.toFixed(2)}</td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.igss.toFixed(2)}" 
                        onchange="updatePlanillaRow(${index}, 'igss', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${numStyle}">Q${liveRow.isr.toFixed(2)}</td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.judicial.toFixed(2)}" 
                        onchange="updatePlanillaRow(${index}, 'judicial', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.discount.toFixed(2)}" 
                        onchange="updatePlanillaRow(${index}, 'discount', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.advance.toFixed(2)}" 
                        onchange="updatePlanillaRow(${index}, 'advance', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit;">
                </td>
                <td style="${numStyle}">Q${totalDeductions.toFixed(2)}</td>
                <td style="${numStyle}">Q${liquid.toFixed(2)}</td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.5" value="${liveRow.extraHours}" 
                        onchange="updatePlanillaExtra(${index}, 'hours', this.value)"
                        style="width: 40px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
                </td>
                <td style="${cellStyle} padding: 2px; background: #f0fdf4;">
                    <input type="number" step="0.01" value="${liveRow.extraAmount.toFixed(2)}"
                        onchange="updatePlanillaExtra(${index}, 'amount', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.otherBonus.toFixed(2)}" 
                        onchange="updatePlanillaExtra(${index}, 'other', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
                    <input type="text" placeholder="Desc." value="${liveRow.otherBonusDesc || ''}"
                        onchange="updatePlanillaExtra(${index}, 'otherDesc', this.value)"
                        style="width: 60px; padding: 2px; border: none; border-top: 1px dotted #ccc; text-align: center; font-family: inherit; font-size: 0.8em; background: #f0fdf4; display: block; margin-top:2px;">
                </td>
                <td style="${cellStyle} padding: 2px;">
                    <input type="number" step="0.01" value="${liveRow.holidayBonus.toFixed(2)}" 
                        onchange="updatePlanillaExtra(${index}, 'holiday', this.value)"
                        style="width: 60px; padding: 2px; border: none; text-align: center; font-family: inherit; font-size: inherit; background: #f0fdf4;">
                </td>
                <td style="${numStyle} font-weight: bold; background: #f0fdf4;">Q${totalAdic.toFixed(2)}</td>
                <td style="${numStyle} font-weight: bold; background: #dcfce7;">Q${finalPay.toFixed(2)}</td>
                <td style="${cellStyle} border-bottom: 2px solid #000;">____________</td>
            `;
            tbody.appendChild(tr);
        });

        // Footer Totals for this group
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
                <td style="padding: 6px; border: 1px solid #000;">-</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumExtraAmount.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumOtherBonus.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumHolidayBonus.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000;">Q${sumTotalAdic.toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #000; background: #eee;">Q${sumFinalTotal.toFixed(2)}</td>
                <td style="border: 1px solid #000; font-size: 8px; vertical-align: bottom;">v4</td>
            </tr>
        `;

        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);
    });

    // 3. Overall Totals at bottom? Or just separate sheets? User asked for "Hoja aparte" for Flash.
    // So splitting is the goal. We don't need a Grand Total table effectively.
}
// Helper to update global state and re-render
function updatePlanillaDays(index, value) {
    const days = parseFloat(value) || 0;
    const row = currentPayrollData[index];
    row.days = days;

    if (days >= 15) {
        row.salary = row.monthlyBase / 2;
        row.bonus = 125.00;
    } else {
        const dailyRate365 = (row.monthlyBase * 12) / 365;
        const dailyBonus365 = (250 * 12) / 365;
        row.salary = dailyRate365 * days;
        row.bonus = dailyBonus365 * days;
    }

    // Recalculate derived
    row.totalSalary = row.salary + row.bonus;
    const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
    row.igss = row.salary * igssPct;

    // --- PROBATION OVERRIDE ---
    if (row.subEmpresa === 'EN PRUEBA') {
        row.igss = 0;
        row.bonus = 0;
        row.totalSalary = row.salary;
    }
    // -------------------------

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
        // Calc Amount
        let hourlyRate = 0;

        if (row.overtimeRate && row.overtimeRate > 0) {
            // Fixed Rate from Config (Pedidos)
            hourlyRate = row.overtimeRate;
        } else if (row.globalOvertimeRate && row.globalOvertimeRate > 0) {
            // Global Fixed Rate
            hourlyRate = row.globalOvertimeRate;
        } else {
            // Standard Calc
            const dailyRate = (row.monthlyBase * 12) / 365;
            hourlyRate = dailyRate / 8;
        }

        row.extraAmount = hourlyRate * val;

    } else if (type === 'amount') {
        // Direct Amount Edit
        row.extraAmount = val;
        // Optionally clear hours or keep them as reference?
        // Let's keep hours as is, but this allows manual "rounding" fix.

    } else if (type === 'other') {
        row.otherBonus = val;
    } else if (type === 'otherDesc') {
        row.otherBonusDesc = value;
    } else if (type === 'holiday') {
        row.holidayBonus = val;
    }
    renderPlanillaRows();
}

function exportPlanillaPDF() {
    // Inject Print Styles to ensure Page Breaks work
    let style = document.getElementById('planillaPrintStyles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'planillaPrintStyles';
        style.innerHTML = `
            @media print {
                @page { margin: 10mm; size: landscape; }
                body, html { 
                    overflow: visible !important; 
                    height: auto !important; 
                    background: white !important;
                }
                /* Hide everything by default */
                body > * { display: none !important; }
                
                /* Show only our print container */
                #planillaMainView { 
                    display: block !important; 
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    overflow: visible !important; 
                    height: auto !important; 
                }
                
                /* Ensure children are visible */
                #planillaMainView * { visibility: visible !important; }

                /* Specific Overrides */
                .card { 
                    border: none !important; 
                    box-shadow: none !important; 
                    margin: 0 !important; 
                    padding: 0 !important;
                    overflow: visible !important;
                }
                #planillaTablesContainer { 
                    display: block !important; 
                    overflow: visible !important;
                }

                .screen-only-separator { display: none !important; }
                
                .planilla-sheet { 
                    page-break-inside: avoid; 
                    margin-bottom: 0px !important; 
                    display: block !important;
                    width: 100% !important;
                }
                /* Explicit break */
                .planilla-sheet + .planilla-sheet { 
                    page-break-before: always !important; 
                    margin-top: 20px !important; 
                }

                /* Hide Controls */
                #planillaControls, .header-controls { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }
    window.print();
}


// --- SAVE & HISTORY LOGIC ---

async function savePlanilla() {
    if (currentPayrollData.length === 0) {
        alert("No hay datos para guardar.");
        return;
    }

    // Open Modal instead of prompting
    const modal = document.getElementById('savePlanillaModal');
    if (modal) {
        // Pre-fill name if known?
        document.getElementById('planillaCustomName').value = ""; // Clear or set default
        modal.style.display = 'flex';
    } else {
        // Fallback if modal missing (shouldn't happen)
        confirmSavePlanilla();
    }
}

function closeSaveModal() {
    document.getElementById('savePlanillaModal').style.display = 'none';
}

async function confirmSavePlanilla() {
    closeSaveModal(); // Close immediately

    const m = document.getElementById('planillaMonth').value;
    const p = document.getElementById('planillaPeriod').value;
    const y = document.getElementById('planillaYear').value;
    const s = document.getElementById('planillaSucursal').value;
    const sName = document.getElementById('planillaSucursal').options[document.getElementById('planillaSucursal').selectedIndex].text;

    let payrollId = currentLoadedId;

    // Generate new ID if not loaded
    if (!payrollId) {
        if (p === 'custom') {
            // Unique ID for custom to avoid collision
            payrollId = `PAY-${y}-${m}-CUSTOM-${Date.now()}`;
        } else {
            payrollId = `PAY-${y}-${m}-${p}-${s}`;
        }
    }

    const customName = document.getElementById('planillaCustomName').value.trim();

    const payload = {
        month: parseInt(m),
        year: parseInt(y),
        period: p === 'custom' ? 'custom' : parseInt(p), // Store as string 'custom' or int
        sucursalId: s,
        sucursalName: sName,
        customName: customName,
        createdAt: new Date().toISOString(),
        rows: currentPayrollData,
        // Save Custom Dates
        customStartDate: p === 'custom' ? document.getElementById('planillaStart').value : null,
        customEndDate: p === 'custom' ? document.getElementById('planillaEnd').value : null
    };

    try {
        await db.collection('payrolls').doc(payrollId).set(payload);

        // NEW: Process Loan Deductions
        // Pass a safe identifier for periodStr
        let periodIdentifier = `${p}/${m}/${y}`;
        if (p === 'custom') periodIdentifier = `CUSTOM-${new Date().toLocaleDateString()}`;

        await processLoanPayments(currentPayrollData, payrollId, periodIdentifier);

        alert("Planilla guardada exitosamente.");
        currentLoadedId = payrollId;
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

            let periodText = `${data.period === 1 ? '1ra' : '2da'} Quincena - ${getMonthName(data.month)} ${data.year}`;
            if (data.customName) {
                periodText += `<br><span style="font-weight:bold; color: #2563eb;">${data.customName}</span>`;
            }

            // Calc Total Liquid for summary
            let totalLiquid = 0;
            if (data.rows) {
                totalLiquid = data.rows.reduce((acc, row) => acc + (row.salary + row.bonus - (row.igss + row.isr + row.judicial + row.discount + row.advance)), 0);
            }

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${date}</td>
                    <td style="padding: 10px;">${periodText}</td>
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

        const pSelect = document.getElementById('planillaPeriod');
        pSelect.value = data.period;

        // Restore Custom Dates if applicable
        if (data.period === 'custom') {
            document.getElementById('planillaStart').value = data.customStartDate || '';
            document.getElementById('planillaEnd').value = data.customEndDate || '';
        }

        // Trigger UI toggle
        togglePeriodInputs();

        document.getElementById('planillaSucursal').value = data.sucursalId;

        // Switch View Back
        document.getElementById('planillaMainView').style.display = 'block';
        document.getElementById('planillaHistoryView').style.display = 'none';
        document.getElementById('planillaControls').style.display = 'flex';

        renderPlanillaRows();
        await updateHeaderInfo();

    } catch (e) {
        console.error("Error loading saved planilla:", e);
        alert("Error al cargar planilla.");
    }
}

async function updateHeaderInfo() {
    const sEl = document.getElementById('planillaSucursal');
    const titleH3 = document.getElementById('headerCompanyTitle');
    const logoImg = document.getElementById('headerCompanyLogo');

    if (!titleH3 || !logoImg) return;

    // Reset defaults
    titleH3.innerText = "CORPORACION DE ALIMENTOS, S.A.";
    logoImg.src = "../Recibos/logo.png";

    const selectedSucursal = sEl ? sEl.value : 'all';

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
}

async function deleteSavedPlanilla(id) {
    currentDeleteId = id;
    const modal = document.getElementById('deletePlanillaModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback
        if (confirm("¿Eliminar planilla?")) {
            currentDeleteId = id;
            confirmDeletePlanilla();
        }
    }
}

function closeDeleteModal() {
    document.getElementById('deletePlanillaModal').style.display = 'none';
    currentDeleteId = null;
}

async function confirmDeletePlanilla() {
    if (!currentDeleteId) return;

    try {
        await db.collection('payrolls').doc(currentDeleteId).delete();
        closeDeleteModal();
        alert("Planilla eliminada correctamente.");
        await loadHistoryList(); // Refresh list to remove the item
    } catch (e) {
        console.error("Error deleting payroll:", e);
        alert("Error al eliminar: " + e.message);
        closeDeleteModal();
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
window.closeSaveModal = closeSaveModal;
window.savePlanilla = savePlanilla;
window.confirmSavePlanilla = confirmSavePlanilla;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeletePlanilla = confirmDeletePlanilla;
window.showPayrollTotals = showPayrollTotals;
window.closePayrollTotalsModal = closePayrollTotalsModal;

async function printPaymentSlips(type) {
    if (currentPayrollData.length === 0) {
        alert("No hay datos cargados para imprimir.");
        return;
    }

    // Prompt for Emission Date
    const today = new Date().toISOString().split('T')[0];
    const { value: selectedDate } = await Swal.fire({
        title: 'Fecha de Emisión',
        html: '<input type="date" id="print-emission-date" class="swal2-input" value="' + today + '">',
        focusConfirm: false,
        preConfirm: () => {
            return document.getElementById('print-emission-date').value;
        },
        showCancelButton: true,
        confirmButtonText: 'Imprimir',
        cancelButtonText: 'Cancelar'
    });

    if (!selectedDate) {
        return; // User cancelled
    }

    const [eyear, emonth, eday] = selectedDate.split('-');
    const emissionDate = `${eday}/${emonth}/${eyear}`;

    const m = document.getElementById('planillaMonth');
    const p = document.getElementById('planillaPeriod');
    const y = document.getElementById('planillaYear');
    const s = document.getElementById('planillaSucursal');

    // Determine Period String
    let periodStr = '';
    if (p && p.value === 'custom') {
        const sVal = document.getElementById('planillaStart').value;
        const eVal = document.getElementById('planillaEnd').value;
        const fmt = (d) => {
            if (!d) return '';
            const [yy, mm, dd] = d.split('-');
            return `${dd}/${mm}/${yy}`;
        };
        periodStr = `del: ${fmt(sVal)} al ${fmt(eVal)}`;
    } else {
        const mText = m ? m.options[m.selectedIndex].text : '';
        const yText = y ? y.value : '';
        const pVal = p ? p.value : '';
        const pText = pVal == '1' ? 'Del 01 al 15' : 'Del 16 al ' + new Date(y.value, parseInt(m.value) + 1, 0).getDate();
        periodStr = `${pText} de ${mText} ${yText}`;
    }

    // Determine Company Info
    let companyTitle = "CORPORACION DE ALIMENTOS, S.A.";
    const headerTitleEl = document.getElementById('headerCompanyTitleTemplate');
    if (headerTitleEl && headerTitleEl.innerText) companyTitle = headerTitleEl.innerText;

    let logoSrc = "../Recibos/logo.png";
    const headerLogoEl = document.getElementById('headerCompanyLogoTemplate');
    if (headerLogoEl && headerLogoEl.src) logoSrc = headerLogoEl.src;

    let branchName = "";
    if (s && s.selectedIndex >= 0) {
        if (s.value !== 'all') {
            branchName = s.options[s.selectedIndex].text;
        } else {
            branchName = "Todas las Sucursales";
        }
    }

    if (type === 'individual') {
        // Prepare a hidden container for rendering
        let renderContainer = document.getElementById('slip-render-container');
        if (!renderContainer) {
            renderContainer = document.createElement('div');
            renderContainer.id = 'slip-render-container';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';
            renderContainer.style.top = '-9999px';
            renderContainer.style.width = '800px'; 
            document.body.appendChild(renderContainer);
        }

        // Show a loading indicator
        Swal.fire({
            title: 'Generando boletas...',
            html: 'Procesando empleado <b id="swal-emp-name"></b> (<span id="swal-emp-count">0</span> de ' + currentPayrollData.length + ')',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const { jsPDF } = window.jspdf;

        for (let i = 0; i < currentPayrollData.length; i++) {
            const row = currentPayrollData[i];
            
            // Update UI
            document.getElementById('swal-emp-name').innerText = row.name;
            document.getElementById('swal-emp-count').innerText = (i + 1);

            // Generate HTML for this specific slip (Passing all parameters now)
            const slipHtml = generateSlipHtml(row, 'normal', companyTitle, branchName, periodStr, emissionDate);
            renderContainer.innerHTML = slipHtml;

            try {
                const canvas = await html2canvas(renderContainer, {
                    scale: 2, 
                    useCORS: true,
                    logging: false
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'letter');
                
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                
                const cleanName = row.name.replace(/[^a-z0-9]/gi, ' ').trim();
                const sClean = branchName.replace(/[^a-z0-9]/gi, ' ').trim();
                const fileName = `${cleanName}_${sClean}_${periodStr.replace(/<[^>]*>?/gm, '').replace(/[^a-z0-9]/gi, '_')}.pdf`;
                
                pdf.save(fileName);

                if (i < currentPayrollData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

            } catch (err) {
                console.error("Error generating PDF for " + row.name, err);
            }
        }

        Swal.close();
        Swal.fire('Completado', 'Se han generado todas las boletas.', 'success');
        return;
    }

    // Use already declared variables
    // Removed redeclarations

    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>&nbsp;</title>`);
    w.document.write('<style>');
    w.document.write('body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }');
    w.document.write('@page { margin: 0; }');

    if (type === 'normal') {
        // Table Styles for Normal View
        w.document.write('<style>');
        // Top level page rule - highest priority for layout engines
        w.document.write('@page { size: landscape; margin: 5mm; }');
        // Media specific adjustments
        w.document.write('@media print { body { -webkit-print-color-adjust: exact; width: 100%; } }');

        // Ensure body is wide enough to force landscape mode if automatic
        w.document.write('body { font-family: "Arial", sans-serif; font-size: 10px; margin: 0; padding: 0; width: 100%; min-width: 1050px; }');
        w.document.write('* { box-sizing: border-box; }');
        // Force table to be wide but auto height
        w.document.write('table { width: 100%; min-width: 1000px; border-collapse: collapse; border: 2px solid #000; page-break-inside: auto; }');
        w.document.write('tr { page-break-inside: avoid; page-break-after: auto; }');

        // Header Cells
        w.document.write('thead th { border: 1px solid #000; padding: 3px; text-align: center; font-weight: bold; font-size: 9px; vertical-align: middle; background-color: #fff; height: 30px; }');

        // Body Cells - Fixed Height for Signatures
        w.document.write('tbody tr { height: 45px; }');
        w.document.write('tbody td { border: none; border-bottom: 1px dotted #ccc; padding: 5px 2px; font-size: 10px; vertical-align: middle; }');
        w.document.write('tbody tr:last-child td { border-bottom: 2px solid #000; }');


        // Specific Column Styles
        w.document.write('.col-name { text-align: left; padding-left: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }');
        w.document.write('.col-center { text-align: center; }');
        w.document.write('.col-amount { text-align: right; padding-right: 4px; }');

        w.document.write('.header-container { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; position: relative; height: 50px; }');
        w.document.write('.logo { height: 45px; position: absolute; left: 0; top: 50%; transform: translateY(-50%); }');
        w.document.write('.header-text { text-align: center; }');
        // Header Fonts reduced
        w.document.write('.header-text h1 { margin: 0; font-size: 13px; font-weight: bold; text-transform: uppercase; }');
        w.document.write('.header-text h2 { margin: 2px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; }');
        w.document.write('.header-text h3 { margin: 0; font-size: 11px; font-weight: bold; }');

        w.document.write('.page-break { break-before: page; break-after: page; page-break-before: always; page-break-after: always; display: block; height: 0; line-height: 0; margin: 0; padding: 0; overflow: hidden; clear: both; }');

        w.document.write('</style></head><body>');
        // Add a wrapper to ensure width and force scrolling/landscape
        w.document.write('<div style="width: 100%; min-width: 1000px;">');

        // Prepare Date String in DD/MM/YYYY format
        // Re-parsing logic to ensure correct format
        let dateRangeStr = "";

        // Check if Custom
        if (p && p.value === 'custom') {
            const sVal = document.getElementById('planillaStart').value; // yyyy-mm-dd
            const eVal = document.getElementById('planillaEnd').value;
            const fmt = (d) => { if (!d) return ""; const [y, m, d_] = d.split('-'); return `${d_}/${m}/${y}`; };
            dateRangeStr = `DEL ${fmt(sVal)} AL ${fmt(eVal)}`;
        } else {
            // Standard
            const mVal = parseInt(m.value);
            const yVal = parseInt(y.value);
            const pVal = p.value; // '1' or '2'
            // Calculate Dates
            let d1, d2;
            if (pVal == '1') {
                d1 = new Date(yVal, mVal, 1);
                d2 = new Date(yVal, mVal, 15);
            } else {
                d1 = new Date(yVal, mVal, 16);
                d2 = new Date(yVal, mVal + 1, 0); // Last day
            }
            const fmt = (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            dateRangeStr = `DEL ${fmt(d1)} AL ${fmt(d2)}`;
        }

        // Group Data
        const groups = {};
        const defaultKey = 'Propia';
        currentPayrollData.forEach(row => {
            const key = row.subEmpresa || defaultKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });

        const keys = Object.keys(groups).sort((a, b) => {
            if (a === defaultKey) return -1;
            if (b === defaultKey) return 1;
            return a.localeCompare(b);
        });

        keys.forEach((groupKey, groupIdx) => {
            const groupRows = groups[groupKey];

            // Header Info
            // Header Info
            let displayBranch = branchName;

            // Only try to deduce branch from row if we are in 'All Branches' mode
            if (displayBranch === 'Todas las Sucursales' || displayBranch === 'TODAS') {
                displayBranch = 'TODAS'; // Default fallback
                if (groupKey === 'Pedidos Flash') {
                    displayBranch = 'PEDIDOS FLASH';
                } else if (groupRows[0].branchName) {
                    // CAUTION: This might be the Company Name depending on data
                    displayBranch = groupRows[0].branchName;
                }
            }

            // Logo
            // Use the logo from the first row of the group if available, or the generic one
            let currentLogo = logoSrc;
            if (groupKey.toUpperCase() === 'PEDIDOS FLASH') {
                currentLogo = "../resources/images/PEDIDOS FLASH.png";
            } else if (groupRows[0].branchLogo) {
                currentLogo = groupRows[0].branchLogo;
            }

            // Header HTML
            // Determine printing title:
            // If group is 'Propia', use the Company Name from data (same as web view)
            let printTitle = "AMERICAN PIZZA"; // Global Default

            if (groupKey === 'Propia') {
                if (groupRows[0].branchName) {
                    printTitle = groupRows[0].branchName;
                }
            } else if (groupKey === 'EN PRUEBA') {
                printTitle = "PERSONAL EN PERIODO DE PRUEBA";
            } else {
                printTitle = groupKey; // e.g. 'Pedidos Flash'
            }

            if (groupIdx > 0) {
                w.document.write('<div class="page-break"></div>');
            }

            w.document.write(`
                <div class="header-container" style="${groupIdx > 0 ? 'margin-top: 20px;' : ''}">
                    <img src="${currentLogo}" class="logo">
                    <div class="header-text">
                        <h1>${printTitle.toUpperCase()}</h1>
                        <h2>NÓMINA DE SUELDOS ${displayBranch.toUpperCase()}</h2>
                        <h3>${dateRangeStr}</h3>
                    </div>
                </div>
            `);

            // Table Structure
            w.document.write('<table>');
            w.document.write(`
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 180px; border-bottom: 2px solid #000;">NOMBRE EMPLEADO</th>
                        <th colspan="4" style="border-bottom: 2px solid #000;">SALARIO DEVENGADO</th>
                        <th colspan="6" style="border-bottom: 2px solid #000;">DEDUCCIONES LEGALES</th>
                        <th rowspan="2" style="width: 70px; border-bottom: 2px solid #000;">SALARIO<br>LÍQUIDO</th>
                        <th rowspan="2" style="width: 120px; border-bottom: 2px solid #000;">FIRMA</th>
                    </tr>
                    <tr>
                        <!-- Salario Devengado Cols -->
                        <th style="width: 30px;">DÍAS<br>TRAB.</th>
                        <th>SALARIO</th>
                        <th>BONIF.<br>DECRETO</th>
                        <th>SALARIO<br>TOTAL</th>
                        
                        <!-- Deducciones Cols -->
                        <th style="width: 45px;">IGSS</th>
                        <th style="width: 45px;">ISR</th>
                        <th style="width: 45px;">JUDICIAL</th>
                        <th style="width: 50px;">DESCUENTO</th>
                        <th>ANTICIPO<br>QUINCENA</th>
                        <th>TOTAL<br>DEDUCCIONES</th>
                    </tr>
                </thead>
                <tbody>
            `);

            let tSalary = 0, tBonus = 0, tTotalSal = 0;
            let tIgss = 0, tIsr = 0, tJud = 0, tDisc = 0, tAdv = 0, tTotalDed = 0;
            let tLiquid = 0;

            groupRows.forEach(row => {
                const totalSal = row.salary + row.bonus;
                const totalDed = row.igss + row.isr + row.judicial + row.discount + row.advance;
                const liq = totalSal - totalDed;

                tSalary += Number(row.salary.toFixed(2));
                tBonus += Number(row.bonus.toFixed(2));
                tTotalSal += Number(totalSal.toFixed(2));

                tIgss += Number(row.igss.toFixed(2));
                tIsr += Number(row.isr.toFixed(2));
                tJud += Number(row.judicial.toFixed(2));
                tDisc += Number(row.discount.toFixed(2));
                tAdv += Number(row.advance.toFixed(2));
                tTotalDed += Number(totalDed.toFixed(2));

                tLiquid += Number(liq.toFixed(2));

                w.document.write(`
                    <tr>
                        <td class="col-name">${row.name}</td>
                        <td class="col-center">${row.days}</td>
                        <td class="col-amount">Q${row.salary.toFixed(2)}</td>
                        <td class="col-amount">Q${row.bonus.toFixed(2)}</td>
                        <td class="col-amount">Q${totalSal.toFixed(2)}</td>
                        
                        <td class="col-amount">Q${row.igss.toFixed(2)}</td>
                        <td class="col-amount">Q${row.isr.toFixed(2)}</td>
                        <td class="col-amount">Q${row.judicial.toFixed(2)}</td>
                        <td class="col-amount">Q${row.discount.toFixed(2)}</td>
                        <td class="col-amount">Q${row.advance.toFixed(2)}</td>
                        <td class="col-amount">Q${totalDed.toFixed(2)}</td>
                        
                        <td class="col-amount">Q${liq.toFixed(2)}</td>
                        <td><div style="border-bottom: 2px solid #000; width: 100%; margin-top: 15px;"></div></td>
                    </tr>
                `);
            });

            w.document.write(`
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background-color: #f9f9f9;">
                        <!-- Adjusted colspan to align "TOTAL" with the liquid salary column -->
                        <!-- Columns: Name (1), Days(1), Sal(1), Bon(1), TotalSal(1), IGSS(1), ISR(1), Jud(1), Desc(1), Ant(1), TotalDed(1) -->
                        <td colspan="11" style="text-align: right; padding-right: 15px; font-size: 11px;">TOTAL A PAGAR:</td>
                        <td class="col-amount" style="font-size: 11px; border-top: 2px solid #000;">Q${tLiquid.toFixed(2)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            `);

            // Removed the old page-break div from here as it's now handled before the header
        });

        w.document.write('</div>'); // Close Wrapper

    } else {
        // EXTRA SLIPS (Individual)
        // EXTRA SLIPS (Individual)
        w.document.write('@page { size: portrait; margin: 0; }');
        w.document.write('body { padding: 10mm; }');
        w.document.write('.slip-outer { height: 45%; box-sizing: border-box; margin-bottom: 5%; display: block; page-break-inside: avoid; }'); // Wrapper for size control
        w.document.write('.slip-container { border-bottom: 2px dashed #000; padding-bottom: 10px; height: 100%; box-sizing: border-box; }');
        w.document.write('.header { display: flex; justify-content: space-between; margin-bottom: 5px; }');
        w.document.write('.header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }');
        w.document.write('table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 2px solid #000; font-size: 11px; }');
        w.document.write('th { border: 1px solid #000; padding: 2px; text-align: center; background: #eee; font-weight: bold; }');
        w.document.write('td { border: 1px solid #000; padding: 2px; vertical-align: top; }');
        w.document.write('.amount { text-align: right; }');
        w.document.write('.total-box { border: 2px solid #000; padding: 5px 20px; font-weight: bold; font-size: 14px; display: inline-block; margin-top: 5px; }');
        w.document.write('.footer { margin-top: 60px; display: flex; justify-content: space-between; }');
        w.document.write('.signature { border-top: 2px solid #000; width: 40%; text-align: center; padding-top: 10px; }');
        w.document.write('.page-break { page-break-after: always; height: 0; }'); // Explicit break
        w.document.write('</style></head><body>');

        // Filter rows with extra
        const extraRows = currentPayrollData.filter(row => (row.extraAmount + row.otherBonus + row.holidayBonus) > 0);

        extraRows.forEach((row, index) => {
            // Pass logo logic too if you want logo on slips
            w.document.write('<div class="slip-outer">');
            w.document.write(generateSlipHtml(row, 'extra', companyTitle, branchName, periodStr, emissionDate));
            w.document.write('</div>');

            // Add break after every 2nd item, OR if it's the last item (to avoid blank page? No, only break if NOT last)
            // Actually, if we just want pairs, break after evens.
            // Index is 0-based. 0, 1 (break), 2, 3 (break)
            if ((index + 1) % 2 === 0 && (index + 1) < extraRows.length) {
                w.document.write('<div class="page-break"></div>');
            }
        });
    }

    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 1000);
}

function generateSlipHtml(row, type, companyName, branchName, period, emission) {
    let incomeHtml = '';
    let deductHtml = '';
    let totalIncome = 0;
    let totalDeduct = 0;
    let liquid = 0;

    // Check for Pedidos Flash override or Branch Name
    let displayCompanyName = companyName;

    // Use Row's Branch Name if available (More accurate than global title)
    // "Boletas Adicionales" issue: user wants Branch Name (e.g. American Pizza), not "Corporacion Alimentos".
    if (row.branchName) {
        displayCompanyName = row.branchName.toUpperCase();
    }

    if (row.subEmpresa === 'Pedidos Flash') {
        displayCompanyName = "PEDIDOS FLASH";
    } else if (row.subEmpresa === 'EN PRUEBA') {
        // Optional: append status? User didn't ask, but safe to just show Branch Name
        // displayCompanyName += " (EN PRUEBA)";
    }

    const showSubtitle = branchName && displayCompanyName && branchName.toUpperCase() !== displayCompanyName.toUpperCase() && branchName !== 'Todas las Sucursales';

    // NOTE: 'normal' is now handled by Table view above, but we keep this just in case logic is reused or reverted.
    // Logic below handles 'extra' individual slip.

    if (type === 'normal') {
        // NORMAL SLIP
        totalIncome = row.salary + row.bonus;
        incomeHtml += `<tr><td>Salario Base</td><td class="amount">Q${row.salary.toFixed(2)}</td></tr>`;
        incomeHtml += `<tr><td>Bonificación Decreto</td><td class="amount">Q${row.bonus.toFixed(2)}</td></tr>`;

        if (row.igss > 0) {
            deductHtml += `<tr><td>IGSS</td><td class="amount">Q${row.igss.toFixed(2)}</td></tr>`;
            totalDeduct += row.igss;
        }
        if (row.isr > 0) {
            deductHtml += `<tr><td>ISR</td><td class="amount">Q${row.isr.toFixed(2)}</td></tr>`;
            totalDeduct += row.isr;
        }
        if (row.judicial > 0) {
            deductHtml += `<tr><td>Judicial</td><td class="amount">Q${row.judicial.toFixed(2)}</td></tr>`;
            totalDeduct += row.judicial;
        }
        if (row.discount > 0) {
            deductHtml += `<tr><td>Anticipos / Adelantos</td><td class="amount">Q${row.discount.toFixed(2)}</td></tr>`;
            totalDeduct += row.discount;
        }
        if (row.advance > 0) {
            deductHtml += `<tr><td>Anticipos</td><td class="amount">Q${row.advance.toFixed(2)}</td></tr>`;
            totalDeduct += row.advance;
        }

        if (totalDeduct === 0) {
            deductHtml = '<tr><td colspan="2" style="text-align:center;">-</td></tr>';
        }
        liquid = totalIncome - totalDeduct;

    } else if (type === 'extra') {
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
            const desc = row.otherBonusDesc ? ` (${row.otherBonusDesc})` : '';
            incomeHtml += `<tr><td>Otros Ingresos${desc}</td><td class="amount">Q${row.otherBonus.toFixed(2)}</td></tr>`;
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
                    <h2>${displayCompanyName}</h2>
                    ${showSubtitle ? `<div>${branchName.toUpperCase()}</div>` : ''}
                    <div>BOLETA DE PAGO</div>
                    <div>${(period || "").toLowerCase().startsWith('del:') ? 'Periodo ' + period : 'Periodo: ' + (period || "")}</div>
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
    console.log("Procesando pagos de adelantos...");
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
        console.log("Pagos de adelantos actualizados.");
    }
}

function showPayrollTotals() {
    if (currentPayrollData.length === 0) {
        alert("Genera primero la planilla.");
        return;
    }

    let totalLiquid = 0;
    let totalExtras = 0;
    let extrasList = [];

    // Helper to parser currency
    const parseQ = (str) => parseFloat(str.replace('Q', '')) || 0;

    // Calculate Total Planilla directly from data (safest and supports multiple tables)
    let totalPlanilla = 0;

    currentPayrollData.forEach(row => {
        // Ensure we sum the rounded value as displayed
        totalPlanilla += Number((row.finalTotal || 0).toFixed(2));

        const extrasSum = (row.extraAmount || 0) + (row.otherBonus || 0) + (row.holidayBonus || 0);
        totalExtras += extrasSum;

        if (extrasSum > 0) {
            let desc = [];
            if (row.extraAmount > 0) desc.push(`${row.extraHours} Horas Extras`);
            if (row.otherBonus > 0) desc.push(`Otros${row.otherBonusDesc ? ' (' + row.otherBonusDesc + ')' : ''}`);
            if (row.holidayBonus > 0) desc.push("Asueto");

            extrasList.push({
                name: row.name,
                desc: desc.join(", "),
                amount: extrasSum
            });
        }
    });

    document.getElementById('payrollTotalsModal').style.display = 'flex';
    document.getElementById('pt_totalPlanilla').innerText = `Q${totalPlanilla.toFixed(2)}`;
    document.getElementById('pt_totalEmployees').innerText = currentPayrollData.length;
    document.getElementById('pt_totalExtras').innerText = `Q${totalExtras.toFixed(2)}`;

    const tbody = document.getElementById('pt_extrasBody');
    tbody.innerHTML = '';

    if (extrasList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding:10px; text-align:center;">No hay extras registradas.</td></tr>';
    } else {
        extrasList.forEach(item => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${item.name}</td>
                    <td style="padding: 10px;">${item.desc}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">Q${item.amount.toFixed(2)}</td>
                </tr>
            `;
        });
    }
}


function closePayrollTotalsModal() {
    document.getElementById('payrollTotalsModal').style.display = 'none';
}

// Helper to fetch active loans grouped by employee
async function fetchActiveLoansForPayroll() {
    try {

        const loanSnap = await db.collection('loans').where('status', '==', 'active').get();
        const loansByEmp = {};
        loanSnap.forEach(doc => {
            const data = doc.data();
            if (!loansByEmp[data.employeeId]) loansByEmp[data.employeeId] = [];
            loansByEmp[data.employeeId].push({ id: doc.id, ...data });
        });
        return loansByEmp;
    } catch (e) {
        console.error("Error fetching loans:", e);
        return {}; // Return empty object on error to prevent crash
    }
}

function exportPayrollTotalsImage() {
    const element = document.getElementById('payrollTotalsContent');
    if (!element) return;

    // Create a clone to capture full content without scrollbars/clipping
    const clone = element.cloneNode(true);

    // Style the clone to ensure full visibility and layout
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.width = '600px'; // Enforce original width
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '-9999px'; // Render off-screen
    clone.style.zIndex = '-1000';
    clone.style.borderRadius = '0'; // Optional: cleaner edges?

    document.body.appendChild(clone);

    html2canvas(clone, {
        backgroundColor: '#ffffff',
        scale: 2,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Resumen_Planilla_${new Date().toLocaleDateString().split('/').join('-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        document.body.removeChild(clone);
    }).catch(err => {
        console.error("Error creating image:", err);
        alert("No se pudo generar la imagen.");
        if (document.body.contains(clone)) document.body.removeChild(clone);
    });
}


function updatePlanillaRowSalary(index, newVal) {
    const row = currentPayrollData[index];
    if (!row) return;

    // Use float, default 0 if invalid
    const salary = parseFloat(newVal);
    if (isNaN(salary)) return; // Don't update if NaN

    row.salary = salary;

    // Recalculate Total Salary
    row.totalSalary = row.salary + row.bonus;

    // Recalculate IGSS (Check overrides?)
    // Default 4.83%
    let igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
    row.igss = row.salary * igssPct;

    // --- PROBATION OVERRIDE ---
    if (row.subEmpresa === 'EN PRUEBA') {
        row.igss = 0;
    }
    // -------------------------

    // Recalculate Liquid
    const totalDeductions = row.igss + row.isr + row.judicial + row.discount + row.advance;
    const liquid = row.totalSalary - totalDeductions;

    // Recalculate Final
    const totalAdic = row.extraAmount + row.otherBonus + row.holidayBonus;
    row.finalTotal = liquid + totalAdic;

    // Re-render to update dependent columns (Total Salary, IGSS, Liquid, etc.)
    renderPlanillaRows();
}


// ==========================================
// EXCEL EXPORT - FORMATO PLANILLA
// ==========================================
function exportarFormatoPlanilla() {
    // 1. Get Context Info
    const sucursalSelect = document.getElementById('planillaSucursal');
    const branchName = sucursalSelect.options[sucursalSelect.selectedIndex].text;

    // Period
    const m = document.getElementById('planillaMonth');
    const y = document.getElementById('planillaYear');
    const p = document.getElementById('planillaPeriod');
    let periodText = "";
    if (p.value === 'custom') {
        const s = document.getElementById('planillaStart').value;
        const e = document.getElementById('planillaEnd').value;
        periodText = `Del ${s} al ${e}`;
    } else {
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mText = months[parseInt(m.value)];
        const pText = p.value == '1' ? '1ra Quincena' : '2da Quincena';
        periodText = `${pText} de ${mText} ${y.value}`;
    }

    // 2. Define Headers (Added Observaciones)
    const headers = ["No.", "Nombre completo", "Días laborados", "Horas adicionales", "Adelanto (Q)", "Descuentos (Q)", "Ingreso (fecha)", "Renuncia (fecha)", "Asueto", "Observaciones"];

    // 3. Prepare Data
    // We construct the cells manually to apply styles
    const wb = XLSX.utils.book_new();
    const ws = {};

    // Helper for CellRef
    const encode = XLSX.utils.encode_cell;

    // Styles
    const styleBorder = {
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        },
        font: { name: "Arial", sz: 10 }
    };

    const styleHeader = {
        border: styleBorder.border,
        font: { name: "Arial", sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
    };

    const styleInstruction = {
        fill: { fgColor: { rgb: "FFFF00" } },
        font: { name: "Arial", sz: 10 },
        alignment: { wrapText: true }
    };

    const styleInstructionBold = {
        fill: { fgColor: { rgb: "FFFF00" } },
        font: { name: "Arial", sz: 10, bold: true },
        alignment: { wrapText: true }
    };

    // --- ROW 1: Sucursal ---
    ws[encode({ r: 0, c: 0 })] = { v: "Sucursal:", t: "s" };
    ws[encode({ r: 0, c: 1 })] = { v: branchName, t: "s", s: { font: { bold: true } } };

    // --- ROW 2: Periodo ---
    ws[encode({ r: 1, c: 0 })] = { v: "Periodo:", t: "s" };
    ws[encode({ r: 1, c: 1 })] = { v: periodText, t: "s", s: { font: { bold: true } } };

    // --- ROW 4: Headers ---
    headers.forEach((h, i) => {
        ws[encode({ r: 3, c: i })] = { v: h, t: "s", s: styleHeader };
    });

    // --- DATA ROWS (Start Row 5 / Index 4) ---
    let currentRow = 4;
    const items = (currentPayrollData && currentPayrollData.length > 0) ? currentPayrollData : Array(10).fill({ name: "" });

    items.forEach((emp, i) => {
        const rowData = [
            i + 1,
            emp.name || "",
            15,
            "",
            "",
            "",
            "",
            "",
            "",
            "" // Observaciones placeholder
        ];

        rowData.forEach((val, colIndex) => {
            ws[encode({ r: currentRow, c: colIndex })] = { v: val, t: (typeof val === 'number' ? 'n' : 's'), s: styleBorder };
        });
        currentRow++;
    });

    // --- INSTRUCTIONS (Yellow Block) ---
    currentRow += 2; // Spacer

    const instructions = [
        ["*** INSTRUCCIONES Y REGLAS DE LLENADO ***", true],
        ["", false],
        ["1. DÍAS LABORADOS:", true],
        ["- Colocar el número exacto. (Quincena completa = 15).", false],
        ["- Si faltó o está suspendido: Colocar días reales (ej: 4, 12, 0).", false],
        ["", false],
        ["2. FECHAS (Ingreso / Renuncia):", true],
        ["- OBLIGATORIO: Formato dd/mm/aaaa (Ej: 28/12/2025).", false],
        ["- Solo llenar si hubo movimiento en esta quincena.", false],
        ["", false],
        ["3. ASUETO:", true],
        ["- Escribir 'SÍ' si trabajó el feriado. 'NO' si descansó. Y si no aplica dejar vacío", false],
        ["", false],
        ["4. DESCUENTOS:", true],
        ["- Anotar solo el monto en Q", false],
        ["", false],
        ["5. SUSPENSIONES:", true],
        ["- Si está suspendido, poner 0 días y una nota '(SUSPENDIDO)' junto al nombre.", false]
    ];

    // Merges Array
    if (!ws['!merges']) ws['!merges'] = [];

    instructions.forEach(line => {
        const text = line[0];
        const isBold = line[1];

        // Merge A to J (Columns 0 to 9) - UPDATED FOR EXTRA COLUMN
        ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });

        // Set value and style for the first cell (Main Cell)
        ws[encode({ r: currentRow, c: 0 })] = {
            v: text,
            t: "s",
            s: (isBold ? styleInstructionBold : styleInstruction)
        };

        // We must stick styling on the other cells in the range too for background color to show properly in some viewers
        for (let c = 1; c <= 9; c++) {
            ws[encode({ r: currentRow, c: c })] = { v: "", t: "s", s: (isBold ? styleInstructionBold : styleInstruction) };
        }

        currentRow++;
    });

    // Extents (Columns 0-9)
    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 9, r: currentRow } });

    // Column Widths
    ws['!cols'] = [
        { wch: 5 },  // No.
        { wch: 40 }, // Nombre
        { wch: 15 }, // Dias
        { wch: 18 }, // Horas
        { wch: 15 }, // Adelanto
        { wch: 15 }, // Desc
        { wch: 15 }, // Ingreso
        { wch: 15 }, // Renuncia
        { wch: 10 }, // Asueto
        { wch: 30 }  // Observaciones (NEW)
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Planilla");
    XLSX.writeFile(wb, `Formato_Planilla_${branchName.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.xlsx`);
}

function updatePlanillaRowBonus(index, newVal) {
    const row = currentPayrollData[index];
    if (!row) return;

    const bonus = parseFloat(newVal);
    if (isNaN(bonus)) return;

    row.bonus = bonus;

    // --- PROBATION OVERRIDE ---
    if (row.subEmpresa === 'EN PRUEBA') {
        row.bonus = 0;
    }
    // -------------------------

    // Recalculate Total Salary
    row.totalSalary = row.salary + row.bonus;

    // Recalculate Liquid
    const totalDeductions = row.igss + row.isr + row.judicial + row.discount + row.advance;
    const liquid = row.totalSalary - totalDeductions;

    // Recalculate Final
    const totalAdic = row.extraAmount + row.otherBonus + row.holidayBonus;
    row.finalTotal = liquid + totalAdic;

    renderPlanillaRows();
}

