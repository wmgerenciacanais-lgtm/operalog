const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('./middleware');

// GET /api/dashboard — KPIs principais
router.get('/', auth, async (req, res) => {
  try {
    const [
      operacoes,
      ocorrencias,
      colaboradores,
      scoreMedia,
      ocorrenciasRecentes,
      operacoesPorPais
    ] = await Promise.all([

      // Total de operações ativas
      db.query(`SELECT COUNT(*) as total FROM operacoes WHERE status != 'encerrado'`),

      // Ocorrências abertas + críticas
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'aberta') as abertas,
          COUNT(*) FILTER (WHERE status = 'aberta' AND severidade = 'critico') as criticas
        FROM ocorrencias
      `),

      // Total colaboradores IN HOUSE
      db.query(`
        SELECT COALESCE(SUM(equipe_qtd), 0) as total
        FROM operacoes WHERE status != 'encerrado'
      `),

      // Score médio transportadoras
      db.query(`
        SELECT ROUND(AVG(score), 1) as media
        FROM transportadoras WHERE ativa = true AND score > 0
      `),

      // Ocorrências recentes (feed)
      db.query(`
        SELECT o.id, o.titulo, o.severidade, o.status, o.criado_em,
               op.cliente as operacao, t.nome as transportadora
        FROM ocorrencias o
        LEFT JOIN operacoes op ON o.operacao_id = op.id
        LEFT JOIN transportadoras t ON o.transportadora_id = t.id
        ORDER BY o.criado_em DESC LIMIT 10
      `),

      // Operações por país
      db.query(`
        SELECT pais, COUNT(*) as total
        FROM operacoes WHERE status != 'encerrado'
        GROUP BY pais ORDER BY pais
      `)
    ]);

    res.json({
      kpis: {
        operacoes_ativas: parseInt(operacoes.rows[0].total),
        ocorrencias_abertas: parseInt(ocorrencias.rows[0].abertas),
        ocorrencias_criticas: parseInt(ocorrencias.rows[0].criticas),
        colaboradores_total: parseInt(colaboradores.rows[0].total),
        score_medio_transportadoras: parseFloat(scoreMedia.rows[0].media) || 0
      },
      ocorrencias_recentes: ocorrenciasRecentes.rows,
      operacoes_por_pais: operacoesPorPais.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar dashboard' });
  }
});

module.exports = router;
