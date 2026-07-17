// script.js
import { db } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, getDocs, writeBatch, query, where, limit
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

const authConfig = {
  apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
  authDomain: "logisticdb-2e63c.firebaseapp.com",
  projectId: "logisticdb-2e63c",
  storageBucket: "logisticdb-2e63c.appspot.com",
  messagingSenderId: "917523682093",
  appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
};
const authApp = initializeApp(authConfig, 'AuthApp');
const authDb = getFirestore(authApp);

document.addEventListener('DOMContentLoaded', () => {
  /* =======================
     TABS (UI)
  ======================= */
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels  = document.querySelectorAll('.tab-content');

  function activateTab(id) {
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    tabPanels.forEach(p => p.classList.toggle('active', p.id === id));
    if (history.pushState) history.replaceState(null, '', '#' + id);
    else location.hash = id;
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const arr = Array.from(tabButtons);
      const idx = arr.indexOf(document.activeElement);
      const next = e.key === 'ArrowRight' ? (idx + 1) % arr.length : (idx - 1 + arr.length) % arr.length;
      arr[next].focus();
    });
  });

  const fromHash = (location.hash || '').replace('#', '');
  const firstId  = tabButtons[0]?.dataset.tab || 'tab-recientes';
  activateTab(document.getElementById(fromHash) ? fromHash : firstId);

  /* =======================
     REFERENCIAS DOM
  ======================= */
  const loginModal   = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeLoginBtn= document.getElementById('closeLoginBtn');
  const loginForm    = document.getElementById('loginForm');
  const usernameSelect = document.getElementById('username');
  const passwordInput  = document.getElementById('password');
  const logoutBtn    = document.getElementById('logoutBtn');

  const taskTableBody    = document.querySelector('#taskTable tbody');
  const historyTableBody = document.querySelector('#historyTable tbody');

  const searchInput   = document.getElementById('searchInput');
  const filterTipo    = document.getElementById('filterTipo');
  const filterResponsable = document.getElementById('filterResponsable');
  const filterFechaDesde  = document.getElementById('filterFechaDesde');
  const filterFechaHasta  = document.getElementById('filterFechaHasta');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const editarBtn     = document.getElementById('editarBtn');
  const eliminarBtn   = document.getElementById('eliminarBtn');
  const taskModal     = document.getElementById('taskModal');
  const taskForm      = document.getElementById('taskForm');
  const tipoSelect    = document.getElementById('tipo');
  const addTipoBtn    = document.getElementById('addTipoBtn');

  // NUEVO: Filtro por Estado con "Todos"
  const estadoDropdownBtn = document.getElementById('estadoDropdownBtn');
  const estadoDropdownContent = document.getElementById('estadoDropdownContent');
  const estadoDropdown = document.getElementById('estadoDropdown');
  const estadoAll       = document.getElementById('estadoAll');
  // Solo estados reales (los que tienen value)
  const estadoCheckboxes = Array.from(document.querySelectorAll('#estadoDropdownContent input[type="checkbox"][value]'));

  const responsableCheckboxesContainer = document.getElementById('responsableCheckboxes');
  const colaboradorCheckboxesContainer = document.getElementById('colaboradorCheckboxes');
  const manageResponsablesBtn = document.getElementById('manageResponsablesBtn');
  const responsablesModal = document.getElementById('responsablesModal');
  const borrarTodoBtn = document.getElementById('borrarTodoBtn');

  const userStatsEls = {
    JOSE:   document.getElementById('pending-JOSE'),
    DIEGO:  document.getElementById('pending-DIEGO'),
    JOSEPH: document.getElementById('pending-JOSEPH'),
    LAURA:  document.getElementById('pending-LAURA'),
    KEVIN:  document.getElementById('pending-KEVIN'),
  };

  /* =======================
     ESTADO
  ======================= */
  const usuarios = [
    { username: 'admin',  password: '123',                 isAdmin: true  },
    { username: 'david',  password: 'tu_contraseña_segura', isAdmin: false }
  ];
  let usuarioActual = JSON.parse(localStorage.getItem('usuarioActual')) || null;
  let tareas = [];
  let tiposTareas = [];
  let selectedTaskId = null;
  let filaSeleccionada = null;

  const prioridadEstado = { "Completado":1, "Revisión":2, "En Progreso":3, "No Iniciado":4 };
  let systemUsers = [];      // Lista de usuarios del sistema (cargada desde Firebase)
  let responsablesList = []; // Lista de responsables activos (cargada desde Firebase)

  /* =======================
     UTILIDADES FECHAS
  ======================= */
  function parseYMD(ymd) {
    if (!ymd) return new Date(0);
    const [y,m,d] = ymd.split('-').map(n => parseInt(n,10));
    return new Date(y, m-1, d);
  }
  function inicioDeHoy() { const dt = new Date(); dt.setHours(0,0,0,0); return dt; }

  /* =======================
     CONTROL ESTADOS (Todos/individuales)
  ======================= */
  function setAllEstados(checked) {
    estadoCheckboxes.forEach(ch => ch.checked = checked);
    if (estadoAll) estadoAll.checked = checked;
    actualizarTabla();
  }
  function syncMasterEstado() {
    const allOn = estadoCheckboxes.every(ch => ch.checked);
    if (estadoAll) estadoAll.checked = allOn;
  }

  /* =======================
     INIT
  ======================= */
  initLogin();
  cargarTipos();
  cargarTareas();
  cargarResponsables(); // Carga responsables en tiempo real desde Firebase
  attachEventListeners();

  /* =======================
     LOGIN
  ======================= */
  async function initLogin() {
    const globalUser = localStorage.getItem('usuarioLogueado');

    // Siempre cargar todos los usuarios del sistema (para los checkboxes y login)
    try {
      const snap = await getDocs(collection(authDb, 'usuarios'));
      systemUsers = snap.docs.map(d => ({ username: d.data().username || '', ...d.data() }));

      if (globalUser) {
        const uDoc = snap.docs.find(d => {
          const dbUser = d.data().username || '';
          return dbUser.toLowerCase() === globalUser.toLowerCase();
        });
        if (uDoc) {
          const u = uDoc.data();
          const isAdmin = (u.rol === 'administrador') || (u.permisos && u.permisos.canAssignTasks === true);
          usuarioActual = { username: u.username, isAdmin: !!isAdmin, permisos: u.permisos || {} };
        }
      }
    } catch(e) {
      console.error('Error cargando usuarios del sistema', e);
    }

    // Cargar responsables activos desde Firebase antes de construir la UI
    try {
      const rSnap = await getDocs(collection(db, 'responsables'));
      responsablesList = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.warn('No se cargaron responsables:', e);
      responsablesList = [];
    }

    buildDynamicUserUI();
    // Marcar todos los estados activos al iniciar
    if (estadoAll) setAllEstados(true);
    toggleLoginUI();
  }

  function buildDynamicUserUI() {
    usernameSelect.length = 1;
    systemUsers.forEach(u => usernameSelect.add(new Option((u.username || '').toUpperCase(), u.username)));

    if (filterResponsable) {
      filterResponsable.innerHTML = '<option value="">Todos</option>';
    }
    const statsList = document.getElementById('statsList');
    if (statsList) statsList.innerHTML = '';
    
    if (responsableCheckboxesContainer) {
      responsableCheckboxesContainer.innerHTML = '';
    }
    if (colaboradorCheckboxesContainer) {
      colaboradorCheckboxesContainer.innerHTML = '';
    }

    const source = responsablesList.length > 0 ? responsablesList : systemUsers.map(u => ({ nombre: (u.username || '').toUpperCase(), usuarioVinculado: (u.username || '').toUpperCase() }));

    source.forEach(r => {
      const uname = (r.nombre || '').toUpperCase();
      
      if (filterResponsable) {
        filterResponsable.add(new Option(uname, uname));
      }
      
      if (responsableCheckboxesContainer) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'responsable';
        cb.value = uname;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + uname));
        responsableCheckboxesContainer.appendChild(label);
      }
      
      if (colaboradorCheckboxesContainer) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'colaborador';
        cb.value = uname;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + uname));
        colaboradorCheckboxesContainer.appendChild(label);
      }
    });
  }

  function toggleLoginUI() {
    const globalUser = localStorage.getItem('usuarioLogueado');
    const userWelcome = document.getElementById('userWelcome');
    
    if (userWelcome) {
        if (usuarioActual) {
            userWelcome.textContent = `Hola, ${usuarioActual.username.toUpperCase()}`;
        } else if (globalUser) {
            userWelcome.textContent = `Hola, ${globalUser.toUpperCase()}`;
        } else {
            userWelcome.textContent = '';
        }
    }

    openLoginBtn.style.display = usuarioActual || globalUser ? 'none' : 'inline-block';
    logoutBtn.style.display    = usuarioActual && !globalUser ? 'inline-block' : 'none';
    if (borrarTodoBtn) borrarTodoBtn.disabled = !usuarioActual?.isAdmin;
    
    const addTaskBtn = document.querySelector('.add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.style.display = (usuarioActual?.isAdmin || usuarioActual?.permisos?.canTaskCreate) ? 'inline-block' : 'none';
    }
    if (manageResponsablesBtn) {
        manageResponsablesBtn.style.display = (usuarioActual?.isAdmin || usuarioActual?.permisos?.canManageResponsables) ? 'inline-block' : 'none';
    }
  }
  loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    const user = usuarios.find(u => u.username === usernameSelect.value && u.password === passwordInput.value.trim());
    if (user) {
      usuarioActual = user;
      localStorage.setItem('usuarioActual', JSON.stringify(user));
      loginModal.style.display = 'none';
      Swal.fire({ icon:'success', title:'Bienvenido', text:user.username.toUpperCase(), timer:1500, showConfirmButton:false });
      toggleLoginUI();
      actualizarTabla();
    } else {
      Swal.fire({ icon:'error', title:'Error', text:'Credenciales incorrectas.' });
    }
  });
  openLoginBtn?.addEventListener('click', () => loginModal.style.display = 'block');
  closeLoginBtn?.addEventListener('click', () => loginModal.style.display = 'none');
  logoutBtn?.addEventListener('click', () => {
    usuarioActual = null;
    localStorage.removeItem('usuarioActual');
    Swal.fire({ icon:'info', title:'Sesión Cerrada', timer:1500, showConfirmButton:false });
    toggleLoginUI();
    actualizarTabla();
  });
  window.addEventListener('click', e => { if (e.target === loginModal) loginModal.style.display = 'none'; });

  /* =======================
     TIPOS
  ======================= */
  async function cargarTipos() {
    try {
      tiposTareas = [];
      tipoSelect.length = 1;
      filterTipo.length = 1;
      const snap = await getDocs(collection(db,'tiposTareas'));
      snap.forEach(d => tiposTareas.push(d.data().nombre));
      tiposTareas.forEach(t => {
        tipoSelect.add(new Option(t, t));
        filterTipo.add(new Option(t, t));
      });
    } catch {
      Swal.fire({ icon:'error', title:'Error', text:'No se cargaron los tipos.' });
    }
  }
  addTipoBtn?.addEventListener('click', () => {
    if (!usuarioActual) return Swal.fire({ icon:'error', title:'Acceso Denegado', text:'Inicia sesión.' });
    Swal.fire({ title:'Nuevo Tipo', input:'text', showCancelButton:true, inputValidator: v => !v && 'Ingresa un tipo' })
      .then(async res => {
        if (res.isConfirmed) {
          const t = res.value.toUpperCase();
          if (tiposTareas.includes(t)) return Swal.fire('Ya existe');
          await addDoc(collection(db,'tiposTareas'), { nombre:t });
          await cargarTipos();
          tipoSelect.value = t;
          Swal.fire({ icon:'success', title:'Tipo agregado', timer:1500, showConfirmButton:false });
        }
      });
  });

  /* =======================
     TAREAS (Tiempo real)
  ======================= */
  function cargarTareas() {
    onSnapshot(collection(db,'tareas'), snap => {
      tareas = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      actualizarTabla();
    });
  }

  /* =======================
     LISTENERS
  ======================= */
  function attachEventListeners() {
    [searchInput, filterTipo, filterResponsable, filterFechaDesde, filterFechaHasta]
      .forEach(el => el?.addEventListener('input', actualizarTabla));

    // Estados Dropdown Toggle
    estadoDropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      estadoDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!estadoDropdown.contains(e.target)) {
        estadoDropdown.classList.remove('active');
      }
    });

    // Estados: master e individuales
    estadoAll?.addEventListener('change', () => setAllEstados(estadoAll.checked));
    estadoCheckboxes.forEach(ch => ch.addEventListener('change', () => {
      syncMasterEstado();
      actualizarTabla();
    }));

    resetFiltersBtn?.addEventListener('click', resetFilters);
    editarBtn?.addEventListener('click', () => abrirModal(selectedTaskId));
    eliminarBtn?.addEventListener('click', eliminarTarea);
    document.querySelector('.add-task-btn')?.addEventListener('click', () => abrirModal());
    taskForm?.addEventListener('submit', submitTarea);
    window.addEventListener('click', e => { if (e.target === taskModal) cerrarModal(); });

    // Borrar todas (si agregas el botón en el HTML con id="borrarTodoBtn")
    borrarTodoBtn?.addEventListener('click', borrarTodasLasTareas);
  }

  /* =======================
     MODAL TAREA
  ======================= */
  window.abrirModal = id => {
    let hasFullEdit = false;

    if (id) {
      hasFullEdit = usuarioActual?.isAdmin || usuarioActual?.permisos?.canTaskEdit;
    } else {
      hasFullEdit = usuarioActual?.isAdmin || usuarioActual?.permisos?.canTaskCreate;
    }

    if (!hasFullEdit && !id) {
      return Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'No tienes permiso para crear tareas.' });
    }

    taskModal.dataset.fullEdit = hasFullEdit;

    tipoSelect.disabled = !hasFullEdit;
    document.getElementById('descripcion').disabled = !hasFullEdit;
    document.getElementById('fechaEstimada').disabled = !hasFullEdit;
    responsableCheckboxesContainer.querySelectorAll('input').forEach(c => c.disabled = !hasFullEdit);
    colaboradorCheckboxesContainer?.querySelectorAll('input').forEach(c => c.disabled = !hasFullEdit);
    document.getElementById('notas').disabled = false;
    selectedTaskId = id || null;
    taskForm.reset();

    responsableCheckboxesContainer.querySelectorAll('.orphaned-responsible').forEach(el => el.remove());
    responsableCheckboxesContainer.querySelectorAll('input').forEach(c => c.checked = false);
    colaboradorCheckboxesContainer?.querySelectorAll('.orphaned-colaborador').forEach(el => el.remove());
    colaboradorCheckboxesContainer?.querySelectorAll('input').forEach(c => c.checked = false);
    
    document.getElementById('modalTitle').textContent = id ? 'Editar Tarea' : 'Agregar Tarea';

    if (id) {
      const t = tareas.find(x => x.id === id);
      if (t) {
        tipoSelect.value = t.tipo;
        document.getElementById('descripcion').value = t.descripcion;
        document.getElementById('fechaEstimada').value = t.fechaEstimada;
        document.getElementById('notas').value = t.notas || '';
        
        t.responsable.forEach(rName => {
          let found = false;
          responsableCheckboxesContainer.querySelectorAll('input').forEach(c => {
            if (c.value === rName) {
              c.checked = true;
              found = true;
            }
          });
          if (!found) {
            const label = document.createElement('label');
            label.className = 'orphaned-responsible';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'responsable';
            cb.value = rName;
            cb.checked = true;
            cb.disabled = !hasFullEdit;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + rName + ' (Eliminado)'));
            label.style.color = '#e74c3c';
            responsableCheckboxesContainer.appendChild(label);
          }
        });

        if (t.colaboradores) {
          t.colaboradores.forEach(cName => {
            let found = false;
            colaboradorCheckboxesContainer?.querySelectorAll('input').forEach(c => {
              if (c.value === cName) {
                c.checked = true;
                found = true;
              }
            });
            if (!found && colaboradorCheckboxesContainer) {
              const label = document.createElement('label');
              label.className = 'orphaned-colaborador';
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.name = 'colaborador';
              cb.value = cName;
              cb.checked = true;
              cb.disabled = !hasFullEdit;
              label.appendChild(cb);
              label.appendChild(document.createTextNode(' ' + cName + ' (Eliminado)'));
              label.style.color = '#e74c3c';
              colaboradorCheckboxesContainer.appendChild(label);
            }
          });
        }
      }
    } else {
      if (!usuarioActual?.isAdmin && !usuarioActual?.permisos?.canAssignTasks) {
          responsableCheckboxesContainer.querySelectorAll('input').forEach(c => {
             if (c.value === usuarioActual.username.toUpperCase()) {
                 c.checked = true;
             }
          });
      }
    }
    taskModal.style.display = 'block';
  };

  window.cerrarModal = () => {
    taskModal.style.display = 'none';
    selectedTaskId = null;
    filaSeleccionada = null;
    editarBtn.disabled = true;
    eliminarBtn.disabled = true;
  };

  /* =======================
     GUARDAR / ACTUALIZAR
  ======================= */
  async function submitTarea(e) {
    e.preventDefault();
    const tipo = tipoSelect.value;
    const descripcion = document.getElementById('descripcion').value.trim();
    const fechaEstimada = document.getElementById('fechaEstimada').value;
    const responsables = Array.from(responsableCheckboxesContainer.querySelectorAll('input:checked')).map(i => i.value);
    const colaboradores = Array.from(colaboradorCheckboxesContainer?.querySelectorAll('input:checked') || []).map(i => i.value);
    const notas = document.getElementById('notas').value.trim();

    const isFullEdit = taskModal.dataset.fullEdit === 'true';

    if (isFullEdit) {
      if (!tipo || !descripcion || !fechaEstimada || !responsables.length) {
        return Swal.fire({ icon:'error', text:'Completa todos los campos (Colaboradores opcional)' });
      }
    }

    const data = { 
      tipo, 
      descripcion, 
      responsable: responsables, 
      colaboradores: colaboradores,
      fechaEstimada, 
      notas, 
      asignadoPor: usuarioActual?.username?.toUpperCase() || 'SISTEMA' 
    };

    try {
      if (selectedTaskId) {
        if (isFullEdit) {
           await updateDoc(doc(db,'tareas',selectedTaskId), data);
        } else {
           await updateDoc(doc(db,'tareas',selectedTaskId), { notas: notas });
        }
      } else {
        await addDoc(collection(db,'tareas'), {
          ...data,
          estado: 'No Iniciado',
          fechaCulminacion: '',
          fechaCreacion: new Date().toISOString()
        });
      }
      cerrarModal();
      Swal.fire({ icon:'success', timer:1500, showConfirmButton:false });
    } catch {
      Swal.fire({ icon:'error', text:'Error al guardar' });
    }
  }

  /* =======================
     FILTROS / RENDER
  ======================= */
  function resetFilters() {
    searchInput.value = '';
    filterTipo.value = '';
    filterResponsable.value = '';
    filterFechaDesde.value = '';
    filterFechaHasta.value = '';
    sortOrder.value = 'estadoOrden';
    // Activa todos los estados
    if (estadoAll) setAllEstados(true);
    actualizarTabla();
    Swal.fire({ icon:'info', timer:1200, showConfirmButton:false });
  }

  function actualizarTabla() {
    if (!taskTableBody || !historyTableBody) return;

    taskTableBody.innerHTML = '';
    historyTableBody.innerHTML = '';

    // Resumen semanal (pendientes dentro de la semana actual)
    const hoy = new Date();
    const dia = hoy.getDay(); // 0 dom, 1 lun ...
    const diffLunes = (dia + 6) % 7;
    const semanaInicio = new Date(hoy); semanaInicio.setDate(hoy.getDate() - diffLunes); semanaInicio.setHours(0,0,0,0);
    const semanaFin = new Date(semanaInicio); semanaFin.setDate(semanaInicio.getDate() + 6); semanaFin.setHours(23,59,59,999);

    const sourceForStats = responsablesList.length > 0 
      ? responsablesList 
      : systemUsers.map(u => ({ nombre: (u.username || '').toUpperCase() }));

    sourceForStats.forEach(r => {
      const uname = (r.nombre || '').toUpperCase();
      const count = tareas.filter(t => {
        const fecha = parseYMD(t.fechaEstimada);
        return t.responsable?.includes(uname)
          && (t.estado === 'No Iniciado' || t.estado === 'En Progreso')
          && fecha >= semanaInicio && fecha <= semanaFin;
      }).length;
      const statEl = document.getElementById(`pending-${uname}`);
      if (statEl) statEl.textContent = count;
    });

    const pasaFiltrosComunes = (t) => {
      if (!usuarioActual?.isAdmin && !usuarioActual?.permisos?.canAssignTasks) {
          const uname = usuarioActual?.username?.toUpperCase();
          const misResponsables = responsablesList
            .filter(r => r.usuarioVinculado?.toUpperCase() === uname)
            .map(r => r.nombre.toUpperCase());
          if (uname) misResponsables.push(uname);
          const tieneTarea = t.responsable?.some(resp => misResponsables.includes(resp.toUpperCase()));
          if (!tieneTarea) return false;
      }
      if (filterTipo.value && t.tipo !== filterTipo.value) return false;
      if (filterResponsable.value && !t.responsable?.includes(filterResponsable.value)) return false;
      if (filterFechaDesde.value && t.fechaEstimada < filterFechaDesde.value) return false;
      if (filterFechaHasta.value && t.fechaEstimada > filterFechaHasta.value) return false;

      // Filtro por estado: usar SOLO los checks con value
      if (estadoCheckboxes.length) {
        const estadosActivos = estadoCheckboxes.filter(c => c.checked).map(c => c.value);
        if (estadosActivos.length && !estadosActivos.includes(t.estado)) return false;
      }

      if (searchInput.value) {
        const term = searchInput.value.toLowerCase();
        const campos = [t.tipo, t.descripcion, (t.responsable||[]).join(', '), t.fechaEstimada, t.estado, t.notas];
        if (!campos.some(v => v?.toLowerCase().includes(term))) return false;
      }
      return true;
    };

    // Mostrar SIEMPRE todas las tareas (según filtros)
    const filtradas = tareas.filter(pasaFiltrosComunes);

    // Tareas activas (no completadas) en la pestaña principal
    let listaActivas = filtradas.filter(t => t.estado !== 'Completado');
    // Historial: sólo completadas
    let listaHistorial = filtradas.filter(t => t.estado === 'Completado');

    // Ordenado para ACTIVAS - Default por prioridad de estado
    listaActivas.sort((a,b) => prioridadEstado[a.estado] - prioridadEstado[b.estado]);

    // Historial: recientes primero por fecha de culminación; si no hay, por fecha estimada
    listaHistorial.sort((a,b) => {
      const fa = a.fechaCulminacion || a.fechaEstimada || '';
      const fb = b.fechaCulminacion || b.fechaEstimada || '';
      return parseYMD(fb) - parseYMD(fa);
    });

    listaActivas.forEach(t => taskTableBody.appendChild(crearFilaTarea(t)));
    listaHistorial.forEach(t => historyTableBody.appendChild(crearFilaTarea(t)));
  }

  /* =======================
     FILAS / ACCIONES
  ======================= */
  function crearFilaTarea(t) {
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    if (filaSeleccionada?.dataset.id === t.id) tr.classList.add('selected');

    let responsableDisplay = (t.responsable || []).join(', ');
    if (t.colaboradores && t.colaboradores.length > 0) {
      responsableDisplay += `<br><small style="color: #64748b;">Colab: ${t.colaboradores.join(', ')}</small>`;
    }

    tr.innerHTML = `
      <td>${t.tipo || ''}</td>
      <td>${t.descripcion || ''}</td>
      <td>${responsableDisplay}</td>
      <td>${t.fechaCreacion?.split('T')[0] || ''}</td>
      <td>${t.fechaEstimada || ''}</td>
      <td>${t.fechaCulminacion || '-'}</td>
      <td>
        <select>
          <option value="No Iniciado"${t.estado==='No Iniciado' ? ' selected' : ''}>No Iniciado</option>
          <option value="En Progreso"${t.estado==='En Progreso' ? ' selected' : ''}>En Progreso</option>
          <option value="Revisión"${t.estado==='Revisión'   ? ' selected' : ''}>Revisión</option>
          <option value="Completado"${t.estado==='Completado'? ' selected' : ''}>Completado</option>
        </select>
      </td>
      <td><small style="color: var(--secondary); font-weight: 600;">${t.asignadoPor || 'N/D'}</small></td>
      <td>${t.notas || ''}</td>
    `


    const claseEstado = {
      "No Iniciado": "estado-no-iniciado",
      "En Progreso": "estado-en-progreso",
      "Revisión": "estado-revision",
      "Completado": "estado-completado"
    }[t.estado] || "";
    const tdEstado = tr.children[6];
    if (claseEstado) tdEstado.classList.add(claseEstado);

    const select = tdEstado.querySelector('select');
    if (!usuarioActual?.isAdmin) {
      select.querySelector('option[value="Completado"]').disabled = true;
      if (t.estado === 'Completado') select.disabled = true;
    }
    select.addEventListener('change', e => cambiarEstado(t.id, e.target.value));

    const notasTd = tr.children[8];
    notasTd.addEventListener('dblclick', () => editarNotas(notasTd, t.id));

    tr.addEventListener('click', () => seleccionarFila(tr, t.id));
    return tr;
  }

  function seleccionarFila(tr, id) {
    filaSeleccionada?.classList.remove('selected');
    tr.classList.add('selected');
    filaSeleccionada = tr;
    selectedTaskId = id;
    // Everyone can edit (at least notes)
    editarBtn.disabled = false;
    // Only those with delete permission can delete
    eliminarBtn.disabled = !(usuarioActual?.isAdmin || usuarioActual?.permisos?.canTaskDelete);
  }

  async function cambiarEstado(id, estado) {
    if (estado === 'Completado' && !usuarioActual?.isAdmin) {
      Swal.fire({ icon:'error', text:'Solo admin.' });
      return actualizarTabla();
    }
    const data = {
      estado,
      fechaCulminacion: estado === 'Completado' ? new Date().toISOString().split('T')[0] : ''
    };
    await updateDoc(doc(db,'tareas',id), data);
    Swal.fire({ icon:'success', timer:1500, showConfirmButton:false });
  }

  function editarNotas(td, id) {
    const old = td.textContent;
    const inp = document.createElement('input');
    inp.value = old;
    td.textContent = '';
    td.append(inp);
    inp.focus();

    const commit = async () => {
      const nuevo = inp.value.trim();
      await updateDoc(doc(db,'tareas',id), { notas: nuevo });
      td.textContent = nuevo;
    };

    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') {
        td.textContent = old;
        inp.removeEventListener('blur', commit);
      }
    });
  }

  async function eliminarTarea() {
    if (!selectedTaskId) return;
    if (!usuarioActual?.isAdmin && !usuarioActual?.permisos?.canTaskDelete) {
       return Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'No tienes permiso para eliminar tareas.' });
    }
    const res = await Swal.fire({ title:'¿Eliminar?', icon:'warning', showCancelButton:true, confirmButtonText:'Sí, eliminar' });
    if (res.isConfirmed) {
      await deleteDoc(doc(db,'tareas',selectedTaskId));
      filaSeleccionada?.classList.remove('selected');
      editarBtn.disabled = true;
      eliminarBtn.disabled = true;
      Swal.fire({ icon:'success', title:'Eliminado', timer:1500, showConfirmButton:false });
    }
  }

  /* =======================
     Borrar TODAS las tareas (opcional)
  ======================= */
  async function borrarTodasLasTareas(){
    if (!usuarioActual?.isAdmin){
      return Swal.fire({ icon:'error', title:'Acceso denegado', text:'Solo ADMIN puede eliminar todo.' });
    }

    const res = await Swal.fire({
      title: 'Eliminar TODAS las tareas',
      html: 'Esto borrará <b>todas</b> las tareas. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar todo',
      cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;

    try{
      const snap = await getDocs(collection(db,'tareas'));
      const docs = snap.docs;

      // Borrado en lotes de 500 (límite Firestore)
      for (let i = 0; i < docs.length; i += 500){
        const batch = writeBatch(db);
        docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Limpieza UI
      selectedTaskId = null;
      filaSeleccionada?.classList.remove('selected');
      editarBtn.disabled = true;
      eliminarBtn.disabled = true;

      Swal.fire({ icon:'success', title:'Tareas eliminadas', timer:1500, showConfirmButton:false });
    }catch(err){
      console.error(err);
      Swal.fire({ icon:'error', title:'Error', text:'No se pudieron eliminar todas las tareas.' });
    }
  }

  /* =======================
     MIGRACION TEMPORAL (MARINA -> KEVIN)
  ======================= */
  async function migrarNombresAntiguos() {
    try {
      const snap = await getDocs(collection(db,'tareas'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(d => {
        const t = d.data();
        if (t.responsable && Array.isArray(t.responsable)) {
          let modificado = false;
          const nuevos = t.responsable.map(r => {
            const up = r.toUpperCase();
            if (up === 'MARINA') { modificado = true; return 'KEVIN'; }
            if (up === 'DAVID') { modificado = true; return 'DIEGO'; } // Por si hay algún David suelto
            return r;
          });
          if (modificado) {
            batch.update(d.ref, { responsable: nuevos });
            count++;
          }
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`Se migraron ${count} tareas antiguas a los nuevos nombres.`);
        actualizarTabla(); // Recarga la tabla con los nuevos nombres
      }
    } catch(e) {
      console.error("Error en migración", e);
    }
  }
  
  // Ejecutamos la migración automáticamente
  migrarNombresAntiguos();

  /* =============================================
     GESTIÓN DE RESPONSABLES
  ============================================= */

  // 1. Carga en tiempo real los responsables desde Firebase (solo los activos)
  function cargarResponsables() {
    onSnapshot(collection(db, 'responsables'), (snap) => {
      responsablesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      buildDynamicUserUI(); // Reconstruir UI con los responsables actualizados
    }, (err) => {
      console.error('Error cargando responsables:', err);
    });
  }

  // 2. Abrir el modal: genera una fila por cada usuario del sistema
  window.abrirModalResponsables = () => {
    if (!usuarioActual?.isAdmin && !usuarioActual?.permisos?.canManageResponsables) {
      return Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'No tienes permiso para gestionar responsables.' });
    }
    const tbody = document.getElementById('responsablesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    systemUsers.forEach(u => {
      const uname = (u.username || '').toUpperCase();
      // Check if this user is already an active responsable
      const existing = responsablesList.find(r => r.usuarioVinculado?.toUpperCase() === uname || r.nombre?.toUpperCase() === uname);
      const isActive = !!existing;
      const sobrenombre = existing?.nombre || '';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e2e8f0';
      tr.innerHTML = `
        <td style="padding:10px 8px; font-weight:600; color:#0f172a;">${uname}</td>
        <td style="padding:10px 8px;">
          <input type="text" data-user="${uname}" class="resp-sobrenombre"
            value="${sobrenombre}"
            placeholder="${uname}"
            style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:5px; font-size:0.88rem;">
        </td>
        <td style="padding:10px 8px; text-align:center;">
          <input type="checkbox" data-user="${uname}" class="resp-activo"
            ${isActive ? 'checked' : ''}
            style="width:18px; height:18px; accent-color: var(--primary); cursor:pointer;">
        </td>`;
      tbody.appendChild(tr);
    });

    if (responsablesModal) responsablesModal.style.display = 'block';
  };

  window.cerrarModalResponsables = () => {
    if (responsablesModal) responsablesModal.style.display = 'none';
  };

  // 3. Guardar los cambios: para cada usuario, si checkbox activo -> upsert en Firebase; si no -> eliminar si existía
  window.guardarResponsables = async () => {
    const filas = document.querySelectorAll('#responsablesTableBody tr');
    try {
      for (const fila of filas) {
        const cb = fila.querySelector('.resp-activo');
        const input = fila.querySelector('.resp-sobrenombre');
        if (!cb || !input) continue;
        const uname = cb.dataset.user;
        const sobrenombre = input.value.trim().toUpperCase() || uname;
        const isActive = cb.checked;

        const existing = responsablesList.find(
          r => r.usuarioVinculado?.toUpperCase() === uname || r.nombre?.toUpperCase() === uname
        );

        if (isActive) {
          if (existing) {
            if (existing.nombre !== sobrenombre) {
              await updateDoc(doc(db, 'responsables', existing.id), { nombre: sobrenombre, usuarioVinculado: uname });
            }
          } else {
            await addDoc(collection(db, 'responsables'), { nombre: sobrenombre, usuarioVinculado: uname });
          }
        } else if (existing) {
          await deleteDoc(doc(db, 'responsables', existing.id));
        }
      }
      cerrarModalResponsables();
      Swal.fire({ icon: 'success', title: 'Responsables guardados', timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error('Error guardando responsables:', err);
      Swal.fire({ icon: 'error', text: 'Error al guardar los cambios.' });
    }
  };

  function initResponsablesForm() {}

});
