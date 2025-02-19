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
     Usamos la colección "sucursales" y extraemos el campo "name"
  ============================*/
  async function populateBranches() {
    try {
      let snapshot = await db.collection("sucursales").get();
      // Para el formulario de registro
      let selectOutgoing = document.getElementById("outgoingBranch");
      // Para el reporte
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
     REGISTRAR SALIDA (GUARDAR MOVIMIENTO CON TIPO "salida")
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
  
      // Convertir la fecha (formato YYYY-MM-DD)
      let parts = outgoingDate.split("-");
      let dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
      // Obtener el producto para descontar stock
      let productRef = db.collection("inventoryProducts").doc(outgoingProductId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let productData = productDoc.data();
  
      if (productData.stock < outgoingQuantity) {
        throw new Error("No hay stock suficiente para esta salida.");
      }
  
      // Guardar el movimiento en "inventoryMovements" con tipo "salida"
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
  
      // Actualizar el stock del producto
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
     HISTORIAL DE MOVIMIENTOS (incluyendo salidas)
  ============================*/
  async function loadOutgoingHistory() {
    try {
      // Cargamos los movimientos de "inventoryMovements" (incluyendo tipo "salida")
      let snapshot = await db.collection("inventoryMovements").orderBy("createdAt", "desc").get();
      let tbody = document.getElementById("outgoingTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      for (let docu of snapshot.docs) {
        let movement = docu.data();
        // Solo mostramos movimientos de tipo "salida"
        if (movement.type !== "salida") continue;
        let row = tbody.insertRow();
  
        // Fecha
        let dateCell = row.insertCell(0);
        if (movement.date) {
          dateCell.textContent = new Date(movement.date.seconds * 1000).toLocaleDateString();
        } else {
          dateCell.textContent = "";
        }
  
        // Sucursal
        row.insertCell(1).textContent = movement.branch;
  
        // Producto
        let productDoc = await db.collection("inventoryProducts").doc(movement.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        row.insertCell(2).textContent = productName;
  
        // Cantidad
        row.insertCell(3).textContent = movement.quantity;
  
        // Usuario
        row.insertCell(4).textContent = movement.user;
  
        // Comentarios
        row.insertCell(5).textContent = movement.comments || "";
  
        // Acciones
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
     ELIMINAR MOVIMIENTO Y REPOSTAR STOCK
  ============================*/
  async function deleteMovement(movementId) {
    if (!confirm("¿Estás seguro de eliminar esta salida? Se repondrá el stock.")) return;
    try {
      let docRef = await db.collection("inventoryMovements").doc(movementId).get();
      if (!docRef.exists) throw new Error("Movimiento no encontrado.");
      let movementData = docRef.data();
  
      // Reponer stock del producto
      let productRef = db.collection("inventoryProducts").doc(movementData.productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let productData = productDoc.data();
      let newStock = productData.stock + movementData.quantity;
      await productRef.update({ stock: newStock });
  
      // Eliminar el movimiento
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
     VER STOCK ACTUAL
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
     (Filtrar por rango de fecha y sucursal, generar tabla y gráfico)
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
  
      // Llenar la tabla de reporte
      let tbody = document.getElementById("reportOutgoingTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
  
      // Datos para el gráfico: suma de salidas por día
      let chartData = {};
  
      for (let docu of snapshot.docs) {
        let movement = docu.data();
        // Solo consideramos movimientos de tipo "salida"
        if (movement.type !== "salida") continue;
        let dateStr = "";
        if (movement.date) {
          dateStr = new Date(movement.date.seconds * 1000).toLocaleDateString();
        }
        // Agregar fila a la tabla
        let row = tbody.insertRow();
        row.insertCell(0).textContent = dateStr;
        row.insertCell(1).textContent = movement.branch;
        let productDoc = await db.collection("inventoryProducts").doc(movement.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        row.insertCell(2).textContent = productName;
        row.insertCell(3).textContent = movement.quantity;
        row.insertCell(4).textContent = movement.user;
        row.insertCell(5).textContent = movement.comments || "";
  
        // Acumular para el gráfico
        if (!chartData[dateStr]) {
          chartData[dateStr] = 0;
        }
        chartData[dateStr] += movement.quantity;
      }
  
      // Generar gráfico con Chart.js (tipo barra)
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
     INICIALIZACIÓN DE LA PÁGINA
  ============================*/
  window.onload = async function() {
    // Mostrar la sección de registro por defecto
    showSection("register");
    // Cargar productos y sucursales en los selects
    await populateOutgoingProducts();
    await populateBranches();
  };
  