const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const MAX_BYTES = 8 * 1024 * 1024;

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }

  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

function validateImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new Error('El archivo está vacío.');
  }
  if (buf.length > MAX_BYTES) {
    throw new Error(`La imagen supera el máximo de ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`);
  }
  const type = detectImageType(buf);
  if (!type) {
    throw new Error('El archivo no es una imagen válida. Se aceptan PNG, JPG, GIF o WEBP (los SVG no se permiten).');
  }
  return { ...type, size: buf.length };
}

function saveImageBuffer(buf) {
  const { ext, mime, size } = validateImageBuffer(buf);
  ensureDir();
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(fullPath, buf);
  return { name, path: fullPath, ext, mime, size };
}

const BRANDING_DIR = path.join(__dirname, '..', 'public', 'uploads', 'branding');

function ensureBrandingDir() {
  if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

function saveBrandingImage(buf) {
  const { ext, mime, size } = validateImageBuffer(buf);
  ensureBrandingDir();
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const fullPath = path.join(BRANDING_DIR, name);
  fs.writeFileSync(fullPath, buf);
  return { name, path: fullPath, publicUrl: `/uploads/branding/${name}`, ext, mime, size };
}

module.exports = {
  UPLOAD_DIR,
  MAX_BYTES,
  detectImageType,
  validateImageBuffer,
  saveImageBuffer,
  saveBrandingImage,
};
