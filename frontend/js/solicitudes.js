// ============================================================
// solicitudes.js — Extensión de Solicitudes (sin redeclarar)
// ============================================================

// Asegura que el objeto Solicitudes ya existe (definido en api.js)
if (typeof Solicitudes === 'undefined') {
  console.warn('⚠ api.js no cargó antes que solicitudes.js');
}

// Agrega funciones extra o sobrescribe las existentes
Object.assign(Solicitudes, {
  // Si necesitas funciones adicionales que no estén en api.js, agrégalas aquí.
  // Las funciones listarAbiertas, misSolicitudes, crear, cancelar, categorias
  // ya están definidas en api.js, así que NO las dupliques.
});