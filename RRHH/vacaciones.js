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

                // Eligibility Rule: 15 days per completed year
                // Proportional is not usually granted, only completed years.
                const completedYears = Math.floor(yearsService);
                const totalEligible = completedYears * 15;
                const taken = vacMap[doc.id] || 0;
                const pending = totalEligible - taken;

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

        const durationContainer = document.getElementById('vacDurationTypeContainer');
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
        } else {
            // Enjoy
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

        const days = parseInt(document.getElementById('vacPayoutDays').value) || 0;
        // Use baseSalary or minimum wage if configured? Assuming baseSalary on employee record
        const salary = parseFloat(selectedVacationEmployee.baseSalary) || 0;
        const dailyVal = salary / 30;
        const total = dailyVal * days;

        const amountEl = document.getElementById('vacPayoutAmount');
        if (amountEl) amountEl.value = total.toFixed(2);
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

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #777;">Sin registros previos</td></tr>';
            return;
        }

        let totalDaysTaken = 0;
        snapshot.forEach(doc => {
            const v = doc.data();
            const days = parseInt(v.daysTaken) || 0;
            totalDaysTaken += days;

            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${v.period || '-'}</td>
                    <td style="padding: 8px;">${v.startDate || 'N/A'}</td>
                    <td style="padding: 8px;">${v.endDate || 'N/A'}</td>
                    <td style="padding: 8px;">
                        ${v.type === 'payout' ? '💰 ' : ''}${days} días
                    </td>
                    <td style="padding: 8px;">${v.comments || ''}</td>
                    <td style="padding: 8px; text-align: center;">
                        <button class="btn btn-danger btn-sm" onclick="deleteVacation('${doc.id}')" title="Eliminar Registro">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Update Balance Display
        updateVacationBalanceUI(totalDaysTaken);

    } catch (e) {
        console.error("Error history:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">Error al cargar historial</td></tr>';
    }
}
function updateVacationBalanceUI(daysTaken) {
    if (!selectedVacationEmployee || !selectedVacationEmployee.startDate) return;

    const startDate = new Date(selectedVacationEmployee.startDate);
    const today = new Date();
    const oneYear = 31536000000;
    const diff = today - startDate;
    const yearsService = diff / oneYear;

    // 15 days per year
    const accruedDays = Math.floor(yearsService * 15);
    const balance = accruedDays - daysTaken;

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

    const action = document.querySelector('input[name="vacActionType"]:checked').value;
    const comments = document.getElementById('vacComments').value;

    let vacationData = {
        employeeId: selectedVacationEmployee.id,
        employeeName: selectedVacationEmployee.fullName,
        period: new Date().getFullYear(),
        comments: comments,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (action === 'payout') {
        // PAYOUT LOGIC
        const daysToPay = parseInt(document.getElementById('vacPayoutDays').value);
        const amount = parseFloat(document.getElementById('vacPayoutAmount').value);

        if (!daysToPay || daysToPay <= 0) {
            Swal.fire('Error', 'Ingrese una cantidad de días válida', 'warning');
            return;
        }

        vacationData.type = 'payout';
        vacationData.daysTaken = daysToPay; // Deducts from balance just like taken days
        vacationData.amountPaid = amount;
        vacationData.startDate = null;
        vacationData.endDate = null;

    } else {
        // TIME OFF LOGIC
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

    // Validation against Balance
    const balance = window.currentVacationBalance || 0;
    if (vacationData.daysTaken > balance) {
        Swal.fire({
            icon: 'error',
            title: 'Saldo Insuficiente',
            text: `El empleado solo tiene ${balance} días disponibles. Intenta registrar ${vacationData.daysTaken}.`
        });
        return;
    }

    try {
        await db.collection('vacations').add(vacationData);
        Swal.fire('Registrado', 'Movimiento registrado correctamente', 'success');

        // Reset form
        document.getElementById('vacStartDate').value = '';
        document.getElementById('vacEndDate').value = '';
        document.getElementById('vacComments').value = '';
        // Reset defaults
        document.querySelector('input[name="vacActionType"][value="enjoy"]').checked = true;
        document.querySelector('input[name="vacDurationType"][value="full"]').checked = true;
        window.vacations.toggleVacationMode();

        // Reload history
        loadVacationHistory(selectedVacationEmployee.id);
        // Reload dashboard
        if (window.vacations.loadDashboard) window.vacations.loadDashboard();
    } catch (e) {
        console.error("Error saving vacation:", e);
        Swal.fire('Error', 'No se pudo guardar el registro', 'error');
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
            console.error("Error deleting vacation:", e);
            Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
        }
    }
}
