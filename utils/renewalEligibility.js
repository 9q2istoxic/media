
function computeRenewalEligibility(applications, subscriptions, discordId) {
  const lastAccepted = applications.find((a) => a.status === 'accepted');
  if (!lastAccepted) return { canRenew: false, roleExpiresAt: null };

  const activeSub = subscriptions.find(
    (s) => s.sourceApplicationId === lastAccepted.id && s.discordUserId === discordId && s.expiresAt > Date.now()
  );

  if (activeSub) return { canRenew: false, roleExpiresAt: activeSub.expiresAt };
  return { canRenew: true, roleExpiresAt: null };
}

module.exports = { computeRenewalEligibility };
