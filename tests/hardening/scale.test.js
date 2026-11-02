/* Fase K — volume e fusão de estado (sem emulador, sem rede, dados fictícios).
 * (1) 50/150/300/500/1000 convidados: tamanho do JSON vs limite do servidor (900 000), tempo do validador,
 *     da contagem de RSVP e do resumo; (2) fusão de edições de dois dispositivos (mergeIncomingWeddingState extraída
 *     de app/index.html): secções diferentes preservam ambas; mesma secção → vence a alteração local (last-write-wins
 *     INTENCIONAL por secção); sem baseline aceita o servidor. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const guest = (i) => ({ id: 'g' + i, guestId: 'gid' + i, name: 'Convidado Ficticio ' + i, phone: '+3519000' + String(i).padStart(5, '0'), email: 'c' + i + '@exemplo.invalid', notes: 'nota '.repeat(8), rsvpStatus: i % 3 ? 'yes' : 'pending', diet: 'sem restricoes', table: 1 + (i % 60),
  logistics: { v: 1, food: { allergies: i % 9 ? [] : ['marisco'], diet: 'vegetariano' }, access: { mobility: i % 25 === 0 } } });
const stateOf = (n) => ({ guests: { noiva: { familia: Array.from({ length: n }, (_, i) => guest(i)), amigos: [], duvida: [], staff: [], custom: [] }, noivo: { familia: [], amigos: [], duvida: [], staff: [], custom: [] }, conjunto: { familia: [], amigos: [], duvida: [], staff: [], custom: [] } }, confirmed: {}, expenses: [], categories: [], seating: { tables: [], assignments: {}, items: [] }, budget: { total: 20000, guestsEstimate: n }, daySchedule: [], suppliers: [], todos: [] });
for (const n of [50, 150, 300, 500, 1000]) {
  const raw = JSON.stringify(stateOf(n));
  const t0 = Date.now(); const v = T.validateWeddingState(raw); const dt = Date.now() - t0;
  console.log(`INFO ${n} convidados: ${raw.length} caracteres (${Math.round(raw.length / 9000)}% do limite 900000), validação ${dt} ms, severidade ${v.severity}`);
  ok(raw.length < 900000, `${n} convidados cabem no limite do documento (${raw.length} < 900000)`);
  ok(v.severity === 'ok' && dt < 1500, `${n} convidados: estado válido e validado em ${dt} ms`);
  const docs = Array.from({ length: n }, (_, i) => ({ attending: i % 3 === 0 ? true : i % 3 === 1 ? false : null, rsvpStatus: i % 5 === 0 ? 'maybe' : '' }));
  const t1 = Date.now(); const tl = T.tallyRsvpDocs(docs); const d1 = Date.now() - t1;
  ok(tl.yes + tl.no + tl.maybe + tl.pending >= n && d1 < 200, `${n} convidados: contagem de RSVP em ${d1} ms`);
  const t2 = Date.now(); T.buildDigestData(stateOf(n), tl, new Date(), true); ok(Date.now() - t2 < 500, `${n} convidados: resumo por email em ${Date.now() - t2} ms`);
}
// Limite de produto do AI Seating: 800 (não alterado nesta fase) — documentado
ok(T.SEATING_LIMITS.MAX_GUESTS === 800, 'AI Seating mantém o limite de produto de 800 convidados (1000 → TOO_LARGE, testado na Fase D)');
// Fusão de dois dispositivos (código REAL da app)
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); const s = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } } return src.slice(i, j + 1); };
const ctx = {}; vm.createContext(ctx); vm.runInContext(grab('mergeHealthHistory') + '\n' + grab('mergeIncomingWeddingState') + '\nthis.merge = mergeIncomingWeddingState;', ctx);
const base = { guests: { a: 1 }, tables: { t: 1 }, todos: ['x'], budget: { total: 10 } };
let m = ctx.merge({ ...base, tables: { t: 2 } }, { ...base, guests: { a: 9 } }, base);
ok(m.tables.t === 2 && m.guests.a === 9, 'dois dispositivos, secções diferentes: ambas as alterações preservadas');
m = ctx.merge({ ...base, tables: { t: 2 } }, { ...base, tables: { t: 3 } }, base);
ok(m.tables.t === 2, 'mesma secção: vence a alteração local (last-write-wins por secção, intencional)');
m = ctx.merge({ ...base, todos: ['x', 'y'] }, { ...base, todos: ['x', 'z'] }, base);
ok(JSON.stringify(m.todos) === '["x","y"]', 'mesma secção (lista): a local não é fundida item a item — limitação documentada');
m = ctx.merge({ a: 1 }, { a: 2 }, null); ok(m.a === 2, 'sem baseline (1.ª sincronização) aceita o servidor');
m = ctx.merge(base, { ...base, extra: 5 }, base); ok(m.extra === 5, 'chave nova só no servidor é aceite');
m = ctx.merge({ ...base, mine: 1 }, { ...base }, base); ok(m.mine === 1, 'chave nova só local não é apagada pelo servidor');
console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
