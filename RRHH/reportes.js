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

    downloadImage: async function () {
        const btn = document.querySelector('button[onclick="window.reports.downloadImage()"]');
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;
        }

        try {
            // Generate cleaner title for filename
            let filenameBranch = 'General';
            const filter = document.getElementById('reportBranchFilter');
            if (filter && filter.value !== 'all') {
                filenameBranch = filter.options[filter.selectedIndex].text.replace(/[^a-z0-9]/gi, '_');
            }

            const element = document.getElementById('orgChartContainer');

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: element.scrollWidth + 100,
                width: element.scrollWidth + 50,
                logging: false, // disable logging for speed
                onclone: (clonedDoc) => {
                    const container = clonedDoc.getElementById('orgChartContainer');
                    if (container) {
                        container.style.width = 'fit-content';
                        container.style.margin = '0 auto';
                        container.style.textAlign = 'center';
                    }

                    // Ensure boxes are visible
                    const empNodes = clonedDoc.querySelectorAll('.node-employee');
                    empNodes.forEach(node => {
                        node.style.fontFamily = 'Arial, sans-serif';
                        // Force black text again just in case
                        node.style.color = '#000000';
                    });
                    // Force all text children to black
                    const allText = clonedDoc.querySelectorAll('.node-employee div, .node-employee span, .node-employee');
                    allText.forEach(el => {
                        el.style.color = '#000000';
                        el.style.textShadow = 'none';
                    });

                    const texts = clonedDoc.querySelectorAll('.node-employee div');
                    texts.forEach(t => {
                        // Manually set style property to ensure it sticks
                        t.style.color = '#000000';
                        t.style.fontWeight = 'bold';
                        t.style.textShadow = 'none';
                        t.style.visibility = 'visible';
                    });

                    const roles = clonedDoc.querySelectorAll('.node-role');
                    roles.forEach(r => {
                        r.style.color = '#000000';
                        r.style.textShadow = 'none';
                        r.style.opacity = '1';
                    });
                }
            });

            const link = document.createElement('a');
            link.download = `Organigrama_${filenameBranch}_${new Date().toISOString().slice(0, 10)}.png`;
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
        const element = document.getElementById('orgChartContainer');
        const btn = document.querySelector('#reportes-section button[onclick*="downloadReport"]');

        if (!element) return;

        try {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
            btn.disabled = true;

            // Capture full scroll width
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: element.scrollWidth + 100,
                width: element.scrollWidth + 50
            });

            const imgData = canvas.toDataURL('image/png');

            // Dynamic PDF Size based on Image
            // We want to fit the image on a page, but if it's huge, make the page huge.
            // 1px = 0.75 point approx, let's map pixels to mm roughly.
            // A4 is 210mm width.

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
            pdf.save(`Organigrama_EM_${new Date().toISOString().slice(0, 10)}.pdf`);

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
