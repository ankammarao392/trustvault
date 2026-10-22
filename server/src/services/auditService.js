import { db } from '../database/db.js';

export const AuditActions = {
  UPLOAD: 'UPLOAD',
  READ_METADATA: 'READ_METADATA',
  DOWNLOAD: 'DOWNLOAD',
  EDIT_METADATA: 'EDIT_METADATA',
  SHARE_PERMISSION: 'SHARE_PERMISSION',
  REVOKE_PERMISSION: 'REVOKE_PERMISSION',
  DELETE: 'DELETE',
};

export const AuditStatus = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
};

/**
 * Append an immutable event to the audit trail
 */
export function logAuditEvent({
  action,
  actor,
  documentId = null,
  documentTitle = null,
  ipAddress = '127.0.0.1',
  userAgent = 'Unknown',
  status = AuditStatus.SUCCESS,
  details = {},
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        action,
        actor_id,
        actor_email,
        actor_role,
        document_id,
        document_title,
        ip_address,
        user_agent,
        status,
        details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      action,
      actor?.id || 0,
      actor?.email || 'anonymous',
      actor?.role || 'unknown',
      documentId,
      documentTitle,
      ipAddress,
      userAgent,
      status,
      JSON.stringify(details)
    );
  } catch (err) {
    console.error('[AuditService Error] Failed to write audit event:', err);
  }
}

/**
 * Query audit events with optional filtering
 */
export function getAuditEvents({
  documentId,
  actorId,
  action,
  status,
  search,
  limit = 200,
  offset = 0,
} = {}) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (documentId) {
    query += ' AND document_id = ?';
    params.push(documentId);
  }

  if (actorId) {
    query += ' AND actor_id = ?';
    params.push(actorId);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (document_title LIKE ? OR actor_email LIKE ? OR action LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}
