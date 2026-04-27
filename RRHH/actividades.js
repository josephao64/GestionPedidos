/* actividades.js - Daily Activity Report Logic for Logistics, RRHH, and Finance */

let dailyActivities = [];
let allowedDepartments = ['Logística', 'Recursos Humanos', 'Finanzas'];
let allowedNames = ['JOSEPH', 'KEVIN', 'LAURA', 'DIEGO'];

document.addEventListener('DOMContentLoaded', () => {
    const activityForm = document.getElementById('actividadForm');
    if (activityForm) {
        activityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveActivity();
        });
    }
});

async function initActividades() {
    await populateActivityBranches();
    loadActivities();
}

async function populateActivityBranches() {
    try {
        const branchSelects = ['activityFilterBranch', 'act_sucursalId'];
        const snapshot = await db.collection('sucursales').orderBy('name').get();
        const branches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(b => b.status && b.status.toLowerCase() === 'activo');

        branchSelects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            
            const currentValue = select.value;
            let html = id.includes('Filter') ? '<option value="all">Todas las Sucursales</option>' : '<option value="">Seleccione Sucursal...</option>';
            
            branches.forEach(b => {
                html += `<option value="${b.id}">${b.name}</option>`;
            });
            
            select.innerHTML = html;
            if (currentValue) select.value = currentValue;
        });
    } catch (e) {
        console.error("Error populating activity branches:", e);
    }
}

async function filterEmployeesByDept() {
    const sucursalId = document.getElementById('act_sucursalId').value;
    const employeeSelect = document.getElementById('act_employeeId');
    
    if (!sucursalId) {
        employeeSelect.innerHTML = '<option value="">Seleccione Sucursal primero...</option>';
        return;
    }

    employeeSelect.innerHTML = '<option value="">Cargando empleados...</option>';

    try {
        const employeesSnap = await db.collection('employees').where('sucursalId', '==', sucursalId).get();
        if (employeesSnap.empty) {
            employeeSelect.innerHTML = '<option value="">Sin empleados en esta sucursal</option>';
            return;
        }

        const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const positionsSnap = await db.collection('positions').get();
        const positionsMap = {};
        positionsSnap.forEach(doc => {
            positionsMap[doc.id] = doc.data().department;
        });

        const filtered = employees.filter(emp => {
            const nameUpper = emp.fullName.toUpperCase();
            return allowedNames.some(name => nameUpper.includes(name));
        }).sort((a, b) => a.fullName.localeCompare(b.fullName));

        if (filtered.length === 0) {
            employeeSelect.innerHTML = '<option value="">No se encontraron los empleados específicos aquí</option>';
            return;
        }

        const hardcodedDepts = {
            'JOSEPH': 'Logística',
            'KEVIN': 'Logística',
            'LAURA': 'Recursos Humanos',
            'DIEGO': 'Finanzas'
        };

        let html = '<option value="">Seleccione Empleado...</option>';
        filtered.forEach(emp => {
            const nameUpper = emp.fullName.toUpperCase();
            let dept = positionsMap[emp.positionId] || 'Otros';
            
            for (const key in hardcodedDepts) {
                if (nameUpper.includes(key)) {
                    dept = hardcodedDepts[key];
                    break;
                }
            }

            html += `<option value="${emp.id}" data-dept="${dept}" data-name="${emp.fullName}">${emp.fullName} (${dept})</option>`;
        });
        employeeSelect.innerHTML = html;

    } catch (e) {
        console.error("Error filtering employees:", e);
        employeeSelect.innerHTML = '<option value="">Error al cargar empleados</option>';
    }
}

async function saveActivity() {
    const employeeId = document.getElementById('act_employeeId').value;
    const sucursalId = document.getElementById('act_sucursalId').value;
    const description = document.getElementById('act_description').value.trim();
    const status = document.getElementById('act_status').value;
    const selectedArea = document.getElementById('act_area').value;
    const selectedEmpOption = document.getElementById('act_employeeId').selectedOptions[0];
    
    if (!employeeId || !sucursalId || !description) {
        Swal.fire('Campos requeridos', 'Por favor complete todos los campos correctamente.', 'warning');
        return;
    }

    const employeeName = selectedEmpOption.getAttribute('data-name');
    const date = new Date().toISOString().split('T')[0];

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

        const activityData = {
            employeeId,
            employeeName,
            sucursalId,
            department: selectedArea,
            description,
            status,
            date,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: localStorage.getItem('usuarioLogueado') || 'Sistema'
        };

        await db.collection('daily_activities').add(activityData);

        Swal.fire('Guardado', 'Actividad registrada exitosamente', 'success');
        closeActividadModal();
        document.getElementById('actividadForm').reset();
        loadActivities();

    } catch (e) {
        console.error("Error saving activity:", e);
        Swal.fire('Error', 'No se pudo guardar la actividad', 'error');
    }
}

async function loadActivities() {
    const tbody = document.getElementById('activitiesTableBody');
    const filterBranch = document.getElementById('activityFilterBranch').value;
    const filterDept = document.getElementById('activityFilterDept').value;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;"><div class="loading-spinner"></div> Cargando actividades...</td></tr>';

    try {
        const snapshot = await db.collection('daily_activities').get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No hay reportes registrados.</td></tr>';
            return;
        }

        let activitiesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        activitiesList.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        const branchesSnap = await db.collection('sucursales').get();
        const branchesMap = {};
        branchesSnap.forEach(d => branchesMap[d.id] = d.data().name);

        let html = '';
        let count = 0;
        
        activitiesList.forEach(data => {
            if (filterBranch !== 'all' && data.sucursalId !== filterBranch) return;
            if (filterDept !== 'all' && data.department !== filterDept) return;
            
            count++;
            const statusClass = data.status === 'Completado' ? 'badge-success' : (data.status === 'En Proceso' ? 'badge-info' : 'badge-orange');
            const sucursalName = branchesMap[data.sucursalId] || 'N/A';

            html += `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${data.employeeName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${sucursalName}</div>
                    </td>
                    <td><span class="badge badge-purple">${data.department}</span></td>
                    <td style="max-width: 300px; font-size: 0.9rem;">${data.description}</td>
                    <td style="text-align: center;"><span class="badge ${statusClass}">${data.status}</span></td>
                    <td style="text-align: center;">
                        <button class="btn btn-danger btn-sm" onclick="deleteActivity('${data.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No hay reportes que coincidan con los filtros.</td></tr>';
        } else {
            tbody.innerHTML = html;
        }

    } catch (e) {
        console.error("Error loading activities:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error al cargar datos de Firestore.</td></tr>';
    }
}

async function deleteActivity(id) {
    const result = await Swal.fire({
        title: '¿Eliminar registro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('daily_activities').doc(id).delete();
            Swal.fire('Eliminado', 'El registro ha sido borrado', 'success');
            loadActivities();
        } catch (e) {
            console.error("Error deleting activity:", e);
            Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
        }
    }
}

function onOpenActividadModal() {
    populateActivityBranches();
    document.getElementById('act_employeeId').innerHTML = '<option value="">Seleccione Sucursal primero...</option>';
}
