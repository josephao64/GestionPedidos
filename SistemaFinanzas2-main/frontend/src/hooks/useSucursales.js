import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './../services/firebase';

export function useSucursales() {
  const [sucursales, setSucursales] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => {
          const v = d.data();
          return {
            id: d.id,
            nombre: v.name || v.nombre || v.ubicacion || d.id,
            ubicacion: v.ubicacion || '',
            cajaChica: typeof v.cajaChica === 'number' ? v.cajaChica : parseFloat(v.cajaChica || 0),
            ...v
          };
        });
        // Sort in JS to be safe and consistent
        list.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setSucursales(list);
      } catch (err) {
        console.error("Error in useSucursales:", err);
      }
    })().catch(console.error);
  }, []);
  return sucursales;
}
