// OperaLog — Shared JS

const token = localStorage.getItem('operalog_token');
const usuario = JSON.parse(localStorage.getItem('operalog_usuario') || '{}');
const idioma = localStorage.getItem('operalog_idioma') || 'pt-BR';

if (!token) window.location.href = '/';

// Inicializar user info
document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('user-name');
  const initEl = document.getElementById('user-initials');
  if (nameEl) nameEl.textContent = usuario.nome || 'Usuário';
  if (initEl) initEl.textContent =
    (usuario.nome || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  document.documentElement.lang = idioma;

  // Relógio
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

// ─── API HELPERS ──────────────────────────────────────
async function api(url) {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
  } catch (err) {
    console.error('API error:', err);
    return null;
  }
}

async function apiPost(url, body, method = 'POST') {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.erro || 'Erro ao processar requisição');
      return null;
    }
    return data;
  } catch (err) {
    console.error('API post error:', err);
    alert('Erro de conexão');
    return null;
  }
}

function logout() {
  localStorage.removeItem('operalog_token');
  localStorage.removeItem('operalog_usuario');
  window.location.href = '/';
}

// ─── TOAST NOTIFICATION ───────────────────────────────
function toast(msg, tipo = 'success') {
  const colors = { success: 'var(--green)', error: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:var(--surface); border:1px solid ${colors[tipo]};
    border-left:4px solid ${colors[tipo]};
    color:var(--text); padding:14px 20px; border-radius:10px;
    font-family:var(--font-body); font-size:14px; font-weight:700;
    box-shadow:0 8px 24px rgba(0,0,0,0.3);
    animation:fadeUp 0.2s ease;
    max-width:320px;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── TEMPO RELATIVO ───────────────────────────────────
function tempoAtras(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min atrás`;
  if (diff < 1440) return `${Math.floor(diff/60)}h atrás`;
  return `${Math.floor(diff/1440)}d atrás`;
}

// ─── FORMATAÇÃO ───────────────────────────────────────
function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(idioma, { day:'2-digit', month:'2-digit', year:'numeric' });
}

function scoreColor(score) {
  if (score >= 8) return 'var(--green)';
  if (score >= 6) return 'var(--amber)';
  return 'var(--red)';
}

function scoreLabel(score) {
  if (score >= 8) return 'Excelente';
  if (score >= 6) return 'Alerta';
  return 'Crítico';
}
