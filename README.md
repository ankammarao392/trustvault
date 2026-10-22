# TrustVault: Zero-Trust Confidential Document Governance Platform

TrustVault is a security-first document management platform designed to prevent **permission leakage** and eliminate **audit amnesia**. It ensures that unauthorized users cannot reach confidential files and provides an immutable, tamper-evident audit trail of every access attempt.

---

## 1. Quick Start

### Prerequisites
* **Node.js**: v18+ (v20+ recommended)
* **pnpm**: v9+ (or `npm`)

### Installation & Setup

1. **Install and Start Backend Server**:
   ```bash
   cd server
   pnpm install
   pnpm start
   ```
   *The backend server starts on `http://localhost:5000` via `src/server.js` with an auto-initialized SQLite database in WAL mode.*

2. **Install and Start Frontend Client**:
   ```bash
   cd ../client
   pnpm install
   pnpm dev
   ```
   *The client starts on `http://localhost:5173` powered by React 19, Vite, and Tailwind CSS.*

---

## 2. Automated Security Test Suite

Run the automated security tests verifying negative permission checks, IDOR defenses, and audit log generation:

```bash
cd server
pnpm test
```

### Test Suite Output

```rust
▶ TrustVault Security Test Suite: Complete Isolation & Audit Guarantees
  ✔ 1. Owner (Sarah) uploads a confidential document
  ✔ 2. IDOR Prevention: Unauthorized Viewer (David) CANNOT view Sarah document metadata
  ✔ 3. Unauthorized Viewer CANNOT download Sarah confidential document
  ✔ 4. Sarah (Owner) grants David "read" permission
  ✔ 5. David CAN now view document metadata and download after permission granted
  ✔ 6. Read-only viewer CANNOT modify document metadata (Privilege Escalation Prevention)
  ✔ 7. Sarah revokes David access
  ✔ 8. Post-revocation: David is IMMEDIATELY blocked from accessing document
  ✔ 9. Admin can inspect system-wide audit logs with all events accounted for
✔ TrustVault Security Test Suite: Complete Isolation & Audit Guarantees (552ms)
```

---

## 3. Demo Personas (1-Click Switcher)

The application includes an interactive **Security Evaluator Bar** at the top of the interface allowing instant persona switching without manual re-login:

| Persona | Email | System Role | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Chief Compliance Admin** | `admin@trustvault.internal` | `admin` | Full visibility over system-wide audit logs and governance events. |
| **Sarah Connor** | `owner@trustvault.internal` | `owner` | Uploads files, manages document-level ACLs, grants & revokes access. |
| **David Miller** | `viewer@trustvault.internal` | `viewer` | External auditor. Strictly restricted to documents explicitly shared with him. |

---

## 4. Key Security Guarantees

* **Zero IDOR Vulnerability**: Document access control lists (ACL) are evaluated on every endpoint. Unauthorized queries return `403 Forbidden` and append a `DENIED` record to the audit trail.
* **Storage Obfuscation**: Uploaded files are renamed to cryptographically random UUIDs (`${crypto.randomUUID()}.blob`) in an isolated storage directory outside the web root. Files are never served statically.
* **Server-Side Magic Byte Validation**: Disallowed executables (`.exe`, `.bat`, `.sh`, `.php`) are rejected regardless of file extension. Magic bytes (`%PDF-`, `PNG`, `PK`) are inspected in memory buffers.
* **Append-Only Immutable Audit Trail**: All operations (`UPLOAD`, `DOWNLOAD`, `READ_METADATA`, `SHARE_PERMISSION`, `REVOKE_PERMISSION`, `DELETE`) are permanently recorded with actor identity, timestamp, IP address, and status.
* **Soft Deletion**: Deleting a document marks `is_deleted = 1`, preserving file integrity and historical audit records for regulatory compliance.

---

## 5. System Architecture

```rust
trustvault/
├── client/                     # Frontend (React 19 + Vite + Tailwind CSS v4)
│   ├── src/
│   │   ├── api/client.js       # Secure API communication client
│   │   ├── components/         # RoleSwitcher, Navbar, UploadModal, ShareModal, AuditTrailView, DocumentListView
│   │   ├── App.jsx             # Main dashboard
│   │   └── index.css           # Tailwind CSS directives
│   └── vite.config.js          # Tailwind CSS Vite integration
├── server/                     # Backend (Node.js ES Modules .js)
│   ├── package.json            # Configured with "main": "src/server.js"
│   └── src/                    # Server source code
│       ├── database/db.js      # SQLite connection & schema auto-initialization
│       ├── database/seed.js    # Seed confidential documents & audit logs
│       ├── middleware/auth.js  # JWT authentication & persona switcher middleware
│       ├── middleware/checkPermission.js # Document ACL authorization guard
│       ├── services/auditService.js # Immutable append-only audit trail logger
│       ├── services/storageService.js # UUID disk persistence & SHA-256 calculation
│       ├── services/validationService.js # Magic byte header & extension validator
│       ├── routes/             # Auth, Document, Permission, and Audit API routes
│       ├── server.js           # Express application entrypoint
│       └── vault_blobs/        # Isolated binary storage directory
├── tests/
│   └── security.test.js        # Automated security test suite
├── docs/
│   └── THREAT_MODEL.md         # Threat vectors & defensive design documentation
└── plan.md                     # Technical specification & project plan
```
