const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/transportadoras
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM ocorrencias o WHERE o.transportadora_id = t.id AND o.status != 'resolvida') as ocorrencias_abertas,
        (SELECT json_agg(p ORDER BY p.criado_em DESC) FROM (
          SELECT * FROM pet_registros WHERE transportadora_id = t.id ORDER BY criado_em DESC LIMIT 3
        ) p) as historico_pet
      FROM transportadoras t
      WHERE t.ativa = true
      ORDER BY t.score DESC NULLS LAST, t.nome ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/transportadoras/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM transportadoras WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Transportadora não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/transportadoras
router.post('/', auth, async (req, res) => {
  const { nome, sigla, pais, regiao, contato, email } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

  try {
    const { rows } = await db.query(
      `INSERT INTO transportadoras (nome, sigla, pais, regiao, contato, email)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome, sigla || null, pais || 'BR', regiao || null, contato || null, email || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/transportadoras/:id
router.put('/:id', auth, async (req, res) => {
  const { nome, sigla, pais, regiao, contato, email } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE transportadoras SET
        nome = COALESCE($1, nome),
        sigla = $2,
        pais = COALESCE($3, pais),
        regiao = $4,
        contato = $5,
        email = $6
       WHERE id = $7 RETURNING *`,
      [nome, sigla, pais, regiao, contato, email, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Transportadora não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/transportadoras/:id
router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { rows } = await db.query(
      'UPDATE transportadoras SET ativa = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Transportadora não encontrada' });
    res.json({ mensagem: 'Transportadora removida com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/transportadoras/:id/pet
router.post('/:id/pet', auth, async (req, res) => {
  const { periodo_inicio, periodo_fim, otd, atraso_medio, ocorrencias_mil, satisfacao, total_viagens, notas } = req.body;
  if (!periodo_inicio || !periodo_fim) return res.status(400).json({ erro: 'Período é obrigatório' });

  try {
    const { rows } = await db.query(
      `INSERT INTO pet_registros (transportadora_id, periodo_inicio, periodo_fim, otd, atraso_medio, ocorrencias_mil, satisfacao, total_viagens, notas, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.params.id, periodo_inicio, periodo_fim, otd, atraso_medio, ocorrencias_mil, satisfacao, total_viagens || 0, notas || null, req.usuario.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
