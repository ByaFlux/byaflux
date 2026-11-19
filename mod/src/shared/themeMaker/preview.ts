/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { defaults, EMOJI_BASE, ThemeChoices, themeModules, themeRules } from "./index";

export const SERVER_IMAGE =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#ffb66d"/><stop offset="1" stop-color="#e96129"/></linearGradient></defs><rect width="48" height="48" fill="url(#a)"/><path d="m24 8 15 9-15 9-9-5v7l9 5 15-9v9L24 42 9 33V17Z" fill="#fff0df"/></svg>'
    );
export const EMOJI_EXAMPLES = [
    { name: "grinning", text: "😀", hash: "f753793200a49ad6" },
    { name: "joy", text: "😂", hash: "3eb3ebe2d01299ec" },
    { name: "heart_eyes", text: "😍", hash: "ba7ea799dbe629ce" },
    { name: "sunglasses", text: "😎", hash: "95aa1f1ff050d571" }
] as const;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function avatar(label: string, state: string, size = 32, id = label + size) {
    const colors: Record<string, string> = {
        online: "#23a55a",
        idle: "#f0b232",
        dnd: "#f23f43",
        offline: "#80848e"
    };
    const image =
        "data:image/svg+xml," +
        encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${label === "Haru" ? "#66538f" : "#355c71"}"/><text x="50%" y="54%" fill="white" font-family="sans-serif" font-size="${size * 0.4}" text-anchor="middle" dominant-baseline="middle">${label.slice(0, 1)}</text></svg>`
        );
    return `<span class="ctm-avatar wrapper_XpIUHy" data-status="${state}" style="width: ${size}px; height: ${size}px;"><svg class="mask_XpIUHy" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><mask id="avatar-${id}"><rect width="100%" height="100%" fill="white"/><circle cx="${size - 4}" cy="${size - 4}" r="7" fill="black"/></mask><mask id="status-${id}"><rect width="100%" height="100%" fill="white"/>${state === "dnd" ? `<rect x="${size - 9}" y="${size - 5}" width="8" height="2" fill="black"/>` : state === "idle" ? `<circle cx="${size - 9}" cy="${size - 9}" r="5" fill="black"/>` : state === "offline" ? `<circle cx="${size - 4}" cy="${size - 4}" r="3" fill="black"/>` : ""}</mask></defs><foreignObject x="0" y="0" width="${size}" height="${size}" mask="url(#avatar-${id})"><img alt="${label}" src="${image}" width="${size}" height="${size}"/></foreignObject><rect x="${size - 10}" y="${size - 10}" width="12" height="12" rx="6" fill="${colors[state]}" mask="url(#status-${id})"/></svg></span>`;
}
export function previewPayload(choices: ThemeChoices, before: boolean, highlight: string) {
    const original = { ...defaults(), accent: "#5865f2" };
    const c = before ? original : choices;
    return {
        css: themeRules(c),
        radial: themeModules(c).find(m => m.id === "radial")?.url ?? "",
        pack: c.emoji,
        packUrl: c.emoji === "Discord" ? "" : `${EMOJI_BASE}/base/${c.emoji}.css`,
        highlight,
        background: c.background.enabled ? c.background.url : ""
    };
}
export function previewDocument(token: string): string {
    const guild = (n: number) =>
        `<div class="blobContainer_preview"><button class="server" data-list-item-id="guildsnav___${n}" aria-label="Servidor ${n}"><svg width="48" height="48"><defs><mask id="server-${n}"><rect width="48" height="48" rx="16" fill="white"/></mask></defs><foreignObject width="48" height="48" mask="url(#server-${n})"><img class="icon_preview" src="${escape(SERVER_IMAGE)}" width="48" height="48" alt=""/></foreignObject></svg>${n === 1 ? '<span class="pill" aria-label="Atividade"></span><span class="mentions" aria-label="3 menções">3</span>' : ""}</button></div>`;
    const emoji = () =>
        EMOJI_EXAMPLES.map(
            e =>
                `<span class="emoji-slot"><img class="emoji" data-emoji="${e.name}" data-default="https://discord.com/assets/${e.hash}.svg" src="https://discord.com/assets/${e.hash}.svg" alt="${e.text}"/><span class="emoji-fallback" hidden>${e.text}</span></span>`
        ).join("");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src https: 'unsafe-inline'; font-src https: data:; connect-src https:; script-src 'nonce-${token}';"><style>
:root{color-scheme:dark;--custom-guild-list-width:72px;--custom-guild-sidebar-width:312px;--brand-500:#5865f2;font-family:system-ui,sans-serif;font-size:13px;color:#f1f1f4}*{box-sizing:border-box}body{margin:0}button{font:inherit;color:inherit;border:0;cursor:pointer}#app-mount{min-width:690px;background:#25252c;min-height:650px;display:grid;grid-template-columns:var(--custom-guild-list-width) var(--custom-guild-sidebar-width) minmax(175px,1fr) 120px}.guilds_preview{background:#1b1b21;padding:18px 4px;display:flex;align-items:center;flex-direction:column;gap:12px}.server{width:48px;height:48px;padding:0;background:none;position:relative;display:block}.icon_preview{display:block;object-fit:cover}.pill{position:absolute;left:-8px;top:14px;width:4px;height:20px;background:white;border-radius:5px}.mentions{position:absolute;right:-4px;bottom:-3px;border:3px solid #1b1b21;border-radius:20px;background:#e3444a;font-size:11px;min-width:22px;height:22px;display:grid;place-items:center;font-weight:bold}.separator{width:30px;height:2px;background:#373740}.add{border-radius:16px;background:#30303a;color:#43b581;font-size:30px}.sidebar_preview{background:#202027;padding:18px 12px;display:flex;flex-direction:column}.server-title{font-size:17px;font-weight:750;padding-bottom:17px;border-bottom:1px solid #ffffff0d}.label{font-size:10px;letter-spacing:.07em;color:#94949f;margin:22px 4px 9px}.channel{padding:9px;color:#a9a9b4;border-radius:7px;margin-bottom:3px}.channel.active{background:color-mix(in srgb,var(--brand-500) 22%,transparent);color:#fff}.channel.active span,.brand{color:var(--brand-500)}.current-user{display:flex;gap:9px;align-items:center;margin-top:auto;padding-top:16px}.chat_preview{display:flex;flex-direction:column;min-width:0}.chat-header{border-bottom:1px solid #ffffff0e;padding:17px;font-size:15px;font-weight:700}.chatContent_preview{flex:1;padding:20px 14px;background:#25252c}.welcome{font-size:20px;margin:4px 0 8px;font-weight:750}.hint{color:#9d9da8;font-size:11px;line-height:1.5}.message{display:flex;gap:9px;margin-top:24px}.message-body{flex:1;min-width:0}.message p{line-height:1.7;margin:7px 0;font-size:13px}.time{font-size:9px;color:#9696a3;margin-left:6px}.emoji{width:23px;height:23px;vertical-align:middle;object-fit:contain}.emoji-slot{display:inline-block;margin-right:4px}.emoji-fallback{font-size:22px}.composer{padding:12px;margin:12px;border-radius:9px;background:#38383f;color:#a7a7b2;font-size:12px}.members_preview{background:#202027;padding:18px 8px}.member{display:flex;gap:7px;align-items:center;margin:16px 0}.member strong{font-size:11px}.ctm-avatar{display:inline-block;flex-shrink:0;vertical-align:middle}.ctm-avatar img{border-radius:50%;display:block;object-fit:cover}.ctm-avatar svg{overflow:visible}.states{display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-top:23px}.state{display:flex;align-items:center;gap:7px;font-size:10px;color:#b9b9c5}.profile-sizes{display:flex;align-items:center;gap:20px;margin:22px 0 0;flex-wrap:wrap}.profile-sizes>div{text-align:center}.profile-sizes small{display:block;margin-top:8px;color:#a8a8b4;font-size:9px}body[data-highlight=accent] .brand,body[data-highlight=accent] .channel.active,body[data-highlight=compact] .sidebar_preview,body[data-highlight=icons] .guilds_preview,body[data-highlight=status] .ctm-avatar,body[data-highlight=emoji] .emoji-slot,body[data-highlight=background] .chatContent_preview{outline:2px dashed #ff883e;outline-offset:4px}body[data-highlight=background] .chatContent_preview{outline-offset:-5px}
</style><style id="ctm-theme"></style></head><body><div id="app-mount"><nav class="guilds_preview" aria-label="Servidores">${[1, 2, 3, 4].map(guild).join("")}<div class="separator"></div><button class="server add" aria-label="Adicionar servidor">+</button></nav><aside class="sidebar_preview"><div class="server-title">Estúdio ByaFlux <span style="float:right;color:#999">⌄</span></div><div class="label">CANAIS DE TEXTO</div><div class="channel active"><span>#</span> geral</div><div class="channel"># projetos</div><div class="channel"># referências</div><div class="channel"># off-topic</div><div class="label">CANAIS DE VOZ</div><div class="channel">◖ Reunião</div><div class="channel">◖ Trabalho</div><div class="current-user">${avatar("Haru", "online", 32, "self")}<div><strong>Haru</strong><div class="hint">Disponível</div></div></div></aside><main class="chat_preview"><header class="chat-header"># geral <span style="float:right;color:#9696a3">♧ ···</span></header><div class="chatContent_preview"><div class="welcome">Seu espaço, seu estilo.</div><div class="hint">Compare as escolhas antes de ativar o tema.</div><div class="message">${avatar("Haru", "online", 32, "message1")}<div class="message-body"><strong class="brand">Haru</strong><span class="time">Hoje às 14:27</span><p>Curti essa cor!</p><div>${emoji()}</div></div></div><div class="message">${avatar("Kaito", "idle", 32, "message2")}<div class="message-body"><strong>Kaito</strong><span class="time">Hoje às 14:31</span><p>Vou testar outro fundo.</p><div>${emoji()}</div></div></div><div class="states">${["online", "idle", "dnd", "offline"].map((state, i) => `<div class="state">${avatar(["Haru", "Kaito", "Luna", "Niko"][i], state, 32, "state" + i)}<span>${["Online", "Ausente", "Não perturbe", "Offline"][i]}</span></div>`).join("")}</div><div class="profile-sizes"><div>${avatar("Haru", "online", 80, "popout")}<small>Popout · 80 px</small></div><div>${avatar("Kaito", "idle", 120, "profile")}<small>Perfil · 120 px</small></div></div></div><div class="composer">＋ Conversar em #geral <span style="float:right">☺</span></div></main><aside class="members_preview"><div class="label">MEMBROS — 4</div>${["online", "idle", "dnd", "offline"].map((state, i) => `<div class="member">${avatar(["Haru", "Kaito", "Luna", "Niko"][i], state, 32, "member" + i)}<strong>${["Haru", "Kaito", "Luna", "Niko"][i]}</strong></div>`).join("")}</aside></div>
<script nonce="${token}">
const token=${JSON.stringify(token)};
let generation=0,pack='Discord',failed=false,controller;
const images=[...document.querySelectorAll('[data-emoji]')];
const report=(kind,text)=>parent.postMessage({type:'byaflux-ctm-resource',token,kind,text},'*');
function defaults(){for(const image of images){image.hidden=false;image.nextElementSibling.hidden=true;image.src=image.dataset.default}}
function failure(name){if(failed)return;failed=true;report('emoji',name);defaults()}
for(const image of images){image.onerror=()=>{if(pack!=='Discord'&&!failed)failure(pack);else{image.hidden=true;image.nextElementSibling.hidden=false}}}
window.addEventListener('message',async event=>{
 if(event.source!==parent||event.data?.type!=='byaflux-ctm-render'||event.data.token!==token)return;
 const data=event.data.payload;
 document.getElementById('ctm-theme').textContent=data.css;
 document.body.dataset.highlight=data.highlight;
 let radial=document.getElementById('ctm-radial');
 if(!data.radial){radial?.remove()}else if(!radial){radial=document.createElement('link');radial.id='ctm-radial';radial.rel='stylesheet';radial.href=data.radial;radial.onerror=()=>report('radial','RadialStatus');document.head.prepend(radial)}
 if(data.pack!==pack){
  const current=++generation;controller?.abort();controller=new AbortController();pack=data.pack;failed=false;report('emoji','');defaults();
  if(pack!=='Discord'){
   const selected=pack;
   for(const image of images){image.src=${JSON.stringify(EMOJI_BASE)}+'/emojis/'+selected+'/people/'+image.dataset.emoji+'.png'}
   try{const response=await fetch(data.packUrl,{signal:controller.signal});if(!response.ok)throw Error();}catch(error){if(current===generation&&error.name!=='AbortError')failure(selected)}
  }
 }
});
parent.postMessage({type:'byaflux-ctm-ready',token},'*');
</script></body></html>`;
}
