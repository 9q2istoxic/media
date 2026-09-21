

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emojiToTwemojiUrl(emoji) {
  const codepoints = [...emoji].map((c) => c.codePointAt(0).toString(16)).join('-');
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${codepoints}.svg`;
}

const SIMPLE_EMOJI_RE = /\p{Extended_Pictographic}/gu;

function formatContent(text, ctx) {
  if (!text) return '';
  let out = esc(text);

  out = out.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
    const name = ctx.userNames?.[id] || id;
    return `<discord-mention type="user">${esc(name)}</discord-mention>`;
  });
  out = out.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
    const role = ctx.roles?.[id];
    const color = role?.color ? ` color="${role.color}"` : '';
    return `<discord-mention type="role"${color}>${esc(role?.name || id)}</discord-mention>`;
  });
  out = out.replace(/&lt;#(\d+)&gt;/g, (_, id) => {
    const name = ctx.channelNames?.[id] || id;
    return `<discord-mention type="channel">${esc(name)}</discord-mention>`;
  });

  out = out.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, animated, name, id) => {
    const ext = animated ? 'gif' : 'webp';
    return `<discord-custom-emoji name="${esc(name)}" url="https://cdn.discordapp.com/emojis/${id}.${ext}"></discord-custom-emoji>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<discord-bold>$1</discord-bold>');
  out = out.replace(/(?:^|[^*])\*([^*]+)\*(?!\*)/g, (m, inner) => m.replace(`*${inner}*`, `<discord-italic>${inner}</discord-italic>`));
  out = out.replace(/`([^`]+)`/g, '<discord-inline-code>$1</discord-inline-code>');

  out = out.replace(SIMPLE_EMOJI_RE, (emoji) => {
    const url = emojiToTwemojiUrl(emoji);
    return `<discord-custom-emoji name="${esc(emoji)}" url="${url}" embed-emoji="false"></discord-custom-emoji>`;
  });

  return out;
}

function buildEmbedHtml(embed, ctx) {
  const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : undefined;
  let html = `<discord-embed slot="embeds"${embed.title ? ` embed-title="${esc(embed.title)}"` : ''}${color ? ` color="${color}"` : ''}>`;
  if (embed.description) {
    html += `<discord-embed-description slot="description">${formatContent(embed.description, ctx)}</discord-embed-description>`;
  }
  if (embed.fields?.length) {
    html += '<discord-embed-fields slot="fields">';
    embed.fields.forEach((f, i) => {
      html += `<discord-embed-field field-title="${esc(f.name)}" inline="${f.inline ? 'true' : 'false'}" inline-index="${i}">${formatContent(f.value, ctx)}</discord-embed-field>`;
    });
    html += '</discord-embed-fields>';
  }
  if (embed.footer?.text) {
    html += `<discord-embed-footer slot="footer"${embed.timestamp ? ` timestamp="${new Date(embed.timestamp).toISOString()}"` : ''}>${esc(embed.footer.text)}</discord-embed-footer>`;
  }
  html += '</discord-embed>';
  return html;
}

function buildButtonsHtml(components) {
  if (!components?.length) return '';
  const rows = components.map((row) => {
    const buttons = (row.components || []).map((btn) => {
      const styleMap = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'destructive', 5: 'link' };
      const type = styleMap[btn.style] || 'secondary';
      const emojiAttr = btn.emoji?.name ? ` emoji="${emojiToTwemojiUrl(btn.emoji.name)}"` : '';
      return `<discord-button type="${type}"${emojiAttr}>${esc(btn.label || '')}</discord-button>`;
    }).join('');
    return `<discord-action-row>${buttons}</discord-action-row>`;
  }).join('');
  return `<discord-attachments slot="components">${rows}</discord-attachments>`;
}

function generateTicketTranscript({ guild, channel, messages }) {
  const ctx = { userNames: {}, roles: {}, channelNames: {} };
  const profiles = {};

  for (const m of messages) {
    const author = m.author;
    if (!author) continue;
    ctx.userNames[author.id] = author.username;
    if (!profiles[author.id]) {
      const member = m.member;
      const topRole = member?.roles?.highest && member.roles.highest.id !== guild?.id ? member.roles.highest : null;
      profiles[author.id] = {
        author: member?.displayName || author.username,
        avatar: author.displayAvatarURL({ extension: 'webp', size: 64 }),
        roleColor: topRole ? `#${topRole.color.toString(16).padStart(6, '0')}` : '#000000',
        roleName: topRole?.name,
        bot: !!author.bot,
        verified: false,
      };
    }
  }

  const messagesHtml = messages.map((m) => {
    const parts = [];
    const attrs = [
      `id="m-${m.id}"`,
      `timestamp="${m.createdAt.toISOString()}"`,
      `edited="${m.editedTimestamp ? 'true' : 'false'}"`,
      `highlight="false"`,
      `profile="${m.author.id}"`,
    ];

    if (m.reference?.messageId) {
      const original = messages.find((x) => x.id === m.reference.messageId);
      if (original) {
        const originalProfile = profiles[original.author.id];
        attrs.push('server="false"');
        parts.push(`<discord-reply slot="reply" edited="false" attachment="false" author="${esc(originalProfile?.author || original.author.username)}" avatar="${esc(original.author.displayAvatarURL({ extension: 'webp', size: 32 }))}" role-color="${originalProfile?.roleColor || '#000000'}" bot="${original.author.bot}" verified="false" op="false" command="false"><span data-goto="${original.id}">${formatContent(original.content, ctx)}</span></discord-reply>`);
      }
    }

    if (m.content) parts.push(formatContent(m.content, ctx));
    m.embeds?.forEach((e) => parts.push(buildEmbedHtml(e, ctx)));
    if (m.components?.length) parts.push(buildButtonsHtml(m.components));

    return `<discord-message ${attrs.join(' ')}>${parts.join('')}</discord-message>`;
  }).join('');

  const guildIcon = guild?.iconURL?.({ extension: 'png', size: 128 }) || '';

  return `<html><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="icon" type="image/png" href="${esc(guildIcon)}"/><title>${esc(channel?.name || 'ticket')}</title>
<script>document.addEventListener("click",t=>{let e=t.target;if(!e)return;let o=e?.getAttribute("data-goto");if(o){let r=document.getElementById(\`m-\${o}\`);r?(r.scrollIntoView({behavior:"smooth",block:"center"}),r.style.backgroundColor="rgba(148, 156, 247, 0.1)",r.style.transition="background-color 0.5s ease",setTimeout(()=>{r.style.backgroundColor="transparent"},1e3)):console.warn("Message \${goto} not found.")}});</script>
<script>window.$discordMessage={profiles:${JSON.stringify(profiles)}}</script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@derockdev/discord-components-core@^3.6.1/dist/derockdev-discord-components-core/derockdev-discord-components-core.esm.js"></script>
</head><body style="margin:0;min-height:100vh"><discord-messages style="min-height:100vh"><discord-header guild="${esc(guild?.name || '')}" channel="${esc(channel?.name || '')}" icon="${esc(guildIcon)}">This is the start of #${esc(channel?.name || '')} channel.</discord-header>${messagesHtml}<div style="text-align:center;width:100%">Exported ${messages.length} messages. </div></discord-messages></body></html>`;
}

module.exports = { generateTicketTranscript, formatContent, emojiToTwemojiUrl };
