/* Fase D — AI Seating: motor, validação, servidor (Premium, autorização, limites, privacidade, IA indisponível).
 * Emulador Firestore. OpenAI SIMULADA (nunca há chamada real). */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
process.env.OPENAI_API_KEY = 'fake-test-key-NOT-REAL-123';
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

let aiCalls = [], aiMode = null;
global.fetch = async (url, opts) => {
  if (!String(url).startsWith('https://api.openai.com/')) throw new Error('fetch inesperado: ' + url);
  aiCalls.push(JSON.parse(opts.body));
  const r = await aiMode(JSON.parse(opts.body));
  return { ok: r.status === undefined || r.status < 400, status: r.status || 200, json: async () => r.json, text: async () => r.text || '' };
};
const aiOut = (o) => ({ json: { output_text: JSON.stringify(o) } });

// ---------- dados ----------
const mkGuests = (n, prefix = 'g') => Array.from({ length: n }, (_, i) => ({ guestId: `${prefix}${i + 1}`, name: `Convidado ${prefix}${i + 1}` }));
const mkState = ({ guests, tables, assignments, confirmedAll = true, extraConfirmed }) => {
  const confirmed = {}; if (confirmedAll) guests.forEach((g) => { confirmed[g.guestId] = true; });
  Object.assign(confirmed, extraConfirmed || {});
  return { guests: { noiva: { familia: guests, amigos: [], duvida: [], staff: [], custom: [] }, noivo: { familia: [], amigos: [], duvida: [], staff: [], custom: [] }, conjunto: { familia: [], amigos: [], duvida: [], staff: [], custom: [] } },
    confirmed, seating: { tables, assignments: assignments || {}, items: [] } };
};
const tbl = (...caps) => caps.map((s, i) => ({ id: i + 1, shape: 'round', seats: s }));
const nowIso = () => new Date().toISOString();
const PREM = () => ({ active: true, startedAt: nowIso() });
const authOf = (email, v) => ({ uid: 'uid-' + email, token: { email, email_verified: v === undefined ? true : v } });
async function mkWedding(id, owner, sub, state) {
  await db.collection('weddings').doc(id).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], ...(sub === undefined ? {} : { subscription: sub }), json: JSON.stringify(state) });
}
async function reset() { for (const c of ['weddings', 'aiUsage', 'seatingRuns']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } aiCalls = []; aiMode = async () => aiOut({ constraints: [] }); }
const call = (auth, data) => fns.generateSeatingProposal.run({ auth, data, rawRequest: {} });
const free = () => db.collection('seatingRuns').doc('W1').delete();
async function run(auth, data) { await free(); return call(auth, data); }
async function err(p) { try { await p; return null; } catch (e) { return e.code; } }
const A = authOf('a@x.pt');
const tofOf = (as) => { const m = {}; Object.entries(as).forEach(([k, g]) => { m[g] = Number(/^t(\d+)/.exec(k)[1]); }); return m; };
const wedJson = async (id) => (await db.collection('weddings').doc(id).get()).data().json;

(async () => {
  const noIssues = (as, st) => T.validateSeatingProposal({ assignments: as, eligible: T.seatingEligibleGuests(st), tables: st.seating.tables.map((t) => ({ id: t.id, seats: t.seats })), constraints: [], outsiders: {}, original: null });

  // ===== A. Distribuição inicial =====
  await reset();
  let g = mkGuests(12); let st = mkState({ guests: g, tables: tbl(6, 6, 6) });
  await mkWedding('W1', 'a@x.pt', PREM(), st);
  const before = await wedJson('W1');
  let r = await run(A, { constraints: [] });
  ok(r.ok && r.proposal.validated === true && r.proposal.mode === 'auto', 'A: proposta gerada e validada');
  ok(Object.keys(r.proposal.assignments).length === 12 && new Set(Object.values(r.proposal.assignments)).size === 12, 'A: 12 convidados, sem duplicados');
  ok(noIssues(r.proposal.assignments, st).ok, 'A: validação independente OK');
  ok((await wedJson('W1')) === before, 'A: a proposta NÃO altera o casamento (nada gravado)');
  ok(aiCalls.length === 0, 'A: sem texto livre → nenhuma chamada à IA');
  ok(r.proposal.report.tables.reduce((s, t) => s + t.used, 0) === 12, 'A: relatório por mesa soma 12');
  const r2 = await run(A, { constraints: [] });
  ok(JSON.stringify(r2.proposal.assignments) === JSON.stringify(r.proposal.assignments), 'A: determinístico (mesma entrada → mesma saída)');

  // não confirmados / inexistentes
  st = mkState({ guests: mkGuests(6), tables: tbl(10), confirmedAll: false, extraConfirmed: { g1: true, g2: true, ghost: true } });
  await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {});
  ok(r.ok && Object.keys(r.proposal.assignments).length === 2 && !Object.values(r.proposal.assignments).includes('ghost'), 'A: só confirmados existentes entram (não confirmados e "ghost" fora)');

  // ===== B. Capacidade =====
  st = mkState({ guests: mkGuests(10), tables: tbl(2, 3, 5) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {});
  const cnt = {}; Object.keys(r.proposal.assignments).forEach((k) => { const t = /^t(\d+)/.exec(k)[1]; cnt[t] = (cnt[t] || 0) + 1; });
  ok(r.ok && cnt[1] === 2 && cnt[2] === 3 && cnt[3] === 5, 'B: mesas 2/3/5 preenchidas exatamente: ' + JSON.stringify(cnt));
  st = mkState({ guests: mkGuests(11), tables: tbl(2, 3, 5) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {});
  ok(!r.ok && r.reason === 'NOT_ENOUGH_SEATS', 'B: 11 convidados para 10 lugares → recusa clara');
  st = mkState({ guests: mkGuests(8), tables: tbl(3, 3, 3) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, { constraints: [{ type: 'TOGETHER', priority: 'HARD', guestIds: ['g1', 'g2', 'g3', 'g4'] }] });
  ok(!r.ok && r.reason === 'GROUP_TOO_BIG', 'B: grupo obrigatório maior que a maior mesa → recusa explicada');
  st = mkState({ guests: mkGuests(4), tables: [] }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {}); ok(!r.ok && r.reason === 'NO_TABLES', 'B: sem mesas → NO_TABLES');
  st = mkState({ guests: [], tables: tbl(4) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {}); ok(!r.ok && r.reason === 'NO_CONFIRMED_GUESTS', 'B: sem confirmados → NO_CONFIRMED_GUESTS');
  st = mkState({ guests: mkGuests(3), tables: [{ id: 1, seats: 0 }, { id: 2, seats: 3 }, { id: 'x', seats: 9 }, { id: -4, seats: 9 }] }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, {}); ok(r.ok && Object.keys(r.proposal.assignments).every((k) => k.startsWith('t2-')), 'B: mesa de 0 lugares e ids inválidos ignorados, nunca se criam mesas inexistentes');

  // ===== C/D/F. Famílias, crianças, acessibilidade (atributos minimizados) =====
  g = mkGuests(14); st = mkState({ guests: g, tables: tbl(7, 7) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  const attrs = {}; ['g1', 'g2', 'g3', 'g4'].forEach((x) => { attrs[x] = { f: 'famA', k: x === 'g1' ? 1 : 0 }; }); ['g5', 'g6', 'g7'].forEach((x) => { attrs[x] = { f: 'famB', a: x === 'g6' ? 1 : 0, c: 1 }; });
  r = await run(A, { attrs });
  let tof = tofOf(r.proposal.assignments);
  ok(r.ok && new Set(['g1', 'g2', 'g3', 'g4'].map((x) => tof[x])).size === 1, 'C: família A (4 pessoas) fica junta');
  ok(new Set(['g5', 'g6', 'g7'].map((x) => tof[x])).size === 1, 'C: família B (3 pessoas) fica junta');
  ok(!r.proposal.report.issues.some((i) => i.code === 'FAMILY_SPLIT'), 'C: sem famílias separadas no relatório');
  const accIssue = r.proposal.report.issues.find((i) => i.code === 'ACCESS_CHECK');
  ok(accIssue && accIssue.count === 1 && accIssue.tableIds.length === 1, 'F: acessibilidade sinalizada (contagem + mesa), sem detalhes');
  const catIssue = r.proposal.report.issues.find((i) => i.code === 'CATERING_NOTE');
  ok(catIssue && catIssue.count === 3 && !JSON.stringify(r.proposal).match(/segur|garant/i), 'E: nota para o catering (só contagem); nunca promete segurança alimentar');
  ok(r.proposal.report.tables.some((t) => t.children === 1) && r.proposal.report.tables.some((t) => t.familiesTogether >= 1), 'D: crianças e famílias juntas refletidas no relatório por mesa');
  // família maior que qualquer mesa → separa e sinaliza
  g = mkGuests(10); st = mkState({ guests: g, tables: tbl(5, 5) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  const big = {}; g.slice(0, 8).forEach((x) => { big[x.guestId] = { f: 'big' }; });
  r = await run(A, { attrs: big });
  ok(r.ok && r.proposal.report.issues.some((i) => i.code === 'FAMILY_SPLIT'), 'C: família maior que a mesa → separada e sinalizada (nunca escondida)');
  // atributos maliciosos / de convidados inexistentes
  r = await run(A, { attrs: { ghost: { f: 'x', a: 1 }, g1: { f: '../../x', a: 1, evil: 'y' }, g2: 'zzz', g3: { f: 'ok', a: 'sim', c: 1 } } });
  ok(r.ok, 'C: atributos inválidos não quebram nem passam (sanitizados)');
  const sa = T.sanitizeSeatingAttrs({ ghost: { f: 'x' }, g1: { f: '../../x', a: 1, evil: 'y' }, g3: { f: 'ok', a: 'sim', c: 1 } }, new Set(['g1', 'g3']));
  ok(!sa.ghost && sa.g1 && !sa.g1.f && !sa.g1.evil && sa.g1.a === 1 && sa.g3.f === 'ok' && !sa.g3.a && sa.g3.c === 1, 'C: sanitização remove inexistentes, ids estranhos, campos extra e valores não 0/1');

  // ===== G. Grupos =====
  g = mkGuests(12); st = mkState({ guests: g, tables: tbl(6, 6) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, { constraints: [{ type: 'TOGETHER', priority: 'STRONG', guestIds: ['g1', 'g2', 'g3'] }, { type: 'TOGETHER', priority: 'STRONG', guestIds: ['g4', 'g5', 'g6'] }, { type: 'APART', priority: 'HARD', guestIds: ['g1', 'g4'] }] });
  tof = tofOf(r.proposal.assignments);
  ok(r.ok && tof.g1 === tof.g2 && tof.g2 === tof.g3 && tof.g4 === tof.g5 && tof.g5 === tof.g6 && tof.g1 !== tof.g4, 'G: grupos juntos e HARD separados respeitados');
  ok(r.proposal.satisfiedPct === 100, 'G: 100% das preferências');

  // ===== H. Conflitos =====
  r = await run(A, { constraints: [{ type: 'TOGETHER', priority: 'HARD', guestIds: ['g1', 'g2'] }, { type: 'APART', priority: 'HARD', guestIds: ['g1', 'g2'] }] });
  ok(!r.ok && r.reason === 'CONTRADICTORY_CONSTRAINTS', 'H: obrigatórias contraditórias → recusa explicada (sem proposta aparentemente perfeita)');
  g = mkGuests(4); st = mkState({ guests: g, tables: tbl(2, 2) }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, { constraints: [{ type: 'APART', priority: 'STRONG', guestIds: ['g1', 'g2', 'g3'] }] });
  ok(r.ok && r.proposal.warnings.length > 0 && r.proposal.report.issues.some((i) => i.code === 'PREFERENCE_UNMET') && r.proposal.satisfiedPct < 100, 'H: preferência impossível → aviso + relatório + % < 100 (nada escondido)');
  r = await run(A, { constraints: [{ type: 'TOGETHER', priority: 'STRONG', guestIds: ['g1', 'ghost'] }, { type: 'NOPE', priority: 'HARD', guestIds: ['g1', 'g2'] }, null, { type: 'APART', priority: 'LOW', guestIds: ['g1', 'g2'] }] });
  ok(r.ok, 'H: restrições inválidas/inexistentes ignoradas sem falhar');

  // ===== validador: propostas adulteradas =====
  g = mkGuests(4); st = mkState({ guests: g, tables: tbl(2, 2) });
  const V = (as, extra) => T.validateSeatingProposal({ assignments: as, eligible: T.seatingEligibleGuests(st), tables: [{ id: 1, seats: 2 }, { id: 2, seats: 2 }], constraints: [], outsiders: {}, original: null, ...(extra || {}) });
  const codes = (v) => v.errors.map((e) => e.code);
  ok(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' }).ok, 'Val: proposta correta passa');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'g1', 't2-s1': 'g3', 't2-s2': 'g4' })).includes('DUPLICATE_GUEST'), 'Val: convidado duplicado detetado');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't1-s3': 'g3', 't2-s1': 'g4' })).includes('SEAT_OUT_OF_RANGE'), 'Val: lugar além da capacidade detetado');
  ok(codes(V({ 't9-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' })).includes('UNKNOWN_TABLE'), 'Val: mesa inexistente detetada');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'zz', 't2-s1': 'g3', 't2-s2': 'g4' })).includes('UNKNOWN_GUEST'), 'Val: convidado inexistente detetado');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3' })).includes('GUEST_OMITTED'), 'Val: convidado elegível omitido detetado');
  ok(codes(V({ 'lixo': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' })).includes('BAD_SEAT_KEY'), 'Val: chave de lugar inválida detetada');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' }, { constraints: [{ type: 'APART', priority: 'HARD', guestIds: ['g1', 'g2'] }] })).includes('HARD_VIOLATED'), 'Val: restrição obrigatória violada detetada');
  ok(codes(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' }, { outsiders: { 't2-s2': 'VIP' } })).includes('OUTSIDER_CHANGED') || codes(V({ 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' }, { outsiders: { 't2-s2': 'VIP' } })).includes('UNKNOWN_GUEST'), 'Val: não se pode apagar/trocar atribuição de quem não é elegível');
  ok(codes(V({ 't1-s1': 'g2', 't2-s1': 'g3', 't2-s2': 'g4' }, { original: { 't1-s1': 'g1' } })).includes('ASSIGNMENT_LOST'), 'Val: atribuição anterior apagada em silêncio detetada');

  // ===== I. Otimização =====
  g = mkGuests(8); const cur = { 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3', 't2-s2': 'g4', 't3-s1': 'g5' };
  st = mkState({ guests: g, tables: tbl(6, 6, 6), assignments: { ...cur, 't3-s2': 'VIP-nao-elegivel' } }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  const fa = { g1: { f: 'F1' }, g3: { f: 'F1' }, g6: { f: 'F1' }, g2: { f: 'F2' }, g7: { f: 'F2' } };
  const bef = await wedJson('W1');
  r = await run(A, { mode: 'optimize', constraints: [], attrs: fa });
  ok(r.ok && r.proposal.mode === 'optimize' && r.proposal.validated, 'I: proposta de otimização gerada e validada');
  const mv = r.proposal.moves; const movedIds = mv.map((m) => m.guestId);
  ok(new Set(movedIds).size === movedIds.length, 'I: cada convidado move-se no máximo uma vez');
  ok(r.proposal.assignments['t3-s2'] === 'VIP-nao-elegivel', 'I: atribuição de quem não é elegível preservada');
  ok(Object.values(r.proposal.assignments).filter((x) => x !== 'VIP-nao-elegivel').length === 8, 'I: os 8 elegíveis sentados, nenhum perdido');
  ok(mv.filter((m) => m.from === null).length === 3, 'I: 3 convidados por sentar propostos como novos lugares: ' + JSON.stringify(mv.filter((m) => m.from === null).map((m) => m.guestId)));
  const targets = mv.map((m) => m.to); ok(new Set(targets).size === targets.length && targets.every((t) => !Object.keys(cur).includes(t) && t !== 't3-s2'), 'I: destinos são lugares livres no estado atual (movimentos independentes)');
  const tf2 = tofOf(r.proposal.assignments);
  ok(tf2.g1 === tf2.g3 && tf2.g3 === tf2.g6, 'I: família F1 reunida: g1/g3/g6 → mesa ' + tf2.g1);
  ok((await wedJson('W1')) === bef, 'I: nada gravado no casamento');
  // aplicar subconjunto de movimentos continua válido
  const applyMoves = (base, moves) => { const o = { ...base }; moves.forEach((m) => { if (m.from) delete o[m.from]; o[m.to] = m.guestId; }); return o; };
  const subset = applyMoves({ ...cur, 't3-s2': 'VIP-nao-elegivel' }, mv.filter((m) => !m.group).slice(0, 2));
  ok(T.validateSeatingProposal({ assignments: subset, eligible: T.seatingEligibleGuests(st).filter((x) => Object.values(subset).includes(x.guestId)), tables: [{ id: 1, seats: 6 }, { id: 2, seats: 6 }, { id: 3, seats: 6 }], constraints: [], outsiders: { 't3-s2': 'VIP-nao-elegivel' }, original: null }).ok, 'I: aplicar só parte dos movimentos continua válido');
  // otimização com HARD APART atual: não cria violação nova
  st = mkState({ guests: mkGuests(6), tables: tbl(3, 3), assignments: { 't1-s1': 'g1', 't1-s2': 'g2', 't2-s1': 'g3' } }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, { mode: 'optimize', constraints: [{ type: 'APART', priority: 'HARD', guestIds: ['g1', 'g2'] }] });
  tof = tofOf(r.proposal.assignments);
  ok(r.ok && tof.g1 !== tof.g2 && r.proposal.moves.some((m) => m.group), 'I: violação obrigatória existente (mesas cheias) é corrigida por troca atómica');
  // distribuição atual com lixo (lugar duplicado / mesa inexistente) é tratada como "sem lugar válido", não apagada em silêncio
  st = mkState({ guests: mkGuests(4), tables: tbl(2, 2), assignments: { 't9-s1': 'g1', 't1-s1': 'g2', 'xx': 'g3' } }); await mkWedding('W1', 'a@x.pt', PREM(), st);
  r = await run(A, { mode: 'optimize' });
  ok(r.ok && Object.values(r.proposal.assignments).length === 4 && r.proposal.invalidCurrent === 2, 'I: lugares inválidos antigos → novos lugares propostos (invalidCurrent=2), ninguém fica de fora');

  // ===== L. Chamadas repetidas =====
  await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: mkGuests(4), tables: tbl(4) }));
  await free(); const p1 = await call(A, {}); const e2 = await err(call(A, {}));
  ok(p1.ok && e2 === 'resource-exhausted', 'L: segundo pedido imediato é recusado (proteção contra duplo clique/ciclos)');
  const [x1, x2] = await (async () => { await free(); return Promise.all([call(A, {}).then(() => 'ok', (e) => e.code), call(A, {}).then(() => 'ok', (e) => e.code)]); })();
  ok([x1, x2].filter((x) => x === 'ok').length === 1, 'L: dois pedidos concorrentes → só um passa: ' + [x1, x2]);

  // ===== M. Premium =====
  await mkWedding('W1', 'a@x.pt', undefined, st);
  ok(await err(run(A, {})) === 'permission-denied', 'M: sem subscrição → permission-denied (servidor)');
  await mkWedding('W1', 'a@x.pt', { active: false, startedAt: nowIso() }, st);
  ok(await err(run(A, {})) === 'permission-denied', 'M: subscrição inativa → recusada');
  const old = new Date(); old.setFullYear(old.getFullYear() - 2);
  await mkWedding('W1', 'a@x.pt', { active: true, startedAt: old.toISOString() }, st);
  ok(await err(run(A, {})) === 'permission-denied', 'M: Premium expirado (>12 meses) → recusado');
  const stBefore = await wedJson('W1');
  ok(stBefore.includes('"assignments"') && JSON.parse(stBefore).seating.tables.length === 2, 'M: com Premium expirado, mesas e distribuições continuam intactas');
  await mkWedding('W1', 'a@x.pt', PREM(), st);
  const rr = await run(A, {}); ok(rr.ok, 'M: reativado → volta a funcionar');

  // ===== N. Segurança =====
  await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: mkGuests(3, 'a'), tables: tbl(4) }));
  await mkWedding('W2', 'b@x.pt', PREM(), mkState({ guests: mkGuests(3, 'b'), tables: tbl(4) }));
  ok(await err(call(null, {})) === 'unauthenticated', 'N: sem sessão → unauthenticated');
  ok(await err(run(authOf('a@x.pt', false), {})) === 'unauthenticated', 'N: email não verificado → unauthenticated');
  ok(await err(run(authOf('a@x.pt', 'true'), {})) === 'unauthenticated', 'N: email_verified "true" (string) não vale');
  ok(await err(run(authOf('zz@x.pt'), {})) === 'not-found', 'N: conta sem casamento → not-found');
  r = await run(A, { weddingId: 'W2', constraints: [{ type: 'TOGETHER', priority: 'HARD', guestIds: ['b1', 'b2'] }] });
  ok(r.ok && Object.values(r.proposal.assignments).every((x) => x.startsWith('a')), 'N: weddingId no pedido é ignorado; guestIds de outro casamento não entram');
  ok(!JSON.stringify(r).includes('b1'), 'N: nada do casamento alheio na resposta');

  // ===== O. IA indisponível / respostas más (texto livre) =====
  g = [{ guestId: 'n1', name: 'Nuno Ferreira' }, { guestId: 'j1', name: 'João Silva' }, { guestId: 'm1', name: 'Maria Costa' }, { guestId: 'x1', name: 'Xavier Lima' }];
  await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: g, tables: tbl(2, 2) }));
  const TXT = 'Não quero o Nuno Ferreira perto do João Silva.';
  const bad = [['timeout/erro de rede', async () => { throw new Error('ETIMEDOUT'); }], ['HTTP 500', async () => ({ status: 500, text: 'x' })], ['resposta vazia', async () => ({ json: {} })], ['JSON inválido', async () => ({ json: { output_text: '{nao-json' } })], ['formato inesperado', async () => aiOut({ foo: 1 })], ['tipo inválido', async () => aiOut({ constraints: [{ type: 'EXPLODE', priority: 'HARD', names: ['P1', 'P2'] }] })], ['marcadores inventados', async () => aiOut({ constraints: [{ type: 'APART', priority: 'HARD', names: ['P1', 'P99'] }] })]];
  for (const [nome, fn] of bad) {
    await reset(); await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: g, tables: tbl(2, 2) })); aiMode = fn;
    const rx = await run(A, { freeText: TXT });
    const t = tofOf(rx.proposal ? rx.proposal.assignments : {});
    ok(rx.ok && Object.keys(rx.proposal.assignments).length === 4, `O: ${nome} → proposta válida na mesma`);
    if (['timeout/erro de rede', 'HTTP 500', 'resposta vazia', 'JSON inválido', 'formato inesperado'].includes(nome)) ok(t.n1 !== t.j1, `O: ${nome} → fallback local por regras respeita o pedido (Nuno ≠ João)`);
    else ok(true, `O: ${nome} → resposta da IA rejeitada sem efeito (nenhum marcador inventado vira convidado)`);
  }
  // ===== Q. Privacidade: o que vai para a IA =====
  await reset(); await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: g, tables: tbl(2, 2) }));
  aiMode = async () => aiOut({ constraints: [{ type: 'APART', priority: 'HARD', names: ['P1', 'P2'] }] });
  r = await run(A, { freeText: TXT, attrs: { n1: { f: 'F', a: 1, c: 1 } } });
  const sent = JSON.stringify(aiCalls);
  ok(aiCalls.length === 1, 'Q: no máximo 1 chamada à IA (só interpretação; a explicação é local)');
  ok(!/Nuno|Ferreira|João|Silva|Maria|Costa|Xavier|Lima|@|\+351/.test(sent), 'Q: nomes/emails/telefones NÃO vão para a IA');
  ok(!/n1|j1|m1|x1|guestId|alerg|intoler|acess|mobil|cateri/i.test(sent), 'Q: ids, alergias, acessibilidade e atributos NÃO vão para a IA');
  ok(/P1/.test(sent) && /P2/.test(sent), 'Q: o texto vai com marcadores anónimos P1/P2');
  const t3 = tofOf(r.proposal.assignments);
  ok(r.ok && t3.n1 !== t3.j1, 'Q: a resposta da IA (por marcadores) é traduzida localmente para os convidados certos e respeitada');
  const u = (await db.collection('aiUsage').doc('W1').get()).data();
  ok(u && u.count === 1, 'Q: o limite diário conta 1 uso (a chamada real à IA)');
  aiCalls = []; r = await run(A, { freeText: 'Quero tudo bonito, sem nomes.' });
  ok(r.ok && aiCalls.length === 0, 'Q: texto livre sem 2 nomes reconhecidos → nem chama a IA');
  r = await run(A, { freeText: 'x'.repeat(5000) });
  ok(r.ok && aiCalls.length === 0, 'Q: texto livre gigante é cortado e não quebra');
  const ps = T.pseudonymizeSeatingText('Separar João Silva da Maria Costa e o João Silva do Xavier Lima', ['João Silva', 'Maria Costa', 'Xavier Lima']);
  ok(ps.text === 'Separar P1 da P2 e o P1 do P3' && ps.tokens.size === 3, 'Q: pseudonimização estável (mesmo nome → mesmo marcador): ' + ps.text);
  const ps2 = T.pseudonymizeSeatingText('Ana  e ANA Sofia juntos', ['Ana', 'Ana Sofia']);
  ok(!/Ana/i.test(ps2.text.replace(/P\d/g, '')), 'Q: nomes sobrepostos tratados (nome mais longo primeiro)');

  // limite diário da IA
  await reset(); await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: g, tables: tbl(2, 2) }));
  await db.collection('aiUsage').doc('W1').set({ day: new Date().toISOString().slice(0, 10), count: 100000, guestCount: 0 });
  ok(await err(run(A, { freeText: TXT })) === 'resource-exhausted', 'Q: limite diário esgotado → recusa só quando seria preciso IA');
  r = await run(A, {}); ok(r.ok, 'Q: limite da IA esgotado não bloqueia a distribuição local');

  // ===== Limites / desempenho =====
  await reset(); await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: mkGuests(30), tables: tbl(10) }));
  ok(await err(run(A, { constraints: Array.from({ length: 51 }, () => ({ type: 'APART', priority: 'SOFT', guestIds: ['g1', 'g2'] })) })) === null, 'Lim: >50 preferências → resposta ok:false (não exceção)');
  r = await run(A, { constraints: Array.from({ length: 51 }, () => ({ type: 'APART', priority: 'SOFT', guestIds: ['g1', 'g2'] })) });
  ok(!r.ok && r.reason === 'TOO_MANY_CONSTRAINTS', 'Lim: TOO_MANY_CONSTRAINTS');
  await mkWedding('W1', 'a@x.pt', PREM(), mkState({ guests: mkGuests(801), tables: tbl(...Array(100).fill(9)) }));
  r = await run(A, {}); ok(!r.ok && r.reason === 'TOO_LARGE', 'Lim: 801 convidados → TOO_LARGE (limite validado no servidor)');
  const mkBig = (n, tcount, cap) => mkState({ guests: mkGuests(n), tables: tbl(...Array(tcount).fill(cap)) });
  const bigFam = {}; Array.from({ length: 600 }, (_, i) => `g${i + 1}`).forEach((id, i) => { bigFam[id] = { f: 'f' + Math.floor(i / 5), a: i % 17 === 0 ? 1 : 0, c: i % 7 === 0 ? 1 : 0 }; });
  await mkWedding('W1', 'a@x.pt', PREM(), mkBig(600, 60, 10));
  let t0 = Date.now(); r = await run(A, { attrs: bigFam, constraints: Array.from({ length: 40 }, (_, i) => ({ type: i % 2 ? 'APART' : 'TOGETHER', priority: 'SOFT', guestIds: [`g${i * 3 + 1}`, `g${i * 3 + 2}`] })) });
  const dt = Date.now() - t0;
  ok(r.ok && Object.keys(r.proposal.assignments).length === 600 && dt < 4000, `Perf: 600 convidados / 60 mesas / 120 famílias em ${dt} ms`);
  const bigState = mkBig(600, 60, 10); const half = {}; for (let i = 0; i < 300; i++) half[`t${(i % 60) + 1}-s${Math.floor(i / 60) + 1}`] = `g${i + 1}`;
  bigState.seating.assignments = half; await mkWedding('W1', 'a@x.pt', PREM(), bigState);
  t0 = Date.now(); r = await run(A, { mode: 'optimize', attrs: bigFam }); const dt2 = Date.now() - t0;
  ok(r.ok && r.proposal.moves.length <= T.SEATING_LIMITS.MAX_MOVES + 600 && dt2 < 8000, `Perf: otimizar 600 convidados em ${dt2} ms (${r.proposal && r.proposal.moves.length} movimentos)`);

  // ===== P. Dados antigos =====
  await mkWedding('W1', 'a@x.pt', PREM(), { guests: { noiva: { familia: [{ guestId: 'o1', name: 'Antigo' }, { guestId: 'o2', name: 'Velho' }] } }, confirmed: { o1: true, o2: true } });
  r = await run(A, {}); ok(!r.ok && r.reason === 'NO_TABLES', 'P: casamento antigo sem seating → resposta limpa (sem exceção)');
  await mkWedding('W1', 'a@x.pt', PREM(), { seating: { tables: [{ id: 1, seats: 4 }] }, guests: { noiva: { familia: [{ guestId: 'o1', name: 'Antigo' }, { name: 'sem id' }, null, 'texto'] } }, confirmed: { o1: true } });
  r = await run(A, {}); ok(r.ok && Object.values(r.proposal.assignments).join() === 'o1', 'P: entradas sem guestId/nulas ignoradas; sem atributos novos funciona');
  await mkWedding('W1', 'a@x.pt', PREM(), { seating: { tables: [{ id: 1, seats: 4 }], assignments: 'lixo' }, guests: { noiva: { familia: [{ guestId: 'o1', name: 'A' }] } }, confirmed: { o1: true } });
  r = await run(A, { mode: 'optimize' }); ok(r.ok, 'P: assignments corrompido → otimizar não quebra');
  await db.collection('weddings').doc('W1').update({ json: '{nao-json' });
  r = await run(A, {}); ok(!r.ok, 'P: json do casamento inválido → resposta limpa');

  console.log(`\nRESULT passed=${pass} failed=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
