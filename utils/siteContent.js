const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'siteContent.json');

const DEFAULTS = {
  hero: {
    eyebrow: 'Programa de creadores · BoxPvP',
    title: 'Tu contenido merece un rango en PrismaMC.',
    lead: 'Grabas, editas y subes partidas del server. Nosotros te damos el rango de creador, color en el chat y sitio en los eventos. La solicitud lleva un par de minutos.',
  },
  requisitos: [
    { rango: 'Media', minimo: '150 suscriptores', ademas: '+300 visitas' },
    { rango: 'Twitch', minimo: '200 seguidores', ademas: '+8 espectadores de media' },
    { rango: 'Famous', minimo: '1.250 suscriptores', ademas: '1.500 visitas (o 800 seguidores / +20 espectadores si es en directo)' },
  ],
  faq: [
    { q: '¿Cuánto tarda la revisión?', a: 'Suele ser cuestión de horas o de un par de días, según el volumen. Te avisamos por DM en cuanto haya respuesta.' },
    { q: '¿Puedo volver a aplicar si me rechazan?', a: 'Sí. Revisa que cumples los requisitos y vuelve a enviarla. No hay una segunda solicitud mientras tengas una pendiente.' },
    { q: '¿Por qué una captura y no un enlace?', a: 'Los enlaces se pueden falsear y no queremos que subas nada raro. Una imagen desde tu dispositivo es más segura y clara.' },
    { q: '¿Qué hacéis con mi cuenta de Discord?', a: 'Solo leemos tu nombre y tu avatar para identificarte y crear tu cuenta aquí. No publicamos nada ni tocamos tus servidores.' },
  ],
  footerCredit: 'Hecho por 9q2IsToXiC',

  logoUrl: 'https://dunb17ur4ymx4.cloudfront.net/webstore/logos/3af334ae8bf7261a4247552af9a7c2adbd57934e.png',
  faviconUrl: 'https://dunb17ur4ymx4.cloudfront.net/webstore/logos/3af334ae8bf7261a4247552af9a7c2adbd57934e.png',
};

function getSiteContent() {
  return readJSON(DB_PATH, DEFAULTS);
}

function updateSiteContent(patch) {
  const current = getSiteContent();
  const next = { ...current, ...patch };
  writeJSON(DB_PATH, next);
  return next;
}

module.exports = { getSiteContent, updateSiteContent, DEFAULTS };
