# TrustVault Threat Model & Defensive Design Document

## 1. Problem Formulation
Confidential enterprise assets (salaries, client contracts, engineering schematics, regulatory compliance findings) are habitually compromised via:
1. **Broken Object-Level Authorization (BOLA / IDOR)**: Link sharing or ID tampering exposes files across boundaries.
2. **Post-Incident Forensic Amnesia**: Organizations cannot prove who opened, downloaded, or shared a document.

TrustVault treats this not as a CRUD application, but as a **zero-trust security barrier**.

---

## 2. Threat Actors & Vectors

| Threat Vector | Attack Scenario | TrustVault Countermeasure |
| :--- | :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | Malicious viewer changes URL parameter `/documents/42` to query another user's contract. | The database query verifies `documents.owner_id = user.id` OR explicit membership in `document_permissions`. If unverified, the request triggers a `DENIED` audit event and is rejected with HTTP `403 Forbidden`. |
| **Path Traversal / Local File Inclusion** | Upload named `../../etc/passwd` or `../../../boot.ini`. | Uploaded filenames are stripped of directories using `path.basename()` and sanitized. Physical files on disk are written under cryptographically random UUIDs (`${crypto.randomUUID()}.blob`) in an isolated non-public directory. |
| **MIME Sniffing & Trojan Extension Spoofing** | Executable `.exe` disguised as `.pdf`. | The server inspects initial file buffer magic bytes (`%PDF-`, PNG signatures, ZIP/DOCX headers) before writing to disk. Dangerous extensions (`.exe`, `.bat`, `.sh`, `.php`) are strictly rejected. |
| **Audit Trail Erasure / Tampering** | Rogue actor deletes a document and deletes log history. | Audit logs reside in an append-only SQLite table with zero `UPDATE` or `DELETE` endpoints. Document deletions are soft-deletes (`is_deleted = 1`), preserving history forever. |
| **Privilege Escalation** | Viewer granted read access attempts to add other collaborators or alter document metadata. | Route-level middleware enforces `requireDocumentAccess('owner')` for permission mutations and `requireDocumentAccess('edit')` for metadata updates. |

---

## 3. Cryptographic Verification & Data Flow

```rust
[ Client Upload ]
       |
       v
[ Server Buffer Memory (Multer) ]
       |
  +----+----+
  | Magic Byte & Dangerous Ext Check
  +----+----+
       |
       v
[ Crypto Hash: SHA-256 Engine ]
       |
       +---> Generates UUID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.blob
       |
       v
[ Writes to server/vault_blobs/ (Outside Web Root) ]
       |
       v
[ SQL Metadata Insertion (Document + Append-Only Audit Event) ]
```

---

## 4. Architectural Trade-offs & Deliberate Decisions
* **SQLite with WAL mode**: Selected for portability, zero-dependency local evaluation, relational ACL enforcement, and ACID-compliant concurrent write transactions.
* **UUID Storage Decoupling**: Eliminates filesystem metadata leaks and prevents OS-level filename collision or exploitation.
* **Stream-Only Delivery**: Files are never served via public static URLs. Every download is a live, authorized HTTP stream.
