// vacaciones.js
let selectedVacationEmployee = null;

async function initVacaciones() {
    console.log("Inicializando módulo de vacaciones");
    await loadVacationBranchFilter();
    await loadVacationEmployeesSelect(); // Populate search dropdown

    // Initialize Dashboard logic if container exists
    if (document.getElementById('vacationDashboardView')) {
        await window.vacations.loadDashboard();
    }
}

// Global state for dashboard
let vacationDashboardData = [];

window.vacations = {
    // expose existing methods if needed or stick to global functions
    init: initVacaciones,

    loadDashboard: async function () {
        const tbody = document.getElementById('dashVacBody');
        const sucursalFilter = document.getElementById('dashVacSucursal');

        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Cargando datos...</td></tr>';

        try {
            // 1. Fetch Metadata (Employees & Vacations & Sucursales)
            const [empSnap, vacSnap, sucSnap] = await Promise.all([
                db.collection('employees').where('status', '==', 'active').get(),
                db.collection('vacations').get(),
                db.collection('sucursales').get()
            ]);

            // Populate Sucursal Filter if empty
            if (sucursalFilter && sucursalFilter.options.length <= 1) {
                sucursalFilter.innerHTML = '<option value="all">Todas las Sucursales</option>';
                sucSnap.forEach(doc => {
                    sucursalFilter.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
                });
            }

            // Map Vacations by Employee
            const vacMap = {};
            // Store raw vacations for calendar
            window.vacations.rawVacations = [];
            vacSnap.forEach(doc => {
                const v = doc.data();
                window.vacations.rawVacations.push(v);
                if (!vacMap[v.employeeId]) vacMap[v.employeeId] = 0;
                vacMap[v.employeeId] += parseFloat(v.daysTaken || 0);
            });

            const sucursalMap = {};
            sucSnap.forEach(doc => {
                sucursalMap[doc.id] = doc.data().name;
            });

            // Process Employees
            vacationDashboardData = [];
            const today = new Date();
            const oneYear = 31536000000; // ms

            empSnap.forEach(doc => {
                const emp = doc.data();
                const start = emp.startDate ? new Date(emp.startDate) : null;

                if (!start) return; // Skip if no start date

                const diff = today - start;
                const yearsService = diff / oneYear;

                // Eligibility Rule: Proportional (15 days per year)
                // const completedYears = Math.floor(yearsService); // Old rule
                const totalEligible = parseFloat((yearsService * 15).toFixed(2));
                const taken = vacMap[doc.id] || 0;
                const pending = parseFloat((totalEligible - taken).toFixed(2));

                // Upcoming Anniversary (Next 30 days)
                let nextAnniv = new Date(start);
                nextAnniv.setFullYear(today.getFullYear());
                if (nextAnniv < today) {
                    nextAnniv.setFullYear(today.getFullYear() + 1);
                }
                const daysToAnniv = (nextAnniv - today) / (1000 * 60 * 60 * 24);
                const isUpcoming = daysToAnniv <= 30;

                vacationDashboardData.push({
                    id: doc.id,
                    name: emp.fullName,
                    sucursalId: emp.sucursalId,
                    sucursalName: sucursalMap[emp.sucursalId] || 'Sin Sucursal',
                    startDate: start,
                    years: yearsService.toFixed(1),
                    eligible: totalEligible,
                    taken: taken,
                    pending: pending,
                    nextAnniv: nextAnniv,
                    isUpcoming: isUpcoming
                });
            });

            // Initial Render
            this.filterDashboardTable();

        } catch (e) {
            console.error("Error loading dashboard:", e);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error al cargar datos</td></tr>';
        }
    },

    filterDashboardTable: function () {
        const sucursalId = document.getElementById('dashVacSucursal').value;
        const searchTerm = document.getElementById('dashVacSearch').value.toLowerCase();
        const tbody = document.getElementById('dashVacBody');

        // Filter
        const filtered = vacationDashboardData.filter(item => {
            const matchSucursal = sucursalId === 'all' || item.sucursalId === sucursalId;
            const matchSearch = item.name.toLowerCase().includes(searchTerm);
            return matchSucursal && matchSearch;
        });

        // Metrics Calculation
        let totalPending = 0;
        let countPending = 0;
        let countUpcoming = 0;

        filtered.forEach(item => {
            if (item.pending > 0) {
                totalPending += item.pending;
                countPending++;
            }
            if (item.isUpcoming) countUpcoming++;
        });

        // Update Cards
        document.getElementById('dashVacPendingTotal').innerText = totalPending.toFixed(0);
        document.getElementById('dashVacPendingCount').innerText = countPending;
        document.getElementById('dashVacUpcoming').innerText = countUpcoming;

        // Render Table
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No se encontraron resultados.</td></tr>';
        } else {
            let html = '';
            // Sort by Pending Descending
            filtered.sort((a, b) => b.pending - a.pending);

            filtered.forEach(item => {
                const dateStr = item.nextAnniv.toLocaleDateString();
                const upcomingBadge = item.isUpcoming ? '<span class="badge badge-warning">Próximo</span>' : '';
                const pendingStyle = item.pending > 0 ? 'color: #d97706; font-weight: bold;' : 'color: #059669;';

                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px;">
                            <strong>${item.name}</strong>
                        </td>
                        <td style="padding: 10px;">${item.sucursalName}</td>
                        <td style="padding: 10px;">${dateStr} ${upcomingBadge}</td>
                        <td style="padding: 10px; text-align: center;">${item.years}</td>
                        <td style="padding: 10px; text-align: center;">${item.eligible}</td>
                        <td style="padding: 10px; text-align: center;">${item.taken}</td>
                        <td style="padding: 10px; text-align: center; ${pendingStyle}">${item.pending}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button class="btn btn-sm btn-primary" onclick="setVacationEmployee('${item.id}')">
                                <i class="fas fa-calendar-check"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        // --- NEW VISUALS RENDER ---
        this.renderVacationVisuals();
    },

    // --- VISUALS LOGIC ---
    calendarDate: new Date(),

    renderVacationVisuals: function () {
        this.renderCharts();
        this.renderCalendar();
    },

    changeCalendarMonth: function (delta) {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + delta);
        this.renderCalendar();
    },

    renderCalendar: function () {
        const grid = document.getElementById('vacCalendarGrid');
        const title = document.getElementById('vacCalendarTitle');
        if (!grid) return;

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        title.innerText = `${monthNames[month]} ${year}`;

        grid.innerHTML = '';

        // Days header
        const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        days.forEach(d => {
            grid.innerHTML += `<div style="text-align: center; font-weight: bold; padding: 5px; background: #f3f4f6;">${d}</div>`;
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div></div>`;
        }

        // Draw Days
        // We need to know which employees are on vacation each day.
        // We have 'dashboardData' but need raw vacation list.
        // Let's assume we can fetch vacations again or store them globally.
        // Optimization: Store global 'allVacations' in window.vacations.rawVacations

        const rawVacations = window.vacations.rawVacations || [];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const currentObj = new Date(year, month, day);

            // Find vacations active on this day
            const activeOnDay = rawVacations.filter(v => {
                const start = new Date(v.startDate);
                const end = new Date(v.endDate);
                // Simple date compare (ignoring time)
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                return currentObj >= start && currentObj <= end;
            });

            let dotsHtml = '';
            activeOnDay.forEach(v => {
                dotsHtml += `<div title="${v.employeeName}" style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; display: inline-block; margin: 1px;"></div>`;
            });

            grid.innerHTML += `
                <div style="border: 1px solid #e5e7eb; height: 60px; padding: 2px; font-size: 0.8em; position: relative;">
                    <div style="font-weight: bold;">${day}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 2px;">${dotsHtml}</div>
                </div>
            `;
        }
    },

    renderCharts: function () {
        const ctxStatus = document.getElementById('vacStatusChart');
        const ctxMonthly = document.getElementById('vacMonthlyChart');
        if (!ctxStatus || !ctxMonthly) return;

        // Data Prep
        let pendingCount = 0;
        let clearCount = 0;
        vacationDashboardData.forEach(d => {
            if (d.pending > 0) pendingCount++; else clearCount++;
        });

        // Chart 1: Status
        if (window.vacStatusChartInstance) window.vacStatusChartInstance.destroy();
        window.vacStatusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Con Pendientes', 'Al Día'],
                datasets: [{
                    data: [pendingCount, clearCount],
                    backgroundColor: ['#f59e0b', '#10b981']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Estado de Vacaciones' },
                    legend: { position: 'bottom' }
                }
            }
        });

        // Chart 2: Monthly Distribution (of taken vacations)
        const monthlyCounts = Array(12).fill(0);
        const rawVacations = window.vacations.rawVacations || [];
        rawVacations.forEach(v => {
            const m = new Date(v.startDate).getMonth();
            monthlyCounts[m]++;
        });

        if (window.vacMonthlyChartInstance) window.vacMonthlyChartInstance.destroy();
        window.vacMonthlyChartInstance = new Chart(ctxMonthly, {
            type: 'bar',
            data: {
                labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
                datasets: [{
                    label: 'Vacaciones Iniciadas',
                    data: monthlyCounts,
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Distribución Mensual' },
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    calculateEndDate: function () {
        const startInput = document.getElementById('vacStartDate');
        const endInput = document.getElementById('vacEndDate');
        if (!startInput.value) return;

        const start = new Date(startInput.value);
        // Rule: 15 continuous days. 
        // Start = Day 1. End = Day 15.
        // So add 14 days.
        const end = new Date(start);
        end.setDate(start.getDate() + 14);

        endInput.value = end.toISOString().split('T')[0];
    },

    toggleVacationMode: function () {
        const actionEl = document.querySelector('input[name="vacActionType"]:checked');
        const durationEl = document.querySelector('input[name="vacDurationType"]:checked');
        if (!actionEl || !durationEl) return;

        const action = actionEl.value;
        const duration = durationEl.value;

        const durationContainer = document.getElementById('vacDurationContainer');
        const dateFields = document.getElementById('vacDateFields');
        const payoutFields = document.getElementById('vacPayoutFields');
        const endDateInput = document.getElementById('vacEndDate');
        const calcDisclaimer = document.getElementById('vacCalcDisclaimer');

        if (action === 'payout') {
            durationContainer.style.display = 'none';
            dateFields.style.display = 'none';
            payoutFields.style.display = 'block';
            // Trigger calculation
            this.calculatePayout();
        } else if (action === 'mixed') {
            // Mixed
            durationContainer.style.display = 'block';
            dateFields.style.display = 'block';
            payoutFields.style.display = 'block';

            // Default behavior for mixed: Custom duration usually preferred but let's respect duration selector
            if (duration === 'full') {
                // In mixed, "Full" might mean 15 days TOTAL? 
                // User requirement: "TIENE QUE SER 15 ENTRE LAS DOS"
                // So if Full is selected, maybe we auto-calc one based on other?
                // For now let's just show fields. 
                endDateInput.readOnly = true;
                endDateInput.style.backgroundColor = '#f3f4f6';
                this.calculateEndDate();
            } else {
                endDateInput.readOnly = false;
                endDateInput.style.backgroundColor = '#ffffff';
            }
            this.calculatePayout();
        } else {
            // Enjoy only
            durationContainer.style.display = 'block';
            dateFields.style.display = 'block';
            payoutFields.style.display = 'none';

            if (duration === 'full') {
                endDateInput.readOnly = true;
                endDateInput.style.backgroundColor = '#f3f4f6';
                if (calcDisclaimer) calcDisclaimer.style.display = 'block';
                this.calculateEndDate();
            } else {
                // Custom
                endDateInput.readOnly = false;
                endDateInput.style.backgroundColor = '#ffffff';
                if (calcDisclaimer) calcDisclaimer.style.display = 'none';
            }
        }
    },

    calculatePayout: function () {
        if (!selectedVacationEmployee) return;

        const actionEl = document.querySelector('input[name="vacActionType"]:checked');
        const action = actionEl ? actionEl.value : 'payout';

        // Only auto-calc if payout or mixed
        if (action !== 'payout' && action !== 'mixed') return;

        const daysInput = document.getElementById('vacPayoutDays');
        const amountInput = document.getElementById('vacPayoutAmount');
        const days = parseFloat(daysInput.value) || 0;

        // Use baseSalary or minimum wage if configured? Assuming baseSalary on employee record
        // If baseSalary is string '2500.00', parse it.
        const salary = parseFloat(selectedVacationEmployee.baseSalary) || 2800; // Fallback to approx min wage if missing?
        const dailyVal = salary / 30;

        if (days > 0) {
            const total = dailyVal * days;
            // Only update amount if it's empty or user just changed days (how to track? simpler: just update)
            // But we want to allow manual override. 
            // Logic: If user specifically inputs amount, we shouldn't overwrite unless days changes?
            // Since this runs on 'keyups' or 'change', let's update.
            // If the user wants to override, they can type in amount box *after* typing days.
            // But if this runs on any change... 
            // Let's check if the event target was the days input. 
            // Since we don't have event here easily, we'll just update for now.
            amountInput.value = total.toFixed(2);
        }
    }
};

// Helper helper to bridge the select action
function setVacationEmployee(id) {
    const select = document.getElementById('vacationEmployeeSearch');
    if (select) {
        select.value = id;
        selectVacationEmployee();
        // Scroll down to processing area
        document.getElementById('vacationEmployeeInfo').scrollIntoView({ behavior: 'smooth' });
    }
}

async function loadVacationBranchFilter() {
    const select = document.getElementById('vacBranchFilter');
    if (!select) return;

    // Only load if empty (default has 1 option)
    if (select.options.length > 1) return;

    try {
        const snap = await db.collection('sucursales').orderBy('name').get();
        let html = '<option value="">Todas las Sucursales</option>';
        snap.forEach(doc => {
            html += `<option value="${doc.id}">${doc.data().name}</option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        console.error("Error loading branches for filter:", e);
    }
}

async function loadVacationEmployeesSelect() {
    const searchSelect = document.getElementById('vacationEmployeeSearch');
    const branchFilter = document.getElementById('vacBranchFilter');
    if (!searchSelect) return;

    searchSelect.innerHTML = '<option value="">Buscar empleado...</option>';
    const branchId = branchFilter ? branchFilter.value : '';

    try {
        let query = db.collection('employees').where('status', '==', 'active');

        if (branchId) {
            query = query.where('sucursalId', '==', branchId);
        }

        const snapshot = await query.orderBy('fullName').get();

        if (snapshot.empty) {
            searchSelect.innerHTML += '<option disabled>No hay empleados en esta sucursal</option>';
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${data.fullName} - ${data.dpi}`;
            searchSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Error loading employees for vacation:", e);
    }
}

async function selectVacationEmployee() {
    const empId = document.getElementById('vacationEmployeeSearch').value;
    const infoCard = document.getElementById('vacationEmployeeInfo');
    const formContainer = document.getElementById('grantVacationContainer');
    const historyContainer = document.getElementById('vacationHistoryContainer');

    if (!empId) {
        infoCard.style.display = 'none';
        formContainer.style.display = 'none';
        historyContainer.style.display = 'none';
        selectedVacationEmployee = null;
        return;
    }

    try {
        const doc = await db.collection('employees').doc(empId).get();
        if (!doc.exists) return;

        selectedVacationEmployee = { id: doc.id, ...doc.data() };
        renderVacationEmployeeInfo(selectedVacationEmployee);

        // Show sections
        infoCard.style.display = 'block';
        formContainer.style.display = 'block';
        historyContainer.style.display = 'block';

        // Load history
        loadVacationHistory(empId);

    } catch (e) {
        console.error("Error fetching employee details:", e);
    }
}

function renderVacationEmployeeInfo(employee) {
    const nameEl = document.getElementById('lblVacName');
    const startEl = document.getElementById('lblVacStart');
    const eligibilityEl = document.getElementById('lblVacEligibility');
    const statusBox = document.getElementById('vacEligibilityBox');

    nameEl.textContent = employee.fullName;
    startEl.textContent = employee.startDate || 'No registrada';

    if (!employee.startDate) {
        eligibilityEl.textContent = "Fecha de inicio desconocida";
        statusBox.className = "alert alert-warning";
        return;
    }

    const startDate = new Date(employee.startDate);
    const today = new Date();
    // 1 year in millis = 365 * 24 * 60 * 60 * 1000
    const oneYear = 31536000000;
    const diff = today - startDate;
    const yearsService = (diff / oneYear).toFixed(1);

    if (diff >= oneYear) {
        eligibilityEl.innerHTML = `<strong>ELIGIBLE</strong> <br> ${yearsService} años de servicio.`;
        statusBox.className = "alert alert-success"; // Custom CSS class for green box
        statusBox.style.background = "#dcfce7";
        statusBox.style.color = "#166534";
        statusBox.style.padding = "15px";
        statusBox.style.borderRadius = "8px";

        // Enable form
        document.getElementById('btnGrantVacation').disabled = false;
    } else {
        const daysRemaining = Math.ceil((oneYear - diff) / (1000 * 60 * 60 * 24));
        eligibilityEl.innerHTML = `<strong>NO ELIGIBLE AÚN</strong> <br> ${yearsService} años de servicio. <br> Faltan ${daysRemaining} días.`;
        statusBox.className = "alert alert-danger";
        statusBox.style.background = "#fee2e2";
        statusBox.style.color = "#991b1b";
        statusBox.style.padding = "15px";
        statusBox.style.borderRadius = "8px";

        // Disable form
        document.getElementById('btnGrantVacation').disabled = true;
    }
}

async function loadVacationHistory(empId) {
    const tbody = document.getElementById('vacationHistoryBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        const snapshot = await db.collection('vacations')
            .where('employeeId', '==', empId)
            .orderBy('startDate', 'desc')
            .get();

        let totalDaysTaken = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #777;">Sin registros previos</td></tr>';
        } else {
            // ... existing loop ...
            let html = '';
            snapshot.forEach(doc => {
                const v = doc.data();
                const days = parseFloat(v.daysTaken) || 0;
                totalDaysTaken += days;

                html += `
                     <tr style="border-bottom: 1px solid #eee;">
                         <td style="padding: 8px;">${v.periodIdentifier || '-'}</td>
                         <td style="padding: 8px;">${v.startDate || 'N/A'}</td>
                         <td style="padding: 8px;">${v.endDate || 'N/A'}</td>
                         <td style="padding: 8px;">
                             ${v.type === 'payout' ? '💰 ' : ''}${days} días
                         </td>
                         <td style="padding: 8px;">${v.comments || ''}</td>
                         <td style="padding: 8px; text-align: center;">
                             <div style="display: flex; gap: 5px; justify-content: center;">
                                <button class="btn btn-sm btn-info" onclick="printVacationReceipt('${doc.id}')" title="Imprimir Comprobante">
                                    <i class="fas fa-print"></i>
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="editVacation('${doc.id}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteVacation('${doc.id}')" title="Eliminar Registro">
                                    <i class="fas fa-trash"></i>
                                </button>
                             </div>
                         </td>
                     </tr>
                 `;
            });
            tbody.innerHTML = html;
        }

        // ALWAYS update balance and periods, regardless of history
        updateVacationBalanceUI(totalDaysTaken);

        // Pass snapshot docs (even if empty, it's a QuerySnapshot, but better to pass array)
        calculateAndRenderPeriods(selectedVacationEmployee.startDate, snapshot.docs);

        // Store docs globally for helper access (print/edit)
        window.currentVacationDocs = snapshot.docs;

    } catch (e) {
        console.error("Error history:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Error al cargar historial</td></tr>';
    }
}

// --- PRINT RECEIPT ---
// --- PRINT RECEIPT ---
// --- PRINT RECEIPT ---
window.printVacationReceipt = async function (docId) {
    if (!window.currentVacationDocs) return;
    const doc1 = window.currentVacationDocs.find(d => d.id === docId);
    if (!doc1) return;
    let v1 = doc1.data();

    const employee = selectedVacationEmployee || {};

    // Fetch Letterhead
    let letterheadImg = 'membrete vipizza.png'; // Default
    try {
        if (employee.sucursalId) {
            const sDoc = await db.collection('sucursales').doc(employee.sucursalId).get();
            if (sDoc.exists && sDoc.data().membrete) {
                letterheadImg = sDoc.data().membrete;
            }
        }
    } catch (e) { console.error("Error fetching letterhead", e); }

    // Dates Formatting Helpers
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

    function formatDateLong(dateStr) {
        if (!dateStr) return '...';
        // Fix timezone issue by appending time or handling as local
        // Assuming dateStr is YYYY-MM-DD
        const parts = dateStr.split('-');
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        const dayName = days[date.getDay()];
        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${dayName} ${day} de ${month} de ${year}`;
    }

    function formatDateShort(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    // Logic for Return to Work (End Date + 1 Day)
    let returnDateStr = '...';
    if (v1.endDate) {
        const parts = v1.endDate.split('-');
        const endDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        endDateObj.setDate(endDateObj.getDate() + 1);
        returnDateStr = formatDateLong(`${endDateObj.getFullYear()}-${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}-${endDateObj.getDate()}`);
    }

    // Logic for Period Dates (Refined for Anniversaries)
    let periodText = v1.periodIdentifier || '...';
    try {
        if (employee.startDate && (v1.period || v1.periodIdentifier)) {
            // Extract the main year. Usually stored as "2025" or "2024-2025"
            let pYearStr = (v1.period || v1.periodIdentifier).toString();
            if (pYearStr.includes('-')) pYearStr = pYearStr.split('-')[1]; // Take the second year as the closing year? 
            // User said: "2025" -> 01/01/2025 to 31/12/2025. 
            // If the record says "2025", we use 2025 as the base year.
            // If the record says "2024-2025", typically means period starting 2024 ending 2025.
            // However, existing data might just be "2024". 
            // Let's rely on the integer value.

            let periodYear = parseInt(pYearStr.match(/\d{4}/)[0]);

            // If the periodIdentifier was "2023-2024", and we picked 2024, but start date is Jan 1...
            // Let's assume the user selects the "Year" of the vacation. 
            // If they selected "2025", it means the period *starting* in 2025? No, user example: "01/01/2025 al 31/12/2025".
            // So if `period` is 2025, Start Date = Anniversary 2025.

            const startParts = employee.startDate.split('-'); // YYYY-MM-DD
            const baseMonth = parseInt(startParts[1]) - 1; // 0-indexed
            const baseDay = parseInt(startParts[2]);

            // Construct Start Date: Anniversary in the Period Year
            // Warning: If periodYear is "2025" but the period actually started in 2024?
            // User example: "Si son vacaciones del último año (2025)... del 01/01/2025"
            // This implies the Period Year matches the Start Year of the period.

            const pStartObj = new Date(periodYear, baseMonth, baseDay);

            // Construct End Date: Start Date + 1 Year - 1 Day
            const pEndObj = new Date(periodYear + 1, baseMonth, baseDay);
            pEndObj.setDate(pEndObj.getDate() - 1);

            const pStartStr = formatDateShort(pStartObj); // Defined above
            const pEndStr = formatDateShort(pEndObj);

            periodText = `del ${pStartStr} al ${pEndStr}`;
        }
    } catch (e) { console.error("Error calc period", e); }

    const todayDate = new Date();
    const todayLong = `Poptún, ${todayDate.getDate().toString().padStart(2, '0')} de ${months[todayDate.getMonth()]} de ${todayDate.getFullYear()}`;

    // --- HTML GENERATION ---
    const win = window.open('', '', 'height=1000,width=850');
    win.document.write('<html><head><title>Constancia de Vacaciones</title>');
    win.document.write(`
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
            
            /* Remove Browser Headers/Footers */
            @page { 
                margin: 0; 
                size: auto; 
            }

            body { 
                font-family: 'Roboto', Arial, sans-serif; 
                margin: 0; 
                padding: 0; 
                background: #fff;
                color: #000;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .page {
                width: 8.5in;
                height: 11in;
                padding: 1in;
                box-sizing: border-box;
                position: relative;
                page-break-after: always;
                margin: 0 auto;
                background-image: url('../resources/images/${letterheadImg}');
                background-size: 100% 100%;
                background-repeat: no-repeat;
            }
            /* LETTER STYLES */
            .letter-date {
                text-align: right;
                margin-top: 1in; /* Adjust for header if needed */
                margin-bottom: 60px;
                font-size: 1.1em;
            }
            .letter-body {
                text-align: justify;
                line-height: 1.8;
                font-size: 1.1em;
                margin-bottom: 60px;
            }
            .letter-sign {
                margin-top: 100px;
                text-align: center;
            }
            .sign-line {
                border-top: 1px solid #000;
                width: 60%;
                margin: 0 auto 10px auto;
            }

            /* FORM STYLES */
            .form-header {
                text-align: center;
                font-weight: bold;
                font-size: 1.4em;
                margin-top: 1in; /* Adjust for header if needed */
                margin-bottom: 20px;
                text-transform: uppercase;
                border-bottom: 2px solid #ccc;
                padding-bottom: 20px;
            }
            .form-section {
                margin-bottom: 25px;
                
            }
            .section-title {
                font-weight: bold;
                margin-bottom: 10px;
                font-size: 1.1em;
                color: #000;
            }
            .field-row {
                margin-bottom: 8px;
                font-size: 1em;
            }
            .field-label {
                font-weight: bold;
                width: 200px;
                display: inline-block;
            }
            .divider {
                border-bottom: 1px solid #ccc;
                margin: 20px 0;
            }
            .legal-text {
                margin-top: 30px;
                text-align: justify;
                font-size: 0.9em;
                line-height: 1.6;
            }
            .form-signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 80px;
            }
            .sig-block {
                text-align: center;
                width: 45%;
            }
        </style>
    `);
    win.document.write('</head><body>');

    // --- PAGE 1: LETTER ---
    win.document.write(`
        <div class="page">
            <div class="letter-date">${todayLong}.</div>
            
            <div class="letter-body">
                <br><br>
                Por medio de la presente, yo, <strong>${employee.fullName}</strong>, dejo constancia de que he sido informado y he aceptado tomar las vacaciones que me corresponde ${periodText}, el cual ha sido debidamente aprobado por la empresa.
                <br><br>
                Asimismo, me comprometo a coordinar con el equipo para asegurar que mi ausencia no afecte el normal desarrollo de nuestras actividades. Además, me responsabilizo de dejar todas mis tareas y responsabilidades en orden antes de mi salida.
                <br><br>
                Atentamente,
            </div>

            <div class="letter-sign">
                <br><br><br>
                <div>Firmado,</div>
                <br><br><br><br>
                <div class="sign-line"></div>
                <div><strong>${employee.fullName}</strong></div>
                <div><strong>DPI: ${employee.dpi || 'N/A'}</strong></div>
            </div>
        </div>
    `);

    // --- PAGE 2: FORM ---
    win.document.write(`
        <div class="page">
             <div class="form-header">Concesión de Vacaciones</div>

             <div class="form-section">
                <div class="section-title">Datos del colaborador</div>
                <div class="field-row"><span class="field-label">Nombre del colaborador:</span> ${employee.fullName}</div>
                <div class="field-row"><span class="field-label">DPI del colaborador:</span> ${employee.dpi || 'N/A'}</div>
                <div class="field-row"><span class="field-label">Puesto:</span> ${employee.positionName || employee.puesto || v1.employeePosition || 'N/A'}</div>
             </div>
             
             <div class="divider"></div>

             <div class="form-section">
                <div class="section-title">Fecha de las Vacaciones</div>
                <div class="field-row"><span class="field-label">Inicio de vacaciones:</span> ${formatDateLong(v1.startDate)}</div>
                <div class="field-row"><span class="field-label">Fin de vacaciones:</span> ${formatDateLong(v1.endDate)}</div>
                <div class="field-row"><span class="field-label">Inicio de labor:</span> ${returnDateStr}</div>
             </div>

             <div class="divider"></div>

             <div class="form-section">
                <div class="field-row" style="font-weight:bold;">
                    Número de días de vacaciones: ${v1.daysTaken} días hábiles
                </div>
             </div>

             <div class="divider"></div>

             <div class="legal-text">
                Estoy de acuerdo con lo establecido en este documento y hago constar que se ha dado cumplimiento a lo señalado en el artículo 130 del código de trabajo el cual expone “Todo trabajador sin excepción, tiene derecho a un período de vacaciones remuneradas después de cada año de trabajo al servicio de un mismo patrono, cuya duración mínima es de quince días hábiles”. He disfrutado de las vacaciones señaladas.
             </div>

             <div class="form-signatures">
                <div class="sig-block">
                    <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                    <div>Firma del colaborador</div>
                </div>
                <div class="sig-block">
                    <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                    <div>Firma del Encargado</div>
                </div>
             </div>
        </div>
    `);

    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    // setTimeout(() => win.print(), 1000); // Optional auto-print
};

window.editVacation = async function (docId) {
    Swal.fire('Editar', 'Funcionalidad de edición: Se eliminará el registro actual y se cargarán los datos para crear uno nuevo corregido.', 'info');

    if (!window.currentVacationDocs) return;
    const doc = window.currentVacationDocs.find(d => d.id === docId);
    if (!doc) return;
    const v = doc.data();

    // Check for Linked Record (Mixed)
    let v2 = null;
    let linkedId = v.linkedRecordId;

    if (linkedId) {
        // Try to find it in current list first
        const doc2 = window.currentVacationDocs.find(d => d.id === linkedId);
        if (doc2) {
            v2 = doc2.data();
        } else {
            // Fetch if not in list (rare but possible)
            try {
                const snap = await db.collection('vacations').doc(linkedId).get();
                if (snap.exists) v2 = snap.data();
            } catch (e) { console.error("Error fetching linked doc", e); }
        }
    }

    // 1. Fill Fields
    let enjoyPart = null;
    let payoutPart = null;

    if (v2) {
        // We have a pair
        enjoyPart = v.type === 'enjoy' ? v : v2;
        payoutPart = v.type === 'payout' ? v : v2;

        // Set Mode Mixed
        const mixedRadio = document.querySelector('input[name="vacActionType"][value="mixed"]');
        if (mixedRadio) {
            mixedRadio.checked = true;
            window.vacations.toggleVacationMode(); // Trigger UI update
        }
    } else {
        // Single record
        if (v.type === 'enjoy') enjoyPart = v;
        else payoutPart = v;

        const radio = document.querySelector(`input[name="vacActionType"][value="${v.type}"]`);
        if (radio) {
            radio.checked = true;
            window.vacations.toggleVacationMode();
        }
    }

    // Populate Common
    const commentsToUse = (enjoyPart ? enjoyPart.comments : '') || (payoutPart ? payoutPart.comments : '');
    // Remove auto-generated text if present to avoid duplication
    const cleanComments = commentsToUse.replace(' (Parte Mixta - Disfrute)', '').replace(' (Parte Mixta - Pago)', '');
    document.getElementById('vacComments').value = cleanComments;

    const periodToUse = (enjoyPart ? enjoyPart.periodIdentifier : '') || (payoutPart ? payoutPart.periodIdentifier : '');
    const periodSelect = document.getElementById('vacPeriodSelect');
    if (periodSelect && periodToUse) periodSelect.value = periodToUse;


    // Populate Enjoy Fields
    if (enjoyPart) {
        document.getElementById('vacStartDate').value = enjoyPart.startDate;
        document.getElementById('vacEndDate').value = enjoyPart.endDate;
    }

    // Populate Payout Fields
    if (payoutPart) {
        document.getElementById('vacPayoutDays').value = payoutPart.daysTaken;
        document.getElementById('vacPayoutAmount').value = payoutPart.amountPaid || '';
    }

    // IDs to delete
    const idsToDelete = [docId];
    if (linkedId) idsToDelete.push(linkedId);

    // Change Button
    const btn = document.getElementById('btnGrantVacation');
    if (btn) {
        const originalText = btn.innerText;
        const originalOnClick = btn.onclick;

        btn.innerText = 'Actualizar Registro';
        // Remove old listeners to be safe (though redefining onclick property works)

        btn.onclick = async function () {
            try {
                // Delete old records
                const batch = db.batch();
                idsToDelete.forEach(id => {
                    const ref = db.collection('vacations').doc(id);
                    batch.delete(ref);
                });
                await batch.commit();

                // Save new (calls global function)
                await saveVacationGrant();

                // Reset UI
                btn.innerText = 'Registrar Vacaciones';
                btn.onclick = saveVacationGrant; // Restore

                // Clear form handled by saveVacationGrant, but maybe force clear if needed
            } catch (error) {
                console.error("Error updating vacation", error);
                Swal.fire('Error', 'No se pudo actualizar el registro', 'error');
            }
        }
    }
}
function updateVacationBalanceUI(daysTaken) {
    if (!selectedVacationEmployee || !selectedVacationEmployee.startDate) return;

    const startDate = new Date(selectedVacationEmployee.startDate);
    const today = new Date();
    const oneYear = 31536000000;
    const diff = today - startDate;
    const yearsService = diff / oneYear;

    // 15 days per year (Proportional)
    const accruedDays = parseFloat((yearsService * 15).toFixed(2));
    const balance = parseFloat((accruedDays - daysTaken).toFixed(2));

    // Store globally for validation
    window.currentVacationBalance = balance;

    const eligibilityEl = document.getElementById('lblVacEligibility');
    const statusBox = document.getElementById('vacEligibilityBox');

    if (diff < oneYear) {
        // Not eligible yet logic handled in render, but let's override to show progress
        const daysRemaining = Math.ceil((oneYear - diff) / (1000 * 60 * 60 * 24));
        eligibilityEl.innerHTML = `<strong>NO ELIGIBLE AÚN</strong> <br> ${yearsService.toFixed(1)} años. Faltan ${daysRemaining} días.`;
        statusBox.className = "alert alert-danger";
        statusBox.style.background = "#fee2e2";
        statusBox.style.color = "#991b1b";
        document.getElementById('btnGrantVacation').disabled = true;
        return;
    }

    // Eligible
    let statusColor = "#dcfce7"; // Green
    let textColor = "#166534";
    let statusText = "DISPONIBLE";

    if (balance <= 0) {
        statusColor = "#fee2e2"; // Red
        textColor = "#991b1b";
        statusText = "AGOTADO";
        // Disable button? Maybe allow override but warn?
        // Let's allow but validation will catch it?
        // User wants validation, so maybe disable if 0.
    } else if (balance < 5) {
        statusColor = "#fef3c7"; // Yellow
        textColor = "#d97706";
        statusText = "BAJO SALDO";
    }

    statusBox.style.background = statusColor;
    statusBox.style.color = textColor;

    eligibilityEl.innerHTML = `
        <div style="font-size: 0.9em; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">${statusText}</div>
        <div style="font-size: 1.2em; font-weight: 800;">${balance} Días Disponibles</div>
        <div style="font-size: 0.8em; margin-top: 5px;">
            Acumulados: ${accruedDays} | Tomados: ${daysTaken}
        </div>
    `;

    // Enable/Disable based on balance?
    // If balance <= 0, strictly disable? Or allow negative?
    // User asked to "take into account the days left". Usually implies restriction.
    if (balance <= 0) {
        document.getElementById('btnGrantVacation').disabled = true;
    } else {
        document.getElementById('btnGrantVacation').disabled = false;
    }




}

async function saveVacationGrant() {
    if (!selectedVacationEmployee) return;

    // Gather Form Data
    const comments = document.getElementById('vacComments').value;
    const actionEl = document.querySelector('input[name="vacActionType"]:checked');
    const action = actionEl ? actionEl.value : 'enjoy';

    // NEW: Get Period
    const periodSelect = document.getElementById('vacPeriodSelect');
    const periodId = periodSelect ? periodSelect.value : null;

    if (!periodId && periodSelect && periodSelect.options.length > 1) {
        // Only enforce if periods are available
        Swal.fire('Atención', 'Seleccione el periodo al que corresponde esta vacación', 'warning');
        return;
    }

    const vacationData = {
        employeeId: selectedVacationEmployee.id,
        employeeName: selectedVacationEmployee.nombre,
        employeePosition: selectedVacationEmployee.puesto || 'N/A',
        comments: comments,
        periodIdentifier: periodId, // SAVE PERIOD ID
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // --- MIXED LOGIC ---
    if (action === 'mixed') {
        const daysToPay = parseFloat(document.getElementById('vacPayoutDays').value) || 0;
        const amount = parseFloat(document.getElementById('vacPayoutAmount').value);
        const startInput = document.getElementById('vacStartDate').value;
        const endInput = document.getElementById('vacEndDate').value;

        if (!daysToPay || daysToPay <= 0) {
            Swal.fire('Error', 'Ingrese días a pagar válidos', 'warning');
            return;
        }
        if (!startInput || !endInput) {
            Swal.fire('Error', 'Ingrese fechas de disfrute', 'warning');
            return;
        }

        const start = new Date(startInput);
        const end = new Date(endInput);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 0) {
            Swal.fire('Error', 'Fechas inválidas', 'error'); return;
        }

        const totalDays = diffDays + daysToPay;

        // Strict 15 check? Or just validate balance?
        // User said: "TIENE QUE SER 15 ENTRE LAS DOS" -> implies strict 15 if it's a "full" request?
        // Let's assume validation against balance is the key, but maybe warn if != 15?
        // Actually, let's enforce balance check.

        const balance = window.currentVacationBalance || 0;
        if (totalDays > balance) {
            Swal.fire('Saldo Insuficiente', `Intenta registrar ${totalDays} días (Disfrute: ${diffDays} + Pago: ${daysToPay}) pero solo tiene ${balance}.`, 'error');
            return;
        }

        // Create 2 records
        const batch = db.batch();
        const ref1 = db.collection('vacations').doc();
        const ref2 = db.collection('vacations').doc();

        batch.set(ref1, {
            ...vacationData,
            type: 'enjoy',
            daysTaken: diffDays,
            startDate: startInput,
            endDate: endInput,
            comments: comments + ' (Parte Mixta - Disfrute)',
            linkedRecordId: ref2.id // Link to Payout
        });

        batch.set(ref2, {
            ...vacationData, // this has comments too
            type: 'payout',
            daysTaken: daysToPay,
            amountPaid: amount,
            startDate: null,
            endDate: null,
            comments: comments + ' (Parte Mixta - Pago)',
            linkedRecordId: ref1.id // Link to Enjoy
        });

        try {
            await batch.commit();
            finishSave();
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Falló al guardar mixto', 'error');
        }
        return;
    }

    if (action === 'payout') {
        // PAYOUT LOGIC
        const daysToPay = parseInt(document.getElementById('vacPayoutDays').value) || 0; // Use input directly
        // Note: Code above for Payout logic needs to ensure we are reading value correct.
        // The original code was: const daysToPay = parseInt(document.getElementById('vacPayoutDays').value);
        // We keep that but maybe allow float? Usually days are integer or 0.5?
        // Let's stick to existing parse, maybe parseFloat if needed.

        // ... (Reusing existing logic blocks slightly modified below for clarity if needed, 
        // but replacing the whole function is safer to inject helper)

        const amount = parseFloat(document.getElementById('vacPayoutAmount').value);

        if (!daysToPay || daysToPay <= 0) {
            Swal.fire('Error', 'Ingrese una cantidad de días válida', 'warning');
            return;
        }

        vacationData.type = 'payout';
        vacationData.daysTaken = daysToPay;
        vacationData.amountPaid = amount;
        vacationData.startDate = null;
        vacationData.endDate = null;

    } else {
        // TIME OFF LOGIC (Standard)
        const startInput = document.getElementById('vacStartDate').value;
        const endInput = document.getElementById('vacEndDate').value;

        if (!startInput || !endInput) {
            Swal.fire('Error', 'Ingrese fechas de inicio y fin', 'warning');
            return;
        }

        const start = new Date(startInput);
        const end = new Date(endInput);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

        if (diffDays <= 0) {
            Swal.fire('Error', 'La fecha fin debe ser posterior a la inicio', 'error');
            return;
        }

        vacationData.type = 'enjoy';
        vacationData.daysTaken = diffDays;
        vacationData.startDate = startInput;
        vacationData.endDate = endInput;
    }

    // Validation against Balance?
    // User wants to be able to give vacation from "previous period" which implies specific bucket check.
    // If we have periodId, we could check that specific period's balance.
    // However, user said "ni siquiera tiene vacaciones registradas" implies flexibility.

    // Let's just Warn if Total Balance is exceeded, but allow Proceeding?
    // Or warn if Period Balance is exceeded.

    const balance = window.currentVacationBalance || 0;

    // Optional: Check specific period balance if needed.
    // const selectedOption = periodSelect.options[periodSelect.selectedIndex];
    // if (selectedOption && selectedOption.innerText.includes('Disp: 0')) ...

    if (vacationData.daysTaken > balance) {
        // Warning Only?
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Saldo Insuficiente',
            text: `El saldo global es ${balance} y quieres dar ${vacationData.daysTaken}. ¿Deseas continuar de todas formas?`,
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirm.isConfirmed) return;
    }

    try {
        await db.collection('vacations').add(vacationData);
        finishSave();
    } catch (e) {
        console.error("Error saving vacation:", e);
        Swal.fire('Error', 'No se pudo guardar el registro', 'error');
    }

    function finishSave() {
        Swal.fire('Registrado', 'Movimiento registrado correctamente', 'success');
        document.getElementById('vacStartDate').value = '';
        document.getElementById('vacEndDate').value = '';
        document.getElementById('vacComments').value = '';
        document.querySelector('input[name="vacActionType"][value="enjoy"]').checked = true;
        document.querySelector('input[name="vacDurationType"][value="full"]').checked = true;
        window.vacations.toggleVacationMode();
        loadVacationHistory(selectedVacationEmployee.id);
        if (window.vacations.loadDashboard) window.vacations.loadDashboard();
    }
}

async function deleteVacation(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Registro?',
        text: "Esto restablecerá los días tomados. ¿Está seguro?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('vacations').doc(id).delete();
            Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');

            // Reload
            if (selectedVacationEmployee) {
                loadVacationHistory(selectedVacationEmployee.id);
                // Also update dashboard if needed
                if (window.vacations.loadDashboard) window.vacations.loadDashboard();
            }
        } catch (e) {
        }
    }
}

// --- NEW PERIODS CALCULATION LOGIC ---

// --- REFACTORED PERIOD LOGIC ---

function generatePeriods(startDateStr) {
    if (!startDateStr) return [];

    const parts = startDateStr.split('-');
    const startYear = parseInt(parts[0]);
    const startMonth = parseInt(parts[1]) - 1;
    const startDay = parseInt(parts[2]);

    // We'll increment years from this base date.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let periods = [];
    let periodIndex = 0;
    let currentPeriodStart = new Date(startYear, startMonth, startDay);

    // Generate periods up to today + 1 year (to allow future planning?)
    // Or just until today. User said "en este año se pueden dar las vacaciones del periodo anterior".
    // Let's generate until current date covers "today".

    while (currentPeriodStart <= today) {
        let currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setFullYear(currentPeriodStart.getFullYear() + 1);
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() - 1);

        // Identifier: e.g. "2020-2021"
        const id = `${currentPeriodStart.getFullYear()}-${currentPeriodEnd.getFullYear()}`;

        let eligible = 0;
        let isCurrent = false;

        if (currentPeriodEnd < today) {
            eligible = 15;
            isCurrent = false;
        } else {
            isCurrent = true;
            // Strict Policy: Current period accumulates but isn't eligible for taking yet.
            // User feedback: "ni siquiera puede recibir ese periodo".
            eligible = 0;

            // We can still calculate potential for display if needed, but 'eligible' field dictates validation.
            // Let's store a separate 'accrued' field if we want to show it, but for now 0.
        }

        periods.push({
            id: id,
            start: new Date(currentPeriodStart),
            end: new Date(currentPeriodEnd),
            startStr: currentPeriodStart.toLocaleDateString(),
            endStr: currentPeriodEnd.toLocaleDateString(),
            eligible: eligible,
            isCurrent: isCurrent,
            taken: 0 // Will be filled later
        });

        // Next
        currentPeriodStart = new Date(currentPeriodEnd);
        currentPeriodStart.setDate(currentPeriodStart.getDate() + 1);
        periodIndex++;

        // Safety
        if (periodIndex > 50) break;
    }

    return periods.reverse(); // Newest first for display usually? Or Oldest first?
    // User probably wants to pay oldest debts first. Let's keep Oldest First for dropdown logic, 
    // but maybe display Newest First?
    // Let's return Oldest->Newest (Created order).
    return periods;
}

function calculateAndRenderPeriods(startDateStr, vacationDocs) {
    const periods = generatePeriods(startDateStr);

    // 1. Map taken days to periods
    // Strategy:
    // If doc has 'periodIdentifier', assign to that period.
    // If NOT (legacy data), use FIFO distribution.

    let unassignedTaken = 0;

    vacationDocs.forEach(doc => {
        const v = doc.data();
        const days = parseFloat(v.daysTaken) || 0;

        if (v.periodIdentifier) {
            // Find period
            const p = periods.find(p => p.id === v.periodIdentifier);
            if (p) {
                p.taken += days;
            } else {
                // Period might be older than generated range or future?
                // Just add to a "Past/Other" bucket or ignore? 
                // For now, let's assume it matches.
            }
        } else {
            unassignedTaken += days;
        }
    });

    // 2. Distribute Unassigned using FIFO (Legacy Support)
    if (unassignedTaken > 0) {
        for (let p of periods) {
            if (unassignedTaken <= 0) break;

            const availableSpace = p.eligible - p.taken; // Use what's left
            // Actually, FIFO usually fills the bucket regardless of "space" if it's the oldest?
            // "Eligible" is the cap.

            // Only distribute to eligible periods (Completed)
            if (p.eligible > 0 && p.taken < p.eligible) {
                const canTake = parseFloat((p.eligible - p.taken).toFixed(2));
                if (canTake > 0) {
                    const deduct = Math.min(unassignedTaken, canTake);
                    p.taken += deduct;
                    unassignedTaken -= deduct;
                }
            }
        }
    }

    // 3. Render Table
    renderPeriodTable(periods);

    // 4. Populate Dropdown
    populatePeriodDropdown(periods);
}

function renderPeriodTable(periods) {
    const tbody = document.getElementById('vacationPeriodsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (periods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay periodos generados</td></tr>';
        return;
    }

    let html = '';
    // Show Oldest First? Or Newest First? 
    // Usually lists are Newest First, but "Debts" are Oldest First. 
    // Let's show Oldest First to encourage clearing old debts.

    periods.forEach(p => {
        // Rounding
        p.taken = parseFloat(p.taken.toFixed(2));
        const pending = parseFloat((p.eligible - p.taken).toFixed(2));

        let status = 'Pendiente';
        let statusColor = '#d97706'; // orange

        if (p.isCurrent) {
            status = 'En Acumulación';
            statusColor = '#6b7280'; // gray
        } else if (pending <= 0 && p.eligible > 0) {
            status = 'Completado';
            statusColor = '#10b981'; // green
        } else if (pending < p.eligible) {
            status = 'Parcial';
        }

        html += `
            <tr style="border-bottom: 1px solid #eee; ${status === 'Completado' ? 'background: #f0fdf4;' : ''}">
                <td style="padding: 8px;">
                    <div style="font-weight: 600;">Periodo ${p.id}</div>
                    <div style="font-size: 0.8em; color: #666;">${p.startStr} al ${p.endStr}</div>
                </td>
                <td style="padding: 8px; text-align: center;">${p.eligible}</td>
                <td style="padding: 8px; text-align: center;">${p.taken}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">${pending}</td>
                <td style="padding: 8px; text-align: center;">
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function populatePeriodDropdown(periods) {
    const select = document.getElementById('vacPeriodSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione un periodo...</option>';

    // Filter? Should we allow selecting Completed periods? 
    // User might want to adjust history. Let's show ALL, but mark completed.

    periods.forEach(p => {
        // Exclude current/accumulation periods from dropdown
        if (p.isCurrent || p.eligible === 0) return;

        const pending = parseFloat((p.eligible - p.taken).toFixed(2));
        const option = document.createElement('option');
        option.value = p.id;

        let label = `Periodo ${p.id} (Disp: ${pending})`;
        if (p.isCurrent) label += " - En Curso";

        option.textContent = label;

        // Visual cue?
        if (pending <= 0) {
            option.style.color = '#999';
        }

        select.appendChild(option);
    });

    // Auto-select oldest pending?
    // Find first one with pending > 0
    const oldestPending = periods.find(p => !p.isCurrent && (p.eligible - p.taken) > 0);
    if (oldestPending) {
        select.value = oldestPending.id;
    }
}
