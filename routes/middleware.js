const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ erro: 'Token não fornecido' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token inválido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token expirado ou inválido' });
  }
};
