import express from 'express';
import { db } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getAuditEvents } from '../services/auditService.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/audit-logs
 * System-wide or owner-scoped audit log stream
 */
router.get('/', (req, res) => {
  const { documentId, actorId, action, status, search, limit, offset } = req.query;

  // Admins see everything. Non-admins can only see audit events for documents they own.
  if (req.user.role !== 'admin') {
    if (!documentId) {
      return res.status(403).json({
        error: 'Forbidden: Only administrators can view the complete system-wide audit trail.',
      });
    }

    const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(documentId);
    if (!doc || doc.owner_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden: You can only inspect audit logs for documents you own.',
      });
    }
  }

  const logs = getAuditEvents({
    documentId: documentId ? parseInt(documentId, 10) : undefined,
    actorId: actorId ? parseInt(actorId, 10) : undefined,
    action,
    status,
    search,
    limit: limit ? parseInt(limit, 10) : 200,
    offset: offset ? parseInt(offset, 10) : 0,
  });

  res.json({ logs });
});

export default router;
