// ============================================================
// api.js — Conector central con el backend
// ============================================================
const API_URL = 'https://oficiosya-backend.onrender.com/api';

function getSession()     { try { return JSON.parse(localStorage.getItem('oya_session')); } catch { return null; } }
function setSession(data) { localStorage.setItem('oya_session', JSON.stringify(data)); }
function clearSession()   { localStorage.removeItem('oya_session'); }
function getToken()       { const s = getSession(); return s?.token || null; }

function logout() {
  clearSession();
  const base = location.pathname.includes('/pages/') ? '../' : './';
  window.location.href = base + 'index.html';
}

async function apiFetch(endpoint, options = {}) {
  const token   = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res  = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor.');
  return data;
}

// ── Auth ──────────────────────────────────────────────
const Auth = {
  async register(body)              { return apiFetch('/auth/register',            { method: 'POST', body: JSON.stringify(body) }); },
  async login(body)                 { return apiFetch('/auth/login',               { method: 'POST', body: JSON.stringify(body) }); },
  async forgotPassword(email)       { return apiFetch('/auth/forgot-password',     { method: 'POST', body: JSON.stringify({ email }) }); },
  async resetPassword(body)         { return apiFetch('/auth/reset-password',      { method: 'POST', body: JSON.stringify(body) }); },
  async changePassword(body)        { return apiFetch('/auth/change-password',     { method: 'POST', body: JSON.stringify(body) }); },
  async verifyEmail(token, id)      { return apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`); },
  async resendVerification(email)   { return apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); },
  async googleLogin(credential)     { return apiFetch('/auth/google',              { method: 'POST', body: JSON.stringify({ credential }) }); },
};

// ── Perfil ────────────────────────────────────────────
const Perfil = {
  async obtener()                   { return apiFetch('/perfil/me'); },
  async actualizar(body)            { return apiFetch('/perfil/datos',        { method: 'PUT',  body: JSON.stringify(body) }); },
  async subirFoto(formData)         { return apiFetch('/perfil/foto',         { method: 'PUT',  body: formData }); },
  async obtenerProfesional()        { return apiFetch('/perfil/profesional'); },
  async actualizarProfesional(body) { return apiFetch('/perfil/profesional',  { method: 'PUT',  body: JSON.stringify(body) }); },
  async subirVerificacion(formData) { return apiFetch('/perfil/verificacion', { method: 'POST', body: formData }); },
  async misVerificaciones()         { return apiFetch('/perfil/verificaciones'); },
};

// ── Stats ─────────────────────────────────────────────
const Stats = {
  async misStats() { return apiFetch('/stats/me'); },
};

// ── Calificaciones ────────────────────────────────────
const Calificaciones = {
  async crear(body)         { return apiFetch('/calificaciones',       { method: 'POST', body: JSON.stringify(body) }); },
  async misCalificaciones() { return apiFetch('/calificaciones/mias'); },
};

// ── Trabajos ──────────────────────────────────────────
const Trabajos = {
  async misTrabajos()   { return apiFetch('/trabajos/mios'); },
  async subir(formData) { return apiFetch('/trabajos',       { method: 'POST',   body: formData }); },
  async eliminar(id)    { return apiFetch(`/trabajos/${id}`, { method: 'DELETE' }); },
};

// ── Solicitudes ───────────────────────────────────────
const Solicitudes = {
  async listarAbiertas(params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch('/solicitudes/abiertas' + qs);
  },
  async misSolicitudes()        { return apiFetch('/solicitudes/mias/todas'); },
  async detalle(id)             { return apiFetch(`/solicitudes/${id}`); },
  async crear(body)             { return apiFetch('/solicitudes',                         { method: 'POST',   body: JSON.stringify(body) }); },
  async editar(id, body)        { return apiFetch(`/solicitudes/${id}`,                   { method: 'PUT',    body: JSON.stringify(body) }); },
  async eliminar(id)            { return apiFetch(`/solicitudes/${id}`,                   { method: 'DELETE' }); },
  async cancelar(id)            { return apiFetch(`/solicitudes/${id}/cancelar`,          { method: 'PUT' }); },
  async aplicar(id, body)       { return apiFetch(`/solicitudes/${id}/aplicar`,           { method: 'POST',   body: JSON.stringify(body) }); },
  async cancelarPostulacion(id) { return apiFetch(`/solicitudes/${id}/cancelar-post`,     { method: 'PUT' }); },
  async verPostulaciones(id)    { return apiFetch(`/solicitudes/${id}/postulaciones`); },
  async gestionarPostulacion(postulacionId, estado) {
    return apiFetch(`/solicitudes/postulacion/${postulacionId}`, {
      method: 'PUT',
      body: JSON.stringify({ estado })
    });
  },
  async categorias()            { return apiFetch('/solicitudes/categorias'); },
  async estadisticas()          { return apiFetch('/solicitudes/estadisticas'); },
  async iniciarTrabajo(id)      { return apiFetch(`/solicitudes/${id}/iniciar`,           { method: 'PUT' }); },
  async finalizarTrabajo(id)    { return apiFetch(`/solicitudes/${id}/finalizar-trabajo`, { method: 'PUT' }); }, // trabajador
  async finalizarServicio(id)   { return apiFetch(`/solicitudes/${id}/finalizar`,         { method: 'PUT' }); }, // cliente
};

// ── Chat ──────────────────────────────────────────────
const Chat = {
  async enviar(body)              { return apiFetch('/chat/enviar',                    { method: 'POST', body: JSON.stringify(body) }); },
  async conversacion(userId)      { return apiFetch(`/chat/conversacion/${userId}`); },
  async misConversaciones()       { return apiFetch('/chat/conversaciones'); },
  async notificaciones()          { return apiFetch('/chat/notificaciones'); },
  async marcarNotifLeida(id)      { return apiFetch(`/chat/notificaciones/${id}/leer`, { method: 'PUT' }); },
  async marcarTodasLeidas()       { return apiFetch('/chat/notificaciones/leer-todas', { method: 'PUT' }); },
};

// ── UI Helpers ────────────────────────────────────────
function showAlert(msg, type = 'error', containerId = 'alert-box') {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.textContent   = msg;
  box.className     = `alert-box alert-${type}`;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => { box.style.display = 'none'; }, 5000);
}
function hideAlert(id = 'alert-box') { const b = document.getElementById(id); if (b) b.style.display = 'none'; }
function setLoading(loading, btnId='submit-btn', textId='btn-text', spinnerId='btn-spinner') {
  const btn=document.getElementById(btnId), txt=document.getElementById(textId), sp=document.getElementById(spinnerId);
  if (!btn) return;
  btn.disabled=loading;
  if (txt) txt.style.display=loading?'none':'inline';
  if (sp)  sp.style.display =loading?'block':'none';
}
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function togglePassword(inputId, btn) {
  const input=document.getElementById(inputId); if (!input) return;
  const show=input.type==='password'; input.type=show?'text':'password';
  btn.innerHTML=show
    ?`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    :`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function checkPasswordStrength(val) {
  const box=document.getElementById('pass-strength'), lbl=document.getElementById('strength-label');
  if (!box||!val) { if (box) box.style.display='none'; return; }
  box.style.display='flex'; let score=0;
  if (val.length>=8) score++; if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++; if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors=['#EF4444','#F59E0B','#10B981','#059669'];
  const labels=['Muy débil','Débil','Buena','¡Fuerte!'];
  for (let i=1;i<=4;i++) { const b=document.getElementById('bar'+i); if (b) b.style.background=i<=score?colors[score-1]:'#E5E7EB'; }
  if (lbl) { lbl.textContent=labels[score-1]||''; lbl.style.color=colors[score-1]; }
}

// ── Navbar dinámica ───────────────────────────────────
function refreshNavbar() {
  const s=getSession();
  const guestEl=document.getElementById('nav-guest'), authEl=document.getElementById('nav-auth');
  if (!s) {
    if (authEl)  authEl.style.display='none';
    if (guestEl) guestEl.style.display='flex';
    return;
  }
  if (guestEl) guestEl.style.display='none';
  if (authEl)  authEl.style.display='flex';

  const u   = s.usuario || {};
  // BUG FIX: Protegemos si el apellido no existe para no causar error "Uundefined"
  const ini = ((u.nombre||'U')[0] + (u.apellido ? u.apellido[0] : '')).toUpperCase();
  const av  = document.getElementById('nav-avatar');
  const nm  = document.getElementById('nav-username');
  const dn  = document.getElementById('drop-name');
  const de  = document.getElementById('drop-email');

  if (av) {
    if (u.foto_url) {
      av.style.cssText = `background-image:url(${u.foto_url});background-size:cover;background-position:center;`;
      av.textContent = '';
    } else {
      av.style.cssText = '';
      av.textContent = ini;
    }
  }
  if (nm) nm.textContent = u.nombre || 'Usuario';
  if (dn) dn.textContent = `${u.nombre||''} ${u.apellido||''}`.trim();
  if (de) de.textContent = u.email || '';
}

document.addEventListener('DOMContentLoaded', refreshNavbar);

function toggleUserMenu() {
  const dd=document.getElementById('userDropdown');
  if (dd) dd.style.display=dd.style.display==='none'||!dd.style.display?'block':'none';
}
document.addEventListener('click', e => {
  const dd=document.getElementById('userDropdown');
  if (dd&&!e.target.closest('.nav-user-area')) dd.style.display='none';
});

// ── VALIDACIÓN GLOBAL DE CAMPOS NUMÉRICOS Y TELÉFONOS ──
document.addEventListener('DOMContentLoaded', () => {
  // Permitir solo números y punto decimal en inputs type=number
  document.querySelectorAll('input[type=number]').forEach(input => {
    input.addEventListener('keypress', e => {
      // Permitir: números, punto decimal, teclas de control
      const allowed = /[0-9.]/.test(e.key) || 
                      ['Backspace','Tab','Enter','ArrowLeft','ArrowRight','Delete'].includes(e.key);
      if (!allowed) e.preventDefault();
    });
    input.addEventListener('input', () => {
      // Eliminar cualquier carácter no numérico que se pegue
      const val = input.value;
      const clean = val.replace(/[^0-9.]/g, '');
      if (val !== clean) input.value = clean;
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const clean = text.replace(/[^0-9.]/g, '');
      input.value = clean;
    });
  });

  // Campos de teléfono (type=tel) — solo números enteros
  document.querySelectorAll('input[type=tel]').forEach(input => {
    input.addEventListener('keypress', e => {
      if (!/[0-9]/.test(e.key) && !['Backspace','Tab','Enter','ArrowLeft','ArrowRight','Delete'].includes(e.key)) {
        e.preventDefault();
      }
    });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
    });
  });
});