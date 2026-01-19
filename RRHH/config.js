// config.js

// Default settings
const DEFAULT_SETTINGS = {
    probationDays: 60,
    probationSalary: 3000,
    minWageDaily: 0,
    minWageMonthly: 0,
    minWageHourly: 0,
    iggsPercentage: 4.83,
    bonus: 250.00,
    pedidosSalary: 1250.00,
    pedidosBonus: 250.00,
    pedidosOvertime: 0,
    probationOvertimeRate: 0 // New field
};

// Current cached settings
let currentSettings = { ...DEFAULT_SETTINGS };
let cachedBranchHiringParams = {}; // Map: branchId -> { probationDays, probationSalary, ... }

/**
 * Load settings from Firestore
 */
async function loadSettings() {
    try {
        const doc = await db.collection('settings').doc('rrhh').get();
        if (doc.exists) {
            currentSettings = { ...DEFAULT_SETTINGS, ...doc.data() };
        } else {
            // First time, save defaults
            await db.collection('settings').doc('rrhh').set(DEFAULT_SETTINGS);
        }

        // Populate Main Inputs (Default)
        requestAnimationFrame(() => {
            updateConfigInputs(currentSettings);
            populateConfigBranches();
        });

        console.log("Settings loaded:", currentSettings);
        return currentSettings;
    } catch (error) {
        console.error("Error loading settings:", error);
        return DEFAULT_SETTINGS;
    }
}

async function populateConfigBranches() {
    const select = document.getElementById('configBranchSelect');
    if (!select) return;

    // Reset keeping default
    select.innerHTML = '<option value="default">Configuración General (Default)</option>';

    try {
        const snap = await db.collection('sucursales').orderBy('name').get();
        snap.forEach(doc => {
            const data = doc.data();
            // Case insensitive check for status
            if (data.status && data.status.toLowerCase() === 'activo') {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = data.name;
                select.appendChild(opt);

                // Cache Params if they exist
                if (data.hiringParams) {
                    cachedBranchHiringParams[doc.id] = data.hiringParams;
                }
            }
        });

        // Add Listener
        select.addEventListener('change', () => {
            const val = select.value;
            if (val === 'default') {
                updateConfigInputs(currentSettings);
            } else {
                // Load specific or empty (fallback to default usually?? No, explicit config)
                const params = cachedBranchHiringParams[val] || {};

                // We only update Hiring Params inputs. Others (Wage, IGSS) remain global for now.
                const daysInput = document.getElementById('configProbationDays');
                const salaryInput = document.getElementById('configProbationSalary');

                if (daysInput) daysInput.value = params.probationDays || ''; // Empty means not set
                if (salaryInput) salaryInput.value = params.probationSalary || '';

                const probOvertimeInput = document.getElementById('configProbationOvertimeRate');
                if (probOvertimeInput) probOvertimeInput.value = params.probationOvertimeRate || '';

                const pedSalaryInput = document.getElementById('configPedidosSalary');
                if (pedSalaryInput) pedSalaryInput.value = params.pedidosSalary || '';

                const pedBonusInput = document.getElementById('configPedidosBonus');
                if (pedBonusInput) pedBonusInput.value = params.pedidosBonus || '';

                const pedOvertimeInput = document.getElementById('configPedidosOvertime');
                if (pedOvertimeInput) pedOvertimeInput.value = params.pedidosOvertime || '';

                // Leave other global inputs touched or read-only? 
                // For simplicity, we just update these.
            }
        });

    } catch (e) {
        console.error("Error loading config branches:", e);
    }
}

function updateConfigInputs(settings) {
    const daysInput = document.getElementById('configProbationDays');
    const salaryInput = document.getElementById('configProbationSalary');
    const probOvertimeInput = document.getElementById('configProbationOvertimeRate');
    const pedSalaryInput = document.getElementById('configPedidosSalary');
    const pedBonusInput = document.getElementById('configPedidosBonus');
    const pedOvertimeInput = document.getElementById('configPedidosOvertime');

    const minDailyInput = document.getElementById('configMinWageDaily');
    const igssInput = document.getElementById('configIgss');
    const bonusInput = document.getElementById('configBonus');

    if (daysInput) daysInput.value = settings.probationDays;
    if (salaryInput) salaryInput.value = settings.probationSalary;
    if (probOvertimeInput) probOvertimeInput.value = settings.probationOvertimeRate || 0;
    if (pedSalaryInput) pedSalaryInput.value = settings.pedidosSalary || 1250;
    if (pedBonusInput) pedBonusInput.value = settings.pedidosBonus !== undefined ? settings.pedidosBonus : 250;
    if (pedOvertimeInput) pedOvertimeInput.value = settings.pedidosOvertime || 0;

    if (minDailyInput) {
        minDailyInput.value = settings.minWageDaily || 0;
    }
    const minMonthlyInput = document.getElementById('configMinWageMonthly');
    if (minMonthlyInput) {
        minMonthlyInput.value = settings.minWageMonthly || 0;
    }
    const minHourlyInput = document.getElementById('configMinWageHourly');
    if (minHourlyInput) {
        minHourlyInput.value = settings.minWageHourly || 0;
    }
    const overtimeRateInput = document.getElementById('configOvertimeRate');
    if (overtimeRateInput) {
        overtimeRateInput.value = settings.overtimeRate || '';
    }

    if (igssInput) igssInput.value = settings.iggsPercentage;
    if (bonusInput) bonusInput.value = settings.bonus;
}

/**
 * Save settings from form
 */
async function saveSettings() {
    const daysInput = document.getElementById('configProbationDays');
    const salaryInput = document.getElementById('configProbationSalary');
    const probOvertimeInput = document.getElementById('configProbationOvertimeRate');
    const minDailyInput = document.getElementById('configMinWageDaily');
    const minMonthlyInput = document.getElementById('configMinWageMonthly');
    const minHourlyInput = document.getElementById('configMinWageHourly');

    // NEW Overtime Rate
    const overtimeInput = document.getElementById('configOvertimeRate');

    // Pedidos Flash inputs
    const pedSalaryInput = document.getElementById('configPedidosSalary');
    const pedBonusInput = document.getElementById('configPedidosBonus');
    const pedOvertimeInput = document.getElementById('configPedidosOvertime');

    const igssInput = document.getElementById('configIgss');
    const bonusInput = document.getElementById('configBonus');

    const selectedBranch = document.getElementById('configBranchSelect').value;
    const isGlobal = (selectedBranch === 'default');

    // Values
    const daysVal = parseInt(daysInput.value) || 0;
    const salaryVal = parseFloat(salaryInput.value) || 0;
    const probOvertimeVal = parseFloat(probOvertimeInput ? probOvertimeInput.value : 0);

    // Pedidos Flash Values
    const pedSalaryVal = parseFloat(pedSalaryInput ? pedSalaryInput.value : 0);
    const pedBonusVal = parseFloat(pedBonusInput ? pedBonusInput.value : 0);
    const pedOvertimeVal = parseFloat(pedOvertimeInput ? pedOvertimeInput.value : 0);

    // Global Specifics
    const daily = parseFloat(minDailyInput.value) || 0;
    const monthly = parseFloat(minMonthlyInput.value) || 0;
    const hourly = parseFloat(minHourlyInput.value) || 0;

    const overtimeRate = parseFloat(overtimeInput ? overtimeInput.value : 0);

    const igssVal = parseFloat(igssInput.value) || 0;
    const bonusVal = parseFloat(bonusInput.value) || 0;

    if (isGlobal) {
        // GLOBAL SAVE
        const newSettings = {
            probationDays: daysVal,
            probationSalary: salaryVal,
            probationOvertimeRate: probOvertimeVal,
            minWageDaily: daily,
            minWageMonthly: monthly,
            minWageHourly: hourly,

            overtimeRate: overtimeRate, // NEW

            iggsPercentage: igssVal,
            bonus: bonusVal,

            pedidosSalary: pedSalaryVal,
            pedidosBonus: pedBonusVal,
            pedidosOvertime: pedOvertimeVal,

            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('settings').doc('rrhh').set(newSettings, { merge: true });
            currentSettings = { ...currentSettings, ...newSettings };
            Swal.fire({
                icon: 'success',
                title: 'Configuración General Guardada',
                timer: 2000
            });
        } catch (error) {
            console.error("Error saving global settings:", error);
            Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
        }

    } else {
        // SAVE BRANCH SPECIFIC
        // Only Hiring Params + Pedidos Params
        const daysVal = parseInt(daysInput.value);
        const salaryVal = parseFloat(salaryInput.value);

        const pedSalaryVal = parseFloat(pedSalaryInput.value);
        const pedBonusVal = parseFloat(pedBonusInput.value);
        const pedOvertimeVal = parseFloat(pedOvertimeInput.value);

        const hiringParams = {};
        if (!isNaN(daysVal)) hiringParams.probationDays = daysVal;
        if (!isNaN(daysVal)) hiringParams.probationDays = daysVal;
        if (!isNaN(salaryVal)) hiringParams.probationSalary = salaryVal;
        if (!isNaN(probOvertimeVal)) hiringParams.probationOvertimeRate = probOvertimeVal;

        if (!isNaN(pedSalaryVal)) hiringParams.pedidosSalary = pedSalaryVal;
        if (!isNaN(pedBonusVal)) hiringParams.pedidosBonus = pedBonusVal;
        if (!isNaN(pedOvertimeVal)) hiringParams.pedidosOvertime = pedOvertimeVal;

        try {
            await db.collection('sucursales').doc(selectedBranch).set({
                hiringParams: hiringParams
            }, { merge: true });

            // Update Cache
            cachedBranchHiringParams[selectedBranch] = hiringParams;

            Swal.fire({
                icon: 'success',
                title: 'Parámetros de Sucursal Guardados',
                text: 'Se han actualizado los valores para la sucursal seleccionada.',
                timer: 2000
            });

        } catch (error) {
            console.error("Error saving branch settings:", error);
            Swal.fire('Error', 'No se pudo guardar la configuración de sucursal.', 'error');
        }
    }
}


function calculateWageFields() {
    // FROM DAILY
    const dailyInput = document.getElementById('configMinWageDaily');
    const monthlyInput = document.getElementById('configMinWageMonthly');
    const hourlyInput = document.getElementById('configMinWageHourly');

    if (!dailyInput || !monthlyInput || !hourlyInput) return;

    const daily = parseFloat(dailyInput.value) || 0;

    // Logic: 365 days / 12 months
    const monthly = (daily * 365) / 12;
    // Logic: 8 hours
    const hourly = daily / 8;

    monthlyInput.value = monthly.toFixed(2);
    hourlyInput.value = hourly.toFixed(2);
}

function calculateFromMonthly() {
    const dailyInput = document.getElementById('configMinWageDaily');
    const monthlyInput = document.getElementById('configMinWageMonthly');
    const hourlyInput = document.getElementById('configMinWageHourly');

    if (!dailyInput || !monthlyInput || !hourlyInput) return;

    const monthly = parseFloat(monthlyInput.value) || 0;

    // Reverse: Daily = (Monthly * 12) / 365
    const daily = (monthly * 12) / 365;
    const hourly = daily / 8;

    dailyInput.value = daily.toFixed(2);
    hourlyInput.value = hourly.toFixed(2);
}

function calculateFromHourly() {
    const dailyInput = document.getElementById('configMinWageDaily');
    const monthlyInput = document.getElementById('configMinWageMonthly');
    const hourlyInput = document.getElementById('configMinWageHourly');

    if (!dailyInput || !monthlyInput || !hourlyInput) return;

    const hourly = parseFloat(hourlyInput.value) || 0;

    // Reverse: Daily = Hourly * 8
    const daily = hourly * 8;
    const monthly = (daily * 365) / 12;

    dailyInput.value = daily.toFixed(2);
    monthlyInput.value = monthly.toFixed(2);
}

/**
 * Get current settings with branch override
 */
function getSettings() {
    return currentSettings;
}

function getBranchSettings(branchId) {
    if (branchId && cachedBranchHiringParams[branchId]) {
        // Merge ALL branch params over global defaults
        return {
            ...currentSettings,
            ...cachedBranchHiringParams[branchId]
        };
    }
    return currentSettings;
}

// Expose globally
window.rrhhConfig = {
    load: loadSettings,
    save: saveSettings,
    get: getSettings,
    getBranchSettings: getBranchSettings
};

// Make calc functions global for oninput
window.calculateWageFields = calculateWageFields;
window.calculateFromMonthly = calculateFromMonthly;
window.calculateFromHourly = calculateFromHourly;
