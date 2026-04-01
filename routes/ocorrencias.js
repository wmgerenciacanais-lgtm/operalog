const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/ocorrencias
router.get('/', auth, async (req, res) => {
  try {
    const { status, severidade, operacao_id, transportadora_id, limit } = req.query;
    let query = `
      SELECT oc.*,
        o.cliente as operacao_nome,
        o.pais as operacao_pais,
        t.nome as transportadora_nome,
        u.nome as registrado_por_nome
      FROM ocorrencias oc
      LEFT JOIN operacoes o ON oc.operacao_id = o.id
      LEFT JOIN transportadoras t ON oc.transportadora_id = t.id
      LEFT JOIN usuarios u ON oc.registrado_por = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND oc.status = $${params.length + 1}`;
      params.push(status);
    }
    if (severidade) {
      query += ` AND oc.severidade = $${params.length + 1}`;
      params.push(severidade);
    }
    if (operacao_id) {
      query += ` AND oc.operacao_id = $${params.length + 1}`;
      params.push(operacao_id);
    }
    if (transportadora_id) {
      query += ` AND oc.transportadora_id = $${params.length + 1}`;
      params.push(transportadora_id);
    }

    query += ' ORDER BY oc.criado_em DESC';

    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/ocorrencias/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT oc.*, o.cliente as operacao_nome, t.nome as transportadora_nome
       FROM ocorrencias oc
       LEFT JOIN operacoes o ON oc.operacao_id = o.id
       LEFT JOIN transportadoras t ON oc.transportadora_id = t.id
       WHERE oc.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/ocorrencias
router.post('/', auth, async (req, res) => {
  const { titulo, descricao, severidade, status, operacao_id, transportadora_id } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título é obrigatório' });

  try {
    const { rows } = await db.query(
      `INSERT INTO ocorrencias (titulo, descricao, severidade, status, operacao_id, transportadora_id, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descricao || null, severidade || 'informativo', status || 'aberta',
       operacao_id || null, transportadora_id || null, req.usuario.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/ocorrencias/:id
router.put('/:id', auth, async (req, res) => {
  const { titulo, descricao, severidade, status, operacao_id, transportadora_id } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE ocorrencias SET
        titulo = COALESCE($1, titulo),
        descricao = $2,
        severidade = COALESCE($3, severidade),
        status = COALESCE($4, status),
        operacao_id = $5,
        transportadora_id = $6
       WHERE id = $7 RETURNING *`,
      [titulo, descricao, severidade, status, operacao_id, transportadora_id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/ocorrencias/:id/resolver
router.put('/:id/resolver', auth, async (req, res) => {
  const { resolucao } = req.body;
  if (!resolucao) return res.status(400).json({ erro: 'Descrição da resolução é obrigatória' });

  try {
    const { rows } = await db.query(
      `UPDATE ocorrencias SET
        status = 'resolvida',
        resolucao = $1,
        resolvido_por = $2,
        resolvido_em = NOW()
       WHERE id = $3 RETURNING *`,
      [resolucao, req.usuario.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/ocorrencias/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { rows } = await db.query(
      'DELETE FROM ocorrencias WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json({ mensagem: 'Ocorrência excluída com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
