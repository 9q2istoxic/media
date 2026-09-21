const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'subscriptions.json');
const DURATION_MS = 14 * 24 * 60 * 60 * 1000;

function load() {
  return readJSON(DB_PATH, { subscriptions: [] });
}

function save(db) {
  writeJSON(DB_PATH, db);
}

function listAll() {
  return load().subscriptions;
}

function findDuplicate(db, platform, externalId) {
  return db.subscriptions.find(
    (s) => s.platform === platform && s.externalId.toLowerCase() === externalId.toLowerCase()
  );
}

function addSubscription({ platform, externalId, displayName, discordChannelId, discordUserId, roleKey, assignedRoleId, guildId, sourceApplicationId = null }) {
  const db = load();
  const now = Date.now();
  const existing = findDuplicate(db, platform, externalId);

  if (existing) {
    existing.discordChannelId = discordChannelId;
    existing.discordUserId = discordUserId;
    existing.roleKey = roleKey;
    existing.assignedRoleId = assignedRoleId;
    existing.guildId = guildId;
    existing.sourceApplicationId = sourceApplicationId;
    existing.addedAt = now;
    existing.expiresAt = now + DURATION_MS;
    existing.warn3dSentAt = null;
    existing.warn1dSentAt = null;
    save(db);
    return { subscription: existing, renewed: true };
  }

  const subscription = {
    id: `${platform}_${externalId}_${now}`,
    platform,
    externalId,
    displayName: displayName || externalId,
    discordChannelId,
    discordUserId,
    roleKey,
    assignedRoleId,
    guildId,
    sourceApplicationId,
    addedAt: now,
    expiresAt: now + DURATION_MS,
    baselineNeeded: true,
    warn3dSentAt: null,
    warn1dSentAt: null,
    lastVideoId: null,
    lastLiveVideoId: null,
    isLiveTwitch: false,
    lastTwitchStreamId: null,
    lastTiktokVideoId: null,
    isLiveTiktok: false,
    lastTiktokRoomId: null,
    isLiveKick: false,
    lastKickStreamId: null,
  };

  db.subscriptions.push(subscription);
  save(db);
  return { subscription, renewed: false };
}

function removeSubscription(platform, externalId) {
  const db = load();
  const before = db.subscriptions.length;
  db.subscriptions = db.subscriptions.filter(
    (s) => !(s.platform === platform && s.externalId.toLowerCase() === externalId.toLowerCase())
  );
  save(db);
  return db.subscriptions.length < before;
}

function purgeExpired() {
  const db = load();
  const now = Date.now();
  const expired = db.subscriptions.filter((s) => s.expiresAt <= now);
  if (expired.length > 0) {
    db.subscriptions = db.subscriptions.filter((s) => s.expiresAt > now);
    save(db);
  }
  return expired;
}

function updateSubscription(id, patch) {
  const db = load();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) return null;
  Object.assign(sub, patch);
  save(db);
  return sub;
}

module.exports = {
  DURATION_MS,
  listAll,
  addSubscription,
  removeSubscription,
  purgeExpired,
  updateSubscription,
};
