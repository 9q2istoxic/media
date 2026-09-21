const fs = require('fs');
const path = require('path');

function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[storage] Error leyendo ${filePath}, se usa valor por defecto:`, err.message);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = { readJSON, writeJSON };
