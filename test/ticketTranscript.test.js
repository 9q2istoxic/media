const { test } = require('node:test');
const assert = require('node:assert');
const { formatContent, emojiToTwemojiUrl } = require('../utils/ticketTranscript');

test('formatContent escapa HTML peligroso', () => {
  const out = formatContent('<script>alert(1)</script>', {});
  assert.ok(!out.includes('<script>'));
  assert.match(out, /&lt;script&gt;/);
});

test('formatContent convierte negrita y código en línea', () => {
  assert.strictEqual(formatContent('**hola**', {}), '<discord-bold>hola</discord-bold>');
  assert.strictEqual(formatContent('`codigo`', {}), '<discord-inline-code>codigo</discord-inline-code>');
});

test('formatContent convierte menciones de usuario usando el contexto', () => {
  const ctx = { userNames: { '123': 'Salmoon' } };
  const out = formatContent('hola <@123>', ctx);
  assert.match(out, /<discord-mention type="user">Salmoon<\/discord-mention>/);
});

test('formatContent convierte menciones de rol con color', () => {
  const ctx = { roles: { '55': { name: 'Staff', color: '#f6ff6b' } } };
  const out = formatContent('<@&55>', ctx);
  assert.match(out, /<discord-mention type="role" color="#f6ff6b">Staff<\/discord-mention>/);
});

test('formatContent convierte emoji personalizado de Discord', () => {
  const out = formatContent('<:pepe:123456789>', {});
  assert.match(out, /<discord-custom-emoji name="pepe" url="https:\/\/cdn\.discordapp\.com\/emojis\/123456789\.webp">/);
});

test('formatContent convierte emoji unicode simple a twemoji', () => {
  const out = formatContent('hola 🔑', {});
  assert.match(out, /<discord-custom-emoji name="🔑" url="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/twemoji\/14\.0\.2\/svg\/1f511\.svg"/);
});

test('emojiToTwemojiUrl calcula el codepoint hexadecimal correcto', () => {
  assert.strictEqual(emojiToTwemojiUrl('⚠️'), 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/26a0-fe0f.svg');
});
