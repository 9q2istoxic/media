const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'tickets.json');

function load() {
  const db = readJSON(DB_PATH, { byChannel: {}, byUser: {}, closed: {}, ratings: {}, ratingMessages: {} });

  db.byChannel ||= {};
  db.byUser ||= {};
  db.closed ||= {};
  db.ratings ||= {};
  db.ratingMessages ||= {};
  return db;
}
function save(db) {
  writeJSON(DB_PATH, db);
}

function getOpenTicketChannelId(userId) {
  return load().byUser[userId] || null;
}

function createTicket({ channelId, userId, category, answers }) {
  const db = load();
  db.byChannel[channelId] = {
    channelId, userId, category, answers,
    claimedBy: null, closedBy: null,
    createdAt: Date.now(),
  };
  db.byUser[userId] = channelId;
  save(db);
  return db.byChannel[channelId];
}

function getTicket(channelId) {
  return load().byChannel[channelId] || null;
}

function updateTicket(channelId, patch) {
  const db = load();
  const ticket = db.byChannel[channelId];
  if (!ticket) return null;
  Object.assign(ticket, patch);
  save(db);
  return ticket;
}

function removeTicket(channelId) {
  const db = load();
  const ticket = db.byChannel[channelId];
  if (ticket) {
    delete db.byUser[ticket.userId];
    delete db.byChannel[channelId];
    save(db);
  }
}

function saveClosedSnapshot(ticketId, data) {
  const db = load();
  db.closed[ticketId] = data;
  save(db);
}

function getClosedSnapshot(ticketId) {
  return load().closed[ticketId] || null;
}

function hasRated(userId, ticketId) {
  return !!load().ratings[`${userId}_${ticketId}`];
}

function markRated(userId, ticketId) {
  const db = load();
  db.ratings[`${userId}_${ticketId}`] = true;
  save(db);
}

function setPendingRating(userId, data) {
  const db = load();
  db.ratingMessages[`pending_${userId}`] = data;
  save(db);
}
function getPendingRating(userId) {
  return load().ratingMessages[`pending_${userId}`] || null;
}
function clearPendingRating(userId) {
  const db = load();
  delete db.ratingMessages[`pending_${userId}`];
  save(db);
}

function setRatingMessageRef(userId, ticketId, ref) {
  const db = load();
  db.ratingMessages[`msg_${userId}_${ticketId}`] = ref;
  save(db);
}
function getRatingMessageRef(userId, ticketId) {
  return load().ratingMessages[`msg_${userId}_${ticketId}`] || null;
}
function clearRatingMessageRef(userId, ticketId) {
  const db = load();
  delete db.ratingMessages[`msg_${userId}_${ticketId}`];
  save(db);
}

module.exports = {
  getOpenTicketChannelId, createTicket, getTicket, updateTicket, removeTicket,
  saveClosedSnapshot, getClosedSnapshot,
  hasRated, markRated,
  setPendingRating, getPendingRating, clearPendingRating,
  setRatingMessageRef, getRatingMessageRef, clearRatingMessageRef,
};
