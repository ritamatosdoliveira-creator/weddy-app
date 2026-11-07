/* Convites Digitais (lote 15) — servidor. Emulador Firestore; sem rede. Valida publish/unpublish/getState,
 * sanitização adversarial, slug, Premium, isolamento, rate limit e ciclo de vida. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const authOf = (email, verified) => ({ uid: 'uid-' + email, token: { email, email_verified: verified === undefined ? true : verified } });
const call = (fn, auth, data) => fn.run({ auth, data: data || {}, rawRequest: {} });
const PREM = () => ({ active: true, startedAt: new Date().toISOString() });
const LAPSED = () => ({ active: true, startedAt: '2023-01-01T00:00:00Z' });
async function mk(id, owner, sub) { await db.collection('weddings').doc(id).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], ...(sub ? { subscription: sub } : {}), settings: {}, json: '{}' }); }
const D = (o) => Object.assign({ tpl: 'editorial', palette: 'p1', colors: { bg: '#fffaf5', ink: '#222222', ac: '#b5654a', soft: '#f3e4da' }, names: 'Rita & Tiago', intro: 'Vamos casar', message: 'Venham', date: '2027-06-05', time: '16:00', venue: 'Quinta X', address: 'Rua Y', mapUrl: 'https://maps.google.com/?q=x', dress: 'Formal', mono: 'R&T', fontMain: 'Cormorant Garamond', fontSecond: 'Manrope', deco: true, program: [{ t: '16:00', d: 'Cerimónia' }], sections: {}, lang: 'pt' }, o || {});
async function err(p, code, label, dc) { try { await p; ok(false, label + ' (devia falhar)'); } catch (e) { ok(e.code === code && (!dc || (e.details && e.details.code === dc)), `${label} → ${code}${e.code !== code ? ' [obtido ' + e.code + ': ' + e.message + ']' : ''}`); } }
async function wipe() { for (const c of ['weddings', 'weddingInvitations', 'publicInvitations', 'invitationSlugs', 'siteRateLimits']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } }
const pubD = async (s) => { const x = await db.collection('publicInvitations').doc(s).get(); return x.exists ? x.data() : null; };
const A = authOf('a@x.pt'), B = authOf('b@x.pt');
const pub = fns.publishInvitation, unpub = fns.unpublishInvitation, state = fns.getInvitationState, sync = fns.syncInvitationLifecycle;

(async () => {
  await wipe();
  await mk('W1', 'a@x.pt', PREM()); await mk('W2', 'b@x.pt', PREM()); await mk('W3', 'c@x.pt', LAPSED()); await mk('W4', 'd@x.pt', null);
  for (const [n, f] of Object.entries({ pub, unpub, state })) {
    await err(call(f, null, {}), 'unauthenticated', n + ': sem sessão');
    await err(call(f, authOf('a@x.pt', false), {}), 'unauthenticated', n + ': email não verificado');
    await err(call(f, authOf('zz@x.pt'), {}), 'not-found', n + ': sem casamento');
  }
  await err(call(pub, authOf('c@x.pt'), { draft: D() }), 'permission-denied', 'publicar com Premium expirado');
  await err(call(pub, authOf('d@x.pt'), { draft: D() }), 'permission-denied', 'publicar sem subscrição');
  ok(!(await db.collection('weddingInvitations').doc('W3').get()).exists, 'Premium expirado não deixa rasto');
  // validação
  for (const [lbl, d] of [['sem rascunho', undefined], ['rascunho null', null], ['array', []], ['string', 'x'], ['template inválido', D({ tpl: 'hack' })], ['cor inválida', D({ colors: { bg: 'red', ink: '#222222', ac: '#b5654a', soft: '#f3e4da' } })], ['cor css injetada', D({ colors: { bg: '#fff;}</style><script>', ink: '#222222', ac: '#b5654a', soft: '#f3e4da' } })], ['sem nomes', D({ names: '   ' })], ['nomes não-string', D({ names: { a: 1 } })], ['sem cores', D({ colors: undefined })]]) {
    await err(call(pub, A, { draft: d }), 'failed-precondition', 'rascunho inválido: ' + lbl, 'validation');
  }
  ok(!(await db.collection('weddingInvitations').doc('W1').get()).exists, 'validação falhada não grava nada');
  // publicar
  const r1 = await call(pub, A, { draft: D() });
  ok(r1.ok && /^rita-tiago-[0-9a-f]{5}$/.test(r1.slug), 'slug formato: ' + r1.slug);
  ok(r1.version === 1 && r1.url === 'https://www.weddy.pt/i/' + r1.slug, 'versão 1 e url');
  const p1 = await pubD(r1.slug);
  ok(p1 && p1.status === 'published' && p1.snapshot.names === 'Rita & Tiago' && p1.validUntil, 'doc público publicado com snapshot e validUntil');
  ok(!('weddingId' in p1) && !JSON.stringify(p1).includes('W1') && !JSON.stringify(p1).includes('a@x.pt'), 'doc público sem weddingId/email');
  const r2 = await call(pub, A, { draft: D({ names: 'Outro Nome Completamente Diferente' }) });
  ok(r2.slug === r1.slug && r2.version === 2, 'slug estável ao republicar; versão 2');
  ok((await pubD(r1.slug)).snapshot.names === 'Outro Nome Completamente Diferente', 'republicar atualiza snapshot');
  // sanitização adversarial
  const evil = D({ names: '<img src=x onerror=alert(1)>'.repeat(10), intro: 'x'.repeat(5000), message: 'y'.repeat(5000), venue: 'v'.repeat(500), address: 'a'.repeat(500), dress: 'd'.repeat(500), mono: 'm'.repeat(50),
    mapUrl: 'javascript:alert(1)', date: '2027-02-31', time: '25:99', fontMain: 'Comic Sans', fontSecond: '<b>', palette: 'x y"z<>', __proto__x: 1, extra: 'drop', weddingId: 'W2', slug: 'hacked',
    program: Array.from({ length: 40 }, (_, i) => ({ t: 'xx', d: 'item' + i + 'z'.repeat(200) })).concat([null, 5, 'str', { d: '  ' }]), sections: { cover: false, program: false, bogus: false }, lang: 'fr', deco: 0 });
  await call(pub, A, { draft: evil });
  const e = (await pubD(r1.slug)).snapshot;
  ok(e.names.length <= 60 && e.intro.length <= 200 && e.message.length <= 300 && e.venue.length <= 120 && e.address.length <= 240 && e.dress.length <= 300 && e.mono.length <= 8, 'comprimentos limitados');
  ok(e.mapUrl === '' , 'mapUrl javascript: removido (obtido ' + JSON.stringify(e.mapUrl) + ')');
  ok(e.date === '' && e.time === '', 'data/hora inválidas removidas (' + e.date + '|' + e.time + ')');
  ok(e.fontMain === 'Cormorant Garamond' && e.fontSecond === 'Manrope', 'fontes fora da lista → padrão');
  ok(/^[a-z0-9-]*$/i.test(e.palette), 'palette limpa: ' + e.palette);
  ok(e.program.length === 12 && e.program.every((p) => p.d.length <= 80), 'programa ≤12 itens, ≤80 chars');
  ok(e.sections.cover === true && !('bogus' in e.sections) && e.sections.program === false, 'secção cover sempre ligada; desconhecidas descartadas');
  ok(!('extra' in e) && !('weddingId' in e) && !('slug' in e), 'campos desconhecidos descartados');
  ok(e.lang === 'pt' && e.deco === true || e.deco === false, 'lang/deco normalizados (lang=' + e.lang + ', deco=' + e.deco + ')');
  ok(e.time === '' || /^\d\d:\d\d$/.test(e.time), 'time formato');
  // mapUrl válido http?
  await call(pub, A, { draft: D({ mapUrl: 'http://insecure.example' }) }); ok((await pubD(r1.slug)).snapshot.mapUrl === '', 'mapUrl http:// (não-https) removido');
  await call(pub, A, { draft: D({ mapUrl: 'https://user:pw@evil.example/' + 'a'.repeat(900) }) }); ok(((await pubD(r1.slug)).snapshot.mapUrl || '').length <= 500, 'mapUrl enorme limitado/removido');
  // Lote A: modelos premium, opções próprias, cerimónia/receção
  for (const t of ['luxo', 'arquitetura', 'romance']) { const r = await call(pub, A, { draft: D({ tpl: t }) }); ok(r.ok, 'modelo ' + t + ' aceite'); }
  await call(pub, A, { draft: D({ tpl: 'luxo', opt: { finish: 'rosa', relief: 0, seal: 'x', evil: 1, kind: 'church' }, cer: { t: '16:00', p: '<b>Igreja</b>'.repeat(30) }, rec: { t: '99:99', p: 5 }, fontMain: 'Pinyon Script', fontSecond: 'Pinyon Script' }) });
  const L = (await pubD(r1.slug)).snapshot;
  ok(L.opt.finish === 'gold' && L.opt.relief === false && L.opt.seal === true && !('evil' in L.opt) && !('kind' in L.opt), 'opções do luxo: lista branca e defeitos ' + JSON.stringify(L.opt));
  ok(L.cer.t === '16:00' && L.cer.p.length <= 80 && L.rec.t === '' , 'cerimónia/receção limitadas e validadas');
  ok(L.fontMain === 'Pinyon Script' && L.fontSecond !== 'Pinyon Script', 'letra caligráfica só no título, nunca no texto corrente');
  await call(pub, A, { draft: D({ tpl: 'arquitetura', opt: { kind: 'palace', wash: false } }) });
  const Q = (await pubD(r1.slug)).snapshot; ok(Q.opt.kind === 'palace' && Q.opt.wash === false && !('finish' in Q.opt), 'opções de arquitetura');
  await call(pub, A, { draft: D({ tpl: 'romance', opt: 'x', cer: 'x' }) });
  const R = (await pubD(r1.slug)).snapshot; ok(R.opt.bow === true && R.opt.vellum === true && R.cer.p === '', 'opt/cer inválidos → defeitos');
  // Lote B: colorido, natural, secções extra
  for (const t of ['colorido', 'natural']) { const r = await call(pub, A, { draft: D({ tpl: t }) }); ok(r.ok, 'modelo ' + t + ' aceite'); }
  await call(pub, A, { draft: D({ tpl: 'natural', opt: { flap: false, count: 'x', comp: 'base' }, tips: '<b>t</b>'.repeat(200), kids: 5, gifts: { a: 1 } }) });
  const N = (await pubD(r1.slug)).snapshot;
  ok(N.opt.flap === false && N.opt.count === true && !('comp' in N.opt), 'opções natural: lista branca ' + JSON.stringify(N.opt));
  ok(N.tips.length <= 300 && N.kids === '5' && N.gifts === '' && N.sections.tips === true && N.sections.gifts === true, 'recomendações/crianças/presentes limitados');
  await call(pub, A, { draft: D({ tpl: 'colorido', opt: { comp: 'x' }, sections: { kids: false } }) });
  const K = (await pubD(r1.slug)).snapshot; ok(K.opt.comp === 'topo' && K.sections.kids === false, 'colorido: composição por defeito e secção desligável');
  // Unicode / nomes estranhos
  await call(pub, B, { draft: D({ names: '😀😀' }) });
  const sb = (await db.collection('weddingInvitations').doc('W2').get()).data();
  ok(/^convite-[0-9a-f]{5}$/.test(sb.slug), 'nomes só emoji → slug base "convite": ' + sb.slug);
  await call(pub, B, { draft: D({ names: 'João & Mª José' }) });
  ok(sb.slug === (await db.collection('weddingInvitations').doc('W2').get()).data().slug, 'slug de B estável');
  // isolamento
  ok((await pubD(r1.slug)).snapshot.names !== '😀😀', 'publicar em B não toca no doc de A');
  const sA = await call(state, A), sB = await call(state, B);
  ok(sA.slug === r1.slug && sB.slug === sb.slug && sA.slug !== sB.slug, 'getInvitationState isola casamentos');
  ok(sA.status === 'published' && sA.publishedConfig && sA.url.endsWith(sA.slug) && sA.validUntil > Date.now(), 'state published completo');
  ok((await call(state, authOf('d@x.pt'))).status === 'none', 'state sem convite → none');
  await err(call(unpub, authOf('d@x.pt'), {}), 'failed-precondition', 'despublicar sem convite', 'not_published');
  // manipulação: weddingId no payload
  await call(pub, A, { draft: D({ names: 'AA' }), weddingId: 'W2' });
  ok((await db.collection('weddingInvitations').doc('W2').get()).data().publishedConfig.names !== 'AA', 'weddingId forjado no pedido ignorado');
  // despublicar
  await call(unpub, A, {});
  const pu = await pubD(r1.slug);
  ok(pu.status === 'unpublished' && !('snapshot' in pu), 'despublicar remove snapshot público');
  ok((await call(state, A)).status === 'unpublished', 'state unpublished');
  await call(unpub, A, {}); ok(true, 'despublicar duas vezes é idempotente');
  const r3 = await call(pub, A, { draft: D() });
  ok(r3.slug === r1.slug && r3.version === 4 || r3.slug === r1.slug, 'republicar após despublicar mantém slug (versão ' + r3.version + ')');
  ok((await pubD(r1.slug)).status === 'published' && (await pubD(r1.slug)).snapshot, 'volta a published');
  const wi = (await db.collection('weddingInvitations').doc('W1').get()).data();
  ok(wi.unpublishedAt === null, 'unpublishedAt limpo ao republicar');
  // concorrência: 2 publicações em simultâneo para casamento novo
  await mk('W5', 'e@x.pt', PREM());
  const rr = await Promise.all([call(pub, authOf('e@x.pt'), { draft: D() }), call(pub, authOf('e@x.pt'), { draft: D() })]);
  const sl = await db.collection('invitationSlugs').where('weddingId', '==', 'W5').get();
  ok(rr[0].slug === rr[1].slug, 'CORRIDA: duas publicações simultâneas devolvem o mesmo slug (' + rr[0].slug + ' / ' + rr[1].slug + ')');
  ok(sl.size === 1, 'CORRIDA: só 1 reserva de slug para o casamento (obtido ' + sl.size + ')');
  // lifecycle
  await mk('W6', 'f@x.pt', PREM()); const r6 = await call(pub, authOf('f@x.pt'), { draft: D() });
  await db.collection('weddings').doc('W6').update({ subscription: LAPSED() });
  await sync.run({});
  let p6 = await pubD(r6.slug);
  ok(p6.status === 'suspended' && !('snapshot' in p6), 'Premium expirado → suspenso, sem snapshot');
  ok((await db.collection('weddingInvitations').doc('W6').get()).data().publishedConfig, 'config privada mantida ao suspender (nada apagado)');
  await db.collection('weddings').doc('W6').update({ subscription: PREM() });
  await sync.run({});
  p6 = await pubD(r6.slug);
  ok(p6.status === 'published' && p6.snapshot && p6.snapshot.names === 'Rita & Tiago', 'renovação → restaurado com snapshot');
  // unpublished não ressuscita
  await call(unpub, authOf('f@x.pt'), {}); await db.collection('weddings').doc('W6').update({ subscription: LAPSED() }); await sync.run({}); await db.collection('weddings').doc('W6').update({ subscription: PREM() }); await sync.run({});
  ok((await pubD(r6.slug)).status === 'unpublished', 'despublicado manualmente NÃO é reposto pelo ciclo de vida');
  // despublicar durante suspensão e depois renovar
  const r7 = await call(pub, authOf('f@x.pt'), { draft: D() });
  await db.collection('weddings').doc('W6').update({ subscription: LAPSED() }); await sync.run({});
  await call(unpub, authOf('f@x.pt'), {}); await db.collection('weddings').doc('W6').update({ subscription: PREM() }); await sync.run({});
  ok((await pubD(r7.slug)).status === 'unpublished', 'despublicar enquanto suspenso: renovar não republica');
  // wedding apagado
  await mk('W8', 'g@x.pt', PREM()); const r8 = await call(pub, authOf('g@x.pt'), { draft: D() });
  await db.collection('weddings').doc('W8').delete(); await sync.run({});
  ok((await pubD(r8.slug)).status === 'suspended', 'casamento apagado → convite suspenso (não fica público)');
  // rate limit
  await mk('W9', 'h@x.pt', PREM()); let limited = 0;
  for (let i = 0; i < 33; i++) { try { await call(pub, authOf('h@x.pt'), { draft: D() }); } catch (x) { if (x.code === 'resource-exhausted') limited++; } }
  ok(limited === 3, 'rate limit 30/h: 3 recusadas em 33 (obtido ' + limited + ')');
  // validUntil coerente com Premium
  const w1 = (await db.collection('weddingInvitations').doc('W1').get()).data();
  ok(w1.validUntil.toMillis() > Date.now(), 'validUntil no futuro');
  console.log(`RESULT passed=${pass} failed=${fail}`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
