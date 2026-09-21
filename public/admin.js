'use strict';

const $ = (id) => document.getElementById(id);
let currentUser = null;
let currentView = 'pending';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STATUS_LABEL = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada' };
const RANK_COLOR = { Media: 'amber', Twitch: 'grass', Famous: 'danger' };

let isMediaManager = false;

async function loadStats() {
  try {
    const res = await fetch('/api/admin/applications?all=1', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    data.applications.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    $('adminStats').innerHTML = `
      <div class="stat-card">
        <p class="stat-card-label">Pendientes</p>
        <p class="stat-card-value amber">${counts.pending}</p>
        <p class="stat-card-sub">Esperando revisión</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label">Aceptadas</p>
        <p class="stat-card-value grass">${counts.accepted}</p>
        <p class="stat-card-sub">Histórico</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label">Rechazadas</p>
        <p class="stat-card-value danger">${counts.rejected}</p>
        <p class="stat-card-sub">Histórico</p>
      </div>`;
  } catch {

  }
}

async function loadMe() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    const data = await res.json();
    currentUser = data.user || null;
    if (!currentUser) { location.href = '/?login=requerido'; return; }
    renderNav();

    const accRes = await fetch('/api/account', { credentials: 'same-origin' });
    const accData = await accRes.json();
    isMediaManager = !!accData.staff?.isMediaManager;
    if (isMediaManager) $('tabContent').hidden = false;
  } catch {
    location.href = '/?login=requerido';
  }
}

function renderNav() {
  $('navAuth').innerHTML = `<span class="nav-chip"><img src="${escapeHtml(currentUser.avatar)}" alt="" />${escapeHtml(currentUser.globalName)}</span>
    <a class="nav-login" href="/account/${encodeURIComponent(currentUser.id)}">Mi cuenta</a>`;
}

function setMsg(text, ok) {
  const el = $('adminMsg');
  el.textContent = text || '';
  el.className = `admin-msg ${ok ? 'ok' : text ? 'err' : ''}`;
}

async function loadApplications() {
  setMsg('');
  const url = currentView === 'audit' ? '/api/admin/applications?all=1' : '/api/admin/applications';
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/?login=requerido'; return; }
    if (res.status === 403) { location.href = `/account/${encodeURIComponent(currentUser.id)}`; return; }
    const data = await res.json();
    render(data.applications);
  } catch {
    setMsg('No se pudo cargar la lista. Recarga la página.', false);
  }
}

function verifBadge(value) {
  if (value === true) return '<span class="verif-badge ok" title="Verificado">✅</span>';
  if (value === false) return '<span class="verif-badge bad" title="No encontrado">⚠️</span>';
  return '<span class="verif-badge unknown" title="No se pudo comprobar">❔</span>';
}

function render(applications) {
  $('pendingCount').textContent = currentView === 'pending' ? (applications.length ? `(${applications.length})` : '') : '';

  const list = $('appList');
  if (!applications.length) {
    list.innerHTML = `<p class="status-text">${currentView === 'pending' ? 'No hay solicitudes pendientes.' : 'No hay solicitudes todavía.'}</p>`;
    return;
  }

  list.innerHTML = applications.map((a) => `
    <div class="admin-card" data-id="${escapeHtml(a.id)}">
      <div class="admin-card-head">
        <span class="status-badge ${a.status}">${STATUS_LABEL[a.status] || a.status}</span>
        <span class="rank-pill ${RANK_COLOR[a.rank] || ''}">${escapeHtml(a.rank)}</span>
        <span class="admin-card-id">${escapeHtml(a.id)}</span>
        <span class="admin-card-date">${new Date(a.createdAt).toLocaleString('es-ES')}</span>
      </div>
      <div class="admin-card-body admin-card-grid">
        <div><dt>Discord</dt><dd>${escapeHtml(a.discordUsername || a.discordId)} · <code>${escapeHtml(a.discordId)}</code></dd></div>
        <div><dt>Minecraft</dt><dd>${escapeHtml(a.ign)} ${verifBadge(a.mcVerified)}</dd></div>
        <div><dt>Plataforma</dt><dd>${escapeHtml(a.platform || '-')} ${verifBadge(a.platformVerified)}</dd></div>
        <div class="admin-card-wide"><dt>Enlace</dt><dd><a href="${escapeHtml(a.channelUrl)}" target="_blank" rel="noopener">${escapeHtml(a.channelUrl)}</a></dd></div>
        ${a.comment && a.comment !== '-' ? `<div class="admin-card-wide"><dt>Comentario</dt><dd>${escapeHtml(a.comment)}</dd></div>` : ''}
        ${a.status !== 'pending' ? `<div class="admin-card-wide"><dt>Revisado por</dt><dd><code>${escapeHtml(a.reviewedBy || '-')}</code> · ${a.reviewedAt ? new Date(a.reviewedAt).toLocaleString('es-ES') : '-'}</dd></div>` : ''}
        ${a.status === 'rejected' && a.reason ? `<div class="admin-card-wide"><dt>Motivo</dt><dd>${escapeHtml(a.reason)}</dd></div>` : ''}
      </div>
      ${a.status === 'pending' ? `
      <div class="admin-card-actions">
        <button type="button" class="btn btn-primary admin-accept">Aceptar</button>
        <button type="button" class="btn btn-ghost admin-reject">Rechazar</button>
      </div>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.admin-accept').forEach((btn) => btn.addEventListener('click', onAccept));
  list.querySelectorAll('.admin-reject').forEach((btn) => btn.addEventListener('click', onReject));
}

async function onAccept(e) {
  const card = e.target.closest('.admin-card');
  const id = card.dataset.id;
  e.target.disabled = true;
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/accept`, { method: 'POST', credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'No se pudo aceptar.', false); e.target.disabled = false; return; }
    setMsg(data.message, true);
    await Promise.all([loadApplications(), loadStats()]);
  } catch {
    setMsg('Error de conexión.', false);
    e.target.disabled = false;
  }
}

async function onReject(e) {
  const card = e.target.closest('.admin-card');
  const id = card.dataset.id;
  const reason = prompt('Motivo del rechazo (se le enviará a la persona):', '');
  if (reason === null) return;
  e.target.disabled = true;
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'No se pudo rechazar.', false); e.target.disabled = false; return; }
    setMsg(data.message, true);
    await Promise.all([loadApplications(), loadStats()]);
  } catch {
    setMsg('Error de conexión.', false);
    e.target.disabled = false;
  }
}

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

function escapeAttr(s) { return escapeHtml(s); }

let contentDraft = null;

function reqRowHtml(r, i) {
  return `<div class="ce-row" data-i="${i}">
    <input type="text" class="ce-rango" placeholder="Rango" value="${escapeAttr(r.rango || '')}" />
    <input type="text" class="ce-minimo" placeholder="Mínimo" value="${escapeAttr(r.minimo || '')}" />
    <input type="text" class="ce-ademas" placeholder="Además" value="${escapeAttr(r.ademas || '')}" />
    <button type="button" class="ce-remove" data-list="requisitos" data-i="${i}">✕</button>
  </div>`;
}

function faqRowHtml(f, i) {
  return `<div class="ce-row ce-row-faq" data-i="${i}">
    <input type="text" class="ce-q" placeholder="Pregunta" value="${escapeAttr(f.q || '')}" />
    <textarea class="ce-a" placeholder="Respuesta" rows="2">${escapeHtml(f.a || '')}</textarea>
    <button type="button" class="ce-remove" data-list="faq" data-i="${i}">✕</button>
  </div>`;
}

function renderContentEditor() {
  const c = contentDraft;
  $('contentEditor').innerHTML = `
    <h3>Portada</h3>
    <div class="field"><label>Texto pequeño (eyebrow)</label><input id="ceEyebrow" type="text" value="${escapeAttr(c.hero.eyebrow)}" /></div>
    <div class="field"><label>Título</label><input id="ceTitle" type="text" value="${escapeAttr(c.hero.title)}" /></div>
    <div class="field"><label>Texto</label><textarea id="ceLead" rows="3">${escapeHtml(c.hero.lead)}</textarea></div>

    <h3>Requisitos por rango</h3>
    <div id="ceRequisitos">${c.requisitos.map(reqRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost" id="ceAddReq">+ Añadir rango</button>

    <h3>Preguntas frecuentes</h3>
    <div id="ceFaq">${c.faq.map(faqRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost" id="ceAddFaq">+ Añadir pregunta</button>

    <h3>Pie de página</h3>
    <div class="field"><label>Crédito</label><input id="ceFooter" type="text" value="${escapeAttr(c.footerCredit)}" /></div>

    <h3>Logo y favicon</h3>
    <div class="ce-branding">
      <div><label>Logo (PNG/JPG/WEBP)</label><input type="file" id="ceLogoFile" accept="image/png,image/jpeg,image/webp" /></div>
      <div><label>Favicon (PNG/JPG/WEBP)</label><input type="file" id="ceFaviconFile" accept="image/png,image/jpeg,image/webp" /></div>
    </div>

    <button type="button" class="btn btn-primary" id="ceSave">Guardar cambios</button>
  `;

  $('ceAddReq').addEventListener('click', () => {
    contentDraft.requisitos.push({ rango: '', minimo: '', ademas: '' });
    renderContentEditor();
  });
  $('ceAddFaq').addEventListener('click', () => {
    contentDraft.faq.push({ q: '', a: '' });
    renderContentEditor();
  });
  $('contentEditor').querySelectorAll('.ce-remove').forEach((btn) => btn.addEventListener('click', () => {
    const list = btn.dataset.list;
    const i = Number(btn.dataset.i);
    contentDraft[list].splice(i, 1);
    renderContentEditor();
  }));
  $('ceLogoFile').addEventListener('change', (e) => uploadBranding('logo', e.target.files[0]));
  $('ceFaviconFile').addEventListener('change', (e) => uploadBranding('favicon', e.target.files[0]));
  $('ceSave').addEventListener('click', saveContent);
}

async function uploadBranding(asset, file) {
  if (!file) return;
  setMsg(`Subiendo ${asset}…`, true);
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch(`/api/admin/content/${asset}`, { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || `No se pudo subir el ${asset}.`, false); return; }
    setMsg(`${asset === 'logo' ? 'Logo' : 'Favicon'} actualizado.`, true);
    applyBranding(data.content);
  } catch (err) {
    console.error(err);
    setMsg('Algo falló subiendo el archivo, prueba otra vez.', false);
  }
}

async function saveContent() {
  const patch = {
    hero: { eyebrow: $('ceEyebrow').value, title: $('ceTitle').value, lead: $('ceLead').value },
    requisitos: [...document.querySelectorAll('#ceRequisitos .ce-row')].map((row) => ({
      rango: row.querySelector('.ce-rango').value,
      minimo: row.querySelector('.ce-minimo').value,
      ademas: row.querySelector('.ce-ademas').value,
    })),
    faq: [...document.querySelectorAll('#ceFaq .ce-row-faq')].map((row) => ({
      q: row.querySelector('.ce-q').value,
      a: row.querySelector('.ce-a').value,
    })),
    footerCredit: $('ceFooter').value,
  };
  try {
    const res = await fetch('/api/admin/content', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'No se pudo guardar.', false); return; }
    setMsg('Contenido guardado.', true);
    contentDraft = data.content;
    applyBranding(data.content);
  } catch {
    setMsg('Error de conexión al guardar.', false);
  }
}

async function loadContentEditor() {
  setMsg('');
  try {
    const res = await fetch('/api/content', { credentials: 'same-origin' });
    contentDraft = await res.json();
    renderContentEditor();
  } catch {
    setMsg('No se pudo cargar el contenido.', false);
  }
}

function showView(view) {
  currentView = view;
  $('tabPending').classList.toggle('active', view === 'pending');
  $('tabAudit').classList.toggle('active', view === 'audit');
  $('tabContent').classList.toggle('active', view === 'content');
  $('appList').hidden = view === 'content';
  $('contentEditor').hidden = view !== 'content';
  if (view === 'content') loadContentEditor();
  else loadApplications();
}

document.addEventListener('DOMContentLoaded', () => {
  $('tabPending').addEventListener('click', () => showView('pending'));
  $('tabAudit').addEventListener('click', () => showView('audit'));
  $('tabContent').addEventListener('click', () => showView('content'));
  loadMe().then(() => { if (currentUser) { loadApplications(); loadStats(); } });
  loadContent();
});
