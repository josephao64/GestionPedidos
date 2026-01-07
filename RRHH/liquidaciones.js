// liquidaciones.js

const Liquidaciones = {

    /**
     * Generate a Simple Payment Slip for Probation Termination
     * @param {Object} employee - Employee Data
     * @param {number} daysWorked - Number of days to pay
     * @param {number} dailySalary - Calculated daily salary
     */
    generateProbationSlip: function (employee, daysWorked, dailySalary) {
        const totalPay = (daysWorked * dailySalary).toFixed(2);
        const date = new Date().toLocaleDateString();

        // Template for the Payment Slip
        const slipHTML = `
            <div style="font-family: 'Courier New', monospace; padding: 20px; border: 2px solid #000; max-width: 400px; margin: 0 auto; background: #fff; color: #000;">
                <h3 style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-top: 0;">BOLETA DE LIQUIDACIÓN<br>(PERÍODO DE PRUEBA)</h3>
                
                <div style="margin-bottom: 15px;">
                    <p><strong>FECHA:</strong> ${date}</p>
                    <p><strong>EMPLEADO:</strong> ${employee.fullName}</p>
                    <p><strong>DPI:</strong> ${employee.dpi}</p>
                    <p><strong>PUESTO:</strong> ${employee.positionName}</p>
                </div>

                <table style="width: 100%; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-bottom: 15px; text-align: left;">
                    <tr>
                        <th style="padding: 5px 0;">CONCEPTO</th>
                        <th style="padding: 5px 0; text-align: right;">MONTO</th>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;">Días Trabajados (${daysWorked})</td>
                        <td style="padding: 5px 0; text-align: right;">Q${totalPay}</td>
                    </tr>
                </table>

                <div style="text-align: right; margin-bottom: 20px;">
                    <h4 style="margin: 0;">TOTAL: Q${totalPay}</h4>
                </div>

                <div style="text-align: center; font-size: 0.8em; color: #555;">
                    <p>__________________________<br>Firma de Recibido</p>
                </div>
            </div>
        `;

        // Show/Print Logic
        Swal.fire({
            title: 'Boleta Generada',
            html: slipHTML,
            width: 500,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-print"></i> Imprimir',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#3085d6',
        }).then((result) => {
            if (result.isConfirmed) {
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow.document.write('<html><head><title>Boleta de Pago</title></head><body>');
                printWindow.document.write(slipHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            }
        });
    },

    /**
     * Placeholder for Standard Liquidation (Calculo Completo)
     */
    showStandardProcess: function (employee) {
        Swal.fire({
            title: 'Proceso de Baja Estándar',
            icon: 'info',
            html: `
                <p>El empleado <strong>${employee.fullName}</strong> ya superó el período de prueba.</p>
                <p>Debe proceder con el cálculo de liquidación completa (Indemnización, Aguinaldo, Bono 14, Vacaciones).</p>
                <br>
                <p style="font-size: 0.9em; color: gray;">Este módulo avanzado está en desarrollo.</p>
            `,
            confirmButtonText: 'Entendido'
        });
    }

};

window.Liquidaciones = Liquidaciones;
