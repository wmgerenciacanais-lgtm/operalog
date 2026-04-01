const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

const ETAPAS = ['plan', 'do', 'check', 'act', 'concluido'];

// GET /api/pdca — retorna board com colunas
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*,
        o.cliente as operacao_nome,
        t.nome as transportadora_nome,
        (SELECT json_agg(h ORDER BY h.criado_em DESC) FROM pdca_historico h WHERE h.plano_id = p.id) as historico
      FROM pdca_planos p
      LEFT JOIN operacoes o ON p.operacao_id = o.id
      LEFT JOIN transportadoras t ON p.transportadora_id = t.id
      WHERE p.etapa != 'concluido'
      ORDER BY p.criado_em DESC
    `);

    const board = { plan: [], do: [], check: [], act: [] };
    rows.forEach(p => {
      if (board[p.etapa]) board[p.etapa].push(p);
    });

    res.json({ board });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/pdca/concluidos
router.get('/concluidos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, o.cliente as operacao_nome, t.nome as transportadora_nome
       FROM pdca_planos p
       LEFT JOIN operacoes o ON p.operacao_id = o.id
       LEFT JOIN transportadoras t ON p.transportadora_id = t.id
       WHERE p.etapa = 'concluido'
       ORDER BY p.atualizado_em DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/pdca/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, o.cliente as operacao_nome, t.nome as transportadora_nome,
        (SELECT json_agg(h ORDER BY h.criado_em DESC) FROM pdca_historico h WHERE h.plano_id = p.id) as historico
       FROM pdca_planos p
       LEFT JOIN operacoes o ON p.operacao_id = o.id
       LEFT JOIN transportadoras t ON p.transportadora_id = t.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Plano não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/pdca
router.post('/', auth, async (req, res) => {
  const { titulo, descricao, responsavel, prazo, operacao_id, transportadora_id, meta } = req.body;
  if (!titulo || !responsavel) return res.status(400).json({ erro: 'Título e responsável são obrigatórios' });

  try {
    const { rows } = await db.query(
      `INSERT INTO pdca_planos (titulo, descricao, responsavel, prazo, operacao_id, transportadora_id, meta, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [titulo, descricao || null, responsavel, prazo || null,
       operacao_id || null, transportadora_id || null, meta || null, req.usuario.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/pdca/:id
router.put('/:id', auth, async (req, res) => {
  const { titulo, descricao, responsavel, prazo, operacao_id, transportadora_id, meta, resultado } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE pdca_planos SET
        titulo = COALESCE($1, titulo),
        descricao = $2,
        responsavel = COALESCE($3, responsavel),
        prazo = $4,
        operacao_id = $5,
        transportadora_id = $6,
        meta = $7,
        resultado = $8,
        atualizado_em = NOW()
       WHERE id = $9 RETURNING *`,
      [titulo, descricao, responsavel, prazo, operacao_id, transportadora_id, meta, resultado, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Plano não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/pdca/:id/avancar
router.put('/:id/avancar', auth, async (req, res) => {
  const { comentario } = req.body;
  if (!comentario) return res.status(400).json({ erro: 'Comentário é obrigatório' });

  try {
    const { rows: atual } = await db.query('SELECT etapa FROM pdca_planos WHERE id = $1', [req.params.id]);
    if (!atual.length) return res.status(404).json({ erro: 'Plano não encontrado' });

    const etapaAtual = atual[0].etapa;
    const idx = ETAPAS.indexOf(etapaAtual);
    if (idx === -1 || idx >= ETAPAS.length - 1) return res.status(400).json({ erro: 'Não é possível avançar desta etapa' });

    const etapaNova = ETAPAS[idx + 1];

    await db.query('UPDATE pdca_planos SET etapa = $1, atualizado_em = NOW() WHERE id = $2', [etapaNova, req.params.id]);
    await db.query(
      'INSERT INTO pdca_historico (plano_id, etapa_anterior, etapa_nova, comentario, alterado_por) VALUES ($1, $2, $3, $4, $5)',
      [req.params.id, etapaAtual, etapaNova, comentario, req.usuario.id]
    );

    res.json({ etapa: etapaNova, mensagem: `Plano avançado para ${etapaNova.toUpperCase()}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/pdca/:id/voltar
router.put('/:id/voltar', auth, async (req, res) => {
  const { comentario } = req.body;
  if (!comentario) return res.status(400).json({ erro: 'Comentário é obrigatório' });

  try {
    const { rows: atual } = await db.query('SELECT etapa FROM pdca_planos WHERE id = $1', [req.params.id]);
    if (!atual.length) return res.status(404).json({ erro: 'Plano não encontrado' });

    const etapaAtual = atual[0].etapa;
    const idx = ETAPAS.indexOf(etapaAtual);
    if (idx <= 0) return res.status(400).json({ erro: 'Não é possível retroceder desta etapa' });

    const etapaNova = ETAPAS[idx - 1];

    await db.query('UPDATE pdca_planos SET etapa = $1, atualizado_em = NOW() WHERE id = $2', [etapaNova, req.params.id]);
    await db.query(
      'INSERT INTO pdca_historico (plano_id, etapa_anterior, etapa_nova, comentario, alterado_por) VALUES ($1, $2, $3, $4, $5)',
      [req.params.id, etapaAtual, etapaNova, comentario, req.usuario.id]
    );

    res.json({ etapa: etapaNova, mensagem: `Plano retrocedido para ${etapaNova.toUpperCase()}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/pdca/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { rows } = await db.query('DELETE FROM pdca_planos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Plano não encontrado' });
    res.json({ mensagem: 'Plano excluído com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
