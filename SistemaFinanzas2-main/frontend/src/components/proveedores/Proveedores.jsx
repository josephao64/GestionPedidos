// src/components/proveedores/Proveedores.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../services/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Swal from 'sweetalert2';
import '../sucursales/Sucursales.css'; // Reutilizamos CSS de sucursales para ser consistentes

const lower = (v) => (v ?? '').toString().trim().toLowerCase();

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Perfil del usuario logueado
  const [me, setMe] = useState({ role: null, loaded: false });

  // Modal + formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');

  const proveedoresColRef = collection(db, 'proveedores');

  /* ======== Cargar perfil ======== */

  const getSesion = () => {
    const r = localStorage.getItem('role') || 'viewer';
    const pStr = localStorage.getItem('permisosFinanzas') || '{}';
    let perms = {};
    try { perms = JSON.parse(pStr); } catch {}
    
    return {
      loaded: true,
      role: (r.toLowerCase() === 'administrador') ? 'admin' : r.toLowerCase(),
      permisos: perms
    };
  };

  useEffect(() => {
    setMe(getSesion());
    const onStorage = (e) => {
      if (['role', 'permisosFinanzas'].includes(e.key)) setMe(getSesion());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const canManage = me.role === 'admin' || me.permisos?.canManageProveedores === true;

  /* ======== Cargar Proveedores ======== */
  const cargarProveedores = async () => {
    try {
      setLoading(true);
      const data = await getDocs(proveedoresColRef);
      const lista = data.docs.map((d) => ({ ...d.data(), id: d.id }));
      // Ordenar alfabéticamente
      lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
      setProveedores(lista);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron cargar los proveedores', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!me.loaded) return;
    cargarProveedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loaded]);

  const visibleProveedores = useMemo(() => proveedores, [proveedores]);

  /* ======== Acciones ======== */
  const openNewModal = () => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes crear proveedores.', 'info');
    setEditandoId(null);
    setNombre('');
    setContacto('');
    setTelefono('');
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes editar proveedores.', 'info');
    setEditandoId(p.id);
    setNombre(p.nombre || '');
    setContacto(p.contacto || '');
    setTelefono(p.telefono || '');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const validar = () => {
    if (!nombre.trim()) {
      Swal.fire('Campos incompletos', 'El nombre del proveedor es obligatorio', 'warning');
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes guardar cambios.', 'info');
    if (!validar()) return;

    try {
      const payload = {
        nombre: nombre.trim(),
        contacto: contacto.trim(),
        telefono: telefono.trim(),
      };

      if (editandoId) {
        await updateDoc(doc(db, 'proveedores', editandoId), payload);
        Swal.fire('Actualizado', 'Proveedor modificado', 'success');
      } else {
        await addDoc(proveedoresColRef, payload);
        Swal.fire('Agregado', 'Proveedor registrado', 'success');
      }

      setModalOpen(false);
      await cargarProveedores();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo guardar el proveedor', 'error');
    }
  };

  const handleEliminar = async (id) => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes eliminar proveedores.', 'info');
    const confirm = await Swal.fire({
      title: '¿Eliminar?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteDoc(doc(db, 'proveedores', id));
      await cargarProveedores();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar', 'error');
    }
  };

  /* ================= Render ================= */
  return (
    <div className="sucursales-shell">
      <header className="sucursales-header">
        <h1>Proveedores</h1>
        <div className="sucursales-actions">
          {canManage && (
            <button className="btn btn-primary" onClick={openNewModal}>
              Nuevo proveedor
            </button>
          )}
        </div>
      </header>

      {!me.loaded ? (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto (Persona)</th>
                <th>Teléfono</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={canManage ? 4 : 3} className="empty">
                  Cargando perfil…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto (Persona)</th>
                <th>Teléfono</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : visibleProveedores.length ? (
                visibleProveedores.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>{p.contacto || '-'}</td>
                    <td>{p.telefono || '-'}</td>
                    {canManage && (
                      <td>
                        <div className="acciones">
                          <button className="btn-min" onClick={() => openEditModal(p)}>
                            Editar
                          </button>
                          <button className="btn-min danger" onClick={() => handleEliminar(p.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="empty">
                    Sin proveedores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && canManage && (
        <div className="modal-mask" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">
              {editandoId ? 'Editar proveedor' : 'Nuevo proveedor'}
            </h3>

            <div className="form-sucursal">
              <div className="form-row">
                <label>Nombre del Proveedor *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Coca-Cola"
                />
              </div>
              <div className="form-row">
                <label>Contacto (Persona)</label>
                <input
                  type="text"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="form-row">
                <label>Teléfono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej. 1234-5678"
                />
              </div>
            </div>

            <div className="form-actions">
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
