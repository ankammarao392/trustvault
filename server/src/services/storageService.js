import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely resolve vault blobs directory with graceful fallback if permission denied
function resolveVaultDir() {
  if (process.env.DATA_DIR) {
    try {
      const target = path.join(process.env.DATA_DIR, 'vault_blobs');
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
      fs.accessSync(target, fs.constants.W_OK);
      return target;
    } catch (err) {
      console.warn(`[TrustVault Warning] DATA_DIR/vault_blobs is not accessible (${err.message}). Falling back to local storage.`);
    }
  }

  const localTarget = path.join(__dirname, '..', 'vault_blobs');
  if (!fs.existsSync(localTarget)) {
    fs.mkdirSync(localTarget, { recursive: true });
  }
  return localTarget;
}

const VAULT_DIR = resolveVaultDir();

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
