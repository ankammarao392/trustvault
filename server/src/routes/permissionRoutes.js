import express from 'express';
import { db } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireDocumentAccess } from '../middleware/checkPermission.js';
import { logAuditEvent, AuditActions, AuditStatus } from '../services/auditService.js';

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

/**
 * GET /api/documents/:id/permissions
 * List all users with granted permissions for this document
 */
router.get('/', requireDocumentAccess('read'), (req, res) => {
  const docId = req.document.id;

  const permissions = db.prepare(`
    SELECT dp.id, dp.user_id, dp.permission_level, dp.granted_at,
           u.full_name, u.email, u.role
    FROM document_permissions dp
    JOIN users u ON dp.user_id = u.id
    WHERE dp.document_id = ?
    ORDER BY dp.granted_at DESC
  `).all(docId);

  res.json({ permissions });
});

/**
 * POST /api/documents/:id/permissions
 * Grant access to a named individual by email (Owner only)
 */
router.post('/', requireDocumentAccess('owner'), (req, res) => {
  const { targetEmail, permissionLevel } = req.body;
  const doc = req.document;

  if (!targetEmail || !permissionLevel) {
    return res.status(400).json({ error: 'targetEmail and permissionLevel are required' });
  }

  if (!['read', 'edit'].includes(permissionLevel)) {
    return res.status(400).json({ error: 'permissionLevel must be either "read" or "edit"' });
  }

  const targetUser = db.prepare('SELECT id, email, full_name FROM users WHERE email = ? COLLATE NOCASE').get(targetEmail);
  if (!targetUser) {
    return res.status(404).json({ error: `User with email ${targetEmail} not found` });
  }

  if (targetUser.id === doc.owner_id) {
    return res.status(400).json({ error: 'Cannot assign permissions to the document owner' });
  }

  // Upsert permission
  db.prepare(`
    INSERT INTO document_permissions (document_id, user_id, permission_level, granted_by, granted_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id, user_id) DO UPDATE SET
      permission_level = excluded.permission_level,
      granted_by = excluded.granted_by,
      granted_at = CURRENT_TIMESTAMP
  `).run(doc.id, targetUser.id, permissionLevel, req.user.id);

  logAuditEvent({
    action: AuditActions.SHARE_PERMISSION,
    actor: req.user,
    documentId: doc.id,
    documentTitle: doc.title,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    status: AuditStatus.SUCCESS,
    details: {
      grantedToUserId: targetUser.id,
      grantedToEmail: targetUser.email,
      permissionLevel,
    },
  });

  res.json({
    message: `Granted ${permissionLevel} access to ${targetUser.email}`,
    targetUser,
    permissionLevel,
  });
});

/**
 * DELETE /api/documents/:id/permissions/:userId
 * Revoke access from a specific user (Owner only)
 */
router.delete('/:userId', requireDocumentAccess('owner'), (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  const doc = req.document;

  const targetUser = db.prepare('SELECT id, email, full_name FROM users WHERE id = ?').get(targetUserId);

  const result = db.prepare(`
    DELETE FROM document_permissions
    WHERE document_id = ? AND user_id = ?
  `).run(doc.id, targetUserId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Permission not found for this user' });
  }

  logAuditEvent({
    action: AuditActions.REVOKE_PERMISSION,
    actor: req.user,
    documentId: doc.id,
    documentTitle: doc.title,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    status: AuditStatus.SUCCESS,
    details: {
      revokedFromUserId: targetUserId,
      revokedFromEmail: targetUser ? targetUser.email : 'Unknown',
    },
  });

  res.json({ message: `Access revoked for user ID ${targetUserId}` });
});

export default router;
