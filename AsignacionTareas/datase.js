/* estadisticas.js */

/* ====================================================
   VARIABLES GLOBALES Y DATOS INICIALES
   ==================================================== */

// Fechas actuales para ejemplos
const hoy = new Date();
const hoyStr = hoy.toISOString().split("T")[0];
const ayer = new Date();
ayer.setDate(hoy.getDate() - 1);
const ayerStr = ayer.toISOString().split("T")[0];

// Variable global para almacenar las ventas  
// Cada objeto: { date, efectivo, tarjeta, total }
let salesData = [
  { date: ayerStr, efectivo: 1000, tarjeta: 1000, total: 2000 },
  { date: hoyStr, efectivo: 1200, tarjeta: 1300, total: 2500 }
];

// Variable para saber si se está editando un registro (null = nuevo)
let currentEditIndex = null;

// Variable para la gráfica de ventas diarias
let dailySalesChart;

// Variable global para el modo de visualización de la gráfica  
// Valores posibles: "total", "efectivo", "tarjeta", "ambos"
let selectedSaleType = "total";

/* ====================================================
   FUNCIONES AUXILIARES
   ==================================================== */

/**
 * Retorna el número de días en un mes dado el año y el mes.
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/* ====================================================
   GRÁFICO DE VENTAS DIARIAS
   ==================================================== */
/**
 * Actualiza o crea la gráfica de ventas diarias.  
 * Si el modo es "ambos", se muestran dos series (efectivo y tarjeta).  
 * En los otros modos se muestra una única serie junto con la línea de promedio.
 */
function updateDailySalesChart() {
  const year = parseInt(document.getElementById("chartFilterYear").value);
  const month = parseInt(document.getElementById("chartFilterMonth").value);

  if (!year || !month) {
    alert("Por favor seleccione año y mes para actualizar la gráfica.");
    return;
  }

  const daysInMonth = getDaysInMonth(year, month);
  const labels = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = ("0" + d).slice(-2);
    const monthStr = ("0" + month).slice(-2);
    labels.push(`${dayStr}/${monthStr}`);
  }

  const ctx = document.getElementById("dailySalesChart").getContext("2d");
  if (dailySalesChart) {
    dailySalesChart.destroy();
  }

  if (selectedSaleType === "ambos") {
    const efectivoData = new Array(daysInMonth).fill(0);
    const tarjetaData = new Array(daysInMonth).fill(0);

    salesData.forEach((sale) => {
      const saleDate = new Date(sale.date);
      if (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() + 1 === month
      ) {
        const day = saleDate.getDate();
        efectivoData[day - 1] += sale.efectivo;
        tarjetaData[day - 1] += sale.tarjeta;
      }
    });

    dailySalesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ventas Efectivo (Q)",
            data: efectivoData,
            fill: false,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 1)",
            pointRadius: 5,
            tension: 0.2,
          },
          {
            label: "Ventas Tarjeta (Q)",
            data: tarjetaData,
            fill: false,
            borderColor: "rgba(54, 162, 235, 1)",
            backgroundColor: "rgba(54, 162, 235, 1)",
            pointRadius: 5,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { mode: "index", intersect: false },
          legend: { position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Ventas (Q)" },
          },
          x: {
            title: { display: true, text: "Día/Mes" },
          },
        },
      },
    });
  } else {
    const data = new Array(daysInMonth).fill(0);
    salesData.forEach((sale) => {
      const saleDate = new Date(sale.date);
      if (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() + 1 === month
      ) {
        const day = saleDate.getDate();
        if (selectedSaleType === "efectivo") {
          data[day - 1] += sale.efectivo;
        } else if (selectedSaleType === "tarjeta") {
          data[day - 1] += sale.tarjeta;
        } else {
          data[day - 1] += sale.total;
        }
      }
    });

    // Línea de promedio diario
    const total = data.reduce((sum, val) => sum + val, 0);
    const avg = total / daysInMonth;
    const avgLineData = new Array(daysInMonth).fill(avg);

    let labelText = "";
    if (selectedSaleType === "efectivo") {
      labelText = "Ventas Efectivo (Q)";
    } else if (selectedSaleType === "tarjeta") {
      labelText = "Ventas Tarjeta (Q)";
    } else {
      labelText = "Ventas Totales (Q)";
    }

    dailySalesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: labelText,
            data: data,
            fill: false,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 1)",
            pointRadius: 5,
            tension: 0.2,
          },
          {
            label: "Promedio Diario",
            data: avgLineData,
            borderColor: "rgba(255, 99, 132, 1)",
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { mode: "index", intersect: false },
          legend: { position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Ventas (Q)" },
          },
          x: {
            title: { display: true, text: "Día/Mes" },
          },
        },
      },
    });
  }
}

/**
 * Establece el modo de visualización de la gráfica.
 * @param {string} type - "total", "efectivo", "tarjeta" o "ambos"
 */
function setSaleType(type) {
  selectedSaleType = type;
  updateDailySalesChart();
}

/* ====================================================
   INDICADORES DEL DASHBOARD (POR MES)
   ==================================================== */
/**
 * Actualiza los indicadores del dashboard utilizando los datos del mes
 * seleccionado (según chartFilterYear y chartFilterMonth).
 */
function updateIndicators() {
  const year = parseInt(document.getElementById("chartFilterYear").value);
  const month = parseInt(document.getElementById("chartFilterMonth").value);
  if (!year || !month) return;

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthName = monthNames[month - 1];
  document.getElementById("dashboardMonthInfo").innerText =
    "Datos para: " + monthName + " " + year;

  const monthSales = salesData.filter((sale) => {
    const saleDate = new Date(sale.date);
    return (
      saleDate.getFullYear() === year &&
      saleDate.getMonth() + 1 === month
    );
  });
  const totalEfectivo = monthSales.reduce((sum, sale) => sum + sale.efectivo, 0);
  const totalTarjeta = monthSales.reduce((sum, sale) => sum + sale.tarjeta, 0);
  const totalSales = monthSales.reduce((sum, sale) => sum + sale.total, 0);
  const avgTotalSale = monthSales.length > 0 ? totalSales / monthSales.length : 0;

  document.getElementById("totalEfectivoToday").innerText =
    "Q" + totalEfectivo.toFixed(2);
  document.getElementById("totalTarjetaToday").innerText =
    "Q" + totalTarjeta.toFixed(2);
  document.getElementById("totalTotalToday").innerText =
    "Q" + totalSales.toFixed(2);
  document.getElementById("avgTotalSale").innerText =
    "Q" + avgTotalSale.toFixed(2);
}

/* ====================================================
   TENDENCIA DEL MES
   ==================================================== */
/**
 * Calcula y muestra la tendencia de ventas del mes seleccionado en comparación
 * con el mes anterior.
 */
function showTrend() {
  const year = parseInt(document.getElementById("chartFilterYear").value);
  const month = parseInt(document.getElementById("chartFilterMonth").value);
  if (!year || !month) {
    alert("Por favor seleccione año y mes en el dashboard.");
    return;
  }

  // Ventas del mes actual
  const monthSales = salesData.filter((sale) => {
    const saleDate = new Date(sale.date);
    return (
      saleDate.getFullYear() === year &&
      saleDate.getMonth() + 1 === month
    );
  });
  const currentTotal = monthSales.reduce((sum, sale) => sum + sale.total, 0);

  // Determinar mes anterior
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const prevMonthSales = salesData.filter((sale) => {
    const saleDate = new Date(sale.date);
    return (
      saleDate.getFullYear() === prevYear &&
      saleDate.getMonth() + 1 === prevMonth
    );
  });
  const prevTotal = prevMonthSales.reduce((sum, sale) => sum + sale.total, 0);

  let trendText = "";
  if (prevTotal > 0) {
    const trendPercentage = ((currentTotal - prevTotal) / prevTotal) * 100;
    const trendIcon = trendPercentage >= 0 ? "🔼" : "🔽";
    trendText =
      "Tendencia: " +
      trendIcon +
      " " +
      Math.abs(trendPercentage).toFixed(2) +
      "% (Comparado con " +
      prevMonth +
      "/" +
      prevYear +
      ")";
  } else {
    trendText = "Tendencia: N/A (sin datos del mes anterior)";
  }
  document.getElementById("trendIndicator").innerText = trendText;
}

/* ====================================================
   LISTADO DE VENTAS DETALLADAS (CRUD)
   ==================================================== */
/**
 * Carga y muestra la tabla de ventas detalladas filtrando según los selectores.
 * Si el usuario no ha seleccionado un año o mes, se muestra un mensaje indicándolo.
 */
function loadSalesDetailed() {
  const filterYear = document.getElementById("filterYear").value;
  const filterMonth = document.getElementById("filterMonth").value;
  const tableBody = document.getElementById("salesTableBody");
  
  // Si no se selecciona año y mes, muestra un mensaje y limpia la tabla.
  if (filterYear === "" || filterMonth === "") {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Por favor, ingrese primero el mes y el año para cargar los datos.</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = "";
  
  // Mapear ventas para conservar el índice original
  const filteredSales = salesData
    .map((sale, idx) => ({ sale, idx }))
    .filter((item) => {
      const saleDate = new Date(item.sale.date);
      let match = true;
      if (filterYear !== "") {
        match = match && saleDate.getFullYear().toString() === filterYear;
      }
      if (filterMonth !== "") {
        match = match && (saleDate.getMonth() + 1).toString() === filterMonth;
      }
      return match;
    });

  filteredSales.forEach((item) => {
    const record = item.sale;
    const origIndex = item.idx;
    const tr = document.createElement("tr");

    // Formatear la fecha (DD/MM/YYYY)
    const parts = record.date.split("-");
    const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

    // Obtener el nombre del día en español
    const dateObj = new Date(record.date);
    const options = { weekday: "long" };
    const dayName = dateObj.toLocaleDateString("es-ES", options);

    const tdDate = document.createElement("td");
    tdDate.textContent = formattedDate;
    const tdDay = document.createElement("td");
    tdDay.textContent = dayName;
    const tdEfectivo = document.createElement("td");
    tdEfectivo.textContent = "Q" + Number(record.efectivo).toFixed(2);
    const tdTarjeta = document.createElement("td");
    tdTarjeta.textContent = "Q" + Number(record.tarjeta).toFixed(2);
    const tdTotal = document.createElement("td");
    tdTotal.textContent = "Q" + Number(record.total).toFixed(2);

    const tdActions = document.createElement("td");
    const btnEdit = document.createElement("button");
    btnEdit.className = "btn btn-sm btn-primary me-1";
    btnEdit.innerHTML = '<i class="fa-solid fa-pencil"></i>';
    btnEdit.onclick = () => editSale(origIndex);

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-sm btn-danger";
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.onclick = () => deleteSale(origIndex);

    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDelete);

    tr.appendChild(tdDate);
    tr.appendChild(tdDay);
    tr.appendChild(tdEfectivo);
    tr.appendChild(tdTarjeta);
    tr.appendChild(tdTotal);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });
}

/**
 * Guarda una nueva venta o actualiza una existente.
 */
function saveSale() {
  const saleDate = document.getElementById("saleDate").value;
  const saleEfectivo = parseFloat(document.getElementById("saleEfectivo").value);
  const saleTarjeta = parseFloat(document.getElementById("saleTarjeta").value);

  if (!saleDate || isNaN(saleEfectivo) || isNaN(saleTarjeta)) {
    alert("Por favor complete todos los campos con valores válidos.");
    return;
  }

  const saleTotal = saleEfectivo + saleTarjeta;
  const saleObj = {
    date: saleDate,
    efectivo: saleEfectivo,
    tarjeta: saleTarjeta,
    total: saleTotal,
  };

  if (currentEditIndex === null) {
    salesData.push(saleObj);
  } else {
    salesData[currentEditIndex] = saleObj;
    currentEditIndex = null;
    document.getElementById("saleModalLabel").innerText = "Agregar Venta Diaria";
  }

  loadSalesDetailed();
  updateIndicators();
  updateDailySalesChart();

  const saleModalEl = document.getElementById("saleModal");
  const saleModal = bootstrap.Modal.getInstance(saleModalEl);
  saleModal.hide();
  document.getElementById("saleForm").reset();
}

/**
 * Abre el modal para editar una venta existente.
 */
function editSale(index) {
  currentEditIndex = index;
  const sale = salesData[index];
  document.getElementById("saleDate").value = sale.date;
  document.getElementById("saleEfectivo").value = sale.efectivo;
  document.getElementById("saleTarjeta").value = sale.tarjeta;
  document.getElementById("saleModalLabel").innerText = "Editar Venta Diaria";

  const saleModal = new bootstrap.Modal(document.getElementById("saleModal"));
  saleModal.show();
}

/**
 * Elimina una venta del listado.
 */
function deleteSale(index) {
  if (confirm("¿Está seguro de eliminar esta venta?")) {
    salesData.splice(index, 1);
    loadSalesDetailed();
    updateIndicators();
    updateDailySalesChart();
  }
}

/* ====================================================
   BOTÓN PARA MINIMIZAR EL MENÚ CON DESLIZAMIENTO
   ==================================================== */
/**
 * Alterna la visibilidad y el ancho del menú lateral, oculta el texto y
 * ajusta el margen del contenido principal para que se expanda.
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebarMenu");
  const mainContent = document.querySelector("main");
  sidebar.classList.toggle("minimized");
  mainContent.classList.toggle("minimized");
}

/* ====================================================
   GRÁFICOS ADICIONALES (Barras, Pastel) – Dummy Data
   ==================================================== */
// Si existen los elementos, se generan los gráficos adicionales.
if (document.getElementById("barChartPreviousDays")) {
  function generateBarChartPreviousDays() {
    const ctx = document.getElementById("barChartPreviousDays").getContext("2d");
    const previousDaysData = {
      labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      data: [3000, 3200, 2800, 3500, 3600, 3300, 3100],
    };
    barChartPreviousDays = new Chart(ctx, {
      type: "bar",
      data: {
        labels: previousDaysData.labels,
        datasets: [
          {
            label: "Ventas Diarias (Q)",
            data: previousDaysData.data,
            backgroundColor: "rgba(54, 162, 235, 0.7)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Ventas (Q)" } },
          x: { title: { display: true, text: "Días" } },
        },
      },
    });
  }
  generateBarChartPreviousDays();
}

if (document.getElementById("pieChartDistribution")) {
  function generatePieChartDistribution() {
    const ctx = document.getElementById("pieChartDistribution").getContext("2d");
    const distributionData = {
      labels: ["Categoría 1", "Categoría 2", "Categoría 3", "Categoría 4"],
      data: [40, 25, 20, 15],
    };
    pieChartDistribution = new Chart(ctx, {
      type: "pie",
      data: {
        labels: distributionData.labels,
        datasets: [
          {
            data: distributionData.data,
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
          },
        ],
      },
      options: { responsive: true },
    });
  }
  generatePieChartDistribution();
}

if (document.getElementById("pieChartPayment")) {
  function generatePieChartPayment() {
    const ctx = document.getElementById("pieChartPayment").getContext("2d");
    const paymentData = {
      labels: ["Efectivo", "Tarjeta", "Transferencia", "Otro"],
      data: [50, 30, 15, 5],
    };
    pieChartPayment = new Chart(ctx, {
      type: "pie",
      data: {
        labels: paymentData.labels,
        datasets: [
          {
            data: paymentData.data,
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
          },
        ],
      },
      options: { responsive: true },
    });
  }
  generatePieChartPayment();
}

/* ====================================================
   INICIALIZACIÓN GLOBAL
   ==================================================== */
window.onload = function () {
  // Configuración de filtros para la gráfica
  const chartFilterYear = document.getElementById("chartFilterYear");
  const chartFilterMonth = document.getElementById("chartFilterMonth");

  chartFilterYear.innerHTML =
    '<option value="">Seleccione Año</option><option value="2024">2024</option><option value="2025" selected>2025</option>';
  chartFilterMonth.innerHTML =
    '<option value="">Seleccione Mes</option>' +
    '<option value="1">Enero</option>' +
    '<option value="2" selected>Febrero</option>' +
    '<option value="3">Marzo</option>' +
    '<option value="4">Abril</option>' +
    '<option value="5">Mayo</option>' +
    '<option value="6">Junio</option>' +
    '<option value="7">Julio</option>' +
    '<option value="8">Agosto</option>' +
    '<option value="9">Septiembre</option>' +
    '<option value="10">Octubre</option>' +
    '<option value="11">Noviembre</option>' +
    '<option value="12">Diciembre</option>';

  updateDailySalesChart();
  updateIndicators();
  loadSalesDetailed();
};
