// tickets.js
let loggedInUsername = null;
let userSucursalId = null;
let userSucursalName = null;
let userEmail = null;
let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initUserAndSucursal();
  initAreasAndSubcategories();
  wireFilePreview();
  loadMyTickets();
});

async function initUserAndSucursal() {
  loggedInUsername = localStorage.getItem('usuarioLogueado');
  if (!loggedInUsername) {
    Swal.fire({ icon: 'warning', title: 'No autenticado' }).then(() => window.location.href = '../login.html');
    return;
  }
  // Extraer sucursal del usuario
  const snap = await db.collection('usuarios').where('username', '==', loggedInUsername).limit(1).get();
  if (!snap.empty) {
    const data = snap.docs[0].data();
    userSucursalId = data.sucursalId || null;
    userEmail = data.email || '';
    userRole = data.rol || '';
    const sucDoc = userSucursalId ? await db.collection('sucursales').doc(userSucursalId).get() : null;
    userSucursalName = sucDoc?.exists ? sucDoc.data().name : '';
  }
}

function initAreasAndSubcategories() {
  const areaSel = document.getElementById('affectedArea');
  const subSel = document.getElementById('subCategory');
  const subGroup = document.getElementById('subCategoryGroup');
  const otherGroup = document.getElementById('otherCategoryGroup');
  const areaToSubs = {
    'Cocina': ['Refrigerador', 'Plancha', 'Freidora', 'Fuga de gas', 'Extractor', 'Tubería'],
    'Área de Clientes (Salón)': ['Iluminación', 'Mobiliario', 'Climatización', 'Limpieza'],
    'Sanitarios': ['Inodoro tapado', 'Fuga de agua', 'Secador de manos', 'Sin papel/jabón'],
    'Exterior': ['Letrero', 'Estacionamiento', 'Fachada'],
    'Sistemas / TI': ['Caja registradora no responde', 'Impresora de tickets', 'Falla de red (sin internet)', 'Software de pedidos'],
    'Otro': []
  };
  const areas = Object.keys(areaToSubs);
  areaSel.innerHTML = '';
  areas.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; areaSel.appendChild(o); });
  const fillSubs = () => {
    const area = areaSel.value;
    if (area === 'Otro') {
      subGroup.style.display = 'none';
      otherGroup.style.display = 'block';
    } else {
      subGroup.style.display = 'block';
      otherGroup.style.display = 'none';
      const list = areaToSubs[area] || [];
      subSel.innerHTML = '';
      list.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; subSel.appendChild(o); });
    }
  };
  areaSel.addEventListener('change', fillSubs);
  fillSubs();
}

function insertTemplate() {
  const t = `¿Qué equipo/objeto es?\n¿Cuál es el problema exacto? (no enciende, gotea, etc.)\n¿Desde cuándo ocurre?\n¿Ha intentado alguna solución?`;
  const area = document.getElementById('description');
  if (!area.value) area.value = t; else area.value += '\n\n' + t;
}

// Configuración de adjuntos
const MAX_FILES = 3;
const MAX_IMAGE_BYTES = 800 * 1024; // 800KB por imagen objetivo
const MAX_DIMENSION = 1600; // px (se redimensiona manteniendo aspecto)

function wireFilePreview() {
  const input = document.getElementById('attachments');
  const preview = document.getElementById('preview');
  input.addEventListener('change', () => {
    preview.innerHTML = '';
    let files = Array.from(input.files || []);
    // Filtrar solo imágenes válidas
    const invalids = files.filter(f => !/^image\/(jpeg|png)$/.test(f.type));
    if (invalids.length) {
      Swal.fire({ icon: 'warning', title: 'Formato no permitido', text: 'Solo se aceptan imágenes JPG o PNG.' });
      files = files.filter(f => /^image\/(jpeg|png)$/.test(f.type));
    }
    // Limitar a MAX_FILES
    if (files.length > MAX_FILES) {
      Swal.fire({ icon: 'info', title: 'Demasiadas imágenes', text: `Solo se subirán ${MAX_FILES} imágenes.` });
      files = files.slice(0, MAX_FILES);
    }
    // Reconstruir FileList visualmente (solo para previo; el control mantiene los originales)
    files.forEach(f => {
      const el = document.createElement('div');
      el.className = 'preview-item';
      if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.style.maxWidth = '100%'; img.style.height = 'auto';
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.readAsDataURL(f);
        el.appendChild(img);
      }
      preview.appendChild(el);
    });
  });
}

function getSelectedPriority() {
  const el = document.querySelector('input[name="priority"]:checked');
  return el ? el.value : 'normal';
}

function buildTicketId(sucursalId) {
  const now = new Date();
  const y = now.getFullYear();
  const part = Math.random().toString(36).slice(2, 6).toUpperCase();
  const suc = (sucursalId || 'XX').toString().slice(0, 4).toUpperCase();
  return `TKT-${suc}-${y}-${part}`;
}

function autoAssignGroup(area, sub, priority) {
  if (area === 'Sistemas / TI') return 'Soporte TI';
  if (area === 'Cocina' && sub === 'Refrigerador') return 'Mantto. Refrigeración';
  if (priority === 'urgent') return 'Guardia 24h';
  return 'Mantenimiento General';
}

function slaForPriority(priority) {
  if (priority === 'urgent') return { responseHours: 1, channel: 'sms_push' };
  if (priority === 'normal') return { responseHours: 24, channel: 'email' };
  return { responseHours: 72, channel: 'email' };
}

async function submitTicket() {
  try {
    const area = document.getElementById('affectedArea').value;
    const isOther = area === 'Otro';
    const sub = isOther ? document.getElementById('otherCategory').value.trim() : document.getElementById('subCategory').value;
    const priority = getSelectedPriority();
    const description = document.getElementById('description').value.trim();

    if (!userSucursalId) {
      Swal.fire({ icon: 'warning', title: 'Sucursal no disponible', text: 'No se pudo identificar tu sucursal. Contacta al administrador.' });
      return;
    }
    if (!area || !sub) {
      Swal.fire({ icon: 'warning', title: 'Campos faltantes', text: 'Área y Subcategoría son obligatorios.' });
      return;
    }
    if (description.length < 15) {
      Swal.fire({ icon: 'warning', title: 'Descripción insuficiente', text: 'Describe el problema con al menos 15 caracteres.' });
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
        username: loggedInUsername || '',
        name: loggedInUsername || '',
        email: userEmail || '',
        role: userRole || ''
      },
      sucursalId: userSucursalId,
      sucursalName: userSucursalName || '',
      area,
      subCategory: sub,
      priority,
      sla,
      description,
      assignmentGroup: assignGroup
    };

    // Subir imágenes si las hay (máximo MAX_FILES y con compresión)
    let files = Array.from(document.getElementById('attachments').files || []);
    // Filtrar imágenes válidas
    files = files.filter(f => /^image\/(jpeg|png)$/.test(f.type));
    if (files.length > MAX_FILES) {
      Swal.fire({ icon: 'info', title: 'Límite de imágenes', text: `Solo se subirán ${MAX_FILES} imágenes.` });
      files = files.slice(0, MAX_FILES);
    }
    const uploaded = [];
    for (const f of files) {
      const { blob, warned } = await compressImageIfNeeded(f, MAX_IMAGE_BYTES, MAX_DIMENSION);
      if (!blob) { continue; }
      const finalName = f.name.replace(/\.(png|jpg|jpeg)$/i, '') + '_compressed.jpg';
      const ref = firebase.storage().ref().child(`tickets/${ticketId}/${Date.now()}_${finalName}`);
      const metadata = { contentType: 'image/jpeg' };
      const snap = await ref.put(blob, metadata);
      const url = await snap.ref.getDownloadURL();
      uploaded.push({ name: finalName, url, contentType: 'image/jpeg', size: blob.size });
      if (warned) {
        // Ya se mostró advertencia dentro de la función de compresión
      }
    }
    baseData.attachments = uploaded;

    await db.collection('tickets').add(baseData);

    Swal.fire({ icon: 'success', title: 'Ticket creado', text: `ID: ${ticketId} asignado a ${assignGroup}` });
    document.getElementById('ticketForm').reset();
    document.getElementById('preview').innerHTML = '';
    document.getElementById('subCategoryGroup').style.display = 'block';
    document.getElementById('otherCategoryGroup').style.display = 'none';
    initAreasAndSubcategories();
    loadMyTickets();
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: e.message });
  }
}

// Comprimir imagen si excede el umbral; convertir todo a JPEG con calidad progresiva
async function compressImageIfNeeded(file, maxBytes, maxDim) {
  const warned = { value: false };
  const readAsImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await readAsImage(file);
  // Calcular dimensiones destino manteniendo aspecto
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    if (width >= height) { height = Math.round((maxDim / width) * height); width = maxDim; }
    else { width = Math.round((maxDim / height) * width); height = maxDim; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  // Intentos de compresión reduciendo calidad
  let quality = 0.85;
  let blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) return { blob: null, warned: false };
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) break;
  }
  if (!blob) return { blob: null, warned: false };
  if (blob.size > maxBytes) {
    Swal.fire({ icon: 'warning', title: 'Imagen muy pesada', text: 'Se comprimió la imagen al máximo permitido, pero aún supera el tamaño recomendado.' });
    warned.value = true;
  } else if (file.size > maxBytes) {
    // Solo informar si hubo compresión efectiva
    Swal.fire({ icon: 'info', title: 'Imágenes optimizadas', text: 'Se comprimieron una o más imágenes para cumplir el límite.' });
    warned.value = true;
  }
  return { blob, warned: warned.value };
}

function ticketCardHTML(t) {
  const created = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : (t.createdAtLocal || '');
  return `
    <div class="ticket-card">
      <h3>${t.ticketId} – <span class="status ${t.status}">${t.status}</span></h3>
      <div class="ticket-meta">${created} · ${t.sucursalName || ''}</div>
      <p><strong>Área:</strong> ${t.area} · <strong>Sub:</strong> ${t.subCategory}</p>
      <p><strong>Prioridad:</strong> ${t.priority} · <strong>Asignación:</strong> ${t.assignmentGroup}</p>
      <p>${(t.description || '').slice(0, 160)}</p>
      ${attachmentsHTML(t.attachments)}
    </div>
  `;
}

function attachmentsHTML(att) {
  if (!att || !att.length) return '';
  const items = att.map(a => `<div class="preview-item"><a href="${a.url}" target="_blank">${a.name}</a></div>`).join('');
  return `<div class="preview" style="margin-top:8px;">${items}</div>`;
}

async function loadMyTickets() {
  const cont = document.getElementById('ticketsList');
  cont.innerHTML = '';
  const snap = await db.collection('tickets')
    .where('reporter.username', '==', loggedInUsername || '')
    .limit(50)
    .get();
  const items = [];
  snap.forEach(doc => { items.push(doc.data()); });
  // Ordenar en cliente por createdAt (server) o fallback a createdAtLocal
  items.sort((a, b) => {
    const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.parse(a.createdAtLocal || 0);
    const dbb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.parse(b.createdAtLocal || 0);
    return dbb - da;
  });
  items.forEach(t => cont.insertAdjacentHTML('beforeend', ticketCardHTML(t)));
}

