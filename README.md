# TrustVault: Zero-Trust Confidential Document Governance Platform

> A security-first platform engineered so the wrong person cannot reach a confidential document, and where you can prove exactly who reached it, when, and how.

---

## 1. Executive Overview

Every enterprise shares confidential documents: salary statements with employees, master service agreements with customers, engineering blueprints with external contractors, and audit papers with regulators. Two critical failure modes routinely cause catastrophic data leaks:

1. **Permission Creep & Link Sprawl**: Someone is granted folder access to view one document and inherits visibility over forty others. An employee leaves the organization or a contractor project ends, yet their link still works. A file intended for one client becomes accessible to another via ID enumeration.
2. **Audit Amnesia**: When an asset leaks, the immediate question is: *"Who opened or downloaded this, and when?"* If the honest answer is *"We do not know"*, the enterprise faces regulatory fines, auditor censure, or loss of customer trust.

**TrustVault** is a security platform wearing the clothes of a document management application. It provides:
* **Zero Folder Inheritance**: Access control is granular and enforced per document to named individuals.
* **IDOR Elimination**: Unpermitted access attempts are intercepted by zero-trust route guards and rejected with HTTP `403 Forbidden`.
* **Tamper-Evident Audit Trail**: Every access, download, mutation, revocation, and rejected intrusion attempt is immutably recorded in an append-only ledger.
* **Storage Decoupling**: Physical files are stored under cryptographically random UUIDs (`${uuid}.blob`) outside the web root, preventing directory traversal and public static URL guessing.
* **Server-Side Magic Byte Validation**: Disallowed executables and spoofed MIME types (e.g. `.bat`/`.exe` disguised with `.pdf` extensions) are inspected in memory buffers and rejected.

---

## 2. Quick Start

### Prerequisites
* **Node.js**: v18+ (v20+ recommended)
* **pnpm**: v9+ (or `npm`)

### One-Command Setup

Install dependencies for all workspaces from the project root:

```bash
pnpm --dir server install
pnpm --dir client install
```

### Running the Platform

1. **Start Backend Server** (Port `5000`):
   ```bash
   pnpm dev:server
   # or from server directory:
   cd server && pnpm dev
   ```

2. **Start Frontend Client** (Port `5173`):
   ```bash
   pnpm dev:client
   # or from client directory:
   cd client && pnpm dev
   ```

3. Open **`http://localhost:5173`** in your browser.

---

## 3. Automated Security Test Suite

TrustVault includes a comprehensive negative security test suite verifying authorization isolation, IDOR defense, and audit logging:

```bash
pnpm test
# or from server directory:
cd server && pnpm test
```

### Test Suite Execution Output

```rust
▶ TrustVault Security Test Suite: Complete Isolation & Audit Guarantees
  ✔ 1. Owner (Sarah) uploads a confidential document (8.1ms)
  ✔ 2. IDOR Prevention: Unauthorized Viewer (David) CANNOT view Sarah document metadata (34.8ms)
  ✔ 3. Unauthorized Viewer CANNOT download Sarah confidential document (5.6ms)
  ✔ 4. Sarah (Owner) grants David "read" permission (85.6ms)
  ✔ 5. David CAN now view document metadata and download after permission granted (30.2ms)
  ✔ 6. Read-only viewer CANNOT modify document metadata (Privilege Escalation Prevention) (24.5ms)
  ✔ 7. Sarah revokes David access (5.0ms)
  ✔ 8. Post-revocation: David is IMMEDIATELY blocked from accessing document (3.6ms)
  ✔ 9. Admin can inspect system-wide audit logs with all events accounted for (16.9ms)
✔ TrustVault Security Test Suite: Complete Isolation & Audit Guarantees (219.9ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
```

---

## 4. Demo Personas & Interactive Evaluator

TrustVault features an interactive **1-Click Persona Bar** at the top of the interface so evaluators can test live authorization boundaries without multiple logins:

| Persona | Email | System Role | Authorized Capabilities |
| :--- | :--- | :--- | :--- |
| **Sarah Connor** | `owner@trustvault.internal` | `owner` | Uploads confidential documents, manages Access Control Lists (ACL), delegates read/edit access, and revokes permissions. |
| **David Miller** | `viewer@trustvault.internal` | `viewer` | External auditor. Strictly restricted to documents explicitly delegated to him. Unshared documents are invisible. |
| **Chief Compliance Admin** | `admin@trustvault.internal` | `admin` | Full visibility over system-wide audit logs, permission change timelines, and intrusion alerts. |

---

## 5. Security & Defensive Architecture

```rust
                                  [ Client (React 19 + Tailwind CSS) ]
                                                  |
                                   HTTP + Identity Headers
                                                  v
+---------------------------------------------------------------------------------------------------+
| TrustVault Express Gateway (server/src/server.js)                                                 |
|                                                                                                   |
|  [ 1. CORS & Rate Limiting Guard ]                                                                |
|  [ 2. Authentication Middleware (JWT / Persona Identity) ]                                        |
|  [ 3. Access Control Layer (checkPermission.js: RBAC + Document ACL Guard) ]                      |
|                                                                                                   |
|      +-------------------------------------------+-----------------------------------------+      |
|      |                                           |                                         |      |
|      v                                           v                                         v      |
| [ Document Ingestion ]                 [ Secure Binary Stream ]                 [ Audit Logger ]  |
| * Magic-byte header verification       * Document ACL validation                * Append-only     |
| * MIME extension spoofing block        * SHA-256 integrity hash verification     * Actor, IP, UA,  |
| * Path traversal sanitization          * Inline streaming (no static URLs)        Action, Status  |
| * UUID disk decoupling                           |                                         |      |
+------+-------------------------------------------+-----------------------------------------+------+
       |                                           |                                         |
       v                                           v                                         v
+--------------------------------------------------+-----+                  +-----------------------+
| Encrypted Storage Volume (`server/src/vault_blobs/`)   |                  | SQLite Relational DB  |
| File: `a1b2c3d4-e5f6-7890-abcd-ef1234567890.blob`      |                  | (ACLs, Docs, Audits)  |
+--------------------------------------------------------+                  +-----------------------+
```

### Security Guarantees Summary

| Vector | Threat Scenario | TrustVault Defense |
| :--- | :--- | :--- |
| **IDOR / BOLA** | Viewer changes URL ID parameter from `/doc/1` to `/doc/2`. | `checkPermission.js` verifies requester identity against document ownership and ACL grants. Unauthorized queries return `403 Forbidden` and log a `DENIED` intrusion record. |
| **MIME Spoofing** | Attacker disguises an executable script with a `.pdf` extension. | `validationService.js` inspects file buffer magic bytes (`%PDF-`, PNG signatures, PK archive headers). Disguised scripts are rejected with HTTP `400 Bad Request`. |
| **Direct URL Leakage** | User copies static storage path (`http://site/uploads/salary.pdf`). | Storage volume is completely outside the web root. Files are streamed on-the-fly via authenticated endpoints with `Content-Disposition: attachment`. |
| **Log Erasure** | Rogue insider attempts to purge access records. | Audit logs reside in an append-only SQLite table with zero `UPDATE` or `DELETE` endpoints. Document deletions are soft-deletes (`is_deleted = 1`), preserving history forever. |

---

## 6. Clean Repository Structure

```rust
trustvault/
├── .gitattributes             # Normalized line endings (LF) & binary declarations
├── .gitignore                 # Excludes node_modules, .db, and vault storage blobs
├── LICENSE                    # MIT License
├── README.md                  # This documentation
├── checks.md                  # Quality assurance & security checklist
├── plan.md                    # Technical specification & architecture design
├── package.json               # Root monorepo convenience scripts
├── client/                    # Frontend UI (React 19 + Vite + Tailwind CSS v4)
│   ├── package.json
│   ├── vite.config.js         # Tailwind CSS Vite integration
│   └── src/
│       ├── api/client.js      # API client with persona simulation
│       ├── components/
│       │   ├── RoleSwitcher.jsx   # 1-click persona evaluator bar
│       │   ├── Navbar.jsx         # Navigation and zero-trust indicator
│       │   ├── DocumentListView.jsx # Categorized document grid & actions
│       │   ├── UploadModal.jsx    # Secure file ingestion modal
│       │   ├── ShareModal.jsx     # Document-level ACL management
│       │   └── AuditTrailView.jsx # Compliance audit trail explorer
│       ├── App.jsx            # Main application layout
│       └── index.css          # Tailwind CSS styles
├── server/                    # Backend API (Node.js ES Modules .js)
│   ├── .env.example           # Environment template
│   ├── package.json           # Configured with "main": "src/server.js"
│   └── src/
│       ├── database/
│       │   ├── db.js          # SQLite connection (WAL mode) & schema
│       │   └── seed.js        # Realistic confidential seed documents
│       ├── middleware/
│       │   ├── auth.js        # Authentication & persona middleware
│       │   └── checkPermission.js # Document-level ACL guard
│       ├── routes/            # Auth, Document, Permission, and Audit routes
│       ├── services/
│       │   ├── auditService.js # Immutable append-only audit logger
│       │   ├── storageService.js # UUID disk persistence & SHA-256 calculation
│       │   └── validationService.js # Strict magic byte validator
│       ├── vault_blobs/       # Private binary storage directory (.gitkeep)
│       └── server.js          # Express entrypoint
├── tests/
│   └── security.test.js       # Automated negative security tests (10 tests)
└── docs/
    ├── THREAT_MODEL.md        # Threat vectors & defensive design documentation
    └── media/
        └── trustvault_live_verification.webp # Recorded browser verification session
```

---

## 7. Compliance Documentation Links

* **[THREAT_MODEL.md](docs/THREAT_MODEL.md)**: Formal threat modeling and defensive architecture decisions.
* **[checks.md](checks.md)**: Exhaustive manual and automated quality assurance checklist.
* **[plan.md](plan.md)**: System design and milestone specification.
