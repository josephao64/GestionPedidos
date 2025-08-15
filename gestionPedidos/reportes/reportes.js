document.addEventListener("DOMContentLoaded", () => {
  loadSucursales();
  loadProviders();
  document.getElementById("providerSelect")
          .addEventListener("change", loadProductsForReport);
  document.getElementById("reportFilterForm")
          .addEventListener("submit", e => {
    e.preventDefault();
    generateReport();
  });
});

function loadSucursales() {
  const sel = document.getElementById("sucursalSelect");
  db.collection("sucursales").get()
    .then(snap => {
      snap.forEach(doc => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.data().name;
        sel.appendChild(opt);
      });
    })
    .catch(err => Swal.fire("Error al cargar sucursales", err.message, "error"));
}

function loadProviders() {
  const sel = document.getElementById("providerSelect");
  sel.innerHTML = `<option value="all">Todos</option>`;
  db.collection("providers").get()
    .then(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = data.name;
        sel.appendChild(opt);
      });
    })
    .catch(err => Swal.fire("Error al cargar proveedores", err.message, "error"));
}

function loadProductsForReport() {
  const providerId = document.getElementById("providerSelect").value;
  const prodSel = document.getElementById("productSelect");
  prodSel.innerHTML = `<option value="all">Todos</option>`;
  if (providerId === "all") return;

  db.collection("products")
    .where("providerId", "==", providerId)
    .get()
    .then(snap => {
      snap.forEach(doc => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = `${d.name} — ${d.presentation}`;
        prodSel.appendChild(opt);
      });
    })
    .catch(err => Swal.fire("Error al cargar productos", err.message, "error"));
}

function generateReport() {
  const suc      = document.getElementById("sucursalSelect").value;
  const provId   = document.getElementById("providerSelect").value;
  const prodId   = document.getElementById("productSelect").value;
  const startStr = document.getElementById("startDate").value;
  const endStr   = document.getElementById("endDate").value;
  const type     = document.getElementById("reportType").value;

  if (!startStr || !endStr) {
    return Swal.fire("Fechas requeridas", "Ingresa fecha inicio y fin.", "warning");
  }

  const startTs = firebase.firestore.Timestamp.fromDate(new Date(startStr));
  const endDate = new Date(endStr);
  endDate.setHours(23,59,59,999);
  const endTs = firebase.firestore.Timestamp.fromDate(endDate);

  let q = db.collection("orders")
            .where("timestamp", ">=", startTs)
            .where("timestamp", "<=", endTs)
            .orderBy("timestamp", "asc");
  if (suc !== "all")    q = q.where("sucursalId", "==", suc);
  if (provId !== "all") q = q.where("providerId", "==", provId);

  q.get()
   .then(snap => {
     let orders = snap.docs.map(d => d.data());

     if (prodId !== "all") {
       orders = orders.map(o => {
         const fp = (o.products || []).filter(p => p.id === prodId);
         const fr = (o.receivedProducts || []).filter(p => p.id === prodId);
         return { ...o, products: fp, receivedProducts: fr };
       })
       .filter(o => (o.products && o.products.length) || (o.receivedProducts && o.receivedProducts.length));
     }

     switch(type) {
       case "summary":
         generateSummaryReport(orders);
         break;
       case "detailed":
         generateDetailedReport(orders);
         break;
       case "separate":
         generateSeparateReport(orders);
         break;
     }
   })
   .catch(err => Swal.fire("Error al generar reporte", err.message, "error"));
}

// ----------------------
// REPORTES EXISTENTES
// ----------------------
function generateSummaryReport(orders) {
  const summary = {};
  orders.forEach(o => {
    const list = (o.receivedProducts && o.receivedProducts.length)
      ? o.receivedProducts.map(p => ({ key:p.name+"||"+p.presentation, name:p.name, pres:p.presentation, qty:+p.receivedQuantity||0 }))
      : (o.products||[]).map(p => ({ key:p.name+"||"+p.presentation, name:p.name, pres:p.presentation, qty:+p.quantity||0 }));
    list.forEach(p => {
      if (!summary[p.key]) summary[p.key] = { name:p.name, pres:p.pres, total:0 };
      summary[p.key].total += p.qty;
    });
  });

  let html = `
    <h3>Resumen de Productos</h3>
    <table class="table table-bordered">
      <thead><tr><th>Producto</th><th>Presentación</th><th>Total</th></tr></thead>
      <tbody>
  `;
  Object.values(summary).forEach(p => {
    html += `<tr><td>${p.name}</td><td>${p.pres}</td><td>${p.total}</td></tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("reportResults").innerHTML = html;
}

function generateDetailedReport(orders) {
  let html = `<h3>Detalle de Pedidos</h3>`;
  if (!orders.length) {
    html += `<p>No se encontraron pedidos.</p>`;
  } else {
    orders.forEach(o => {
      html += `
        <div class="card mb-3">
          <div class="card-header">
            ID: ${o.orderId} | Fecha: ${o.orderDate} | Estado: ${o.status||'—'}
          </div>
          <div class="card-body">
            <p><strong>Proveedor:</strong> ${o.providerName}</p>
            <p><strong>Sucursal:</strong> ${o.sucursalName}</p>
            <h5>Productos:</h5>
      `;
      const list = (o.receivedProducts && o.receivedProducts.length)
        ? o.receivedProducts
        : o.products||[];
      if (list.length) {
        html += `
          <table class="table table-sm table-striped">
            <thead>
              <tr>
                <th>Producto</th><th>Presentación</th>
                <th>Cant. Pedida</th><th>Cant. Recibida</th>
                <th>Precio U.</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
        `;
        list.forEach(p => {
          html += `
            <tr>
              <td>${p.name}</td>
              <td>${p.presentation}</td>
              <td>${p.quantity||'—'}</td>
              <td>${p.receivedQuantity||'—'}</td>
              <td>${p.unitPrice? 'Q'+p.unitPrice:'—'}</td>
              <td>${p.totalPerProduct? 'Q'+p.totalPerProduct:'—'}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      } else {
        html += `<p>No hay productos en este pedido.</p>`;
      }
      html += `</div></div>`;
    });
  }
  document.getElementById("reportResults").innerHTML = html;
}

// ----------------------
// NUEVO: REPORTE SEPARADO
// ----------------------
function generateSeparateReport(orders) {
  let html = `
    <h3>Reporte Separado de Productos por Pedido</h3>
    <table class="table table-bordered">
      <thead class="thead-light">
        <tr>
          <th>Sucursal</th>
          <th>Fecha de Pedido</th>
          <th>ID Pedido</th>
          <th>Proveedor</th>
          <th>Producto</th>
          <th>Cantidad</th>
        </tr>
      </thead>
      <tbody>
  `;
  orders.forEach(o => {
    const list = (o.receivedProducts && o.receivedProducts.length)
      ? o.receivedProducts.map(p => ({ name:p.name, qty:+p.receivedQuantity||0 }))
      : (o.products||[]).map(p => ({ name:p.name, qty:+p.quantity||0 }));
    list.forEach(p => {
      html += `
        <tr>
          <td>${o.sucursalName}</td>
          <td>${o.orderDate}</td>
          <td>${o.orderId}</td>
          <td>${o.providerName}</td>
          <td>${p.name}</td>
          <td>${p.qty}</td>
        </tr>
      `;
    });
  });
  html += `
      </tbody>
    </table>
  `;
  document.getElementById("reportResults").innerHTML = html;
}
