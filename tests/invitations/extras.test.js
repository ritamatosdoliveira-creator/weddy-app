/* Convites Digitais — Fase 2: validação servidor de titles, hiddenSections, photoFocus, schemaVersion e sincronização com o schema do cliente.
 * Isolado (sem emulador nem rede): extrai invSanitize de index.js. Variável INV_CLIENT_SCHEMA = caminho de convites8/schema.js (por defeito ../../convites8/schema.js). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const a = src.indexOf('const INV_TEMPLATES'), b = src.indexOf('function invSlugBase');
const ctx = { crypto: require('crypto'), URL, console }; vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + ';this.invSanitize = invSanitize; this.INV_SCHEMA = INV_SCHEMA;', ctx);
const { invSanitize, INV_SCHEMA } = ctx;
const clientPath = process.env.INV_CLIENT_SCHEMA || path.join(__dirname, '..', '..', 'convites8', 'schema.js');
const base = (t, x) => Object.assign({ tpl: t, colors: { bg: '#ffffff', ink: '#222222', ac: '#b5654a', soft: '#f3e4da' }, names: 'A & B', date: '2027-07-12' }, x || {});
// 1 sincronização
if (fs.existsSync(clientPath)) {
  global.window = global; const C = require(clientPath).SCHEMA;
  ok(JSON.stringify(Object.keys(C)) === JSON.stringify(Object.keys(INV_SCHEMA)), 'mesmos 8 modelos no cliente e no servidor');
  for (const [k, m] of Object.entries(C)) {
    const e = { ids: m.secoes.map((s) => s.id), req: m.secoes.filter((s) => !s.ocultavel).map((s) => s.id), tit: m.secoes.filter((s) => s.titulo).map((s) => s.id), slots: m.fotos.map((f) => f.slot) };
    ok(JSON.stringify(e) === JSON.stringify(INV_SCHEMA[k]), 'schema servidor = cliente: ' + k);
  }
} else console.log('SKIP sincronização (schema do cliente não encontrado: ' + clientPath + ')');
// 2 convites antigos / sem campos novos
for (const t of ['editorial', 'w-verde', 'w-relevo']) { const r = invSanitize(base(t)); ok(!r.errors.length && r.cfg.schemaVersion === 2 && !r.cfg.titles.x && !r.cfg.hiddenSections.length, 'sem campos novos aceita (' + t + ')'); }
// 3 válidos
const v = invSanitize(base('w-verde', { titles: { programa: '  O nosso dia ', recomendacoes: '' }, hiddenSections: ['presentes', 'presentes', 'hashtag'], photoFocus: { g0: { x: 20.4, y: 80.6 } }, schemaVersion: 2 }));
ok(!v.errors.length, 'válidos sem erros: ' + v.errors);
ok(v.cfg.titles.programa === 'O nosso dia' && !('recomendacoes' in v.cfg.titles), 'títulos aparados; vazio removido');
ok(JSON.stringify(v.cfg.hiddenSections) === '["presentes","hashtag"]', 'ocultas sem duplicados');
ok(v.cfg.photoFocus.g0.x === 20 && v.cfg.photoFocus.g0.y === 81, 'foco arredondado');
// 4 rejeições
const bad = (lbl, x, key) => { const r = invSanitize(base('w-verde', x)); ok(r.errors.some((e) => e.indexOf(key) === 0), 'rejeita ' + lbl + ' → ' + r.errors.join(',')); };
bad('secção inexistente', { hiddenSections: ['nope'] }, 'hiddenSections');
bad('ocultar rsvp', { hiddenSections: ['rsvp'] }, 'hiddenSections.required');
bad('ocultar capa', { hiddenSections: ['capa'] }, 'hiddenSections.required');
bad('ocultar dados obrigatórios', { hiddenSections: ['data'] }, 'hiddenSections.required');
bad('hiddenSections não lista', { hiddenSections: 'presentes' }, 'hiddenSections');
bad('id não string', { hiddenSections: [1] }, 'hiddenSections');
bad('título de secção inexistente', { titles: { nope: 'x' } }, 'titles');
bad('título de secção sem título editável', { titles: { mensagem: 'x' } }, 'titles');
bad('título > 40', { titles: { programa: 'a'.repeat(41) } }, 'titles');
bad('título com <', { titles: { programa: '<b>x' } }, 'titles');
bad('título não string', { titles: { programa: { a: 1 } } }, 'titles');
bad('titles array', { titles: ['x'] }, 'titles');
bad('foco slot inválido', { photoFocus: { cover: { x: 1, y: 1 } } }, 'photoFocus');
bad('foco fora de 0-100', { photoFocus: { g0: { x: 101, y: 1 } } }, 'photoFocus');
bad('foco negativo', { photoFocus: { g0: { x: -1, y: 1 } } }, 'photoFocus');
bad('foco NaN', { photoFocus: { g0: { x: NaN, y: 1 } } }, 'photoFocus');
bad('foco string', { photoFocus: { g0: { x: '5', y: 1 } } }, 'photoFocus');
bad('schemaVersion desconhecida', { schemaVersion: 99 }, 'schemaVersion');
bad('proto', { titles: JSON.parse('{"__proto__":"x"}') }, 'titles');
// 5 modelo antigo sem schema não aceita personalização
const o = invSanitize(base('editorial', { hiddenSections: ['x'] })); ok(o.errors.includes('hiddenSections'), 'modelo sem schema rejeita hiddenSections não vazio');
// 6 campos arbitrários não são gravados
const arb = invSanitize(base('w-verde', { evil: '<script>', __proto__x: 1, titles: { programa: 'ok' } })); ok(!('evil' in arb.cfg) && Object.keys(arb.cfg).every((k) => /^[a-zA-Z]+$/.test(k)), 'campos arbitrários não são gravados');
// 7 título do evento (cer.n) preservado
const ev = invSanitize(base('w-verde', { cer: { n: 'Cerimónia civil', p: 'Igreja', t: '15:00' } })); ok(ev.cfg.cer.n === 'Cerimónia civil', 'cer.n (título do evento) preservado no servidor');
console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
