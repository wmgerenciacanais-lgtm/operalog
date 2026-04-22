require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ROTAS DA API ─────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/operacoes',      require('./routes/operacoes'));
app.use('/api/transportadoras',require('./routes/transportadoras'));
app.use('/api/ocorrencias',    require('./routes/ocorrencias'));
app.use('/api/pdca',           require('./routes/pdca'));
app.use('/api/kpi',            require('./routes/kpi'));
app.use('/api/entregas',       require('./routes/entregas'));

// ─── SPA FALLBACK ─────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ─── START ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`OperaLog rodando na porta ${PORT}`);
});
