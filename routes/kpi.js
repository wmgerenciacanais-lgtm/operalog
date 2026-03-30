const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/kpi/:operacao_id
router.get('/:operacao_id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT k.*, u.nome as registrado_por_nome
      FROM kpi_registros k
      LEFT JOIN usuarios u ON k.registrado_por = u.id
      WHERE k.operacao_id = $1
      ORDER BY k.data_referencia DESC LIMIT 30
    `, [req.params.operacao_id]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar KPIs' });
  }
});

// POST /api/kpi
router.post('/', auth, async (req, res) => {
  const { operacao_id, data_referencia, acuracidade_inventario,
          taxa_erro_picking, produtividade_hora, lead_time_expedicao, notas } = req.body;

  if (!operacao_id || !data_referencia)
    return res.status(400).json({ erro: 'Operação e data obrigatórias' });

  try {
    const { rows } = await db.query(`
      INSERT INTO kpi_registros
        (operacao_id, data_referencia, acuracidade_inventario,
         taxa_erro_picking, produtividade_hora, lead_time_expedicao,
         notas, registrado_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [operacao_id, data_referencia, acuracidade_inventario,
        taxa_erro_picking, produtividade_hora, lead_time_expedicao,
        notas, req.usuario.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar KPI' });
  }
});

module.exports = router;
