import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.join(__dirname, '..', 'vault_blobs');

// Ensure vault directory exists
if (!fs.existsSync(VAULT_DIR)) {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
}

/**
 * Persists an uploaded file buffer into secure storage and returns metadata
 */
export async function saveBlob(buffer) {
  const storedFilename = `${crypto.randomUUID()}.blob`;
  const fullPath = path.join(VAULT_DIR, storedFilename);

  // Compute SHA-256 hash
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Write file to isolated disk volume
  fs.writeFileSync(fullPath, buffer);

  return {
    storedFilename,
    sha256Hash: hash,
    fileSizeBytes: buffer.length,
  };
}

/**
 * Returns read stream for a stored blob
 */
export function getBlobReadStream(storedFilename) {
  const fullPath = path.join(VAULT_DIR, storedFilename);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Blob not found on storage volume');
  }
  return fs.createReadStream(fullPath);
}

/**
 * Delete blob from storage volume
 */
export function deleteBlob(storedFilename) {
  const fullPath = path.join(VAULT_DIR, storedFilename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.error('[StorageService] Error deleting blob:', err);
    }
  }
}
