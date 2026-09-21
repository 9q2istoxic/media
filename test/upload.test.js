const { test } = require('node:test');
const assert = require('node:assert');
const { detectImageType, validateImageBuffer, MAX_BYTES } = require('../utils/upload');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test('detecta PNG por cabecera', () => {
  assert.deepStrictEqual(detectImageType(PNG), { ext: 'png', mime: 'image/png' });
});
test('detecta JPEG por cabecera', () => {
  assert.deepStrictEqual(detectImageType(JPG), { ext: 'jpg', mime: 'image/jpeg' });
});
test('detecta GIF por cabecera', () => {
  assert.deepStrictEqual(detectImageType(GIF), { ext: 'gif', mime: 'image/gif' });
});
test('detecta WEBP por cabecera', () => {
  assert.deepStrictEqual(detectImageType(WEBP), { ext: 'webp', mime: 'image/webp' });
});

test('rechaza un ejecutable renombrado a .png', () => {
  const exe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00', 'binary');
  assert.strictEqual(detectImageType(exe), null);
  assert.throws(() => validateImageBuffer(exe), /no es una imagen válida/);
});

test('rechaza un SVG (texto con posible script)', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.strictEqual(detectImageType(svg), null);
  assert.throws(() => validateImageBuffer(svg), /no es una imagen válida/);
});

test('rechaza HTML/JS disfrazado', () => {
  const html = Buffer.from('<!doctype html><script>fetch("/x")</script>');
  assert.throws(() => validateImageBuffer(html), /no es una imagen válida/);
});

test('rechaza buffer vacío', () => {
  assert.throws(() => validateImageBuffer(Buffer.alloc(0)), /vacío/);
});

test('rechaza imagen demasiado grande', () => {
  const big = Buffer.concat([PNG, Buffer.alloc(MAX_BYTES + 10)]);
  assert.throws(() => validateImageBuffer(big), /máximo/);
});

test('acepta un PNG válido dentro del límite', () => {
  const out = validateImageBuffer(PNG);
  assert.strictEqual(out.ext, 'png');
  assert.strictEqual(out.mime, 'image/png');
});
