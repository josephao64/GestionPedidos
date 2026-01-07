// dashboard.js
let stackedBarChart = null;
let pieChart = null;
let dashboardUnsub = null;

async function initDashboard() {
    try {
        // Unsubscribe previous listener if exists (e.g. re-init)
        if (dashboardUnsub) {
            dashboardUnsub();
            dashboardUnsub = null;
        }

        // Show loading state
        const spinnerSmall = '<div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0 auto;"></div>';
        document.getElementById('kpi-total-active').innerHTML = spinnerSmall;
        document.getElementById('kpi-probation').innerHTML = spinnerSmall;
        document.getElementById('kpi-sucursales').innerHTML = spinnerSmall;
        // document.getElementById('kpi-positions').innerHTML = spinnerSmall; // This ID wasn't in the snippet but good practice if needed

        // Fetch static data (could be made real-time too if needed, but keeping simple)
        const positionsSnap = await db.collection('positions').get();
        const sucursalesSnap = await db.collection('sucursales').get();

        const sucursales = sucursalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const positions = positionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Populate Branch Filter if empty
        const branchFilter = document.getElementById('dashboardBranchFilter');
        if (branchFilter && branchFilter.options.length === 1) {
            sucursales.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                branchFilter.appendChild(opt);
            });
        }

        // Real-time listener for employees
        dashboardUnsub = db.collection('employees').onSnapshot((employeesSnap) => {
            const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            updateDashboardUI(employees, sucursales, positions, sucursalesSnap, positionsSnap);
        }, (error) => {
            console.error("Error in dashboard listener:", error);
        });

    } catch (error) {
        console.error("Error initializing dashboard:", error);
    }
}

function updateDashboardUI(employees, sucursales, positions, sucursalesSnap, positionsSnap) {
    const branchFilter = document.getElementById('dashboardBranchFilter');
    const selectedBranchId = branchFilter ? branchFilter.value : 'all';

    // Filter employees by branch if selected
    // STRICT FILTER: Exclude employees without a name (ghost records)
    let activeEmployees = employees.filter(e => e.status !== 'inactive' && e.fullName && e.fullName.trim() !== '');

    // PRE-PROCESSING: Determine Effective Branch (Physical/Quota Location)
    activeEmployees = activeEmployees.map(e => {
        const isTemp = e.isTempTransfer === true || e.isTempTransfer === 'true';
        const tempId = e.tempSucursalId ? String(e.tempSucursalId) : null;
        let effective = e.sucursalId;

        if (isTemp && tempId) {
            effective = tempId;
        }

        if (e.fullName.includes('Carlos')) {
            console.log(`[Dashboard Debug] ${e.fullName}: Temp=${isTemp}, TempID=${tempId}, Effective=${effective}`);
        }

        return {
            ...e,
            effectiveBranchId: effective
        };
    });

    if (selectedBranchId !== 'all') {
        activeEmployees = activeEmployees.filter(e => e.effectiveBranchId === selectedBranchId);
    }

    // Filter sucursales if branch selected
    const filteredSucursales = selectedBranchId === 'all' ? sucursales : sucursales.filter(s => s.id === selectedBranchId);

    // Calculate total quotas and deficit
    let totalQuotas = 0;
    let totalDeficit = 0;

    filteredSucursales.forEach(sucursal => {
        const quotas = sucursal.quotas || {};
        const branchEmployees = activeEmployees.filter(e => e.effectiveBranchId === sucursal.id);

        Object.values(quotas).forEach(quota => {
            totalQuotas += quota;
        });

        // Calculate deficit for this branch
        Object.entries(quotas).forEach(([positionId, quota]) => {
            const actualCount = branchEmployees.filter(e => e.positionId === positionId).length;
            const diff = quota - actualCount;
            if (diff > 0) {
                totalDeficit += diff;
            }
        });
    });

    // KPI: Total Active
    document.getElementById('kpi-total-active').textContent = activeEmployees.length;

    // KPI: Probation (< 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const probationCount = activeEmployees.filter(e => {
        if (!e.startDate) return false;
        const start = new Date(e.startDate);
        return start > sixtyDaysAgo;
    }).length;
    document.getElementById('kpi-probation').textContent = probationCount;

    // KPI: Sucursales count
    document.getElementById('kpi-sucursales').textContent = (selectedBranchId === 'all') ? sucursales.length : 1;

    // KPI: Total unique positions being used
    const uniquePositions = new Set(activeEmployees.map(e => e.positionId).filter(Boolean));
    document.getElementById('kpi-total-positions').textContent = uniquePositions.size;

    // KPI: Total Quotas
    document.getElementById('kpi-total-quotas').textContent = totalQuotas;

    // KPI: Deficit with dynamic styling
    const deficitCard = document.getElementById('kpi-deficit-card');
    const deficitElement = document.getElementById('kpi-deficit');
    deficitElement.textContent = totalDeficit;

    if (totalDeficit > 0) {
        deficitCard.style.borderLeftColor = 'var(--danger)';
        deficitElement.style.color = 'var(--danger)';
    } else {
        deficitCard.style.borderLeftColor = 'var(--success)';
        deficitElement.style.color = 'var(--success)';
    }

    renderCharts(activeEmployees, sucursalesSnap.docs, positionsSnap.docs, selectedBranchId);
    renderDetailedTables(activeEmployees, sucursales, positions, selectedBranchId);
}

function renderDetailedTables(activeEmployees, sucursales, positions, selectedBranchId) {
    // 1. Position Breakdown Table (Real vs Meta if branch selected)
    const posContainer = document.getElementById('position-breakdown-container');
    const branchQuotas = (selectedBranchId !== 'all') ? (sucursales.find(s => s.id === selectedBranchId)?.quotas || {}) : null;

    let posHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
                <tr style="text-align: left; border-bottom: 1px solid var(--border);">
                    <th style="padding: 8px;">Puesto</th>
                    <th style="padding: 8px; text-align: center;">Real</th>
                    ${branchQuotas ? '<th style="padding: 8px; text-align: center;">Meta (Plazas)</th>' : ''}
                    ${branchQuotas ? '<th style="padding: 8px; text-align: center;">Déficit/Superávit</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    positions.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
        const count = activeEmployees.filter(e => e.positionId === p.id).length;
        const quota = branchQuotas ? (branchQuotas[p.id] || 0) : 0;

        if (count > 0 || (branchQuotas && quota > 0)) {
            let statusColor = 'var(--text-main)';
            let diffText = '-';

            if (branchQuotas) {
                const diff = count - quota;
                if (diff < 0) {
                    statusColor = 'var(--danger)';
                    diffText = `<span style="color: var(--danger); font-weight: 700;">${diff}</span>`;
                } else if (diff > 0) {
                    statusColor = 'var(--info)';
                    diffText = `<span style="color: var(--info); font-weight: 700;">+${diff}</span>`;
                } else {
                    statusColor = 'var(--success)';
                    diffText = `<span style="color: var(--success); font-weight: 700;">OK</span>`;
                }
            }

            posHtml += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 8px;">${p.name}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 600; color: ${statusColor};">${count}</td>
                    ${branchQuotas ? `<td style="padding: 8px; text-align: center;">${quota}</td>` : ''}
                    ${branchQuotas ? `<td style="padding: 8px; text-align: center;">${diffText}</td>` : ''}
                </tr>
            `;
        }
    });
    posHtml += '</tbody></table>';
    posContainer.innerHTML = posHtml;

    // 2. Branch Breakdown Table (Only if all branches selected)
    const branchContainer = document.getElementById('branch-breakdown-container');
    if (selectedBranchId !== 'all') {
        const branch = sucursales.find(s => s.id === selectedBranchId);
        const quotas = branch?.quotas || {};
        const totalQuotas = Object.values(quotas).reduce((sum, q) => sum + q, 0);
        const deficit = totalQuotas - activeEmployees.length;
        const occupancyRate = totalQuotas > 0 ? ((activeEmployees.length / totalQuotas) * 100).toFixed(1) : 0;

        branchContainer.innerHTML = `
            <div style="padding: 20px;">
                <h4 style="color: var(--primary); margin-bottom: 15px; text-align: center;">${branch?.name}</h4>
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);">
                        <span style="color: var(--text-muted);">Empleados Actuales:</span>
                        <strong style="color: var(--primary);">${activeEmployees.length}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);">
                        <span style="color: var(--text-muted);">Plazas Definidas:</span>
                        <strong style="color: #ec4899;">${totalQuotas}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border);">
                        <span style="color: var(--text-muted);">Déficit/Superávit:</span>
                        <strong style="color: ${deficit > 0 ? 'var(--danger)' : deficit < 0 ? 'var(--info)' : 'var(--success)'};">
                            ${deficit > 0 ? '-' + deficit : deficit < 0 ? '+' + Math.abs(deficit) : 'Completo'}
                        </strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px;">
                        <span style="color: var(--text-muted);">Tasa de Ocupación:</span>
                        <strong style="color: var(--success);">${occupancyRate}%</strong>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const totalEmployees = activeEmployees.length;

    let branchHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
                <tr style="text-align: left; border-bottom: 1px solid var(--border);">
                    <th style="padding: 8px;">Sucursal</th>
                    <th style="padding: 8px; text-align: center;">Empleados</th>
                    <th style="padding: 8px; text-align: center;">Plazas</th>
                    <th style="padding: 8px; text-align: center;">Déficit</th>
                    <th style="padding: 8px; text-align: center;">% Ocupación</th>
                </tr>
            </thead>
            <tbody>
    `;

    sucursales.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
        const branchEmployees = activeEmployees.filter(e => e.effectiveBranchId === s.id);
        const employeeCount = branchEmployees.length;

        // Calculate quotas for this branch
        const quotas = s.quotas || {};
        const totalBranchQuotas = Object.values(quotas).reduce((sum, q) => sum + q, 0);
        const deficit = totalBranchQuotas - employeeCount;
        const occupancyRate = totalBranchQuotas > 0 ? ((employeeCount / totalBranchQuotas) * 100).toFixed(1) : 0;

        // Determine status color
        let statusColor = 'var(--text-muted)';
        let deficitText = 'N/A';

        if (totalBranchQuotas > 0) {
            if (deficit > 0) {
                statusColor = 'var(--danger)';
                deficitText = `-${deficit}`;
            } else if (deficit < 0) {
                statusColor = 'var(--info)';
                deficitText = `+${Math.abs(deficit)}`;
            } else {
                statusColor = 'var(--success)';
                deficitText = 'OK';
            }
        }

        branchHtml += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 8px; font-weight: 500;">${s.name}</td>
                <td style="padding: 8px; text-align: center; font-weight: 600; color: var(--primary);">${employeeCount}</td>
                <td style="padding: 8px; text-align: center; font-weight: 600; color: #ec4899;">${totalBranchQuotas || '-'}</td>
                <td style="padding: 8px; text-align: center; font-weight: 700; color: ${statusColor};">${deficitText}</td>
                <td style="padding: 8px; text-align: center;">
                    <span style="background: ${totalBranchQuotas > 0 ? 'var(--primary-light)' : '#f3f4f6'}; color: ${totalBranchQuotas > 0 ? 'var(--primary)' : 'var(--text-muted)'}; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">
                        ${totalBranchQuotas > 0 ? occupancyRate + '%' : '-'}
                    </span>
                </td>
            </tr>
        `;
    });
    branchHtml += '</tbody></table>';
    branchContainer.innerHTML = branchHtml;
}

function renderCharts(activeEmployees, sucursalDocs, positionDocs, selectedBranchId) {
    const sucursales = sucursalDocs.map(d => ({ id: d.id, name: d.data().name }));
    const positions = positionDocs.map(d => ({ id: d.id, name: d.data().name }));

    // 1. Pie/Doughnut Chart: Employees per Sucursal (or Position if branch selected)
    let chartLabels = [];
    let chartData = [];

    if (selectedBranchId === 'all') {
        chartLabels = sucursales.map(s => s.name);
        chartData = sucursales.map(s => activeEmployees.filter(e => e.effectiveBranchId === s.id).length);
    } else {
        // Show position breakdown for this branch
        const branchEmployees = activeEmployees.filter(e => e.effectiveBranchId === selectedBranchId);
        const branchPositions = new Set(branchEmployees.map(e => e.positionId).filter(Boolean));

        branchPositions.forEach(pId => {
            const pName = positions.find(p => p.id === pId)?.name || 'Desconocido';
            chartLabels.push(pName);
            chartData.push(branchEmployees.filter(e => e.positionId === pId).length);
        });
    }

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: [
                    '#6f42c1', '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
                    '#64748b', '#ec4899', '#8b5cf6', '#06b6d4'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: {
                    display: true,
                    text: selectedBranchId === 'all' ? 'Empleados por Sucursal' : 'Distribución por Puestos'
                }
            }
        }
    });

    // 2. Stacked Bar Chart: Branch vs Positions
    // Only show if "All" is selected, or if results are still relevant
    const barCtx = document.getElementById('stackedBarChart').getContext('2d');
    if (stackedBarChart) stackedBarChart.destroy();

    const chartSucursales = selectedBranchId === 'all' ? sucursales : sucursales.filter(s => s.id === selectedBranchId);

    const datasets = positions.map((p, idx) => {
        const data = chartSucursales.map(s => {
            return activeEmployees.filter(e => e.effectiveBranchId === s.id && e.positionId === p.id).length;
        });

        return {
            label: p.name,
            data: data,
            backgroundColor: getHslColor(idx, positions.length)
        };
    }).filter(ds => ds.data.some(v => v > 0)); // Only show positions that have employees

    stackedBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: chartSucursales.map(s => s.name),
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'bottom', display: datasets.length < 15 }
            }
        }
    });
}

function getHslColor(index, total) {
    const h = (index * (360 / total)) % 360;
    return `hsl(${h}, 70%, 60%)`;
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Only init if dashboard is active (or called from switch)
});
