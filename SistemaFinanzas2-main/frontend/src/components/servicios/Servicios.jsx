// src/components/servicios/Servicios.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import '../sucursales/Sucursales.css';

const getSesion = () => {
  const r = localStorage.getItem('role') || 'viewer';
  const pStr = localStorage.getItem('permisosFinanzas') || '{}';

  let perms = {};
  try {
    perms = JSON.parse(pStr);
  } catch {
    perms = {};
  }

  return {
    loaded: true,
    role: r.toLowerCase() === 'administrador' ? 'admin' : r.toLowerCase(),
    permisos: perms
  };
};

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Perfil del usuario logueado
  const [me, setMe] = useState({
    role: null,
    permisos: {},
    loaded: false
  });

  // Modal + formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [formSucursalId, setFormSucursalId] = useState('');

  // Filtro
  const [filterSucursal, setFilterSucursal] = useState('all');

  const serviciosColRef = collection(db, 'servicios');

  const canManage =
    me.role === 'admin' || me.permisos?.canManageServicios === true;

  /* ======== Cargar sucursales ======== */
  useEffect(() => {
    const loadSucursales = async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map((d) => ({
          id: d.id,
          nombre: d.data().name || d.data().ubicacion || d.data().nombre || d.id
        }));
        setSucursales(list.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error(err);
      }
    };

    loadSucursales();
  }, []);

  /* ======== Cargar sesión desde localStorage ======== */
  useEffect(() => {
    setMe(getSesion());

    const onStorage = (e) => {
      if (['role', 'permisosFinanzas'].includes(e.key)) {
        setMe(getSesion());
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ======== Cargar servicios ======== */
  const cargarServicios = async () => {
    try {
      setLoading(true);
      const data = await getDocs(serviciosColRef);
      const lista = data.docs.map((d) => ({
        ...d.data(),
        id: d.id
      }));
      lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setServicios(lista);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron cargar los servicios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!me.loaded) return;
    cargarServicios();
  }, [me.loaded]);

  const visibleServicios = useMemo(() => {
    if (filterSucursal === 'all') return servicios;
    return servicios.filter((s) => s.sucursalId === filterSucursal);
  }, [servicios, filterSucursal]);

  /* ======== Helper para nombre de sucursal ======== */
  const getSucursalNombre = (id) => {
    const s = sucursales.find((x) => x.id === id);
    return s ? s.nombre : 'Desconocida';
  };

  /* ======== Acciones ======== */
  const openNewModal = () => {
    if (!canManage) {
      return Swal.fire('Sin permisos', 'No puedes crear.', 'info');
    }

    setEditandoId(null);
    setNombre('');
    setCategoria('');
    setNumeroCuenta('');
    setFechaLimite('');
    setFormSucursalId('');
    setModalOpen(true);
  };

  const openEditModal = (s) => {
    if (!canManage) {
      return Swal.fire('Sin permisos', 'No puedes editar.', 'info');
    }

    setEditandoId(s.id);
    setNombre(s.nombre || '');
    setCategoria(s.categoria || '');
    setNumeroCuenta(s.numeroCuenta || '');
    setFechaLimite(s.fechaLimite || '');
    setFormSucursalId(s.sucursalId || '');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const validar = () => {
    if (!nombre.trim() || !categoria.trim() || !formSucursalId) {
      Swal.fire(
        'Campos incompletos',
        'El nombre, la categoría y la sucursal son obligatorios',
        'warning'
      );
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!canManage) {
      return Swal.fire('Sin permisos', 'No puedes guardar cambios.', 'info');
    }

    if (!validar()) return;

    try {
      const payload = {
        nombre: nombre.trim(),
        categoria: categoria.trim(),
        numeroCuenta: numeroCuenta.trim(),
        fechaLimite: fechaLimite.trim(),
        sucursalId: formSucursalId
      };

      if (editandoId) {
        await updateDoc(doc(db, 'servicios', editandoId), payload);
        Swal.fire('Actualizado', 'Servicio modificado', 'success');
      } else {
        await addDoc(serviciosColRef, payload);
        Swal.fire('Agregado', 'Servicio registrado', 'success');
      }

      setModalOpen(false);
      await cargarServicios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo guardar el servicio', 'error');
    }
  };

  const handleEliminar = async (id) => {
    if (!canManage) {
      return Swal.fire('Sin permisos', 'No puedes eliminar.', 'info');
    }

    const confirm = await Swal.fire({
      title: '¿Eliminar?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar'
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'servicios', id));
      await cargarServicios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar', 'error');
    }
  };

  /* ================= Render ================= */
  return (
    <div className="sucursales-shell">
      <header className="sucursales-header">
        <h1>Servicios</h1>
        <div className="sucursales-actions">
          {canManage && (
            <button className="btn btn-primary" onClick={openNewModal}>
              Nuevo servicio
            </button>
          )}
        </div>
      </header>

      {me.loaded && (
        <div
          className="filters-container"
          style={{
            marginBottom: '16px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          <label
            style={{ fontWeight: '500', color: 'var(--text-secondary)' }}
          >
            Filtrar por Sucursal:
          </label>

          <select
            value={filterSucursal}
            onChange={(e) => setFilterSucursal(e.target.value)}
            className="filter-input"
            style={{ minWidth: '200px' }}
          >
            <option value="all">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {!me.loaded ? (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Sucursal</th>
                <th>Categoría</th>
                <th>Número de Cuenta</th>
                <th>Fecha Límite</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={canManage ? 6 : 5} className="empty">
                  Cargando perfil…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tabla-wrap" style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Sucursal</th>
                <th>Categoría</th>
                <th>Número de Cuenta</th>
                <th>Fecha Límite</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : visibleServicios.length ? (
                visibleServicios.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.nombre}</strong>
                    </td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          backgroundColor: '#ebf5ff',
                          color: '#1e3a8a',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {getSucursalNombre(s.sucursalId)}
                      </span>
                    </td>
                    <td>
                      <span className="tag">{s.categoria || '-'}</span>
                    </td>
                    <td>{s.numeroCuenta || '-'}</td>
                    <td>
                      <strong>{s.fechaLimite || '-'}</strong>
                    </td>
                    {canManage && (
                      <td>
                        <div className="acciones">
                          <button
                            className="btn-min"
                            onClick={() => openEditModal(s)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-min danger"
                            onClick={() => handleEliminar(s.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="empty">
                    Sin servicios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && canManage && (
        <div className="modal-mask" onClick={closeModal}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <h3 className="card-title">
              {editandoId ? 'Editar Servicio' : 'Nuevo Servicio'}
            </h3>

            <div className="form-sucursal">
              <div className="form-row">
                <label>Sucursal *</label>
                <select
                  value={formSucursalId}
                  onChange={(e) => setFormSucursalId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                >
                  <option value="" disabled>
                    Selecciona una sucursal...
                  </option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Nombre del Servicio *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Energía Eléctrica (CFE / EEGSA)"
                />
              </div>

              <div className="form-row">
                <label>Categoría *</label>
                <input
                  type="text"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ej. Servicios Públicos"
                />
              </div>

              <div className="form-row">
                <label>Número de Cuenta</label>
                <input
                  type="text"
                  value={numeroCuenta}
                  onChange={(e) => setNumeroCuenta(e.target.value)}
                  placeholder="Ej. 12345678-0"
                />
              </div>

              <div className="form-row">
                <label>Fecha Límite / Vencimiento</label>
                <input
                  type="text"
                  value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)}
                  placeholder="Ej. Día 15 de cada mes / 20/04/2026"
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button className="btn" onClick={closeModal}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleGuardar}>
                {editandoId ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}