# TrustVault: Quality Assurance & Security Verification Checklist

This document defines the exhaustive security, authorization, and quality assurance verification protocol for **TrustVault**. It serves as the official compliance matrix to ensure the zero-trust architecture holds under both automated inspection and penetration testing.

---

## 1. Role-Based & Access Control List (ACL) Checks (Negative Testing)

### 1.1 IDOR / BOLA Prevention (Insecure Direct Object Reference)
* **Objective**: Ensure that standard users cannot view metadata or read confidential files belonging to other users simply by predicting or enumerating document IDs.
* **Manual Verification Flow**:
  1. Login or switch persona to **Sarah Connor (Document Owner)** (`owner@trustvault.internal`).
  2. Locate an unshared document (e.g., Doc ID `1`: *"Confidential Executive Salary Statements"*).
  3. Switch persona to **David Miller (Viewer)** (`viewer@trustvault.internal`).
  4. Attempt direct API request:
     ```bash
     curl -i -X GET http://localhost:5000/api/documents/1 \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden` with `{ "error": "Forbidden: You do not have permissions to access this document." }`.
* **Forensic Audit Check**: Verify a `DENIED` event was appended to `audit_logs` with `actor_email = "viewer@trustvault.internal"`.

---

### 1.2 Binary Download Guard & Data Leakage Prevention
* **Objective**: Confirm that raw document binaries are never streamed to unauthorized actors.
* **Manual Verification Flow**:
  1. As **David Miller**, send a direct request to the binary download endpoint:
     ```bash
     curl -i -X GET http://localhost:5000/api/documents/1/download \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden`. The server must not send file streams or leak filename/content-type headers.

---

### 1.3 Privilege Escalation Prevention
* **Objective**: Confirm that recipients granted `read` permission cannot elevate privileges, edit document metadata, share with third parties, or delete the document.
* **Manual Verification Flow**:
  1. Grant **David Miller** `read` access to Doc ID `1`.
  2. As **David Miller**, attempt to rename the document:
     ```bash
     curl -i -X PUT http://localhost:5000/api/documents/1 \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: viewer@trustvault.internal" \
       -d '{"title": "Compromised Executive Title"}'
     ```
  3. As **David Miller**, attempt to delete the document:
     ```bash
     curl -i -X DELETE http://localhost:5000/api/documents/1 \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
  4. As **David Miller**, attempt to grant access to another party:
     ```bash
     curl -i -X POST http://localhost:5000/api/documents/1/permissions \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: viewer@trustvault.internal" \
       -d '{"targetEmail": "hacker@external.com", "permissionLevel": "read"}'
     ```
* **Expected Result**: All three requests must return HTTP `403 Forbidden`.

---

### 1.4 Instant Revocation Latency
* **Objective**: Confirm that once an owner revokes access, all subsequent read and download requests fail immediately with zero token/cache delay.
* **Manual Verification Flow**:
  1. Verify **David Miller** can download Doc ID `1` (`200 OK`).
  2. As **Sarah Connor**, revoke David's access:
     ```bash
     curl -i -X DELETE http://localhost:5000/api/documents/1/permissions/3 \
       -H "x-simulated-email: owner@trustvault.internal"
     ```
  3. Within 1 second, retry download as **David Miller**:
     ```bash
     curl -i -X GET http://localhost:5000/api/documents/1/download \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: Step 2 returns HTTP `200 OK`. Step 3 immediately returns HTTP `403 Forbidden`.

---

## 2. File Ingestion & Storage Security Checks

### 2.1 Magic-Byte Header Inspection (Anti-Spoofing)
* **Objective**: Ensure executables or dangerous scripts disguised with `.pdf` or `.png` extensions are rejected on the server.
* **Manual Verification Flow**:
  1. Create a dummy executable script renamed with a `.pdf` extension:
     ```bash
     echo "echo 'Malicious Payload'" > fake_invoice.pdf
     ```
  2. Attempt upload via the UI or API:
     ```bash
     curl -i -X POST http://localhost:5000/api/documents \
       -H "x-simulated-email: owner@trustvault.internal" \
       -F "file=@fake_invoice.pdf" \
       -F "title=Disguised Trojan"
     ```
* **Expected Result**: HTTP `400 Bad Request` with `{ "error": "File validation failed: ..." }`. No file is written to `server/src/vault_blobs/`.

---

### 2.2 Path Traversal & Filename Sanitization
* **Objective**: Ensure attackers cannot write to arbitrary directories via directory traversal sequences (`../../etc/passwd`).
* **Manual Verification Flow**:
  1. Attempt upload with directory traversal sequences in filename:
     ```bash
     curl -i -X POST http://localhost:5000/api/documents \
       -H "x-simulated-email: owner@trustvault.internal" \
       -F "file=@valid_doc.pdf;filename=../../etc/shadow.pdf" \
       -F "title=Path Traversal Exploit"
     ```
* **Expected Result**: 
  1. Database sanitizes original filename to `______etc_shadow.pdf`.
  2. Physical file is saved strictly as `${crypto.randomUUID()}.blob` inside `server/src/vault_blobs/`.
  3. No parent directories are traversed or overwritten.

---

### 2.3 Cryptographic Integrity (SHA-256 Verification)
* **Objective**: Verify that document content cannot be silently modified or corrupted.
* **Manual Verification Flow**:
  1. Inspect document card in UI: verify the SHA-256 checksum pill matches the SHA-256 hash computed directly on the uploaded file buffer.
  2. Download file via browser and compute local hash:
     ```powershell
     Get-FileHash -Algorithm SHA256 "downloaded_file.pdf"
     ```
* **Expected Result**: Hash on disk matches the database `sha256_hash` exactly.

---

## 3. Tamper-Evident Audit Trail Checks

### 3.1 Event Completeness & Forensic Logging
* **Objective**: Verify every document lifecycle action produces an immutable audit record.
* **Manual Verification Flow**:
  1. Execute: 1 upload, 1 metadata read, 1 binary download, 1 share permission, 1 revoke permission, 1 soft-delete.
  2. Switch to **Chief Compliance Admin** (`admin@trustvault.internal`) in UI or call:
     ```bash
     curl -s http://localhost:5000/api/audit-logs \
       -H "x-simulated-email: admin@trustvault.internal"
     ```
* **Expected Result**: All 6 events are present in chronological order with non-null `actor_id`, `actor_email`, `actor_role`, `document_id`, `ip_address`, and `created_at`.

---

### 3.2 Unauthorized Intrusion Attempt Forensics
* **Objective**: Verify that failed penetration attempts generate permanent alerts for security officers.
* **Manual Verification Flow**:
  1. Trigger an unauthorized access attempt as an unauthorized user.
  2. Inspect the audit log in the Admin view.
* **Expected Result**: An entry with `status = "DENIED"` is recorded, highlighted in red with security alert metadata detailing the failed attempt.

---

### 3.3 Log Immutability & Soft Deletion
* **Objective**: Verify that audit logs cannot be purged through the API, and document deletion preserves history.
* **Manual Verification Flow**:
  1. Inspect all routes in `server/src/routes/auditRoutes.js`: verify zero `POST`, `PUT`, or `DELETE` endpoints exist.
  2. Delete a document as Owner.
  3. Inspect `audit_logs` table: verify all past download, share, and deletion records for that document remain intact.
* **Expected Result**: Zero audit records are deleted. Database `documents.is_deleted` is updated to `1`.

---

## 4. Functional & UI Experience Checks

### 4.1 Search & Multi-Dimensional Filtering
* **Objective**: Validate search functionality across all required parameters.
* **Manual Verification Flow**:
  1. In the search bar, type a keyword present in the document title -> document filters in real time.
  2. Click category pills: *Contracts & Agreements*, *Salaries & Compensation*, *External Engineering Drawings*, *Regulatory Audit Papers* -> only matching category documents display.
* **Expected Result**: Search instantly updates document cards without page reload.

---

### 4.2 1-Click Interactive Persona Switcher
* **Objective**: Confirm that switching roles instantly updates UI capabilities and permissions.
* **Manual Verification Flow**:
  1. Click **Chief Compliance Admin**: Verify the **Audit Trail** navigation tab is fully accessible and shows system-wide events.
  2. Click **Sarah Connor (Document Owner)**: Verify documents she uploaded display full `OWNER` badges, with active `Share` and `Delete` action icons.
  3. Click **David Miller (Auditor / Viewer)**: Verify unshared documents disappear from the grid; shared documents display `READ` or `EDIT` badges; `Share` and `Delete` buttons are hidden.
* **Expected Result**: Zero browser refresh required; authentication context updates instantaneously.

---

### 4.3 Secure Binary Streaming Headers
* **Objective**: Verify file downloads prevent browser MIME sniffing and caching.
* **Manual Verification Flow**:
  1. Perform an authorized download and inspect HTTP response headers:
     ```bash
     curl -i -X GET http://localhost:5000/api/documents/2/download \
       -H "x-simulated-email: owner@trustvault.internal"
     ```
* **Expected Result**: Response contains:
  * `Content-Disposition: attachment; filename="<original_filename>"`
  * `X-Content-Type-Options: nosniff`
  * `Cache-Control: private, no-cache, no-store, must-revalidate`

---

## 5. Automated Verification Matrix

| Category | Check Description | Test Command or HTTP Route | Expected HTTP Status | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **ACL / IDOR** | Unpermitted user queries another user document | `GET /api/documents/:id` (Viewer) | `403 Forbidden` | Access denied error returned; `DENIED` logged in audit table. |
| **ACL / Download** | Unpermitted user attempts binary download | `GET /api/documents/:id/download` (Viewer) | `403 Forbidden` | Zero bytes streamed; response body contains error JSON. |
| **ACL / Escalate** | Read-only viewer attempts metadata mutation | `PUT /api/documents/:id` (Viewer) | `403 Forbidden` | Metadata remains unchanged in database. |
| **ACL / Escalate** | Read-only viewer attempts permission grant | `POST /api/documents/:id/permissions` (Viewer) | `403 Forbidden` | No permissions added; owner-only restriction enforced. |
| **ACL / Revoke** | Access revoked by document owner | `DELETE /api/documents/:id/permissions/:userId` | `200 OK` | Record removed from `document_permissions`; `REVOKE` logged. |
| **ACL / Latency** | Immediate download attempt post-revocation | `GET /api/documents/:id/download` (Ex-Viewer) | `403 Forbidden` | Download blocked immediately with zero cache persistence. |
| **Storage / MIME** | Upload executable disguised with `.pdf` extension | `POST /api/documents` (Disallowed magic bytes) | `400 Bad Request` | Validation rejects buffer; zero files written to disk. |
| **Storage / Path** | Upload file with `../../` path traversal name | `POST /api/documents` (Traversal filename) | `201 Created` | File written safely as UUID blob; filename sanitized in SQL. |
| **Audit / Trail** | Verification of complete event trail | `GET /api/audit-logs` (Admin) | `200 OK` | All actions (`UPLOAD`, `DOWNLOAD`, `SHARE`, `REVOKE`) present. |
| **Audit / Admin** | Non-admin attempts system-wide audit query | `GET /api/audit-logs` (Viewer, without docId) | `403 Forbidden` | System audit logs blocked from non-administrative users. |
| **Automated Suite**| End-to-end regression test runner | `pnpm --dir server test` | Exit Code `0` | 10/10 automated tests pass with 0 failures. |

---

## 6. Execution Command Quick Reference

To execute the automated regression test suite:

```bash
cd d:\Data\Github\trustvault\server
pnpm test
```
