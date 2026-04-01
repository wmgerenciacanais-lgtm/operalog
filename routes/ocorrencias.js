<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OperaLog — Ocorrências</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/shared.css">
<style>
  .oc-list { display: flex; flex-direction: column; gap: 10px; }

  .oc-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
    border-left: 4px solid transparent;
    transition: all 0.15s; animation: fadeUp 0.3s ease both;
  }

  .oc-item.critico { border-left-color: var(--red); }
  .oc-item.alerta { border-left-color: var(--amber); }
  .oc-item.positivo { border-left-color: var(--green); }
  .oc-item.informativo { border-left-color: var(--blue); }

  .oc-item:hover { border-color: rgba(255,255,255,0.15); }

  .oc-header {
    padding: 14px 18px 10px;
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12px;
  }

  .oc-titulo {
    font-family: var(--font-display);
    font-size: 15px; font-weight: 800; color: var(--text);
    flex: 1;
  }

  .oc-badges { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  .oc-meta {
    padding: 0 18px 10px;
    display: flex; gap: 16px; flex-wrap: wrap;
    font-size: 12px; font-weight: 600;
    color: var(--text-muted); font-family: var(--font-mono);
  }

  .oc-meta span { display: flex; align-items: center; gap: 4px; }

  .oc-desc {
    padding: 0 18px 10px;
    font-size: 13px; font-weight: 500;
    color: var(--text-muted); line-height: 1.5;
  }

  .oc-actions {
    padding: 10px 18px 14px;
    display: flex; gap: 8px;
    border-top: 1px solid var(--border);
  }

  .btn-sm {
    padding: 7px 16px; border-radius: 6px;
    font-size: 12px; font-weight: 700; cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface2); color: var(--text);
    font-family: var(--font-body); transition: all 0.15s;
  }

  .btn-sm:hover { border-color: var(--green); color: var(--green); }
  .btn-sm.green { background: var(--green); color: #000; border-color: var(--green); }
  .btn-sm.red { background: var(--red-dim); color: var(--red); border-color: rgba(255,77,106,0.3); }

  .filtros { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }

  .filtro-btn {
    padding: 7px 16px; border-radius: 20px;
    font-size: 13px; font-weight: 700;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--surface2); color: var(--text);
    font-family: var(--font-body); transition: all 0.15s;
  }

  .filtro-btn.ativo { background: var(--green-dim); border-color: var(--green); color: var(--green); }
  .filtro-btn:hover { border-color: var(--green); }

  .resolucao-box {
    padding: 12px 18px;
    background: var(--green-dim);
    border-top: 1px solid rgba(0,200,140,0.2);
    font-size: 13px; font-weight: 500; color: var(--text);
  }

  .resolucao-label {
    font-size: 11px; font-weight: 700;
    color: var(--green); font-family: var(--font-mono);
    margin-bottom: 4px;
  }

  .empty-state {
    text-align: center; padding: 60px 20px;
    color: var(--text-muted);
  }

  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 6px; }
</style>
</head>
<body>

<div class="topbar">
  <div class="logo">
    <div class="logo-icon">OL</div>
    <div class="logo-text">Opera<span>Log</span></div>
  </div>
  <div class="topbar-center">
    <div class="pulse"></div>
    <span>PRODUSLOG · FEED DE OCORRÊNCIAS</span>
  </div>
  <div class="topbar-right">
    <div class="clock"><div id="clock-time">--:--:--</div><div class="clock-date" id="clock-date">---</div></div>
    <div class="user-menu" onclick="logout()">
      <div class="user-avatar" id="user-initials">?</div>
      <span class="user-name" id="user-name">Usuário</span>
    </div>
  </div>
</div>

<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-section">PRINCIPAL</div>
    <a href="/dashboard.html" class="nav-item"><span class="nav-icon">◈</span> Visão Geral</a>
    <a href="/operacoes.html" class="nav-item"><span class="nav-icon">⬡</span> Operações IN HOUSE</a>
    <a href="/transportadoras.html" class="nav-item"><span class="nav-icon">◎</span> Transportadoras</a>
    <a href="/pdca.html" class="nav-item"><span class="nav-icon">▦</span> Planos PDCA</a>
    <div class="sidebar-section">GESTÃO</div>
    <a href="/ocorrencias.html" class="nav-item ativo"><span class="nav-icon">⊕</span> Ocorrências</a>
    <a href="/relatorios.html" class="nav-item"><span class="nav-icon">◱</span> Relatórios</a>
  </aside>

  <main class="main">
    <div class="page-header">
      <div>
        <div class="page-title">Ocorrências</div>
        <div class="page-sub">Registro e acompanhamento de eventos operacionais em tempo real</div>
      </div>
      <button class="btn btn-primary" onclick="abrirModal()">+ Nova Ocorrência</button>
    </div>

    <!-- Filtros -->
    <div class="filtros">
      <button class="filtro-btn ativo" onclick="filtrar('todos',this)">Todas</button>
      <button class="filtro-btn" onclick="filtrar('aberta',this)">🔓 Abertas</button>
      <button class="filtro-btn" onclick="filtrar('em_andamento',this)">⚙️ Em andamento</button>
      <button class="filtro-btn" onclick="filtrar('resolvida',this)">✅ Resolvidas</button>
      <button class="filtro-btn" style="border-color:rgba(255,77,106,0.4);color:var(--red)" onclick="filtrar('critico',this)">🔴 Críticas</button>
      <button class="filtro-btn" style="border-color:rgba(245,200,66,0.4);color:var(--amber)" onclick="filtrar('alerta',this)">⚠️ Alerta</button>
    </div>

    <div class="oc-list" id="oc-list">
      <div class="loading">Carregando ocorrências...</div>
    </div>
  </main>
</div>

<!-- Modal Nova Ocorrência -->
<div class="modal-overlay" id="modal-oc">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title" id="modal-titulo">Nova Ocorrência</div>
      <button class="modal-close" onclick="fecharModal()">×</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="oc-id">
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input class="form-input" id="oc-titulo" placeholder="Ex: Atraso JSL — 4h acima do SLA na operação Seara">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Severidade *</label>
          <select class="form-select" id="oc-severidade">
            <option value="critico">🔴 Crítico</option>
            <option value="alerta" selected>⚠️ Alerta</option>
            <option value="informativo">🔵 Informativo</option>
            <option value="positivo">🟢 Positivo</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="oc-status">
            <option value="aberta">🔓 Aberta</option>
            <option value="em_andamento">⚙️ Em andamento</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Operação</label>
          <select class="form-select" id="oc-operacao">
            <option value="">— Selecione —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Transportadora</label>
          <select class="form-select" id="oc-transp">
            <option value="">— Selecione —</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição / Causa raiz</label>
        <textarea class="form-textarea" id="oc-desc" placeholder="Descreva o que aconteceu e qual a causa raiz identificada..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarOc()">Registrar</button>
    </div>
  </div>
</div>

<!-- Modal Resolver -->
<div class="modal-overlay" id="modal-resolver">
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <div class="modal-title">✅ Resolver Ocorrência</div>
      <button class="modal-close" onclick="fecharResolver()">×</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="resolver-id">
      <div class="form-group">
        <label class="form-label">Descreva a resolução adotada *</label>
        <textarea class="form-textarea" id="resolver-texto" style="min-height:120px"
          placeholder="Ex: Reunião realizada com a JSL. Horário de coleta ajustado para 8h. Monitoramento diário por 30 dias."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharResolver()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarResolver()">✅ Confirmar Resolução</button>
    </div>
  </div>
</div>

<script src="/shared.js"></script>
<script>
let todasOcs = [];
let filtroAtual = 'todos';

const ICONS = { critico:'🔴', alerta:'🟡', positivo:'🟢', informativo:'🔵' };
const STATUS_LABEL = { aberta:'Aberta', em_andamento:'Em andamento', resolvida:'Resolvida' };

async function carregarOcs() {
  todasOcs = await api('/api/ocorrencias?limit=100') || [];
  renderOcs();
}

async function carregarSelects() {
  const [ops, ts] = await Promise.all([
    api('/api/operacoes'), api('/api/transportadoras')
  ]);

  const selOp = document.getElementById('oc-operacao');
  const selTs = document.getElementById('oc-transp');

  (ops || []).forEach(o => {
    selOp.innerHTML += `<option value="${o.id}">${o.cliente} — ${o.local}</option>`;
  });

  (ts || []).forEach(t => {
    selTs.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
}

function filtrar(tipo, btn) {
  filtroAtual = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  renderOcs();
}

function renderOcs() {
  let ocs = todasOcs;

  if (filtroAtual === 'aberta') ocs = ocs.filter(o => o.status === 'aberta');
  else if (filtroAtual === 'em_andamento') ocs = ocs.filter(o => o.status === 'em_andamento');
  else if (filtroAtual === 'resolvida') ocs = ocs.filter(o => o.status === 'resolvida');
  else if (filtroAtual === 'critico') ocs = ocs.filter(o => o.severidade === 'critico');
  else if (filtroAtual === 'alerta') ocs = ocs.filter(o => o.severidade === 'alerta');

  const list = document.getElementById('oc-list');

  if (!ocs.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-title">Nenhuma ocorrência encontrada</div>
      <div>Tudo em ordem ou ajuste os filtros acima</div>
    </div>`;
    return;
  }

  list.innerHTML = ocs.map((oc, i) => `
    <div class="oc-item ${oc.severidade}" style="animation-delay:${i*0.04}s">
      <div class="oc-header">
        <div class="oc-titulo">${ICONS[oc.severidade] || '⚪'} ${oc.titulo}</div>
        <div class="oc-badges">
          <span class="sev-badge sev-${oc.severidade}">${oc.severidade.toUpperCase()}</span>
          <span class="status-pill ${oc.status === 'resolvida' ? 'status-resolvida' : oc.status === 'em_andamento' ? 'status-alerta' : 'status-critico'}">
            ${STATUS_LABEL[oc.status] || oc.status}
          </span>
        </div>
      </div>
      <div class="oc-meta">
        <span>🕐 ${tempoAtras(oc.criado_em)}</span>
        ${oc.operacao_nome ? `<span>📦 ${oc.operacao_nome}</span>` : ''}
        ${oc.transportadora_nome ? `<span>🚛 ${oc.transportadora_nome}</span>` : ''}
        ${oc.registrado_por_nome ? `<span>👤 ${oc.registrado_por_nome}</span>` : ''}
        ${oc.operacao_pais ? `<span>${{BR:'🇧🇷',AR:'🇦🇷',PT:'🇵🇹'}[oc.operacao_pais]||''}</span>` : ''}
      </div>
      ${oc.descricao ? `<div class="oc-desc">${oc.descricao}</div>` : ''}
      ${oc.resolucao ? `
        <div class="resolucao-box">
          <div class="resolucao-label">✅ RESOLUÇÃO ADOTADA</div>
          <div>${oc.resolucao}</div>
        </div>` : ''}
      ${oc.status !== 'resolvida' ? `
        <div class="oc-actions">
          <button class="btn-sm green" onclick="abrirResolver('${oc.id}')">✅ Resolver</button>
          <button class="btn-sm" onclick="window.location='/pdca.html?oc=${oc.id}'">📊 Criar Plano PDCA</button>
          <button class="btn-sm" onclick="editarOc(${JSON.stringify(oc).replace(/"/g,'&quot;')})">✏️ Editar</button>
          ${usuario.perfil === 'admin' ? `<button class="btn-sm red" onclick="excluirOc('${oc.id}','${oc.titulo}')">🗑️ Excluir</button>` : ''}
        </div>` : `
        <div class="oc-actions">
          ${usuario.perfil === 'admin' ? `<button class="btn-sm red" onclick="excluirOc('${oc.id}','${oc.titulo}')">🗑️ Excluir registro</button>` : ''}
        </div>`}
    </div>
  `).join('');
}

function abrirModal(oc = null) {
  document.getElementById('oc-id').value = oc?.id || '';
  document.getElementById('oc-titulo').value = oc?.titulo || '';
  document.getElementById('oc-severidade').value = oc?.severidade || 'alerta';
  document.getElementById('oc-status').value = oc?.status || 'aberta';
  document.getElementById('oc-operacao').value = oc?.operacao_id || '';
  document.getElementById('oc-transp').value = oc?.transportadora_id || '';
  document.getElementById('oc-desc').value = oc?.descricao || '';
  document.getElementById('modal-titulo').textContent = oc ? 'Editar Ocorrência' : 'Nova Ocorrência';
  document.getElementById('modal-oc').classList.add('aberto');
}

function editarOc(oc) { abrirModal(oc); }
function fecharModal() { document.getElementById('modal-oc').classList.remove('aberto'); }

async function salvarOc() {
  const id = document.getElementById('oc-id').value;
  const body = {
    titulo: document.getElementById('oc-titulo').value.trim(),
    severidade: document.getElementById('oc-severidade').value,
    status: document.getElementById('oc-status').value,
    operacao_id: document.getElementById('oc-operacao').value || null,
    transportadora_id: document.getElementById('oc-transp').value || null,
    descricao: document.getElementById('oc-desc').value.trim()
  };

  if (!body.titulo) { alert('Título é obrigatório'); return; }

  const url = id ? `/api/ocorrencias/${id}` : '/api/ocorrencias';
  const method = id ? 'PUT' : 'POST';
  const res = await apiPost(url, body, method);

  if (res) {
    fecharModal();
    carregarOcs();
    toast('Ocorrência registrada!', 'success');
  }
}

function abrirResolver(id) {
  document.getElementById('resolver-id').value = id;
  document.getElementById('resolver-texto').value = '';
  document.getElementById('modal-resolver').classList.add('aberto');
}

function fecharResolver() { document.getElementById('modal-resolver').classList.remove('aberto'); }

async function confirmarResolver() {
  const id = document.getElementById('resolver-id').value;
  const resolucao = document.getElementById('resolver-texto').value.trim();
  if (!resolucao) { alert('Descreva a resolução adotada'); return; }

  const res = await apiPost(`/api/ocorrencias/${id}/resolver`, { resolucao }, 'PUT');
  if (res) {
    fecharResolver();
    carregarOcs();
    toast('Ocorrência resolvida! ✅', 'success');
  }
}

// Verificar query param ?nova=1
if (new URLSearchParams(window.location.search).get('nova') === '1') {
  window.addEventListener('load', () => setTimeout(abrirModal, 300));
}

async function excluirOc(id, titulo) {
  if (!confirm(`⚠️ Tem certeza que deseja excluir esta ocorrência?\n\n"${titulo.substring(0,60)}..."\n\nEssa ação é permanente e não pode ser desfeita.`)) return;
  const res = await fetch(`/api/ocorrencias/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (res.ok) {
    toast('Ocorrência excluída com sucesso.', 'success');
    carregarOcs();
  } else {
    toast('Erro ao excluir ocorrência.', 'error');
  }
}

carregarOcs();
carregarSelects();
</script>
</body>
</html>
