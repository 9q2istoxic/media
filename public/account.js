'use strict';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

const $ = (id) => document.getElementById(id);

let currentUser = null;
let accountData = null;
let selectedFile = null;
let previewUrl = null;

const STEPS = [1, 2, 3, 4, 5, 6];
let stepIndex = 0;

const RANK_PLATFORMS = {
  Media: ['YouTube', 'TikTok', 'Twitch', 'Kick'],
  Twitch: ['Twitch', 'Kick'],
  Famous: ['YouTube', 'TikTok', 'Twitch', 'Kick'],
};

const PLATFORM_COPY = {
  YouTube: {
    title: 'Tu canal de YouTube',
    help: 'Añade el enlace de tu canal.',
    label: 'Enlace del canal',
    placeholder: 'https://youtube.com/@tucanal',
  },
  Twitch: {
    title: 'Tu canal de Twitch',
    help: 'Añade el enlace de tu canal.',
    label: 'Enlace del canal',
    placeholder: 'https://twitch.tv/tucanal',
  },
  TikTok: {
    title: 'Tu perfil de TikTok',
    help: 'Añade el enlace de tu perfil.',
    label: 'Enlace del perfil',
    placeholder: 'https://tiktok.com/@tuperfil',
  },
  Kick: {
    title: 'Tu canal de Kick',
    help: 'Añade el enlace de tu canal.',
    label: 'Enlace del canal',
    placeholder: 'https://kick.com/tucanal',
  },
};

const PLATFORM_HOST_RULES = {
  YouTube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  Twitch: /(^|\.)twitch\.tv$/i,
  TikTok: /(^|\.)tiktok\.com$/i,
  Kick: /(^|\.)kick\.com$/i,
};

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function urlMatchesPlatform(value, platform) {
  const rule = PLATFORM_HOST_RULES[platform];
  if (!rule) return true;
  try {
    return rule.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

let meLoaded = null;

async function loadMe() {
  meLoaded = (async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await res.json();
      currentUser = data.user || null;
      if (!currentUser) { location.href = '/?login=requerido'; return; }
      renderNav(data);
      await loadAccount();
    } catch {
      location.href = '/?login=requerido';
    }
  })();
  return meLoaded;
}

async function loadAccount() {
  try {
    const res = await fetch('/api/account', { credentials: 'same-origin' });
    if (!res.ok) { location.href = '/'; return; }
    accountData = await res.json();
    renderDashboard(accountData);
  } catch {
    location.href = '/';
  }
}

function renderNav({ user }) {
  const nav = $('navAuth');
  if (!user) return;
  nav.innerHTML = `<span class="nav-chip"><img src="${escapeAttr(user.avatar)}" alt="" />${escapeHtml(user.globalName)}</span>
    <button type="button" class="who-logout" id="logoutBtn">Cerrar sesión</button>`;
  $('logoutBtn')?.addEventListener('click', logout);
}

const STATUS_LABEL = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' };

const RANK_COLOR = { Media: 'amber', Twitch: 'grass', Famous: 'danger' };

function renderStatGrid(data) {
  const grid = $('statGrid');
  if (!grid) return;

  let statusLabel, statusClass;
  if (data.hasPending) {
    statusLabel = 'En revisión'; statusClass = 'amber';
  } else if (data.roleExpiresAt) {
    statusLabel = 'Activo'; statusClass = 'grass';
  } else if (data.currentRank) {
    statusLabel = 'Vencido'; statusClass = 'danger';
  } else {
    statusLabel = 'Sin rango'; statusClass = '';
  }

  const rankCard = `
    <div class="stat-card">
      <p class="stat-card-label">Rango actual</p>
      <p class="stat-card-value ${data.currentRank ? RANK_COLOR[data.currentRank] || '' : ''}">${data.currentRank ? escapeHtml(data.currentRank) : 'Ninguno'}</p>
      <p class="stat-card-sub">${data.currentPlatform ? escapeHtml(data.currentPlatform[0].toUpperCase() + data.currentPlatform.slice(1)) : 'Aún sin solicitud aceptada'}</p>
    </div>`;

  const statusCard = `
    <div class="stat-card">
      <p class="stat-card-label">Estado</p>
      <p class="stat-card-value ${statusClass}">${statusLabel}</p>
      <p class="stat-card-sub">${data.hasPending ? 'El staff está revisando tu solicitud' : data.roleExpiresAt ? 'Tu rango está en pie' : data.currentRank ? 'Pulsa "Renovar" para seguir' : 'Empieza tu primera solicitud'}</p>
    </div>`;

  let expiryCard;
  if (data.roleExpiresAt) {
    const msLeft = data.roleExpiresAt - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
    const totalDays = Math.round((data.subscriptionDurationMs || 1) / 86400000) || 14;
    const pct = Math.max(4, Math.min(100, Math.round((msLeft / data.subscriptionDurationMs) * 100)));
    const barClass = daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warn' : '';
    const date = new Date(data.roleExpiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    expiryCard = `
      <div class="stat-card">
        <p class="stat-card-label">Vence en</p>
        <p class="stat-card-value ${barClass}">${daysLeft} día${daysLeft === 1 ? '' : 's'}</p>
        <p class="stat-card-sub">${date} · ciclo de ${totalDays} días</p>
        <div class="stat-progress"><div class="stat-progress-bar ${barClass}" style="width:${pct}%"></div></div>
      </div>`;
  } else {
    expiryCard = `
      <div class="stat-card">
        <p class="stat-card-label">Vence en</p>
        <p class="stat-card-value">-</p>
        <p class="stat-card-sub">${data.currentRank ? 'Ya venció' : 'Sin rango activo'}</p>
      </div>`;
  }

  grid.innerHTML = rankCard + statusCard + expiryCard;
}

function renderDashboard(data) {
  const user = data.user;
  $('acctAvatar').src = user.avatar;
  $('acctName').textContent = user.globalName;

  if (data.staff?.isStaff) {
    const nav = $('navAuth');
    if (nav && !document.getElementById('staffPanelLink')) {
      nav.insertAdjacentHTML('beforeend', '<a class="nav-login" id="staffPanelLink" href="/admin">Panel de staff</a>');
    }
  }

  const since = data.account?.firstLoginAt ? new Date(data.account.firstLoginAt) : new Date();
  $('acctSince').textContent = `desde ${since.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;

  renderStatGrid(data);

  const list = $('solicitudesList');
  if (!data.applications.length) {
    list.innerHTML = `<p class="status-text">Todavía no has enviado ninguna solicitud.</p>`;
  } else {
    list.innerHTML = data.applications.map((a) => `
      <div class="status-row">
        <div class="status-info">
          <span class="status-badge ${a.status}">${STATUS_LABEL[a.status] || a.status}</span>
          <p class="status-text"><span class="rank-pill ${RANK_COLOR[a.rank] || ''}">${escapeHtml(a.rank)}</span> · código <strong>${escapeHtml(a.id)}</strong>
            · ${new Date(a.createdAt).toLocaleDateString('es-ES')}
            ${a.status === 'rejected' && a.reason ? ` · ${escapeHtml(a.reason)}` : ''}
          </p>
        </div>
      </div>`).join('');
  }

  const actions = $('dashboardActions');
  const parts = [];
  if (data.canRenew && !data.hasPending) {
    parts.push('<button type="button" class="btn btn-ghost" id="renewBtn">Renovar</button>');
  } else if (data.roleExpiresAt && !data.hasPending) {
    const date = new Date(data.roleExpiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    parts.push(`<p class="status-text">Tu rango sigue activo hasta el ${date}. "Renovar" aparecerá cuando venza.</p>`);
  }
  if (!data.hasPending) {
    parts.push('<button type="button" class="btn btn-primary" id="newRequestBtn">Crear una nueva solicitud</button>');
  } else {
    parts.push('<p class="account-mini">Ya tienes una solicitud pendiente - espera a que la revisen.</p>');
  }
  actions.innerHTML = parts.join('');

  $('newRequestBtn')?.addEventListener('click', () => openWizard());
  $('renewBtn')?.addEventListener('click', () => {
    const lastAccepted = [...data.applications].reverse().find((a) => a.status === 'accepted') || data.applications.find((a) => a.status === 'accepted');
    openWizard(lastAccepted);
  });
}

const DRAFT_KEY = 'pmc_wizard_draft_v1';

function saveDraft() {
  try {
    const draft = {
      step: stepIndex,
      rank: currentRank(),
      platform: currentPlatform(),
      ign: $('wIgn').value,
      channel_url: $('wChannel').value,
      comment: $('wComment').value,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {

  }
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

function applyDraft(draft) {
  if (!draft) return;
  if (draft.rank) {
    const input = document.querySelector(`input[name="range"][value="${CSS.escape(draft.rank)}"]`);
    if (input) input.checked = true;
    renderPlatformOptions();
  }
  if (draft.platform) {
    const input = document.querySelector(`input[name="platform"][value="${CSS.escape(draft.platform)}"]`);
    if (input && !input.closest('.rank-card').hidden) input.checked = true;
  }
  if (draft.ign) $('wIgn').value = draft.ign;
  if (draft.channel_url) $('wChannel').value = draft.channel_url;
  if (draft.comment) $('wComment').value = draft.comment;

  if (typeof draft.step === 'number') {
    stepIndex = Math.min(Math.max(draft.step, 0), STEPS.length - 2);
  }
}

function openWizard(prefill) {
  stepIndex = 0;
  resetWizardFields();
  if (currentUser) {
    $('wAvatar').src = currentUser.avatar;
    $('wDiscordName').textContent = currentUser.globalName;
  }
  if (prefill) {

    const rankInput = document.querySelector(`input[name="range"][value="${CSS.escape(prefill.rank)}"]`);
    if (rankInput) rankInput.checked = true;
    renderPlatformOptions();
    if (prefill.platform) {
      const platInput = document.querySelector(`input[name="platform"][value="${CSS.escape(prefill.platform)}"]`);
      if (platInput) platInput.checked = true;
    }
    if (prefill.channelUrl) $('wChannel').value = prefill.channelUrl;
  } else {
    applyDraft(loadDraft());
  }
  $('wizardOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
  renderStep();
}

function closeWizard() {
  $('wizardOverlay').hidden = true;
  document.body.style.overflow = '';
}

function resetWizardFields() {
  document.querySelectorAll('input[name="range"]').forEach((r) => (r.checked = false));
  document.querySelectorAll('input[name="platform"]').forEach((r) => (r.checked = false));
  renderPlatformOptions();
  $('wIgn').value = '';
  $('wChannel').value = '';
  $('wComment').value = '';
  $('wIgnHint').textContent = '';
  $('wChannelHint').textContent = '';
  clearFile();
  document.querySelectorAll('.w-error').forEach((el) => (el.textContent = ''));
  $('wSubmit').disabled = false;
  $('wSubmit').textContent = 'Enviar solicitud';
}

function currentRank() {
  return document.querySelector('input[name="range"]:checked')?.value || '';
}

function currentPlatform() {
  return document.querySelector('input[name="platform"]:checked')?.value || '';
}

function renderPlatformOptions() {
  const rank = currentRank();
  const allowed = RANK_PLATFORMS[rank] || [];
  document.querySelectorAll('#platformGrid .rank-card').forEach((card) => {
    const platform = card.dataset.platform;
    const isAllowed = allowed.includes(platform);
    card.hidden = !isAllowed;
    if (!isAllowed) card.querySelector('input').checked = false;
  });
}

function renderStep() {
  const step = STEPS[stepIndex];
  document.querySelectorAll('.w-step').forEach((el) => {
    el.classList.toggle('active', el.dataset.step === String(step));
  });

  document.querySelectorAll('.wp-step').forEach((el) => {
    const n = Number(el.dataset.wp);
    el.classList.toggle('active', n === step);
    el.classList.toggle('done', n < step);
  });

  if (step === 2) renderPlatformOptions();

  if (step === 4) {
    const platform = currentPlatform();
    const copy = PLATFORM_COPY[platform] || PLATFORM_COPY.YouTube;
    $('wContentTitle').textContent = copy.title;
    $('wContentHelp').textContent = copy.help;
    $('wChannelLabel').textContent = copy.label;
    $('wChannel').placeholder = copy.placeholder;
  }

  if (step === 6) buildReview();

  $('wBack').disabled = stepIndex === 0;
  $('wNext').hidden = step === 6;
  $('wSubmit').hidden = step !== 6;
  $('wizardFoot').classList.toggle('hidden', step === 'done');
}

function setError(key, msg) {
  const el = document.querySelector(`.w-error[data-err="${key}"]`);
  if (el) el.textContent = msg || '';
}

async function validateStep(step) {
  if (step === 1) {
    if (!currentRank()) { setError('1', 'Elige una categoría para continuar.'); return false; }
    setError('1', '');
    return true;
  }
  if (step === 2) {
    if (!currentPlatform()) { setError('platform', 'Elige una plataforma para continuar.'); return false; }
    setError('platform', '');
    return true;
  }
  if (step === 3) {
    const ign = $('wIgn').value.trim();
    if (!ign) { setError('ign', 'Escribe tu nombre en juego.'); return false; }
    setError('ign', ''); $('wIgnHint').textContent = 'Comprobando en Mojang…'; $('wIgnHint').className = 'w-hint';
    try {
      const res = await fetch(`/api/verify/minecraft?ign=${encodeURIComponent(ign)}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.verified === false) {
        setError('ign', 'Ese nick de Minecraft no existe. Revísalo bien.');
        $('wIgnHint').textContent = '';
        return false;
      }
      $('wIgnHint').textContent = data.verified === true ? '✅ Nick verificado en Mojang.' : '❔ No se pudo comprobar automáticamente ahora mismo - el staff lo revisará.';
      $('wIgnHint').className = data.verified === true ? 'w-hint ok' : 'w-hint';
    } catch {
      $('wIgnHint').textContent = '❔ No se pudo comprobar automáticamente ahora mismo - el staff lo revisará.';
    }
    return true;
  }
  if (step === 4) {
    const url = $('wChannel').value.trim();
    const platform = currentPlatform();
    if (!url) { setError('channel', 'Añade el enlace de tu canal o perfil.'); return false; }
    if (!isValidUrl(url)) { setError('channel', 'Eso no parece una URL válida.'); return false; }
    if (!urlMatchesPlatform(url, platform)) {
      setError('channel', `El enlace no parece de ${platform}. Revísalo.`);
      return false;
    }
    setError('channel', ''); $('wChannelHint').textContent = 'Comprobando que el canal existe…'; $('wChannelHint').className = 'w-hint';
    try {
      const res = await fetch(`/api/verify/platform?platform=${encodeURIComponent(platform)}&url=${encodeURIComponent(url)}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.verified === false) {
        setError('channel', `No encontramos ese canal/perfil en ${platform}. Revisa el enlace.`);
        $('wChannelHint').textContent = '';
        return false;
      }
      $('wChannelHint').textContent = data.verified === true ? `✅ Canal encontrado${data.displayName ? ': ' + data.displayName : ''}.` : '❔ No se pudo comprobar automáticamente ahora mismo - el staff lo revisará.';
      $('wChannelHint').className = data.verified === true ? 'w-hint ok' : 'w-hint';
    } catch {
      $('wChannelHint').textContent = '❔ No se pudo comprobar automáticamente ahora mismo - el staff lo revisará.';
    }
    return true;
  }
  if (step === 5) {
    if (!selectedFile) { setError('stats', 'Sube una captura de tus estadísticas.'); return false; }
    setError('stats', '');
    return true;
  }
  return true;
}

function buildReview() {
  const rank = currentRank();
  const platform = currentPlatform();
  const url = $('wChannel').value.trim();
  const rows = [
    ['Discord', currentUser ? `@${currentUser.username}` : '-'],
    ['Minecraft', $('wIgn').value.trim() || '-'],
    ['Categoría', rank || '-'],
    ['Plataforma', platform || '-'],
    ['Enlace', url || '-'],
    ['Estadísticas', selectedFile ? '✓ Imagen subida' : '-', !!selectedFile],
  ];
  $('reviewList').innerHTML = rows
    .map(([k, v, ok]) => `<div><dt>${escapeHtml(k)}</dt><dd${ok ? ' class="review-ok"' : ''}>${escapeHtml(v)}</dd></div>`)
    .join('');
}

async function goNext() {
  const step = STEPS[stepIndex];
  const btn = $('wNext');
  btn.disabled = true;
  try {
    const ok = await validateStep(step);
    if (!ok) return;
    if (stepIndex < STEPS.length - 1) {
      stepIndex += 1;
      renderStep();
      saveDraft();
      document.getElementById('wizardForm')?.scrollTo?.(0, 0);
    }
  } finally {
    btn.disabled = false;
  }
}

function goBack() {
  if (stepIndex > 0) {
    stepIndex -= 1;
    renderStep();
    saveDraft();
  }
}

async function submitWizard() {
  setError('submit', '');
  const btn = $('wSubmit');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  const fd = new FormData();
  fd.append('ign', $('wIgn').value.trim());
  fd.append('range', currentRank());
  fd.append('platform', currentPlatform());
  fd.append('channel_url', $('wChannel').value.trim());
  fd.append('comment', $('wComment').value.trim());
  fd.append('stats', selectedFile);

  try {
    const res = await fetch('/api/apply', { method: 'POST', body: fd, credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      setError('submit', 'Tu sesión caducó. Vuelve a iniciar sesión.');
      setTimeout(() => { location.href = '/auth/discord'; }, 1200);
      return;
    }
    if (!res.ok) {
      setError('submit', json.error || 'No se pudo enviar la solicitud.');
      return;
    }

    document.querySelectorAll('.w-step').forEach((el) => el.classList.toggle('active', el.dataset.step === 'done'));
    $('wizardProgress').style.visibility = 'hidden';
    $('wizardFoot').classList.add('hidden');
    $('doneText').textContent = `Guarda tu código: ${json.applicationId}. Nuestro equipo revisará tu solicitud y te avisará por Discord.`;
    clearDraft();
    await loadAccount();
  } catch {
    setError('submit', 'Error de conexión con el servidor.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar solicitud';
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setFile(file) {
  if (!file) return;
  if (!ALLOWED.includes(file.type)) {
    setError('stats', 'Ese archivo no es una imagen válida. Usa PNG, JPG o WEBP.');
    return;
  }
  if (file.size > MAX_BYTES) {
    setError('stats', 'La imagen supera los 8 MB.');
    return;
  }
  setError('stats', '');
  selectedFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('previewImg').src = previewUrl;
  $('previewName').textContent = file.name;
  $('previewSize').textContent = humanSize(file.size);
  $('dropEmpty').hidden = true;
  $('dropPreview').hidden = false;
}

function clearFile() {
  selectedFile = null;
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  $('stats').value = '';
  $('dropEmpty').hidden = false;
  $('dropPreview').hidden = true;
}

function wireDropzone() {
  const drop = $('drop');
  const input = $('stats');

  drop.addEventListener('click', (e) => {
    if (e.target.closest('.preview-actions')) return;
    input.click();
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => setFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) setFile(file);
  });

  $('removeImg').addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });
  $('changeImg').addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
}

async function logout() {
  try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
  location.reload();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function applyBranding(content) {
  if (content.logoUrl) {
    const mark = $('brandMark');
    if (mark) mark.innerHTML = `<img src="${escapeHtml(content.logoUrl)}" alt="PrismaMC" width="26" height="26" />`;
  }
  if (content.faviconUrl) {
    const fav = $('faviconLink');
    if (fav) fav.href = content.faviconUrl;
  }
  const credit = $('credit');
  if (credit && content.footerCredit) credit.textContent = content.footerCredit;
}

async function loadContent() {
  try {
    const res = await fetch('/api/content');
    applyBranding(await res.json());
  } catch {

  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    wireDropzone();
    $('wNext').addEventListener('click', goNext);
    $('wBack').addEventListener('click', goBack);
    $('wSubmit').addEventListener('click', submitWizard);
    $('wizardClose').addEventListener('click', closeWizard);
    $('doneClose').addEventListener('click', closeWizard);
    $('wizardOverlay').addEventListener('click', (e) => { if (e.target === $('wizardOverlay')) closeWizard(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('wizardOverlay').hidden) closeWizard(); });

    ['wIgn', 'wChannel', 'wComment'].forEach((id) => $(id)?.addEventListener('input', saveDraft));
    document.querySelectorAll('input[name="range"]').forEach((r) => r.addEventListener('change', saveDraft));
  } catch (err) {

    console.error('Fallo al inicializar la web:', err);
  }

  loadMe();
  loadContent();
});
