/* adminDashboard.js - SPA Kanban minimalista con Drag & Drop nativo */
(function(){
  // Datos iniciales en memoria (ejemplo)
  const tickets = [
    { id: 'TICKET-001', title: 'Error login', desc: 'Al iniciar sesión aparece error 500', priority: 'high', assigned: 'Juan', created: new Date().toLocaleString(), status: 'todo', image: null },
    { id: 'TICKET-002', title: 'Impresora no imprime', desc: 'La impresora de cocina no imprime tickets', priority: 'normal', assigned: '', created: new Date().toLocaleString(), status: 'inprogress', image: null },
    { id: 'TICKET-003', title: 'Actualizar menú', desc: 'Actualizar precios del menú digital', priority: 'low', assigned: 'Ana', created: new Date().toLocaleString(), status: 'done', image: null }
  ];

  // Helpers
  const byStatus = s => tickets.filter(t => t.status === s);
  const el = id => document.getElementById(id);

  // Render
  function renderBoard(){
    ['todo','inprogress','done'].forEach(status =>{
      const container = el('col-' + status);
      if (!container) return;
      container.innerHTML = '';
      byStatus(status).forEach(t => container.appendChild(createCard(t)));
    });
  }

  function createCard(t){
    const card = document.createElement('div');
    card.className = 'card ticket-card';
    card.draggable = true;
    card.dataset.id = t.id;

    const body = document.createElement('div');
    body.className = 'card-body p-2';
    const hasAttachment = t.image || (Array.isArray(t.attachments) && t.attachments.length > 0);
    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h6 class="card-ticket-title mb-1">${escapeHtml(t.title)}</h6>
          <div class="card-ticket-meta">${escapeHtml(t.id)} · ${escapeHtml(t.sucursalName || t.sucursal || '')} · <span class="text-muted">${escapeHtml(t.category || t.subCategory || '')} ${escapeHtml(t.assigned ? '· ' + t.assigned : '')}</span></div>
        </div>
        <div class="text-end">
          ${hasAttachment ? '<span class="badge bg-secondary badge-attach">🖼️</span>' : ''}
        </div>
      </div>
    `;

    card.appendChild(body);

    // Click abre modal
    card.addEventListener('click', (evt) => {
      if (card.classList.contains('dragging')) return;
      openModal(t);
    });

    // Drag events
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', t.id);
      if (e.dataTransfer.setDragImage) {
        const crt = card.cloneNode(true);
        crt.style.position = 'absolute'; crt.style.top = '-1000px'; document.body.appendChild(crt);
        e.dataTransfer.setDragImage(crt, 10, 10);
        setTimeout(() => document.body.removeChild(crt), 0);
      }
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    return card;
  }

  // Modal population and editing
  const modalEl = el('ticketModal');
  const bsModal = modalEl ? new bootstrap.Modal(modalEl) : null;
  let currentTicketRef = null; // either docId string or local ticket id

  function renderCommentsArea(t) {
    const wrap = el('modalComments');
    wrap.innerHTML = '';
    const comments = t.comments || [];
    if (!comments.length) { wrap.innerHTML = '<div class="text-muted small">Sin comentarios</div>'; return; }
    comments.slice().reverse().forEach(c => {
      const d = document.createElement('div');
      d.className = 'border p-2 mb-2 rounded';
      const when = c.createdAt && c.createdAt.toDate ? new Date(c.createdAt.toDate()).toLocaleString() : (c.createdAt || c.when || '');
      d.innerHTML = `<div class="small text-muted">${escapeHtml(when)}</div><div>${escapeHtml(c.text)}</div>`;
      wrap.appendChild(d);
    });
  }

  function openModal(t){
    // t may be either plain object (local) or Firestore-like doc (with id and data())
    let data = t;
    if (t && t.data && typeof t.data === 'function') { data = t.data(); currentTicketRef = t.id; }
    else { currentTicketRef = data.id; }

    el('modalSucursal').value = data.sucursalName || data.sucursal || '';
    el('modalTitleInput').value = data.title || data.ticketId || data.ticketId || '';
    el('modalCategory').value = data.category || data.subCategory || '';
    el('modalDescription').value = data.desc || data.description || '';
    el('modalPriority').value = data.priority || 'normal';
    el('modalAssigned').value = data.assigned || (data.reporter?.name) || '';
    el('modalStatus').value = mapStatusToUI(data.status || data.state || 'todo');
  if (el('modalId')) el('modalId').value = data.id || data.ticketId || '';
    // soportar adjuntos subidos a Firestore: 'attachments' (array) o propiedad 'image' (dataURL/local)
    let imageSrc = null;
    if (data.image) imageSrc = data.image;
    else if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      // tomar el primer attachment que tenga url
      const first = data.attachments.find(a => a && (a.url || a.downloadURL || a.path));
      imageSrc = first ? (first.url || first.downloadURL || null) : null;
    }
    if (imageSrc) {
      el('modalImage').src = imageSrc;
      el('modalImage').style.cursor = 'pointer';
      el('modalImage').onclick = () => window.open(imageSrc, '_blank');
      el('modalImageWrapper').style.display = 'block';
    } else {
      el('modalImageWrapper').style.display = 'none';
    }

    renderCommentsArea(data);
    bsModal.show();
  }

  function mapStatusToUI(status){
    if(!status) return 'todo';
    status = String(status).toLowerCase();
    if (['open','todo','pendiente','pending'].includes(status)) return 'todo';
    if (['inprogress','doing','in_progress'].includes(status)) return 'inprogress';
    if (['done','closed','resolved','resuelto'].includes(status)) return 'done';
    return 'todo';
  }

  // Drag & Drop handlers for dropzones
  function wireDropzones(){
    document.querySelectorAll('.dropzone').forEach(zone =>{
      zone.addEventListener('dragover', (e) =>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drop-target'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
      zone.addEventListener('drop', (e) =>{ e.preventDefault(); zone.classList.remove('drop-target'); const id = e.dataTransfer.getData('text/plain'); const status = zone.dataset.status; moveTicketTo(id,status); });
    });
  }

  function moveTicketTo(id,status){ const t = tickets.find(x=>x.id===id); if(!t) return; t.status = status; renderBoard(); }

  // Create new ticket flow
  const createModalEl = el('createModal');
  const bsCreate = createModalEl ? new bootstrap.Modal(createModalEl) : null;
  if (el('btnAdd')) el('btnAdd').addEventListener('click', ()=> bsCreate.show());
  if (el('btnCreate')) el('btnCreate').addEventListener('click', ()=>{
    const title = el('inputTitle').value.trim(); const desc = el('inputDesc').value.trim(); const priority = el('inputPriority').value; const assigned = el('inputAssigned').value.trim(); const file = el('inputImage').files[0];
    if(!title||!desc) return alert('Título y descripción obligatorios');
    const newId = generateId(); const newTicket = { id:newId, title, desc, priority, assigned, created:new Date().toLocaleString(), status:'todo', image:null };
    if(file){ const reader = new FileReader(); reader.onload = (ev)=>{ newTicket.image = ev.target.result; tickets.unshift(newTicket); renderBoard(); bsCreate.hide(); el('createForm').reset(); }; reader.readAsDataURL(file); } else { tickets.unshift(newTicket); renderBoard(); bsCreate.hide(); el('createForm').reset(); }
  });

  // Save changes from modal
  if (el('btnSaveTicket')) {
    el('btnSaveTicket').addEventListener('click', async () => {
      const title = el('modalTitleInput').value.trim();
      const category = el('modalCategory').value.trim();
      const desc = el('modalDescription').value.trim();
      const priority = el('modalPriority').value;
      const assigned = el('modalAssigned').value.trim();
      const status = el('modalStatus').value;

      // find ticket in memory
  const local = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null));

      if (window.db && window.firebase && currentTicketRef) {
        // update Firestore doc
        try {
          await window.db.collection('tickets').doc(currentTicketRef).update({
            title: title || undefined,
            category: category || undefined,
            description: desc || undefined,
            desc: desc || undefined,
            priority: priority || undefined,
            assigned: assigned || undefined,
            status: status || undefined,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) { alert('Error al guardar en Firestore: ' + (e.message || e)); }
      } else if (local) {
        // update local object
        local.title = title; local.category = category; local.desc = desc; local.priority = priority; local.assigned = assigned; local.status = status;
      }

      // reflect locally
      renderBoard();
      bsModal.hide();
    });
  }

  // Add comment
  if (el('btnAddComment')) {
    el('btnAddComment').addEventListener('click', async () => {
      const text = el('newComment').value.trim();
      if (!text) return;
      const commentObj = { text, author: 'admin', createdAt: new Date().toISOString() };

      if (window.db && window.firebase && currentTicketRef) {
        try {
          await window.db.collection('tickets').doc(currentTicketRef).update({
            comments: window.firebase.firestore.FieldValue.arrayUnion({ text, author: 'admin', createdAt: window.firebase.firestore.FieldValue.serverTimestamp() })
          });
        } catch (e) { alert('Error al agregar comentario: ' + (e.message || e)); return; }
      } else {
        // local
          const local = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null));
        if (!local.comments) local.comments = [];
        local.comments.push({ text, author: 'admin', createdAt: new Date().toISOString() });
      }

      // refresh comments
  const ticket = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null)) || {};
      renderCommentsArea(ticket);
      el('newComment').value = '';
      renderBoard();
    });
  }

  // Utils
  function generateId(){ const n = Math.floor(Math.random()*900)+100; return 'TICKET-' + n; }
  function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1): ''; }
  function prettyStatus(s){ if(s==='todo') return 'Pendiente'; if(s==='inprogress') return 'En Progreso'; if(s==='done') return 'Resuelto'; return s; }
  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // Inicialización
  async function loadFromFirestore(){
    try {
      const snap = await window.db.collection('tickets').get();
      tickets.length = 0;
      snap.forEach(doc => {
        const d = doc.data();
        // normalize id
        d.id = doc.id;
        // normalizar status para que coincida con las columnas: 'todo'|'inprogress'|'done'
        d.status = mapStatusToUI(d.status || d.state || 'todo');
        // asegurar un title legible (fallback a area/subCategory o ticketId)
        d.title = d.title || (d.area ? `${d.area} · ${d.subCategory || ''}` : (d.ticketId || d.id));
        // mantener sucursalName si existe
        d.sucursalName = d.sucursalName || d.sucursal || '';
        tickets.push(d);
      });
      renderBoard();
    } catch (e) {
      console.warn('No se pudo cargar tickets desde Firestore:', e.message || e);
    }
  }

  function init(){
    wireDropzones();
    if (window.db) loadFromFirestore();
    renderBoard();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
