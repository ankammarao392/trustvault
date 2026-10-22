import express from 'express';
import multer from 'multer';
import { db } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireDocumentAccess } from '../middleware/checkPermission.js';
import { validateFileContent, sanitizeFilename } from '../services/validationService.js';
import { saveBlob, getBlobReadStream } from '../services/storageService.js';
import { logAuditEvent, AuditActions, AuditStatus } from '../services/auditService.js';

const router = express.Router();

// Configure memory storage for multer so we can inspect buffer magic bytes directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

// All document routes require authentication
router.use(authenticateToken);

/**
 * GET /api/documents
 * List all documents accessible to the calling user
 */
router.get('/', (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { search, category, owner, dateFrom, dateTo } = req.query;

  let query;
  const params = [];

  // Admins see all documents; Owners & Viewers see only documents they own OR are explicitly granted
  if (userRole === 'admin') {
    query = `
      SELECT d.*, u.full_name as owner_name, u.email as owner_email,
             'admin' as effective_permission
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.is_deleted = 0
    `;
  } else {
    query = `
      SELECT DISTINCT d.*, u.full_name as owner_name, u.email as owner_email,
             CASE
               WHEN d.owner_id = ? THEN 'owner'
               ELSE dp.permission_level
             END as effective_permission
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
      WHERE d.is_deleted = 0
        AND (d.owner_id = ? OR dp.user_id = ?)
    `;
    params.push(userId, userId, userId, userId);
  }

  if (search) {
    query += ' AND (d.title LIKE ? OR d.original_filename LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    query += ' AND d.category = ?';
    params.push(category);
  }

  if (owner) {
    query += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
    params.push(`%${owner}%`, `%${owner}%`);
  }

  if (dateFrom) {
    query += ' AND d.created_at >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND d.created_at <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY d.created_at DESC';

  const documents = db.prepare(query).all(...params);
  res.json({ documents });
});

/**
 * POST /api/documents
 * Securely ingest an uploaded document
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, category = 'General' } = req.body;
    const originalName = req.file.originalname || 'document.bin';

    // 1. Content validation via magic bytes
    const validation = validateFileContent(req.file.buffer, req.file.mimetype, originalName);
    if (!validation.valid) {
      logAuditEvent({
        action: AuditActions.UPLOAD,
        actor: req.user,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        status: AuditStatus.DENIED,
        details: { reason: validation.reason, filename: originalName },
      });
      return res.status(400).json({ error: `File validation failed: ${validation.reason}` });
    }

    // 2. Secure storage persistence
    const { storedFilename, sha256Hash, fileSizeBytes } = await saveBlob(req.file.buffer);
    const sanitizedOriginalName = sanitizeFilename(originalName);

    // 3. Database insert
    const stmt = db.prepare(`
      INSERT INTO documents (
        owner_id,
        title,
        original_filename,
        stored_filename,
        file_size_bytes,
        mime_type,
        sha256_hash,
        category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.user.id,
      title || sanitizedOriginalName,
      sanitizedOriginalName,
      storedFilename,
      fileSizeBytes,
      validation.detectedMime || req.file.mimetype,
      sha256Hash,
      category
    );

    const documentId = result.lastInsertRowid;

    // 4. Immutable audit logging
    logAuditEvent({
      action: AuditActions.UPLOAD,
      actor: req.user,
      documentId,
      documentTitle: title || sanitizedOriginalName,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      status: AuditStatus.SUCCESS,
      details: {
        filename: sanitizedOriginalName,
        sizeBytes: fileSizeBytes,
        sha256: sha256Hash,
        category,
      },
    });

    res.status(201).json({
      message: 'Document uploaded and secured successfully',
      document: {
        id: documentId,
        title: title || sanitizedOriginalName,
        sha256Hash,
        sizeBytes: fileSizeBytes,
      },
    });
  } catch (err) {
    console.error('[Document Upload Error]', err);
    res.status(500).json({ error: 'Failed to process document upload' });
  }
});

/**
 * GET /api/documents/:id
 * Retrieve document metadata (requires read permission)
 */
router.get('/:id', requireDocumentAccess('read'), (req, res) => {
  const doc = req.document;

  // Fetch owner details
  const owner = db.prepare('SELECT id, full_name, email, role FROM users WHERE id = ?').get(doc.owner_id);

  // Fetch permission list if owner or admin
  let permissions = [];
  if (req.user.id === doc.owner_id || req.user.role === 'admin') {
    permissions = db.prepare(`
      SELECT dp.id, dp.user_id, dp.permission_level, dp.granted_at,
             u.full_name, u.email
      FROM document_permissions dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.document_id = ?
    `).all(doc.id);
  }

  // Audit event for metadata view
  logAuditEvent({
    action: AuditActions.READ_METADATA,
    actor: req.user,
    documentId: doc.id,
    documentTitle: doc.title,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    status: AuditStatus.SUCCESS,
  });

  res.json({
    document: {
      ...doc,
      owner,
      permissions,
      effectivePermission: req.effectivePermission,
    },
  });
});

/**
 * GET /api/documents/:id/download
 * Download raw binary securely (requires read permission)
 */
router.get('/:id/download', requireDocumentAccess('read'), (req, res) => {
  const doc = req.document;

  try {
    const stream = getBlobReadStream(doc.stored_filename);

    // Audit event for download
    logAuditEvent({
      action: AuditActions.DOWNLOAD,
      actor: req.user,
      documentId: doc.id,
      documentTitle: doc.title,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      status: AuditStatus.SUCCESS,
      details: {
        sha256: doc.sha256_hash,
        sizeBytes: doc.file_size_bytes,
      },
    });

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    stream.pipe(res);
  } catch (err) {
    console.error('[Download Stream Error]', err);
    res.status(500).json({ error: 'Failed to retrieve document stream' });
  }
});

/**
 * PUT /api/documents/:id
 * Edit document metadata (requires edit permission)
 */
router.put('/:id', requireDocumentAccess('edit'), (req, res) => {
  const doc = req.document;
  const { title, category } = req.body;

  const newTitle = title || doc.title;
  const newCategory = category || doc.category;

  db.prepare(`
    UPDATE documents
    SET title = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newTitle, newCategory, doc.id);

  logAuditEvent({
    action: AuditActions.EDIT_METADATA,
    actor: req.user,
    documentId: doc.id,
    documentTitle: newTitle,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    status: AuditStatus.SUCCESS,
    details: { previousTitle: doc.title, previousCategory: doc.category },
  });

  res.json({ message: 'Document updated successfully', title: newTitle, category: newCategory });
});

/**
 * DELETE /api/documents/:id
 * Soft-delete document (Owner only)
 */
router.delete('/:id', requireDocumentAccess('owner'), (req, res) => {
  const doc = req.document;

  // Soft-delete to preserve audit trail integrity
  db.prepare('UPDATE documents SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(doc.id);

  logAuditEvent({
    action: AuditActions.DELETE,
    actor: req.user,
    documentId: doc.id,
    documentTitle: doc.title,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    status: AuditStatus.SUCCESS,
    details: { reason: 'Soft-deleted by owner' },
  });

  res.json({ message: 'Document deleted successfully and archived in audit trail' });
});

export default router;
