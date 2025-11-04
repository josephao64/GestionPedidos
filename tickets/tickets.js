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
  wireFileLinks();
  loadMyTickets();
});

function wireFileLinks() {
  document.addEventListener('click', async (e) => {
    if (e.target.matches('.file-link')) {
      e.preventDefault();
      const filename = e.target.dataset.filename;
      try {
        const response = await fetch(e.target.href);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error descargando archivo:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error al descargar',
          text: 'No se pudo descargar el archivo. Intente más tarde.'
        });
      }
    }
  });
}

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

function wireFilePreview() {
  const input = document.getElementById('attachments');
  const preview = document.getElementById('preview');
  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const files = Array.from(input.files || []);
    files.slice(0, 5).forEach(f => {
      if (f.size > 10 * 1024 * 1024) return; // 10MB
      const el = document.createElement('div');
      el.className = 'preview-item';
      if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.style.maxWidth = '100%'; img.style.height = 'auto';
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.readAsDataURL(f);
        el.appendChild(img);
      } else {
        el.textContent = f.name;
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

    // Subir archivos si los hay
    const files = Array.from(document.getElementById('attachments').files || []).slice(0, 5);
    const uploaded = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) continue;
      const timestamp = Date.now();
      const fileName = `${timestamp}_${f.name}`;
      const ref = firebase.storage().ref().child(`tickets/${ticketId}/${fileName}`);
      
      // Convertir imagen a base64 si es una imagen
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        const imageData = await new Promise((resolve, reject) => {
          reader.onload = e => resolve(e.target.result);
          reader.onerror = e => reject(e);
          reader.readAsDataURL(f);
        });
        
        uploaded.push({ 
          name: f.name, 
          dataUrl: imageData, 
          contentType: f.type, 
          size: f.size,
          timestamp 
        });
        
        // También subir a Storage en segundo plano
        try {
          const snap = await ref.put(f, { contentType: f.type });
          const url = await snap.ref.getDownloadURL();
          uploaded[uploaded.length - 1].url = url;
        } catch (error) {
          console.warn('Error al subir a Storage:', error);
          // Continuamos usando el dataUrl si falla la subida a Storage
        }
      } else {
        // Para archivos que no son imágenes, intentar subir normalmente
        const snap = await ref.put(f, { contentType: f.type });
        const url = await snap.ref.getDownloadURL();
        uploaded.push({ 
          name: f.name, 
          url, 
          contentType: f.type, 
          size: f.size,
          timestamp 
        });
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
  const items = att.map(a => {
    if (a.contentType && a.contentType.startsWith('image/')) {
      // Usar dataUrl si está disponible, de lo contrario intentar con url
      const imgSrc = a.dataUrl || a.url;
      return `
        <div class="preview-item">
          <img src="${imgSrc}" alt="${a.name}" style="max-width: 200px; height: auto;" 
               onerror="this.onerror=null; this.src='../resources/images/image-placeholder.png';" />
          <div>${a.name}</div>
        </div>`;
    }
    return `<div class="preview-item">
              <a href="${a.url}" target="_blank" class="file-link" data-filename="${a.name}">
                ${a.name}
              </a>
            </div>`;
  }).join('');
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

