// descansos.js

window.descansos = {
    currentView: 'calendar',
    currentMonth: new Date(),
    
    empleados: [],
    sucursales: [],
    registros: [], // { id, empleadoId, fecha: 'YYYY-MM-DD' }
    
    coverageLimitPercent: 20,

    async init() {
        console.log("Inicializando módulo de descansos...");
        
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const inputMes = document.getElementById('filterDescansoMes');
        if (inputMes) inputMes.value = monthStr;
        
        await this.loadInitialData();
        this.render();
    },

    async loadInitialData() {
        try {
            const branchesSnap = await db.collection('sucursales').orderBy('name').get();
            this.sucursales = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const branchFilter = document.getElementById('filterDescansoSucursal');
            if (branchFilter) {
                branchFilter.innerHTML = '<option value="all">Todas</option>';
                this.sucursales.forEach(b => {
                    if (b.status !== 'inactivo') {
                        branchFilter.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                    }
                });
            }

            const empSnap = await db.collection('employees').get();
            this.empleados = empSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(emp => emp.status !== 'inactive');

            const descSnap = await db.collection('descansos').get();
            this.registros = descSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        } catch (e) {
            console.error("Error loading descansos data:", e);
            // Default to empty array on error for offline testing
            this.sucursales = this.sucursales || [];
            this.empleados = this.empleados || [];
            this.registros = this.registros || [];
        }
    },

    loadData() {
        const inputMes = document.getElementById('filterDescansoMes');
        if (inputMes && inputMes.value) {
            const [year, month] = inputMes.value.split('-');
            this.currentMonth = new Date(year, month - 1, 1);
        }
        this.render();
    },

    getFilteredEmployees() {
        const sucursalId = document.getElementById('filterDescansoSucursal')?.value;
        const regla = document.getElementById('filterDescansoRegla')?.value;

        return this.empleados.filter(emp => {
            if (sucursalId && sucursalId !== 'all' && emp.sucursalId !== sucursalId) return false;
            const empRule = emp.tipo_descanso || 'none'; 
            if (regla && regla !== 'all' && empRule !== regla) return false;
            return true;
        });
    },

    render() {
        this.renderCalendar();
        this.renderSideList();
        this.checkCoverageLimits();
    },

    toggleView() {
        this.currentView = this.currentView === 'calendar' ? 'list' : 'calendar';
        this.render();
    },

    getEmployeeIdsForBranchFilter() {
        const sucursalId = document.getElementById('filterDescansoSucursal')?.value;
        if (!sucursalId || sucursalId === 'all') return null; // all employees
        return this.empleados.filter(e => e.sucursalId === sucursalId).map(e => e.id);
    },

    renderSideList() {
        const listDiv = document.getElementById('descansos-side-list');
        if (!listDiv) return;

        let filteredEmployees = this.getFilteredEmployees();
        
        const searchInput = document.getElementById('filterDescansoNombre')?.value.toLowerCase();
        if (searchInput) {
            filteredEmployees = filteredEmployees.filter(e => e.fullName.toLowerCase().includes(searchInput));
        }

        filteredEmployees.sort((a,b) => a.fullName.localeCompare(b.fullName));

        if (filteredEmployees.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9em; padding:20px;">No hay empleados.</p>';
            return;
        }

        let html = '';
        filteredEmployees.forEach(emp => {
            let ruleLabel = 'Sin Asignar';
            if (emp.tipo_descanso === '1') ruleLabel = '1 día/sem';
            else if (emp.tipo_descanso === '2') ruleLabel = '2 días/2sem';
            else if (emp.tipo_descanso === '3') ruleLabel = '3 días/3sem';
            else if (emp.tipo_descanso === '4') ruleLabel = '4 días/mes';

            const bName = this.getBranchName(emp.sucursalId);

            html += `
                <div class="employee-side-item">
                    <div class="header-row">
                        <div>
                            <div class="emp-name">${emp.fullName}</div>
                            <div class="emp-branch"><i class="fas fa-building"></i> ${bName}</div>
                        </div>
                    </div>
                    <div>
                        <span class="rule-badge">${ruleLabel}</span>
                    </div>
                    <button class="config-btn" onclick="window.descansos.openRuleModal('${emp.id}', '${emp.fullName}', '${emp.tipo_descanso || ''}')">
                        <i class="fas fa-cog"></i> Configurar
                    </button>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    },

    renderCalendar() {
        const grid = document.getElementById('descansoCalendarGrid');
        if (!grid) return;
        
        const monthLabel = this.currentMonth.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
        const labelEl = document.getElementById('descansos-current-month-label');
        if (labelEl) labelEl.innerText = monthLabel.toUpperCase();
        
        grid.innerHTML = '';
        
        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        daysOfWeek.forEach(day => {
            grid.innerHTML += `<div class="calendar-header-cell">${day}</div>`;
        });
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="calendar-day-cell inactive"></div>`;
        }
        
        const filteredEmployees = this.getFilteredEmployees();
        const filteredEmpIds = filteredEmployees.map(e => e.id);

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = isCurrentMonth && today.getDate() === d;
            
            const dateRecords = this.registros.filter(r => r.fecha === dateStr && filteredEmpIds.includes(r.empleadoId));
            
            let badgesHtml = '';
            dateRecords.forEach(r => {
                const emp = filteredEmployees.find(e => e.id === r.empleadoId);
                const empName = emp ? emp.fullName : 'Desconocido';
                
                const isValid = this.validateDescansoRule(r.empleadoId, dateStr);
                const statusClass = isValid ? 'status-ok' : 'status-error';
                
                badgesHtml += `
                    <div class="descanso-badge ${statusClass}" title="${empName} - Regla: ${emp?.tipo_descanso || 'Sin regla'}"
                         draggable="true" 
                         ondragstart="window.descansos.handleDragStart(event, '${r.id}', '${r.empleadoId}')"
                         style="cursor: grab;">
                        <span>${empName.substring(0, 15)}...</span>
                        <button class="delete-btn" onclick="window.descansos.deleteRecord('${r.id}', event)"><i class="fas fa-times"></i></button>
                    </div>
                `;
            });

            grid.innerHTML += `
                <div class="calendar-day-cell ${isToday ? 'today' : ''}" data-date="${dateStr}"
                     ondragover="window.descansos.handleDragOver(event)"
                     ondrop="window.descansos.handleDrop(event, '${dateStr}')">
                    <div class="calendar-date-label">${d}</div>
                    <div class="day-records" id="day-records-${dateStr}">
                        ${badgesHtml}
                    </div>
                    <button class="add-descanso-btn" onclick="window.descansos.addRecordPrompt('${dateStr}')">+ Agregar</button>
                </div>
            `;
        }
    },

    renderList() {
        const tbody = document.getElementById('descansosTableBody');
        if (!tbody) return;
        
        const filteredEmployees = this.getFilteredEmployees();
        const year = this.currentMonth.getFullYear();
        const month = String(this.currentMonth.getMonth() + 1).padStart(2, '0');
        const monthPrefix = `${year}-${month}`;

        if (filteredEmployees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay empleados que coincidan con los filtros.</td></tr>';
            return;
        }

        let html = '';
        filteredEmployees.forEach(emp => {
            const empRecords = this.registros.filter(r => r.empleadoId === emp.id && r.fecha.startsWith(monthPrefix));
            const dates = empRecords.map(r => r.fecha).sort();
            
            let ruleLabel = 'Sin Asignar';
            if (emp.tipo_descanso === '1') ruleLabel = '1 día/sem';
            else if (emp.tipo_descanso === '2') ruleLabel = '2 días/2sem';
            else if (emp.tipo_descanso === '3') ruleLabel = '3 días/3sem';
            else if (emp.tipo_descanso === '4') ruleLabel = '4 días/mes';

            const isCompliant = this.validateMonthCompliance(emp.id, year, this.currentMonth.getMonth());
            const statusLabel = isCompliant 
                ? '<span style="color:var(--success); font-weight:bold;"><i class="fas fa-check-circle"></i> Cumple</span>' 
                : '<span style="color:var(--danger); font-weight:bold;"><i class="fas fa-exclamation-circle"></i> Conflicto/Incompleto</span>';

            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 12px; font-weight: 500;">${emp.fullName}</td>
                    <td style="padding: 12px;">${this.getBranchName(emp.sucursalId)}</td>
                    <td style="padding: 12px;">
                        <span style="background: var(--background); padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">
                            ${ruleLabel}
                        </span>
                        <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 0.7em; margin-left: 5px;" onclick="window.descansos.openRuleModal('${emp.id}', '${emp.fullName}', '${emp.tipo_descanso || ''}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                    <td style="padding: 12px; font-size: 0.85em;">
                        ${dates.length > 0 ? dates.map(d => `<span style="background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; margin-right: 4px; display: inline-block; margin-bottom: 4px;">${d.split('-')[2]}</span>`).join('') : '<span style="color: var(--text-muted)">Ninguno</span>'}
                    </td>
                    <td style="padding: 12px; text-align: center;">${statusLabel}</td>
                    <td style="padding: 12px; text-align: center;">
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8em;" onclick="window.descansos.clearEmployeeMonth('${emp.id}', '${monthPrefix}')" title="Limpiar Mes"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    },

    getBranchName(id) {
        const b = this.sucursales.find(s => s.id === id);
        return b ? b.name : 'Desconocida';
    },

    // --- Validation Engine ---
    
    validateDescansoRule(empleadoId, dateStr) {
        const emp = this.empleados.find(e => e.id === empleadoId);
        if (!emp || !emp.tipo_descanso) return false;

        const targetDate = new Date(dateStr + 'T12:00:00');
        const ruleVal = parseInt(emp.tipo_descanso);
        
        if (isNaN(ruleVal)) return false;

        const jan1 = new Date(targetDate.getFullYear(), 0, 1);
        const daysSinceJan1 = Math.floor((targetDate - jan1) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((targetDate.getDay() + 1 + daysSinceJan1) / 7);
        const blockNum = Math.floor((weekNum - 1) / ruleVal);
        
        const count = this.registros.filter(r => {
            if (r.empleadoId !== empleadoId) return false;
            const rDate = new Date(r.fecha + 'T12:00:00');
            if (rDate.getFullYear() !== targetDate.getFullYear()) return false;
            const rDaysSince = Math.floor((rDate - jan1) / (24 * 60 * 60 * 1000));
            const rWeekNum = Math.ceil((rDate.getDay() + 1 + rDaysSince) / 7);
            const rBlockNum = Math.floor((rWeekNum - 1) / ruleVal);
            return rBlockNum === blockNum;
        }).length;
        
        return count <= ruleVal;
    },

    validateMonthCompliance(empleadoId, year, month) {
        const emp = this.empleados.find(e => e.id === empleadoId);
        if (!emp || !emp.tipo_descanso) return false;
        
        const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthRecords = this.registros.filter(r => r.empleadoId === empleadoId && r.fecha.startsWith(monthPrefix));
        
        return monthRecords.length >= 4 && monthRecords.every(r => this.validateDescansoRule(empleadoId, r.fecha));
    },

    checkCoverageLimits() {
        const alertBox = document.getElementById('descansos-coverage-alert');
        const alertMsg = document.getElementById('descansos-coverage-msg');
        if (!alertBox || !alertMsg) return;
        
        const year = this.currentMonth.getFullYear();
        const month = String(this.currentMonth.getMonth() + 1).padStart(2, '0');
        const monthPrefix = `${year}-${month}`;
        
        const branchCountsByDate = {};
        
        this.registros.forEach(r => {
            if (!r.fecha.startsWith(monthPrefix)) return;
            const emp = this.empleados.find(e => e.id === r.empleadoId);
            if (!emp) return;
            
            if (!branchCountsByDate[r.fecha]) branchCountsByDate[r.fecha] = {};
            if (!branchCountsByDate[r.fecha][emp.sucursalId]) branchCountsByDate[r.fecha][emp.sucursalId] = 0;
            branchCountsByDate[r.fecha][emp.sucursalId]++;
        });
        
        const branchTotals = {};
        this.empleados.forEach(e => {
            if (!branchTotals[e.sucursalId]) branchTotals[e.sucursalId] = 0;
            branchTotals[e.sucursalId]++;
        });
        
        const conflicts = [];
        
        for (const date in branchCountsByDate) {
            for (const sucId in branchCountsByDate[date]) {
                const offCount = branchCountsByDate[date][sucId];
                const totalCount = branchTotals[sucId] || 1;
                const percent = (offCount / totalCount) * 100;
                
                if (percent > this.coverageLimitPercent) {
                    const bName = this.getBranchName(sucId);
                    conflicts.push(`El ${date.split('-')[2]}/${date.split('-')[1]}, <b>${bName}</b> tiene ${percent.toFixed(0)}% del personal descansando.`);
                }
            }
        }
        
        if (conflicts.length > 0) {
            alertMsg.innerHTML = conflicts.join('<br>');
            alertBox.style.display = 'block';
        } else {
            alertBox.style.display = 'none';
        }
    },

    // --- Actions ---

    async addRecordPrompt(dateStr) {
        const filteredEmployees = this.getFilteredEmployees();
        
        if (filteredEmployees.length === 0) {
            Swal.fire('Atención', 'No hay empleados visibles según los filtros actuales.', 'warning');
            return;
        }

        let selectHtml = `<select id="swal-emp-select" class="swal2-input" style="width: 100%; font-size: 14px; margin-top: 10px;">
            <option value="">Seleccione un empleado...</option>`;
        
        // Sort alphabetically to help User
        const sortedEmp = [...filteredEmployees].sort((a,b) => a.fullName.localeCompare(b.fullName));
        sortedEmp.forEach(emp => {
            selectHtml += `<option value="${emp.id}">${emp.fullName} (${emp.tipo_descanso ? 'Regla ' + emp.tipo_descanso : 'Sin Regla'})</option>`;
        });
        selectHtml += `</select>`;

        const { value: selectedEmpId } = await Swal.fire({
            title: `Agregar descanso el ${dateStr}`,
            html: selectHtml,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const val = document.getElementById('swal-emp-select').value;
                if (!val) Swal.showValidationMessage('Debe seleccionar un empleado');
                return val;
            }
        });

        if (selectedEmpId) {
            this.executeAddRecord(selectedEmpId, dateStr);
        }
    },

    async executeAddRecord(empleadoId, dateStr) {
        const emp = this.empleados.find(e => e.id === empleadoId);
        const datesToAdd = [dateStr];
        const ruleVal = parseInt(emp.tipo_descanso);

        if (emp && !isNaN(ruleVal) && ruleVal > 1) {
            const result = await Swal.fire({
                title: 'Autocompletar',
                text: `Este empleado puede acumular hasta ${ruleVal} días. ¿Deseas asignar automáticamente los ${ruleVal} días consecutivos empezando el ${dateStr}?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, autocompletar',
                cancelButtonText: 'No, solo un día'
            });
            
            if (result.isConfirmed) {
                const start = new Date(dateStr + 'T12:00:00');
                for (let i = 1; i < ruleVal; i++) {
                    const nextDate = new Date(start);
                    nextDate.setDate(start.getDate() + i);
                    const nStr = nextDate.toISOString().split('T')[0];
                    datesToAdd.push(nStr);
                }
            }
        }

        try {
            const batch = db.batch();
            for (const d of datesToAdd) {
                if (this.registros.some(r => r.empleadoId === empleadoId && r.fecha === d)) continue;

                const docRef = db.collection('descansos').doc();
                const recordData = {
                    empleadoId: empleadoId,
                    fecha: d,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                batch.set(docRef, recordData);
                
                this.registros.push({
                    id: docRef.id,
                    empleadoId: empleadoId,
                    fecha: d
                });
            }
            
            await batch.commit();
            console.log("Descansos guardados correctamente.");
            this.render();
            
            Swal.fire({
                icon: 'success',
                title: 'Descanso(s) guardado(s)',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });

            // Programación Inteligente Encadenada (Auto-schedule next cycle)
            if (emp && !isNaN(ruleVal) && ruleVal >= 1) {
                const nextDate = new Date(dateStr + 'T12:00:00');
                nextDate.setDate(nextDate.getDate() + (ruleVal * 7));
                const nextStr = nextDate.toISOString().split('T')[0];
                
                const nextExists = this.registros.some(r => r.empleadoId === empleadoId && r.fecha === nextStr);
                
                if (!nextExists) {
                    const confirmNext = await Swal.fire({
                        title: 'Programar Próximo Ciclo',
                        text: `El siguiente descanso de ${emp.fullName} sería el ${nextStr}. ¿Deseas dejarlo programado desde ahora?`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, programar',
                        cancelButtonText: 'No, gracias'
                    });

                    if (confirmNext.isConfirmed) {
                        this.executeAddRecord(empleadoId, nextStr);
                    }
                }
            }
        } catch (e) {
            console.error("Error validando descansos:", e);
            Swal.fire('Error', 'Hubo un error al guardar los registros.', 'error');
        }
    },

    // --- Drag and Drop ---
    
    handleDragStart(event, recordId, empId) {
        event.dataTransfer.setData('recordId', recordId);
        event.dataTransfer.setData('empId', empId);
        event.dataTransfer.effectAllowed = 'move';
        // Añadir efecto visual al elemento en arrastre
        setTimeout(() => event.target.style.opacity = '0.5', 0);
    },

    handleDragOver(event) {
        event.preventDefault(); // Permitir soltar
        event.dataTransfer.dropEffect = 'move';
        
        // Efecto visual en la celda del calendario
        const cell = event.currentTarget;
        if (!cell.classList.contains('drag-over')) {
            document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('drag-over'));
            cell.classList.add('drag-over');
        }
    },

    async handleDrop(event, newDateStr) {
        event.preventDefault();
        document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('drag-over'));
        
        const recordId = event.dataTransfer.getData('recordId');
        if (!recordId) return;

        const empId = event.dataTransfer.getData('empId');
        const exists = this.registros.some(r => r.empleadoId === empId && r.fecha === newDateStr && r.id !== recordId);
        
        if (exists) {
            Swal.fire('Atención', 'El empleado ya tiene asignado un descanso el ' + newDateStr + '.', 'warning');
            this.render(); // Reset opacity
            return;
        }

        try {
            await db.collection('descansos').doc(recordId).update({
                fecha: newDateStr
            });

            const record = this.registros.find(r => r.id === recordId);
            if (record) {
                record.fecha = newDateStr;
            }
            
            this.render();
            Swal.fire({ icon: 'success', title: 'Descanso movido', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo mover el descanso.', 'error');
            this.render();
        }
    },

    async deleteRecord(recordId, event) {
        if (event) event.stopPropagation();
        
        const result = await Swal.fire({
            title: '¿Eliminar?',
            text: "¿Estás seguro de eliminar este descanso?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar'
        });
        
        if (!result.isConfirmed) return;

        try {
            await db.collection('descansos').doc(recordId).delete();
            this.registros = this.registros.filter(r => r.id !== recordId);
            this.render();
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo eliminar el registro.', 'error');
        }
    },

    async clearEmployeeMonth(empleadoId, monthPrefix) {
        const result = await Swal.fire({
            title: '¿Limpiar mes?',
            text: "¿Estás seguro de eliminar TODOS los descansos de este empleado en este mes?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar'
        });
        
        if (!result.isConfirmed) return;

        const recordsToDelete = this.registros.filter(r => r.empleadoId === empleadoId && r.fecha.startsWith(monthPrefix));
        if (recordsToDelete.length === 0) return;

        try {
            const batch = db.batch();
            recordsToDelete.forEach(r => {
                const docRef = db.collection('descansos').doc(r.id);
                batch.delete(docRef);
            });
            await batch.commit();
            
            this.registros = this.registros.filter(r => !(r.empleadoId === empleadoId && r.fecha.startsWith(monthPrefix)));
            this.render();
            
            Swal.fire({
                icon: 'success',
                title: 'Mes limpiado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudieron limpiar los registros.', 'error');
        }
    },

    // --- Rule Validation Modal ---

    openRuleModal(empId, empName, currentRule) {
        document.getElementById('descansoRuleEmpId').value = empId;
        document.getElementById('descansoRuleEmpName').value = empName;
        document.getElementById('descansoRuleSelect').value = currentRule || '';
        document.getElementById('descansoRuleModal').style.display = 'flex';
    },

    closeRuleModal() {
        document.getElementById('descansoRuleModal').style.display = 'none';
    },

    async saveRule() {
        const empId = document.getElementById('descansoRuleEmpId').value;
        const newRule = document.getElementById('descansoRuleSelect').value;

        if (!newRule) {
            Swal.fire('Aviso', 'Por favor selecciona una regla.', 'warning');
            return;
        }

        try {
            await db.collection('employees').doc(empId).update({
                tipo_descanso: newRule
            });
            
            const emp = this.empleados.find(e => e.id === empId);
            if (emp) emp.tipo_descanso = newRule;

            this.closeRuleModal();
            this.render();

            Swal.fire({
                icon: 'success',
                title: 'Regla actualizada',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo guardar la regla.', 'error');
        }
    }
};
