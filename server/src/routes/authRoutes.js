import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
  });
});

// Register
router.post('/register', (req, res) => {
  const { email, password, fullName, role = 'viewer' } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  if (!['admin', 'owner', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, owner, or viewer' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const result = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (?, ?, ?, ?)
  `).run(email, passwordHash, fullName, role);

  const newUser = { id: result.lastInsertRowid, email, fullName, role };
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ token, user: newUser });
});

// Current user profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// List all users (for sharing picker)
router.get('/users', authenticateToken, (req, res) => {
  const users = db.prepare('SELECT id, email, full_name as fullName, role FROM users ORDER BY full_name ASC').all();
  res.json({ users });
});

export default router;
