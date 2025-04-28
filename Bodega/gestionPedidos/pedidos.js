// ------------------------------------------------------------------
// VARIABLES GLOBALES
// ------------------------------------------------------------------
let loggedInUsername = null;
let inPUnsub = null, compUnsub = null;
let currentOrderId = null, currentOrderData = null;

// ------------------------------------------------------------------
// INICIALIZACIÓN
// ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await initUser();
  await loadFilters();
  attachInProcessListener();
  attachCompletedListener();
});

// ------------------------------------------------------------------
// INICIALIZAR USUARIO
// ------------------------------------------------------------------
async function initUser() {
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    window.location.href = "/login.html";
    return;
  }
  document.getElementById("loggedInUser").textContent = "Usuario: " + loggedInUsername;
}

// ------------------------------------------------------------------
// CARGAR FILTROS DINÁMICOS
// ------------------------------------------------------------------
async function loadFilters() {
  const provs = new Set(), sucs = new Set();
  const snap = await db.collection("orders").get();
  snap.forEach(d => {
    provs.add(d.data().providerName);
    sucs.add(d.data().sucursalName);
  });
  const pf = document.getElementById("providerFilter"),
        sf = document.getElementById("sucursalFilter");
  provs.forEach(p=> pf.append(new Option(p,p)));
  sucs.forEach(s=> sf.append(new Option(s,s)));
}

// ------------------------------------------------------------------
// RECARGAR PEDIDOS
// ------------------------------------------------------------------
function reloadOrders() {
  attachInProcessListener();
  attachCompletedListener();
}

// ------------------------------------------------------------------
// LISTENER PEDIDOS EN PROCESO
// ------------------------------------------------------------------
function attachInProcessListener() {
  if (inPUnsub) inPUnsub();
  let q = db.collection("orders")
    .where("destination","==","Bodega")
    .where("status","in",["pedidoTomado","pedidoEnBodega","bodegaEnvioPedido"]);

  // filtros
  const idv = document.getElementById("idSearchInput").value.trim();
  if (idv) q = q.where("orderId","==",idv);
  const pv = document.getElementById("providerFilter").value;
  if (pv!=="all") q = q.where("providerName","==",pv);
  const sv = document.getElementById("sucursalFilter").value;
  if (sv!=="all") q = q.where("sucursalName","==",sv);
  const dv = document.getElementById("dateSearchInput").value;
  if (dv) {
    const d0=new Date(dv), d1=new Date(dv);
    d1.setDate(d1.getDate()+1);
    q = q.where("timestamp",">=",d0).where("timestamp","<",d1);
  }
  q = q.orderBy("timestamp","desc");

  inPUnsub = q.onSnapshot(snap=>{
    const c = document.getElementById("inProcessOrders");
    c.innerHTML="";
    snap.forEach(d=> c.appendChild(createCard(d.id,d.data())));
  }, e=> Swal.fire("Error",e.message,"error"));
}

// ------------------------------------------------------------------
// LISTENER PEDIDOS COMPLETADOS
// ------------------------------------------------------------------
function attachCompletedListener() {
  if (compUnsub) compUnsub();
  let q = db.collection("orders")
    .where("destination","==","Bodega")
    .where("status","==","sucursalRecibioPedido");

  // mismos filtros...
  const idv = document.getElementById("idSearchInput").value.trim();
  if (idv) q = q.where("orderId","==",idv);
  const pv = document.getElementById("providerFilter").value;
  if (pv!=="all") q = q.where("providerName","==",pv);
  const sv = document.getElementById("sucursalFilter").value;
  if (sv!=="all") q = q.where("sucursalName","==",sv);
  const dv = document.getElementById("dateSearchInput").value;
  if (dv) {
    const d0=new Date(dv), d1=new Date(dv);
    d1.setDate(d1.getDate()+1);
    q = q.where("timestamp",">=",d0).where("timestamp","<",d1);
  }
  q = q.orderBy("timestamp","desc");

  compUnsub = q.onSnapshot(snap=>{
    const c = document.getElementById("completedOrders");
    c.innerHTML="";
    snap.forEach(d=> c.appendChild(createCard(d.id,d.data())));
  }, e=> Swal.fire("Error",e.message,"error"));
}

// ------------------------------------------------------------------
// CREAR TARJETA DE PEDIDO
// ------------------------------------------------------------------
function createCard(id,o) {
  const div=document.createElement("div");
  div.className="order-card";
  let btns=`<button onclick="showDetails('${id}')">Detalles</button>`;
  if (["pedidoTomado","pedidoEnBodega","bodegaEnvioPedido"].includes(o.status)) {
    btns+=`<button onclick="confirmOrder('${id}')">Recibir</button>`;
  }
  if (o.status==="sucursalRecibioPedido") {
    btns+=`<button onclick="viewReceived('${id}')">Ver Recepción</button>`;
    btns+=`<button onclick="promptSendOrder('${id}')">Enviar Pedido</button>`;
  }
  div.innerHTML=`
    <h4>ID: ${o.orderId}</h4>
    <p>Proveedor: ${o.providerName}</p>
    <p>Sucursal: ${o.sucursalName}</p>
    <p>Fecha: ${o.orderDate}</p>
    <div class="order-status">${genBar(o)}</div>
    ${btns}
  `;
  return div;
}

// ------------------------------------------------------------------
// BARRA DE PROGRESO
// ------------------------------------------------------------------
function genBar(o) {
  const flow=[
    {k:"pending",label:"Pendiente"},
    {k:"pedidoTomado",label:"Tomado"},
    {k:"pedidoEnBodega",label:"En Bodega"},
    {k:"bodegaEnvioPedido",label:"En Camino"},
    {k:"sucursalRecibioPedido",label:"Recibido"}
  ];
  const idx=flow.findIndex(f=>f.k===o.status),
        lines=flow.map((f,i)=>{
    const cls=i<idx?"completed":i===idx?"current":"";
    return `
      <div class="progress-step ${cls}">
        <div class="step-number">${i+1}</div>
        <div class="step-label">${f.label}</div>
      </div>
      ${i<flow.length-1?`<div class="progress-line ${i<idx?"completed":""}"></div>`:""}
    `;
  }).join("");
  return `<div class="progress-container">${lines}</div>`;
}

// ------------------------------------------------------------------
// MODAL DETALLES
// ------------------------------------------------------------------
function showDetails(id) {
  db.collection("orders").doc(id).get()
    .then(s=> {
      const o=s.data();
      let html=`
        <p><strong>ID:</strong> ${o.orderId}</p>
        <p><strong>Proveedor:</strong> ${o.providerName}</p>
        <p><strong>Sucursal:</strong> ${o.sucursalName}</p>
        <p><strong>Fecha:</strong> ${o.orderDate}</p>
      `;
      if(o.products){
        html+=`<table><thead><tr>
                  <th>Producto</th><th>Pres.</th><th>Cant.</th>
                </tr></thead><tbody>`;
        o.products.forEach(p=>{
          html+=`<tr>
                    <td>${p.name}</td>
                    <td>${p.presentation||"-"}</td>
                    <td>${p.quantity}</td>
                  </tr>`;
        });
        html+="</tbody></table>";
      }
      document.getElementById("orderDetails").innerHTML=html;
      document.getElementById("orderDetailsModal").style.display="block";
    });
}
function closeDetails() {
  document.getElementById("orderDetailsModal").style.display="none";
}

// ------------------------------------------------------------------
// MODAL RECEPCIÓN
// ------------------------------------------------------------------
async function confirmOrder(id) {
  currentOrderId=id;
  const s=await db.collection("orders").doc(id).get();
  const o=s.data();
  currentOrderData=o;
  document.getElementById("orderIdDisplay").textContent=o.orderId;
  document.getElementById("providerNameDisplay").textContent=o.providerName;
  document.getElementById("orderDateDisplay").textContent=o.orderDate;
  // llenar tabla
  const tb=document.getElementById("confirmOrderProducts");
  tb.innerHTML="";
  o.products.forEach((p,i)=>{
    tb.insertAdjacentHTML("beforeend",`
      <tr>
        <td>${p.name}</td>
        <td>${p.presentation||"-"}</td>
        <td>${p.quantity}</td>
        <td><input type="number" id="recQty${i}" value="${p.quantity}" min="0"/></td>
        <td><input type="number" id="unitPrice${i}" step="0.01" value="0"/></td>
      </tr>`);
  });
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  document.getElementById("confirmOrderModal").style.display="block";
}
function closeConfirm() {
  document.getElementById("confirmOrderModal").style.display="none";
}
async function saveConfirmedOrder() {
  const inv = document.getElementById("invoiceNumber").value.trim();
  const iDate = document.getElementById("invoiceDate").value;
  if (!inv || !iDate) {
    return Swal.fire("Faltan datos","Ingrese factura y fecha","warning");
  }
  const recProds = currentOrderData.products.map((p,i)=>({
    name:p.name,
    presentation:p.presentation,
    quantity:p.quantity,
    receivedQuantity: parseInt(document.getElementById(`recQty${i}`).value,10)||0,
    unitPrice: parseFloat(document.getElementById(`unitPrice${i}`).value)||0
  }));
  await db.collection("orders").doc(currentOrderId).update({
    receivedProducts: recProds,
    invoiceNumber: inv,
    invoiceDate: iDate,
    status: "sucursalRecibioPedido"
  });
  Swal.fire("Guardado","Recepción registrada","success");
  closeConfirm();
}

// ------------------------------------------------------------------
// VER RECEPCIÓN
// ------------------------------------------------------------------
function viewReceived(id) {
  db.collection("orders").doc(id).get()
    .then(s=>{
      const o=s.data();
      let html=`
        <p><strong>ID:</strong> ${o.orderId}</p>
        <p><strong>Proveedor:</strong> ${o.providerName}</p>
        <p><strong>Fecha Pedido:</strong> ${o.orderDate}</p>
        <p><strong>Factura:</strong> ${o.invoiceNumber} / ${o.invoiceDate}</p>
        <table><thead><tr>
          <th>Producto</th><th>Pres.</th><th>Ped.</th><th>Rec.</th><th>U.P.</th>
        </tr></thead><tbody>`;
      o.receivedProducts.forEach(rp=>{
        html+=`<tr>
                  <td>${rp.name}</td>
                  <td>${rp.presentation||"-"}</td>
                  <td>${rp.quantity}</td>
                  <td>${rp.receivedQuantity}</td>
                  <td>Q${rp.unitPrice.toFixed(2)}</td>
               </tr>`;
      });
      html+="</tbody></table>";
      document.getElementById("receivedOrderDetails").innerHTML=html;
      document.getElementById("receivedOrderModal").style.display="block";
    });
}
function closeReceived() {
  document.getElementById("receivedOrderModal").style.display="none";
}
function exportReceivedImage() {
  const modal = document.getElementById("receivedOrderDetails");
  html2canvas(modal,{scale:3}).then(c=>{
    const link=document.createElement("a");
    link.href=c.toDataURL();
    link.download="recepcion.png";
    link.click();
  });
}

// ------------------------------------------------------------------
// ENVIAR PEDIDO
// ------------------------------------------------------------------
function promptSendOrder(id) {
  currentOrderId = id;
  document.getElementById("sendDateDisplay").textContent = new Date().toLocaleDateString();
  document.getElementById("transportType").value = "propio";
  document.getElementById("guideInput").style.display = "none";
  document.getElementById("sendOrderModal").style.display = "block";
}
function closeSend() {
  document.getElementById("sendOrderModal").style.display="none";
}
document.getElementById("transportType")?.addEventListener("change", e=>{
  document.getElementById("guideInput").style.display = e.target.value==="guia"?"block":"none";
});
async function confirmSend() {
  const type = document.getElementById("transportType").value;
  const guide = type==="guia" ? document.getElementById("guideNumber").value.trim() : "";
  await db.collection("orders").doc(currentOrderId).update({
    status: "bodegaEnvioPedido",
    shippingInfo: { type, guideNumber: guide, sendDate: new Date() }
  });
  Swal.fire("Enviado","Pedido puesto en camino","success");
  closeSend();
}
