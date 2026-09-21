require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js');

const { startChecker } = require('./utils/checker');
const { getConfig } = require('./utils/config');
const { createApplication, getApplication, getPendingApplicationByDiscordId, getApplicationsByDiscordId, updateApplication, listAll: listAllApplications } = require('./utils/applications');
const accounts = require('./utils/accounts');
const { addSubscription, listAll: listAllSubscriptions, DURATION_MS: SUBSCRIPTION_DURATION_MS } = require('./utils/subscriptions');
const { computeRenewalEligibility } = require('./utils/renewalEligibility');
const { isBlacklisted, isIpBlacklisted } = require('./utils/blacklist');
const { checkIp } = require('./utils/antivpn');
const { verifyTurnstileToken, isTurnstileEnabled } = require('./utils/turnstile');
const { resolveChannel } = require('./utils/youtube');
const { resolveUser: resolveTwitchUser } = require('./utils/twitch');
const { resolveUser: resolveTiktokUser } = require('./utils/tiktok');
const { resolveUser: resolveKickUser } = require('./utils/kick');
const {
  logApplicationAccepted,
  logApplicationRejected,
  logSubscriptionAdded,
  logRoleAssigned,
} = require('./utils/logger');

const oauth = require('./utils/oauth');
const settingsLogs = require('./commands/settings-logs');
const ticketPanel = require('./commands/ticket-panel');
const ticketHandlers = require('./utils/ticketHandlers');
const { registerLogHandlers } = require('./utils/logEventHandlers');
const session = require('./utils/session');
const { saveImageBuffer, saveBrandingImage, MAX_BYTES } = require('./utils/upload');
const { getSiteContent, updateSiteContent } = require('./utils/siteContent');
const { createRateLimiter } = require('./utils/rateLimit');
const { checkMinecraftUsername } = require('./utils/mojang');
const { verifyPlatformLink } = require('./utils/platformVerify');
const { detectPlatformFromUrl, extractPlatformInput } = require('./utils/urlHelpers');

const RANKS = ['Media', 'Twitch', 'Famous'];
const PLATFORMS = ['YouTube', 'TikTok', 'Twitch', 'Kick'];
const RANK_ALLOWED_PLATFORMS = {
  Media: ['YouTube', 'TikTok', 'Twitch', 'Kick'],
  Twitch: ['Twitch', 'Kick'],
  Famous: ['YouTube', 'TikTok', 'Twitch', 'Kick'],
};

const PORT = Number(process.env.PORT || 30043);
const HOST = process.env.HOST || '0.0.0.0';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const APPLICATIONS_CHANNEL_ID = process.env.APPLICATIONS_CHANNEL_ID;
const REVIEW_STAFF_ROLE_ID = process.env.REVIEW_STAFF_ROLE_ID || process.env.STAFF_ROLE_ID;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

const app = express();

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com', 'https://dunb17ur4ymx4.cloudfront.net'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
        formAction: ["'self'", 'https://discord.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],

        upgradeInsecureRequests: null,
      },
    },
    hsts: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session.attachUser);

const PUBLIC_DIR = path.join(__dirname, 'public');
let assetVersionCache = { mtime: 0, versions: {} };

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 10);
}

function getAssetVersions() {
  const files = ['styles.css', 'app.js', 'account.js', 'admin.js'];
  const paths = files.map((f) => path.join(PUBLIC_DIR, f));
  const mtime = Math.max(...paths.map((p) => fs.statSync(p).mtimeMs));
  if (assetVersionCache.mtime !== mtime) {
    const versions = {};
    files.forEach((f, i) => { versions[f] = fileHash(paths[i]); });
    assetVersionCache = { mtime, versions };
  }
  return assetVersionCache.versions;
}

function renderPage(htmlFile, jsFile) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, htmlFile), 'utf8');
  const v = getAssetVersions();
  return html
    .replace('href="/styles.css"', `href="/styles.css?v=${v['styles.css']}"`)
    .replace(`src="/${jsFile}"`, `src="/${jsFile}?v=${v[jsFile]}"`);
}

app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderPage('index.html', 'app.js'));
});

app.get('/account/:discordId', (req, res) => {
  if (!req.user) return res.redirect('/?login=requerido');
  if (String(req.user.id) !== String(req.params.discordId)) {
    return res.redirect(`/account/${req.user.id}`);
  }
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderPage('account.html', 'account.js'));
});

app.use(express.static(PUBLIC_DIR, { index: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 12 },
  fileFilter(req, file, cb) {

    if (/^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes PNG, JPG, GIF o WEBP.'));
  },
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online', baseUrl: BASE_URL, oauth: oauth.isConfigured() });
});

app.get('/api/turnstile-sitekey', (req, res) => {
  res.json({ siteKey: isTurnstileEnabled() ? process.env.TURNSTILE_SITE_KEY : null });
});

const turnstileLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyFn: (req) => req.ip,
  message: 'Demasiados intentos. Espera un poco.',
});

app.post('/api/turnstile-verify', turnstileLimiter, async (req, res) => {
  const ok = await verifyTurnstileToken(req.body?.token, req.ip);
  if (!ok) return res.status(400).json({ ok: false });
  session.setTurnstileVerified(res);
  res.json({ ok: true });
});

app.get('/auth/discord', (req, res) => {
  if (!oauth.isConfigured()) {
    return res.status(503).send('El inicio de sesión con Discord no está configurado todavía.');
  }
  if (isTurnstileEnabled() && !session.hasTurnstileVerified(req)) {
    return res.redirect('/?turnstile=requerido');
  }
  const state = crypto.randomBytes(16).toString('hex');
  session.setOAuthState(res, state);
  res.redirect(oauth.buildAuthorizeUrl(state));
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect('/?login=cancelado');

    const expected = session.takeOAuthState(req, res);
    if (!code || !state || !expected || state !== expected) {
      return res.redirect('/?login=expirado');
    }

    const token = await oauth.exchangeCode(String(code));
    const user = await oauth.fetchUser(token.access_token);
    accounts.upsertAccount(user);
    session.setSession(res, user);
    res.redirect(`/account/${user.id}`);
  } catch (err) {
    console.error('[oauth callback]', err.message);
    res.redirect('/?login=error');
  }
});

app.post('/auth/logout', (req, res) => {
  session.clearSession(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null, oauth: oauth.isConfigured() });
});

app.get('/api/account', session.requireUser, async (req, res) => {
  const discordId = String(req.user.id);
  const account = accounts.getAccount(discordId);
  const applications = getApplicationsByDiscordId(discordId).map((a) => ({
    id: a.id,
    rank: a.rank,
    platform: a.platform,
    status: a.status,
    createdAt: a.createdAt,
    reviewedAt: a.reviewedAt,
    reason: a.reason,
    channelUrl: a.channelUrl,
  }));
  const staff = await getStaffLevel(discordId);
  const lastAccepted = applications.find((a) => a.status === 'accepted') || null;
  const { canRenew, roleExpiresAt } = computeRenewalEligibility(applications, listAllSubscriptions(), discordId);

  res.json({
    user: req.user,
    account,
    applications,
    latest: applications[0] || null,
    hasPending: applications.some((a) => a.status === 'pending'),
    canRenew,
    roleExpiresAt,
    currentRank: lastAccepted?.rank || null,
    currentPlatform: lastAccepted?.platform || null,
    subscriptionDurationMs: SUBSCRIPTION_DURATION_MS,
    staff,
  });
});

async function requireStaff(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  const staff = await getStaffLevel(String(req.user.id));
  if (!staff.isStaff) return res.status(403).json({ error: 'No tienes permisos de staff.' });
  req.staff = staff;
  next();
}

app.get('/api/admin/applications', session.requireUser, requireStaff, (req, res) => {

  const all = [...listAllApplications()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const list = req.query.all ? all : all.filter((a) => a.status === 'pending');
  res.json({
    staff: req.staff,
    applications: list.map((a) => ({
      id: a.id, discordId: a.discordId, discordUsername: a.discordUsername,
      ign: a.ign, rank: a.rank, platform: a.platform, channelUrl: a.channelUrl,
      comment: a.comment, status: a.status, createdAt: a.createdAt,
      reviewedAt: a.reviewedAt, reviewedBy: a.reviewedBy, reason: a.reason,
      mcVerified: a.mcVerified, platformVerified: a.platformVerified,
    })),
  });
});

app.post('/api/admin/applications/:id/accept', session.requireUser, requireStaff, async (req, res) => {
  const result = await acceptApplication(req.params.id, { id: String(req.user.id) });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, message: result.message });
});

app.post('/api/admin/applications/:id/reject', session.requireUser, requireStaff, async (req, res) => {
  const reason = sanitize(req.body?.reason, 500);
  const result = await rejectApplication(req.params.id, { id: String(req.user.id) }, reason);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, message: result.message });
});

app.get('/admin', async (req, res) => {
  if (!req.user) return res.redirect('/?login=requerido');
  const staff = await getStaffLevel(String(req.user.id));
  if (!staff.isStaff) return res.redirect(`/account/${req.user.id}`);
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderPage('admin.html', 'admin.js'));
});

app.get('/api/content', (req, res) => {
  res.json(getSiteContent());
});

async function requireMediaManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  const staff = await getStaffLevel(String(req.user.id));
  if (!staff.isMediaManager) return res.status(403).json({ error: 'Solo Media Manager puede editar la web.' });
  next();
}

function sanitizeContentPatch(body) {
  const patch = {};
  if (body.hero && typeof body.hero === 'object') {
    patch.hero = {
      eyebrow: sanitize(body.hero.eyebrow, 120),
      title: sanitize(body.hero.title, 200),
      lead: sanitize(body.hero.lead, 500),
    };
  }
  if (Array.isArray(body.requisitos)) {
    patch.requisitos = body.requisitos.slice(0, 12).map((r) => ({
      rango: sanitize(r?.rango, 40),
      minimo: sanitize(r?.minimo, 80),
      ademas: sanitize(r?.ademas, 160),
    })).filter((r) => r.rango);
  }
  if (Array.isArray(body.faq)) {
    patch.faq = body.faq.slice(0, 20).map((f) => ({
      q: sanitize(f?.q, 200),
      a: sanitize(f?.a, 1000),
    })).filter((f) => f.q && f.a);
  }
  if (typeof body.footerCredit === 'string') patch.footerCredit = sanitize(body.footerCredit, 100);
  return patch;
}

app.post('/api/admin/content', session.requireUser, requireMediaManager, (req, res) => {
  const patch = sanitizeContentPatch(req.body || {});
  const updated = updateSiteContent(patch);
  res.json({ ok: true, content: updated });
});

const brandingUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

app.post('/api/admin/content/:asset(logo|favicon)', session.requireUser, requireMediaManager, (req, res) => {
  brandingUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'No se pudo subir el archivo.' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'Falta el archivo.' });
    try {
      const saved = saveBrandingImage(req.file.buffer);
      const key = req.params.asset === 'logo' ? 'logoUrl' : 'faviconUrl';
      const updated = updateSiteContent({ [key]: saved.publicUrl });
      res.json({ ok: true, url: saved.publicUrl, content: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
});

function sanitize(value, max = 1800) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeUrl(url) {
  const clean = sanitize(url, 300);
  if (!clean) return '';
  try {
    const u = new URL(clean);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return clean;
  } catch {
    return '';
  }
}

function rankLabel(value) {
  const ranks = { media: 'Media', twitch: 'Twitch', famous: 'Famous' };
  return ranks[String(value || '').toLowerCase()] || sanitize(value, 60) || '-';
}

function platformLabel(value) {
  const platforms = { youtube: 'YouTube', tiktok: 'TikTok', twitch: 'Twitch', kick: 'Kick' };
  return platforms[String(value || '').toLowerCase()] || sanitize(value, 60) || '-';
}

function roleKeyFromRank(value) {
  const map = { media: 'MEDIA', twitch: 'TWITCH', famous: 'FAMOUS' };
  return map[String(value || '').toLowerCase()] || null;
}

function roleKeyFromPlatform(value) {
  const map = { youtube: 'YOUTUBE', tiktok: 'TIKTOK', twitch: 'TWITCH', kick: 'KICK' };
  return map[String(value || '').toLowerCase()] || null;
}

function buildApplicationEmbed(application, { status, reviewerId, reason, imageRef } = {}) {
  const finalStatus = status || application.status;
  const color = finalStatus === 'accepted' ? 0x6fbf5b : finalStatus === 'rejected' ? 0xe0567b : 0xf2a43a;
  const statusText = finalStatus === 'pending' ? 'Pendiente' : finalStatus === 'accepted' ? 'Aceptada' : 'Rechazada';
  const createdAt = application.createdAt ? new Date(application.createdAt) : new Date();

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Solicitud · ${application.id}`)
    .setDescription(`**Estado:** ${statusText}\n**Enviado:** <t:${Math.floor(createdAt.getTime() / 1000)}:F>`)
    .addFields(
      { name: 'Discord', value: `<@${application.discordId}>\n\`${application.discordId}\``, inline: true },
      { name: 'IGN', value: `${sanitize(application.ign, 100) || '-'}${application.mcVerified === false ? ' ⚠️' : application.mcVerified === true ? ' ✅' : ' ❔'}`, inline: true },
      { name: 'Rango', value: rankLabel(application.rank), inline: true },
      { name: 'Plataforma', value: `${platformLabel(application.platform)}${application.platformVerified === false ? ' ⚠️' : application.platformVerified === true ? ' ✅' : ' ❔'}`, inline: true },
      { name: 'Canal', value: sanitize(application.channelUrl, 300) || '-', inline: false },
      { name: 'Comentario', value: sanitize(application.comment, 1000) || '-', inline: false }
    )
    .setFooter({ text: 'PrismaMC · Sistema de Solicitudes · ✅ verificado · ⚠️ no encontrado · ❔ no se pudo comprobar' });

  const ref = imageRef || application.statsImageUrl;
  if (ref) embed.setImage(ref);
  if (reviewerId) embed.addFields({ name: 'Revisado por', value: `<@${reviewerId}>`, inline: true });
  if (reason) embed.addFields({ name: 'Motivo', value: sanitize(reason, 1000), inline: false });
  return embed;
}

function buildButtonRow(appId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apply_accept:${appId}`).setLabel('Aceptar').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`apply_reject:${appId}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

async function sendApplicationToDiscord(application, imagePath, imageExt) {
  const config = getConfig();
  const pendingChannelId = config.applicationChannels?.pending || APPLICATIONS_CHANNEL_ID;
  if (!pendingChannelId) throw new Error('Falta el canal de pendientes (applicationChannels.pending en config.json).');
  const channel = await client.channels.fetch(pendingChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('No se encontró el canal de pendientes o no es de texto.');

  const attachName = `estadisticas.${imageExt || 'png'}`;
  const message = await channel.send({
    embeds: [buildApplicationEmbed(application, { imageRef: `attachment://${attachName}` })],
    components: [buildButtonRow(application.id, false)],
    files: imagePath ? [{ attachment: imagePath, name: attachName }] : [],
  });

  const cdnUrl = message.attachments?.first()?.url || null;
  updateApplication(application.id, { messageId: message.id, channelId: channel.id, statsImageUrl: cdnUrl });
  return message;
}

async function autoSubscribeFromApplication(application, guild, staffUser) {
  const config = getConfig();
  const notificationChannelId = config.notificationChannelId;

  const platform = String(application.platform || detectPlatformFromUrl(application.channelUrl) || '').toLowerCase();

  const rankRoleKey = roleKeyFromRank(application.rank);
  const platformRoleKey = roleKeyFromPlatform(platform);
  const roleIds = [...new Set([rankRoleKey, platformRoleKey].map((k) => k && config.roles?.[k]).filter(Boolean))];

  let member = null;
  try {
    member = await guild.members.fetch(application.discordId);
    if (roleIds.length) {
      await member.roles.add(roleIds);
      await logRoleAssigned(client, {
        staff: staffUser, targetUser: { id: application.discordId },
        roleId: roleIds.join(', '), roleKey: [rankRoleKey, platformRoleKey].filter(Boolean).join('+'), guild,
      });
    }
  } catch (err) {
    console.error('[autoSubscribeFromApplication] No se pudo asignar el/los rol(es):', err.message);
  }

  if (!notificationChannelId || String(notificationChannelId).startsWith('PON_AQUI')) {
    return { ok: true, roleIds, platform, subscription: null, subWarning: 'No hay canal de notificaciones configurado.' };
  }

  let externalId = null;
  let displayName = null;
  try {
    if (platform === 'youtube') {
      const resolved = await resolveChannel(process.env.YOUTUBE_API_KEY, extractPlatformInput(application.channelUrl, 'youtube'));
      if (!resolved) return { ok: true, roleIds, platform, subscription: null, subWarning: 'No encontré el canal de YouTube para hacerle seguimiento automático.' };
      externalId = resolved.id; displayName = resolved.title;
    } else if (platform === 'twitch') {
      const resolved = await resolveTwitchUser(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, extractPlatformInput(application.channelUrl, 'twitch'));
      if (!resolved) return { ok: true, roleIds, platform, subscription: null, subWarning: 'No encontré el usuario de Twitch para hacerle seguimiento automático.' };
      externalId = resolved.login; displayName = resolved.displayName;
    } else if (platform === 'tiktok') {
      const resolved = await resolveTiktokUser(extractPlatformInput(application.channelUrl, 'tiktok'));
      if (!resolved) return { ok: true, roleIds, platform, subscription: null, subWarning: 'TikTok: seguimiento automático pendiente de arreglar (Fase 3).' };
      externalId = resolved.username; displayName = resolved.displayName;
    } else if (platform === 'kick') {
      if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) {
        return { ok: true, roleIds, platform, subscription: null, subWarning: 'Credenciales de Kick no configuradas: no se puede hacer seguimiento automático.' };
      }
      const resolved = await resolveKickUser(process.env.KICK_CLIENT_ID, process.env.KICK_CLIENT_SECRET, extractPlatformInput(application.channelUrl, 'kick'));
      if (!resolved) return { ok: true, roleIds, platform, subscription: null, subWarning: 'No encontré el canal de Kick para hacerle seguimiento automático.' };
      externalId = resolved.login; displayName = resolved.displayName;
    } else {
      return { ok: true, roleIds, platform, subscription: null, subWarning: 'No pude detectar la plataforma para hacerle seguimiento automático.' };
    }
  } catch (err) {
    return { ok: true, roleIds, platform, subscription: null, subWarning: `Error consultando la plataforma: ${err.message}` };
  }

  const result = addSubscription({
    platform, externalId, displayName,
    discordChannelId: notificationChannelId,
    discordUserId: application.discordId,
    roleKey: platformRoleKey, assignedRoleId: roleIds[0] || null, guildId: guild.id,
    sourceApplicationId: application.id,
  });

  await logSubscriptionAdded(client, {
    staff: staffUser, targetUser: { id: application.discordId }, platform,
    externalId: result.subscription.externalId, displayName,
    discordChannelId: notificationChannelId, expiresAt: result.subscription.expiresAt,
    renewed: result.renewed, roleKey: platformRoleKey, guild,
  });

  return { ok: true, roleIds, platform, subscription: result.subscription, renewed: result.renewed, displayName };
}

const verifyLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyFn: (req) => (req.user ? `verify:${req.user.id}` : req.ip),
  message: 'Demasiadas comprobaciones seguidas. Espera un poco.',
});

app.get('/api/verify/minecraft', session.requireUser, verifyLimiter, async (req, res) => {
  const ign = sanitize(req.query.ign, 64);
  if (!ign) return res.status(400).json({ error: 'Falta el nick.' });
  const result = await checkMinecraftUsername(ign);
  res.json(result);
});

app.get('/api/verify/platform', session.requireUser, verifyLimiter, async (req, res) => {
  const platform = sanitize(req.query.platform, 32).toLowerCase();
  const url = normalizeUrl(req.query.url);
  if (!platform || !url) return res.status(400).json({ error: 'Faltan datos.' });
  const result = await verifyPlatformLink(platform, url);
  res.json(result);
});

const applyIpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyFn: (req) => req.ip,
  message: 'Demasiadas peticiones desde tu conexión. Espera unos minutos e inténtalo de nuevo.',
});

const applyUserLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 6,
  keyFn: (req) => (req.user ? `discord:${req.user.id}` : null),
  message: 'Ya hiciste varios intentos de solicitud. Espera un poco antes de volver a intentarlo.',
});

app.post('/api/apply', applyIpLimiter, session.requireUser, applyUserLimiter, (req, res) => {
  if (isBlacklisted(String(req.user.id))) {
    return res.status(403).json({ error: 'No puedes enviar ni renovar solicitudes en este momento.' });
  }
  upload.single('stats')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        const msg = uploadErr.code === 'LIMIT_FILE_SIZE'
          ? `La imagen supera el máximo de ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`
          : uploadErr.message || 'No se pudo subir la imagen.';
        return res.status(400).json({ error: msg });
      }

      const discordId = String(req.user.id);
      const ip = req.ip;

      if (isIpBlacklisted(ip)) {
        return res.status(403).json({ error: 'No puedes enviar ni renovar solicitudes en este momento.' });
      }

      const vpnCheck = await checkIp(ip);
      if (vpnCheck.checked && vpnCheck.isVpn) {
        return res.status(403).json({ error: 'Detectamos que estás usando una VPN o proxy. Desactívala e inténtalo de nuevo.' });
      }

      const ign = sanitize(req.body.ign, 64);
      const rank = sanitize(req.body.range, 32);
      const platform = sanitize(req.body.platform, 32);
      const channelUrl = normalizeUrl(req.body.channel_url);
      const comment = sanitize(req.body.comment, 1200);

      if (!/^\d{15,25}$/.test(discordId)) {
        return res.status(400).json({ error: 'Tu sesión de Discord no es válida. Vuelve a iniciar sesión.' });
      }
      if (!ign || !rank || !platform || !channelUrl) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
      }
      if (!RANKS.includes(rank)) {
        return res.status(400).json({ error: 'Ese rango no es válido.' });
      }
      if (!PLATFORMS.includes(platform) || !RANK_ALLOWED_PLATFORMS[rank].includes(platform)) {
        return res.status(400).json({ error: `Esa plataforma no está disponible para el rango ${rank}.` });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Sube una captura de tus estadísticas (imagen).' });
      }

      let saved;
      try {
        saved = saveImageBuffer(req.file.buffer);
      } catch (imgErr) {
        return res.status(400).json({ error: imgErr.message });
      }

      const pending = getPendingApplicationByDiscordId(discordId);
      if (pending) {
        return res.status(409).json({
          error: 'Ya tienes una solicitud pendiente. Espera a que la revisen antes de enviar otra.',
          pending: { id: pending.id, createdAt: pending.createdAt, rank: pending.rank },
        });
      }

      const mcCheck = await checkMinecraftUsername(ign);
      if (mcCheck.verified === false) {
        return res.status(400).json({ error: 'Ese nombre de Minecraft no existe. Revísalo bien (Mojang no lo reconoce).' });
      }

      const platformCheck = await verifyPlatformLink(platform.toLowerCase(), channelUrl);
      if (platformCheck.verified === false) {
        return res.status(400).json({ error: `No encontramos ese canal/perfil en ${platform}. Revisa el enlace.` });
      }

      const application = createApplication({
        discordId,
        discordUsername: sanitize(req.user.globalName || req.user.username, 64),
        ign, rank, platform: platform.toLowerCase(), channelUrl,
        comment: comment || '-',
        statsImageName: saved.name,
        statsImageUrl: null,
        status: 'pending',
        reviewedBy: null, reviewedAt: null, reason: null,
        mcVerified: mcCheck.verified,
        platformVerified: platformCheck.verified,
        ip,
      });

      await sendApplicationToDiscord(application, saved.path, saved.ext);
      return res.json({ ok: true, applicationId: application.id });
    } catch (error) {
      console.error('[api/apply]', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
registerLogHandlers(client);
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    if (!command?.data?.name || typeof command.execute !== 'function') {
      console.error(`⚠️  ${file} no exporta { data, execute } correctamente - se omite. Revisa module.exports en ese archivo.`);
      continue;
    }
    client.commands.set(command.data.name, command);
  } catch (err) {
    console.error(`⚠️  No se pudo cargar el comando ${file}, se omite: ${err.message}`);
  }
}

async function deployCommands() {
  if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) return;
  const body = client.commands.map((cmd) => cmd.data.toJSON());
  const rest = new REST().setToken(DISCORD_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);
  try {
    await rest.put(route, { body });
    console.log(`✅ ${body.length} comando(s) registrados.`);
  } catch (err) {
    console.error('❌ Error registrando comandos:', err.message);
  }
}

async function hasStaffAccess(interaction) {
  const config = getConfig();
  const adminRoleId = config.adminRoleId;
  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (REVIEW_STAFF_ROLE_ID && interaction.member?.roles?.cache?.has(REVIEW_STAFF_ROLE_ID)) return true;
  if (adminRoleId && interaction.member?.roles?.cache?.has(adminRoleId)) return true;
  return false;
}

async function getStaffLevel(discordId) {
  const none = { isStaff: false, isMediaManager: false };
  if (!DISCORD_GUILD_ID || !client.isReady?.()) return none;
  try {
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const config = getConfig();
    const roles = member.roles.cache;
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) || (config.adminRoleId && roles.has(config.adminRoleId));
    const isMediaManager = isAdmin || (config.mediaManagerRoleId && roles.has(config.mediaManagerRoleId));
    const isAssistant = (config.staffAssistantRoleId && roles.has(config.staffAssistantRoleId)) || (REVIEW_STAFF_ROLE_ID && roles.has(REVIEW_STAFF_ROLE_ID));
    return { isStaff: isMediaManager || isAssistant, isMediaManager };
  } catch (err) {
    console.error('[getStaffLevel]', err.message);
    return none;
  }
}

async function tryDM(userId, title, description) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;
  await user.send({
    embeds: [new EmbedBuilder().setColor(0xf2a43a).setTitle(title).setDescription(description).setFooter({ text: 'PrismaMC · Sistema de Solicitudes' })],
  }).catch(() => {});
}

async function moveApplicationMessage(application, status, reviewerId, reason = null) {
  const config = getConfig();
  const targetChannelId = config.applicationChannels?.[status];

  if (application.channelId && application.messageId) {
    try {
      const pendingChannel = await client.channels.fetch(application.channelId).catch(() => null);
      if (pendingChannel?.isTextBased()) {
        const oldMessage = await pendingChannel.messages.fetch(application.messageId).catch(() => null);
        if (oldMessage) await oldMessage.delete().catch(() => {});
      }
    } catch (err) {
      console.error('[moveApplicationMessage] no se pudo borrar el mensaje pendiente:', err.message);
    }
  }

  if (!targetChannelId) {
    console.error(`[moveApplicationMessage] no hay canal configurado para "${status}" (applicationChannels.${status} en config.json)`);
    return;
  }

  const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);
  if (!targetChannel || !targetChannel.isTextBased()) {
    console.error(`[moveApplicationMessage] el canal configurado para "${status}" no existe o no es de texto.`);
    return;
  }

  const message = await targetChannel.send({
    embeds: [buildApplicationEmbed(application, { status, reviewerId, reason })],
  }).catch((err) => {
    console.error('[moveApplicationMessage] no se pudo enviar al canal final:', err.message);
    return null;
  });

  if (message) {
    updateApplication(application.id, { messageId: message.id, channelId: message.channel.id });
  }
}

client.once('ready', async () => {
  console.log(`✅ Conectado como ${client.user.tag}`);
  await deployCommands();
  startChecker(client);
});

async function acceptApplication(appId, staff) {
  const application = getApplication(appId);
  if (!application) return { ok: false, error: 'No encontré esa solicitud.' };
  if (application.status !== 'pending') return { ok: false, error: `Esta solicitud ya fue ${application.status}.` };

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID).catch(() => null);
  if (!guild) return { ok: false, error: 'No se pudo acceder al servidor de Discord (¿el bot está conectado?).' };

  const reviewedAt = new Date().toISOString();
  let subResult = null;
  let hardError = null;
  try {
    subResult = await autoSubscribeFromApplication(application, guild, staff);
  } catch (err) {
    hardError = err.message;
    console.error('[acceptApplication] autoSubscribeFromApplication:', err);
  }

  updateApplication(appId, {
    status: 'accepted', reviewedBy: staff.id, reviewedAt, reason: null,
    subscriptionId: subResult?.subscription?.id || null,
    subscriptionPlatform: subResult?.platform || null,
    subscriptionRenewed: subResult?.renewed || false,
  });

  const updated = getApplication(appId);
  await moveApplicationMessage(updated, 'accepted', staff.id, null);
  await tryDM(updated.discordId, 'Tu solicitud fue aceptada', `¡Buenas! Tu solicitud **${updated.id}** fue aceptada por el staff. ${subResult?.roleIds?.length ? 'Ya tienes tu(s) rol(es) asignado(s).' : ''}`);
  await logApplicationAccepted(client, {
    application: updated, staff,
    platform: subResult?.platform || detectPlatformFromUrl(updated.channelUrl),
    roleKey: roleKeyFromRank(updated.rank),
    subscription: subResult?.subscription || null,
    assignedRoleId: subResult?.roleIds?.[0] || null,
  });

  let warning;
  if (hardError) warning = `Aviso: fallo asignando roles/suscripción (${hardError}).`;
  else if (subResult?.subscription) warning = `Roles asignados y añadido a seguimiento automático (${subResult.renewed ? 'renovado' : 'nuevo'}).`;
  else if (subResult?.subWarning) warning = `Roles asignados. Aviso sobre seguimiento automático: ${subResult.subWarning}`;
  else warning = 'Roles asignados.';

  return { ok: true, application: updated, message: `Solicitud ${updated.id} aceptada correctamente. ${warning}` };
}

async function rejectApplication(appId, staff, reason) {
  const application = getApplication(appId);
  if (!application) return { ok: false, error: 'No encontré esa solicitud.' };
  if (application.status !== 'pending') return { ok: false, error: `Esta solicitud ya fue ${application.status}.` };

  const finalReason = sanitize(reason, 500) || 'Rechazada por el staff';
  updateApplication(appId, { status: 'rejected', reviewedBy: staff.id, reviewedAt: new Date().toISOString(), reason: finalReason });
  const updated = getApplication(appId);
  await moveApplicationMessage(updated, 'rejected', staff.id, finalReason);
  await tryDM(updated.discordId, 'Tu solicitud fue rechazada', `Lo sentimos. Tu solicitud **${updated.id}** fue rechazada por el staff. Motivo: ${finalReason}`);
  await logApplicationRejected(client, { application: updated, staff, reason: finalReason });
  return { ok: true, application: updated, message: `Solicitud ${updated.id} rechazada correctamente.` };
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === settingsLogs.CATEGORY_SELECT_ID) {
      return settingsLogs.handleCategoryPicked(interaction);
    }
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith(settingsLogs.CHANNEL_SELECT_PREFIX)) {
      return settingsLogs.handleChannelPicked(interaction);
    }
    if (interaction.isStringSelectMenu() && interaction.customId === ticketPanel.PANEL_SELECT_ID) {
      return ticketHandlers.handlePanelSelect(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal_feedback') {
      return ticketHandlers.handleFeedbackModalSubmit(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
      return ticketHandlers.handleModalSubmit(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith('ticket_rating_')) {
      return ticketHandlers.handleTicketRating(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'ticket_claim') {
      return ticketHandlers.handleClaim(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      return ticketHandlers.handleClose(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'ticket_transfer') {
      return ticketHandlers.handleTransferButton(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith('ticket_transfer_pick:')) {
      return ticketHandlers.handleTransferPick(interaction);
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_transfer_category_select') {
      return ticketHandlers.handleTransferCategorySelect(interaction);
    }
    if (interaction.isRoleSelectMenu() && interaction.customId === 'ticket_transfer_role_select') {
      return ticketHandlers.handleTransferRoleSelect(interaction);
    }
    if (interaction.isUserSelectMenu() && interaction.customId === 'ticket_transfer_person_select') {
      return ticketHandlers.handleTransferPersonSelect(interaction);
    }

    if (interaction.isButton()) {
      const [action, appId] = interaction.customId.split(':');
      if (!action || !appId) return;

      if (!(await hasStaffAccess(interaction))) {
        return interaction.reply({ content: 'No tienes permisos para revisar solicitudes.', ephemeral: true });
      }

      if (action === 'apply_accept') {
        const result = await acceptApplication(appId, { id: interaction.user.id });
        return interaction.reply({ content: result.ok ? result.message : result.error, ephemeral: true });
      }

      if (action === 'apply_reject') {
        const result = await rejectApplication(appId, { id: interaction.user.id }, null);
        return interaction.reply({ content: result.ok ? result.message : result.error, ephemeral: true });
      }
    }
  } catch (err) {
    console.error('[interactionCreate]', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Ocurrió un error procesando la interacción.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'Ocurrió un error procesando la interacción.', ephemeral: true }).catch(() => {});
    }
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🌐 Web escuchando en http://${HOST}:${PORT}`);
  if (!oauth.isConfigured()) console.warn('⚠️  Login con Discord no configurado: faltan DISCORD_CLIENT_SECRET u OAUTH_REDIRECT_URI.');
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN).catch((err) => console.error('❌ No se pudo iniciar sesión en Discord:', err.message));
} else {
  console.warn('⚠️ DISCORD_TOKEN no configurado. Solo arrancará la web.');
}
