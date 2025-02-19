// Espera a que el DOM se cargue
document.addEventListener("DOMContentLoaded", () => {
    loadSucursales();
    loadProviders();
    document.getElementById("reportFilterForm").addEventListener("submit", (e) => {
      e.preventDefault();
      generateReport();
    });
  });
  
  /**
   * Carga las sucursales desde Firestore y llena el select.
   */
  function loadSucursales() {
    const sucursalSelect = document.getElementById("sucursalSelect");
    db.collection("sucursales").get()
      .then(snapshot => {
        snapshot.forEach(doc => {
          const data = doc.data();
          const option = document.createElement("option");
          option.value = doc.id;
          option.textContent = data.name;
          sucursalSelect.appendChild(option);
        });
      })
      .catch(error => {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      });
  }
  
  /**
   * Carga los proveedores únicos de los pedidos completados y llena el select.
   */
  function loadProviders() {
    const providerSelect = document.getElementById("providerSelect");
    providerSelect.innerHTML = `<option value="all">Todos</option>`;
    // Se asume que los pedidos completados tienen status "sucursalRecibioPedido"
    db.collection("orders")
      .where("status", "==", "sucursalRecibioPedido")
      .get()
      .then(snapshot => {
        const uniqueProviders = new Set();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.providerName) {
            uniqueProviders.add(data.providerName);
          }
        });
        uniqueProviders.forEach(provider => {
          const opt = document.createElement("option");
          opt.value = provider;
          opt.textContent = provider;
          providerSelect.appendChild(opt);
        });
      })
      .catch(error => {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      });
  }
  
  /**
   * Genera el reporte filtrando por sucursal, proveedor y rango de fechas.
   */
  function generateReport() {
    const sucursal = document.getElementById("sucursalSelect").value;
    const provider = document.getElementById("providerSelect").value;
    const startDateStr = document.getElementById("startDate").value;
    const endDateStr = document.getElementById("endDate").value;
    const reportType = document.getElementById("reportType").value;
    
    if (!startDateStr || !endDateStr) {
      Swal.fire({ icon: "warning", title: "Fechas requeridas", text: "Ingresa la fecha de inicio y la fecha fin." });
      return;
    }
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23,59,59,999);
    
    const startTimestamp = firebase.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = firebase.firestore.Timestamp.fromDate(endDate);
    
    // Consulta a la colección "orders" para pedidos completados
    let query = db.collection("orders")
      .where("status", "==", "sucursalRecibioPedido")
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .orderBy("timestamp", "asc");
    
    if (sucursal !== "all") {
      query = query.where("sucursalId", "==", sucursal);
    }
    if (provider !== "all") {
      query = query.where("providerName", "==", provider);
    }
    
    query.get()
      .then(snapshot => {
        const orders = [];
        snapshot.forEach(doc => orders.push(doc.data()));
        if (reportType === "summary") {
          generateSummaryReport(orders);
        } else {
          generateDetailedReport(orders);
        }
      })
      .catch(error => {
        Swal.fire({ icon: "error", title: "Error al generar el reporte", text: error.message });
      });
  }
  
  /**
   * Genera un reporte resumido que agrupa los productos recibidos.
   */
  function generateSummaryReport(orders) {
    const productSummary = {};
    
    orders.forEach(order => {
      if (order.receivedProducts && Array.isArray(order.receivedProducts)) {
        order.receivedProducts.forEach(prod => {
          // Usamos el nombre y la presentación como clave única
          const key = prod.name + "||" + prod.presentation;
          if (!productSummary[key]) {
            productSummary[key] = {
              name: prod.name,
              presentation: prod.presentation,
              totalReceived: 0
            };
          }
          productSummary[key].totalReceived += Number(prod.receivedQuantity) || 0;
        });
      }
    });
    
    let html = `
      <h3>Reporte Resumido de Productos Recibidos</h3>
      <table class="table table-bordered">
        <thead class="thead-light">
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Total Recibido</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const key in productSummary) {
      const prod = productSummary[key];
      html += `
        <tr>
          <td>${prod.name}</td>
          <td>${prod.presentation}</td>
          <td>${prod.totalReceived}</td>
        </tr>
      `;
    }
    
    html += `
        </tbody>
      </table>
    `;
    
    document.getElementById("reportResults").innerHTML = html;
  }
  
  /**
   * Genera un reporte detallado mostrando cada pedido completado con sus datos.
   */
  function generateDetailedReport(orders) {
    let html = `<h3>Reporte Detallado de Pedidos Completados</h3>`;
    
    if (orders.length === 0) {
      html += `<p>No se encontraron pedidos en el rango de fechas y filtros seleccionados.</p>`;
    } else {
      orders.forEach(order => {
        html += `
          <div class="card mb-3">
            <div class="card-header">
              Pedido ID: ${order.orderId} | Fecha: ${order.orderDate}
            </div>
            <div class="card-body">
              <p><strong>Proveedor:</strong> ${order.providerName}</p>
              <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
              <h5>Productos Recibidos:</h5>
        `;
        if (order.receivedProducts && Array.isArray(order.receivedProducts)) {
          html += `
            <table class="table table-sm table-striped">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th>Cantidad Pedida</th>
                  <th>Cantidad Recibida</th>
                  <th>Precio Unitario</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
          `;
          order.receivedProducts.forEach(prod => {
            html += `
              <tr>
                <td>${prod.name}</td>
                <td>${prod.presentation}</td>
                <td>${prod.quantity}</td>
                <td>${prod.receivedQuantity}</td>
                <td>Q${prod.unitPrice}</td>
                <td>Q${prod.totalPerProduct}</td>
              </tr>
            `;
          });
          html += `
              </tbody>
            </table>
          `;
        } else {
          html += `<p>No se encontraron productos recibidos.</p>`;
        }
        html += `
            </div>
          </div>
        `;
      });
    }
    
    document.getElementById("reportResults").innerHTML = html;
  }
  