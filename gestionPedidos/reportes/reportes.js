/**********************************************************
 * Reporte: Consumo Diario / Semanal / Mensual
 * Por Producto × Sucursal × Proveedor, con exportación a Excel.
 * Firestore v8 (orders):
 *  - timestamp (Firestore Timestamp)
 *  - sucursalId, sucursalName
 *  - providerId, providerName
 *  - products [{id?, name, presentation, quantity}]
 *  - receivedProducts [{id?, name, presentation, receivedQuantity, unitPrice, totalPerProduct}]
 **********************************************************/

document.addEventListener("DOMContentLoaded", () => {
  loadSucursales();
  loadProviders();
  document.getElementById("providerSelect").addEventListener("change", loadProductsForReport);

  document.getElementById("reportFilterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    generateConsumptionReport();
  });

  document.getElementById("btnExportExcel").addEventListener("click", exportCurrentTableToXLSX);
});

/* ================== CARGAS INICIALES ================== */
function loadSucursales() {
  const sel = document.getElementById("sucursalSelect");
  sel.innerHTML = `<option value="all">Todas</option>`;
  db.collection("sucursales").get()
    .then((snap) => {
      snap.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.data().name;
        sel.appendChild(opt);
      });
    })
    .catch((err) => Swal.fire("Error al cargar sucursales", err.message, "error"));
}

function loadProviders() {
  const sel = document.getElementById("providerSelect");
  sel.innerHTML = `<option value="all">Todos</option>`;
  db.collection("providers").get()
    .then((snap) => {
      snap.forEach((doc) => {
        const data = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = data.name;
        sel.appendChild(opt);
      });
    })
    .catch((err) => Swal.fire("Error al cargar proveedores", err.message, "error"));
}

function loadProductsForReport() {
  const providerId = document.getElementById("providerSelect").value;
  const prodSel = document.getElementById("productSelect");
  prodSel.innerHTML = `<option value="all">Todos</option>`;
  if (providerId === "all") return;

  db.collection("products")
    .where("providerId", "==", providerId)
    .get()
    .then((snap) => {
      snap.forEach((doc) => {
        const d = doc.data();
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = `${d.name} — ${d.presentation}`;
        prodSel.appendChild(opt);
      });
    })
    .catch((err) => Swal.fire("Error al cargar productos", err.message, "error"));
}

/* ================== UTIL: CLAVES DE PERÍODO ================== */
function keyDaily(d) {
  const dd = new Date(d); dd.setHours(0,0,0,0);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, "0");
  const day = String(dd.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function keyMonthly(d) {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Semana ISO: YYYY-Www (Lunes–Domingo)
function keyWeeklyISO(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0=lunes ... 6=domingo
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // al jueves de la semana
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date - jan4) / 86400000;
  const week = 1 + Math.floor((diff - ((jan4.getUTCDay() + 6) % 7) + 3) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/* ================== QUERY + GENERADOR ================== */
async function generateConsumptionReport() {
  const suc       = document.getElementById("sucursalSelect").value;
  const provId    = document.getElementById("providerSelect").value;
  const prodId    = document.getElementById("productSelect").value;
  const periodic  = document.getElementById("periodicity").value; // daily | weekly | monthly
  const startStr  = document.getElementById("startDate").value;
  const endStr    = document.getElementById("endDate").value;

  if (!startStr || !endStr) {
    return Swal.fire("Fechas requeridas", "Ingresa fecha inicio y fin.", "warning");
  }

  const startDate = new Date(startStr); startDate.setHours(0,0,0,0);
  const endDate   = new Date(endStr);   endDate.setHours(23,59,59,999);

  const startTs = firebase.firestore.Timestamp.fromDate(startDate);
  const endTs   = firebase.firestore.Timestamp.fromDate(endDate);

  let q = db.collection("orders")
            .where("timestamp", ">=", startTs)
            .where("timestamp", "<=", endTs)
            .orderBy("timestamp", "asc");

  if (suc !== "all")    q = q.where("sucursalId", "==", suc);
  if (provId !== "all") q = q.where("providerId", "==", provId);

  try {
    const snap = await q.get();
    let orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Si se filtra por producto, reducir arrays
    if (prodId !== "all") {
      orders = orders.map(o => {
        const fp = (o.products || []).filter(p => p.id === prodId);
        const fr = (o.receivedProducts || []).filter(p => p.id === prodId);
        return { ...o, products: fp, receivedProducts: fr };
      }).filter(o => (o.products?.length) || (o.receivedProducts?.length));
    }

    const { rows, periods, header, exportRows } = aggregateConsumption(orders, periodic, startStr, endStr);

    renderTable(rows, periods, header);
    window._lastExportRows = exportRows;
    document.getElementById("btnExportExcel").disabled = exportRows.length <= 1;

    document.getElementById("reportMeta").innerHTML =
      `Período: <strong>${startStr}</strong> a <strong>${endStr}</strong> · Periodicidad: <strong>${periodic.toUpperCase()}</strong>`;
  } catch (err) {
    Swal.fire("Error al generar reporte", err.message, "error");
  }
}

/**
 * Agrupa consumo por Producto × Presentación × Sucursal × Proveedor en períodos (daily/weekly/monthly).
 * Prefiere receivedProducts; si no hay, usa products.
 */
function aggregateConsumption(orders, periodic) {
  const periodsSet = new Set();
  const rowMap = new Map(); // rowKey -> { name, pres, branch, provider, perPeriod(Map) }

  const keyFn = (d) => periodic === "daily"  ? keyDaily(d)
                     : periodic === "monthly"? keyMonthly(d)
                     : keyWeeklyISO(d);

  for (const o of orders) {
    const date = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.orderDate);
    const periodKey = keyFn(date);
    periodsSet.add(periodKey);

    const branch = o.sucursalName || o.sucursalId || "—";
    const provider = o.providerName || o.providerId || "—";

    const list = (o.receivedProducts && o.receivedProducts.length)
      ? o.receivedProducts.map(p => ({
          id: p.id || null,
          name: p.name, pres: p.presentation,
          qty: Number(p.receivedQuantity) || 0
        }))
      : (o.products || []).map(p => ({
          id: p.id || null,
          name: p.name, pres: p.presentation,
          qty: Number(p.quantity) || 0
        }));

    for (const p of list) {
      const rowKey = `${p.name}||${p.pres}||${branch}||${provider}`;
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          name: p.name,
          pres: p.pres,
          branch,
          provider,
          perPeriod: new Map()
        });
      }
      const r = rowMap.get(rowKey);
      r.perPeriod.set(periodKey, (r.perPeriod.get(periodKey) || 0) + p.qty);
    }
  }

  const periods = Array.from(periodsSet).sort((a,b) => a.localeCompare(b));
  const header = ["Producto", "Presentación", "Sucursal", "Proveedor", ...periods, "Total"];

  const rows = [];
  const exportRows = [header.slice()];

  const sortedEntries = Array.from(rowMap.values()).sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    if (a.pres !== b.pres) return a.pres.localeCompare(b.pres);
    if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
    return a.provider.localeCompare(b.provider);
  });

  for (const r of sortedEntries) {
    const vals = periods.map(k => r.perPeriod.get(k) || 0);
    const total = vals.reduce((acc, v) => acc + v, 0);
    rows.push({
      name: r.name,
      pres: r.pres,
      branch: r.branch,
      provider: r.provider,
      vals,
      total
    });
    exportRows.push([r.name, r.pres, r.branch, r.provider, ...vals, total]);
  }

  return { rows, periods, header, exportRows };
}

/* ================== RENDER ================== */
function renderTable(rows, periods, header) {
  const container = document.getElementById("reportResults");
  if (!rows.length) {
    container.innerHTML = `<div class="alert alert-info">No hay datos para los filtros seleccionados.</div>`;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-bordered table-sm">
        <thead class="thead-light">
          <tr>${header.map(h => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    html += `
      <tr>
        <td>${r.name}</td>
        <td>${r.pres}</td>
        <td>${r.branch}</td>
        <td>${r.provider}</td>
        ${r.vals.map(v => `<td>${v}</td>`).join("")}
        <td><strong>${r.total}</strong></td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;
  container.innerHTML = html;
}

/* ================== EXPORT ================== */
function exportCurrentTableToXLSX() {
  if (typeof XLSX === "undefined") {
    return Swal.fire("No disponible", "XLSX no está cargado.", "info");
  }
  const data = window._lastExportRows || [];
  if (!data.length) {
    return Swal.fire("Sin datos", "Genera un reporte antes de exportar.", "info");
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Consumo");
  const startStr = document.getElementById("startDate").value || "inicio";
  const endStr   = document.getElementById("endDate").value || "fin";
  const periodic = document.getElementById("periodicity").value || "periodo";
  XLSX.writeFile(wb, `Consumo_${periodic}_${startStr}_a_${endStr}.xlsx`);
}
