import { db } from '../database/db.js';
import { logAuditEvent, AuditActions, AuditStatus } from '../services/auditService.js';

/**
 * Access control middleware for individual documents.
 * Verifies document-level ACLs before granting access.
 *
 * @param {'read' | 'edit' | 'owner'} requiredPermission
 */
export function requireDocumentAccess(requiredPermission = 'read') {
  return (req, res, next) => {
    const docId = parseInt(req.params.id, 10);
    if (isNaN(docId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND is_deleted = 0').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const userId = req.user.id;
    const isOwner = doc.owner_id === userId;

    // Check explicit permissions
    let hasAccess = false;
    let effectivePermission = null;

    if (isOwner) {
      hasAccess = true;
      effectivePermission = 'owner';
    } else {
      const perm = db.prepare(`
        SELECT permission_level
        FROM document_permissions
        WHERE document_id = ? AND user_id = ?
      `).get(docId, userId);

      if (perm) {
        effectivePermission = perm.permission_level;
        if (requiredPermission === 'read') {
          hasAccess = true; // both 'read' and 'edit' grant read access
        } else if (requiredPermission === 'edit') {
          hasAccess = perm.permission_level === 'edit';
        }
      }
    }

    if (!hasAccess) {
      // Log the unauthorized access attempt for audit forensics
      logAuditEvent({
        action: AuditActions.READ_METADATA,
        actor: req.user,
        documentId: doc.id,
        documentTitle: doc.title,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        status: AuditStatus.DENIED,
        details: {
          attemptedPermission: requiredPermission,
          reason: 'Insufficient document ACL',
        },
      });

      return res.status(403).json({
        error: 'Forbidden: You do not have permissions to access this document.',
      });
    }

    // Attach document and verified permission to request
    req.document = doc;
    req.effectivePermission = effectivePermission;
    next();
  };
}
