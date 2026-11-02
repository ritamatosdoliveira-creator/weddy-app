/* Testes da sendContactMessage (formulário público de contactos).
 * Correr (emulador Firestore em 127.0.0.1:8085):
 *   NODE_PATH=<node_modules> FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GCLOUD_PROJECT=demo-weddy \
 *   WEDDY_EXPOSE_INTERNALS_FOR_TESTS=1 node tests/contact/send-contact.test.js
 * Usa um "sendMail" simulado: nunca envia email real.
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

// SMTP_FROM é defineString: sem valor no teste.
process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>';

function mkRes() {
  const r = { code: null, body: null, headers: {} };
  r.set = (k, v) => { r.headers[k] = v; return r; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}
const good = { nome: 'Ana Silva', email: 'ana@example.com', assunto: 'Suporte', msg: 'Olá, preciso de ajuda com o meu casamento.', website: '' };
async function post(body, over) {
  const mails = [];
  const req = Object.assign({
    method: 'POST', ip: '203.0.113.7', body,
    headers: { origin: 'https://www.weddy.pt', 'content-type': 'application/json', 'content-length': '200' },
  }, over || {});
  if (over && over.headers) req.headers = Object.assign({ origin: 'https://www.weddy.pt', 'content-type': 'application/json' }, over.headers);
  const res = mkRes();
  await T.handleContactRequest(req, res, async (m) => { mails.push(m); });
  return { res, mails };
}
async function clear() {
  const s = await db.collection('siteRateLimits').get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
}

(async () => {
  await clear();
  // --- caminho feliz
  let { res, mails } = await post(good);
  ok(res.code === 200 && res.body.ok === true, 'pedido válido → 200');
  ok(mails.length === 1 && mails[0].to === 'geral@weddy.pt', 'destinatário fixo geral@weddy.pt');
  ok(mails[0].replyTo === 'ana@example.com', 'email do visitante só em Reply-To');
  ok(res.headers['Access-Control-Allow-Origin'] === 'https://www.weddy.pt', 'CORS: origem da Weddy aceite');

  // --- método / origem / tipo / tamanho
  ({ res, mails } = await post(good, { method: 'GET' }));
  ok(res.code === 405 && !mails.length, 'GET → 405');
  ({ res, mails } = await post(good, { method: 'OPTIONS' }));
  ok(res.code === 204 && !mails.length, 'OPTIONS (preflight) → 204 sem enviar');
  ({ res, mails } = await post(good, { headers: { origin: 'https://evil.example', 'content-type': 'application/json' } }));
  ok(res.code === 403 && !mails.length, 'origem estranha → 403');
  ok(!res.headers['Access-Control-Allow-Origin'], 'origem estranha não recebe CORS');
  ({ res, mails } = await post(good, { headers: { 'content-type': 'text/plain' } }));
  ok(res.code === 415 && !mails.length, 'text/plain → 415');
  ({ res, mails } = await post(good, { headers: { 'content-type': 'application/json', 'content-length': '999999' } }));
  ok(res.code === 413 && !mails.length, 'corpo grande → 413');

  // --- validação / tipos
  for (const [name, b] of [
    ['sem nome', { ...good, nome: '  ' }],
    ['email inválido', { ...good, email: 'sem-arroba' }],
    ['email com vírgula (2 destinatários)', { ...good, email: 'a@example.com,b@example.com' }],
    ['email com <>', { ...good, email: 'a<b>@example.com' }],
    ['mensagem curta', { ...good, msg: 'oi' }],
    ['mensagem enorme', { ...good, msg: 'x'.repeat(4001) }],
    ['nome objeto', { ...good, nome: { $ne: 1 } }],
    ['email array', { ...good, email: ['a@example.com'] }],
    ['msg número', { ...good, msg: 12345678901 }],
    ['corpo array', [good]],
    ['corpo nulo', null],
    ['corpo string', 'olá'],
  ]) {
    ({ res, mails } = await post(b));
    ok(res.code === 400 && !mails.length, 'rejeita: ' + name);
  }

  // --- injeção de cabeçalhos
  ({ res, mails } = await post({ ...good, nome: 'Ana\r\nBcc: vitima@example.com', email: 'ana@example.com' }));
  ok(res.code === 200 && mails.length === 1 && !/[\r\n]/.test(mails[0].subject), 'CRLF no nome não chega ao assunto');
  ok(!/Bcc/i.test(Object.keys(mails[0]).join(',')) && !mails[0].bcc, 'sem Bcc injetado');
  ({ res, mails } = await post({ ...good, email: 'ana@example.com\r\nBcc: vitima@example.com' }));
  ok(res.code === 400 && !mails.length, 'CRLF no email → rejeitado');
  ({ res, mails } = await post({ ...good, assunto: 'Qualquer\r\nBcc: x@y.pt' }));
  ok(res.code === 200 && mails[0].subject.includes('Outro assunto') && !/Bcc/.test(mails[0].subject), 'assunto fora da lista → "Outro assunto"');

  // --- HTML escapado
  ({ res, mails } = await post({ ...good, nome: '<img src=x onerror=alert(1)>', msg: '<script>alert(1)</script> mensagem comprida' }));
  ok(res.code === 200 && !/<script>|<img/.test(mails[0].html), 'HTML do visitante escapado');

  // --- honeypot
  ({ res, mails } = await post({ ...good, website: 'http://spam.example' }));
  ok(res.code === 200 && !mails.length, 'honeypot → 200 mas não envia');

  // --- erro de SMTP
  {
    const rq = { method: 'POST', ip: '198.51.100.1', body: good, headers: { origin: 'https://www.weddy.pt', 'content-type': 'application/json' } };
    const r = mkRes();
    await T.handleContactRequest(rq, r, async () => { throw new Error('smtp down'); });
    ok(r.code === 502 && r.body.error === 'send_failed' && !/smtp/.test(JSON.stringify(r.body)), 'SMTP em baixo → 502 sem detalhes');
  }

  // --- limite por IP (5/hora): o IP 203.0.113.7 já usou 4 envios aceites acima
  await clear();
  let codes = [];
  for (let i = 0; i < 7; i++) { const r = await post(good, { ip: '192.0.2.50' }); codes.push(r.res.code); }
  ok(codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429 && codes[6] === 429, 'limite por IP: 5 ok, depois 429 (' + codes.join(',') + ')');
  const other = await post(good, { ip: '192.0.2.51' });
  ok(other.res.code === 200, 'outro IP não é afetado');

  // --- limite global diário (200)
  await clear();
  const day = new Date().toISOString().slice(0, 10);
  await db.collection('siteRateLimits').doc('contact_day_' + day).set({ start: Date.now(), count: 200 });
  const g = await post(good, { ip: '192.0.2.99' });
  ok(g.res.code === 429 && !g.mails.length, 'limite global diário → 429');

  // --- concorrência: 10 pedidos em simultâneo do mesmo IP → no máximo 5 enviados
  await clear();
  const conc = await Promise.all(Array.from({ length: 10 }, () => post(good, { ip: '192.0.2.77' })));
  const sent = conc.reduce((n, r) => n + r.mails.length, 0);
  ok(sent <= 5, 'concorrência: no máximo 5 enviados (enviados=' + sent + ')');

  // --- pura: validateContactBody
  const v = T.validateContactBody({ ...good, nome: 'A'.repeat(500) });
  ok(v.ok && v.nome.length === 100, 'nome cortado a 100');
  const v2 = T.validateContactBody({ ...good, msg: 'linha1\r\nlinha2 com texto suficiente\u0000' });
  ok(v2.ok && !/\u0000/.test(v2.msg), 'caracteres de controlo removidos da mensagem');

  await clear();
  console.log(`\n${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
