import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './../../firebase';

export function useAuthUser() {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // {username,email,role,assignedSucursalId}

  const getSesion = () => {
    const r = localStorage.getItem('role') || 'viewer';
    const email = localStorage.getItem('email') || '';
    const pStr = localStorage.getItem('permisosFinanzas') || '{}';
    let perms = {};
    try { perms = JSON.parse(pStr); } catch {}
    
    return {
      role: (r.toLowerCase() === 'administrador') ? 'admin' : r.toLowerCase(),
      sucursalId: localStorage.getItem('sucursalId') || null,
      email,
      permisos: perms
    };
  };

  useEffect(() => {
    const s = getSesion();
    setProfile({
      role: s.role,
      assignedSucursalId: s.sucursalId,
      email: s.email,
      permisos: s.permisos
    });
    setLoading(false);

    const onStorage = (e) => {
      if (['role', 'sucursalId', 'permisosFinanzas'].includes(e.key)) {
        const up = getSesion();
        setProfile({
          role: up.role,
          assignedSucursalId: up.sucursalId,
          email: up.email,
          permisos: up.permisos
        });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const role = profile?.role || 'viewer';
  const assignedSucursalId = profile?.assignedSucursalId || null;
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';

  return { loading, user: firebaseUser, profile, role, isAdmin, isViewer, assignedSucursalId, permisos: profile?.permisos };
}
