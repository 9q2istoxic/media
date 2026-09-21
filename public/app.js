'use strict';

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadMe() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    const data = await res.json();
    renderNav(data.user);
    wireHeroStart(data.user);
  } catch {
    renderNav(null);
    wireHeroStart(null);
  }
}

function renderNav(user) {
  const nav = $('navAuth');
  if (!nav) return;
  if (user) {
    nav.innerHTML = `<a class="nav-chip" href="/account/${encodeURIComponent(user.id)}">
      <img src="${escapeHtml(user.avatar)}" alt="" />${escapeHtml(user.globalName)}
    </a>`;
  } else {
    nav.innerHTML = `<a class="nav-login" href="/auth/discord">Iniciar sesión</a>`;
  }
}

function wireHeroStart(user) {
  const btn = $('heroStart');
  if (!btn) return;
  if (user) btn.href = `/account/${encodeURIComponent(user.id)}`;

}

function handleLoginQuery() {
  const params = new URLSearchParams(location.search);
  const needsTurnstile = params.get('turnstile') === 'requerido';
  if (params.get('login') || needsTurnstile) history.replaceState(null, '', location.pathname + location.hash);
  if (needsTurnstile) showTurnstileChallenge();
}

function waitForTurnstile(cb, attemptsLeft = 50) {
  if (window.turnstile) return cb();
  if (attemptsLeft <= 0) return;
  setTimeout(() => waitForTurnstile(cb, attemptsLeft - 1), 100);
}

async function showTurnstileChallenge() {
  let siteKey = null;
  try {
    const res = await fetch('/api/turnstile-sitekey');
    siteKey = (await res.json()).siteKey;
  } catch {
    return;
  }
  if (!siteKey) return;

  const overlay = $('turnstileOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  waitForTurnstile(() => {
    window.turnstile.render('#turnstileWidget', {
      sitekey: siteKey,
      callback: async (token) => {
        try {
          const res = await fetch('/api/turnstile-verify', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if ((await res.json()).ok) {
            location.href = '/auth/discord';
            return;
          }
        } catch {

        }
      },
    });
  });
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

function applyHomeContent(content) {
  if (content.hero) {
    if ($('heroEyebrow')) $('heroEyebrow').textContent = content.hero.eyebrow;
    if ($('heroTitle')) $('heroTitle').textContent = content.hero.title;
    if ($('heroLead')) $('heroLead').textContent = content.hero.lead;
  }
  if (Array.isArray(content.requisitos) && $('reqTableBody')) {
    $('reqTableBody').innerHTML = content.requisitos.map((r) => `
      <tr><th scope="row">${escapeHtml(r.rango)}</th><td>${escapeHtml(r.minimo)}</td><td>${escapeHtml(r.ademas)}</td></tr>
    `).join('');
  }
  if (Array.isArray(content.faq) && $('faqList')) {
    $('faqList').innerHTML = content.faq.map((f) => `
      <details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>
    `).join('');
  }
}

async function loadContent() {
  try {
    const res = await fetch('/api/content');
    const content = await res.json();
    applyBranding(content);
    applyHomeContent(content);
  } catch {

  }
}

document.addEventListener('DOMContentLoaded', () => {
  handleLoginQuery();
  loadMe();
  loadContent();
});
