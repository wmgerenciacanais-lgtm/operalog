const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const auth = require('./middleware');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
      [email.toLowerCase()]
    );

    if (!rows.length)
      return res.status(401).json({ erro: 'Credenciais inválidas' });

    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: 'Credenciais inválidas' });

    // Atualiza último acesso
    await db.query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
      [usuario.id]
    );

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email,
        perfil: usuario.perfil, idioma: usuario.idioma },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        idioma: usuario.idioma
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nome, email, perfil, idioma, criado_em, ultimo_acesso FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/auth/usuarios (admin only)
router.post('/usuarios', auth, async (req, res) => {
  if (req.usuario.perfil !== 'admin')
    return res.status(403).json({ erro: 'Acesso negado' });

  const { nome, email, senha, perfil, idioma } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });

  try {
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nome, email, senha, perfil, idioma)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, perfil, idioma`,
      [nome, email.toLowerCase(), hash, perfil || 'analista', idioma || 'pt-BR']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(400).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /api/auth/usuarios (admin/gestor)
router.get('/usuarios', auth, async (req, res) => {
  if (!['admin', 'gestor'].includes(req.usuario.perfil))
    return res.status(403).json({ erro: 'Acesso negado' });

  try {
    const { rows } = await db.query(
      `SELECT id, nome, email, perfil, idioma, ativo, criado_em, ultimo_acesso
       FROM usuarios ORDER BY nome`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/auth/senha
router.put('/senha', auth, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha)
    return res.status(400).json({ erro: 'Senha atual e nova senha obrigatórias' });

  try {
    const { rows } = await db.query(
      'SELECT senha FROM usuarios WHERE id = $1', [req.usuario.id]
    );
    const valida = await bcrypt.compare(senhaAtual, rows[0].senha);
    if (!valida) return res.status(401).json({ erro: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(novaSenha, 10);
    await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.usuario.id]);
    res.json({ mensagem: 'Senha atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
