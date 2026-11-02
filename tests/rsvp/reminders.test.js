/* sendRsvpReminders: modo legado (7/3/1, máx. 3) + modo Autopilot (2–30 dias, 1–10) + idempotência.
 * Chama a lógica real (runRsvpReminders) contra o emulador Firestore. O SMTP é simulado:
 * nunca envia email real. Também confirma que nada de WhatsApp é enviado ou escrito. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>'; process.env.SMTP_HOST = 'smtp.test'; process.env.SMTP_PORT = '465'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
let fetchCalls = 0;
global.fetch = async () => { fetchCalls++; throw new Error('rede proibida nos testes'); };

const NOW = Date.UTC(2026, 10, 10, 9, 0, 5); // 10-nov-2026 09:00:05 UTC
const DAY = 86400000;
const ymd = (offsetDays) => new Date(Date.UTC(2026, 10, 10) + offsetDays * DAY).toISOString().slice(0, 10);
const ts = (offsetDays) => admin.firestore.Timestamp.fromMillis(NOW + offsetDays * DAY);

let mails = [], failTo = new Set(), delayMs = 0, onSend = null;
const transporter = { sendMail: async (m) => {
  if (onSend) await onSend(m);
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  if (failTo.has(m.to)) throw new Error('smtp down');
  mails.push(m);
} };
nodemailer.createTransport = () => transporter;
const run = (extra) => T.runRsvpReminders(Object.assign({ nowMs: NOW, transporter }, extra || {}));

async function clear() {
  for (const c of ['weddings', 'guests', 'rsvpReminderSends', 'whatsappInbox', 'whatsappConsents']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
  mails = []; failTo = new Set(); delayMs = 0; onSend = null; fetchCalls = 0;
}
const premium = () => ({ active: true, startedAt: new Date(NOW).toISOString() });
async function wedding(id, o) {
  o = o || {};
  const d = { ownerEmails: ['o@example.com'], subscription: o.noPremium ? { active: false } : premium() };
  if (o.settings) d.settings = o.settings;
  await db.collection('weddings').doc(id).set(d);
}
async function guest(tok, f) { const o = Object.assign({ weddingId: 'W', name: 'Convidado ' + tok, email: tok + '@example.com', rsvpDeadline: ymd(7), isFamily: false }, f || {}); Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); await db.collection('guests').doc(tok).set(o); }
const g = async (tok) => (await db.collection('guests').doc(tok).get()).data();
const sentTo = (tok) => mails.filter((m) => m.to === tok + '@example.com').length;
const ledger = async () => (await db.collection('rsvpReminderSends').get()).docs.map((d) => d.data());

(async () => {
  // ---------- LEGADO: casamento sem definições ----------
  await clear(); await wedding('W');
  await guest('a7', { rsvpDeadline: ymd(7) }); await guest('a3', { rsvpDeadline: ymd(3) }); await guest('a1', { rsvpDeadline: ymd(1) });
  await guest('a5', { rsvpDeadline: ymd(5) }); await guest('a10', { rsvpDeadline: ymd(10) }); await guest('a0', { rsvpDeadline: ymd(0) }); await guest('aPast', { rsvpDeadline: ymd(-2) });
  let s = await run();
  ok(s.sent === 3 && mails.length === 3, 'legado: só 7, 3 e 1 dias antes do prazo (3 emails)');
  ok(sentTo('a5') + sentTo('a10') + sentTo('a0') + sentTo('aPast') === 0, 'legado: 5, 10, 0 dias e prazo passado não recebem');
  let d = await g('a7');
  ok(d.remindersSent === 1 && d.lastReminderDay === 7 && !!d.lastReminderAt, 'legado: contadores remindersSent/lastReminderDay/lastReminderAt como antes');
  s = await run();
  ok(s.sent === 0 && mails.length === 3, 'legado: segunda execução no mesmo dia não repete');
  // máximo 3 e respondidos
  await clear(); await wedding('W');
  await guest('m3', { rsvpDeadline: ymd(3), remindersSent: 3 }); await guest('m2', { rsvpDeadline: ymd(1), remindersSent: 2 });
  await guest('yes', { attending: true }); await guest('no', { attending: false }); await guest('maybe', { attending: null });
  await run();
  ok(sentTo('m3') === 0, 'legado: já com 3 lembretes → não recebe o 4.º');
  ok(sentTo('m2') === 1 && (await g('m2')).remindersSent === 3, 'legado: com 2 lembretes recebe o 3.º');
  ok(sentTo('yes') === 0 && sentTo('no') === 0, 'legado: quem já respondeu (sim/não) não recebe');
  ok(sentTo('maybe') === 1, 'legado: quem ainda não respondeu (talvez/nulo) continua a receber');
  // Premium, email, definições sem autopilot
  await clear(); await wedding('W', { noPremium: true }); await guest('np');
  await run(); ok(mails.length === 0, 'legado: casamento sem Premium não recebe');
  await clear(); await wedding('W'); await guest('bad', { email: 'não-é-email' }); await guest('empty', { email: '' });
  await run(); ok(mails.length === 0, 'legado: email inválido ou vazio não recebe');
  await clear(); await wedding('W', { settings: { coupleName1: 'Ana', rsvpAutopilot: 'lixo' } }); await guest('x10', { rsvpDeadline: ymd(10) }); await guest('x7', { rsvpDeadline: ymd(7) });
  await run(); ok(sentTo('x7') === 1 && sentTo('x10') === 0, 'legado: settings sem rsvpAutopilot válido mantém 7/3/1');
  await clear(); await wedding('W', { settings: { rsvpAutopilot: { intervalDays: '7', maxReminders: '2' } } }); await guest('x10', { rsvpDeadline: ymd(10) }); await guest('x7', { rsvpDeadline: ymd(7) });
  await run(); ok(sentTo('x7') === 1 && sentTo('x10') === 0, 'legado: rsvpAutopilot com valores não numéricos conta como não configurado');

  // ---------- AUTOPILOT ----------
  const AP = (iv, mx) => ({ rsvpAutopilot: { intervalDays: iv, maxReminders: mx } });
  await clear(); await wedding('W', { settings: AP(5, 3) });
  await guest('n10', { rsvpDeadline: ymd(10) }); await guest('n30', { rsvpDeadline: ymd(30) }); await guest('n0', { rsvpDeadline: ymd(0) });
  await guest('past', { rsvpDeadline: ymd(-1) }); await guest('nodl', { rsvpDeadline: '' });
  s = await run();
  ok(sentTo('n10') === 1 && sentTo('n30') === 1 && sentTo('n0') === 1, 'autopilot: envia mesmo fora dos dias 7/3/1 (10, 30 e 0 dias do prazo)');
  ok(sentTo('past') === 0 && sentTo('nodl') === 0, 'autopilot: prazo passado ou sem prazo não recebe email');
  s = await run(); ok(s.sent === 0, 'autopilot: nova execução no mesmo dia não repete');
  // intervalo
  async function interval(iv, ago) { await clear(); await wedding('W', { settings: AP(iv, 10) }); await guest('i', { rsvpDeadline: ymd(40), remindersSent: 1, lastReminderAt: ts(-ago), lastReminderDay: 9 }); await run(); return sentTo('i'); }
  ok(await interval(5, 3) === 0, 'intervalo 5: lembrado há 3 dias → não');
  ok(await interval(5, 5) === 1, 'intervalo 5: lembrado há 5 dias → sim');
  ok(await interval(2, 1) === 0 && await interval(2, 2) === 1, 'intervalo 2 (mínimo): 1 dia não, 2 dias sim');
  ok(await interval(30, 29) === 0 && await interval(30, 30) === 1, 'intervalo 30 (máximo): 29 dias não, 30 dias sim');
  // máximo
  async function maxr(mx, count) { await clear(); await wedding('W', { settings: AP(2, mx) }); await guest('m', { rsvpDeadline: ymd(40), remindersSent: count, lastReminderAt: ts(-10) }); await run(); return sentTo('m'); }
  ok(await maxr(1, 1) === 0 && await maxr(1, 0) === 1, 'máximo 1: com 1 lembrete não; com 0 sim');
  ok(await maxr(10, 9) === 1 && await maxr(10, 10) === 0, 'máximo 10: com 9 sim; com 10 não');
  ok(await maxr(2, 2) === 0, 'respeita um máximo do casal inferior ao legado (2): o 3.º não sai');
  ok(await maxr(6, 4) === 1, 'respeita um máximo superior ao legado (6): o 5.º sai');
  // limites e defeitos
  async function cfgOf(settings) { return T.rsvpAutopilotServerConfig(settings); }
  const c1 = await cfgOf(AP(1, 0)), c2 = await cfgOf(AP(99, 11)), c3 = await cfgOf({ rsvpAutopilot: { maxReminders: 4 } }), c4 = await cfgOf({ rsvpAutopilot: { intervalDays: 8 } }), c5 = await cfgOf({ rsvpAutopilot: { intervalDays: 7.4, maxReminders: 2.6 } });
  ok(c1.intervalDays === 5 && c1.maxReminders === 3, 'fora de limites (1 e 0) voltam aos defeitos 5 e 3');
  ok(c2.intervalDays === 5 && c2.maxReminders === 3, 'fora de limites (99 e 11) voltam aos defeitos 5 e 3');
  ok(c3.intervalDays === 5 && c3.maxReminders === 4, 'só maxReminders definido → intervalo por defeito 5');
  ok(c4.intervalDays === 8 && c4.maxReminders === 3, 'só intervalDays definido → máximo por defeito 3');
  ok(c5.intervalDays === 7 && c5.maxReminders === 3, 'arredondamento igual ao cliente (7.4→7; 2.6→3)');
  ok(await cfgOf({}) === null && await cfgOf(null) === null && await cfgOf({ rsvpAutopilot: {} }) === null, 'sem definições → null (legado)');
  // respondidos, Premium
  await clear(); await wedding('W', { settings: AP(5, 3) }); await guest('yes', { attending: true, rsvpDeadline: ymd(10) }); await guest('no', { attending: false, rsvpDeadline: ymd(10) }); await guest('pend', { rsvpDeadline: ymd(10) });
  await run(); ok(sentTo('yes') + sentTo('no') === 0 && sentTo('pend') === 1, 'autopilot: respondidos (sim/não) não recebem');
  await clear(); await wedding('W', { settings: AP(5, 3), noPremium: true }); await guest('np', { rsvpDeadline: ymd(10) });
  await run(); ok(mails.length === 0, 'autopilot: casamento sem Premium não recebe');
  // um convite não duplica: no autopilot, 7 dias do prazo conta uma só vez
  await clear(); await wedding('W', { settings: AP(5, 3) }); await guest('d7', { rsvpDeadline: ymd(7) });
  await run(); await run(); ok(sentTo('d7') === 1 && (await g('d7')).remindersSent === 1, 'autopilot: convite elegível pelo modo legado e pelo autopilot sai uma só vez');
  // o intervalo do casal manda: 20 dias de intervalo, a 7 dias do prazo, lembrado ontem → não
  await clear(); await wedding('W', { settings: AP(20, 3) }); await guest('iv', { rsvpDeadline: ymd(7), remindersSent: 1, lastReminderAt: ts(-1), lastReminderDay: 8 });
  await run(); ok(mails.length === 0, 'autopilot: o calendário 7/3/1 deixa de se aplicar (manda o intervalo)');
  // dois casamentos, modos diferentes na mesma execução
  await clear(); await wedding('WL'); await wedding('WA', { settings: AP(5, 3) });
  await guest('l7', { weddingId: 'WL', rsvpDeadline: ymd(7) }); await guest('l10', { weddingId: 'WL', rsvpDeadline: ymd(10) });
  await guest('p10', { weddingId: 'WA', rsvpDeadline: ymd(10) });
  await run(); ok(sentTo('l7') === 1 && sentTo('l10') === 0 && sentTo('p10') === 1, 'dois casamentos na mesma execução, cada um no seu modo');
  // famílias
  await clear(); await wedding('W', { settings: AP(5, 2) });
  await guest('fam', { isFamily: true, email: undefined, rsvpDeadline: ymd(10), members: [{ rsvpMemberId: 'm1', name: 'M1' }, { rsvpMemberId: 'm2', name: 'M2' }, { guestId: 'm3', name: 'M3' }, { rsvpMemberId: 'm4', name: 'M4' }],
    emails: { m1: 'm1@example.com', m2: 'm2@example.com', m3: 'm3@example.com' }, responses: { m2: { attending: true } },
    reminders: { m3: { remindersSent: 2, lastReminderAt: ts(-9) } } });
  await run();
  const f = await g('fam');
  ok(sentTo('m1') === 1 && f.reminders.m1.remindersSent === 1, 'família: membro pendente recebe e o contador é por membro');
  ok(sentTo('m2') === 0 && sentTo('m3') === 0 && sentTo('m4') === 0, 'família: respondeu / máximo (2) atingido / sem email → não recebe');
  await run(); ok(mails.length === 1, 'família: segunda execução não repete');

  // ---------- IDEMPOTÊNCIA ----------
  // execuções concorrentes
  for (const runs of [2, 3, 5]) {
    await clear(); await wedding('W', { settings: AP(5, 3) });
    const toks = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']; for (const t of toks) await guest(t, { rsvpDeadline: ymd(10) });
    delayMs = 25;
    const rs = await Promise.all(Array.from({ length: runs }, () => run()));
    const per = toks.map(sentTo);
    ok(per.every((n) => n === 1) && mails.length === toks.length, `concorrência: ${runs} execuções em simultâneo → exatamente 1 email por convidado (${mails.length}/${toks.length})`);
    const led = await ledger();
    ok(led.length === toks.length && led.every((l) => l.status === 'sent'), `concorrência (${runs}): uma reserva "sent" por lembrete`);
    ok((await Promise.all(toks.map(g))).every((x) => x.remindersSent === 1), `concorrência (${runs}): contadores a 1`);
    ok(rs.reduce((a, r) => a + r.sent, 0) === toks.length, `concorrência (${runs}): soma de enviados = ${toks.length}`);
  }
  // concorrência no modo legado
  await clear(); await wedding('W'); for (const t of ['k1', 'k2', 'k3']) await guest(t, { rsvpDeadline: ymd(3) });
  delayMs = 25; await Promise.all([run(), run(), run()]);
  ok(mails.length === 3, 'concorrência no modo legado: 3 emails em 3 execuções simultâneas');
  // falha SMTP
  await clear(); await wedding('W', { settings: AP(5, 3) }); await guest('f1', { rsvpDeadline: ymd(10) }); await guest('f2', { rsvpDeadline: ymd(10) });
  failTo = new Set(['f1@example.com']);
  s = await run();
  ok(s.failed === 1 && s.sent === 1 && sentTo('f2') === 1 && sentTo('f1') === 0, 'SMTP falha num: o outro sai e o falhado conta como falhado');
  const f1 = await g('f1');
  ok(!f1.remindersSent && !f1.lastReminderAt, 'SMTP falhou: contador do convidado NÃO avançou');
  let led = await ledger();
  ok(led.length === 1 && led[0].guestDoc === 'f2', 'SMTP falhou: a reserva foi libertada (só resta a do enviado)');
  failTo = new Set(); s = await run();
  ok(s.sent === 1 && sentTo('f1') === 1 && sentTo('f2') === 1 && (await g('f1')).remindersSent === 1, 'depois de o SMTP voltar, o lembrete sai uma só vez');
  s = await run(); ok(s.sent === 0 && mails.length === 2, 'retry/nova execução depois do sucesso não duplica');
  // não marca como enviado antes do SMTP
  await clear(); await wedding('W', { settings: AP(5, 3) }); await guest('o1', { rsvpDeadline: ymd(10) });
  let during = null;
  onSend = async () => { const x = await g('o1'); const l = await ledger(); during = { count: x.remindersSent || 0, status: l[0] && l[0].status }; };
  await run();
  ok(during && during.count === 0 && during.status === 'reserved', 'durante o envio: contador a 0 e reserva "reserved" (nada marcado como enviado antes do SMTP)');
  ok((await g('o1')).remindersSent === 1 && (await ledger())[0].status === 'sent', 'depois do SMTP: contador 1 e reserva "sent"');
  // revalidação na transação: respondeu entretanto
  await clear(); await wedding('W', { settings: AP(5, 3) });
  const order = ['r1', 'r2']; for (const t of order) await guest(t, { rsvpDeadline: ymd(10) });
  onSend = async (m) => { if (m.to === 'r1@example.com') await db.collection('guests').doc('r2').update({ attending: true }); };
  await run();
  ok(sentTo('r1') === 1 && sentTo('r2') === 0, 'convidado que responde durante a execução não recebe (revalidação na reserva)');
  // reserva fresca de outra execução
  await clear(); await wedding('W', { settings: AP(5, 3) }); await guest('p1', { rsvpDeadline: ymd(10) });
  let first = await run(); // cria a reserva sent
  await db.collection('guests').doc('p1').update({ remindersSent: admin.firestore.FieldValue.delete(), lastReminderAt: admin.firestore.FieldValue.delete(), lastReminderDay: admin.firestore.FieldValue.delete() });
  let l0 = (await db.collection('rsvpReminderSends').get()).docs[0];
  await l0.ref.update({ status: 'reserved', reservedAtMs: NOW });
  mails = []; s = await run();
  ok(mails.length === 0 && s.skipped === 1, 'reserva "reserved" recente (outra execução a meio) → não envia');
  await l0.ref.update({ status: 'reserved', reservedAtMs: NOW - T.RSVP_REMINDER_LEASE_MS - 1000 });
  mails = []; s = await run();
  ok(mails.length === 1 && (await g('p1')).remindersSent === 1, 'reserva "reserved" caducada (execução morreu) → é retomada e envia');
  // reserva "sent" com contador atrás → repara sem reenviar
  await db.collection('guests').doc('p1').update({ remindersSent: admin.firestore.FieldValue.delete(), lastReminderAt: admin.firestore.FieldValue.delete(), lastReminderDay: admin.firestore.FieldValue.delete() });
  mails = []; await run();
  ok(mails.length === 0 && (await g('p1')).remindersSent === 1, 'reserva "sent" com contador desatualizado → repara o contador e não reenvia');
  // a reserva não guarda dados pessoais
  const led2 = await ledger();
  ok(led2.every((l) => !JSON.stringify(l).includes('@') && !('email' in l) && !('name' in l)), 'reserva não guarda email nem nome');
  // sem WhatsApp
  ok(fetchCalls === 0, 'nenhum pedido de rede (nada de WhatsApp/OpenAI) durante os lembretes');
  ok((await db.collection('whatsappInbox').get()).empty && (await db.collection('whatsappConsents').get()).empty, 'nada escrito em whatsappInbox/whatsappConsents');
  // dados antigos / nulos
  await clear(); await wedding('W', { settings: AP(5, 3) });
  await guest('o2', { rsvpDeadline: ymd(10), lastReminderAt: null, remindersSent: null, lastReminderDay: null });
  await guest('o3', { rsvpDeadline: ymd(10), attending: undefined, members: undefined });
  await run(); ok(sentTo('o2') === 1 && sentTo('o3') === 1, 'campos nulos/ausentes (dados antigos) tratados sem erro');
  await clear(); await db.collection('guests').doc('semwed').set({ name: 'x', email: 'x@example.com', rsvpDeadline: ymd(7) });
  await db.collection('guests').doc('wedmissing').set({ weddingId: 'NAO', name: 'x', email: 'y@example.com', rsvpDeadline: ymd(7) });
  s = await run(); ok(mails.length === 0, 'convites sem casamento / casamento inexistente: nada enviado, sem erro');

  console.log(`\n${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
