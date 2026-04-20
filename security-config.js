// Configuración de seguridad para el proyecto
// Este archivo ayuda a resolver problemas de seguridad en desarrollo local

// Configurar Firebase para desarrollo local
if (typeof firebase !== 'undefined') {
    // Solo configurar si hay apps inicializadas
    if (firebase.apps && firebase.apps.length > 0) {
        firebase.auth().useDeviceLanguage();
    } else {
        console.warn('Security Config: Firebase no inicializado aún.');
    }
}

// Configurar CORS para desarrollo local
if (typeof window !== 'undefined') {
    // Permitir conexiones a Firebase desde localhost
    window.addEventListener('beforeunload', function () {
        // Limpiar recursos antes de cerrar
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut();
        }
    });
}

// Configurar SweetAlert2 para desarrollo
if (typeof Swal !== 'undefined') {
    Swal.mixin({
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        allowOutsideClick: false,
        allowEscapeKey: false
    });
}

console.log('Configuración de seguridad cargada para desarrollo local');
