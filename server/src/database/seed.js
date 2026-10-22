import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';
import { logAuditEvent, AuditActions, AuditStatus } from '../services/auditService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.join(__dirname, '..', 'vault_blobs');

export function seedDemoData() {
  initDatabase();

  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
  if (docCount > 0) {
    console.log('[TrustVault Seeder] Database already contains documents. Skipping seed.');
    return;
  }

  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  const owner = db.prepare("SELECT * FROM users WHERE email = 'owner@trustvault.internal'").get();
  const admin = db.prepare("SELECT * FROM users WHERE email = 'admin@trustvault.internal'").get();
  const viewer = db.prepare("SELECT * FROM users WHERE email = 'viewer@trustvault.internal'").get();

  const samples = [
    {
      title: 'Q3 Executive Salary Letters & Compensation',
      filename: 'Q3_Executive_Compensation.pdf',
      category: 'Salaries & Compensation',
      mime: 'application/pdf',
      content: '%PDF-1.4\n%Confidential Executive Salary Statements - CEO: $520,000, VP: $380,000\n%%EOF',
      owner: owner,
      grantToViewer: false, // strictly confidential to owner!
    },
    {
      title: 'Vendor Master Services Agreement - Acme Corp',
      filename: 'MSA_AcmeCorp_2026.pdf',
      category: 'Contracts & Agreements',
      mime: 'application/pdf',
      content: '%PDF-1.4\n%Master Services Agreement between TrustVault and Acme Corp. Fixed Fee: $1,200,000.\n%%EOF',
      owner: owner,
      grantToViewer: true, // Sarah shares this with David!
    },
    {
      title: 'Project Apollo Satellite Engineering Schematics',
      filename: 'Apollo_Schematics_Rev4.png',
      category: 'External Engineering Drawings',
      mime: 'image/png',
      content: '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x00\x00\x00\x01\x00\x08\x06\x00\x00\x00\x5c\x72\xa8\x66',
      owner: owner,
      grantToViewer: false,
    },
    {
      title: 'SOC-2 Type II Annual Regulatory Compliance Report',
      filename: 'SOC2_Type2_Report_2026.pdf',
      category: 'Regulatory Audit Papers',
      mime: 'application/pdf',
      content: '%PDF-1.4\n%Independent Auditor Report on Internal Controls Relevant to Security, Availability, and Confidentiality.\n%%EOF',
      owner: admin,
      grantToViewer: false,
    },
  ];

  const insertDoc = db.prepare(`
    INSERT INTO documents (
      owner_id, title, original_filename, stored_filename, file_size_bytes,
      mime_type, sha256_hash, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of samples) {
    const buffer = Buffer.from(item.content);
    const storedFilename = `${crypto.randomUUID()}.blob`;
    const fullPath = path.join(VAULT_DIR, storedFilename);
    fs.writeFileSync(fullPath, buffer);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const result = insertDoc.run(
      item.owner.id,
      item.title,
      item.filename,
      storedFilename,
      buffer.length,
      item.mime,
      hash,
      item.category
    );

    const docId = result.lastInsertRowid;

    // Log upload
    logAuditEvent({
      action: AuditActions.UPLOAD,
      actor: item.owner,
      documentId: docId,
      documentTitle: item.title,
      status: AuditStatus.SUCCESS,
      details: { sha256: hash, sizeBytes: buffer.length },
    });

    if (item.grantToViewer) {
      db.prepare(`
        INSERT INTO document_permissions (document_id, user_id, permission_level, granted_by)
        VALUES (?, ?, 'read', ?)
      `).run(docId, viewer.id, item.owner.id);

      logAuditEvent({
        action: AuditActions.SHARE_PERMISSION,
        actor: item.owner,
        documentId: docId,
        documentTitle: item.title,
        status: AuditStatus.SUCCESS,
        details: { grantedToEmail: viewer.email, permissionLevel: 'read' },
      });
    }
  }

  console.log('[TrustVault Seeder] Seeded demo confidential documents and audit history.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDemoData();
}
