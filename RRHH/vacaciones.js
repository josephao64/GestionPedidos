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
window.printVacationReceipt = function (docId) {
    if (!window.currentVacationDocs) return;
    const doc = window.currentVacationDocs.find(d => d.id === docId);
    if (!doc) return;
    const v = doc.data();

    document.getElementById('receiptEmployeeName').innerText = selectedVacationEmployee.fullName;
    document.getElementById('receiptPrintDate').innerText = new Date().toLocaleDateString();
    document.getElementById('receiptPosition').innerText = selectedVacationEmployee.puesto || '-';
    // Department might need to be fetched or stored, using general for now
    document.getElementById('receiptDept').innerText = 'General';

    document.getElementById('receiptPeriod').innerText = v.periodIdentifier || 'N/A';
    document.getElementById('receiptType').innerText = v.type === 'enjoy' ? 'Tiempo (Disfrute)' : (v.type === 'payout' ? 'Pago en Efectivo' : 'Mixto');
    document.getElementById('receiptDays').innerText = v.daysTaken;

    let datesStr = '';
    if (v.startDate) datesStr = `${v.startDate} al ${v.endDate}`;
    else datesStr = 'N/A (Pago Directo)';

    document.getElementById('receiptDates').innerText = datesStr;
    document.getElementById('receiptAmount').innerText = v.amountPaid ? `Q${v.amountPaid}` : '-';
    document.getElementById('receiptComments').innerText = v.comments || '';

    // Print Logic
    const printContent = document.getElementById('vacationReceiptTemplate').innerHTML;
    const win = window.open('', '', 'height=700,width=800');
    win.document.write('<html><head><title>Comprobante de Vacaciones</title>');
    win.document.write('</head><body >');
    win.document.write(printContent);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
};

window.editVacation = function (docId) {
    Swal.fire('Editar', 'Funcionalidad de edición básica: Se eliminará el registro actual y se cargarán los datos en el formulario para que lo guardes de nuevo como corrección.', 'info');

    if (!window.currentVacationDocs) return;
    const doc = window.currentVacationDocs.find(d => d.id === docId);
    if (!doc) return;
    const v = doc.data();

    // 1. Fill Form
    document.getElementById('vacComments').value = v.comments || '';

    // Period
    const periodSelect = document.getElementById('vacPeriodSelect');
    if (periodSelect && v.periodIdentifier) periodSelect.value = v.periodIdentifier;

    // Action Type
    if (v.type === 'payout') {
        document.querySelector('input[name="vacActionType"][value="payout"]').checked = true;
        window.vacations.toggleVacationMode();
        document.getElementById('vacPayoutDays').value = v.daysTaken;
        document.getElementById('vacPayoutAmount').value = v.amountPaid || '';
    } else {
        // Enjoy or Mixed (Mixed splits into 2 records, so if we edit one, it's just one part)
        document.querySelector('input[name="vacActionType"][value="enjoy"]').checked = true;
        window.vacations.toggleVacationMode();
        document.getElementById('vacStartDate').value = v.startDate;
        document.getElementById('vacEndDate').value = v.endDate;
    }

    // 2. Delete original? Or keep until save?
    // It's safer to delete ONLY when user confirms "Update". 
    // But since I don't have a robust "Update" mode implemented in saveVacationGrant yet (it does .add()),
    // The "Simple Edit" pattern is: Load Data -> User Modifies -> User Clicks Save (Creates New) -> We Delete Old.
    // To do this strictly, we need to know we are "updating".

    // Let's set a global flag
    window.vacationEditingId = doc.id;

    // Change Button Text (Visual only, logic needs to handle it)
    const btn = document.getElementById('btnGrantVacation');
    if (btn) {
        btn.innerText = 'Actualizar Registro';
        btn.onclick = async function () {
            // Delete old first, then save new
            await db.collection('vacations').doc(docId).delete();
            // Call original save logic
            await window.vacations.saveVacationGrant();
            // Reset button
            btn.innerText = 'Registrar Vacaciones';
            btn.onclick = window.vacations.saveVacationGrant; // Restore original handler
            window.vacationEditingId = null;
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
            comments: comments + ' (Parte Mixta - Disfrute)'
        });

        batch.set(ref2, {
            ...vacationData, // this has comments too
            type: 'payout',
            daysTaken: daysToPay,
            amountPaid: amount,
            startDate: null,
            endDate: null,
            comments: comments + ' (Parte Mixta - Pago)'
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
