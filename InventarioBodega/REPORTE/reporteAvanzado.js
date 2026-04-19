/* reporteAvanzado.js */

// CONFIGURACIÓN DE FIREBASE
// db se hereda de window.db inicializado en connection.js
const db = window.db;
if (!db) {
  console.error("❌ Firebase no ha sido inicializado. Asegúrate de incluir connection.js");
}
  
  /* =========================
     POPULAR FILTROS
     - Sucursales desde la colección "sucursales"
     - Generar checkboxes en el modal para excluir productos
     - (Opcional) Los productos se cargarán para poder actualizar sus precios en el modal de "Actualizar Precios"
  ============================ */
  async function populateFilters() {
    // Sucursales
    try {
      let snapshot = await db.collection("sucursales").get();
      let filterBranch = document.getElementById("filterBranch");
      snapshot.forEach(doc => {
        let branch = doc.data();
        let option = document.createElement("option");
        option.value = branch.name;
        option.textContent = branch.name;
        filterBranch.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    }
    
    // Productos para exclusión: generar checkboxes en el modal
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let container = document.getElementById("excludeProductsCheckboxes");
      container.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let div = document.createElement("div");
        div.className = "form-check";
        
        let checkbox = document.createElement("input");
        checkbox.className = "form-check-input excludeProductCheckbox";
        checkbox.type = "checkbox";
        checkbox.value = doc.id;
        checkbox.id = "exclude_" + doc.id;
        
        let label = document.createElement("label");
        label.className = "form-check-label";
        label.htmlFor = "exclude_" + doc.id;
        label.textContent = product.name;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
      });
    } catch (error) {
      console.error("Error al cargar productos para exclusión:", error);
    }
  }
  
  /* =========================
     POPULAR MODAL DE ACTUALIZACIÓN DE PRECIOS
     Se generan para cada producto un elemento con su nombre y un input para ingresar/editar el precio.
  ============================ */
  async function populateUpdatePricesModal() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let container = document.getElementById("updatePricesContainer");
      container.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        
        let div = document.createElement("div");
        div.className = "mb-3";
        
        let label = document.createElement("label");
        label.className = "form-label";
        label.htmlFor = "price_" + doc.id;
        label.textContent = product.name;
        
        let input = document.createElement("input");
        input.type = "number";
        input.step = "0.01";
        input.className = "form-control updatePriceInput";
        input.id = "price_" + doc.id;
        input.value = product.price ? parseFloat(product.price).toFixed(2) : "0.00";
        
        // Se puede agregar el ID del producto en un atributo de datos
        input.dataset.productId = doc.id;
        
        div.appendChild(label);
        div.appendChild(input);
        container.appendChild(div);
      });
    } catch (error) {
      console.error("Error al cargar productos para actualizar precios:", error);
    }
  }
  
  /* =========================
     ACTUALIZAR PRECIOS DE PRODUCTOS
     Se recorre cada input del modal de precios y se actualiza en Firestore
  ============================ */
  async function updatePrices() {
    try {
      let inputs = document.querySelectorAll(".updatePriceInput");
      let updates = [];
      inputs.forEach(input => {
        let productId = input.dataset.productId;
        let newPrice = parseFloat(input.value);
        if (!isNaN(newPrice)) {
          updates.push(
            db.collection("inventoryProducts").doc(productId).update({
              price: newPrice
            })
          );
        }
      });
      await Promise.all(updates);
      alert("Precios actualizados correctamente.");
    } catch (error) {
      console.error("Error al actualizar precios:", error);
      alert("Error al actualizar precios: " + error.message);
    }
  }
  
  /* =========================
     GENERAR REPORTE AVANZADO CON AGRUPACIÓN, EXCLUSIÓN Y DATOS DE PRECIOS
     Se filtran los movimientos "salida" en el rango de fechas y se calcula el total (precio × cantidad)
     Se puede agrupar por sucursal o por categoría.
  ============================ */
  async function generateAdvancedReport() {
    // Mostrar spinner de carga
    document.getElementById("loadingSpinner").style.display = "block";
    try {
      // Obtener valores de los filtros
      let branchFilter = document.getElementById("filterBranch").value;
      let startDateInput = document.getElementById("filterStartDate").value;
      let endDateInput = document.getElementById("filterEndDate").value;
      let groupBy = document.getElementById("groupBy").value;
      
      // Obtener array de IDs de productos a excluir desde los checkboxes
      let excludeProducts = Array.from(document.querySelectorAll("#excludeProductsCheckboxes input.excludeProductCheckbox:checked")).map(opt => opt.value);
      
      if (!startDateInput || !endDateInput) {
        alert("Debes seleccionar un rango de fechas.");
        return;
      }
      
      let startDate = new Date(startDateInput);
      let endDate = new Date(endDateInput);
      endDate.setHours(23, 59, 59, 999);
      
      // Consulta: movimientos "salida" filtrados por fecha (y sucursal si se selecciona)
      let query = db.collection("inventoryMovements")
                    .where("date", ">=", startDate)
                    .where("date", "<=", endDate)
                    .orderBy("date", "asc");
      if (branchFilter) {
        query = query.where("branch", "==", branchFilter);
      }
      
      let snapshot = await query.get();
      
      // Variables para agrupar los registros
      let groups = {}; // clave: valor de agrupación, valor: { rows: [], total: monto acumulado }
      let flatRows = []; // Si no se agrupa (groupBy === "none")
      
      // Procesar cada movimiento
      for (let docu of snapshot.docs) {
        let movement = docu.data();
        if (movement.type !== "salida") continue;
        
        // Obtener información del producto
        let productDoc = await db.collection("inventoryProducts").doc(movement.productId).get();
        if (!productDoc.exists) continue;
        
        // Excluir producto si está en la lista
        if (excludeProducts.includes(productDoc.id)) continue;
        
        let productData = productDoc.data();
        // Se asume que cada producto tiene un campo "price" y "category"
        let price = parseFloat(productData.price) || 0;
        let lineTotal = price * movement.quantity;
        
        // Formatear la fecha
        let dateStr = movement.date
          ? new Date(movement.date.seconds * 1000).toLocaleDateString()
          : "";
        
        // Crear objeto para la fila
        let rowObj = {
          date: dateStr,
          branch: movement.branch,
          product: productData.name,
          price: price.toFixed(2),
          quantity: movement.quantity,
          total: lineTotal.toFixed(2),
          user: movement.user,
          comments: movement.comments || ""
        };
        
        if (groupBy === "none") {
          flatRows.push(rowObj);
        } else {
          let key = "";
          if (groupBy === "branch") {
            key = movement.branch;
          } else if (groupBy === "category") {
            key = productData.category ? productData.category : "Sin Categoría";
          }
          if (!groups[key]) {
            groups[key] = { rows: [], total: 0 };
          }
          groups[key].rows.push(rowObj);
          groups[key].total += lineTotal;
        }
      }
      
      // Construir la tabla de resultados
      let tbody = document.getElementById("advancedReportTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      
      if (groupBy === "none") {
        flatRows.forEach(rowObj => {
          let row = tbody.insertRow();
          row.insertCell(0).textContent = rowObj.date;
          row.insertCell(1).textContent = rowObj.branch;
          row.insertCell(2).textContent = rowObj.product;
          row.insertCell(3).textContent = rowObj.price;
          row.insertCell(4).textContent = rowObj.quantity;
          row.insertCell(5).textContent = rowObj.total;
          row.insertCell(6).textContent = rowObj.user;
          row.insertCell(7).textContent = rowObj.comments;
        });
      } else {
        for (let key in groups) {
          // Fila de cabecera para el grupo
          let headerRow = tbody.insertRow();
          let cell = headerRow.insertCell(0);
          cell.colSpan = 8;
          let groupLabel = groupBy === "branch" ? "Sucursal: " : "Categoría: ";
          cell.textContent = groupLabel + key + " (Total: " + groups[key].total.toFixed(2) + ")";
          cell.style.fontWeight = "bold";
          
          groups[key].rows.forEach(rowObj => {
            let row = tbody.insertRow();
            row.insertCell(0).textContent = rowObj.date;
            row.insertCell(1).textContent = rowObj.branch;
            row.insertCell(2).textContent = rowObj.product;
            row.insertCell(3).textContent = rowObj.price;
            row.insertCell(4).textContent = rowObj.quantity;
            row.insertCell(5).textContent = rowObj.total;
            row.insertCell(6).textContent = rowObj.user;
            row.insertCell(7).textContent = rowObj.comments;
          });
        }
      }
      
      // Generar gráfico según la agrupación
      let ctx = document.getElementById("reportChart").getContext("2d");
      if (window.advancedChart && typeof window.advancedChart.destroy === "function") {
        window.advancedChart.destroy();
      }
      
      if (groupBy !== "none") {
        let chartLabels = Object.keys(groups);
        // Se usa el total acumulado del grupo para el gráfico
        let chartValues = chartLabels.map(label => groups[label].total.toFixed(2));
        let labelText = groupBy === "branch" ? "Total por Sucursal" : "Total por Categoría";
        window.advancedChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: chartLabels,
            datasets: [{
              label: labelText,
              data: chartValues,
              backgroundColor: "rgba(54, 162, 235, 0.6)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
          }
        });
      } else {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      
    } catch (error) {
      console.error("Error al generar el reporte avanzado:", error);
      alert("Error al generar el reporte: " + error.message);
    } finally {
      // Ocultar spinner de carga
      document.getElementById("loadingSpinner").style.display = "none";
    }
  }
  
  window.onload = function() {
    populateFilters();
  };
  