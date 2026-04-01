const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/operacoes
router.get('/', auth, async (req, res) => {
  try {
    const { status, pais } = req.query;
    let query = `
      SELECT o.*,
        (SELECT COUNT(*) FROM ocorrencias oc WHERE oc.operacao_id = o.id AND oc.status != 'resolvida') as ocorrencias_abertas,
        (SELECT json_agg(k ORDER BY k.data_referencia DESC) FROM (
          SELECT * FROM kpi_registros WHERE operacao_id = o.id ORDER BY data_referencia DESC LIMIT 5
        ) k) as kpi_historico
      FROM operacoes o
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      const statusList = Array.isArray(status) ? status : [status];
      query += ` AND o.status = ANY($${params.length + 1})`;
      params.push(statusList);
    }

    if (pais) {
      query += ` AND o.pais = $${params.length + 1}`;
      params.push(pais);
    }

    query += ' ORDER BY o.cliente ASC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/operacoes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM ocorrencias oc WHERE oc.operacao_id = o.id AND oc.status != 'resolvida') as ocorrencias_abertas
       FROM operacoes o WHERE o.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Operação não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/operacoes
router.post('/', auth, async (req, res) => {
  const { cliente, local, pais, equipe_qtd, servicos, status, notas } = req.body;
  if (!cliente || !local) return res.status(400).json({ erro: 'Cliente e local são obrigatórios' });

  try {
    const { rows } = await db.query(
      `INSERT INTO operacoes (cliente, local, pais, equipe_qtd, servicos, status, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [cliente, local, pais || 'BR', equipe_qtd || 0, servicos || [], status || 'ativo', notas || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/operacoes/:id
router.put('/:id', auth, async (req, res) => {
  const { cliente, local, pais, equipe_qtd, servicos, status, notas } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE operacoes SET
        cliente = COALESCE($1, cliente),
        local = COALESCE($2, local),
        pais = COALESCE($3, pais),
        equipe_qtd = COALESCE($4, equipe_qtd),
        servicos = COALESCE($5, servicos),
        status = COALESCE($6, status),
        notas = $7,
        atualizado_em = NOW()
       WHERE id = $8 RETURNING *`,
      [cliente, local, pais, equipe_qtd, servicos, status, notas, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Operação não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/operacoes/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { rows } = await db.query(
      'DELETE FROM operacoes WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Operação não encontrada' });
    res.json({ mensagem: 'Operação excluída com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
