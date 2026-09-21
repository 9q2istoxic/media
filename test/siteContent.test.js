const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'siteContent.json');

function cleanup() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  delete require.cache[require.resolve('../utils/siteContent')];
}

test('getSiteContent devuelve los valores por defecto la primera vez', () => {
  cleanup();
  const { getSiteContent, DEFAULTS } = require('../utils/siteContent');
  const content = getSiteContent();
  assert.strictEqual(content.hero.title, DEFAULTS.hero.title);
  assert.strictEqual(content.requisitos.length, 3);
  assert.strictEqual(content.requisitos[0].rango, 'Media');
  cleanup();
});

test('updateSiteContent fusiona sin perder el resto de secciones', () => {
  cleanup();
  const { getSiteContent, updateSiteContent } = require('../utils/siteContent');
  getSiteContent();
  const updated = updateSiteContent({ footerCredit: 'Nuevo crédito' });
  assert.strictEqual(updated.footerCredit, 'Nuevo crédito');
  assert.ok(updated.hero.title);
  assert.strictEqual(updated.requisitos.length, 3);
  cleanup();
});

test('updateSiteContent puede reemplazar los requisitos por completo', () => {
  cleanup();
  const { getSiteContent, updateSiteContent } = require('../utils/siteContent');
  getSiteContent();
  const updated = updateSiteContent({ requisitos: [{ rango: 'X', minimo: '1', ademas: '2' }] });
  assert.strictEqual(updated.requisitos.length, 1);
  assert.strictEqual(updated.requisitos[0].rango, 'X');
  cleanup();
});
