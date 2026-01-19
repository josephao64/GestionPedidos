
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

            // --- PROBATION CHECK ---
            let isProbation = false;
            if (emp.hiringDate) {
                // Parse YYYY-MM-DD or DD/MM/YYYY
                let parts = emp.hiringDate.split('-');
                if (parts.length < 3) parts = emp.hiringDate.split('/');

                if (parts.length === 3) {
                    let y, m, d;
                    // Check if first part is Year (4 digits)
                    if (parts[0].length === 4) {
                        y = parseInt(parts[0]);
                        m = parseInt(parts[1]) - 1;
                        d = parseInt(parts[2]);
                    } else {
                        // Assume DD/MM/YYYY
                        d = parseInt(parts[0]);
                        m = parseInt(parts[1]) - 1;
                        y = parseInt(parts[2]);
                    }
                    const hireDate = new Date(y, m, d);
                    const today = new Date(); // Now

                    // Reset times to compare dates only
                    hireDate.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);

                    const diffTime = today - hireDate;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const pDays = parseInt(empSettings.probationDays) || 60;



                    if (diffDays >= 0 && diffDays <= pDays) {
                        // Employee is in Probation
                        isProbation = true;

                        // 1. Salary Override
                        if (empSettings.probationSalary && empSettings.probationSalary > 0) {
                            monthlySalary = parseFloat(empSettings.probationSalary);
                        }

                        // 2. Overtime Rate Override (Request 2)
                        if (empSettings.probationOvertimeRate && empSettings.probationOvertimeRate > 0) {
                            overtimeRateOverride = parseFloat(empSettings.probationOvertimeRate);
                        }
                    }
                }
            }
            // -----------------------

            const subEmpresaCheck = (emp.subEmpresa || 'Propia').trim();
            const isPedidosFlash = (subEmpresaCheck === 'Pedidos Flash' || subEmpresaCheck.toUpperCase() === 'PEDIDOS FLASH');

            // Initialize Bonus from Position or Global Default
            let monthlyBonus = parseFloat(pos.bonificacion || pos.bonus || (window.rrhhConfig.get().bonus) || 250);



            if (isPedidosFlash) {
                if (empSettings.pedidosSalary && empSettings.pedidosSalary > 0) {
                    monthlySalary = parseFloat(empSettings.pedidosSalary);
                }

                // Allow 0 overrides for Bonus
                if (empSettings.pedidosBonus !== undefined) {
                    // Check if it's not null/undefined/empty string
                    const bVal = parseFloat(empSettings.pedidosBonus);
                    if (!isNaN(bVal)) monthlyBonus = bVal;
                }

                if (empSettings.pedidosOvertime && empSettings.pedidosOvertime > 0) {
                    overtimeRateOverride = parseFloat(empSettings.pedidosOvertime);
                }
            } else {
                // Check defaults? No, default flow is fine.
            }

            // Bonus Fallback if not overridden
            // already handled by initial assignment of monthlyBonus

            // Calculations
            // Consistent Logic with updatePlanillaDays
            let periodSalary = 0;
            let periodBonus = 0;

            if (daysWorked >= 15) {
                // Full Quincena (Half Month)
                periodSalary = monthlySalary / 2;
                periodBonus = monthlyBonus / 2;
            } else {
                // Proportional (< 15 days) using 365-day basis standard
                const dailyRate = (monthlySalary * 12) / 365;
                periodSalary = dailyRate * daysWorked;

                const dailyBonus = (monthlyBonus * 12) / 365;
                periodBonus = dailyBonus * daysWorked;
            }

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

            const igssPct = (window.rrhhConfig && window.rrhhConfig.get().iggsPercentage ? window.rrhhConfig.get().iggsPercentage : 4.83) / 100;
            const igss = periodSalary * igssPct;
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
                subEmpresa: isProbation ? 'EN PRUEBA' : (emp.subEmpresa || 'Propia').trim(),
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
window.confirmSavePlanilla = confirmSavePlanilla;
window.deleteSavedPlanilla = deleteSavedPlanilla;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeletePlanilla = confirmDeletePlanilla;
window.showPayrollTotals = showPayrollTotals;
window.closePayrollTotalsModal = closePayrollTotalsModal;

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
    let companyTitle = "CORPORACION DE ALIMENTOS, S.A.";
    const headerTitleEl = document.getElementById('headerCompanyTitle');
    if (headerTitleEl && headerTitleEl.innerText) companyTitle = headerTitleEl.innerText;

    // Attempt to get Logo
    let logoSrc = "../Recibos/logo.png";
    const logoEl = document.getElementById('headerCompanyLogo');
    if (logoEl && logoEl.src) logoSrc = logoEl.src;

    // Get Branch Name
    const sEl = document.getElementById('planillaSucursal');
    let branchName = "";
    if (sEl && sEl.selectedIndex >= 0) {
        // If "Todas" or invalid, maybe handle? Usually "Todas" has value 'all'.
        if (sEl.value !== 'all') {
            branchName = sEl.options[sEl.selectedIndex].text;
        }
    }

    let periodStr = '';
    if (p && p.value === 'custom') {
        const sVal = document.getElementById('planillaStart').value;
        const eVal = document.getElementById('planillaEnd').value;
        const fmt = (d) => {
            if (!d) return '';
            const [yy, mm, dd] = d.split('-');
            return `${dd}/${mm}/${yy}`;
        };
        // Format: "del: <b>DD/MM/YYYY</b> al <b>DD/MM/YYYY</b>"
        periodStr = `del: <b>${fmt(sVal)}</b> al <b>${fmt(eVal)}</b>`;
    } else {
        const mText = m ? m.options[m.selectedIndex].text : '';
        const yText = y ? y.value : '';
        const pText = p ? (p.value == '1' ? 'Del 01 al 15' : 'Del 16 al ' + new Date(y.value, parseInt(m.value) + 1, 0).getDate()) : '';
        periodStr = `${pText} de ${mText} ${yText}`;
    }

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
        w.document.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; border: none; page-break-inside: auto; }');
        w.document.write('tr { page-break-inside: avoid; page-break-after: auto; }');
        // Restore Header Borders (User wanted "Like This" -> Screenshot shows borders)
        w.document.write('th { border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 10px; }');
        // Clean Data Rows
        w.document.write('td { border: none; padding: 25px 4px; font-size: 11px; vertical-align: bottom; }');
        // Signature Line
        w.document.write('td:last-child { border-bottom: 1px solid #000; }');
        w.document.write('.amount { text-align: right; }');
        w.document.write('.center { text-align: center; }');
        w.document.write('.header-container { display: flex; align-items: center; margin-bottom: 20px; }');
        w.document.write('.logo { height: 50px; margin-right: 20px; }');
        w.document.write('.title-box { text-align: center; flex: 1; text-transform: uppercase; font-weight: bold; }');
        w.document.write('tfoot { font-weight: bold; background: #f0f0f0; }');
        w.document.write('.page-break { page-break-after: always; display: block; height: 0; overflow: hidden; }');

        w.document.write('</style></head><body>');

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

            // Determine Header Info for this Group
            let currentTitle = companyTitle;
            let currentLogo = logoSrc;

            if (groupKey.toUpperCase() === 'PEDIDOS FLASH') {
                currentTitle = "PEDIDOS FLASH";
                currentLogo = "../resources/images/PEDIDOS FLASH.png";
            } else {
                // Use the one from the first row (common branch info) if available
                if (groupRows[0].branchName) {
                    currentTitle = groupRows[0].branchName.toUpperCase();
                }
                // Handle Branch Logo from row if we want to be super specific?
                // For now, title is the critical part requested.
                // if (groupRows[0].branchLogo) currentLogo = groupRows[0].branchLogo;
            }

            // Header
            w.document.write(`
                <div class="header-container">
                    <img src="${currentLogo}" class="logo" alt="Logo">
                    <div class="title-box">
                        <div>${currentTitle}</div>
                        ${branchName ? `<div>${branchName.toUpperCase()}</div>` : ''}
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

            groupRows.forEach(row => {
                // Use the same final calculated properties if they exist, or re-calc with rounding
                // Ideally we should rely on row.finalTotal if it exists, but this table is specific.

                // Re-calculate with rounding to match main table display
                // Note: The main table logic for totalDeductions is:
                // const totalDeductions = liveRow.igss + liveRow.isr + liveRow.judicial + liveRow.discount + liveRow.advance;
                // But in main table we sum Number(totalDeductions.toFixed(2)).
                // Here we should do the same.

                const totalSal = row.salary + row.bonus;
                const totalDed = row.igss + row.isr + row.judicial + row.discount + row.advance;
                const liq = totalSal - totalDed;

                // Accumulate ROUNDED values
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

                        <td class="amount">Q${liq.toFixed(2)}</td>

                        <!-- Remove explicit inline border since CSS handles it now, or keep empty -->
                        <td></td>
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

            // Page Break if not last
            if (groupIdx < keys.length - 1) {
                w.document.write('<div class="page-break"></div>');
            }
        });

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

    const showSubtitle = branchName && branchName.toUpperCase() !== displayCompanyName && branchName !== 'Todas las Sucursales';

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
                    <div>${period.toLowerCase().startsWith('del:') ? 'Periodo ' + period : 'Periodo: ' + period}</div>
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

    // Recalculate Liquid
    const totalDeductions = row.igss + row.isr + row.judicial + row.discount + row.advance;
    const liquid = row.totalSalary - totalDeductions;

    // Recalculate Final
    const totalAdic = row.extraAmount + row.otherBonus + row.holidayBonus;
    row.finalTotal = liquid + totalAdic;

    // Re-render to update dependent columns (Total Salary, IGSS, Liquid, etc.)
    renderPlanillaRows();
}


function updatePlanillaRowBonus(index, newVal) {
    const row = currentPayrollData[index];
    if (!row) return;

    const bonus = parseFloat(newVal);
    if (isNaN(bonus)) return;

    row.bonus = bonus;

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

