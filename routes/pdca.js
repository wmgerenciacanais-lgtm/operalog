const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

const ETAPAS = ['plan', 'do', 'check', 'act', 'concluido'];

// GET /api/pdca
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*,
        op.cliente as operacao_nome,
        t.nome as transportadora_nome,
        u.nome as criado_por_nome,
        (SELECT json_agg(json_build_object(
           'etapa_anterior', h.etapa_anterior,
           'etapa_nova', h.etapa_nova,
           'comentario', h.comentario,
           'alterado_por', u2.nome,
           'data', h.criado_em
         ) ORDER BY h.criado_em DESC)
         FROM pdca_historico h
         LEFT JOIN usuarios u2 ON h.alterado_por = u2.id
         WHERE h.plano_id = p.id) as historico
      FROM pdca_planos p
      LEFT JOIN operacoes op ON p.operacao_id = op.id
      LEFT JOIN transportadoras t ON p.transportadora_id = t.id
      LEFT JOIN usuarios u ON p.criado_por = u.id
      WHERE p.etapa != 'concluido'
      ORDER BY p.criado_em DESC
    `);

    // Agrupar por etapa para o board
    const board = {
      plan: rows.filter(r => r.etapa === 'plan'),
      do: rows.filter(r => r.etapa === 'do'),
      check: rows.filter(r => r.etapa === 'check'),
      act: rows.filter(r => r.etapa === 'act')
    };

    res.json({ board, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar board PDCA' });
  }
});

// GET /api/pdca/concluidos
router.get('/concluidos', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, u.nome as criado_por_nome
      FROM pdca_planos p
      LEFT JOIN usuarios u ON p.criado_por = u.id
      WHERE p.etapa = 'concluido'
      ORDER BY p.atualizado_em DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/pdca
router.post('/', auth, async (req, res) => {
  const { titulo, descricao, responsavel, prazo, meta,
          operacao_id, transportadora_id } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título obrigatório' });

  try {
    const { rows } = await db.query(`
      INSERT INTO pdca_planos
        (titulo, descricao, responsavel, prazo, meta,
         operacao_id, transportadora_id, criado_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [titulo, descricao, responsavel, prazo || null, meta,
        operacao_id || null, transportadora_id || null, req.usuario.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar plano' });
  }
});

// PUT /api/pdca/:id/avancar — Mover para próxima etapa
router.put('/:id/avancar', auth, async (req, res) => {
  const { comentario } = req.body;

  try {
    const { rows: atual } = await db.query(
      'SELECT etapa FROM pdca_planos WHERE id = $1', [req.params.id]
    );
    if (!atual.length) return res.status(404).json({ erro: 'Plano não encontrado' });

    const etapaAtual = atual[0].etapa;
    const idx = ETAPAS.indexOf(etapaAtual);
    if (idx >= ETAPAS.length - 1)
      return res.status(400).json({ erro: 'Plano já está concluído' });

    const proximaEtapa = ETAPAS[idx + 1];

    await db.query(
      'UPDATE pdca_planos SET etapa = $1, atualizado_em = NOW() WHERE id = $2',
      [proximaEtapa, req.params.id]
    );

    await db.query(`
      INSERT INTO pdca_historico (plano_id, etapa_anterior, etapa_nova, comentario, alterado_por)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.params.id, etapaAtual, proximaEtapa, comentario, req.usuario.id]);

    res.json({ etapa_anterior: etapaAtual, etapa_nova: proximaEtapa });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/pdca/:id/voltar — Retroceder etapa
router.put('/:id/voltar', auth, async (req, res) => {
  const { comentario } = req.body;

  try {
    const { rows: atual } = await db.query(
      'SELECT etapa FROM pdca_planos WHERE id = $1', [req.params.id]
    );
    if (!atual.length) return res.status(404).json({ erro: 'Plano não encontrado' });

    const etapaAtual = atual[0].etapa;
    const idx = ETAPAS.indexOf(etapaAtual);
    if (idx <= 0) return res.status(400).json({ erro: 'Já está na primeira etapa' });

    const etapaAnterior = ETAPAS[idx - 1];

    await db.query(
      'UPDATE pdca_planos SET etapa = $1, atualizado_em = NOW() WHERE id = $2',
      [etapaAnterior, req.params.id]
    );

    await db.query(`
      INSERT INTO pdca_historico (plano_id, etapa_anterior, etapa_nova, comentario, alterado_por)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.params.id, etapaAtual, etapaAnterior, comentario, req.usuario.id]);

    res.json({ etapa_anterior: etapaAtual, etapa_nova: etapaAnterior });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/pdca/:id
router.put('/:id', auth, async (req, res) => {
  const { titulo, descricao, responsavel, prazo, meta, resultado } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE pdca_planos
      SET titulo = COALESCE($1, titulo),
          descricao = COALESCE($2, descricao),
          responsavel = COALESCE($3, responsavel),
          prazo = COALESCE($4, prazo),
          meta = COALESCE($5, meta),
          resultado = COALESCE($6, resultado),
          atualizado_em = NOW()
      WHERE id = $7 RETURNING *
    `, [titulo, descricao, responsavel, prazo, meta, resultado, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
