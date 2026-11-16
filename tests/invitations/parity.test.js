/* Convites Digitais — Fase 3: o que o servidor guarda ao publicar é exatamente o que o rascunho mostrava.
 * Para os 8 modelos: render(sanitize cliente do rascunho) === render(sanitize cliente do snapshot devolvido por invSanitize no servidor).
 * Isolado (sem emulador). Variável INV_CLIENT_DIR = raiz do cliente (por defeito ../../ ). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } };
const R = (process.env.INV_CLIENT_DIR || path.join(__dirname, '..', '..')) + '/';
if (!fs.existsSync(R + 'weddyinvite.js')) { console.log('cliente não encontrado em ' + R + ' — definir INV_CLIENT_DIR'); process.exit(0); }
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const ctx = { crypto: require('crypto'), URL, console }; vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('const INV_TEMPLATES'), src.indexOf('function invSlugBase')) + ';this.invSanitize = invSanitize;', ctx);
global.window = global; global.document = { currentScript: { src: 'http://localhost/weddyinvite-w.js' } };
require(R + 'weddyinvite-w.js');
for (const f of fs.readdirSync(R + 'convites8').filter((f) => /^m-.*\.js$/.test(f))) require(R + 'convites8/' + f);
require(R + 'weddyinvite.js'); require(R + 'convites8/schema.js');
if (!global.qrcode) { const q = require(R + 'convites8/qrcode.js'); global.qrcode = typeof q === 'function' ? q : q.qrcode; }
const W = global.WeddyInvite, SC = global.WeddyInviteSchema.SCHEMA;
const IMG = 'https://firebasestorage.googleapis.com/v0/b/x/o/invitations%2Fw1%2F';
for (const tpl of Object.keys(SC)) {
  const m = SC[tpl], opt = m.secoes.filter((s) => s.ocultavel).map((s) => s.id), tit = m.secoes.filter((s) => s.titulo)[0];
  const draft = { tpl, lang: 'pt', names: 'Ana & Rui', date: '2027-07-12', time: '16:00', venue: 'Quinta', address: 'Sintra', message: 'Mensagem', intro: 'Intro', quote: 'Citação', story: 'História', parents: 'A\nB', dress: 'Formal', dressF: 'Texto F', dressM: 'Texto M', thanks: 'Obrigada a todos', gifts: 'Presentes', tips: 'Wifi: sim', kids: 'Bem-vindas', hash: '#anaerui', hotel: 'Hotel', hotelUrl: 'https://hotel.pt', giftUrl: 'https://p.pt', org: 'Maria', orgTel: '+351 912 345 678', flowers: 'Peónias', mono: 'A·R',
    song: { t: 'Canção', a: 'Artista', u: 'https://open.spotify.com/track/abc' }, program: [{ t: '16:00', d: 'Cerimónia' }, { t: '18:00', d: 'Jantar' }], cer: { t: '16:00', p: 'Capela', a: 'Sintra', n: 'Cerimónia civil' }, rec: { t: '18:00', p: 'Salão', a: 'Sintra', n: 'Copo de água' },
    photos: { cover: IMG + 'c.jpg?alt=media', gallery: [IMG + 'a.jpg?alt=media', IMG + 'b.jpg?alt=media', IMG + 'c2.jpg?alt=media', IMG + 'd.jpg?alt=media'] },
    titles: tit ? { [tit.id]: 'Título meu' } : {}, hiddenSections: opt.slice(0, 2), photoFocus: { [m.fotos[0].slot]: { x: 30, y: 70 } }, schemaVersion: 2 };
  draft.colors = W.sanitize(draft, 'pt').colors; // como a app: publica a configuração já resolvida (cores incluídas)
  const srv = ctx.invSanitize(draft);
  ok(srv.errors.length === 0, tpl + ' servidor aceita o rascunho: ' + JSON.stringify(srv.errors));
  const a = W.page(W.sanitize(draft, 'pt'), { token: 'abcdefgh12345678', mode: 'public' }).html;
  const b = W.page(W.sanitize(srv.cfg, 'pt'), { token: 'abcdefgh12345678', mode: 'public' }).html;
  ok(a === b, tpl + ' público = rascunho (render idêntico)');
  ok(!/img\.test|Exemplo|demo\//.test(b), tpl + ' sem fotografias de demonstração');
  ok(/rsvp\.html\?g=abcdefgh12345678/.test(b), tpl + ' RSVP com token');
  ok(JSON.stringify(srv.cfg.hiddenSections) === JSON.stringify(opt.slice(0, 2)), tpl + ' secções ocultas preservadas');
  if (tit) ok(srv.cfg.titles[tit.id] === 'Título meu', tpl + ' título preservado');
  // secções obrigatórias não ocultáveis
  const req = m.secoes.find((s) => !s.ocultavel);
  const s2 = ctx.invSanitize(Object.assign({}, draft, { hiddenSections: [req.id] }));
  ok(s2.errors.length > 0 || !s2.cfg.hiddenSections.includes(req.id), tpl + ' obrigatória ' + req.id + ' não pode ser ocultada');
}
console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
