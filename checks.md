# TrustVault: Quality Assurance & Security Verification Checklist

This document defines the exhaustive quality assurance, security verification, and compliance testing protocol for **TrustVault**. Every test is mapped directly to the specifications in [TrustVault_Requirements.md](file:///d:/Data/Github/trustvault/TrustVault_Requirements.md) to provide evaluators and auditors with a reproducible verification flow.

---

## Requirement 1: Authentication and Roles

### 1.1 Multi-Persona Authentication & Token Verification
* **Requirement**: Implement authentication and support at least three roles: **Administrator**, **Document Owner**, and **Viewer**.
* **Objective**: Ensure that distinct cryptographic or header-authenticated sessions identify the caller and correctly associate them with one of the 3 defined roles.
* **Manual Verification Flow**:
  1. Open the TrustVault application in the browser or send an API query using the persona switcher headers:
     ```bash
     # Test Administrator authentication
     curl -i -X GET http://localhost:3000/api/auth/me \
       -H "x-simulated-email: admin@trustvault.internal"

     # Test Document Owner authentication
     curl -i -X GET http://localhost:3000/api/auth/me \
       -H "x-simulated-email: owner@trustvault.internal"

     # Test Viewer authentication
     curl -i -X GET http://localhost:3000/api/auth/me \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `200 OK` returning valid JSON payload with `email`, `role` matching the persona, and `fullName`. Unauthenticated requests without valid session tokens/headers receive HTTP `401 Unauthorized`.

### 1.2 Role-Based Scope & Capability Boundaries
* **Requirement**: Decide what each role can do and document those permissions clearly.
* **Objective**: Confirm that capability boundaries are strictly enforced across the 3 roles:
  * **Administrator**: System-wide compliance auditor. Has full visibility over global audit logs and user rosters; does not bypass document-level privacy unless explicitly shared.
  * **Document Owner**: Document author. Holds authority to upload new documents, manage existing files, grant document-level permissions, and revoke access.
  * **Viewer**: External auditor / employee. Can strictly discover, view, and download documents specifically shared with them. Forbidden from managing global logs, editing unshared files, or granting permissions.
* **Manual Verification Flow**:
  1. Switch to **Viewer** (`viewer@trustvault.internal`) in the UI or via curl.
  2. Attempt to query system-wide audit logs:
     ```bash
     curl -i -X GET http://localhost:3000/api/audit-logs \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden` with `{ "error": "Forbidden: Compliance audit records require Chief Compliance Admin authority." }`.

---

## Requirement 2: Document Management

### 2.1 Multi-Category Document Upload
* **Requirement**: Upload documents and organise documents into categories or folders.
* **Objective**: Verify that authenticated Document Owners can upload documents into organized classification categories.
* **Manual Verification Flow**:
  1. As **Sarah Connor (Owner)**, navigate to the Vault Documents view and click **Secure Upload**.
  2. Select category: *Contracts & Agreements*, *Salaries & Compensation*, *External Engineering Drawings*, or *Regulatory Audit Papers*.
  3. Upload a valid document (PDF/PNG/TXT/DOCX).
  4. Or call via API:
     ```bash
     curl -i -X POST http://localhost:3000/api/documents \
       -H "x-simulated-email: owner@trustvault.internal" \
       -F "file=@sample_contract.pdf" \
       -F "title=Q4 Master Vendor Services Agreement" \
       -F "category=Contracts & Agreements"
     ```
* **Expected Result**: HTTP `201 Created` with document metadata JSON including generated `id`, `category`, `file_size_bytes`, and `sha256_hash`.

### 2.2 Document Categorization & Filtering
* **Requirement**: Organise documents into categories and search for documents.
* **Objective**: Confirm documents are properly isolated by category pills and viewable by authorized users.
* **Manual Verification Flow**:
  1. In the UI, click on category pills (*Contracts & Agreements*, *Salaries & Compensation*, *External Engineering Drawings*, *Regulatory Audit Papers*).
  2. Verify that the grid updates dynamically to display only documents tagged with that specific category.
* **Expected Result**: Grid filters in real time without full page reload.

### 2.3 Management of Existing Documents (Metadata Updates & Archival)
* **Requirement**: Manage existing documents.
* **Objective**: Verify that document owners can update metadata and safely archive/delete their own documents.
* **Manual Verification Flow**:
  1. As Document Owner, update document metadata:
     ```bash
     curl -i -X PUT http://localhost:3000/api/documents/1 \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: owner@trustvault.internal" \
       -d '{"title": "Amended Master Services Agreement v2"}'
     ```
  2. As Document Owner, archive/delete the document:
     ```bash
     curl -i -X DELETE http://localhost:3000/api/documents/1 \
       -H "x-simulated-email: owner@trustvault.internal"
     ```
* **Expected Result**: Metadata update returns HTTP `200 OK`. Deletion returns HTTP `200 OK`, marks `is_deleted = 1` (soft-delete), removes the document from active listings, and leaves historical audit logs intact.

---

## Requirement 3: Document-Level Permissions

### 3.1 Individual Document Permission Granularity
* **Requirement**: Set permissions for each individual document.
* **Objective**: Verify permissions are not inherited globally or by folder, but mapped strictly per document ID.
* **Manual Verification Flow**:
  1. Verify the `document_permissions` table in the database contains `document_id` and `user_id` as a unique composite pair (`UNIQUE(document_id, user_id)`).
  2. Granting permission on Document #1 must have zero effect on Document #2.
* **Expected Result**: Permissions set on Doc #1 do not permit viewing or downloading Doc #2.

### 3.2 Dual-Tier Permission Levels (Read vs Edit)
* **Requirement**: Support at least two permission levels: **Read** (view or download) and **Edit** (modify a document).
* **Objective**: Verify that **Read** level permits viewing and downloading, but strictly blocks modifications; **Edit** level permits modifications.
* **Manual Verification Flow**:
  1. Grant **David Miller (Viewer)** `read` permission to Document #1:
     ```bash
     curl -i -X POST http://localhost:3000/api/documents/1/permissions \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: owner@trustvault.internal" \
       -d '{"targetEmail": "viewer@trustvault.internal", "permissionLevel": "read"}'
     ```
  2. Verify David can read metadata and download the file:
     ```bash
     curl -i -X GET http://localhost:3000/api/documents/1 -H "x-simulated-email: viewer@trustvault.internal"
     curl -i -X GET http://localhost:3000/api/documents/1/download -H "x-simulated-email: viewer@trustvault.internal"
     ```
  3. Verify David CANNOT modify the document with read-only access:
     ```bash
     curl -i -X PUT http://localhost:3000/api/documents/1 \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: viewer@trustvault.internal" \
       -d '{"title": "Unauthorized Modification"}'
     ```
* **Expected Result**: Metadata read and download return HTTP `200 OK`. The modification attempt returns HTTP `403 Forbidden`.

### 3.3 Grant Permissions to Specifically Named Users
* **Requirement**: Grant permissions to specifically named users.
* **Objective**: Ensure permissions target individual user identities rather than open public links or anonymous tokens.
* **Manual Verification Flow**:
  1. In the UI, click the **Share** button on an owned document card.
  2. Select **David Miller (Auditor / Viewer)** (`viewer@trustvault.internal`) from the user dropdown.
  3. Select **Read Only** and click **Confirm Permission Grant**.
* **Expected Result**: UI displays a green success confirmation, appends David Miller to the active ACL list with a `READ` badge, and records a `SHARE_PERMISSION` event in the audit trail.

### 3.4 Immediate Owner-Enforced Access Revocation
* **Requirement**: Allow document owners to grant access and revoke it.
* **Objective**: Verify document owners can revoke permissions at any time, immediately terminating access in real time without caching delays.
* **Manual Verification Flow**:
  1. In the Share Modal, click the **Revoke** icon next to David Miller, or send an API request:
     ```bash
     curl -i -X DELETE http://localhost:3000/api/documents/1/permissions/3 \
       -H "x-simulated-email: owner@trustvault.internal"
     ```
  2. Immediately attempt to download Document #1 as David Miller:
     ```bash
     curl -i -X GET http://localhost:3000/api/documents/1/download \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: Revocation returns HTTP `200 OK`. The subsequent download attempt immediately fails with HTTP `403 Forbidden`.

---

## Requirement 4: Access Control and Security

### 4.1 Anti-IDOR / Anti-BOLA Metadata Access Guard
* **Requirement**: Users who have not been granted access must not be able to read a document.
* **Objective**: Prevent Insecure Direct Object References (IDOR). Unauthorized users cannot view metadata simply by guessing document IDs.
* **Manual Verification Flow**:
  1. Locate an unshared document ID belonging to Sarah Connor (e.g. Doc ID #2).
  2. As David Miller, attempt to query the metadata endpoint:
     ```bash
     curl -i -X GET http://localhost:3000/api/documents/2 \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden` with `{ "error": "Forbidden: You do not have permissions to access this document." }`. A `DENIED` security event is logged in the audit trail.

### 4.2 Raw Binary Download Shielding
* **Requirement**: Users who have not been granted access must not be able to download a document.
* **Objective**: Ensure that binary file streams are never transmitted to unauthorized parties.
* **Manual Verification Flow**:
  1. As David Miller, attempt to download unshared Document #2:
     ```bash
     curl -i -X GET http://localhost:3000/api/documents/2/download \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden`. Zero file bytes are streamed; no filename or content-type headers leak.

### 4.3 Unauthorized Modification Blocking
* **Requirement**: Users who have not been granted access must not be able to modify a document.
* **Objective**: Prevent unauthorized users or read-only viewers from altering document attributes.
* **Manual Verification Flow**:
  1. Attempt to update an unshared document as an unauthorized user:
     ```bash
     curl -i -X PUT http://localhost:3000/api/documents/2 \
       -H "Content-Type: application/json" \
       -H "x-simulated-email: viewer@trustvault.internal" \
       -d '{"title": "Hacked Document Title"}'
     ```
* **Expected Result**: HTTP `403 Forbidden`. The database title remains completely unchanged.

### 4.4 Unauthorized Deletion Prevention
* **Requirement**: Users who have not been granted access must not be able to delete a document.
* **Objective**: Prevent non-owners and viewers from deleting or archiving documents.
* **Manual Verification Flow**:
  1. Attempt to delete Sarah's document as David Miller:
     ```bash
     curl -i -X DELETE http://localhost:3000/api/documents/2 \
       -H "x-simulated-email: viewer@trustvault.internal"
     ```
* **Expected Result**: HTTP `403 Forbidden`. The document remains intact with `is_deleted = 0`.

---

## Requirement 5: Audit Trail

### 5.1 Comprehensive Lifecycle Event Logging
* **Requirement**: Maintain a record of important document activities: uploads, downloads, changes, deletions, and permission changes.
* **Objective**: Ensure every critical lifecycle event triggers an automatic audit log entry.
* **Manual Verification Flow**:
  1. Perform one action of each type:
     * `UPLOAD`: Upload a file
     * `READ_METADATA`: View document details
     * `DOWNLOAD`: Download document binary
     * `SHARE_PERMISSION`: Grant access to a user
     * `REVOKE_PERMISSION`: Revoke access from a user
     * `DELETE`: Archive a document
  2. As Administrator, query `GET /api/audit-logs`.
* **Expected Result**: All 6 action types are present in chronological order with non-null foreign keys and metadata.

### 5.2 Forensic Attribution (Who, When, What, IP, User-Agent)
* **Requirement**: Each audit record should help establish who performed an action and when it happened.
* **Objective**: Ensure that audit entries record full identity forensics for legal accountability.
* **Manual Verification Flow**:
  1. Inspect an audit log record:
     ```json
     {
       "id": 14,
       "action": "DOWNLOAD",
       "actor_id": 2,
       "actor_email": "owner@trustvault.internal",
       "actor_role": "owner",
       "document_id": 1,
       "document_title": "Confidential Salary Report.pdf",
       "ip_address": "127.0.0.1",
       "user_agent": "Mozilla/5.0 ...",
       "status": "SUCCESS",
       "created_at": "2026-10-22T21:48:15.000Z"
     }
     ```
* **Expected Result**: Every record accurately identifies the actor, target document, IP address, client environment, and UTC timestamp.

### 5.3 Security Violation Alerting (DENIED Status Capture)
* **Requirement**: Record unauthorized attempts to answer: "Who tried to reach this, and when?"
* **Objective**: Ensure that rejected access attempts create permanent audit evidence for security incident response.
* **Manual Verification Flow**:
  1. Attempt an unauthorized download or metadata query.
  2. Inspect the audit trail in the Admin dashboard.
* **Expected Result**: An entry with `status = "DENIED"` appears highlighted in red, detailing the actor's email, target document, and reason for rejection.

### 5.4 Immutability & Append-Only Storage
* **Requirement**: Audit trail integrity.
* **Objective**: Ensure audit records cannot be tampered with, edited, or deleted via the API.
* **Manual Verification Flow**:
  1. Review `server/src/routes/auditRoutes.js`: verify there are zero `POST`, `PUT`, or `DELETE` endpoints.
  2. Deleting a document does not delete its audit history.
* **Expected Result**: The `audit_logs` table operates strictly as an append-only ledger.

---

## Requirement 6: Search and Filtering

### 6.1 Multi-Parameter Search & Filtering
* **Requirement**: Allow users to search or filter documents by: Document name, Document owner, Category, Date.
* **Objective**: Validate keyword search and filtering across all designated parameters.
* **Manual Verification Flow**:
  1. **By Document Name**: Enter keyword in the search bar -> instant matching on title and original filename.
  2. **By Category**: Select category pill (e.g. *External Engineering Drawings*) -> instant filter.
  3. **By Owner**: Inspect document card owner pill -> correctly displays the author name and email.
  4. **By Date**: Inspect formatted upload date and sorting by creation timestamp.
* **Expected Result**: Queries update the document grid smoothly in real time.

### 6.2 Zero-Leak Permission Scoping in Search
* **Requirement**: Search results must respect the user's permissions. Users should not discover confidential documents through search if they do not have access to them.
* **Objective**: Prevent metadata leakage through search queries (Information Disclosure Prevention).
* **Manual Verification Flow**:
  1. As Sarah Connor (Owner), upload a document titled *"Confidential CEO Bonus Plan"*.
  2. Switch to **David Miller (Viewer)** without granting him access.
  3. In David Miller's search bar, search for *"CEO"* or *"Bonus"*.
* **Expected Result**: Zero results returned. The confidential document is completely invisible to David Miller in both the UI and raw API response.

---

## Requirement 7: File Upload Validation

### 7.1 Magic Byte File Signature Inspection
* **Requirement**: Validate uploaded files to ensure they meet application security and file-handling requirements.
* **Objective**: Prevent attackers from uploading malicious executables or scripts disguised with benign file extensions.
* **Manual Verification Flow**:
  1. Create a dummy executable script renamed with a `.pdf` extension:
     ```bash
     echo "malicious payload" > fake_invoice.pdf
     ```
  2. Attempt upload via API or UI:
     ```bash
     curl -i -X POST http://localhost:3000/api/documents \
       -H "x-simulated-email: owner@trustvault.internal" \
       -F "file=@fake_invoice.pdf" \
       -F "title=Disguised Trojan"
     ```
* **Expected Result**: HTTP `400 Bad Request` with `{ "error": "File validation failed: Magic byte signature mismatch. File content does not match extension." }`. No file is written to storage.

### 7.2 Directory Traversal & Filename Sanitization
* **Requirement**: Ensure file handling prevents unauthorized filesystem manipulation.
* **Objective**: Prevent path traversal attacks (`../../etc/passwd`) via crafted filenames.
* **Manual Verification Flow**:
  1. Attempt an upload with traversal sequences:
     ```bash
     curl -i -X POST http://localhost:3000/api/documents \
       -H "x-simulated-email: owner@trustvault.internal" \
       -F "file=@valid_file.pdf;filename=../../etc/shadow.pdf" \
       -F "title=Path Traversal Exploit"
     ```
* **Expected Result**: Filename is strictly sanitized to `______etc_shadow.pdf`. File is stored on disk under an obfuscated UUID (`<uuid>.blob`). No parent directories are traversed or overwritten.

### 7.3 Cryptographic Integrity (SHA-256 Verification)
* **Requirement**: Validate file integrity.
* **Objective**: Ensure files are hashed upon arrival and verified against corruption or tampering.
* **Manual Verification Flow**:
  1. Inspect the SHA-256 hash displayed on the document card in the UI.
  2. Download the document and compute its SHA-256 hash locally:
     ```powershell
     Get-FileHash -Algorithm SHA256 "downloaded_file.pdf"
     ```
* **Expected Result**: Local computed digest matches the database `sha256_hash` character-for-character.

---

## Requirement 8: Administrative Dashboard

### 8.1 Administrative Dashboard Activity View
* **Requirement**: Provide an administrative view that displays: Document activity, Permission changes, Relevant audit records.
* **Objective**: Ensure compliance officers have a centralized, forensic dashboard of all system operations.
* **Manual Verification Flow**:
  1. Switch to **Chief Compliance Admin** (`admin@trustvault.internal`).
  2. Click on the **Audit Trail** tab in the top navigation.
* **Expected Result**: Dashboard renders a comprehensive, real-time table of all document uploads, downloads, permission grants, revocations, and access rejections.

### 8.2 Real-Time Security Filtering & Search
* **Requirement**: Facilitate swift security analysis and regulatory review.
* **Objective**: Allow administrators to filter audit events by action type and violation status.
* **Manual Verification Flow**:
  1. In the Audit Trail filter bar, select **Action**: `DOWNLOAD` -> only download events display.
  2. Select **Status**: `DENIED (Security Violation)` -> only rejected penetration attempts display.
  3. Enter actor email or document name in search -> instant filtering.
* **Expected Result**: Table updates in real time with zero layout shift or flickering.

---

## Requirement 9: Automated Security Tests

### 9.1 Test Suite Structure & Execution
* **Requirement**: Write automated tests demonstrating that one user cannot access another user's documents without permission.
* **Objective**: Ensure continuous regression prevention via automated, self-contained security tests.
* **Manual Verification Flow**:
  1. Run the test suite:
     ```bash
     node tests/security.test.js
     ```
* **Expected Result**: All 10 automated security tests pass with exit code `0`.

### 9.2 Automated Test Coverage Matrix
* **Requirement**: Tests should cover attempts to read, download, edit, and delete unauthorised documents.
* **Coverage Verification**:
  * **Test 1**: Owner uploads a confidential document -> Verified.
  * **Test 2 (Read Metadata)**: Unauthorized viewer CANNOT view document metadata (IDOR rejection -> HTTP 403, DENIED audit logged).
  * **Test 3 (Download Binary)**: Unauthorized viewer CANNOT download confidential file (Data leakage prevention -> HTTP 403).
  * **Test 4 (Grant Permission)**: Owner grants "read" permission to specific user -> HTTP 200, SHARE_PERMISSION logged.
  * **Test 5 (Authorized Access)**: User CAN view metadata and download file after permission granted -> HTTP 200, verified content.
  * **Test 6 (Edit Privilege Escalation)**: Read-only user CANNOT modify document metadata -> HTTP 403.
  * **Test 7 (Revoke Access)**: Owner revokes access -> HTTP 200, REVOKE_PERMISSION logged.
  * **Test 8 (Post-Revocation Block)**: Revoked user is IMMEDIATELY blocked from accessing document -> HTTP 403.
  * **Test 9 (Delete Protection)**: Unauthorized user CANNOT delete another user's document -> HTTP 403.
  * **Test 10 (Admin Audit Trail)**: Admin inspects system-wide audit records with all events accounted for -> HTTP 200.

---

## 10. Master Requirements Compliance & Verification Matrix

| Req # | Requirement Name | Test Route / Verification Action | Test Persona | Expected HTTP Status | Pass/Fail Criteria |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | Authentication & Roles | `GET /api/auth/me` | Admin / Owner / Viewer | `200 OK` | Valid identity returned with designated role credentials. |
| **1** | Role Authorization | `GET /api/audit-logs` | Viewer | `403 Forbidden` | Non-admin blocked from system-wide compliance logs. |
| **2** | Document Upload | `POST /api/documents` | Document Owner | `201 Created` | File saved as UUID blob; SHA-256 hash computed. |
| **2** | Category Organization | Filter by category pill in UI | Document Owner | `200 OK` | Grid filters to selected category in real time. |
| **2** | Document Management | `DELETE /api/documents/:id` | Document Owner | `200 OK` | Soft-delete applied (`is_deleted = 1`); audit trail preserved. |
| **3** | Document-Level ACL | `POST /api/documents/:id/permissions` | Document Owner | `200 OK` | Permission bound to specific user ID and document ID. |
| **3** | Dual Permissions | `PUT /api/documents/:id` | Read-Only Viewer | `403 Forbidden` | User with `read` permission blocked from mutating title. |
| **3** | Access Revocation | `DELETE /api/documents/:id/permissions/:userId` | Document Owner | `200 OK` | Permission record removed; user blocked immediately. |
| **4** | Anti-IDOR / Read | `GET /api/documents/:id` | Unpermitted Viewer | `403 Forbidden` | Direct metadata access blocked; `DENIED` audit logged. |
| **4** | Download Shield | `GET /api/documents/:id/download` | Unpermitted Viewer | `403 Forbidden` | Zero binary bytes streamed; no header leakage. |
| **4** | Unpermitted Delete | `DELETE /api/documents/:id` | Unpermitted Viewer | `403 Forbidden` | Document remains intact on filesystem and database. |
| **5** | Audit Logging | `GET /api/audit-logs` | Compliance Admin | `200 OK` | Full event ledger rendered with actor, IP, and timestamp. |
| **5** | Log Immutability | API Route Review | Any Actor | `405 / 404` | Zero update or purge endpoints exist for audit logs. |
| **6** | Search Filtering | Search query via UI or API | Authorized User | `200 OK` | Matches on title/filename; respects user permissions. |
| **6** | Zero-Leak Search | Search for unpermitted document title | Unpermitted Viewer | `200 OK` (Empty) | Confidential documents never appear in search results. |
| **7** | Magic Byte Inspection | Upload disguised executable script | Document Owner | `400 Bad Request` | Rejected before storage; magic byte mismatch reported. |
| **7** | Path Traversal Guard | Upload filename with `../../` | Document Owner | `201 Created` | Stored safely as UUID blob; filename sanitized in SQL. |
| **8** | Admin Dashboard | UI Navigation to Audit Trail Tab | Compliance Admin | `200 OK` | Full audit ledger with real-time action & status filters. |
| **9** | Automated Security Tests | `node tests/security.test.js` | Test Runner | Exit Code `0` | 10/10 security tests pass in under 500ms. |

---

## 11. Test Execution Commands & Verification Guide

### Running Automated Security Regression Tests
```bash
# From workspace root:
node tests/security.test.js

# Or using pnpm from server directory:
cd server
pnpm test
```

### Running the Client and Server Locally
```bash
# Start backend server (Port 3000):
cd server
pnpm dev

# Start client application (Port 5173):
cd client
pnpm dev
```
