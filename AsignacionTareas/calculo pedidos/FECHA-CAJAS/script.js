// Funcionalidad JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Mostrar la fecha de hoy en la sección de entrada
    const hoy = new Date();
    document.getElementById('fechaHoy').textContent = formatDate(hoy);
});

document.getElementById('inventoryForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Obtener los totales ingresados y asegurarse de que sean números
    const cajasPizzaAmerican = parseInt(document.getElementById('cajasPizzaAmerican').value) || 0;
    const cajasPizzaVipizza = parseInt(document.getElementById('cajasPizzaVipizza').value) || 0;
    const cajasFingersAmerican = parseInt(document.getElementById('cajasFingersAmerican').value) || 0;
    const cajasFingersVipizza = parseInt(document.getElementById('cajasFingersVipizza').value) || 0;

    // Definición de productos y sucursales
    const products = [
        {
            name: "Cajas Pizza American Pizza",
            totalMonthly: 12992,
            branches: [
                { name: "Eskala", monthly: 2460 },
                { name: "Pinula", monthly: 4639 },
                { name: "Santa Elena", monthly: 5893 }
            ],
            total: cajasPizzaAmerican
        },
        {
            name: "Cajas Pizza VIPIZZA",
            totalMonthly: 13500,
            branches: [
                { name: "Jalapa", monthly: 3462 },
                { name: "Poptun", monthly: 3992 },
                { name: "Zacapa", monthly: 5706 }
            ],
            total: cajasPizzaVipizza
        },
        {
            name: "Cajas FINGERS American Pizza",
            totalMonthly: 877, // 211 + 379 + 287
            branches: [
                { name: "Eskala", monthly: 211 },
                { name: "Pinula", monthly: 379 },
                { name: "Santa Elena", monthly: 287 }
            ],
            total: cajasFingersAmerican
        },
        {
            name: "Cajas FINGERS VIPIZZA",
            totalMonthly: 1279, // 356 + 312 + 611
            branches: [
                { name: "Jalapa", monthly: 356 },
                { name: "Poptun", monthly: 312 },
                { name: "Zacapa", monthly: 611 }
            ],
            total: cajasFingersVipizza
        }
    ];

    // Calcular consumo diario total por producto y redondear a enteros
    const consumoDiarioTotal = products.map(product => ({
        name: product.name,
        daily: Math.round(product.totalMonthly / 30)
    }));

    // Generar tabla de consumo por sucursal
    const consumoTable = document.getElementById('consumoTable');
    consumoTable.innerHTML = ''; // Limpiar tabla

    products.forEach(product => {
        product.branches.forEach(branch => {
            const row = document.createElement('tr');

            const sucursalCell = document.createElement('td');
            sucursalCell.textContent = branch.name;
            row.appendChild(sucursalCell);

            const productoCell = document.createElement('td');
            productoCell.textContent = product.name;
            row.appendChild(productoCell);

            const consumoMensualCell = document.createElement('td');
            consumoMensualCell.textContent = branch.monthly;
            row.appendChild(consumoMensualCell);

            const consumoDiarioCell = document.createElement('td');
            consumoDiarioCell.textContent = Math.round(branch.monthly / 30);
            row.appendChild(consumoDiarioCell);

            consumoTable.appendChild(row);
        });
    });

    // Calcular meses restantes y fechas de agotamiento
    const hoy = new Date();

    const resultados = products.map(product => {
        const mesesLeft = product.total / product.totalMonthly;
        const fechaAgotamiento = addMonths(hoy, mesesLeft);
        return {
            name: product.name,
            mesesLeft: mesesLeft,
            fechaAgotamiento: fechaAgotamiento
        };
    });

    // Mostrar consumo diario total
    consumoDiarioTotal.forEach(item => {
        let elementId;
        switch(item.name) {
            case "Cajas Pizza American Pizza":
                elementId = "consumoPizzaAmerican";
                break;
            case "Cajas Pizza VIPIZZA":
                elementId = "consumoPizzaVipizza";
                break;
            case "Cajas FINGERS American Pizza":
                elementId = "consumoFingersAmerican";
                break;
            case "Cajas FINGERS VIPIZZA":
                elementId = "consumoFingersVipizza";
                break;
            default:
                elementId = null;
        }

        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = item.daily;
            }
        }
    });

    // Mostrar fechas de agotamiento por producto
    resultados.forEach(result => {
        let fechaId;
        switch(result.name) {
            case "Cajas Pizza American Pizza":
                fechaId = "fechaAgotamientoPizzaAmerican";
                break;
            case "Cajas Pizza VIPIZZA":
                fechaId = "fechaAgotamientoPizzaVipizza";
                break;
            case "Cajas FINGERS American Pizza":
                fechaId = "fechaAgotamientoFingersAmerican";
                break;
            case "Cajas FINGERS VIPIZZA":
                fechaId = "fechaAgotamientoFingersVipizza";
                break;
            default:
                fechaId = null;
        }

        if (fechaId) {
            const dateSpan = document.getElementById(fechaId);
            if (dateSpan) {
                dateSpan.textContent = formatDate(result.fechaAgotamiento);
            }
        }
    });

    // Separar fechas de agotamiento por categoría (Cajas y Fingers)
    const fechasCajas = resultados.filter(result => result.name.includes("Cajas Pizza"));
    const fechasFingers = resultados.filter(result => result.name.includes("Cajas FINGERS"));

    // Encontrar la fecha de agotamiento más temprana para cada categoría
    const fechaAgotamientoCajas = fechasCajas.reduce((minDate, current) => {
        return current.fechaAgotamiento < minDate ? current.fechaAgotamiento : minDate;
    }, fechasCajas[0].fechaAgotamiento);

    const fechaAgotamientoFingers = fechasFingers.reduce((minDate, current) => {
        return current.fechaAgotamiento < minDate ? current.fechaAgotamiento : minDate;
    }, fechasFingers[0].fechaAgotamiento);

    // Calcular fechas recomendadas para próximos pedidos restando 15 días
    const fechaRecomendadoCajas = new Date(fechaAgotamientoCajas);
    fechaRecomendadoCajas.setDate(fechaRecomendadoCajas.getDate() - 15);

    const fechaRecomendadoFingers = new Date(fechaAgotamientoFingers);
    fechaRecomendadoFingers.setDate(fechaRecomendadoFingers.getDate() - 15);

    // Mostrar fechas recomendadas para próximos pedidos
    document.getElementById('fechaRecomendadoCajas').textContent = formatDate(fechaRecomendadoCajas);
    document.getElementById('fechaRecomendadoFingers').textContent = formatDate(fechaRecomendadoFingers);

    // Mostrar fecha de reporte
    document.getElementById('fechaReporte').textContent = formatDate(hoy);

    // Mostrar la sección de resultados
    document.getElementById('resultSection').style.display = 'block';
});

// Función para añadir meses a una fecha
function addMonths(date, months) {
    const d = new Date(date);
    const wholeMonths = Math.floor(months);
    const fractional = months - wholeMonths;
    d.setMonth(d.getMonth() + wholeMonths);
    // Agregar días basados en la fracción del mes
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(d.getDate() + Math.round(fractional * daysInMonth));
    return d;
}

// Función para formatear la fecha
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}
