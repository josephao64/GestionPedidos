// tickets-app.js (Bootstrap) — completo
// Requiere Firebase v8 global y 'db' expuesto por ../database/connection.js
// Usa el mismo modelo de datos que tu tickets.js anterior

let loggedInUsername = null;
let userSucursalId = null;
let userSucursalName = null;
let userEmail = null;
let userRole = null;

// Constantes de adjuntos
const MAX_FILES = 3;
const MAX_IMAGE_BYTES = 800 * 1024; // 800KB por imagen objetivo
const MAX_DIMENSION = 1600; // px (se redimensiona manteniendo aspecto)

// Mapa de áreas/subcategorías
const AREA_TO_SUBS = {
  'Cocina': ['Refrigerador', 'Plancha', 'Freidora', 'Fuga de gas', 'Extractor', 'Tubería'],
  'Área de Clientes (Salón)': ['Iluminación', 'Mobiliario', 'Climatización', 'Limpieza'],
  'Sanitarios': ['Inodoro tapado', 'Fuga de agua', 'Secador de manos', 'Sin papel/jabón'],
  'Exterior': ['Letrero', 'Estacionamiento', 'Fachada'],
  'Sistemas / TI': ['Caja registradora no responde', 'Impresora de tickets', 'Falla de red (sin internet)', 'Software de pedidos'],
  'Otro': []
};

// --- Bootstrap helpers
function show(el){ el.classList.remove('d-none'); }
function hide(el){ el.classList.add('d-none'); }

// --- Init
window.addEventListener('DOMContentLoaded', async () => {
  await initUserAndSucursal();
  initAreasAndSubcategories();
  wireFilePreview();
  wireFilters();
  await refreshList();
});

async function initUserAndSucursal(){
  loggedInUsername = localStorage.getItem('usuarioLogueado');
  if(!loggedInUsername){
    await Swal.fire({icon:'warning', title:'No autenticado'});
    window.location.href = '../login.html';
    return;
  }
  // Usuario
  const usnap = await db.collection('usuarios')
    .where('username','==',loggedInUsername)
    .limit(1).get();
  if(!usnap.empty){
    const data = usnap.docs[0].data();
    userSucursalId = data.sucursalId || null;
    userEmail = data.email || '';
    userRole = data.rol || '';
    const sucDoc = userSucursalId ? await db.collection('sucursales').doc(userSucursalId).get() : null;
    userSucursalName = sucDoc?.exists ? sucDoc.data().name : '';
  }
  // UI usuario
  document.getElementById('uiUsername').textContent = loggedInUsername || '—';
  document.getElementById('uiSucursal').textContent = userSucursalName || '—';
  document.getElementById('uiRole').textContent = userRole || '—';
}

function initAreasAndSubcategories(){
  const areaSel = document.getElementById('affectedArea');
  const subSel = document.getElementById('subCategory');
  const otherGroup = document.getElementById('otherCategoryGroup');
  const subGroup = document.getElementById('subCategoryGroup');
  areaSel.innerHTML = '';
  Object.keys(AREA_TO_SUBS).forEach(a=>{
    const o = document.createElement('option'); o.value=a; o.textContent=a; areaSel.appendChild(o);
  });
  const fill = ()=>{
    const area = areaSel.value;
    if(area==='Otro'){
      subGroup.classList.add('d-none');
      otherGroup.classList.remove('d-none');
    }else{
      subGroup.classList.remove('d-none');
      otherGroup.classList.add('d-none');
      subSel.innerHTML = '';
      (AREA_TO_SUBS[area]||[]).forEach(s=>{
        const o = document.createElement('option'); o.value=s; o.textContent=s; subSel.appendChild(o);
      });
    }
  };
  areaSel.addEventListener('change', fill);
  fill();
}

// Plantilla de descripción
window.insertTemplate = function(){
  const t = `¿Qué equipo/objeto es?
¿Cuál es el problema exacto? (no enciende, gotea, etc.)
¿Desde cuándo ocurre?
¿Ha intentado alguna solución?`;
  const area = document.getElementById('description');
  if(!area.value) area.value = t; else area.value += '\n\n'+t;
};

function getSelectedPriority(){
  const el = document.querySelector('input[name="priority"]:checked');
  return el ? el.value : 'normal';
}

function buildTicketId(sucursalId){
  const now = new Date();
  const y = now.getFullYear();
  const part = Math.random().toString(36).slice(2,6).toUpperCase();
  const suc = (sucursalId||'XX').toString().slice(0,4).toUpperCase();
  return `TKT-${suc}-${y}-${part}`;
}

function autoAssignGroup(area, sub, priority){
  if(area==='Sistemas / TI') return 'Soporte TI';
  if(area==='Cocina' && sub==='Refrigerador') return 'Mantto. Refrigeración';
  if(priority==='urgent') return 'Guardia 24h';
  return 'Mantenimiento General';
}

function slaForPriority(priority){
  if(priority==='urgent') return { responseHours:1, channel:'sms_push' };
  if(priority==='normal') return { responseHours:24, channel:'email' };
  return { responseHours:72, channel:'email' };
}

// ----- Adjuntos (preview y compresión)
function wireFilePreview(){
  const input = document.getElementById('attachments');
  const preview = document.getElementById('preview');
  input.addEventListener('change', ()=>{
    preview.innerHTML = '';
    let files = Array.from(input.files||[]);
    const invalids = files.filter(f=>!/^image\/(jpeg|png)$/.test(f.type));
    if(invalids.length){
      Swal.fire({icon:'warning', title:'Formato no permitido', text:'Solo imágenes JPG o PNG.'});
      files = files.filter(f=>/^image\/(jpeg|png)$/.test(f.type));
    }
    if(files.length>MAX_FILES){
      Swal.fire({icon:'info', title:'Demasiadas imágenes', text:`Solo se subirán ${MAX_FILES} imágenes.`});
      files = files.slice(0,MAX_FILES);
    }
    files.forEach(f=>{
      const wrap = document.createElement('div');
      wrap.className = 'preview-item';
      const img = document.createElement('img');
      img.style.maxWidth='120px'; img.style.height='auto'; img.loading='lazy';
      const rdr = new FileReader(); rdr.onload = e=> img.src = e.target.result; rdr.readAsDataURL(f);
      wrap.appendChild(img); preview.appendChild(wrap);
    });
  });
}

async function compressImageIfNeeded(file, maxBytes, maxDim){
  const readAsImage = (file)=> new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    const rdr = new FileReader();
    rdr.onload = e=>{ img.src = e.target.result; };
    rdr.onerror = reject;
    rdr.readAsDataURL(file);
  });
  const img = await readAsImage(file);
  let {width, height} = img;
  if(Math.max(width,height)>maxDim){
    if(width>=height){ height = Math.round((maxDim/width)*height); width = maxDim; }
    else{ width = Math.round((maxDim/height)*width); height = maxDim; }
  }
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,width,height);
  let quality = 0.85;
  let blob = await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));
  if(!blob) return { blob:null, warned:false };
  while(blob.size>maxBytes && quality>0.4){
    quality -= 0.1;
    blob = await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));
    if(!blob) break;
  }
  if(!blob) return { blob:null, warned:false };
  let warned=false;
  if(blob.size>maxBytes){
    await Swal.fire({icon:'warning', title:'Imagen muy pesada', text:'Se comprimió al máximo y aún supera el tamaño recomendado.'});
    warned=true;
  }else if(file.size>maxBytes){
    await Swal.fire({icon:'info', title:'Imágenes optimizadas', text:'Se comprimieron una o más imágenes para cumplir el límite.'});
    warned=true;
  }
  return { blob, warned };
}

// ----- Crear ticket
window.submitTicket = async function(){
  try{
    const area = document.getElementById('affectedArea').value;
    const isOther = area==='Otro';
    const sub = isOther ? (document.getElementById('otherCategory').value||'').trim() : document.getElementById('subCategory').value;
    const priority = getSelectedPriority();
    const description = (document.getElementById('description').value||'').trim();

    if(!userSucursalId){
      await Swal.fire({icon:'warning', title:'Sucursal no disponible', text:'No se pudo identificar tu sucursal.'});
      return;
    }
    if(!area || !sub){
      await Swal.fire({icon:'warning', title:'Campos faltantes', text:'Área y Subcategoría son obligatorios.'});
      return;
    }
    if(description.length<15){
      await Swal.fire({icon:'warning', title:'Descripción insuficiente', text:'Mínimo 15 caracteres.'});
      return;
    }

    const ticketId = buildTicketId(userSucursalId);
    const assignGroup = autoAssignGroup(area, sub, priority);
    const sla = slaForPriority(priority);
    const createdAt = new Date();

    const baseData = {
      ticketId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtLocal: createdAt.toISOString(),
      status: 'open',
      reporter: {
        username: loggedInUsername||'',
        name: loggedInUsername||'',
        email: userEmail||'',
        role: userRole||''
      },
      sucursalId: userSucursalId,
      sucursalName: userSucursalName||'',
      area,
      subCategory: sub,
      priority,
      sla,
      description,
      assignmentGroup: assignGroup
    };

    // Adjuntos
    let files = Array.from(document.getElementById('attachments').files||[])
      .filter(f=>/^image\/(jpeg|png)$/.test(f.type));
    if(files.length>MAX_FILES){
      await Swal.fire({icon:'info', title:'Límite de imágenes', text:`Solo se subirán ${MAX_FILES} imágenes.`});
      files = files.slice(0,MAX_FILES);
    }
    const uploaded=[];
    for(const f of files){
      const { blob } = await compressImageIfNeeded(f, MAX_IMAGE_BYTES, MAX_DIMENSION);
      if(!blob) continue;
      const finalName = f.name.replace(/\.(png|jpg|jpeg)$/i,'')+'_compressed.jpg';
      const ref = firebase.storage().ref().child(`tickets/${ticketId}/${Date.now()}_${finalName}`);
      const snap = await ref.put(blob, { contentType:'image/jpeg' });
      const url = await snap.ref.getDownloadURL();
      uploaded.push({ name: finalName, url, contentType:'image/jpeg', size: blob.size });
    }
    baseData.attachments = uploaded;

    await db.collection('tickets').add(baseData);
    await Swal.fire({icon:'success', title:'Ticket creado', text:`ID: ${ticketId} asignado a ${assignGroup}`});

    document.getElementById('ticketForm').reset();
    document.getElementById('preview').innerHTML='';
    document.getElementById('subCategoryGroup').classList.remove('d-none');
    document.getElementById('otherCategoryGroup').classList.add('d-none');
    initAreasAndSubcategories();

    // Cambiar a pestaña de listado
    const listTab = document.querySelector('[data-bs-target="#view-list"]');
    if(listTab){ new bootstrap.Tab(listTab).show(); }
    await refreshList();
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error', text:e.message});
  }
};

// ----- Listado y filtros
let myTicketsCache = [];

function kpiCount(items){
  const total = items.length;
  const open = items.filter(x=>x.status==='open').length;
  const prog = items.filter(x=>x.status==='in_progress').length;
  const closed = items.filter(x=>x.status==='closed').length;
  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiOpen').textContent = open;
  document.getElementById('kpiProg').textContent = prog;
  document.getElementById('kpiClosed').textContent = closed;
}

function wireFilters(){
  document.getElementById('btnRefresh').addEventListener('click', refreshList);
  document.getElementById('filterSearch').addEventListener('input', applyFilters);
  document.getElementById('filterStatus').addEventListener('change', applyFilters);
  document.getElementById('filterPriority').addEventListener('change', applyFilters);
}

async function refreshList(){
  const cont = document.getElementById('ticketsList');
  cont.innerHTML = '';
  const snap = await db.collection('tickets')
    .where('reporter.username','==', loggedInUsername||'')
    .limit(200)
    .get();
  const items = [];
  snap.forEach(doc=>{
    const data = doc.data();
    data.firestoreDocId = doc.id; // para acciones
    items.push(data);
  });
  items.sort((a,b)=>{
    const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.parse(a.createdAtLocal||0);
    const dbb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.parse(b.createdAtLocal||0);
    return dbb - da;
  });
  myTicketsCache = items;
  applyFilters();
}

function applyFilters(){
  const q = (document.getElementById('filterSearch').value||'').toLowerCase();
  const st = document.getElementById('filterStatus').value;
  const pr = document.getElementById('filterPriority').value;
  const list = document.getElementById('ticketsList');
  list.innerHTML='';
  let filtered = myTicketsCache.filter(t=>{
    const text = [t.ticketId, t.area, t.subCategory, t.description].join(' ').toLowerCase();
    const passQ = !q || text.includes(q);
    const passS = !st || t.status===st;
    const passP = !pr || t.priority===pr;
    return passQ && passS && passP;
  });
  kpiCount(filtered);
  const empty = document.getElementById('emptyState');
  if(filtered.length===0){ show(empty); return; } else { hide(empty); }
  const frag = document.createDocumentFragment();
  filtered.forEach(t=> frag.appendChild(renderTicketCard(t)) );
  list.appendChild(frag);
}

function renderTicketCard(t){
  const col = document.createElement('div'); col.className='col-12';
  const created = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : (t.createdAtLocal||'');
  col.innerHTML = `
    <div class="ticket-card p-3">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="h6 mb-1">${t.ticketId} – <span class="status ${t.status}">${labelStatus(t.status)}</span></h3>
          <div class="text-muted small">${created} · ${t.sucursalName||''}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-secondary rounded-pill" data-action="view">Ver</button>
          <button class="btn btn-sm btn-outline-danger rounded-pill" data-action="delete">Eliminar</button>
        </div>
      </div>
      <div class="mt-2 small">
        <div><strong>Área:</strong> ${t.area} · <strong>Sub:</strong> ${t.subCategory}</div>
        <div><strong>Prioridad:</strong> ${t.priority} · <strong>Asignación:</strong> ${t.assignmentGroup}</div>
      </div>
    </div>
  `;
  col.querySelector('[data-action="view"]').addEventListener('click', ()=> openTicketModal(t));
  col.querySelector('[data-action="delete"]').addEventListener('click', ()=> confirmDeleteTicket(t.firestoreDocId, t.ticketId));
  return col;
}

function labelStatus(s){
  if(s==='open') return 'abierto';
  if(s==='in_progress') return 'en progreso';
  if(s==='closed') return 'cerrado';
  return s||'—';
}

async function confirmDeleteTicket(docId, ticketId){
  const res = await Swal.fire({
    title:`¿Eliminar Ticket ${ticketId}?`,
    text:'Esta acción no se puede revertir. Las imágenes adjuntas no se borrarán del servidor, pero el ticket sí.',
    icon:'warning', showCancelButton:true, confirmButtonColor:'#d33',
    cancelButtonText:'Cancelar', confirmButtonText:'Sí, eliminar'
  });
  if(!res.isConfirmed) return;
  try{
    await db.collection('tickets').doc(docId).delete();
    await Swal.fire('Eliminado', `El ticket ${ticketId} ha sido eliminado.`, 'success');
    await refreshList();
  }catch(e){
    Swal.fire({icon:'error', title:'Error al eliminar', text:e.message});
  }
}

// Modal de detalle (SweetAlert)
function attachmentsHTML(att){
  if(!att||!att.length) return '<em class="text-muted">Sin adjuntos</em>';
  return att.map(a=>`<div><a href="${a.url}" target="_blank">${a.name}</a></div>`).join('');
}

async function openTicketModal(t){
  const created = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : (t.createdAtLocal||'');
  const html = `
    <div class="text-start">
      <div class="small text-muted">${created}</div>
      <h3 class="h6 mt-1">${t.ticketId} – <span class="status ${t.status}">${labelStatus(t.status)}</span></h3>
      <hr class="my-2"/>
      <div class="mb-1"><strong>Área:</strong> ${t.area}</div>
      <div class="mb-1"><strong>Subcategoría:</strong> ${t.subCategory}</div>
      <div class="mb-1"><strong>Prioridad:</strong> ${t.priority}</div>
      <div class="mb-1"><strong>Asignación:</strong> ${t.assignmentGroup}</div>
      <div class="mb-2"><strong>Descripción:</strong><br>${(t.description||'').replace(/\n/g,'<br>')}</div>
      <div class="mb-2"><strong>Adjuntos:</strong><br>${attachmentsHTML(t.attachments)}</div>
    </div>`;
  await Swal.fire({
    title:'Detalle del ticket',
    html,
    width: 700,
    showCloseButton:true,
    confirmButtonText:'Cerrar',
  });
}
