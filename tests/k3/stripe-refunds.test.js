/* K.3-E — reembolsos Stripe. SIMULADO: SDK Stripe substituído (sem rede, sem chaves reais, sem transações reais) +
 * emulador Firestore. NÃO é Stripe em modo de teste (ver runbook para essa validação). */
'use strict';
const path = require('path'), Module = require('module');
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
const created = [];
const stripeStub = () => ({ webhooks: { constructEvent: (raw, sig) => { if (sig !== 'good') throw new Error('bad sig'); return JSON.parse(raw.toString()); } }, checkout: { sessions: { create: async (o) => { created.push(o); return { url: 'https://checkout.stripe.test/s' }; } } } });
const origLoad = Module._load; Module._load = function (req) { if (req === 'stripe') return stripeStub; return origLoad.apply(this, arguments); };
const admin = require('firebase-admin'); const fns = require(path.join(__dirname, '..', '..', 'index.js')); const db = admin.firestore(); const T = fns._test;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
function mkRes() { const r = { code: 0, status(c) { r.code = c; return r; }, send() { return r; }, set() { return r; } }; return r; }
async function hook(event) { const res = mkRes(); await fns.stripeWebhook({ method: 'POST', rawBody: Buffer.from(JSON.stringify(event)), headers: { 'stripe-signature': 'good' } }, res); return res; }
const paid = (id, w, pi, amt = 3000) => ({ id: 'evt_p_' + id, type: 'checkout.session.completed', data: { object: { id, payment_status: 'paid', payment_intent: pi, amount_total: amt, currency: 'eur', metadata: { weddingId: w } } } });
const refund = (id, pi, amount, refunded, extra) => ({ id, type: 'charge.refunded', data: { object: Object.assign({ id: 'ch_' + pi, payment_intent: pi, amount, amount_refunded: refunded, currency: 'eur' }, extra || {}) } });
const sub = async (w) => ((await db.collection('weddings').doc(w).get()).data() || {}).subscription;
const pay = async (pi) => (await db.collection('stripePayments').doc(pi).get()).data();
const mkW = (id) => db.collection('weddings').doc(id).set({ ownerEmails: [id.toLowerCase() + '@t.pt'], ownerUids: ['u' + id], json: '{}' });
(async () => {
  for (const w of ['wA', 'wB', 'wC', 'wD', 'wE', 'wF']) await mkW(w);
  // checkout: metadados no PaymentIntent
  const r = await fns.createSubscriptionCheckout.run({ auth: { uid: 'uwA', token: { email: 'wa@t.pt', email_verified: true } }, data: { returnUrl: 'https://www.weddy.pt/app/' }, rawRequest: {} });
  ok(r.url && created[0].payment_intent_data.metadata.weddingId === 'wA', 'checkout passa weddingId também ao PaymentIntent');
  // persistência do pagamento
  await hook(paid('cs_a', 'wA', 'pi_a')); let p = await pay('pi_a');
  ok(p && p.weddingId === 'wA' && p.amount === 3000 && p.currency === 'eur' && p.status === 'paid' && p.checkoutSessionId === 'cs_a', 'pagamento regista payment_intent, valor, moeda e sessão');
  await hook(paid('cs_a', 'wA', 'pi_a')); ok((await db.collection('stripePayments').get()).docs.filter((d) => d.id === 'pi_a').length === 1, 'reenvio do pagamento não duplica o registo');
  // política por defeito: só regista
  ok(T.stripeRefundPolicy() === 'record_only', 'política por defeito = record_only');
  let res = await hook(refund('evt_r1', 'pi_a', 3000, 3000)); p = await pay('pi_a'); let s = await sub('wA');
  ok(res.code === 200 && p.status === 'refunded' && p.refundedAmount === 3000 && p.reviewRequired === true, 'reembolso total: detetado e registado, a rever');
  ok(s.active === true, 'record_only: Premium NÃO é revogado automaticamente');
  const ev = (await db.collection('stripeEvents').doc('evt_r1').get()).data(); ok(ev && ev.outcome === 'recorded_no_change' && ev.weddingId === 'wA' && ev.policy === 'record_only', 'evento auditável (resultado, casamento, política)');
  // duplicado e concorrente
  res = await hook(refund('evt_r1', 'pi_a', 3000, 3000)); ok(res.code === 200 && (await db.collection('stripeEvents').get()).docs.filter((d) => d.id === 'evt_r1').length === 1, 'evento duplicado: ignorado');
  await hook(paid('cs_b', 'wB', 'pi_b')); await Promise.all([1, 2, 3, 4, 5].map(() => hook(refund('evt_r2', 'pi_b', 3000, 1000)))); p = await pay('pi_b');
  ok(p.refundedAmount === 1000 && p.status === 'partially_refunded', 'cinco entregas simultâneas do mesmo evento: um só efeito');
  // parcial sem efeito; depois total; fora de ordem não diminui
  await hook(refund('evt_r3', 'pi_b', 3000, 2000)); await hook(refund('evt_r4', 'pi_b', 3000, 500)); p = await pay('pi_b');
  ok(p.refundedAmount === 2000 && p.status === 'partially_refunded' && (await sub('wB')).active === true, 'parcial: sem alteração do Premium; evento atrasado não reduz o valor reembolsado');
  await hook(refund('evt_r5', 'pi_b', 3000, 3000)); ok((await pay('pi_b')).status === 'refunded', 'parcial seguido de total passa a reembolsado');
  // sem registo (fora de ordem / pagamento antigo)
  res = await hook(refund('evt_r6', 'pi_unknown', 3000, 3000)); const evU = (await db.collection('stripeEvents').doc('evt_r6').get()).data();
  ok(res.code === 200 && evU.outcome === 'unmatched' && evU.reviewRequired === true && evU.weddingId === null, 'reembolso sem pagamento registado: guardado para revisão, nenhum casamento alterado');
  ok((await sub('wA')).active === true && (await sub('wB')).active === true, 'nenhum Premium mudou');
  await hook(refund('evt_r7', 'pi_c', 3000, 3000)); await hook(paid('cs_c', 'wC', 'pi_c')); ok((await pay('pi_c')).reviewRequired === true && (await sub('wC')).active === true, 'reembolso antes do pagamento: pagamento criado marcado para revisão, Premium mantém-se');
  // metadados incoerentes
  await hook(paid('cs_d', 'wD', 'pi_d')); await hook(refund('evt_r8', 'pi_d', 3000, 3000, { metadata: { weddingId: 'wOutro' } }));
  ok((await db.collection('stripeEvents').doc('evt_r8').get()).data().outcome === 'inconsistent' && (await sub('wD')).active === true, 'metadados incoerentes com o pagamento registado: revisão, sem efeito');
  // disputa
  await hook({ id: 'evt_d1', type: 'charge.dispute.created', data: { object: { id: 'dp_1', charge: 'ch_pi_d', payment_intent: 'pi_d', amount: 3000, currency: 'eur', status: 'needs_response' } } });
  ok((await pay('pi_d')).disputeStatus === 'open' && (await sub('wD')).active === true, 'disputa aberta: registada, Premium inalterado');
  // evento malformado
  res = await hook({ id: 'evt_x', type: 'charge.refunded', data: { object: {} } }); ok(res.code === 200 && (await db.collection('stripeEvents').doc('evt_x').get()).data().outcome === 'unmatched', 'evento sem payment_intent: tratado sem rebentar');
  // falha de escrita → 500 para o Stripe repetir
  const origRun = db.runTransaction.bind(db); db.runTransaction = async () => { throw new Error('firestore down'); };
  res = await hook(refund('evt_f', 'pi_a', 3000, 3000)); db.runTransaction = origRun; ok(res.code === 500, 'falha de escrita num reembolso → 500 (o Stripe tenta de novo)');
  ok((await db.collection('stripeEvents').doc('evt_f').get()).exists === false, 'após a falha nada ficou gravado (a repetição será processada)');
  // política ligada (só em teste): caso inequívoco revoga; ambíguo não
  process.env.STRIPE_REFUND_POLICY = 'revoke_on_full_refund';
  await hook(paid('cs_e', 'wE', 'pi_e')); res = await hook(refund('evt_e1', 'pi_e', 3000, 3000)); s = await sub('wE');
  ok(T.stripeRefundPolicy() === 'revoke_on_full_refund' && s.active === false && s.revokedReason === 'stripe_full_refund' && (await pay('pi_e')).reviewRequired === false, 'política de teste: reembolso total da única compra revoga');
  await hook(paid('cs_f1', 'wF', 'pi_f1')); await hook(paid('cs_f2', 'wF', 'pi_f2')); await hook(refund('evt_f1', 'pi_f1', 3000, 3000));
  ok((await sub('wF')).active === true && (await db.collection('stripeEvents').doc('evt_f1').get()).data().outcome === 'ambiguous_review', 'política de teste: duas compras → ambíguo, não revoga');
  await hook(paid('cs_g', 'wB', 'pi_g')); await hook(refund('evt_g1', 'pi_g', 3000, 1000)); ok((await sub('wB')).active === true, 'política de teste: reembolso parcial nunca revoga');
  process.env.STRIPE_REFUND_POLICY = 'qualquer'; ok(T.stripeRefundPolicy() === 'record_only', 'valor desconhecido → record_only');
  delete process.env.STRIPE_REFUND_POLICY;
  const fin = JSON.stringify((await db.collection('stripePayments').get()).docs.map((d) => d.data()).concat((await db.collection('stripeEvents').get()).docs.map((d) => d.data())));
  ok(!/expireAt/.test(fin) && !/@/.test(fin), 'registos financeiros: sem expireAt (fora do TTL) e sem emails');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
