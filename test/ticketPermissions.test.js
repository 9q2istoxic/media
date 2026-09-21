const { test } = require('node:test');
const assert = require('node:assert');
const { isTicketStaff, isMediaManagerMember, slugify } = require('../utils/ticketHandlers');

const config = require('../config.json');

function fakeMember({ roleIds = [], isAdmin = false }) {
  return {
    permissions: { has: () => isAdmin },
    roles: { cache: { has: (id) => roleIds.includes(id) } },
  };
}

test('isMediaManagerMember: admin de Discord siempre pasa', () => {
  assert.strictEqual(isMediaManagerMember(fakeMember({ isAdmin: true })), true);
});

test('isMediaManagerMember: con el rol de Media Manager pasa', () => {
  assert.strictEqual(isMediaManagerMember(fakeMember({ roleIds: [config.mediaManagerRoleId] })), true);
});

test('isMediaManagerMember: con el rol de Asistente+ NO pasa (solo Media Manager por ahora)', () => {
  assert.strictEqual(isMediaManagerMember(fakeMember({ roleIds: [config.staffAssistantRoleId] })), false);
});

test('isMediaManagerMember: sin ningún rol relevante no pasa', () => {
  assert.strictEqual(isMediaManagerMember(fakeMember({ roleIds: ['999999'] })), false);
});

test('isMediaManagerMember: sin member (null) no pasa', () => {
  assert.strictEqual(isMediaManagerMember(null), false);
});

test('isTicketStaff: Asistente+ SÍ puede reclamar/cerrar tickets', () => {
  assert.strictEqual(isTicketStaff(fakeMember({ roleIds: [config.staffAssistantRoleId] })), true);
});

test('isTicketStaff: sin rol relevante no puede', () => {
  assert.strictEqual(isTicketStaff(fakeMember({ roleIds: [] })), false);
});

test('slugify: minúsculas, sin acentos, solo a-z0-9-', () => {
  assert.strictEqual(slugify('Mxrico_'), 'mxrico');
  assert.strictEqual(slugify('José Pérez'), 'joseperez');
  assert.strictEqual(slugify('Media Manager'), 'mediamanager');
});

test('slugify: vacío o solo símbolos cae en "staff"', () => {
  assert.strictEqual(slugify(''), 'staff');
  assert.strictEqual(slugify('!!!'), 'staff');
  assert.strictEqual(slugify(null), 'staff');
});

test('slugify: recorta a 20 caracteres', () => {
  const out = slugify('un-nombre-de-usuario-muy-muy-largo');
  assert.ok(out.length <= 20);
});
