/* A.4.3 — validação do estado (campo json) no servidor.
 * Puro + trigger (contra o emulador Firestore; nunca produção). Correr: npm run test:functions  ou
 *   node run-all.js --only validate-state */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const S = (o) => JSON.stringify(o);
const good = () => ({ budget: { total: 20000, guestsEstimate: 100 }, categories: [{ id: 'c1' }], guests: { noiva: { familia: [{ name: 'Ana' }] }, noivo: {}, conjunto: {} }, expenses: [], todos: [], notes: 'campo novo de outra versão' });
const sev = (x) => T.validateWeddingState(typeof x === 'string' ? x : S(x)).severity;
const codes = (x) => T.validateWeddingState(typeof x === 'string' ? x : S(x)).issues.map((i) => i.code);

(async () => {
  // --- puro: dados normais / antigos / incompletos
  ok(sev(good()) === 'ok', 'estado normal → ok');
  ok(T.validateWeddingState(S(good())).unexpected.includes('notes'), 'campo inesperado é só registado');
  ok(sev({}) === 'ok', 'objeto vazio (casamento novo/antigo) → ok (campos em falta não são erro)');
  ok(sev({ budget: { total: 5 } }) === 'ok', 'estado antigo só com parte dos campos → ok');
  ok(sev({ guests: { noiva: { familia: [] } } }) === 'ok', 'guests parcial → ok');
  ok(sev({ ...good(), cake: {} }) === 'ok', 'sub-objetos vazios → ok');
  ok(sev({ ...good(), favoriteVisitId: 'abc' }) === 'ok' && sev({ ...good(), favoriteVisitId: 7 }) === 'ok', 'campo livre (null no seed) aceita qualquer tipo');
  ok(sev({ ...good(), confirmed: { a: 1, b: [2], c: { d: 3 } } }) === 'ok', 'mapas livres aceitam qualquer conteúdo');
  // --- puro: tipos errados e nulos → reparável
  for (const [n, bad] of [['expenses string', { expenses: 'x' }], ['guests null', { guests: null }], ['guests array', { guests: [] }], ['budget número', { budget: 5 }],
    ['familia objeto', { guests: { noiva: { familia: {} } } }], ['todoCategories null', { todoCategories: null }], ['cake.tiers string', { cake: { tiers: 's' } }],
    ['vows.bride.done string', { vows: { bride: { done: 'sim' } } }], ['seating array', { seating: [] }]]) {
    const r = T.validateWeddingState(S({ ...good(), ...bad }));
    ok(r.severity === 'repairable' && r.issues.length >= 1, 'tipo errado → reparável: ' + n);
  }
  ok(codes({ ...good(), guests: null }).includes('null_value'), 'null em contentor conhecido → null_value');
  ok(codes({ ...good(), expenses: 'x' }).includes('wrong_type'), 'tipo errado → wrong_type');
  // --- puro: graves
  ok(sev(null) === 'invalid' && sev(undefined) === 'invalid' && sev(5) === 'invalid' && sev({}) === 'ok', 'json não-string → invalid');
  ok(sev('{nao json') === 'invalid' && codes('{nao json')[0] === 'parse_error', 'JSON corrompido → invalid');
  ok(sev('[1,2]') === 'invalid' && sev('"x"') === 'invalid' && sev('null') === 'invalid' && sev('5') === 'invalid', 'raiz não objeto → invalid');
  ok(sev('') === 'invalid', 'string vazia → invalid');
  ok(sev('x'.repeat(900001)) === 'invalid' && codes('x'.repeat(900001))[0] === 'too_large', 'demasiado grande → invalid');
  ok(sev(S({ ...good(), big: 'x'.repeat(100000) })) === 'ok', 'estado grande mas dentro do limite → ok');
  ok(sev('{"__proto__":{"admin":true}}') === 'invalid', 'chave __proto__ → invalid');
  ok(sev('{"a":{"constructor":{"prototype":{"x":1}}}}') === 'invalid', 'constructor/prototype aninhados → invalid');
  let deep = {}; let cur = deep; for (let i = 0; i < 40; i++) { cur.a = {}; cur = cur.a; }
  ok(sev(deep) === 'invalid' && codes(deep)[0] === 'too_deep', 'profundidade excessiva → invalid');
  ok(sev(S({ ...good(), todos: new Array(20001).fill(1) })) === 'invalid', 'array gigante → invalid');
  const manyKeys = {}; for (let i = 0; i < 4001; i++) manyKeys['k' + i] = 1;
  ok(sev(manyKeys) === 'invalid', 'objeto com demasiadas chaves → invalid');
  let thrown = false; try { T.validateWeddingState({ toString() { throw 1; } }); T.validateWeddingState(Symbol.iterator); } catch (e) { thrown = true; }
  ok(!thrown, 'nunca lança exceções com entradas estranhas');
  ok(sev(S({ texto: '<script>alert(1)</script>', url: 'javascript:alert(1)' })) === 'ok', 'conteúdo "perigoso" em texto não é alterado (o cliente escapa ao desenhar)');
  ok(JSON.stringify(T.STATE_SHAPE).length > 500 && T.STATE_SHAPE.guests.noiva.familia === 'array', 'STATE_SHAPE presente');

  // --- trigger (emulador)
  const clear = async () => { for (const c of ['weddings', 'weddingStateQuarantine']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } };
  await clear();
  const W = 'W_val1';
  const badJson = '{"budget": corrompido';
  const goodStr = S(good());
  await db.collection('weddings').doc(W).set({ json: goodStr, ownerEmails: ['a@example.com'] });

  let r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: badJson }, 'off');
  ok(r.action === 'off', 'modo off: nada acontece');
  ok((await db.collection('weddingStateQuarantine').get()).empty, 'modo off: sem quarentena');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, undefined, 'enforce');
  ok(r.action === 'deleted', 'documento apagado: ignora');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { ownerEmails: [] }, 'enforce');
  ok(r.action === 'no_state', 'documento sem json: ignora');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: goodStr, x: 1 }, 'enforce');
  ok(r.action === 'unchanged', 'json igual: ignora (sem trabalho extra, sem ciclos)');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: S({ ...good(), budget: { total: 1 } }) }, 'enforce');
  ok(r.action === 'ok', 'escrita válida: ok sem escrever nada');
  ok((await db.collection('weddingStateQuarantine').get()).empty, 'escrita válida: sem quarentena');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: S({ ...good(), expenses: 'x' }) }, 'enforce');
  ok(r.action === 'repairable', 'tipo errado: reparável, não reverte');
  ok((await db.collection('weddings').doc(W).get()).data().json === goodStr, 'reparável: documento intacto');

  // report: quarentena mas não reverte
  await db.collection('weddings').doc(W).update({ json: badJson });
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: badJson }, 'report');
  ok(r.action === 'quarantined', 'modo report: grava quarentena');
  ok((await db.collection('weddings').doc(W).get()).data().json === badJson, 'modo report: NÃO reverte');
  let q = await db.collection('weddingStateQuarantine').doc(r.quarantineId).get();
  ok(q.exists && q.data().json === badJson && q.data().restored === false && q.data().expireAt, 'quarentena guarda a versão rejeitada + expireAt');

  // enforce: reverte para o before válido
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: badJson }, 'enforce');
  ok(r.action === 'restored', 'modo enforce: reverte');
  const cw = (await db.collection("weddings").doc(W).get()).data();
  ok(cw.json === goodStr && cw.ownerEmails[0] === 'a@example.com', 'enforce: json reposto, outros campos intactos');
  ok(cw.stateGuard && cw.stateGuard.quarantineId === r.quarantineId, 'enforce: stateGuard indica a quarentena');
  q = await db.collection('weddingStateQuarantine').doc(r.quarantineId).get();
  ok(q.data().restored === true && q.data().json === badJson, 'enforce: quarentena marcada como restaurada, conteúdo preservado');

  // escrita legítima mais recente não é pisada
  const newer = S({ ...good(), budget: { total: 999 } });
  await db.collection('weddings').doc(W).update({ json: newer });
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: badJson }, 'enforce');
  ok(r.action === 'quarantined' && (await db.collection('weddings').doc(W).get()).data().json === newer, 'enforce: não pisa escrita mais recente');

  // before inválido/inexistente: nunca reverte
  await db.collection('weddings').doc(W).update({ json: badJson });
  r = await T.handleWeddingStateWrite(W, { json: '{lixo' }, { json: badJson }, 'enforce');
  ok(r.action === 'quarantined' && (await db.collection('weddings').doc(W).get()).data().json === badJson, 'before também inválido: só quarentena');
  r = await T.handleWeddingStateWrite(W, undefined, { json: badJson }, 'enforce');
  ok(r.action === 'quarantined', 'criação inválida (sem before): só quarentena');
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: 12345 }, 'enforce');
  ok(r.action === 'quarantined' || r.action === 'restored', 'json não-string é tratado como grave');
  const big = 'x'.repeat(900500);
  r = await T.handleWeddingStateWrite(W, { json: goodStr }, { json: big }, 'report');
  ok(r.action === 'quarantined', 'demasiado grande: quarentena');
  const qb = await db.collection('weddingStateQuarantine').doc(r.quarantineId).get();
  ok(qb.exists && qb.data().json === undefined && qb.data().size === 900500, 'demasiado grande: guarda só metadados (não cabe no documento)');

  await clear();
  console.log(`\n${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
