const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'tickets.json');

function cleanup() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  delete require.cache[require.resolve('../utils/tickets')];
}

test('REGRESIÓN: un tickets.json antiguo (sin closed/ratings/ratingMessages) ya no revienta', () => {
  cleanup();

  fs.writeFileSync(DB_PATH, JSON.stringify({ byChannel: {}, byUser: {} }));
  const t = require('../utils/tickets');
  assert.doesNotThrow(() => t.saveClosedSnapshot('c1', { closedBy: 's1' }));
  assert.doesNotThrow(() => t.markRated('u1', 'c1'));
  assert.doesNotThrow(() => t.setPendingRating('u1', { stars: 5, ticketId: 'c1' }));
  assert.doesNotThrow(() => t.setRatingMessageRef('u1', 'c1', { channelId: 'x', messageId: 'y' }));
  cleanup();
});

test('saveClosedSnapshot / getClosedSnapshot sobreviven a removeTicket', () => {
  cleanup();
  const t = require('../utils/tickets');
  t.createTicket({ channelId: 'c1', userId: 'u1', category: 'general', answers: {} });
  t.saveClosedSnapshot('c1', { closedBy: 's1', claimedBy: 's1', createdAt: 1, closedAt: 2, userId: 'u1' });
  t.removeTicket('c1');
  assert.strictEqual(t.getTicket('c1'), null);
  assert.deepStrictEqual(t.getClosedSnapshot('c1'), { closedBy: 's1', claimedBy: 's1', createdAt: 1, closedAt: 2, userId: 'u1' });
  cleanup();
});

test('hasRated / markRated evita valorar dos veces', () => {
  cleanup();
  const t = require('../utils/tickets');
  assert.strictEqual(t.hasRated('u1', 'c1'), false);
  t.markRated('u1', 'c1');
  assert.strictEqual(t.hasRated('u1', 'c1'), true);

  assert.strictEqual(t.hasRated('u1', 'c2'), false);
  assert.strictEqual(t.hasRated('u2', 'c1'), false);
  cleanup();
});

test('setPendingRating / getPendingRating / clearPendingRating', () => {
  cleanup();
  const t = require('../utils/tickets');
  assert.strictEqual(t.getPendingRating('u1'), null);
  t.setPendingRating('u1', { stars: 5, ticketId: 'c1' });
  assert.deepStrictEqual(t.getPendingRating('u1'), { stars: 5, ticketId: 'c1' });
  t.clearPendingRating('u1');
  assert.strictEqual(t.getPendingRating('u1'), null);
  cleanup();
});

test('setRatingMessageRef / getRatingMessageRef / clearRatingMessageRef', () => {
  cleanup();
  const t = require('../utils/tickets');
  t.setRatingMessageRef('u1', 'c1', { channelId: 'dm1', messageId: 'm1' });
  assert.deepStrictEqual(t.getRatingMessageRef('u1', 'c1'), { channelId: 'dm1', messageId: 'm1' });
  t.clearRatingMessageRef('u1', 'c1');
  assert.strictEqual(t.getRatingMessageRef('u1', 'c1'), null);
  cleanup();
});
