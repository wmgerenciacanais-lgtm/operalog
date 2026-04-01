// OperaLog — Shared JS
const token = localStorage.getItem('operalog_token');
const usuario = JSON.parse(localStorage.getItem('operalog_usuario') || '{}');
const idioma = localStorage.getItem('operalog_idioma') || 'pt-BR';
if (!token) window.location.href = '/';

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('user-name');
  const initEl = document.getElementById('user-initials');
  if (nameEl) nameEl.textContent = usuario.nome || 'Usuário';
  if (initEl) initEl.textContent =
    (usuario.nome || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  document.documentElement.lang = idioma;
  function updateClock() {
    const now = new Date();
    const t = document.getElementById('clock-time');
    const d = document.getElementById('clock-date');
    if (t) t.textContent = now.toLocaleTimeString(idioma);
    if (d) d.textContent = now.toLocaleDateString(idioma, { weekday:'short', day:'2-digit', month:'short' });
  }
  updateClock();
  setInterval(updateClock, 1000);
});

// ─── HANDLE 401 ───────────────────────────────────────
function handle401() {
  localStorage.removeItem('operalog_token');
  localStorage.removeItem('operalog_usuario');
  sessionStorage.setItem('operalog_sessao_expirada', '1');
  window.location.href = '/';
}

// ─── ADMIN CHECK ──────────────────────────────────────
function isAdmin() {
  return usuario.perfil === 'admin';
}

// ─── API HELPERS ──────────────────────────────────────
async function api(url) {
  try {
