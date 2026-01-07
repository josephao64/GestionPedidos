// config.js

// Default settings
const DEFAULT_SETTINGS = {
    probationDays: 60,
    probationSalary: 3000,
    minWageDaily: 0,
    minWageMonthly: 0,
    minWageHourly: 0,
    iggsPercentage: 4.83,
    bonus: 250.00
};

// Current cached settings
let currentSettings = { ...DEFAULT_SETTINGS };

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

        // Populate inputs if they exist on the page
        const daysInput = document.getElementById('configProbationDays');
        const salaryInput = document.getElementById('configProbationSalary');

        const minDailyInput = document.getElementById('configMinWageDaily');
        const minMonthlyInput = document.getElementById('configMinWageMonthly');
        const minHourlyInput = document.getElementById('configMinWageHourly');
        const igssInput = document.getElementById('configIgss');
        const bonusInput = document.getElementById('configBonus');

        if (daysInput) daysInput.value = currentSettings.probationDays;
        if (salaryInput) salaryInput.value = currentSettings.probationSalary;

        if (minDailyInput) {
            minDailyInput.value = currentSettings.minWageDaily;
            // Trigger calculation to fill others or fill manually
            calculateWageFields();
        }

        if (igssInput) igssInput.value = currentSettings.iggsPercentage;
        if (bonusInput) bonusInput.value = currentSettings.bonus;

        console.log("Settings loaded:", currentSettings);
        return currentSettings;
    } catch (error) {
        console.error("Error loading settings:", error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save settings from form
 */
async function saveSettings() {
    const daysInput = document.getElementById('configProbationDays');
    const salaryInput = document.getElementById('configProbationSalary');
    const minDailyInput = document.getElementById('configMinWageDaily');
    const igssInput = document.getElementById('configIgss');
    const bonusInput = document.getElementById('configBonus');

    if (!daysInput || !salaryInput) return;

    // Read values directly from inputs (don't force recalculation to respect user entry)
    const daily = parseFloat(minDailyInput.value) || 0;
    const monthly = parseFloat(document.getElementById('configMinWageMonthly').value) || 0;
    const hourly = parseFloat(document.getElementById('configMinWageHourly').value) || 0;

    const newSettings = {
        probationDays: parseInt(daysInput.value) || 60,
        probationSalary: parseFloat(salaryInput.value) || 0,
        minWageDaily: daily,
        minWageMonthly: monthly,
        minWageHourly: hourly,
        iggsPercentage: parseFloat(igssInput ? igssInput.value : 4.83),
        bonus: parseFloat(bonusInput ? bonusInput.value : 250),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('settings').doc('rrhh').set(newSettings, { merge: true });
        currentSettings = { ...currentSettings, ...newSettings };
        Swal.fire({
            icon: 'success',
            title: 'Configuración Guardada',
            text: 'Los parámetros han sido actualizados.',
            timer: 2000
        });

        // Update display with formatted values
        if (document.getElementById('configMinWageMonthly')) document.getElementById('configMinWageMonthly').value = newSettings.minWageMonthly;
        if (document.getElementById('configMinWageHourly')) document.getElementById('configMinWageHourly').value = newSettings.minWageHourly;

    } catch (error) {
        console.error("Error saving settings:", error);
        Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
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
 * Get current cached settings
 */
function getSettings() {
    return currentSettings;
}

// Expose globally
window.rrhhConfig = {
    load: loadSettings,
    save: saveSettings,
    get: getSettings
};

// Make calc functions global for oninput
window.calculateWageFields = calculateWageFields;
window.calculateFromMonthly = calculateFromMonthly;
window.calculateFromHourly = calculateFromHourly;
