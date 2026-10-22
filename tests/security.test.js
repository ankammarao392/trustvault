import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { app } from '../server/src/server.js';
import { db } from '../server/src/database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.join(__dirname, '..', 'server', 'src', 'vault_blobs');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, headers: response.headers };
}

test('TrustVault Security Test Suite: Complete Isolation & Audit Guarantees', async (t) => {
  let confidentialDocId;
  const mockStoredBlob = `test-blob-${crypto.randomUUID()}.blob`;

  await t.test('1. Owner (Sarah) uploads a confidential document', async () => {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(VAULT_DIR, mockStoredBlob), 'CONFIDENTIAL SALARY DATA: CEO $500k, CTO $450k');

    const stmt = db.prepare(`
      INSERT INTO documents (
        owner_id, title, original_filename, stored_filename, file_size_bytes,
        mime_type, sha256_hash, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const owner = db.prepare("SELECT id FROM users WHERE email = 'owner@trustvault.internal'").get();
    const result = stmt.run(
      owner.id,
      'Confidential Executive Salary Report.pdf',
      'salaries.pdf',
      mockStoredBlob,
      1024,
      'application/pdf',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'Salary & Finance'
    );
    confidentialDocId = result.lastInsertRowid;
    assert.ok(confidentialDocId > 0, 'Document was created');
  });

  await t.test('2. IDOR Prevention: Unauthorized Viewer (David) CANNOT view Sarah document metadata', async () => {
    const res = await request(`/api/documents/${confidentialDocId}`, {
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
    });

    assert.equal(res.status, 403, 'Expected 403 Forbidden for unauthorized viewer');
    assert.match(res.data.error, /do not have permissions/i);

    const deniedLog = db.prepare(`
      SELECT * FROM audit_logs
      WHERE document_id = ? AND actor_email = 'viewer@trustvault.internal' AND status = 'DENIED'
    `).get(confidentialDocId);

    assert.ok(deniedLog, 'Unauthorized attempt must be recorded in audit trail as DENIED');
  });

  await t.test('3. Unauthorized Viewer CANNOT download Sarah confidential document', async () => {
    const res = await request(`/api/documents/${confidentialDocId}/download`, {
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
    });

    assert.equal(res.status, 403, 'Raw binary download must be rejected with 403');
  });

  await t.test('4. Sarah (Owner) grants David "read" permission', async () => {
    const res = await request(`/api/documents/${confidentialDocId}/permissions`, {
      method: 'POST',
      headers: { 'x-simulated-email': 'owner@trustvault.internal' },
      body: {
        targetEmail: 'viewer@trustvault.internal',
        permissionLevel: 'read',
      },
    });

    assert.equal(res.status, 200, 'Owner should successfully grant permission');

    const shareLog = db.prepare(`
      SELECT * FROM audit_logs
      WHERE document_id = ? AND action = 'SHARE_PERMISSION'
    `).get(confidentialDocId);
    assert.ok(shareLog, 'Audit trail must record SHARE_PERMISSION event');
  });

  await t.test('5. David CAN now view document metadata and download after permission granted', async () => {
    const resMeta = await request(`/api/documents/${confidentialDocId}`, {
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
    });
    assert.equal(resMeta.status, 200, 'David must now have read access');
    assert.equal(resMeta.data.document.effectivePermission, 'read');

    const resDownload = await request(`/api/documents/${confidentialDocId}/download`, {
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
    });
    assert.equal(resDownload.status, 200, 'David can download the document');
    assert.match(resDownload.data, /CONFIDENTIAL SALARY DATA/);
  });

  await t.test('6. Read-only viewer CANNOT modify document metadata (Privilege Escalation Prevention)', async () => {
    const res = await request(`/api/documents/${confidentialDocId}`, {
      method: 'PUT',
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
      body: { title: 'Compromised Document Title' },
    });

    assert.equal(res.status, 403, 'Viewer with read-only access cannot edit document metadata');
  });

  await t.test('7. Sarah revokes David access', async () => {
    const viewer = db.prepare("SELECT id FROM users WHERE email = 'viewer@trustvault.internal'").get();
    const res = await request(`/api/documents/${confidentialDocId}/permissions/${viewer.id}`, {
      method: 'DELETE',
      headers: { 'x-simulated-email': 'owner@trustvault.internal' },
    });

    assert.equal(res.status, 200, 'Owner successfully revokes permission');

    const revokeLog = db.prepare(`
      SELECT * FROM audit_logs
      WHERE document_id = ? AND action = 'REVOKE_PERMISSION'
    `).get(confidentialDocId);
    assert.ok(revokeLog, 'Audit trail must record REVOKE_PERMISSION event');
  });

  await t.test('8. Post-revocation: David is IMMEDIATELY blocked from accessing document', async () => {
    const res = await request(`/api/documents/${confidentialDocId}`, {
      headers: { 'x-simulated-email': 'viewer@trustvault.internal' },
    });

    assert.equal(res.status, 403, 'Revocation must take effect immediately with 403 Forbidden');
  });

  await t.test('9. Admin can inspect system-wide audit logs with all events accounted for', async () => {
    const res = await request(`/api/audit-logs`, {
      headers: { 'x-simulated-email': 'admin@trustvault.internal' },
    });

    assert.equal(res.status, 200, 'Admin can view system audit logs');
    assert.ok(res.data.logs.length >= 3, 'Audit logs must contain multiple recorded events');
  });
});
