/* Testes do email resumo (A.2): regras de envio, conteúdo, segurança e anulação.
 *   NODE_PATH=<node_modules> FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GCLOUD_PROJECT=demo-weddy \
 *   WEDDY_EXPOSE_INTERNALS_FOR_TESTS=1 node tests/notify/email-digest.test.js
 * Nunca envia email real: o sendMail é simulado.
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();
process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

const MON = new Date('2026-11-02T10:00:00Z');   // segunda-feira
const TUE = new Date('2026-11-03T10:00:00Z');
const WED = new Date('2026-11-04T10:00:00Z');
const THU = new Date('2026-11-05T10:00:00Z');
const FRI = new Date('2026-11-06T10:00:00Z');

function mkState(over) {
  return Object.assign({
    settings: { coupleName1: 'Ana', coupleName2: 'Rui', weddingDate: '2027-06-20', rsvpDeadline: '2027-04-01' },
    todoCategories: [{ id: 'c1', label: 'Geral', items: [
      { text: 'Provar o bolo', due: '2026-11-05', done: false },
      { text: 'Atrasada', due: '2026-10-20', done: false },
      { text: 'Feita', due: '2026-11-04', done: true },
      { text: 'Sem data', done: false },
    ] }],
    expenses: [
      { desc: 'Quinta', value: 1000, paid: 200, dueDate: '2026-11-10' },
      { desc: 'Flores', value: 500, paid: 0, dueDate: '2026-10-25' },
      { desc: 'Pago', value: 100, paid: 100, dueDate: '2026-10-25' },
    ],
  }, over || {});
}
async function seedWedding(id, o) {
  o = o || {};
  await db.collection('weddings').doc(id).set({
    ownerEmails: o.emails || ['noiva@example.com'],
    json: typeof o.json === 'string' ? o.json : JSON.stringify(o.state || mkState()),
    subscription: o.premium ? { active: true, startedAt: new Date().toISOString() } : { active: false },
  });
  return db.collection('weddings').doc(id).get();
}
async function clear() {
  for (const c of ['weddings', 'guests', 'notifState']) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
}
function mkRes() {
  const r = { code: null, body: '' };
  r.set = () => r; r.status = (c) => { r.code = c; return r; }; r.send = (b) => { r.body = b; return r; };
  return r;
}

(async () => {
  await clear();

  // ---------- preferências ----------
  ok(JSON.stringify(T.notifyEmailPrefs({})) === '{"digest":"weekly","alerts":true}', 'defeito: resumo semanal ligado, alertas ligados');
  ok(T.notifyEmailPrefs({ notif: { prefs: { email: { digest: 'off', alerts: false } } } }).digest === 'off', 'preferência desligada respeitada');
  ok(T.notifyEmailPrefs({ notif: { prefs: { email: 'lixo' } } }).digest === 'weekly', 'preferência corrompida cai no defeito');
  ok(T.notifyEmailPrefs(null).alerts === true && T.notifyEmailPrefs({ notif: null }).alerts === true, 'estado nulo não rebenta');

  // ---------- dados do resumo (estado normal e extremo) ----------
  const d1 = T.buildDigestData(mkState(), { yes: 5, no: 1, maybe: 0, pending: 4 }, MON, true);
  ok(d1.tasks.week === 1 && d1.tasks.overdue === 1 && d1.tasks.names[0] === 'Provar o bolo', 'tarefas: 1 esta semana, 1 em atraso, concluída/sem data ignoradas');
  ok(d1.payments.overdue === 1 && d1.payments.soon === 1, 'pagamentos: 1 em atraso, 1 a vencer; pago ignorado');
  ok(d1.daysToWedding === 230 && d1.rsvp.pending === 4, 'dias para o casamento e RSVP (Premium)');
  const d2 = T.buildDigestData(mkState(), { yes: 1, no: 0, maybe: 0, pending: 1 }, MON, false);
  ok(d2.rsvp === null && d2.rsvpDeadline === null, 'sem Premium: sem secção RSVP');
  for (const [nome, st] of [
    ['null', null], ['array', []], ['string', 'x'], ['número', 7],
    ['listas corrompidas', { todoCategories: 'x', expenses: { a: 1 }, settings: 5 }],
    ['itens nulos', { todoCategories: [null, { items: [null, 7, { due: 'ontem' }] }], expenses: [null, 3, { dueDate: 'x', value: 'abc' }] }],
    ['datas inválidas', { settings: { weddingDate: '2027-13-45' }, todoCategories: [{ items: [{ text: 'a', due: '99999-99-99' }] }] }],
  ]) {
    let r, err = null;
    try { r = T.buildDigestData(st, null, MON, true); } catch (e) { err = e; }
    ok(!err && r && r.tasks.overdue === 0 && r.payments.overdue === 0, 'estado extremo não rebenta: ' + nome);
  }
  const big = mkState({ todoCategories: [{ items: Array.from({ length: 5000 }, (_, i) => ({ text: 't' + i, due: '2026-11-0' + (1 + (i % 9)), done: false })) }] });
  ok(T.buildDigestData(big, null, MON, false).tasks.names.length <= 3, '5000 tarefas: no máximo 3 títulos');

  // ---------- RSVP: contagem ----------
  const tl = T.tallyRsvpDocs([
    { attending: true }, { attending: false }, { rsvpStatus: 'maybe' }, {}, null, 'x',
    { isFamily: true, members: [{ rsvpMemberId: 'a' }, { rsvpMemberId: 'b' }, { guestId: 'c' }, null], responses: { a: { attending: true }, b: { attending: false } } },
  ]);
  ok(tl.yes === 2 && tl.no === 2 && tl.maybe === 1 && tl.pending === 2, 'contagem RSVP individual + família + lixo ignorado');

  // ---------- plano de envio ----------
  const prefs = { digest: 'weekly', alerts: true };
  const quiet = T.buildDigestData(mkState({ todoCategories: [], expenses: [] }), null, MON, false);
  ok(T.planNotifyEmail({ now: MON, prefs, st: {}, data: quiet }).kind === 'digest', 'segunda-feira: resumo semanal');
  ok(T.planNotifyEmail({ now: TUE, prefs, st: {}, data: quiet }).kind === null, 'terça sem alertas: nada');
  ok(T.planNotifyEmail({ now: TUE, prefs, st: {}, data: d1 }).kind === 'alert', 'terça com atrasos: alerta');
  ok(T.planNotifyEmail({ now: TUE, prefs: { digest: 'weekly', alerts: false }, st: {}, data: d1 }).kind === null, 'alertas desligados: nada');
  ok(T.planNotifyEmail({ now: MON, prefs: { digest: 'off', alerts: true }, st: {}, data: quiet }).kind === null, 'resumo desligado e sem alertas: nada na segunda');
  ok(T.planNotifyEmail({ now: MON, prefs, st: { emailOff: true }, data: d1 }).why === 'unsubscribed', 'anulado: nunca envia');
  ok(T.planNotifyEmail({ now: MON, prefs, st: { sentLog: ['2026-11-02'] }, data: d1 }).why === 'daily_cap', 'teto diário: 1 por dia');
  ok(T.planNotifyEmail({ now: FRI, prefs, st: { sentLog: ['2026-10-31', '2026-11-02', '2026-11-04'] }, data: d1 }).why === 'weekly_cap', 'teto semanal: 3 em 7 dias');
  ok(T.planNotifyEmail({ now: FRI, prefs, st: { sentLog: ['2026-10-20', '2026-10-21', '2026-10-22'] }, data: d1 }).kind === 'alert', 'envios antigos não contam para o teto');
  ok(T.planNotifyEmail({ now: TUE, prefs, st: { alertKeys: { 'pay-od': '2026-11-01', 'task-od': '2026-11-01' } }, data: d1 }).kind === null, 'alerta repetido (mesma chave <14 dias) é suprimido');
  ok(T.planNotifyEmail({ now: TUE, prefs, st: { alertKeys: { 'pay-od': '2026-10-01', 'task-od': '2026-10-01' } }, data: d1 }).kind === 'alert', 'passados 14 dias o alerta volta');
  ok(T.planNotifyEmail({ now: MON, prefs, st: { lastDigestDay: '2026-11-02' }, data: quiet }).kind === null, 'resumo não repete no mesmo dia');
  ok(T.planNotifyEmail({ now: MON, prefs, st: { sentLog: 'lixo', alertKeys: 5 }, data: d1 }).kind === 'digest', 'estado de envio corrompido não rebenta');
  const soon = T.buildDigestData(mkState({ settings: { weddingDate: '2026-11-08', coupleName1: 'A', coupleName2: 'B' }, todoCategories: [], expenses: [] }), null, TUE, false);
  ok(T.pickDigestAlerts(soon).some((a) => a.key === 'wd-7'), 'alerta: casamento nos próximos 7 dias');
  const dl = T.buildDigestData(mkState({ settings: { weddingDate: '2027-06-20', rsvpDeadline: '2026-11-05' }, todoCategories: [], expenses: [] }), { yes: 0, no: 0, maybe: 0, pending: 3 }, TUE, true);
  ok(T.pickDigestAlerts(dl).some((a) => a.key === 'rsvp-dl' && a.n === 3), 'alerta: prazo RSVP em 3 dias com convidados sem resposta');

  // ---------- processamento de um casamento ----------
  const mails = [];
  const send = async (m) => { mails.push(m); };
  let w = await seedWedding('W1', { premium: true });
  await db.collection('guests').add({ weddingId: 'W1', attending: true });
  await db.collection('guests').add({ weddingId: 'W1' });
  await db.collection('guests').add({ weddingId: 'OUTRO', attending: true });
  let r = await T.processNotifyWedding(w, MON, send, false);
  ok(r.sent === false && r.why === 'disabled' && r.wouldSend === 'digest' && mails.length === 0, 'desligado (defeito): calcula mas NÃO envia');
  ok(!(await db.collection('notifState').doc('W1').get()).exists, 'desligado: não escreve estado de envio');
  r = await T.processNotifyWedding(w, MON, send, true);
  ok(r.sent === true && r.kind === 'digest' && mails.length === 1, 'ligado: envia o resumo');
  const m = mails[0];
  ok(m.to === 'noiva@example.com', 'só vai para os donos do casamento');
  ok(/List-Unsubscribe=One-Click/.test(m.headers['List-Unsubscribe-Post']) && /unsubscribeNotify\?w=W1&t=[0-9a-f]{64}/.test(m.headers['List-Unsubscribe']), 'cabeçalhos List-Unsubscribe (one-click)');
  ok(/1 a confirmar/.test(m.text) && /1 sem resposta/.test(m.text) && !/OUTRO/.test(m.text), 'RSVP só conta convidados deste casamento');
  ok(!/€|1000|500|Quinta|Flores/.test(m.html + m.text), 'sem valores nem nomes de fornecedores no email');
  ok(/#9A4F3D|#B96752/.test(m.html) && /Georgia/.test(m.html), 'identidade Weddy (cores e tipografia de email)');
  const st = (await db.collection('notifState').doc('W1').get()).data();
  ok(st.sentLog.length === 1 && st.lastDigestDay === '2026-11-02' && /^[0-9a-f]{64}$/.test(st.unsubSecret), 'estado de envio guardado no servidor');
  r = await T.processNotifyWedding(await db.collection('weddings').doc('W1').get(), MON, send, true);
  ok(r.sent === false && r.why === 'daily_cap' && mails.length === 1, 'repetir a execução no mesmo dia não reenvia (idempotente)');
  r = await T.processNotifyWedding(await db.collection('weddings').doc('W1').get(), TUE, send, true);
  ok(r.sent === false, 'terça: alertas já avisados na segunda no resumo não repetem');

  // não Premium: sem RSVP
  mails.length = 0;
  w = await seedWedding('W2', { premium: false });
  await T.processNotifyWedding(w, MON, send, true);
  ok(mails.length === 1 && !/Convidados:/.test(mails[0].text), 'sem Premium: resumo sem secção de convidados');

  // injeção de HTML
  mails.length = 0;
  w = await seedWedding('W3', { state: mkState({ settings: { coupleName1: '<script>alert(1)</script>', coupleName2: 'Rui', weddingDate: '2027-06-20' }, todoCategories: [{ items: [{ text: '<img src=x onerror=alert(1)>', due: '2026-11-05' }] }] }) });
  await T.processNotifyWedding(w, MON, send, true);
  ok(mails.length === 1 && !/<script>|<img/.test(mails[0].html), 'nomes e tarefas escritos pelo casal são escapados no HTML');

  // casos de recusa
  mails.length = 0;
  ok((await T.processNotifyWedding(await seedWedding('W4', { json: '{corrompido' }), MON, send, true)).why === 'bad_json', 'json corrompido: ignora sem rebentar');
  ok((await T.processNotifyWedding(await seedWedding('W5', { json: '[1,2]' }), MON, send, true)).why === 'bad_json', 'json que não é objeto: ignora');
  ok((await T.processNotifyWedding(await seedWedding('W6', { emails: [] }), MON, send, true)).why === 'no_email', 'sem email: ignora');
  ok((await T.processNotifyWedding(await seedWedding('W7', { emails: ['a@b.pt\r\nBcc: x@y.pt', 42, null] }), MON, send, true)).why === 'no_email', 'emails inválidos/injeção de cabeçalho: ignora');
  ok((await T.processNotifyWedding(await seedWedding('W8', { state: mkState({ notif: { prefs: { email: { digest: 'off', alerts: false } } } }) }), MON, send, true)).why === 'prefs_off', 'preferência do casal desligada: não envia');
  ok(mails.length === 0, 'nenhum email enviado nestes casos');
  mails.length = 0;
  await T.processNotifyWedding(await seedWedding('W9', { emails: ['a@example.com', 'b@example.com', 'c@example.com'] }), MON, send, true);
  ok(mails[0].to === 'a@example.com, b@example.com', 'no máximo 2 destinatários (donos)');

  // falha de SMTP: não marca como enviado
  mails.length = 0;
  w = await seedWedding('W10', {});
  let threw = false;
  try { await T.processNotifyWedding(w, MON, async () => { throw new Error('smtp'); }, true); } catch (e) { threw = true; }
  ok(threw && !(await db.collection('notifState').doc('W10').get()).exists, 'SMTP em baixo: não regista envio (tenta no ciclo seguinte)');

  // ---------- anular subscrição ----------
  const secret = st.unsubSecret;
  const tok = T.notifyUnsubToken(secret, 'W1');
  let res = mkRes();
  await T.handleUnsubscribe({ method: 'GET', query: { w: 'W1', t: tok } }, res);
  ok(res.code === 200 && /Confirmar/.test(res.body) && !((await db.collection('notifState').doc('W1').get()).data().emailOff), 'GET mostra confirmação e NÃO anula (pré-visualizadores)');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: 'W1', t: 'f'.repeat(64) } }, res);
  ok(res.code === 400 && !((await db.collection('notifState').doc('W1').get()).data().emailOff), 'token falso: recusado');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: 'W2', t: tok } }, res);
  ok(res.code === 400, 'token de outro casamento: recusado');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: '../x', t: tok } }, res);
  ok(res.code === 400, 'id malformado: recusado');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: ['W1'], t: { a: 1 } } }, res);
  ok(res.code === 400, 'parâmetros com tipos errados: recusado');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: 'W1', t: tok } }, res);
  ok(res.code === 200 && (await db.collection('notifState').doc('W1').get()).data().emailOff === true, 'POST com token certo anula');
  r = await T.processNotifyWedding(await db.collection('weddings').doc('W1').get(), new Date('2026-11-09T10:00:00Z'), send, true);
  ok(r.sent === false && r.why === 'unsubscribed', 'depois de anular, nunca mais envia');
  res = mkRes();
  await T.handleUnsubscribe({ method: 'POST', query: { w: 'NAOEXISTE', t: tok } }, res);
  ok(res.code === 400, 'casamento sem estado: recusado');

  await clear();
  console.log(`\n${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
