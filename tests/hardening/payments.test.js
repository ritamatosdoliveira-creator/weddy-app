/* Fase K — pagamentos (Stripe + RevenueCat) e checkout. SIMULADO: Stripe SDK substituído (sem rede, sem
 * transações reais, sem chaves reais); emulador Firestore. Valida: autenticação do checkout, allowlist de
 * returnUrl (redireccionamento aberto), weddingId vindo SEMPRE da conta autenticada, assinatura do webhook,
 * idempotência (sequencial e concorrente), pagamento assíncrono, renovação, evento sem casamento,
 * RevenueCat: Authorization, ambiente sandbox, duplicados, reembolso de transação antiga. */
'use strict';
const path = require('path'), Module = require('module');
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake'; process.env.REVENUECAT_WEBHOOK_AUTH = 'rc-secret-fake';
const created = [];
const stripeStub = () => ({
  webhooks: { constructEvent: (raw, sig) => { if (sig !== 'good') throw new Error('bad sig'); return JSON.parse(raw.toString()); } },
  checkout: { sessions: { create: async (o) => { created.push(o); return { url: 'https://checkout.stripe.test/s' }; } } },
});
const origLoad = Module._load;
Module._load = function (req) { if (req === 'stripe') return stripeStub; return origLoad.apply(this, arguments); };
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const A = (email, v) => ({ uid: 'uid-' + email, token: { email, email_verified: v === undefined ? true : v } });
const rej = async (p) => { try { await p; return null; } catch (e) { return e.code || 'erro'; } };
function mkRes() { const r = { code: 0, body: '', status(c) { r.code = c; return r; }, send(b) { r.body = b; return r; }, set() { return r; }, redirect() { return r; } }; return r; }
async function webhook(event, sig) { const res = mkRes(); await fns.stripeWebhook({ method: 'POST', rawBody: Buffer.from(JSON.stringify(event)), headers: { 'stripe-signature': sig === undefined ? 'good' : sig } }, res); return res; }
async function rc(event, auth) { const res = mkRes(); await fns.revenueCatWebhook({ method: 'POST', headers: auth === undefined ? { authorization: 'Bearer rc-secret-fake' } : (auth ? { authorization: auth } : {}), body: { event } }, res); return res; }
const sess = (id, wid, extra) => ({ type: 'checkout.session.completed', data: { object: Object.assign({ id, payment_status: 'paid', metadata: { weddingId: wid } }, extra || {}) } });
const subOf = async (id) => ((await db.collection('weddings').doc(id).get()).data() || {}).subscription;

(async () => {
  await db.collection('weddings').doc('wP').set({ ownerEmails: ['p@teste.pt'], ownerUids: ['uid-p@teste.pt'], json: '{}' });
  await db.collection('weddings').doc('wQ').set({ ownerEmails: ['q@teste.pt'], ownerUids: ['uid-q@teste.pt'], json: '{}' });
  const co = (auth, data) => fns.createSubscriptionCheckout.run({ auth, data, rawRequest: {} });
  // Checkout
  ok(await rej(co(null, { returnUrl: 'https://www.weddy.pt/app/' })) === 'unauthenticated', 'checkout sem sessão → unauthenticated');
  ok(await rej(co(A('p@teste.pt', false), { returnUrl: 'https://www.weddy.pt/app/' })) === 'unauthenticated', 'checkout com email não verificado → recusado');
  for (const bad of ['http://www.weddy.pt/app/', 'https://evil.example/app/', 'https://www.weddy.pt.evil.example/', 'https://user:pw@www.weddy.pt/', 'https://www.weddy.pt:8443/', 'javascript:alert(1)', '', 'https://www.weddy.pt/' + 'a'.repeat(600)])
    ok(await rej(co(A('p@teste.pt'), { returnUrl: bad })) === 'invalid-argument', 'checkout recusa returnUrl: ' + bad.slice(0, 40));
  const r1 = await co(A('p@teste.pt'), { returnUrl: 'https://www.weddy.pt/app/', weddingId: 'wQ' });
  ok(r1.url && created.length === 1, 'checkout com returnUrl válido devolve url');
  ok(created[0].metadata.weddingId === 'wP', 'weddingId do checkout vem da conta autenticada (ignora weddingId do cliente)');
  ok(created[0].line_items[0].price_data.unit_amount === 3000 && created[0].mode === 'payment', 'preço e modo definidos no servidor');
  // Stripe indisponível: erro genérico, sem detalhes técnicos
  const failing = created.length; const origCreate = null;
  Module._load = function (req) { if (req === 'stripe') return () => ({ checkout: { sessions: { create: async () => { throw new Error('segredo-interno stripe 503 sk_test_abc'); } } } }); return origLoad.apply(this, arguments); };
  let msg = ''; try { await co(A('p@teste.pt'), { returnUrl: 'https://www.weddy.pt/app/' }); } catch (e) { msg = e.code + '|' + e.message; }
  ok(/^internal\|/.test(msg) && !/segredo|sk_test|503/.test(msg), 'Stripe indisponível → erro genérico sem detalhes técnicos');
  Module._load = function (req) { if (req === 'stripe') return stripeStub; return origLoad.apply(this, arguments); };
  // Webhook Stripe
  ok((await webhook(sess('cs_1', 'wP'), 'bad')).code === 400, 'webhook com assinatura inválida → 400');
  const g = mkRes(); await fns.stripeWebhook({ method: 'GET', headers: {} }, g); ok(g.code === 405, 'webhook GET → 405');
  ok((await subOf('wP')) === undefined, 'nada ativado por pedidos inválidos');
  ok((await webhook(sess('cs_u', 'wP', { payment_status: 'unpaid' }))).code === 200 && (await subOf('wP')) === undefined, 'completed com unpaid (MB WAY pendente) não ativa');
  await webhook(sess('cs_1', 'wP'));
  const s1 = await subOf('wP');
  ok(s1 && s1.active === true && s1.plan === 'premium-12meses' && s1.premiumUntil, 'pagamento confirmado ativa Premium 12 meses');
  await webhook(sess('cs_1', 'wP'));
  const s1b = await subOf('wP'); ok(s1b.premiumUntil.toMillis ? s1b.premiumUntil.toMillis() === s1.premiumUntil.toMillis() : String(s1b.premiumUntil) === String(s1.premiumUntil), 'reenvio do mesmo evento não estende outra vez');
  await Promise.all([1, 2, 3, 4, 5].map(() => webhook(sess('cs_2', 'wQ'))));
  const sq = await subOf('wQ'); ok(sq && (sq.stripeCheckoutSessionIds || []).filter((x) => x === 'cs_2').length === 1, 'entregas concorrentes do mesmo evento: uma só ativação');
  await webhook({ type: 'checkout.session.async_payment_succeeded', data: { object: { id: 'cs_3', payment_status: 'paid', metadata: { weddingId: 'wP' } } } });
  const s3 = await subOf('wP'); ok((s3.stripeCheckoutSessionIds || []).includes('cs_3') && (s3.stripeCheckoutSessionIds || []).includes('cs_1'), 'pagamento assíncrono ativa e mantém histórico de sessões');
  const t = (x) => (x && x.toMillis ? x.toMillis() : new Date(x).getTime());
  ok(t(s3.premiumUntil) > t(s1.premiumUntil), 'segunda compra (renovação) estende a validade');
  const bad1 = await webhook(sess('cs_x', 'inexistente')); ok(bad1.code === 200, 'evento para casamento inexistente → 200 (sem retry infinito)');
  ok(!(await db.collection('weddings').doc('inexistente').get()).exists, 'não cria casamento a partir de metadados');
  const inc = await db.collection('_incident_log').get(); ok(inc.size >= 1, 'evento órfão deixa registo de incidente');
  ok((await webhook({ type: 'checkout.session.completed', data: { object: { id: 'cs_n', payment_status: 'paid', metadata: {} } } })).code === 200, 'evento sem weddingId → 200 + incidente');
  // RevenueCat
  const ev = (o) => Object.assign({ type: 'NON_RENEWING_PURCHASE', app_user_id: 'uid-p@teste.pt', transaction_id: 'tx1', environment: 'PRODUCTION', product_id: 'prem' }, o || {});
  ok((await rc(ev(), '')).code === 401, 'RevenueCat sem Authorization → 401');
  ok((await rc(ev(), 'Bearer errado-errado')).code === 401, 'RevenueCat com segredo errado → 401');
  ok((await rc(ev(), 'Bearer rc-secret-fakeX')).code === 401, 'RevenueCat com segredo de comprimento diferente → 401');
  await db.collection('weddings').doc('wR').set({ ownerEmails: ['r@teste.pt'], ownerUids: ['uid-r@teste.pt'], json: '{}' });
  await rc(ev({ app_user_id: 'uid-r@teste.pt', environment: 'SANDBOX', transaction_id: 'txs' })); ok((await subOf('wR')) === undefined, 'compra SANDBOX não ativa Premium');
  await rc(ev({ app_user_id: 'uid-r@teste.pt', transaction_id: 'tx9' })); const r9 = await subOf('wR'); ok(r9 && r9.active === true, 'compra PRODUCTION ativa');
  await rc(ev({ app_user_id: 'uid-r@teste.pt', transaction_id: 'tx9' })); const r9b = await subOf('wR'); ok(t(r9b.premiumUntil) === t(r9.premiumUntil), 'transação repetida não estende');
  await Promise.all([1, 2, 3].map(() => rc(ev({ app_user_id: 'uid-r@teste.pt', transaction_id: 'txC' }))));
  const rC = await subOf('wR'); ok((rC.revenueCatTransactionIds || []).filter((x) => x === 'txC').length === 1, 'RevenueCat concorrente: uma só ativação');
  await rc({ type: 'REFUND', app_user_id: 'uid-r@teste.pt', transaction_id: 'tx9', environment: 'PRODUCTION' });
  ok((await subOf('wR')).active === true, 'reembolso de transação antiga não corta compra mais recente');
  await rc({ type: 'REFUND', app_user_id: 'uid-r@teste.pt', transaction_id: 'txC', environment: 'PRODUCTION' });
  ok((await subOf('wR')).active === false, 'reembolso da última transação desativa');
  ok((await rc({ type: 'EXPIRATION', app_user_id: 'x' })).code === 200, 'outros tipos → 200 e ignorados');
  const g2 = mkRes(); await fns.revenueCatWebhook({ method: 'GET', headers: {}, body: {} }, g2); ok(g2.code === 405, 'RevenueCat GET → 405');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
