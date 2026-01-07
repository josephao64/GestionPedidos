// puestos.js
let currentId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPositions();

    document.getElementById('puestoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePosition();
    });
});

async function loadPositions() {
    try {
        const tbody = document.getElementById('positionsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>Cargando puestos...</p>
                    </div>
                </td>
            </tr>
        `;

        const snapshot = await db.collection('positions').orderBy('department').orderBy('name').get();
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay puestos registrados.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Dynamic Wage for Min Wage Type
            const isMinWage = data.salaryTypeId === 'min_wage';
            const config = window.rrhhConfig && window.rrhhConfig.get ? window.rrhhConfig.get() : {};
            const displaySalary = isMinWage && config.minWageMonthly
                ? parseFloat(config.minWageMonthly)
                : parseFloat(data.baseSalary);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.name}</strong></td>
                <td><span class="badge">${data.department}</span></td>
                <td>
                    Q${displaySalary.toFixed(2)}
                    <div style="font-size:0.75em; color:#666;">${data.salaryTypeName || 'Personalizado'}</div>
                </td>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="editPosition('${doc.id}', '${escapeHtml(data.name)}', '${data.department}', ${data.baseSalary}, '${data.salaryTypeId || ''}')" style="padding: 5px 10px; font-size: 12px;"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deletePosition('${doc.id}', '${escapeHtml(data.name)}')" style="padding: 5px 10px; font-size: 12px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading positions:", error);
        Swal.fire('Error', 'Error al cargar los puestos: ' + error.message, 'error');
    }
}


// Helper to load salary types for the modal
async function loadSalaryTypesForModal(selectedId = null) {
    const select = document.getElementById('puestoSalaryTypeId');
    if (!select) return;

    select.innerHTML = '<option value="">Cargando...</option>';
    try {
        const snap = await db.collection('salary_types').orderBy('createdAt', 'desc').get();
        let html = '<option value="">Seleccione...</option>';

        // Predefined Min Wage
        const config = window.rrhhConfig.get ? window.rrhhConfig.get() : { minWageMonthly: 0 };
        const minWageVal = parseFloat(config.minWageMonthly || 0);
        const minSelected = (selectedId === 'min_wage') ? 'selected' : '';

        html += `<option value="min_wage" data-monthly="${minWageVal}" ${minSelected}>
                    Salario Mínimo y Jornada Laboral (Q${minWageVal.toFixed(2)})
                 </option>`;

        snap.forEach(doc => {
            const data = doc.data();
            const selected = (selectedId === doc.id) ? 'selected' : '';
            html += `<option value="${doc.id}" data-monthly="${data.monthlyValue}" ${selected}>
                        ${data.name} (Q${parseFloat(data.monthlyValue).toFixed(2)})
                     </option>`;
        });
        select.innerHTML = html;
    } catch (e) {
        console.error("Error loading types:", e);
        select.innerHTML = '<option value="">Error</option>';
    }
}

async function savePosition() {
    const name = document.getElementById('nombre').value.trim();
    const dept = document.getElementById('departamento').value;
    const salarySelect = document.getElementById('puestoSalaryTypeId');
    const salaryTypeId = salarySelect.value;

    if (!name || !dept || !salaryTypeId) {
        Swal.fire('Atención', 'Todos los campos son obligatorios', 'warning');
        return;
    }

    const selectedOption = salarySelect.options[salarySelect.selectedIndex];
    const baseSalarySnapshot = parseFloat(selectedOption.getAttribute('data-monthly')) || 0;
    const salaryTypeName = selectedOption.text.split(' (')[0];

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

        const data = {
            name: name,
            department: dept,
            salaryTypeId: salaryTypeId,
            salaryTypeName: salaryTypeName,
            baseSalary: baseSalarySnapshot, // Snapshot for calculation
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentId) {
            await db.collection('positions').doc(currentId).update(data);
            Swal.fire('Actualizado', 'Puesto actualizado correctamente', 'success');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('positions').add(data);
            Swal.fire('Creado', 'Puesto creado correctamente', 'success');
        }

        closeModal();
        loadPositions();

    } catch (error) {
        console.error("Error saving position:", error);
        Swal.fire('Error', 'No se pudo guardar: ' + error.message, 'error');
    }
}



async function deletePosition(id, name) {
    const result = await Swal.fire({
        title: '¿Eliminar Puesto?',
        text: `Se eliminará el puesto "${name}". Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('positions').doc(id).delete();
            Swal.fire('Eliminado', 'El puesto ha sido eliminado.', 'success');
            loadPositions();
        } catch (error) {
            Swal.fire('Error', 'Error al eliminar: ' + error.message, 'error');
        }
    }
}

function openModal() {
    currentId = null;
    document.getElementById('puestoForm').reset();
    document.getElementById('puestoId').value = '';
    document.getElementById('modalTitle').textContent = 'Nuevo Puesto';

    // Load fresh types
    loadSalaryTypesForModal();

    document.getElementById('puestoModal').style.display = 'flex';
}

function editPosition(id, name, dept, salary, salaryTypeId) {
    currentId = id;
    document.getElementById('puestoId').value = id;
    document.getElementById('nombre').value = name;
    document.getElementById('departamento').value = dept;

    document.getElementById('modalTitle').textContent = 'Editar Puesto';

    // Load types and select current
    loadSalaryTypesForModal(salaryTypeId);

    document.getElementById('puestoModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('puestoModal').style.display = 'none';
}

// Close modal if clicked outside
window.onclick = function (event) {
    const modal = document.getElementById('puestoModal');
    if (event.target == modal) {
        closeModal();
    }
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
