import path from 'path';

/**
 * Validates file buffer magic bytes against accepted types with strict extension matching.
 */
export function validateFileContent(buffer, declaredMimeType, originalName) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'File is empty' };
  }

  const ext = path.extname(originalName).toLowerCase();
  const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.dll', '.vbs', '.js', '.py', '.msi', '.bin'];
  if (dangerousExts.includes(ext)) {
    return { valid: false, reason: `Disallowed dangerous file extension: ${ext}` };
  }

  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.pptx', '.zip', '.txt', '.csv', '.md', '.log'];
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      reason: `Unsupported file type: ${ext}. TrustVault only accepts verified enterprise documents (.pdf, .docx, .png, .jpg, .txt, .csv).`,
    };
  }

  const header = buffer.subarray(0, 8);

  // 1. Strict PDF verification
  if (ext === '.pdf') {
    // PDF must start with %PDF (0x25 0x50 0x44 0x46)
    const magic = buffer.subarray(0, 4).toString('ascii');
    if (magic !== '%PDF') {
      return {
        valid: false,
        reason: 'Security Rejection: File has a .pdf extension but lacks valid %PDF header magic bytes (detected spoofed/disguised script).',
      };
    }
    return { valid: true, detectedMime: 'application/pdf', category: 'Contract / Document' };
  }

  // 2. Strict PNG verification
  if (ext === '.png') {
    // 89 50 4E 47 0D 0A 1A 0A
    if (header[0] !== 0x89 || header[1] !== 0x50 || header[2] !== 0x4E || header[3] !== 0x47) {
      return {
        valid: false,
        reason: 'Security Rejection: File has a .png extension but lacks valid PNG signature bytes.',
      };
    }
    return { valid: true, detectedMime: 'image/png', category: 'Drawing / Image' };
  }

  // 3. Strict JPEG verification
  if (ext === '.jpg' || ext === '.jpeg') {
    // FF D8 FF
    if (header[0] !== 0xFF || header[1] !== 0xD8 || header[2] !== 0xFF) {
      return {
        valid: false,
        reason: 'Security Rejection: File has a .jpg/.jpeg extension but lacks valid JPEG header bytes.',
      };
    }
    return { valid: true, detectedMime: 'image/jpeg', category: 'Drawing / Image' };
  }

  // 4. Strict Office / ZIP verification
  if (['.docx', '.xlsx', '.pptx', '.zip'].includes(ext)) {
    // PK header (50 4B 03 04 or 50 4B)
    if (header[0] !== 0x50 || header[1] !== 0x4B) {
      return {
        valid: false,
        reason: `Security Rejection: File has a ${ext} extension but lacks valid PK archive header bytes.`,
      };
    }
    return { valid: true, detectedMime: declaredMimeType || 'application/zip', category: 'Archive / Office Doc' };
  }

  // 5. Strict Text verification (.txt, .csv, .md, .log)
  if (['.txt', '.csv', '.md', '.log'].includes(ext)) {
    const inspectLength = Math.min(buffer.length, 512);
    for (let i = 0; i < inspectLength; i++) {
      const byte = buffer[i];
      if (byte === 0 || (byte < 7 && byte !== 9 && byte !== 10 && byte !== 13)) {
        return {
          valid: false,
          reason: 'Security Rejection: File contains binary control codes or null bytes.',
        };
      }
    }
    return { valid: true, detectedMime: 'text/plain', category: 'Text Document' };
  }

  return { valid: false, reason: 'Unrecognized file format' };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename) {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._\- ]/g, '_');
}
