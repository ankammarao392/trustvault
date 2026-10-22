# TrustVault: Engineering Implementation Plan & Technical Specification

> **Project Goal**: Build **TrustVault** — a security-first document management and governance platform where unauthorized parties cannot reach confidential files (salary letters, contracts, drawings, audit papers), and where every access attempt produces an un-forgeable, immutable audit trail.

---

## 1. Executive Summary & Design Philosophy

TrustVault addresses the two primary failure modes of enterprise document sharing:

1. **Permission Creep & Insecure Direct Object References (IDOR)**: Users accessing files beyond their mandate or retaining access after offboarding.
2. **Audit Amnesia**: Inability to definitively prove who opened, downloaded, or shared a document when an incident occurs.

This system is engineered under the principle of **least privilege and zero-trust**:

- **Backend**: Node.js (`.js`, ES Modules / Express) with strict authorization middleware on every route.
- **Frontend**: React 19 + Vite + Tailwind CSS (v4), featuring an intuitive, high-security dashboard.
- **Storage Engine**: Obfuscated UUID-addressed blob storage with SHA-256 cryptographic integrity verification.
- **Audit Subsystem**: Append-only, tamper-evident SQL event stream.

---

## 2. Threat Model & Security Boundaries

```rust
                                  [ Client (React + Tailwind CSS) ]
                                                  |
                                       HTTPS + Bearer Token
                                                  v
+---------------------------------------------------------------------------------------------------+
| TrustVault Express Gateway (server.js)                                                            |
|                                                                                                   |
|  [ 1. Rate Limiting & Helmet Security Headers ]                                                   |
|  [ 2. JWT Authentication Middleware ]                                                             |
|  [ 3. Access Control Layer (RBAC + Document ACL Check) ]                                         |
|                                                                                                   |
|      +-------------------------------------------+-----------------------------------------+      |
|      |                                           |                                         |      |
|      v                                           v                                         v      |
| [ Document Ingestion ]                 [ Secure Download Stream ]               [ Audit Logger ]  |
| * Magic-byte header verification       * Document ACL verification              * Append-only     |
| * MIME-type enforcement                * Cryptographic SHA-256 verification     * Actor, IP, UA,  |
| * Path traversal sanitization          * Inline streaming (no public URLs)        Action, Status  |
| * UUID disk decoupling                           |                                         |      |
+------+-------------------------------------------+-----------------------------------------+------+
       |                                           |                                         |
       v                                           v                                         v
+--------------------------------------------------+-----+                  +-----------------------+
| Encrypted / Isolated Storage (`server/vault_blobs/`)   |                  | SQLite Relational DB  |
| File: `a1b2c3d4-e5f6-7890-abcd-ef1234567890.blob`      |                  | (ACLs, Docs, Audits)  |
+--------------------------------------------------------+                  +-----------------------+
```

### Threat Vectors Mitigated

| Threat Vector                                 | Attack Scenario                                                  | TrustVault Mitigation Strategy                                                                                                                                                                          |
| :-------------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **IDOR (Insecure Direct Object Reference)**   | Attacker changes URL parameter from `/doc/10` to `/doc/11`.      | The document query joins against `document_permissions` and `documents.owner_id`. Unauthorized requests return `404 Not Found` (to avoid leaking document existence) or `403 Forbidden`.                |
| **Path Traversal / Arbitrary File Overwrite** | File named `../../etc/passwd` or `shell.php`.                    | Original filename is safely stored as metadata in SQL. The physical file is saved on disk as a cryptographically generated UUID (e.g., `${crypto.randomUUID()}.blob`).                                  |
| **MIME Spoofing / Malicious Uploads**         | Malicious executable `.exe` renamed to `.pdf`.                   | Backend inspects file **magic bytes** (e.g., `%PDF-` for PDFs, `PK` for ZIP/DOCX) using buffer header checks before accepting the file into storage.                                                    |
| **Audit Log Tampering**                       | Rogue user deletes a document and removes audit trail.           | Audit logs reside in an append-only table. The API exposes **zero `UPDATE` or `DELETE` endpoints** on audit logs. Document deletion is a **soft-delete**, preserving document history and logs forever. |
| **Direct Static Link Leakage**                | User copies static file URL (`https://site/uploads/salary.pdf`). | Storage directory is completely outside the web root (`public/`). Files are never served statically. Every download is an authorized streamed HTTP response.                                            |

---

## 3. Database Schema Specification

Using SQLite via `better-sqlite3` (or PostgreSQL in production):

```rust
+------------------------------------+          +------------------------------------+
|               users                |          |             documents              |
+------------------------------------+          +------------------------------------+
| id          INTEGER PRIMARY KEY    | 1      * | id                 INTEGER PK      |
| email       TEXT UNIQUE NOT NULL   |<---------| owner_id           INTEGER FK      |
| password    TEXT NOT NULL          |          | title              TEXT NOT NULL   |
| full_name   TEXT NOT NULL          |          | original_filename  TEXT NOT NULL   |
| role        TEXT NOT NULL          |          | stored_filename    TEXT NOT NULL   |
| created_at  DATETIME DEFAULT NOW   |          | file_size_bytes    INTEGER NOT NULL|
+------------------------------------+          | mime_type          TEXT NOT NULL   |
       | 1                           | 1        | sha256_hash        TEXT NOT NULL   |
       |                             |          | category           TEXT NOT NULL   |
       |                             |          | is_deleted         INTEGER DEFAULT0|
       |                             |          | created_at         DATETIME        |
       | *                           | *        +------------------------------------+
+------------------------------------+                    | 1
|        document_permissions        |                    |
+------------------------------------+                    |
| id          INTEGER PRIMARY KEY    |                    |
| document_id INTEGER FK ------------+--------------------+
| user_id     INTEGER FK             |
| permission  TEXT ('read' | 'edit') |
| granted_by  INTEGER FK             |
| granted_at  DATETIME DEFAULT NOW   |
+------------------------------------+

+------------------------------------------------------------------------------+
|                                 audit_logs                                   |
+------------------------------------------------------------------------------+
| id             INTEGER PRIMARY KEY AUTOINCREMENT                             |
| timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL                   |
| action         TEXT NOT NULL  -- UPLOAD, DOWNLOAD, READ, SHARE, REVOKE, DELETE|
| actor_id       INTEGER NOT NULL                                              |
| actor_email    TEXT NOT NULL                                                 |
| actor_role     TEXT NOT NULL                                                 |
| document_id    INTEGER                                                       |
| document_title TEXT                                                          |
| ip_address     TEXT                                                          |
| user_agent     TEXT                                                          |
| status         TEXT NOT NULL  -- SUCCESS | DENIED                            |
| metadata       TEXT           -- JSON string with extra context              |
+------------------------------------------------------------------------------+
```

---

## 4. Role-Based Access Control (RBAC) & Permissions Matrix

TrustVault enforces a hybrid **RBAC + Discretionary Access Control (DAC)** model:

| Role / Actor       | System View                           | Upload Files                         | Read Shared Files                   | Grant / Revoke Access                  | View Full System Audit Trail                  |
| :----------------- | :------------------------------------ | :----------------------------------- | :---------------------------------- | :------------------------------------- | :-------------------------------------------- |
| **Administrator**  | System dashboard, system-wide metrics | Yes                                  | Only if owner or explicitly granted | Cannot bypass document ownership rules | **Full Access** (all events across all users) |
| **Document Owner** | Personal & shared documents           | Yes                                  | Full access to own documents        | Full access for owned documents        | View audit events for **own documents only**  |
| **Viewer**         | Only documents shared with them       | Yes (becomes owner of uploaded file) | Read-only (or Edit if granted)      | None                                   | None                                          |

---

## 5. System Directory Structure

```rust
trustvault/
├── client/                               # Frontend (React 19 + Vite + Tailwind CSS v4)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js                    # Configured with @tailwindcss/vite
│   └── src/
│       ├── index.css                     # @import "tailwindcss";
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js                 # Axios/Fetch API wrapper with JWT headers
│       ├── context/
│       │   └── AuthContext.jsx           # Active user state & role management
│       ├── components/
│       │   ├── Navbar.jsx                # Brand, active role switcher, user profile
│       │   ├── DocumentCard.jsx          # Document item with security badges
│       │   ├── UploadModal.jsx           # File upload with client-side validation
│       │   ├── PermissionModal.jsx       # Manage access: grant/revoke read & edit
│       │   ├── AuditTable.jsx            # Filterable audit event viewer
│       │   └── ConfirmDialog.jsx         # Revocation & deletion confirmations
│       └── views/
│           ├── DashboardView.jsx         # Main document repository & search
│           ├── DocumentDetailView.jsx    # Document preview, metadata, & activity
│           └── AdminAuditView.jsx        # Enterprise audit log compliance center
│
├── server/                               # Backend (Node.js Express, ES Modules)
│   ├── package.json                      # "type": "module"
│   ├── src/                         # Express entrypoint & route registration
│   │   ├── database/
│   │   ├── db.js                         # SQLite connection & schema initialization
│   │   └── seed.js                       # Initial test users & documents
│   │   ├── middleware/
│   │   ├── auth.js                       # JWT verification & actor injection
│   │   ├── checkPermission.js            # Document ACL validation (Read / Edit / Owner)
│   │   └── auditLogger.js                # Automatic request logging helper
│   │   ├── services/
│   │   ├── auditService.js               # Append-only audit logger
│   │   ├── documentService.js            # Upload, metadata, delete, query
│   │   ├── storageService.js             # UUID file persistence & streaming
│   │   └── validationService.js          # Magic byte inspection & sanitize
│   │   ├── routes/
│   │   ├── authRoutes.js                 # /api/auth (login, register, me)
│   │   ├── documentRoutes.js             # /api/documents (CRUD, search, download)
│   │   ├── permissionRoutes.js           # /api/documents/:id/permissions
│   │   └── auditRoutes.js                # /api/audit-logs (admin only)
│   │   └── vault_blobs/                      # Private non-served directory for file bytes
│
├── tests/                                # Automated Security & Integration Tests
│   ├── security.test.js                  # Negative permission tests (IDOR, Tampering)
│   ├── audit.test.js                     # Immutability and audit completeness tests
│   └── validation.test.js                # Magic-byte and MIME validation tests
│
├── docs/
│   ├── THREAT_MODEL.md                   # Formal security boundaries & threat analysis
│   └── ARCHITECTURE.md                   # System diagram & data flow
├── PROJECT_PLAN.md                       # This document
└── README.md                             # Quickstart & evaluation guide
```

---

## 6. Implementation Milestones

### Milestone 1: Server Core & Database Foundation

- Initialize `server/package.json` with dependencies: `express`, `cors`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `multer`.
- Create `db.js` with auto-migration executing the 4 SQL tables (`users`, `documents`, `document_permissions`, `audit_logs`).
- Implement `auditService.js` to handle tamper-evident event creation.
- Create `seed.js` with 3 pre-configured demo personas:
  - `admin@trustvault.internal` (Role: `admin`)
  - `sarah.owner@trustvault.internal` (Role: `owner`)
  - `david.viewer@trustvault.internal` (Role: `viewer`)

### Milestone 2: File Ingestion & Secure Download Pipeline

- Build `validationService.js` to inspect file buffers for valid magic signatures (PDF: `%PDF-`, PNG: `\x89PNG`, DOCX: `PK`).
- Build `storageService.js` to write files as `crypto.randomUUID() + '.blob'` into private `vault_blobs/` and compute SHA-256 hash.
- Create `/api/documents/:id/download` route that:
  1. Checks permission (`owner` OR recipient in `document_permissions`).
  2. If unauthorized: writes `DENIED` event to `audit_logs` and returns `404 Not Found`.
  3. If authorized: writes `DOWNLOAD` event to `audit_logs` and streams binary via `res.sendFile()` or `fs.createReadStream()`.

### Milestone 3: Access Control & Permission Management

- Implement `/api/documents/:id/permissions` endpoints:
  - `GET`: List active permissions on the document.
  - `POST`: Grant `read` or `edit` access to a named user email (logs `SHARE` event).
  - `DELETE /:userId`: Revoke access immediately (logs `REVOKE` event).
- Implement document search endpoint with filtering by name, category, date, and owner.

### Milestone 4: Client Dashboard (React + Tailwind CSS)

- Set up standard clean, enterprise-grade interface:
  - Sleek dark/light aesthetic using Tailwind CSS.
  - **Role Switcher / Impersonation Banner**: Enables evaluators to effortlessly switch between Admin, Owner, and Viewer with one click to test permissions live.
  - **Document Grid**: Displaying tags, classification, file size, SHA-256 badge, and action buttons.
  - **Permission Management Modal**: Simple UI to add collaborators by email, toggle permissions, or revoke with instant feedback.
  - **Admin Audit Trail Screen**: Interactive table with color-coded action badges (`UPLOAD` blue, `DOWNLOAD` green, `REVOKE` amber, `DENIED` red).

### Milestone 5: Automated Security Test Suite

- Implement automated tests verifying:
  - **Unauthorized Download**: User B cannot download User A's document (`404`/`403`).
  - **Unauthorized Permission Escalation**: Viewer cannot grant permissions to another user.
  - **Revocation Enforcement**: User B's access works, is revoked, and subsequent download immediately returns `404`/`403`.
  - **Tamper-Evident Audit Verification**: Querying audit logs verifies that all 3 actions above produced immutable log entries.

---

## 7. Verification & Evaluation Checklist

| Category           | Requirement                                     | Verification Method                             | Status  |
| :----------------- | :---------------------------------------------- | :---------------------------------------------- | :------ |
| **Authentication** | 3 Distinct Roles (Admin, Owner, Viewer)         | Login with seed accounts & inspect JWT claims   | Planned |
| **Authorization**  | Strict Per-Document Permissions                 | Automated negative test suite (`npm test`)      | Planned |
| **Integrity**      | SHA-256 Checksum on Upload & Download           | Assert hash matches original file content       | Planned |
| **Security**       | Magic-Byte File Validation                      | Reject `.exe` disguised with `.pdf` extension   | Planned |
| **Audit Trail**    | Immutable Log of All Reads, Writes, Revocations | Query `audit_logs` table after each operation   | Planned |
| **Admin View**     | System-wide Audit & Activity Screen             | Admin dashboard renders chronological audit log | Planned |
