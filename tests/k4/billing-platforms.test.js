/* Pré-produção — billing multi-plataforma. SIMULADO: SDK Stripe substituído, sem rede, sem chaves reais, sem RevenueCat/Apple/Stripe reais;
 * emulador Firestore. Valida: erro temporário (5xx) quando a ativação não fica gravada (retry do webhook), idempotência, ativação só com os
 * campos da própria plataforma, REFUND Apple antigo/desconhecido/fora de ordem com Stripe ativo, política record_only inalterada. */
'use strict';
const path = require('path'), Module = require('module');
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake'; process.env.REVENUECAT_WEBHOOK_AUTH = 'rc-secret-fake';
const stripeStub = () => ({ webhooks: { constructEvent: (raw, sig) => { if (sig !== 'good') throw new Error('bad sig'); return JSON.parse(raw.toString()); } } });
const origLoad = Module._load; Module._load = function (req) { if (req === 'stripe') return stripeStub; return origLoad.apply(this, arguments); };
const admin = require('firebase-admin'); const fns = require(path.join(__dirname, '..', '..', 'index.js')); const db = admin.firestore(); const T = fns._test;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const mkRes = () => { const r = { code: 0, status(c) { r.code = c; return r; }, send() { return r; }, set() { return r; } }; return r; };
const sHook = async (event) => { const res = mkRes(); await fns.stripeWebhook({ method: 'POST', rawBody: Buffer.from(JSON.stringify(event)), headers: { 'stripe-signature': 'good' } }, res); return res; };
const rHook = async (event) => { const res = mkRes(); await fns.revenueCatWebhook({ method: 'POST', headers: { authorization: 'Bearer rc-secret-fake' }, body: { event } }, res); return res; };
const paid = (id, w, pi) => ({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id, payment_status: 'paid', payment_intent: pi || null, amount_total: 3000, currency: 'eur', metadata: { weddingId: w } } } });
const buy = (uid, tx, extra) => Object.assign({ type: 'NON_RENEWING_PURCHASE', app_user_id: uid, transaction_id: tx, environment: 'PRODUCTION', product_id: 'prem' }, extra || {});
const refund = (uid, tx) => ({ type: 'REFUND', app_user_id: uid, transaction_id: tx, environment: 'PRODUCTION' });
const sub = async (w) => ((await db.collection('weddings').doc(w).get()).data() || {}).subscription;
const ms = (x) => (x && x.toMillis ? x.toMillis() : new Date(x).getTime());
const mkW = (id) => db.collection('weddings').doc(id).set({ ownerEmails: [id.toLowerCase() + '@t.pt'], ownerUids: ['u' + id], json: '{}' });
const incidents = async (reason) => (await db.collection('_incident_log').get()).docs.map((d) => d.data()).filter((d) => d.reason === reason);
const consistent = (s) => !s || s.active !== true || (s.startedAt && s.premiumUntil && ms(s.premiumUntil) > Date.now());
const realTx = db.runTransaction.bind(db);
const breakTx = () => { db.runTransaction = async () => { const e = new Error('firestore indisponível'); e.code = 14; throw e; }; };
const fixTx = () => { db.runTransaction = realTx; };
(async () => {
  for (const w of ['wS', 'wA', 'wD', 'wX', 'wO', 'wN', 'wP']) await mkW(w);
  // ── A. Falha de gravação → erro temporário, retry e idempotência ──
  breakTx(); let res = await sHook(paid('cs_f1', 'wS', 'pi_f1')); fixTx();
  ok(res.code === 500 && (await sub('wS')) === undefined && (await incidents('falha-ao-ativar')).length >= 1, 'A1. Stripe: falha de gravação → 500 (retry), nada ativado, incidente registado');
  res = await sHook(paid('cs_f1', 'wS', 'pi_f1')); let s = await sub('wS');
  ok(res.code === 200 && s && s.active === true && consistent(s), 'A2. Stripe: o reenvio do mesmo evento (retry) ativa e responde 200');
  const until1 = ms(s.premiumUntil); res = await sHook(paid('cs_f1', 'wS', 'pi_f1')); s = await sub('wS');
  ok(res.code === 200 && ms(s.premiumUntil) === until1 && (s.stripeCheckoutSessionIds || []).filter((x) => x === 'cs_f1').length === 1, 'A3. Stripe: evento duplicado depois do retry → 200 sem estender');
  breakTx(); res = await rHook(buy('uwA', 'tf1')); fixTx();
  ok(res.code === 500 && (await sub('wA')) === undefined && (await incidents('falha-ao-ativar')).length >= 2, 'A4. RevenueCat: falha de gravação → 500 (retry), nada ativado, incidente registado');
  res = await rHook(buy('uwA', 'tf1')); s = await sub('wA'); const until2 = s && ms(s.premiumUntil);
  ok(res.code === 200 && s && s.active === true && consistent(s), 'A5. RevenueCat: o reenvio ativa e responde 200');
  res = await rHook(buy('uwA', 'tf1')); s = await sub('wA');
  ok(res.code === 200 && ms(s.premiumUntil) === until2 && (s.revenueCatTransactionIds || []).filter((x) => x === 'tf1').length === 1, 'A6. RevenueCat: duplicado → 200 sem estender');
  // erro inesperado (leitura do casamento falha) → 5xx
  const origCol = db.collection.bind(db); db.collection = (n) => { if (n === 'weddings') throw new Error('colecao indisponivel'); return origCol(n); };
  res = await sHook(paid('cs_g1', 'wS', 'pi_g1')); const res2 = await rHook(buy('uwA', 'tg1')); db.collection = origCol;
  ok(res.code === 500 && res2.code === 500, 'A7. erro inesperado antes de gravar → 500 nos dois webhooks');
  // eventos não acionáveis continuam 200 (retry não ajudaria)
  ok((await sHook(paid('cs_none', 'inexistente'))).code === 200 && (await sHook({ id: 'e_nw', type: 'checkout.session.completed', data: { object: { id: 'cs_nw', payment_status: 'paid', metadata: {} } } })).code === 200, 'A8. casamento inexistente / sem weddingId → 200 + incidente (sem retry inútil)');

  // ── B. Ativação só com os campos da própria plataforma ──
  await sHook(paid('cs_d1', 'wD', 'pi_d1')); await rHook(buy('uwD', 'td1'));
  s = await sub('wD');
  ok(s.stripeCheckoutSessionId === 'cs_d1' && (s.stripeCheckoutSessionIds || []).includes('cs_d1') && s.revenueCatTransactionId === 'td1' && s.lastPlatform === 'revenuecat' && s.active === true && consistent(s), 'B1. Stripe e Apple no mesmo casamento: os ids dos dois ficam preservados');
  await sHook(paid('cs_d2', 'wD', 'pi_d2')); s = await sub('wD');
  ok((s.revenueCatTransactionIds || []).includes('td1') && s.revenueCatTransactionId === 'td1' && (s.stripeCheckoutSessionIds || []).includes('cs_d2') && s.lastPlatform === 'stripe', 'B2. nova compra Stripe não apaga os ids Apple (e regista a última plataforma)');
  const base = ms(s.premiumUntil);
  // ── C. REFUND Apple vs Stripe ──
  await rHook(refund('uwD', 'td1')); s = await sub('wD');
  ok(s.active === true && ms(s.premiumUntil) === base && (await incidents('refund-ignorado-outra-plataforma')).length >= 1, 'C1. REFUND Apple (compra anterior) com a última ativação Stripe: Premium mantém-se e fica incidente');
  await sHook(paid('cs_x1', 'wX', 'pi_x1')); const before = await sub('wX');
  await rHook(refund('uwX', 'tOld'));
  s = await sub('wX');
  ok(s.active === true && ms(s.premiumUntil) === ms(before.premiumUntil) && (s.revenueCatRefundedTransactionIds || []).includes('tOld') && (await incidents('refund-transacao-desconhecida')).length >= 1, 'C2. REFUND Apple de transação desconhecida com Stripe ativo: nada muda; transação memorizada e incidente');
  res = await rHook(buy('uwX', 'tOld')); s = await sub('wX');
  ok(res.code === 200 && !s.revenueCatTransactionId && (await incidents('compra-ja-reembolsada')).length >= 1, 'C3. evento fora de ordem: a compra Apple chegada depois do seu REFUND não ativa nada');
  await rHook(buy('uwO', 'to1')); await rHook(refund('uwO', 'to1')); s = await sub('wO');
  ok(s.active === false && s.revokedReason === 'apple_refund', 'C4. REFUND Apple da última (e única) compra Apple desativa, como antes');
  await rHook(refund('uwO', 'to1')); s = await sub('wO'); ok(s.active === false, 'C5. REFUND repetido é idempotente');
  await rHook(buy('uwO', 'to2')); s = await sub('wO');
  ok(s.active === true && s.revokedReason === undefined && consistent(s), 'C6. nova compra depois de revogada reativa e limpa o motivo de revogação');
  await rHook(buy('uwN', 'tn1')); const bN = await sub('wN');
  await rHook({ type: 'REFUND', app_user_id: 'uwN', environment: 'PRODUCTION' }); s = await sub('wN');
  ok(s.active === true && ms(s.premiumUntil) === ms(bN.premiumUntil) && (await incidents('refund-sem-transacao')).length >= 1, 'C7. REFUND sem transaction_id: nada é alterado automaticamente (incidente)');
  // ── D. Stripe com Apple ativo ──
  await rHook(buy('uwP', 'tp1')); const bP = await sub('wP');
  await sHook({ id: 'e_x', type: 'checkout.session.expired', data: { object: { id: 'cs_e', metadata: { weddingId: 'wP' } } } });
  await sHook({ id: 'e_y', type: 'checkout.session.async_payment_failed', data: { object: { id: 'cs_y', metadata: { weddingId: 'wP' } } } });
  s = await sub('wP'); ok(s.active === true && ms(s.premiumUntil) === ms(bP.premiumUntil) && s.revenueCatTransactionId === 'tp1', 'D1. sessão Stripe expirada / pagamento falhado não alteram um Premium Apple ativo');
  ok(T.stripeRefundPolicy() === 'record_only', 'D2. política por defeito continua record_only');
  await sHook(paid('cs_p1', 'wP', 'pi_p1'));
  let r = await sHook({ id: 'evt_rf', type: 'charge.refunded', data: { object: { id: 'ch1', payment_intent: 'pi_p1', amount: 3000, amount_refunded: 3000, currency: 'eur' } } });
  s = await sub('wP'); ok(r.code === 200 && s.active === true, 'D3. reembolso total Stripe em record_only: Premium inalterado');
  process.env.STRIPE_REFUND_POLICY = 'revoke_on_full_refund';
  await sHook(paid('cs_p2', 'wP', 'pi_p2'));
  r = await sHook({ id: 'evt_rf2', type: 'charge.refunded', data: { object: { id: 'ch2', payment_intent: 'pi_p2', amount: 3000, amount_refunded: 3000, currency: 'eur' } } });
  s = await sub('wP'); const ev = (await db.collection('stripeEvents').doc('evt_rf2').get()).data();
  ok(s.active === true && ev && ev.outcome === 'ambiguous_review', 'D4. com a política de revogação (desligada por defeito) e uma compra Apple no casamento: não revoga, fica para revisão');
  delete process.env.STRIPE_REFUND_POLICY;
  // ── E. Estado Premium consistente em todos os casamentos ──
  const all = []; for (const w of ['wS', 'wA', 'wD', 'wX', 'wO', 'wN', 'wP']) all.push(await sub(w));
  ok(all.every(consistent), 'E1. todo o casamento com active=true tem startedAt e premiumUntil futuros');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
