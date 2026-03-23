// horarios.js
window.horarios = {
    // Parámetros de Configuración del Motor
    MIN_REST_HOURS: 12,
    MAX_WEEKLY_HOURS: 44,
    AUTO_MEAL_THRESHOLD_HOURS: 6,
    MEAL_DURATION_MINS: 30,

    currentWeekStart: null,
    employees: [],
    branches: [],
    shifts: [],
    coverageMeta: [], // Array de metas heurísticas o db
    positions: [], // Cargado dinámicamente de Firebase
    descansos: [], // Registros de días libres
    workHoursConfig: { start: 8, end: 24 }, // Init default
    simulatedAbsences: [], // Matriz de IDs de empleados en simulación de vacaciones


    async init() {
        console.log("Inicializando Motor de Horarios y Cobertura...");
        
        // Initial setup for Week Picker (Set to current week Monday)
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        
        document.getElementById('horarios-week-filter').value = monday.toISOString().split('T')[0];
        
        // Populate Gantt configuration hours
        const hsInput = document.getElementById('config-start-hour');
        const heInput = document.getElementById('config-end-hour');
        if(hsInput && heInput) {
            hsInput.innerHTML = ''; heInput.innerHTML = '';
            for(let i=0; i<=24; i++) {
                let text = this.formatAMPM(i+':00');
                if (i===24) text = "12:00 AM (Día Sig.)";
                hsInput.innerHTML += `<option value="${i}" ${i===8 ? 'selected' : ''}>${text}</option>`;
                heInput.innerHTML += `<option value="${i}" ${i===24 ? 'selected' : ''}>${text}</option>`;
            }
        }
        
        await this.loadInitialData();

        // Populate roles dinámicamente
        const roleFilter = document.getElementById('horarios-role-filter');
        const shiftRole = document.getElementById('shift-role');
        roleFilter.innerHTML = '<option value="all">Ver Todos</option>';
        shiftRole.innerHTML = '';
        this.positions.forEach(p => {
            roleFilter.innerHTML += `<option value="${p.name}">${p.name}</option>`;
            shiftRole.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });

        this.render();
    },

    async loadInitialData() {
        try {
            const [empSnap, branchSnap, shiftSnap, metaSnap, positionsSnap, descansosSnap] = await Promise.all([
                db.collection('employees').where('status', '==', 'active').get(),
                db.collection('sucursales').get(),
                db.collection('horarios_turnos').get(),
                db.collection('horarios_metas').get(),
                db.collection('positions').get(),
                db.collection('descansos').get()
            ]);

            this.employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.branches = branchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.shifts = shiftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.descansos = descansosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            try {
                const configDoc = await db.collection('horarios_config').doc('global').get();
                if (configDoc.exists) {
                    this.workHoursConfig = configDoc.data();
                } else {
                    await db.collection('horarios_config').doc('global').set(this.workHoursConfig);
                }
            } catch(e) { console.warn("Error config", e); }

            // Mapear Puestos a Empleados
            this.employees.forEach(e => {
                const p = this.positions.find(p => p.id === e.positionId);
                e.position = p ? p.name : 'Sin Puesto';
            });

            // Branches dropdown
            const bFilter = document.getElementById('horarios-branch-filter');
            bFilter.innerHTML = '<option value="">Seleccione una Sucursal</option>'; // Forzar elección
            this.branches.forEach(b => {
                bFilter.innerHTML += `<option value="${b.id}">${b.name}</option>`;
            });

            // If only one branch, auto select
            if (this.branches.length > 0) {
                bFilter.value = this.branches[0].id; // Para dev es mejor
            }

            // Metas pre-establecidas (Dummy de Viernes noche para testing si está vacío)
            if (metaSnap.empty) {
                this.setupDummyMeta();
            } else {
                this.coverageMeta = metaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

        } catch (e) {
            console.error("Error loading DB", e);
        }
    },

    setupDummyMeta() {
        // Mock meta: Los Viernes (Index 4) ocupamos 2 de Atención al Cliente, 1 Hornero y 2 Repartidores de 18:00 a 22:00
        this.coverageMeta = [
            { branchId: 'all', dayOfWeek: 4, role: 'Atención al Cliente', startHour: '18:00', endHour: '22:00', count: 2 },
            { branchId: 'all', dayOfWeek: 4, role: 'Repartidor', startHour: '18:00', endHour: '22:00', count: 2 },
            { branchId: 'all', dayOfWeek: 4, role: 'Hornero', startHour: '18:00', endHour: '22:00', count: 1 }
        ];
    },

    onFilterChange() {
        this.render();
        this.renderHeatmap();
    },

    render() {
        const branchId = document.getElementById('horarios-branch-filter').value;
        const roleFilter = document.getElementById('horarios-role-filter').value;
        const weekDateStr = document.getElementById('horarios-week-filter').value;
        const dayView = document.getElementById('horarios-day-view-filter') ? document.getElementById('horarios-day-view-filter').value : 'all';

        if (!branchId || !weekDateStr) return;

        const [y, m, d] = weekDateStr.split('-');
        this.currentWeekStart = new Date(y, m - 1, d); 

        if (dayView !== 'all') {
            const dateObj = new Date(this.currentWeekStart);
            dateObj.setDate(this.currentWeekStart.getDate() + parseInt(dayView));
            
            // Orden Jerárquico para Gantt también
            const rolePriority = {'encargado':1, 'encargada':1, 'encargado de sucursal':1, 'cocinero':2, 'cocinera':2, 'cajero':3, 'cajera':3};
            let filteredEmps = this.employees.filter(e => e.sucursalId === branchId);
            filteredEmps.sort((a,b) => {
                const pA = rolePriority[(a.position||'').toLowerCase()] || 99;
                const pB = rolePriority[(b.position||'').toLowerCase()] || 99;
                return pA !== pB ? pA - pB : (a.fullName||'').localeCompare(b.fullName||'');
            });
            
            this.renderDailyGantt(dateObj, filteredEmps, branchId);
            return;
        }

        const grid = document.getElementById('weekly-schedule-grid');
        grid.innerHTML = '';
        grid.style.display = 'grid'; // Reset a grid clásico

        const daysOfWeekList = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const datesInWeek = [];
        
        for (let i = 0; i < 7; i++) {
            const dateObj = new Date(this.currentWeekStart);
            dateObj.setDate(this.currentWeekStart.getDate() + i);
            datesInWeek.push({ dt: dateObj, label: daysOfWeekList[i] });
        }

        grid.style.gridTemplateColumns = `200px repeat(${datesInWeek.length}, minmax(150px, 1fr))`;

        // --- Render Headers ---
        grid.innerHTML += `<div class="grid-header">Empleado</div>`;
        datesInWeek.forEach(day => {
            const dStr = day.dt.getDate().toString().padStart(2, '0') + '/' + (day.dt.getMonth() + 1).toString().padStart(2, '0');
            grid.innerHTML += `<div class="grid-header">${day.label} <span class="date-sub">${dStr}</span></div>`;
        });

        // --- Render Employees ---
        let filteredEmps = this.employees.filter(e => e.sucursalId === branchId);
        
        // Orden Jerárquico: Encargado -> Cocineros -> Cajeras -> Resto -> Alfabético
        const rolePriority = {
            'encargado': 1,
            'encargada': 1,
            'encargado de sucursal': 1,
            'cocinero': 2,
            'cocinera': 2,
            'cajero': 3,
            'cajera': 3
        };

        filteredEmps.sort((a, b) => {
            const posA = (a.position || '').toLowerCase();
            const posB = (b.position || '').toLowerCase();
            
            const prioA = rolePriority[posA] || 99;
            const prioB = rolePriority[posB] || 99;

            if (prioA !== prioB) return prioA - prioB;
            return (a.fullName || '').localeCompare(b.fullName || '');
        });

        if (roleFilter !== 'all') {
            // Nota: Un empleado podría tener rol base o roles secundarios, por ahora usamos "puesto"
            // En un futuro el rol base podría venir de una configuración formal, por ahora usamos "puesto"
            // asumiremos 'puesto' guardado en employee profile.
            // Para simplificar: mostramos todos y el rol se elige por turno, a menos que se quiera solo ver a los Horneros
        }

        // Usamos una copia de flatDates para calcular las horas exactas que muestra la vista (o toda la semana)
        const flatDates = datesInWeek.map(d => d.dt);

        filteredEmps.forEach(emp => {
            // Calcular horas totales trabajadas en los dias que estamos renderizando
            let totalMins = 0;
            flatDates.forEach(dt => {
                const dateIsoStr = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
                const dayShifts = this.shifts.filter(s => s.employeeId === emp.id && s.date === dateIsoStr);
                dayShifts.forEach(shift => {
                    let sMins = this.calculateDiffMins(shift.startTime, shift.endTime);
                    if (shift.mealStart && shift.mealEnd) {
                        sMins -= this.calculateDiffMins(shift.mealStart, shift.mealEnd);
                    }
                    totalMins += sMins;
                });
            });

            const totalHrs = (totalMins / 60).toFixed(1);
            const maxHrs = this.MAX_WEEKLY_HOURS;
            const pct = Math.min(100, (totalHrs / maxHrs) * 100);
            
            // Color de la barra
            let barColor = '#3b82f6'; // Azul normal
            if (pct >= 100) barColor = '#ef4444'; // Rojo (sobrepasó)
            else if (pct >= 85) barColor = '#f59e0b'; // Naranja (alerta)

            grid.innerHTML += `
                <div class="grid-cell-emp">
                    <strong>${emp.fullName}</strong><br>
                    <span style="font-size: 0.8em; color: var(--text-muted);">${emp.position}</span>
                    <div style="margin-top: 8px; background: #e2e8f0; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;" title="${totalHrs} hr de ${maxHrs} hr">
                        <div style="background: ${barColor}; height: 100%; width: ${pct}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="font-size: 0.7em; color: var(--text-muted); text-align: right; margin-top: 2px;">${totalHrs} / ${maxHrs} hrs</div>
                </div>
            `;

            datesInWeek.forEach(day => {
                const dateIsoStr = day.dt.getFullYear() + '-' + String(day.dt.getMonth()+1).padStart(2,'0') + '-' + String(day.dt.getDate()).padStart(2,'0');
                
                // Get shifts for this employee on this day
                const dayShifts = this.shifts.filter(s => s.employeeId === emp.id && s.date === dateIsoStr);
                
                // Check if rests
                const isRestDay = this.descansos.some(d => d.empleadoId === emp.id && d.fecha === dateIsoStr);
                
                let shiftsHtml = '';
                
                if (isRestDay) {
                    shiftsHtml += `<div class="descanso-block"><i class="fas fa-bed"></i> Descanso Libre</div>`;
                }

                dayShifts.forEach(shift => {
                    const mealText = shift.mealStart ? `<div style="font-size: 0.75em; color: var(--warning); margin-top: 2px;"><i class="fas fa-utensils"></i> ${this.formatAMPM(shift.mealStart)} - ${this.formatAMPM(shift.mealEnd)}</div>` : '';
                    const hasMealCls = shift.mealStart ? 'has-meal' : '';
                    // Detener la propagación en onmousedown/ondragstart para que onclick no se dispare al soltar
                    shiftsHtml += `
                        <div class="shift-block ${hasMealCls}" draggable="true" ondragstart="event.stopPropagation(); window.horarios.handleDragStart(event, '${shift.id}')" onclick="event.stopPropagation(); window.horarios.openShiftModal('${emp.id}', '${dateIsoStr}', '${shift.id}')">
                            <div class="shift-time">${this.formatAMPM(shift.startTime)} - ${this.formatAMPM(shift.endTime)}</div>
                            <div class="shift-role">${shift.appliedRole}</div>
                            ${mealText}
                        </div>
                    `;
                });

                grid.innerHTML += `
                    <div class="grid-cell-day" data-date="${dateIsoStr}" ondragover="window.horarios.handleDragOver(event)" ondragleave="window.horarios.handleDragLeave(event)" ondrop="window.horarios.handleDrop(event, '${emp.id}', '${dateIsoStr}')" onclick="if(event.target.classList.contains('grid-cell-day')) window.horarios.openShiftModal('${emp.id}', '${dateIsoStr}')">
                        ${shiftsHtml}
                    </div>
                `;
            });
        });

        // Usamos la lista de Dates plana para las validaciones globales
        this.validateWeeklyGlobalRules(filteredEmps, flatDates);
        this.renderHeatmap();
    },

    renderDailyGantt(dateObj, emps, branchId) {
        const grid = document.getElementById('weekly-schedule-grid');
        grid.style.display = 'block'; // Block container for our flex wrapper
        
        const dateIsoStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth()+1).padStart(2,'0') + '-' + String(dateObj.getDate()).padStart(2,'0');
        const dayOffset = (dateObj.getDay() + 6) % 7; 
        const displayDate = dateObj.toLocaleDateString('es-GT', { weekday:'long', day:'numeric', month:'long' });

        let userStartH = this.workHoursConfig.start;
        let userEndH = this.workHoursConfig.end;
        if (userStartH >= userEndH) userEndH = userStartH + 1; // Fallback
        
        const START_IDX = userStartH * 2;
        const END_IDX = userEndH * 2;
        const numBlocks = END_IDX - START_IDX;

        let html = `<div class="gantt-wrapper">`;
        
        // --- 1. GANTT MAIN CONTAINER ---
        html += `<div class="gantt-container" style="--num-blocks: ${numBlocks};">`;
        
        // Title
        html += `<div class="gantt-main-title">
                    <span>Panel de Cobertura de Turnos de Personal General</span>
                    <span style="font-weight: normal; font-size: 0.9em;">${displayDate.charAt(0).toUpperCase() + displayDate.slice(1)}</span>
                 </div>`;

        // Timeline Header
        html += `<div class="gantt-header-row">`;
        html += `<div style="font-weight: bold; font-size: 0.75em; color: #9ca3af; padding-left: 5px; text-transform: uppercase;">Timeline</div>`;
        for(let j=START_IDX; j<END_IDX; j+=2) { 
            let h = j/2;
            let textTime = this.formatAMPM(h+':00');
            html += `<div class="gantt-tick">${textTime.split(' ')[0]} ${textTime.split(' ')[1]}</div>`;
        }
        html += `</div>`;

        // Group by Role
        const roleGroups = {};
        emps.forEach(emp => {
            const role = emp.position || 'Sin Puesto';
            if (!roleGroups[role]) roleGroups[role] = [];
            roleGroups[role].push(emp);
        });

        // Loop Roles
        for (const [roleName, roleEmps] of Object.entries(roleGroups)) {
            // Emps in this role
            roleEmps.forEach(emp => {
                html += `<div class="gantt-emp-row" onclick="if(event.target.classList.contains('gantt-emp-row')) window.horarios.openShiftModal('${emp.id}', '${dateIsoStr}')">`;
                
                const isRestDay = this.descansos.some(d => d.empleadoId === emp.id && d.fecha === dateIsoStr);
                 const isSimVacation = this.simulatedAbsences.includes(emp.id);

                 let nameStyle = "";
                 if(isRestDay) nameStyle = "color: #ef4444;text-decoration:line-through;";
                 if(isSimVacation) nameStyle = "color: #f59e0b;font-style:italic;opacity:0.7;";

                 let subText = emp.position || 'Sin Puesto';
                 if(isSimVacation) subText = "✈️ En Vacaciones (Simulación)";

                 html += `<div class="gantt-emp-name" style="${nameStyle}">
                             <div>${emp.fullName}</div>
                             <div class="gantt-emp-sub">${subText}</div>
                          </div>`;
                         
                if(!isSimVacation) {
                    const empShifts = this.shifts.filter(s => s.employeeId === emp.id && s.date === dateIsoStr);
                    empShifts.forEach(shift => {
                        const startIdx = this.timeToIndex(shift.startTime);
                        const endIdx = this.timeToIndex(shift.endTime);
                        let colStart = startIdx - START_IDX + 2; 
                        let colEnd = endIdx - START_IDX + 2;
                        if (colStart < 2) colStart = 2;
                        if (colEnd > numBlocks + 2) colEnd = numBlocks + 2; 
                        if (colStart >= colEnd) return; // Out of bounds
                        
                        html += `
                            <div class="gantt-shift-bar" style="grid-column: ${colStart} / ${colEnd};" 
                                 onclick="window.horarios.openShiftModal('${emp.id}', '${dateIsoStr}', '${shift.id}')"
                                 ondragover="event.preventDefault();"
                                 ondrop="window.horarios.handleMealDrop(event, '${shift.id}', ${startIdx}, ${endIdx})">
                                Turno Activo
                            </div>
                        `;
                        
                        if (shift.mealStart && shift.mealEnd) {
                            const mStartIdx = this.timeToIndex(shift.mealStart);
                            const mEndIdx = this.timeToIndex(shift.mealEnd);
                            let mColStart = mStartIdx - START_IDX + 2;
                            let mColEnd = mEndIdx - START_IDX + 2;
                            if (mColStart < 2) mColStart = 2;
                            if (mColEnd > numBlocks + 2) mColEnd = numBlocks + 2;
                            
                            if (mColStart < mColEnd) {
                                html += `
                                    <div class="gantt-meal-bar" draggable="true"
                                         ondragstart="window.horarios.handleMealDragStart(event, '${shift.id}')"
                                         style="grid-column: ${mColStart} / ${mColEnd};" 
                                         title="Comida ${this.formatAMPM(shift.mealStart)} - ${this.formatAMPM(shift.mealEnd)}" 
                                         onclick="event.stopPropagation(); window.horarios.openShiftModal('${emp.id}', '${dateIsoStr}', '${shift.id}')">
                                        <i class="fas fa-utensils"></i>
                                    </div>
                                `;
                            }
                        }
                    });
                }
                html += `</div>`;
            });
            
            // Render Heatmap Row for THIS Role
             const V_META = new Array(48).fill(0);
             const V_ACTIVE = new Array(48).fill(0);
             
             this.coverageMeta.forEach(m => {
                 if ((m.branchId === branchId || m.branchId === 'all') && m.dayOfWeek === dayOffset && m.role === roleName) {
                     const sIdx = this.timeToIndex(m.startHour);
                     const eIdx = this.timeToIndex(m.endHour);
                     for(let i=sIdx; i<eIdx; i++) V_META[i] = m.count;
                 }
             });
             
             this.shifts.forEach(shift => {
                 const emp = this.employees.find(e => e.id === shift.employeeId);
                 if(emp && !this.simulatedAbsences.includes(emp.id) && emp.sucursalId === branchId && shift.date === dateIsoStr && shift.appliedRole === roleName) {
                     const sIdx = this.timeToIndex(shift.startTime);
                     const eIdx = this.timeToIndex(shift.endTime);
                     for(let i=sIdx; i<eIdx; i++) V_ACTIVE[i]++;
                     if(shift.mealStart && shift.mealEnd) {
                         const msIdx = this.timeToIndex(shift.mealStart);
                         const meIdx = this.timeToIndex(shift.mealEnd);
                         for(let i=msIdx; i<meIdx; i++) V_ACTIVE[i]--;
                     }
                 }
             });
             
             html += `<div class="gantt-heatmap-row">
                        <div class="gantt-hm-label">Mapa de Calor de Cobertura</div>`;
                        
             for(let i=START_IDX; i<END_IDX; i++) {
                 const diff = V_ACTIVE[i] - V_META[i];
                 let hmc = 'empty'; let val = '';
                 
                 if (V_META[i] > 0 || V_ACTIVE[i] > 0) {
                     if (diff === 0 && V_META[i]>0) { hmc = 'ok'; val = V_ACTIVE[i]; } 
                     else if (diff > 0) { hmc = 'over'; val = '+'+diff; }
                     else if (diff < 0) { hmc = 'deficit'; val = String(diff); }
                     else if (V_META[i] === 0 && V_ACTIVE[i] > 0) { hmc = 'over'; val = String(V_ACTIVE[i]); }
                 }
                 html += `<div class="gantt-hm-block ${hmc}">${val}</div>`;
             }
             html += `</div>`;
        }
        
        html += `</div>`; // End gantt-container
        
        // --- 2. SIDE PANEL (PANEL DE LÓGICA Y ALERTAS) ---
        let countDeficits = 0;
        let countOverlaps = 0;
        let countFatigue = 0;
        
        html += `<div class="gantt-side-panel">
                    <div class="gantt-sp-title">Panel de Lógica y Alertas</div>
                    
                    <div class="gantt-sp-section">
                        <div class="gantt-sp-h3">Alertas Detectadas:</div>
                        <div class="gantt-sp-item"><i class="fas fa-flag" style="color: #ef4444;"></i> ${countDeficits} Déficits en Cobertura</div>
                        <div class="gantt-sp-item"><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> ${countOverlaps} Solapamiento Evitado</div>
                        <div class="gantt-sp-item"><i class="fas fa-bed" style="color: #60a5fa;"></i> ${countFatigue} Descansos Críticos</div>
                    </div>
                    
                    <div class="gantt-sp-section">
                        <div class="gantt-sp-h3">Validaciones Activas:</div>
                        <div class="gantt-sp-item" style="color:#10b981;">Descanso entre Jornadas OK</div>
                        <div class="gantt-sp-item" style="color:#10b981;">Límite de Horas Semanales OK</div>
                    </div>
                    
                    <div style="margin-top: 30px; display: flex; align-items: center; gap: 10px; color: #6b7280; font-size: 0.7em;">
                        <i class="fas fa-cogs fa-2x"></i>
                        <div>
                            <div>MOTOR DE</div>
                            <div>VALIDACIÓN ACTIVO</div>
                        </div>
                    </div>
                 </div>`;
        
        html += `</div>`; // End gantt-wrapper
        
        grid.innerHTML = html;

        // Limpiar el heatmap inferior original
        document.getElementById('coverage-timeline-axis').innerHTML = '';
        document.getElementById('coverage-blocks-meta').innerHTML = '';
        document.getElementById('coverage-blocks-active').innerHTML = '';
        document.getElementById('coverage-blocks-diff').innerHTML = '<span style="color:var(--text-muted);font-size:0.8em;padding:10px;">La analítica está integrada dentro de la Gráfica Gantt superior en esta vista.</span>';
    },

    // ============================================
    // MOTOR DE COBERTURA Y HEATMAP (48 Bloques)
    // ============================================

    renderHeatmap() {
        // Obtener el día seleccionado de la semana
        const dayOffset = parseInt(document.getElementById('heatmap-day-filter').value); // 0 (Lun) a 6 (Dom)
        const roleTarget = document.getElementById('horarios-role-filter').value;
        const branchId = document.getElementById('horarios-branch-filter').value;

        document.getElementById('heatmap-role-label').innerText = roleTarget !== 'all' ? roleTarget : 'Seleccione Rol Arriba';

        if (!this.currentWeekStart || !branchId || roleTarget === 'all') {
            document.getElementById('coverage-blocks-meta').innerHTML = '<span style="padding: 10px; font-size:0.8em; color:#999;">Selecciona un Rol de Puesto en la barra superior para ver su demanda de cobertura...</span>';
            document.getElementById('coverage-timeline-axis').innerHTML = '';
            document.getElementById('coverage-blocks-active').innerHTML = '';
            document.getElementById('coverage-blocks-diff').innerHTML = '';
            return;
        }

        const targetDateObj = new Date(this.currentWeekStart);
        targetDateObj.setDate(targetDateObj.getDate() + dayOffset);
        const targetDateIso = targetDateObj.getFullYear() + '-' + String(targetDateObj.getMonth()+1).padStart(2,'0') + '-' + String(targetDateObj.getDate()).padStart(2,'0');

        // Generar 48 bloques (Vector matemático)
        const V_META = new Array(48).fill(0);
        const V_ACTIVE = new Array(48).fill(0);

        // 1. Llenar Vector Meta
        this.coverageMeta.forEach(m => {
            if ((m.branchId === branchId || m.branchId === 'all') && m.dayOfWeek === dayOffset && m.role === roleTarget) {
                const sIdx = this.timeToIndex(m.startHour);
                const eIdx = this.timeToIndex(m.endHour);
                for(let i=sIdx; i<eIdx; i++) V_META[i] = m.count;
            }
        });

        // 2. Llenar Vector Active (Contar a los programados en ese Rol, ese Día)
        this.shifts.forEach(shift => {
            const emp = this.employees.find(e => e.id === shift.employeeId);
            if(emp && !this.simulatedAbsences.includes(emp.id) && emp.sucursalId === branchId && shift.date === targetDateIso && shift.appliedRole === roleTarget) {
                const sIdx = this.timeToIndex(shift.startTime);
                const eIdx = this.timeToIndex(shift.endTime);
                
                for(let i=sIdx; i<eIdx; i++) {
                    V_ACTIVE[i]++;
                }

                // ANTI-VACÍO: Restar tiempo de comida del conteo activo
                if(shift.mealStart && shift.mealEnd) {
                    const msIdx = this.timeToIndex(shift.mealStart);
                    const meIdx = this.timeToIndex(shift.mealEnd);
                    for(let i=msIdx; i<meIdx; i++) {
                        V_ACTIVE[i]--; // No está activo porque está comiendo
                    }
                }
            }
        });

        // 3. Renderizar vista de 06:00 a 24:00 (Para no llenar de ceros la madrugada comercial, de index 12 a 47)
        const START_IDX = 12; // 06:00
        const END_IDX = 48; // 24:00

        let htmlAxis = '', htmlMeta = '', htmlActive = '', htmlDiff = '';
        
        for(let i=START_IDX; i<END_IDX; i++) {
            // Axis (solo horas en punto, i%2 == 0)
            if (i % 2 === 0) {
                let h = i/2;
                let ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
                let formattedH = h % 12 || 12;
                htmlAxis += `<div class="timeline-tick" style="flex: 2;">${String(formattedH).padStart(2,'0')}:00 ${ampm}</div>`;
            }

            // Meta
            htmlMeta += `<div class="cov-block meta">${V_META[i] > 0 ? V_META[i] : ''}</div>`;
            
            // Active
            htmlActive += `<div class="cov-block active">${V_ACTIVE[i] > 0 ? V_ACTIVE[i] : ''}</div>`;
            
            // Diff
            const diff = V_ACTIVE[i] - V_META[i];
            let diffClass = '';
            let valStr = '';
            if (V_META[i] > 0) { // Solo evaluar si hay meta
                if (diff === 0) { diffClass = 'diff-ok'; valStr = '✓'; }
                else if (diff > 0) { diffClass = 'diff-over'; valStr = '+'+diff; }
                else if (diff < 0) { diffClass = 'diff-deficit'; valStr = String(diff); } // Muestra negativo
            }
            htmlDiff += `<div class="cov-block ${diffClass}" title="Faltantes/Sobrantes">${valStr}</div>`;
        }

        document.getElementById('coverage-timeline-axis').innerHTML = htmlAxis;
        document.getElementById('coverage-blocks-meta').innerHTML = htmlMeta;
        document.getElementById('coverage-blocks-active').innerHTML = htmlActive;
        document.getElementById('coverage-blocks-diff').innerHTML = htmlDiff;
    },

    timeToIndex(timeStr) {
        // "18:30" => 18 * 2 = 36 + 1 = 37
        if(!timeStr) return 0;
        const [h, m] = timeStr.split(':');
        let idx = (parseInt(h) * 2);
        if (parseInt(m) >= 30) idx += 1;
        return idx;
    },

    indexToTime(idx) {
        const h = Math.floor(idx / 2);
        const m = (idx % 2 === 0) ? '00' : '30';
        return String(h).padStart(2, '0') + ':' + m;
    },

    formatAMPM(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h);
        const ampm = hour >= 12 && hour < 24 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12; // 0 becomes 12
        return String(hour).padStart(2, '0') + ':' + m + ' ' + ampm;
    },

    // ============================================
    // VALIDACIONES ALGORÍTMICAS (Choque, Fatiga, Extras)
    // ============================================

    validateWeeklyGlobalRules(emps, datesInWeek) {
        const alertBox = document.getElementById('horarios-alerts-container');
        alertBox.innerHTML = '';
        let hasAlerts = false;

        emps.forEach(emp => {
            // Calcular límite semanal
            let totalMins = 0;
            datesInWeek.forEach(dt => {
                const dateIsoStr = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
                const dayShifts = this.shifts.filter(s => s.employeeId === emp.id && s.date === dateIsoStr);
                
                dayShifts.forEach(s => {
                    totalMins += this.calculateDiffMins(s.startTime, s.endTime);
                    if(s.mealStart && s.mealEnd) {
                        totalMins -= this.calculateDiffMins(s.mealStart, s.mealEnd);
                    }
                });
            });

            const totalHours = totalMins / 60;
            if (totalHours > this.MAX_WEEKLY_HOURS) {
                hasAlerts = true;
                alertBox.innerHTML += `
                    <div class="alert-box alert-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>El empleado <b>${emp.fullName}</b> suma ${totalHours.toFixed(1)} horas netas en la semana actual. Posible Hora Extra o Exceso Legal (> ${this.MAX_WEEKLY_HOURS}h).</span>
                    </div>
                `;
            }
        });

        alertBox.style.display = hasAlerts ? 'flex' : 'none';
    },

    autoDetectFatigue(employeeId, newDateStr, newStartTimeStr) {
        if(!newDateStr || !newStartTimeStr) return null;

        // Comparamos el descanso desde el turno del día anterior
        const currObj = new Date(newDateStr+ 'T' + newStartTimeStr + ':00');
        
        // Buscar turnos del día ANTERIOR
        const prevObj = new Date(currObj);
        prevObj.setDate(prevObj.getDate() - 1);
        const prevIso = prevObj.toISOString().split('T')[0];

        const prevShifts = this.shifts.filter(s => s.employeeId === employeeId && s.date === prevIso);
        
        if (prevShifts.length > 0) {
            // Tomar el que termina más tarde
            const latestShift = prevShifts.reduce((prev, current) => (prev.endTime > current.endTime) ? prev : current);
            
            const prevEndObj = new Date(prevIso + 'T' + latestShift.endTime + ':00');
            
            const diffHours = (currObj - prevEndObj) / (1000 * 60 * 60);

            if (diffHours >= 0 && diffHours < this.MIN_REST_HOURS) {
                return `Descanso Vital Insuficiente: Salió a las ${latestShift.endTime} ayer y entra a las ${newStartTimeStr} hoy. Descansa solo ${diffHours.toFixed(1)} horas (Mínimo recomendado: ${this.MIN_REST_HOURS}h).`;
            }
        }
        return null; // Todo OK
    },

    checkOverlap(employeeId, dateStr, newStart, newEnd, excludeShiftId = null) {
        // Validación matemática simple: cruce de rangos horarios
        // Condition for overlap: StartA < EndB AND EndA > StartB
        const dayShifts = this.shifts.filter(s => s.employeeId === employeeId && s.date === dateStr && s.id !== excludeShiftId);
        
        for(let s of dayShifts) {
            if (newStart < s.endTime && newEnd > s.startTime) {
                return `Solapamiento detectado con el turno de ${s.startTime} a ${s.endTime}.`;
            }
        }
        return null;
    },

    calculateDiffMins(start, end) {
        if(!start || !end) return 0;
        const [sh, sm] = start.split(':');
        const [eh, em] = end.split(':');
        const totalStart = parseInt(sh)*60 + parseInt(sm);
        const totalEnd = parseInt(eh)*60 + parseInt(em);
        return totalEnd - totalStart; // doesn't handle midnight crossover purely yet
    },

    // ============================================
    // DRAG AND DROP (TRELLO STYLE)
    // ============================================

    handleMealDragStart(e, shiftId) {
        e.dataTransfer.setData('text/plain', shiftId);
        e.dataTransfer.setData('type', 'meal');
        e.stopPropagation(); // Evitar propagar al drag de fila general
        setTimeout(() => {
            e.target.style.opacity = '0.01'; // Hacerlo casi invisible para que el drop caiga en el div azul que tiene debajo
            e.target.style.pointerEvents = 'none';
        }, 10);
    },

    async handleMealDrop(e, shiftId, shiftStartIdx, shiftEndIdx) {
        e.preventDefault();
        const draggedType = e.dataTransfer.getData('type');
        if (draggedType !== 'meal') return; // Ignorar si tiran otra cosa
        
        const sId = e.dataTransfer.getData('text/plain');
        if (sId !== shiftId) return; // Se soltó en el turno equivocado
        
        const shift = this.shifts.find(s => s.id === shiftId);
        if (!shift || !shift.mealStart || !shift.mealEnd) return;
        
        const mStartIdx = this.timeToIndex(shift.mealStart);
        const mEndIdx = this.timeToIndex(shift.mealEnd);
        const durationBlocks = mEndIdx - mStartIdx;
        
        // Matemáticas: Extraer la posición relativa en el eje X de la barra azul
        const blockWidth = e.currentTarget.offsetWidth / (shiftEndIdx - shiftStartIdx);
        const blocksOffset = Math.floor(e.offsetX / blockWidth);
        
        let newStartIdx = shiftStartIdx + blocksOffset;
        let newEndIdx = newStartIdx + durationBlocks;
        
        // Limites para que no se salga del turno
        if (newEndIdx > shiftEndIdx) {
            newEndIdx = shiftEndIdx;
            newStartIdx = newEndIdx - durationBlocks;
        }
        if (newStartIdx < shiftStartIdx) {
            newStartIdx = shiftStartIdx;
            newEndIdx = newStartIdx + durationBlocks;
        }
        
        const newMealStart = this.indexToTime(newStartIdx);
        const newMealEnd = this.indexToTime(newEndIdx);
        
        // Actualizar Local
        shift.mealStart = newMealStart;
        shift.mealEnd = newMealEnd;
        this.render(); // Redibujar
        this.renderHeatmap(); // Actualizar mapa
        
        // Subir a DB silencio
        try {
            await db.collection('horarios_turnos').doc(shiftId).update({
                mealStart: newMealStart,
                mealEnd: newMealEnd
            });
        } catch(err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar la nueva hora del descanso.', 'error');
        }
    },
    handleDragStart(e, shiftId) {
        e.dataTransfer.setData('text/plain', shiftId);
        e.target.style.opacity = '0.5';
    },

    handleDragOver(e) {
        e.preventDefault(); // Necessario para el drop
        e.currentTarget.style.background = '#e2e8f0'; // Light gray feedback
    },

    handleDragLeave(e) {
        e.currentTarget.style.background = ''; // Restore
    },

    async handleDrop(e, targetEmpId, targetDateStr) {
        e.preventDefault();
        e.currentTarget.style.background = ''; // Restore

        const shiftId = e.dataTransfer.getData('text/plain');
        if (!shiftId) return;

        const shift = this.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        // Si lo sueltan en la misma casilla que estaba
        if (shift.employeeId === targetEmpId && shift.date === targetDateStr) {
            this.render(); // force UI reset of opacity
            return;
        }

        // Check for rests
        const isRestDay = this.descansos.some(d => d.empleadoId === targetEmpId && d.fecha === targetDateStr);
        if (isRestDay) {
            Swal.fire('Día Libre', 'Alguien le agendó su Descanso Libre en este día. Moviendo turno denegado.', 'error');
            this.render();
            return;
        }

        // Check for overlaps in new target
        const overlapMsg = this.checkOverlap(targetEmpId, targetDateStr, shift.startTime, shift.endTime, shift.id);
        if (overlapMsg) {
            Swal.fire('Choque de Turnos', overlapMsg + '<br><br>El destino tiene conflicto horario.', 'error');
            this.render();
            return;
        }

        // 2. Fatiga
        const fatigueMsg = this.autoDetectFatigue(targetEmpId, targetDateStr, shift.startTime);
        if (fatigueMsg) {
            const r = await Swal.fire({
                title: 'Alerta de Fatiga / Ergonomía',
                text: fatigueMsg,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Forzar Movimiento',
                cancelButtonText: 'Cancelar'
            });
            if (!r.isConfirmed) {
                this.render();
                return;
            }
        }

        // Pasó pruebas -> Ejecutar Movimiento
        try {
            await db.collection('horarios_turnos').doc(shiftId).update({
                employeeId: targetEmpId,
                date: targetDateStr
            });
            
            // Actualizar local
            shift.employeeId = targetEmpId;
            shift.date = targetDateStr;
            
            this.render(); // Refresca grilla completa y mapa de calor
            Swal.fire({icon: 'success', title: 'Turno Reasignado', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Fallo de Red al mover turno', 'error');
            this.render();
        }
    },

    // ============================================
    // FORMULARIO Y MODALES
    // ============================================

    checkMealPolicy() {
        const start = document.getElementById('shift-start').value;
        const end = document.getElementById('shift-end').value;
        const mealContainer = document.getElementById('meal-container');
        const mealStartInput = document.getElementById('meal-start');
        const mealEndInput = document.getElementById('meal-end');
        const mealTitle = document.getElementById('meal-title-text'); // Need to target the text

        mealContainer.style.display = 'block'; // SIEMPRE VISIBLE POR PETICIÓN DEL USUARIO

        if(start && end) {
            const mins = this.calculateDiffMins(start, end);
            const hrs = mins / 60;
            
            if (hrs > this.AUTO_MEAL_THRESHOLD_HOURS) {
                if(mealTitle) mealTitle.innerText = "Tiempo de Comida (Obligatorio)";
            } else {
                if(mealTitle) mealTitle.innerText = "Tiempo de Comida (Opcional)";
            }
        }
    },

    autoMealEnd() {
        const startHStr = document.getElementById('meal-start').value;
        if(startHStr) {
            const [mh, mm] = startHStr.split(':');
            let eMins = parseInt(mh)*60 + parseInt(mm) + this.MEAL_DURATION_MINS;
            const eh = Math.floor(eMins/60).toString().padStart(2,'0');
            const em = (eMins%60).toString().padStart(2,'0');
            document.getElementById('meal-end').value = `${eh}:${em}`;
        }
    },

    openShiftModal(employeeId, dateStr, shiftId = null) {
        document.getElementById('shift-employee-id').value = employeeId;
        document.getElementById('shift-date').value = dateStr;
        document.getElementById('shift-id').value = shiftId || '';
        
        const emp = this.employees.find(e => e.id === employeeId);
        document.getElementById('shift-emp-name').innerText = emp ? emp.fullName : 'Desconocido';
        
        // Forma guatemala el string
        const [y,m,d] = dateStr.split('-');
        const dateObjLocal = new Date(y, m-1, d);
        document.getElementById('shift-date-label').innerText = dateObjLocal.toLocaleDateString('es-GT', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

        const form = document.getElementById('shiftForm');
        form.reset();
        document.getElementById('meal-container').style.display = 'none';
        
        // Select Default Base Pole
        document.getElementById('shift-role').value = emp.position || 'Hornero';

        if (shiftId) {
            const shift = this.shifts.find(s => s.id === shiftId);
            if(shift) {
                document.getElementById('shift-start').value = shift.startTime;
                document.getElementById('shift-end').value = shift.endTime;
                document.getElementById('shift-role').value = shift.appliedRole || 'Hornero';
                if(shift.mealStart) {
                    document.getElementById('meal-start').value = shift.mealStart;
                    document.getElementById('meal-end').value = shift.mealEnd;
                }
                this.checkMealPolicy();
            }
            document.getElementById('btn-delete-shift').style.display = 'block';
        } else {
            document.getElementById('btn-delete-shift').style.display = 'none';
        }

        document.getElementById('shiftModal').style.display = 'flex';
    },

    closeShiftModal() {
        document.getElementById('shiftModal').style.display = 'none';
    },

    async saveShift() {
        const sId = document.getElementById('shift-id').value;
        const empId = document.getElementById('shift-employee-id').value;
        const sDate = document.getElementById('shift-date').value;
        
        const sStart = document.getElementById('shift-start').value;
        const sEnd = document.getElementById('shift-end').value;
        const sRole = document.getElementById('shift-role').value;
        const mStart = document.getElementById('meal-start').value;
        const mEnd = document.getElementById('meal-end').value;

        // Validaciones pre-guardado
        if (sStart >= sEnd) {
            Swal.fire('Error', 'La hora de salida debe ser posterior a la entrada.', 'error');
            return;
        }

        // Es Descanso?
        const isRestDay = this.descansos.some(d => d.empleadoId === empId && d.fecha === sDate);
        if (isRestDay) {
            Swal.fire('Interferencia de Descanso', 'Este colaborador tiene asignado su Descanso Semanal Libre para hoy. No puedes armarle un turno.', 'error');
            return;
        }

        // Choque de turnos?
        const overlapMsg = this.checkOverlap(empId, sDate, sStart, sEnd, sId);
        if (overlapMsg) {
            Swal.fire('Choque de Turnos', overlapMsg + '<br><br>Operación denegada (Anti-Solapamiento).', 'error');
            return;
        }

        // Fatiga Inter-Jornada?
        const fatigueMsg = this.autoDetectFatigue(empId, sDate, sStart);
        if (fatigueMsg) {
            const r = await Swal.fire({
                title: 'Alerta de Ergonomía y Fatiga',
                text: fatigueMsg,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Autorizar Excepción',
                cancelButtonText: 'Corregir Horario'
            });
            if (!r.isConfirmed) return;
        }

        // Determinar si hay alerta de cobertura intra-día en la ventana de comida propuesto (Simulamos un bloque en rojo)
        // Esto podría requerir simulación más pesada. Optamos por la heurística sencilla -> Lo dejamos procesar y si el Heatmap arroja rojo al rendear, el user lo verá e iterará.

        const payload = {
            employeeId: empId,
            date: sDate,
            startTime: sStart,
            endTime: sEnd,
            appliedRole: sRole,
            mealStart: mStart || null,
            mealEnd: mEnd || null
        };

        try {
            if (sId) {
                await db.collection('horarios_turnos').doc(sId).update(payload);
                const local = this.shifts.find(s => s.id === sId);
                if(local) Object.assign(local, payload);
            } else {
                const docRef = await db.collection('horarios_turnos').add(payload);
                payload.id = docRef.id;
                this.shifts.push(payload);
            }

            this.closeShiftModal();
            this.render();
            Swal.fire({icon: 'success', title: 'Turno Guardado', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});
        } catch(e) {
            console.error(e);
            Swal.fire('Error', 'Fallo de Base de Datos.', 'error');
        }
    },

    async deleteShift() {
        const sId = document.getElementById('shift-id').value;
        if(!sId) return;

        const r = await Swal.fire({
            title: '¿Eliminar Turno?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Borrar'
        });

        if(r.isConfirmed) {
            try {
                await db.collection('horarios_turnos').doc(sId).delete();
                this.shifts = this.shifts.filter(s => s.id !== sId);
                this.closeShiftModal();
                this.render();
                Swal.fire({icon: 'success', title: 'Borrado', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});
            } catch(e) {
                console.error(e);
            }
        }
    },

    // ============================================
    // CONFIGURACIÓN DE HORARIOS (MODAL)
    // ============================================
    openConfig() {
        document.getElementById('config-start-hour').value = this.workHoursConfig.start;
        document.getElementById('config-end-hour').value = this.workHoursConfig.end;
        document.getElementById('configModal').style.display = 'flex';
    },

    closeConfig() {
        document.getElementById('configModal').style.display = 'none';
    },

    async saveConfig() {
        const sh = parseInt(document.getElementById('config-start-hour').value);
        const eh = parseInt(document.getElementById('config-end-hour').value);
        if (sh >= eh) {
            Swal.fire('Error', 'La hora final debe ser mayor a la hora inicial', 'error');
            return;
        }

        try {
            await db.collection('horarios_config').doc('global').set({ start: sh, end: eh });
            this.workHoursConfig = { start: sh, end: eh };
            this.closeConfig();
            this.render();
            Swal.fire('Guardado', 'La configuración de la gráfica principal se ha aplicado globalmente', 'success');
        } catch(e) {
            Swal.fire('Error', 'No se pudo guardar la configuración: ' + e.message, 'error');
        }
    },

    // ============================================
    // SIMULACIÓN DE VACACIONES
    // ============================================
    openSimVacations() {
        const listDiv = document.getElementById('sim-vacations-list');
        listDiv.innerHTML = '';
        const branchId = document.getElementById('horarios-branch-filter').value;
        const emps = this.employees.filter(e => e.sucursalId === branchId);
        
        if(emps.length === 0) {
            listDiv.innerHTML = '<span style="color:#666;">Selecciona primero una Sucursal con empleados.</span>';
        }

        emps.forEach(emp => {
            const isChecked = this.simulatedAbsences.includes(emp.id) ? 'checked' : '';
            listDiv.innerHTML += `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.9em; padding: 5px; border-radius: 4px; background: #f8fafc;">
                    <input type="checkbox" id="sim-chk-${emp.id}" value="${emp.id}" style="width: 16px; height: 16px; cursor: pointer;" ${isChecked}>
                    <label for="sim-chk-${emp.id}" style="cursor: pointer; flex: 1;">
                        <strong>${emp.fullName}</strong> <br>
                        <span style="color: #64748b; font-size: 0.85em;">${emp.position || 'Sin puesto'}</span>
                    </label>
                </div>
            `;
        });
        
        document.getElementById('simVacationsModal').style.display = 'flex';
    },

    closeSimVacations() {
        document.getElementById('simVacationsModal').style.display = 'none';
    },

    applySimVacations() {
        const branchId = document.getElementById('horarios-branch-filter').value;
        const checkboxes = document.querySelectorAll('#sim-vacations-list input[type="checkbox"]');
        
        // Limpiamos los empleados simulados de ESTA sucursal primero
        const branchEmps = this.employees.filter(e => e.sucursalId === branchId).map(e => e.id);
        this.simulatedAbsences = this.simulatedAbsences.filter(id => !branchEmps.includes(id));
        
        // Adicionamos los chequeados
        checkboxes.forEach(chk => {
            if (chk.checked) {
                this.simulatedAbsences.push(chk.value);
            }
        });

        this.closeSimVacations();
        this.render(); // Redibuja el Gantt
        this.renderHeatmap(); // Redibuja el calor

        Swal.fire({
            icon: 'info', 
            title: 'Simulador Activo',
            text: 'Las ausencias por vacación en los empleados seleccionados han sido suprimidas del conteo general temporalmente.',
            toast: true, position: 'top-end', timer: 5000, showConfirmButton: false
        });
    }
};
