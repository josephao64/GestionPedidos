import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function PrivateRoute({
  children,
  requiredRoles,
  requiredPerm,
  redirectIfDenied = '/Finanzas',
  redirectIfUnauthed = '/Finanzas',
}) {
  const location = useLocation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'role') setTick((x) => x + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const rawRole = localStorage.getItem('role') || 'viewer';
  const role = rawRole.toLowerCase();

  // Validación de roles y permisos granulares
  if (requiredRoles || requiredPerm) {
    // Mapeo: el rol del sistema principal es 'administrador' y Finanzas usa 'admin'
    const mappedRole = (role === 'administrador') ? 'admin' : role;
    let hasAccess = false;

    // Si es super-admin, tiene acceso irrestricto
    if (mappedRole === 'admin') {
      hasAccess = true;
    } else if (requiredPerm) {
       // Si no es admin, comprobar si le dieron el permiso de forma manual
       try {
         const rawPerms = localStorage.getItem('permisosFinanzas');
         if (rawPerms) {
           const permisosFinanzas = JSON.parse(rawPerms);
           if (permisosFinanzas[requiredPerm] === true) {
             hasAccess = true;
           }
         }
       } catch (e) {
         console.warn("Fallo al leer permisosFinanzas", e);
       }
    }

    if (!hasAccess) {
      return <Navigate to={redirectIfDenied} state={{ from: location }} replace />;
    }
  }

  return children;
}
