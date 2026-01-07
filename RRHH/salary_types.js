// salary_types.js

const salaryTypes = {
    currentId: null,

    init: function () {
        this.loadList();
    },

    loadList: async function () {
        const tbody = document.getElementById('salaryTypesBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';

        try {
            const snap = await db.collection('salary_types').orderBy('createdAt', 'desc').get();
            tbody.innerHTML = '';

            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay tipos de salario definidos.</td></tr>';
                return;
            }

            snap.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px;">${data.name}</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(data.monthlyValue).toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(data.dailyValue).toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(data.hourlyValue || 0).toFixed(2)}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button class="btn btn-danger btn-sm" onclick="window.salaryTypes.delete('${doc.id}', '${data.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (e) {
            console.error("Error loading salary types:", e);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar.</td></tr>';
        }
    },

    openModal: function () {
        this.currentId = null;
        document.getElementById('salaryTypeId').value = '';
        document.getElementById('salaryTypeName').value = '';
        document.getElementById('salaryTypeMonthly').value = '';
        document.getElementById('salaryTypeDaily').value = '';
        document.getElementById('salaryTypeHourly').value = '';

        const modal = document.getElementById('salaryTypeModal');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    },

    closeModal: function () {
        document.getElementById('salaryTypeModal').style.display = 'none';
    },

    calculateDaily: function (val) {
        const monthly = parseFloat(val) || 0;
        const daily = (monthly * 12) / 365;
        const hourly = daily / 8;

        document.getElementById('salaryTypeDaily').value = daily.toFixed(2);
        document.getElementById('salaryTypeHourly').value = hourly.toFixed(2);
    },

    save: async function () {
        const name = document.getElementById('salaryTypeName').value.trim();
        const monthly = parseFloat(document.getElementById('salaryTypeMonthly').value);
        const daily = parseFloat(document.getElementById('salaryTypeDaily').value);
        const hourly = parseFloat(document.getElementById('salaryTypeHourly').value);

        if (!name || isNaN(monthly)) {
            Swal.fire('Error', 'Complete los campos correctamente.', 'warning');
            return;
        }

        try {
            const data = {
                name,
                monthlyValue: monthly,
                dailyValue: daily,
                hourlyValue: hourly,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('salary_types').add(data);
            Swal.fire('Guardado', 'Tipo de salario agregado.', 'success');
            this.closeModal();
            this.loadList();

            // Reload dropdowns if they exist (in Empleados modal)
            if (window.loadSalaryTypesDropdown) window.loadSalaryTypesDropdown();

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo guardar.', 'error');
        }
    },

    delete: async function (id, name) {
        const res = await Swal.fire({
            title: '¿Eliminar?',
            text: `Se eliminará "${name}"`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar'
        });

        if (res.isConfirmed) {
            await db.collection('salary_types').doc(id).delete();
            this.loadList();
            if (window.loadSalaryTypesDropdown) window.loadSalaryTypesDropdown();
        }
    }
};

window.salaryTypes = salaryTypes;

// Auto-init if on config page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('salaryTypesBody')) {
        salaryTypes.init();
    }
});
