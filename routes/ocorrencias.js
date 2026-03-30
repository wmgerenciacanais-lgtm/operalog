const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/ocorrencias
router.get('/', auth, async (req, res) => {
  const { status, severidade, operacao_id, limit = 50 } = req.query;
  let where = [];
  let params = [];
  let i = 1;

  if (status) { where.push(`o.status = $${i++}`); params.push(status); }
  if (severidade) { where.push(`o.severidade = $${i++}`); params.push(severidade); }
  if (operacao_id) { where.push(`o.operacao_id = $${i++}`); params.push(operacao_id); }
  params.push(parseInt(limit));

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await db.query(`
      SELECT o.*,
        op.cliente as operacao_nome, op.pais as operacao_pais,
        t.nome as transportadora_nome,
        u1.nome as registrado_por_nome,
        u2.nome as resolvido_por_nome
      FROM ocorrencias o
      LEFT JOIN operacoes op ON o.operacao_id = op.id
      LEFT JOIN transportadoras t ON o.transportadora_id = t.id
      LEFT JOIN usuarios u1 ON o.registrado_por = u1.id
      LEFT JOIN usuarios u2 ON o.resolvido_por = u2.id
      ${whereClause}
      ORDER BY o.criado_em DESC
      LIMIT $${i}
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar ocorrências' });
  }
});

// POST /api/ocorrencias
router.post('/', auth, async (req, res) => {
  const { titulo, descricao, severidade, operacao_id, transportadora_id } = req.body;
  if (!titulo || !severidade)
    return res.status(400).json({ erro: 'Título e severidade obrigatórios' });

  try {
    const { rows } = await db.query(`
      INSERT INTO ocorrencias
        (titulo, descricao, severidade, operacao_id, transportadora_id, registrado_por)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [titulo, descricao, severidade, operacao_id || null,
        transportadora_id || null, req.usuario.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar ocorrência' });
  }
});

// PUT /api/ocorrencias/:id/resolver
router.put('/:id/resolver', auth, async (req, res) => {
  const { resolucao } = req.body;
  if (!resolucao)
    return res.status(400).json({ erro: 'Descreva a resolução adotada' });

  try {
    const { rows } = await db.query(`
      UPDATE ocorrencias
      SET status = 'resolvida', resolucao = $1,
          resolvido_por = $2, resolvido_em = NOW()
      WHERE id = $3 RETURNING *
    `, [resolucao, req.usuario.id, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/ocorrencias/:id
router.put('/:id', auth, async (req, res) => {
  const { titulo, descricao, severidade, status } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE ocorrencias
      SET titulo = COALESCE($1, titulo),
          descricao = COALESCE($2, descricao),
          severidade = COALESCE($3, severidade),
          status = COALESCE($4, status)
      WHERE id = $5 RETURNING *
    `, [titulo, descricao, severidade, status, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
