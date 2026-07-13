const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// ─── FÓRMULA DE CÁLCULO DO SCORE PET ──────────────────
// Mesma lógica usada no preview do front-end (transportadoras.html → calcularPreview()).
// Antes isso era feito por um trigger no banco (trg_score_pet), que foi removido por
// conflito. Agora o cálculo mora aqui, no app — mais simples de testar e depurar.
function calcularScorePet({ otd, atraso_medio, ocorrencias_mil, satisfacao }) {
  const sOtd = Math.min(10, (otd / 95) * 10) * 0.4;

  let sAtraso;
  if (atraso_medio <= 2) sAtraso = 10 * 0.3;
  else if (atraso_medio <= 4) sAtraso = (1 - ((atraso_medio - 2) / 8)) * 10 * 0.3;
  else sAtraso = 0;

  const sOc = ocorrencias_mil <= 5
    ? 10 * 0.2
    : Math.max(0, (1 - ((ocorrencias_mil - 5) / 15)) * 10) * 0.2;

  const sSat = (satisfacao / 10) * 10 * 0.1;

  return Math.round((sOtd + sAtraso + sOc + sSat) * 10) / 10;
}

// ─── RECALCULA O SCORE MÉDIO DA TRANSPORTADORA ────────
// Média dos score_calculado dos últimos 90 dias — mesma janela que o trigger antigo usava.
async function recalcularScoreTransportadora(transportadoraId) {
  const { rows } = await db.query(
    `SELECT ROUND(AVG(score_calculado), 1) as media
     FROM pet_registros
     WHERE transportadora_id = $1 AND criado_em >= NOW() - INTERVAL '90 days'`,
    [transportadoraId]
  );
  const novoScore = parseFloat(rows[0].media) || 0;

  await db.query(
    'UPDATE transportadoras SET score = $1 WHERE id = $2',
    [novoScore, transportadoraId]
  );

  return novoScore;
}

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
    const scoreCalculado = calcularScorePet({
      otd: otd || 0,
      atraso_medio: atraso_medio || 0,
      ocorrencias_mil: ocorrencias_mil || 0,
      satisfacao: satisfacao || 0
    });

    const { rows } = await db.query(
      `INSERT INTO pet_registros
        (transportadora_id, periodo_inicio, periodo_fim, otd, atraso_medio, ocorrencias_mil, satisfacao, score_calculado, total_viagens, notas, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.params.id, periodo_inicio, periodo_fim, otd, atraso_medio, ocorrencias_mil, satisfacao,
       scoreCalculado, total_viagens || 0, notas || null, req.usuario.id]
    );

    // Recalcula e grava o score médio da transportadora — antes isso era o trigger,
    // agora é feito aqui, depois do insert, então a média já inclui este novo registro.
    const scoreTransportadora = await recalcularScoreTransportadora(req.params.id);

    res.status(201).json({ ...rows[0], score_transportadora: scoreTransportadora });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
