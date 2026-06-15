async function printConstanciaLaboral(id) {
    try {
        const doc = await db.collection('employees').doc(id).get();
        if (!doc.exists) {
            Swal.fire('Error', 'No se encontró el empleado', 'error');
            return;
        }
        const data = doc.data();

        let branchAddress = '';
        let repFullName = '';
        let firmaBase64 = '';
        let repPhone = ''; // To show in the footer
        let empresaName = '';

        try {
            if (data.sucursalId) {
                const sucDoc = await db.collection('sucursales').doc(data.sucursalId).get();
                if (sucDoc.exists) {
                    const sucData = sucDoc.data();
                    // Concat sucursal location string
                    branchAddress = sucData.address || sucData.name || '';
                    if (sucData.empresaId) {
                        const empDoc = await db.collection('empresas').doc(sucData.empresaId).get();
                        if (empDoc.exists) {
                            const empData = empDoc.data();
                            repPhone = empData.phone || '';
                            empresaName = empData.name || '';

                            if (empData.representativeId) {
                                const repDoc = await db.collection('representantes').doc(empData.representativeId).get();
                                if (repDoc.exists) {
                                    const r = repDoc.data();
                                    repFullName = r.fullName || '';
                                    firmaBase64 = r.firmaBase64 || '';
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error loading enterprise/representative details", e);
        }

        const today = new Date();
        const startD = data.startDate ? new Date(data.startDate) : today;
        const startDay = startD.getDate();
        const startMonthName = startD.toLocaleString('es-GT', { month: 'long' });
        const startYear = startD.getFullYear();
        
        // Format current date
        const printDay = today.getDate();
        const printMonth = today.toLocaleString('es-GT', { month: 'long' });
        const printYear = today.getFullYear();
        
        // Convert numbers to words for the date, simplified:
        const n2w = {
            1: "un", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
            11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince", 16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
            21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro", 25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve", 30: "treinta", 31: "treinta y uno"
        };
        const dayWord = n2w[printDay] || printDay.toString();
        
        let yearWord = printYear.toString();
        if (printYear === 2024) yearWord = "dos mil veinticuatro";
        else if (printYear === 2025) yearWord = "dos mil veinticinco";
        else if (printYear === 2026) yearWord = "dos mil veintiséis";
        else if (printYear === 2027) yearWord = "dos mil veintisiete";

        const laboroText = data.status === 'active' ? 'labora' : 'laboró';

        let endDateText = 'la fecha';
        let endDForCalc = today;
        if (data.status === 'inactive' && data.endDate) {
            const endD = new Date(data.endDate);
            endDForCalc = endD;
            endDateText = `el ${endD.getDate()} de ${endD.toLocaleString('es-GT', { month: 'long' })} de ${endD.getFullYear()}`;
        }

        let yearsWorked = endDForCalc.getFullYear() - startD.getFullYear();
        let monthsWorked = endDForCalc.getMonth() - startD.getMonth();
        let daysWorked = endDForCalc.getDate() - startD.getDate();

        if (daysWorked < 0) {
            monthsWorked--;
            const prevMonth = new Date(endDForCalc.getFullYear(), endDForCalc.getMonth(), 0);
            daysWorked += prevMonth.getDate();
        }
        if (monthsWorked < 0) {
            yearsWorked--;
            monthsWorked += 12;
        }

        let timeWorkedParts = [];
        if (yearsWorked > 0) timeWorkedParts.push(yearsWorked + (yearsWorked === 1 ? ' año' : ' años'));
        if (monthsWorked > 0) timeWorkedParts.push(monthsWorked + (monthsWorked === 1 ? ' mes' : ' meses'));
        if (daysWorked > 0 || timeWorkedParts.length === 0) timeWorkedParts.push(daysWorked + (daysWorked === 1 ? ' día' : ' días'));
        const timeWorkedText = timeWorkedParts.join(', ').replace(/, ([^,]*)$/, ' y $1');

        const isAdministration = data.positionName && data.positionName.toLowerCase().includes('administraci');
        const salaryText = isAdministration 
            ? 'devengando el salario mínimo de ley más bonificación de 300 quetzales.'
            : 'devengando el sueldo mínimo establecido por la ley, más la bonificación decreto 76-78.';

        let letterheadImg = '../resources/images/membrete corporacion.png';
        const empNameUpper = empresaName.toUpperCase();
        if (empNameUpper.includes('VIPIZZA')) {
            letterheadImg = '../resources/images/membrete vipizza.png';
        } else if (empNameUpper.includes('AMERICAN') || empNameUpper.includes('PEDIDO') || empNameUpper.includes('FLASH')) {
            letterheadImg = '../resources/images/membrete american pizza.png';
        }

        const finalFirma = firmaBase64 ? firmaBase64 : '../resources/images/firma rp.png';
        const firmaImgHtml = `<img src="${finalFirma}" alt="Firma" style="max-width: 200px; max-height: 100px; display: block; margin: 0 auto 5px;">`;

        const letterHtml = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <style>
                    /* Remove Browser Headers/Footers */
                    @page {
                        margin: 0;
                        size: auto;
                    }
                    body {
                        font-family: "Times New Roman", Times, serif;
                        font-size: 13pt;
                        line-height: 1.5;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        color: #000;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .page {
                        width: 8.5in;
                        height: 11in;
                        padding: 2.2in 1.2in 1.2in 1.2in;
                        box-sizing: border-box;
                        position: relative;
                        margin: 0 auto;
                        background-image: url('${letterheadImg}');
                        background-size: 100% 100%;
                        background-repeat: no-repeat;
                    }
                    .content-container {
                        text-align: justify;
                    }
                    .title {
                        text-align: center;
                        font-weight: bold;
                        font-size: 14pt;
                        text-decoration: underline;
                        margin-bottom: 50px;
                    }
                    .paragraph {
                        margin-bottom: 25px;
                    }
                    .signature-area {
                        margin-top: 80px;
                        text-align: center;
                    }
                    .sign-line {
                        border-top: 1px solid black;
                        width: 350px;
                        margin: 0 auto;
                        margin-top: 5px;
                    }
                    .sign-name {
                        font-weight: bold;
                        margin-top: 5px;
                        font-size: 12pt;
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="content-container">
                        <div class="title">A QUIEN INTERESE</div>

                    <div class="paragraph">
                        Por medio de la presente hacemos constar que el(la) joven, <strong>${data.fullName ? data.fullName.toUpperCase() : ''}</strong>, 
                        que se identifica con DPI # <strong>${data.dpi || 'N/A'}</strong>, quien ${laboroText} en nuestra empresa, ubicada en 
                        ${branchAddress}; por un periodo de <strong>${timeWorkedText}</strong>, comprendido desde el ${startDay} de ${startMonthName} de ${startYear} hasta 
                        ${endDateText}, ${salaryText}
                    </div>

                    <div class="paragraph">
                        Para los usos legales que al interesado convengan se extiende la presente a los ${dayWord} días del mes de ${printMonth} del año ${yearWord}.
                    </div>

                    <div class="paragraph">
                        Quedo a sus órdenes en caso de que requieran alguna información adicional.
                    </div>

                    <div class="paragraph" style="text-align: center; margin-top: 40px;">
                        Atentamente,
                    </div>

                    <div class="signature-area">
                        ${firmaImgHtml}
                        <div class="sign-line"></div>
                        <div class="sign-name">${repFullName ? repFullName.toUpperCase() : 'REPRESENTANTE LEGAL'}</div>
                        <div style="font-size: 11pt;">Representante Legal</div>
                        
                    </div>
                </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(letterHtml);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 500);

    } catch (e) {
        console.error("Error generating constancia:", e);
        Swal.fire('Error', 'No se pudo generar la constancia', 'error');
    }
}
