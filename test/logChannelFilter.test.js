const { test } = require('node:test');
const assert = require('node:assert');
const { isTicketRelatedChannel, isTicketChannelByAttrs } = require('../utils/logEventHandlers');
const config = require('../config.json');

test('isTicketRelatedChannel: true si el canal está en la categoría de tickets', () => {
  const entry = { target: { name: 'algo-raro', parentId: config.tickets.categoryId } };
  assert.strictEqual(isTicketRelatedChannel(entry), true);
});

test('isTicketRelatedChannel: true por nombre ticket-/ver-/media-apply- aunque falte parentId', () => {
  assert.strictEqual(isTicketRelatedChannel({ target: { name: 'ticket-pendiente' } }), true);
  assert.strictEqual(isTicketRelatedChannel({ target: { name: 'ver-mediamanager' } }), true);
  assert.strictEqual(isTicketRelatedChannel({ target: { name: 'media-apply-alguien' } }), true);
});

test('isTicketRelatedChannel: false para un canal normal del servidor', () => {
  const entry = { target: { name: 'general', parentId: '999999999999999999' } };
  assert.strictEqual(isTicketRelatedChannel(entry), false);
});

test('isTicketChannelByAttrs: reconoce un canal de ticket por categoría o por nombre', () => {
  assert.strictEqual(isTicketChannelByAttrs(config.tickets.categoryId, 'algo-raro'), true);
  assert.strictEqual(isTicketChannelByAttrs(null, 'ticket-pendiente'), true);
  assert.strictEqual(isTicketChannelByAttrs(null, 'ver-mediamanager'), true);
  assert.strictEqual(isTicketChannelByAttrs('999999999999999999', 'general'), false);
});
