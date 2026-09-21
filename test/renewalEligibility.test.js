const { test } = require('node:test');
const assert = require('node:assert');
const { computeRenewalEligibility } = require('../utils/renewalEligibility');

test('sin ninguna solicitud aceptada: no se puede renovar', () => {
  const result = computeRenewalEligibility([{ id: 'a1', status: 'pending' }], [], 'u1');
  assert.deepStrictEqual(result, { canRenew: false, roleExpiresAt: null });
});

test('aceptada + suscripción activa: no se puede renovar todavía, y devuelve cuándo vence', () => {
  const expiresAt = Date.now() + 5 * 24 * 60 * 60 * 1000;
  const apps = [{ id: 'a1', status: 'accepted' }];
  const subs = [{ sourceApplicationId: 'a1', discordUserId: 'u1', expiresAt }];
  assert.deepStrictEqual(computeRenewalEligibility(apps, subs, 'u1'), { canRenew: false, roleExpiresAt: expiresAt });
});

test('aceptada pero sin suscripción activa (ya expiró y se purgó): sí se puede renovar', () => {
  const apps = [{ id: 'a1', status: 'accepted' }];
  assert.deepStrictEqual(computeRenewalEligibility(apps, [], 'u1'), { canRenew: true, roleExpiresAt: null });
});

test('aceptada con una suscripción de OTRO usuario (mismo id de app no debería pasar, pero por si acaso): no cuenta', () => {
  const apps = [{ id: 'a1', status: 'accepted' }];
  const subs = [{ sourceApplicationId: 'a1', discordUserId: 'otro-usuario', expiresAt: Date.now() + 999999 }];
  assert.deepStrictEqual(computeRenewalEligibility(apps, subs, 'u1'), { canRenew: true, roleExpiresAt: null });
});

test('aceptada con una suscripción YA vencida en el registro (expiresAt en el pasado): sí se puede renovar', () => {
  const apps = [{ id: 'a1', status: 'accepted' }];
  const subs = [{ sourceApplicationId: 'a1', discordUserId: 'u1', expiresAt: Date.now() - 1000 }];
  assert.deepStrictEqual(computeRenewalEligibility(apps, subs, 'u1'), { canRenew: true, roleExpiresAt: null });
});

test('toma la solicitud aceptada más reciente (primera del array) si hay varias', () => {
  const apps = [
    { id: 'a2', status: 'accepted' },
    { id: 'a1', status: 'accepted' },
  ];
  const subs = [{ sourceApplicationId: 'a1', discordUserId: 'u1', expiresAt: Date.now() + 999999 }];

  assert.deepStrictEqual(computeRenewalEligibility(apps, subs, 'u1'), { canRenew: true, roleExpiresAt: null });
});
