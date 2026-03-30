const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/operacoes
router.get('/', auth, async (req, res) => {
  const { pais, status } = req.query;
  let where = [];
  let params = [];
  let i = 1;

  if (pais) { where.push(`o.pais = $${i++}`); params.push(pais); }
  if (status) { where.push(`o.status = $${i++}`); params.push(status); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await db.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM ocorrencias oc
         WHERE oc.operacao_id = o.id AND oc.status = 'aberta') as ocorrencias_abertas,
        (SELECT json_agg(json_build_object('data', k.data_referencia,
           'acuracidade', k.acuracidade_inventario,
           'picking', k.taxa_erro_picking,
           'produtividade', k.produtividade_hora,
           'lead_time', k.lead_time_expedicao))
         FROM (SELECT * FROM kpi_registros WHERE operacao_id = o.id
               ORDER BY data_referencia DESC LIMIT 6) k) as kpi_historico
      FROM operacoes o ${whereClause}
      ORDER BY o.cliente
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar operações' });
  }
});

// GET /api/operacoes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM operacoes WHERE id = $1', [req.params.id]
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
  if (!cliente || !local || !pais)
    return res.status(400).json({ erro: 'Cliente, local e país obrigatórios' });

  try {
    const { rows } = await db.query(`
      INSERT INTO operacoes (cliente, local, pais, equipe_qtd, servicos, status, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [cliente, local, pais, equipe_qtd || 0, servicos || [], status || 'ativo', notas]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar operação' });
  }
});

// PUT /api/operacoes/:id
router.put('/:id', auth, async (req, res) => {
  const { cliente, local, pais, equipe_qtd, servicos, status, notas } = req.body;

  try {
    const { rows } = await db.query(`
      UPDATE operacoes
      SET cliente = COALESCE($1, cliente),
          local = COALESCE($2, local),
          pais = COALESCE($3, pais),
          equipe_qtd = COALESCE($4, equipe_qtd),
          servicos = COALESCE($5, servicos),
          status = COALESCE($6, status),
          notas = COALESCE($7, notas),
          atualizado_em = NOW()
      WHERE id = $8 RETURNING *
    `, [cliente, local, pais, equipe_qtd, servicos, status, notas, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Operação não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar operação' });
  }
});

// DELETE /api/operacoes/:id (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin')
    return res.status(403).json({ erro: 'Acesso negado' });

  try {
    await db.query(
      "UPDATE operacoes SET status = 'encerrado' WHERE id = $1",
      [req.params.id]
    );
    res.json({ mensagem: 'Operação encerrada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
