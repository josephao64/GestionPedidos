/* salidas.js */

// CONFIGURACIÓN DE FIREBASE
var firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com",
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();
  
  /* =========================
     MOSTRAR SECCIONES
  ============================*/
  function showSection(section) {
    document.getElementById("registerSection").style.display = "none";
    document.getElementById("historySection").style.display = "none";
    document.getElementById("stockSection").style.display = "none";
    document.getElementById("reportsSection").style.display = "none";
  
    if (section === "register") {
      document.getElementById("registerSection").style.display = "block";
    } else if (section === "history") {
      document.getElementById("historySection").style.display = "block";
      loadOutgoingHistory();
    } else if (section === "stock") {
      document.getElementById("stockSection").style.display = "block";
      loadStock();
    } else if (section === "reports") {
      document.getElementById("reportsSection").style.display = "block";
      // Opcional: cargar datos iniciales para reportes.
    }
  }
  
  /* =========================
     CARGAR PRODUCTOS PARA SALIDAS
  ============================*/
  async function populateOutgoingProducts() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let select = document.getElementById("outgoingProduct");
      select.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = product.name;
        select.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar productos:", error);
    }
  }
  
  /* =========================
     CARGAR SUCURSALES DESDE LA BD
  ============================*/
  async function populateBranches() {
    try {
      let snapshot = await db.collection("sucursales").get();
      let selectOutgoing = document.getElementById("outgoingBranch");
      let selectReport = document.getElementById("reportBranch");
      selectOutgoing.innerHTML = '<option value="">Seleccione Sucursal</option>';
      selectReport.innerHTML = '<option value="">Todas</option>';
      snapshot.forEach(doc => {
        let branch = doc.data();
        let option = document.createElement("option");
        option.value = branch.name;
        option.textContent = branch.name;
        selectOutgoing.appendChild(option);
        selectReport.appendChild(option.cloneNode(true));
      });
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    }
  }
  
  /* =========================
     REGISTRAR SALIDA
  ============================*/
  async function saveOutgoing() {
    try {
      let outgoingDate = document.getElementById("outgoingDate").value;
      let outgoingBranch = document.getElementById("outgoingBranch").value;
      let outgoingProductId = document.getElementById("outgoingProduct").value;
      let outgoingQuantity = parseFloat(document.getElementById("outgoingQuantity").value);
      let outgoingUser = document.getElementById("outgoingUser").value;
      let outgoingComments = document.getElementById("outgoingComments").value;
  
      if (
        !outgoingDate ||
        !outgoingBranch ||
        !outgoingProductId ||
        isNaN(outgoingQuantity) ||
        outgoingQuantity <= 0 ||
        !outgoingUser
      ) {
        throw new Error("Todos los campos son obligatorios y la cantidad debe ser positiva.");
      }
  
      let parts = outgoingDate.split("-");
      let dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
      let productRef = db.collection("inventoryProducts").doc(outgoingProductId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let productData = productDoc.data();
  
      if (productData.stock < outgoingQuantity) {
        throw new Error("No hay stock suficiente para esta salida.");
      }
  
      let movementData = {
        productId: outgoingProductId,
        type: "salida",
        quantity: outgoingQuantity,
        date: dateObj,
        user: outgoingUser,
        comments: outgoingComments,
        branch: outgoingBranch,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("inventoryMovements").add(movementData);
  
      let newStock = productData.stock - outgoingQuantity;
      await productRef.update({ stock: newStock });
  
      alert("Salida registrada exitosamente.");
      document.getElementById("outgoingForm").reset();
    } catch (error) {
      console.error("Error al guardar salida:", error);
      alert("Error al guardar salida: " + error.message);
    }
  }
  
  /* =========================
     HISTORIAL DE SALIDAS
  ============================*/
  async function loadOutgoingHistory() {
    try {
      let snapshot = await db.collection("inventoryMovements").orderBy("createdAt", "desc").get();
      let tbody = document.getElementById("outgoingTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      for (let docu of snapshot.docs) {
        let movement = docu.data();
        if (movement.type !== "salida") continue;
        let row = tbody.insertRow();
  
        let dateCell = row.insertCell(0);
        if (movement.date) {
          dateCell.textContent = new Date(movement.date.seconds * 1000).toLocaleDateString();
        } else {
          dateCell.textContent = "";
        }
        row.insertCell(1).textContent = movement.branch;
  
        let productDoc = await db.collection("inventoryProducts").doc(movement.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        row.insertCell(2).textContent = productName;
  
        row.insertCell(3).textContent = movement.quantity;
        row.insertCell(4).textContent = movement.user;
        row.insertCell(5).textContent = movement.comments || "";
  
        let actionsCell = row.insertCell(6);
        actionsCell.innerHTML = `
          <button class="btn btn-sm btn-danger" onclick="deleteMovement('${docu.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>`;
      }
    } catch (error) {
      console.error("Error al cargar historial de salidas:", error);
      alert("Error al cargar historial: " + error.message);
    }
  }
  
  /* =========================
     ELIMINAR MOVIMIENTO
  ============================*/
  async function deleteMovement(movementId) {
    if (!confirm("¿Estás seguro de eliminar esta salida? Se repondrá el stock.")) return;
    try {
      let docRef = await db.collection("inventoryMovements").doc(movementId).get();
      if (!docRef.exists) throw new Error("Movimiento no encontrado.");
      let movementData = docRef.data();
  
      let productRef = db.collection("inventoryProducts").doc(movementData.productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let productData = productDoc.data();
      let newStock = productData.stock + movementData.quantity;
      await productRef.update({ stock: newStock });
  
      await db.collection("inventoryMovements").doc(movementId).delete();
      alert("Movimiento eliminado y stock repuesto.");
      loadOutgoingHistory();
      loadStock();
    } catch (error) {
      console.error("Error al eliminar movimiento:", error);
      alert("Error al eliminar movimiento: " + error.message);
    }
  }
  
  /* =========================
     STOCK ACTUAL
  ============================*/
  async function loadStock() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let tbody = document.getElementById("stockTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let prod = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = prod.idNum ? prod.idNum : doc.id;
        row.insertCell(1).textContent = prod.name;
        row.insertCell(2).textContent = prod.stock;
      });
    } catch (error) {
      console.error("Error al cargar stock:", error);
      alert("Error al cargar stock: " + error.message);
    }
  }
  
  /* =========================
     REPORTES DE SALIDAS
  ============================*/
  async function generateOutgoingReport() {
    try {
      let startDateInput = document.getElementById("reportStartDate").value;
      let endDateInput = document.getElementById("reportEndDate").value;
      let branchFilter = document.getElementById("reportBranch").value;
  
      if (!startDateInput || !endDateInput) {
        throw new Error("Debes seleccionar un rango de fechas.");
      }
  
      let startDate = new Date(startDateInput);
      let endDate = new Date(endDateInput);
      endDate.setHours(23, 59, 59, 999);
  
      let query = db.collection("inventoryMovements")
        .where("date", ">=", startDate)
        .where("date", "<=", endDate);
      if (branchFilter) {
        query = query.where("branch", "==", branchFilter);
      }
      query = query.orderBy("date", "asc");
  
      let snapshot = await query.get();
  
      let tbody = document.getElementById("reportOutgoingTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
  
      let chartData = {};
      for (let docu of snapshot.docs) {
        let movement = docu.data();
        if (movement.type !== "salida") continue;
        let dateStr = "";
        if (movement.date) {
          dateStr = new Date(movement.date.seconds * 1000).toLocaleDateString();
        }
        let row = tbody.insertRow();
        row.insertCell(0).textContent = dateStr;
        row.insertCell(1).textContent = movement.branch;
  
        let productDoc = await db.collection("inventoryProducts").doc(movement.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        row.insertCell(2).textContent = productName;
  
        row.insertCell(3).textContent = movement.quantity;
        row.insertCell(4).textContent = movement.user;
        row.insertCell(5).textContent = movement.comments || "";
  
        if (!chartData[dateStr]) {
          chartData[dateStr] = 0;
        }
        chartData[dateStr] += movement.quantity;
      }
  
      let ctx = document.getElementById("reportChart").getContext("2d");
      let labels = Object.keys(chartData);
      let data = Object.values(chartData);
  
      if (window.outgoingChart && typeof window.outgoingChart.destroy === "function") {
        window.outgoingChart.destroy();
      }
  
      window.outgoingChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Cantidad de Salidas",
            data: data,
            backgroundColor: "rgba(75, 192, 192, 0.6)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (error) {
      console.error("Error al generar reporte:", error);
      alert("Error al generar reporte: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR REPORTES
  ============================*/
  
  // Exportar a Imagen
  function exportReportToImage() {
    let table = document.getElementById("reportOutgoingTable");
    if (!table) {
      alert("No se encontró la tabla de reporte.");
      return;
    }
    
    let rows = table.rows;
    if (rows.length === 0) {
      alert("La tabla de reporte está vacía.");
      return;
    }
    
    let startDate = document.getElementById("reportStartDate").value;
    let endDate = document.getElementById("reportEndDate").value;
    let titleText = "Reportes de Salidas de Bodega";
    if (startDate && endDate) {
      titleText += " (" + startDate + " - " + endDate + ")";
    }
    
    let titleFont = "bold 20px Arial";
    let titleHeight = 50;
    const cellPadding = 10;
    const tableFont = "16px Arial";
    const rowHeight = 30;
  
    let tempCanvas = document.createElement("canvas");
    let tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = tableFont;
    
    const numCols = rows[0].cells.length;
    let colWidths = [];
    for (let col = 0; col < numCols; col++) {
      let maxWidth = 0;
      for (let r = 0; r < rows.length; r++) {
        let cellText = rows[r].cells[col].innerText;
        let metrics = tempCtx.measureText(cellText);
        if (metrics.width > maxWidth) {
          maxWidth = metrics.width;
        }
      }
      colWidths[col] = maxWidth + cellPadding * 2;
    }
    
    const tableWidth = colWidths.reduce((total, w) => total + w, 0);
    const tableHeight = rowHeight * rows.length;
    const canvasWidth = tableWidth;
    const canvasHeight = titleHeight + tableHeight;
    
    let canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    let ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.font = titleFont;
    ctx.fillStyle = "#333";
    let titleMetrics = ctx.measureText(titleText);
    let titleX = (canvasWidth - titleMetrics.width) / 2;
    let titleY = titleHeight / 2;
    ctx.fillText(titleText, titleX, titleY);
    ctx.beginPath();
    ctx.moveTo(0, titleHeight - 5);
    ctx.lineTo(canvasWidth, titleHeight - 5);
    ctx.strokeStyle = "#ccc";
    ctx.stroke();
    
    let y = titleHeight;
    for (let r = 0; r < rows.length; r++) {
      let x = 0;
      if (r === 0) {
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, y, canvasWidth, rowHeight);
      } else if (r % 2 === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, y, canvasWidth, rowHeight);
      }
      ctx.fillStyle = "#000";
      for (let c = 0; c < numCols; c++) {
        ctx.strokeRect(x, y, colWidths[c], rowHeight);
        let cellText = rows[r].cells[c].innerText;
        if (r === 0) {
          ctx.font = "bold 16px Arial";
          let textWidth = ctx.measureText(cellText).width;
          let textX = x + (colWidths[c] - textWidth) / 2;
          ctx.fillText(cellText, textX, y + rowHeight / 2);
        } else if (c === 3) {
          ctx.font = "16px Arial";
          let textWidth = ctx.measureText(cellText).width;
          let textX = x + (colWidths[c] - textWidth) / 2;
          ctx.fillText(cellText, textX, y + rowHeight / 2);
        } else {
          ctx.font = "16px Arial";
          ctx.textAlign = "left";
          ctx.fillText(cellText, x + cellPadding, y + rowHeight / 2);
        }
        ctx.textAlign = "start";
        x += colWidths[c];
      }
      y += rowHeight;
    }
    
    let imageData = canvas.toDataURL("image/png");
    let link = document.createElement("a");
    link.href = imageData;
    link.download = "reporte_salidas.png";
    link.click();
  }
  
  // Exportar a PDF (Stock Actual y Salidas de Bodega)
  function exportReportToPDF() {
    const { jsPDF } = window.jspdf;  // Asegura que jsPDF esté definido
    var exportContent = generateExportContent();
    document.body.appendChild(exportContent);
    html2canvas(exportContent).then(function(canvas) {
      let image = canvas.toDataURL("image/png");
      var pdf = new jsPDF('p', 'mm', 'a4');
      let pdfWidth = pdf.internal.pageSize.getWidth();
      let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(image, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save("reporte_salidas.pdf");
      document.body.removeChild(exportContent);
    });
  }
  
  // Función para generar contenido del PDF
  function generateExportContent() {
    var container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "-10000px";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.backgroundColor = "#fff";
    container.style.padding = "20px";
    container.style.border = "1px solid #ccc";
    container.style.fontFamily = "Arial, sans-serif";
  
    var mainTitle = document.createElement("h2");
    mainTitle.textContent = "Reporte de Inventario y Salidas de Bodega";
    container.appendChild(mainTitle);
  
    var currentDate = new Date().toLocaleDateString();
    var datePara = document.createElement("p");
    datePara.textContent = "Fecha: " + currentDate;
    container.appendChild(datePara);
  
    var stockTitle = document.createElement("h3");
    stockTitle.textContent = "Stock Actual de Inventario";
    container.appendChild(stockTitle);
  
    var stockTable = document.getElementById("stockTable");
    if (stockTable) {
      var stockClone = stockTable.cloneNode(true);
      container.appendChild(stockClone);
    } else {
      var noStock = document.createElement("p");
      noStock.textContent = "No se encontró información de stock actual.";
      container.appendChild(noStock);
    }
  
    var salidasTitle = document.createElement("h3");
    salidasTitle.textContent = "Salidas de Bodega";
    container.appendChild(salidasTitle);
  
    var startDate = document.getElementById("reportStartDate").value || "";
    var endDate = document.getElementById("reportEndDate").value || "";
    var salidasDate = document.createElement("p");
    salidasDate.textContent = "Fecha Inicio: " + startDate + " - Fecha Fin: " + endDate;
    container.appendChild(salidasDate);
  
    var reportTable = document.getElementById("reportOutgoingTable");
    if (reportTable) {
      var reportClone = reportTable.cloneNode(true);
      container.appendChild(reportClone);
    } else {
      var noReport = document.createElement("p");
      noReport.textContent = "No se encontró información de salidas.";
      container.appendChild(noReport);
    }
  
    return container;
  }
  
  // Exportar a Excel (CSV)
  function exportReportToExcel() {
    let table = document.getElementById("reportOutgoingTable");
    let csv = [];
    for (let i = 0; i < table.rows.length; i++) {
      let row = table.rows[i];
      let cols = row.querySelectorAll("td, th");
      let rowData = [];
      for (let j = 0; j < cols.length; j++) {
        let cellText = cols[j].innerText;
        if (i === 0 && j === 0) {
          cellText = "Fecha de Salida";
        }
        rowData.push('"' + cellText.replace(/"/g, '""') + '"');
      }
      csv.push(rowData.join(","));
    }
    let csvContent = csv.join("\n");
    let blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    let url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "reporte_salidas.csv");
    link.click();
  }
  
  /* =========================
     INICIALIZACIÓN DE LA PÁGINA
  ============================*/
  window.onload = async function() {
    showSection("register");
    await populateOutgoingProducts();
    await populateBranches();
  };
  