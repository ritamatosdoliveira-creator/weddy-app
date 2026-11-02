/* Fase C — Teste G: a logística preenchida (ou não) nunca interfere com os lembretes por email.
 * Teste diferencial: o mesmo cenário com e sem `logistics`/campos antigos de logística tem de dar
 * exatamente os mesmos envios e contadores; os emails nunca contêm dados de logística. */
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
let fetchCalls = 0; global.fetch = async () => { fetchCalls++; throw new Error('rede proibida nos testes'); };
const NOW = Date.UTC(2026, 10, 10, 9, 0, 5), DAY = 86400000;
const ymd = (o) => new Date(Date.UTC(2026, 10, 10) + o * DAY).toISOString().slice(0, 10);
let mails = [];
const transporter = { sendMail: async (m) => { mails.push(m); } };
nodemailer.createTransport = () => transporter;
const run = () => T.runRsvpReminders({ nowMs: NOW, transporter });
async function clear() { for (const c of ['weddings', 'guests', 'rsvpReminderSends', 'whatsappInbox', 'whatsappConsents']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } mails = []; fetchCalls = 0; }
const SECRETS = ['marisco', 'amendoimSecreto', 'cadeiraXYZ', 'lactoseSecreta', 'PortoSecreto'];
const LOGI = () => ({ v: 1, transport: { from: 'PortoSecreto', people: 2 }, food: { allergies: ['marisco', 'amendoimSecreto'], intolerances: ['lactoseSecreta'] }, access: { mobility: true, other: 'cadeiraXYZ' } });
async function seed(withLogi) {
  await clear();
  await db.collection('weddings').doc('W').set({ ownerEmails: ['o@example.com'], subscription: { active: true, startedAt: new Date(NOW).toISOString() }, settings: { rsvpAutopilot: { intervalDays: 5, maxReminders: 3 } } });
  const base = { weddingId: 'W', coupleName1: 'Ana', coupleName2: 'Rui', rsvpDeadline: ymd(10), isFamily: false };
  const L = (o) => withLogi ? o : {};
  await db.collection('guests').doc('pend').set({ ...base, name: 'Pendente', email: 'pend@example.com', transporte: withLogi, alojamento: withLogi, ...L({ logistics: LOGI(), dietary: 'marisco' }) });
  await db.collection('guests').doc('yes').set({ ...base, name: 'Sim', email: 'yes@example.com', attending: true, rsvpStatus: 'yes', meal: 'carne', transporte: withLogi, ...L({ logistics: LOGI() }) });
  await db.collection('guests').doc('no').set({ ...base, name: 'Nao', email: 'no@example.com', attending: false, rsvpStatus: 'no' });
  await db.collection('guests').doc('plain').set({ ...base, name: 'Sem', email: 'plain@example.com' });
  await db.collection('guests').doc('fam').set({ ...base, name: 'Silva', isFamily: true, members: [{ rsvpMemberId: 'm1', name: 'M1' }, { rsvpMemberId: 'm2', name: 'M2' }],
    emails: { m1: 'm1@example.com', m2: 'm2@example.com' }, responses: { m2: { attending: true, ...L({ logistics: LOGI(), transporte: true }) } } });
  // consentimento WhatsApp revogado de um convidado: nunca gera WhatsApp (e o email segue o RSVP, não o consentimento)
  await db.collection('whatsappConsents').doc('W_pend').set({ weddingId: 'W', guestId: 'pend', status: 'revoked' });
}
const snapshot = async () => {
  const out = {};
  for (const t of ['pend', 'yes', 'no', 'plain', 'fam']) { const d = (await db.collection('guests').doc(t).get()).data(); out[t] = { rs: d.remindersSent || 0, ld: d.lastReminderDay || null, rem: d.reminders ? Object.fromEntries(Object.entries(d.reminders).map(([k, v]) => [k, v.remindersSent])) : null }; }
  return out;
};
(async () => {
  await seed(false); const s0 = await run(); const to0 = mails.map((m) => m.to).sort(); const snap0 = await snapshot();
  await seed(true); const s1 = await run(); const to1 = mails.map((m) => m.to).sort(); const snap1 = await snapshot();
  ok(JSON.stringify(to0) === JSON.stringify(['m1@example.com', 'pend@example.com', 'plain@example.com']), 'sem logística: recebem só pendentes ' + to0);
  ok(JSON.stringify(to0) === JSON.stringify(to1) && s0.sent === s1.sent, 'com logística: exatamente os mesmos destinatários e contagem de envios');
  ok(JSON.stringify(snap0) === JSON.stringify(snap1), 'com logística: contadores de lembretes idênticos');
  ok(mails.every((m) => !SECRETS.some((x) => (m.html + m.subject + (m.text || '')).includes(x))), 'emails nunca contêm alergias, intolerâncias, acessibilidade, origem de transporte');
  ok(!mails.some((m) => ['yes@example.com', 'no@example.com', 'm2@example.com'].includes(m.to)), 'quem já respondeu (individual e membro de família) não recebe, tenha ou não logística');
  ok(fetchCalls === 0, 'nenhum pedido de rede (nenhum WhatsApp/IA)');
  const wa = await db.collection('whatsappInbox').get(); ok(wa.size === 0, 'nada escrito em whatsappInbox');
  const d = (await db.collection('guests').doc('yes').get()).data();
  ok(!!d.logistics && d.logistics.food.allergies[0] === 'marisco', 'a execução dos lembretes não altera nem apaga a logística existente');
  const fam = (await db.collection('guests').doc('fam').get()).data();
  ok(fam.responses.m2.logistics && fam.responses.m2.attending === true, 'família: resposta e logística do membro intactas após lembretes');
  await run(); ok(mails.length === to1.length, 'segunda execução no mesmo dia não duplica (idempotência mantém-se com logística)');
  console.log(`\n${pass} OK, ${fail} FAIL`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
