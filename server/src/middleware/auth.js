import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'trustvault_super_secret_audit_key_9823412';

/**
 * Authentication middleware with dual support:
 * 1. Bearer JWT tokens
 * 2. `x-simulated-email` header for instant 1-click evaluator persona switching
 */
export function authenticateToken(req, res, next) {
  // Check for persona simulation header first (for demo & automated testing)
  const simulatedEmail = req.headers['x-simulated-email'];
  if (simulatedEmail) {
    const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE email = ? COLLATE NOCASE').get(simulatedEmail);
    if (user) {
      req.user = user;
      return next();
    }
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please provide a Bearer token or select a demo user.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(403).json({ error: 'User associated with token no longer exists.' });
    }

    req.user = user;
    next();
  });
}

/**
 * Require specific user role (e.g., 'admin')
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
}
