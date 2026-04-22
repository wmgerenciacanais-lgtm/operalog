const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/entregas
router.get('/', auth, async (req, res) => {
  const { status, transportadora_id, data_inicio, data_fim, limit = 50 } = req.query;
  let where = [];
  let params = [];
  let i = 1;

  if (status) { where.push(`e.status = $${i++}`); params.push(status); }
  if (transportadora_id) { where.push(`e.transportadora_id = $${i++}`); params.push(transportadora_id); }
  if (data_inicio) { where.push(`e.data_previsao >= $${i++}`); params.push(data_inicio); }
  if (data_fim) { where.push(`e.data_previsao <= $${i++}`); params.push(data_fim + ' 23:59:59'); }

  params.push(parseInt(limit));
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await db.query(`
      SELECT e.*,
        t.nome as transportadora_nome,
        t.sigla as transportadora_sigla,
        op.cliente as operacao_nome,
        op.pais as operacao_pais,
        u.nome as registrado_por_nome
      FROM entregas e
      LEFT JOIN transportadoras t ON e.transportadora_id = t.id
      LEFT JOIN operacoes op ON e.operacao_id = op.id
      LEFT JOIN usuarios u ON e.registrado_por = u.id
      ${whereClause}
      ORDER BY e.criado_em DESC
      LIMIT $${i}
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar entregas' });
  }
});

// GET /api/entregas/resumo
router.get('/resumo', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vw_entregas_resumo');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar resumo' });
  }
});

// GET /api/entregas/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, t.nome as transportadora_nome, op.cliente as operacao_nome
      FROM entregas e
      LEFT JOIN transportadoras t ON e.transportadora_id = t.id
      LEFT JOIN operacoes op ON e.operacao_id = op.id
      WHERE e.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Entrega não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/entregas
router.post('/', auth, async (req, res) => {
  const {
    codigo, descricao, origem, destino,
    transportadora_id, operacao_id, motorista, veiculo_placa,
    data_previsao, peso_kg, volume_m3, qtd_volumes, notas
  } = req.body;

  if (!destino || !data_previsao)
    return res.status(400).json({ erro: 'Destino e previsão são obrigatórios' });

  try {
    const { rows } = await db.query(`
      INSERT INTO entregas (
        codigo, descricao, origem, destino,
        transportadora_id, operacao_id, motorista, veiculo_placa,
        data_previsao, peso_kg, volume_m3, qtd_volumes, notas,
        registrado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      codigo, descricao, origem, destino,
      transportadora_id || null, operacao_id || null,
      motorista, veiculo_placa,
      data_previsao, peso_kg || null, volume_m3 || null,
      qtd_volumes || 1, notas, req.usuario.id
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar entrega' });
  }
});

// PUT /api/entregas/:id/status — Atualizar status
router.put('/:id/status', auth, async (req, res) => {
  const { status, ocorrencia, data_entrega } = req.body;
  if (!status) return res.status(400).json({ erro: 'Status obrigatório' });

  try {
    // Buscar a entrega para calcular SLA
    const { rows: atual } = await db.query(
      'SELECT * FROM entregas WHERE id = $1', [req.params.id]
    );
    if (!atual.length) return res.status(404).json({ erro: 'Não encontrada' });

    const entrega = atual[0];
    let dentroSla = null;
    let atrasoMinutos = 0;
    let dataEntregaFinal = data_entrega || null;

    if (status === 'entregue') {
      dataEntregaFinal = dataEntregaFinal || new Date().toISOString();
      const previsao = new Date(entrega.data_previsao);
      const entregue = new Date(dataEntregaFinal);
      dentroSla = entregue <= previsao;
      if (!dentroSla) {
        atrasoMinutos = Math.floor((entregue - previsao) / 60000);
      }
    }

    if (status === 'atrasado') {
      const previsao = new Date(entrega.data_previsao);
      const agora = new Date();
      if (agora > previsao) {
        atrasoMinutos = Math.floor((agora - previsao) / 60000);
      }
      dentroSla = false;
    }

    const { rows } = await db.query(`
      UPDATE entregas SET
        status = $1,
        ocorrencia = COALESCE($2, ocorrencia),
        data_entrega = COALESCE($3::timestamp, data_entrega),
        dentro_sla = COALESCE($4, dentro_sla),
        atraso_minutos = $5,
        atualizado_em = NOW()
      WHERE id = $6 RETURNING *
    `, [status, ocorrencia, dataEntregaFinal, dentroSla, atrasoMinutos, req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// PUT /api/entregas/:id/saida — Registrar saída para entrega
router.put('/:id/saida', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE entregas SET
        status = 'em_rota',
        data_saida = NOW(),
        atualizado_em = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/entregas/:id — Editar entrega
router.put('/:id', auth, async (req, res) => {
  const {
    codigo, descricao, origem, destino,
    transportadora_id, operacao_id, motorista,
    veiculo_placa, data_previsao, notas
  } = req.body;

  try {
    const { rows } = await db.query(`
      UPDATE entregas SET
        codigo = COALESCE($1, codigo),
        descricao = COALESCE($2, descricao),
        origem = COALESCE($3, origem),
        destino = COALESCE($4, destino),
        transportadora_id = COALESCE($5, transportadora_id),
        operacao_id = COALESCE($6, operacao_id),
        motorista = COALESCE($7, motorista),
        veiculo_placa = COALESCE($8, veiculo_placa),
        data_previsao = COALESCE($9, data_previsao),
        notas = COALESCE($10, notas),
        atualizado_em = NOW()
      WHERE id = $11 RETURNING *
    `, [codigo, descricao, origem, destino, transportadora_id, operacao_id,
        motorista, veiculo_placa, data_previsao, notas, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/entregas/:id (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin')
    return res.status(403).json({ erro: 'Acesso negado' });
  try {
    await db.query('DELETE FROM entregas WHERE id = $1', [req.params.id]);
    res.json({ mensagem: 'Entrega excluída' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
