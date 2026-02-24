// reportes.js

window.reports = {
    init: async function () {
        console.log("Inicializando Reportes (Organigrama)...");
        // Set current date
        const dateEl = document.getElementById('reportDate');
        if (dateEl) dateEl.innerText = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        await this.renderOrgChart();
    },

    renderOrgChart: async function () {
        const rootUl = document.getElementById('orgChartRoot');
        const filterBranch = document.getElementById('reportBranchFilter');
        const selectedBranchId = filterBranch ? filterBranch.value : 'all';

        if (!rootUl) return;
        rootUl.innerHTML = '<li class="text-center p-4">Cargando estructura...</li>';

        try {
            // 1. Fetch Employees (Active) and Positions to get Job Titles
            const [empSnap, posSnap, branchSnap] = await Promise.all([
                db.collection('employees').where('status', '==', 'active').get(),
                db.collection('positions').get(),
                db.collection('sucursales').get()
            ]);

            if (empSnap.empty) {
                rootUl.innerHTML = '<li>No hay datos para mostrar.</li>';
                return;
            }

            // Maps for lookup & Populate Dropdown if empty
            const branchMap = {};
            const branchesList = [];

            branchSnap.forEach(d => {
                const name = d.data().name || 'Sucursal Desconocida';
                branchMap[d.id] = name;
                branchesList.push({ id: d.id, name: name });
            });

            // Populate Filter if it has only "All" (Initial Load)
            if (filterBranch && filterBranch.options.length === 1) {
                branchesList.sort((a, b) => a.name.localeCompare(b.name)).forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.innerText = b.name;
                    filterBranch.appendChild(opt);
                });
            }

            const positionMap = {};
            posSnap.forEach(d => positionMap[d.id] = d.data().name || 'Puesto Desconocido');

            // 2. Group by Branch
            const treeData = {};
            // Structure: { 'BranchName': [ { name: 'Emp Name', role: 'Role Name' } ] }
            let totalEmployees = 0;

            empSnap.forEach(doc => {
                const emp = doc.data();

                // CHECK FOR TEMPORARY TRANSFER (PRESTAMO)
                // If isTempTransfer is true, show them in the DESTINATION branch
                let branchId = emp.sucursalId || 'unassigned';
                if (emp.isTempTransfer && emp.tempSucursalId) {
                    branchId = emp.tempSucursalId;
                }

                // FILTER CHECK
                if (selectedBranchId !== 'all' && branchId !== selectedBranchId) return;

                const branchName = branchMap[branchId] || 'Sin Asignar';
                const roleId = emp.positionId;
                const roleName = positionMap[roleId] || 'Sin Puesto';

                if (!treeData[branchName]) {
                    treeData[branchName] = [];
                }
                treeData[branchName].push({
                    name: emp.fullName,
                    role: roleName
                });
                totalEmployees++;
            });

            if (totalEmployees === 0) {
                rootUl.innerHTML = '<li>No se encontraron colaboradores con el filtro seleccionado.</li>';
                return;
            }

            // 3. Build HTML Hierarchy
            let html = '';
            const branches = Object.keys(treeData).sort();
            let childrenHtml = ''; // Branch LIs
            let totalEmployeesInChart = 0;

            // Generate Color Helper
            const strToColor = function (str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
                return '#' + "00000".substring(0, 6 - c.length) + c;
            };

            // Fixed Palette for Roles - PASTEL & CONTRAST
            const getRoleColor = (role) => {
                const r = (role || '').toLowerCase();
                // User requested Pastel colors but high contrast
                // Using Tailwind-like shades that are vibrant but pleasant
                if (r.includes('encargado')) return '#eab308'; // Pastel Gold/Yellow (Yellow-500)
                if (r.includes('cocinero') || r.includes('cocinera')) return '#22c55e'; // Pastel Green (Green-500)
                if (r.includes('cajero') || r.includes('cajera')) return '#3b82f6'; // Pastel Blue (Blue-500)
                if (r.includes('motorista')) return '#ef4444'; // Pastel Red (Red-500) - No Purple, Contrast with Yellow

                // Fallback for others: Hash to Pastel
                let hash = 0;
                for (let i = 0; i < role.length; i++) hash = role.charCodeAt(i) + ((hash << 5) - hash);
                const h = Math.abs(hash) % 360;
                return `hsl(${h}, 70%, 60%)`; // Lighter for pastel feel
            };

            branches.forEach(branch => {
                const employees = treeData[branch];
                totalEmployeesInChart += employees.length;

                // Sort by Custom Rank then Name
                const getRank = (role) => {
                    const r = (role || '').toLowerCase();
                    if (r.includes('encargado')) return 1;
                    if (r.includes('cocinero') || r.includes('cocinera')) return 2;
                    if (r.includes('cajero') || r.includes('cajera')) return 3;
                    if (r.includes('motorista')) return 4;
                    return 99; // Others at the end
                };

                // Group by Role
                const employeesByRole = {};
                employees.forEach(e => {
                    // Normalize role for grouping
                    let roleKey = e.role.toUpperCase();
                    // Optional: Unify gendered titles if strictly needed, but let's keep as is for now unless requested.
                    if (!employeesByRole[roleKey]) employeesByRole[roleKey] = [];
                    employeesByRole[roleKey].push(e);
                });

                // Get Roles sorted by Rank
                const sortedRoles = Object.keys(employeesByRole).sort((a, b) => getRank(a) - getRank(b));

                let empHtml = '';
                if (employees.length > 0) {
                    // Start VERTICAL list for employees
                    empHtml = '<ul class="vertical">';

                    sortedRoles.forEach(roleName => {
                        const groupEmps = employeesByRole[roleName];
                        // Sort names within the group
                        groupEmps.sort((a, b) => a.name.localeCompare(b.name));
                        // Determine Color for this group
                        const bgColor = getRoleColor(roleName);

                        // Header for the Group
                        empHtml += `
                            <li class="role-group-li">
                                <span class="role-header">${roleName} (${groupEmps.length})</span>
                            </li>
                        `;

                        // Items - Simple BLACK text for maximum compatibility
                        groupEmps.forEach(e => {
                            empHtml += `
                                <li>
                                    <div class="node-employee" style="background-color: ${bgColor}; border: 1px solid #000; padding: 10px 5px; border-radius: 5px; display: inline-block; min-width: 140px; cursor: default;">
                                        <div style="font-size: 1.1em; font-weight: 800; color: #000000; line-height: 1.2;">${e.name}</div>
                                        <div class="node-role" style="color: #000000; font-size: 0.85em; margin-top: 5px; font-weight: 600;">${e.role}</div>
                                    </div>
                                </li>
                            `;
                        });
                    });

                    empHtml += '</ul>';
                }

                childrenHtml += `
                    <li>
                        <a href="#" class="node-branch">${branch} <br> <span style="font-weight:normal; font-size:0.8em">(${employees.length})</span></a>
                        ${empHtml}
                    </li>
                `;
            });

            // Final Root Structure
            // Title Logic: "ORGANIGRAMA [SUCURSAL]"
            // If viewing all: "ORGANIGRAMA GENERAL"
            const branchName = selectedBranchId && selectedBranchId !== 'all'
                ? (branchMap[selectedBranchId] || 'SUCURSAL').toUpperCase()
                : 'GENERAL';

            const mainTitleText = `ORGANIGRAMA ${branchName}`;

            // Update Title with Total Count
            const mainTitle = document.querySelector('#orgChartContainer h2');
            if (mainTitle) {
                // Remove company name, just show Org Chart Title + Total
                mainTitle.innerHTML = `
                    <div style="font-size: 1.2em; font-weight: 800; color: #1e3a8a; margin-bottom: 5px;">${mainTitleText}</div>
                    <div style="font-size: 0.9em; font-weight: normal; color: #555;">TOTAL COLABORADORES: ${totalEmployeesInChart}</div>
                `;
            }

            // Just rendering the branches directly under a single invisible UL is tricky for centering if we want the line from top.
            // Using a single Root Node "EMPRESA" usually looks best.
            // Let's stick to the current "List of Branches" but ensure styling works.
            // Actually, usually trees have 1 Root.
            // The previous code put branches directly. Let's wrap them in a Root Node "Gerencia General" or "Empresa" if preferred?
            // User didn't strictly ask for a Root Node, just "centered".
            // I'll keep the branches at top level but make sure the UL centers them.

            rootUl.innerHTML = childrenHtml;

        } catch (e) {
            console.error("Error building org chart:", e);
            rootUl.innerHTML = '<li>Error al cargar el organigrama.</li>';
        }
    },

    switchReport: function () {
        const reportType = document.getElementById('reportType').value;
        const orgChartCard = document.getElementById('orgChartContainerCard');
        const collabCard = document.getElementById('collaboratorsReportContainer');

        if (reportType === 'org') {
            if (orgChartCard) orgChartCard.style.display = 'flex';
            if (collabCard) collabCard.style.display = 'none';
            this.renderOrgChart();
        } else if (reportType === 'collaborators') {
            if (orgChartCard) orgChartCard.style.display = 'none';
            if (collabCard) collabCard.style.display = 'block';
            this.renderCollaboratorsReport();
        }
    },

    renderCollaboratorsReport: async function () {
        const tbody = document.getElementById('collaboratorsTableBody');
        const filterBranch = document.getElementById('reportBranchFilter');
        const selectedBranchId = filterBranch ? filterBranch.value : 'all';

        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Cargando colaboradores...</td></tr>';

        try {
            // Reusing the same data source for consistency, though we could optimize.
            // Fetching active employees
            const [empSnap, posSnap, branchSnap] = await Promise.all([
                db.collection('employees').where('status', '==', 'active').get(),
                db.collection('positions').get(),
                db.collection('sucursales').get()
            ]);

            if (empSnap.empty) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay datos disponibles.</td></tr>';
                return;
            }

            const branchMap = {};
            branchSnap.forEach(d => branchMap[d.id] = d.data().name || 'Sucursal Desconocida');

            const positionMap = {};
            posSnap.forEach(d => positionMap[d.id] = d.data().name || 'Sin Puesto');

            const employees = [];
            empSnap.forEach(doc => {
                const emp = doc.data();
                // Handle Temporary Transfers
                let branchId = emp.sucursalId || 'unassigned';
                if (emp.isTempTransfer && emp.tempSucursalId) {
                    branchId = emp.tempSucursalId;
                }

                if (selectedBranchId !== 'all' && branchId !== selectedBranchId) return;

                employees.push({
                    name: emp.fullName,
                    dpi: emp.dpi,
                    sexo: emp.sexo,
                    position: positionMap[emp.positionId] || 'Desconocido',
                    branch: branchMap[branchId] || 'Sin Asignar',
                    startDate: emp.startDate || '',
                    originalDate: emp.startDate ? new Date(emp.startDate) : null
                });
            });

            // Sort by Branch then Name
            employees.sort((a, b) => {
                if (a.branch === b.branch) {
                    return a.name.localeCompare(b.name);
                }
                return a.branch.localeCompare(b.branch);
            });

            if (employees.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No se encontraron colaboradores con el filtro seleccionado.</td></tr>';
                return;
            }

            let html = '';
            employees.forEach(e => {
                // Calculate Seniority
                let seniority = 'N/A';
                if (e.originalDate) {
                    const today = new Date();
                    const diffTime = Math.abs(today - e.originalDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const years = Math.floor(diffDays / 365);
                    const remainingDays = diffDays % 365;
                    const months = Math.floor(remainingDays / 30);

                    if (years > 0) seniority = `${years} años, ${months} meses`;
                    else if (months > 0) seniority = `${months} meses`;
                    else seniority = `${diffDays} días`;
                }

                // Format Date
                const dateStr = e.originalDate ? e.originalDate.toLocaleDateString('es-GT') : 'Sin registro';

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px;"><strong>${e.name}</strong></td>
                        <td style="padding: 12px;">${e.dpi || '-'}</td>
                        <td style="padding: 12px;">${e.sexo || '-'}</td>
                        <td style="padding: 12px;">${e.position}</td>
                        <td style="padding: 12px;"><span style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 12px; font-size: 0.85em;">${e.branch}</span></td>
                        <td style="padding: 12px;">${dateStr}</td>
                        <td style="padding: 12px; text-align: center;">${seniority}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error("Error loading collaborators report:", error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: red;">Error al cargar datos.</td></tr>';
        }
    },

    downloadImage: async function () {
        const btn = document.querySelector('button[onclick="window.reports.downloadImage()"]');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;
        }

        try {
            // Check which report is active
            const reportType = document.getElementById('reportType').value;
            let elementId = 'orgChartContainerCard'; // Default to card container for better BG

            // For collaborators list, we might want a different export logic or just screenshot the table
            if (reportType === 'collaborators') {
                elementId = 'collaboratorsReportContainer';
            }

            // Generate cleaner title for filename
            let filenameBranch = 'General';
            const filter = document.getElementById('reportBranchFilter');
            if (filter && filter.value !== 'all') {
                filenameBranch = filter.options[filter.selectedIndex].text.replace(/[^a-z0-9]/gi, '_');
            }

            const element = document.getElementById(elementId);
            // Ensure white background for capture
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = '#ffffff';

            const canvas = await html2canvas(element, {
                scale: 2, // Good quality
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    // Verify visibility hacks if needed
                    const el = clonedDoc.getElementById(elementId);
                    if (el) el.style.display = 'block';
                }
            });

            element.style.backgroundColor = originalBg; // Restore

            const link = document.createElement('a');
            link.download = `Reporte_${reportType}_${filenameBranch}_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (err) {
            console.error("Export Error:", err);
            Swal.fire('Error', 'No se pudo generar la imagen', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },

    downloadReport: async function () {
        // PDF Export
        const { jsPDF } = window.jspdf;
        const reportType = document.getElementById('reportType').value;

        let elementId = 'orgChartContainerCard';
        if (reportType === 'collaborators') elementId = 'collaboratorsReportContainer';

        const element = document.getElementById(elementId);
        const btn = document.querySelector('#reportes-section button[onclick*="downloadReport"]');

        if (!element) return;

        try {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
            btn.disabled = true;

            // Ensure white background for capture
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = '#ffffff';

            // Capture full scroll width
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            element.style.backgroundColor = originalBg;

            const imgData = canvas.toDataURL('image/png');

            // Dynamic PDF Size based on Image
            const imgWidthpx = canvas.width;
            const imgHeightpx = canvas.height;

            // Convert px to mm (approximation for screen 96dpi => 1px = 0.264mm)
            const pxToMm = 0.264583;
            const pdfWidth = (imgWidthpx * pxToMm) + 20; // +20mm margin
            const pdfHeight = (imgHeightpx * pxToMm) + 20;

            // Allow minimum A4 size (210 x 297), otherwise custom
            const minW = 210;
            const minH = 297;

            const finalW = Math.max(minW, pdfWidth);
            const finalH = Math.max(minH, pdfHeight);

            // Create PDF with custom size matching the content
            const pdf = new jsPDF({
                orientation: finalW > finalH ? 'l' : 'p',
                unit: 'mm',
                format: [finalW, finalH]
            });

            // Add image centered/margined
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidthpx * pxToMm, imgHeightpx * pxToMm);
            pdf.save(`Reporte_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);

            btn.innerHTML = originalText;
            btn.disabled = false;

        } catch (e) {
            console.error("PDF Generation Error:", e);
            Swal.fire('Error', 'No se pudo generar el PDF', 'error');
            btn.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar PDF';
            btn.disabled = false;
        }
    }
};
