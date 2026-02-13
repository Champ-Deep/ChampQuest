const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'champ-quest-secret-change-in-prod';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireSuperadmin(req, res, next) {
  if (req.user.global_role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      global_role: user.global_role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authMiddleware, requireSuperadmin, asyncHandler, generateToken, JWT_SECRET };