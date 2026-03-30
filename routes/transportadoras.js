const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/transportadoras
router.get('/', auth, async (req, res) => {
  const { pais } = req.query;
  const params = pais ? [pais] : [];
  const where = pais ? 'WHERE t.pais = $1 AND t.ativa = true' : 'WHERE t.ativa = true';

  try {
    const { rows } = await db.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM ocorrencias o
         WHERE o.transportadora_id = t.id AND o.status = 'aberta') as ocorrencias_abertas,
        (SELECT json_agg(json_build_object(
           'periodo_inicio', p.periodo_inicio,
           'periodo_fim', p.periodo_fim,
           'otd', p.otd,
           'atraso_medio', p.atraso_medio,
           'ocorrencias_mil', p.ocorrencias_mil,
           'satisfacao', p.satisfacao,
           'score', p.score_calculado,
           'total_viagens', p.total_viagens
         ) ORDER BY p.periodo_inicio DESC)
         FROM (SELECT * FROM pet_registros
               WHERE transportadora_id = t.id
               ORDER BY periodo_inicio DESC LIMIT 6) p
        ) as historico_pet
      FROM transportadoras t ${where}
      ORDER BY t.score DESC, t.nome
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar transportadoras' });
  }
});

// GET /api/transportadoras/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const [transp, pet, ocs] = await Promise.all([
      db.query('SELECT * FROM transportadoras WHERE id = $1', [req.params.id]),
      db.query(`
        SELECT p.*, u.nome as registrado_por_nome
        FROM pet_registros p
        LEFT JOIN usuarios u ON p.registrado_por = u.id
        WHERE p.transportadora_id = $1
        ORDER BY p.periodo_inicio DESC LIMIT 12
      `, [req.params.id]),
      db.query(`
        SELECT o.*, op.cliente as operacao_nome
        FROM ocorrencias o
        LEFT JOIN operacoes op ON o.operacao_id = op.id
        WHERE o.transportadora_id = $1
        ORDER BY o.criado_em DESC LIMIT 10
      `, [req.params.id])
    ]);

    if (!transp.rows.length)
      return res.status(404).json({ erro: 'Transportadora não encontrada' });

    res.json({
      ...transp.rows[0],
      historico_pet: pet.rows,
      ocorrencias: ocs.rows
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/transportadoras
router.post('/', auth, async (req, res) => {
  const { nome, sigla, regiao, pais, contato, email } = req.body;
  if (!nome || !pais)
    return res.status(400).json({ erro: 'Nome e país obrigatórios' });

  try {
    const { rows } = await db.query(`
      INSERT INTO transportadoras (nome, sigla, regiao, pais, contato, email)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [nome, sigla, regiao, pais, contato, email]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar transportadora' });
  }
});

// PUT /api/transportadoras/:id
router.put('/:id', auth, async (req, res) => {
  const { nome, sigla, regiao, pais, contato, email, ativa } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE transportadoras
      SET nome = COALESCE($1, nome),
          sigla = COALESCE($2, sigla),
          regiao = COALESCE($3, regiao),
          pais = COALESCE($4, pais),
          contato = COALESCE($5, contato),
          email = COALESCE($6, email),
          ativa = COALESCE($7, ativa)
      WHERE id = $8 RETURNING *
    `, [nome, sigla, regiao, pais, contato, email, ativa, req.params.id]);

    if (!rows.length) return res.status(404).json({ erro: 'Não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/transportadoras/:id/pet — Registrar KPI do PET
router.post('/:id/pet', auth, async (req, res) => {
  const { periodo_inicio, periodo_fim, otd, atraso_medio,
          ocorrencias_mil, satisfacao, total_viagens, notas } = req.body;

  if (!periodo_inicio || !periodo_fim)
    return res.status(400).json({ erro: 'Período obrigatório' });

  try {
    const { rows } = await db.query(`
      INSERT INTO pet_registros
        (transportadora_id, periodo_inicio, periodo_fim, otd, atraso_medio,
         ocorrencias_mil, satisfacao, total_viagens, notas, registrado_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [req.params.id, periodo_inicio, periodo_fim, otd || 0, atraso_medio || 0,
        ocorrencias_mil || 0, satisfacao || 0, total_viagens || 0,
        notas, req.usuario.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar PET' });
  }
});

module.exports = router;
