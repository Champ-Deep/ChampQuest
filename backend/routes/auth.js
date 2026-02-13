const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler, generateToken } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

// POST /api/auth/register - Create account
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and display name required' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, global_role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, email, display_name, global_role, created_at`,
    [email, passwordHash, displayName]
  );

  const user = result.rows[0];
  const token = generateToken(user);

  res.json({
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.global_role },
    token
  });
}));

// POST /api/auth/login - Verify credentials
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      globalRole: user.global_role,
      themePreference: user.theme_preference
    },
    token
  });
}));

// GET /api/auth/me - Get current user profile
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, display_name, global_role, theme_preference, created_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    globalRole: user.global_role,
    themePreference: user.theme_preference,
    createdAt: user.created_at
  });
}));

// PATCH /api/auth/me/theme - Update theme preference
router.patch('/me/theme', authMiddleware, asyncHandler(async (req, res) => {
  const { theme } = req.body;
  await pool.query('UPDATE users SET theme_preference = $1 WHERE id = $2', [theme, req.user.id]);
  res.json({ success: true, theme });
}));

// POST /api/auth/forgot-password - Generate reset token
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return res.json({ message: 'If that email exists, a reset link has been sent' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await pool.query(
    'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
    [resetToken, expires, result.rows[0].id]
  );

  // TODO: Send actual email with reset link
  // For now, log the token for development
  console.log(`[DEV] Password reset for ${email}: http://localhost:3000/reset-password?token=${resetToken}`);

  res.json({ message: 'If that email exists, a reset link has been sent' });
}));

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  const result = await pool.query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
    [passwordHash, result.rows[0].id]
  );

  res.json({ message: 'Password reset successful' });
}));

// POST /api/auth/migrate-existing - Auto-migrate old user (admin/superadmin)
router.post('/migrate-existing', authMiddleware, asyncHandler(async (req, res) => {
  const { email, displayName, tempPassword } = req.body;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(tempPassword || crypto.randomBytes(8).toString('hex'), SALT_ROUNDS);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, global_role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, email, display_name`,
    [email, passwordHash, displayName]
  );

  res.json({
    message: 'User migrated',
    user: result.rows[0],
    note: 'User needs to reset password via forgot password flow'
  });
}));

module.exports = router;