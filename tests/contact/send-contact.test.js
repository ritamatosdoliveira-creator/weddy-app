/* Testes da sendContactMessage ORIGINAL de produção + proteção contra abuso.
 * Corre com emulador Firestore (ver tests/run-all.js). O envio é simulado
 * (nodemailer.createTransport substituído): nunca envia email real.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test;
const db = admin.firestore();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>'; process.env.SMTP_HOST = 'smtp.test'; process.env.SMTP_PORT = '465'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
let mails = [], smtpFail = false;
nodemailer.createTransport = () => ({ sendMail: async (m) => { if (smtpFail) throw new Error('smtp down'); mails.push(m); } });

const http = require('http');
let server, base;
const good = { nome: 'Ana Silva', email: 'ana@example.com', assunto: 'Suporte', msg: 'Olá, preciso de ajuda.', website: '' };
let n = 0;
async function post(body, o) {
  o = o || {};
  const r = await fetch(base, {
    method: o.method || 'POST',
    headers: Object.assign({ origin: 'https://www.weddy.pt', 'content-type': 'application/json' }, o.headers || {}),
    body: (o.method === 'GET') ? undefined : JSON.stringify(body),
  });
  let b = null; try { b = await r.json(); } catch (e) { /* sem corpo */ }
  return { code: r.status, body: b, headers: Object.fromEntries(r.headers) };
}
const uniq = (extra) => Object.assign({}, good, { msg: 'mensagem ' + (++n) + ' ' + Math.random() }, extra || {});
const xff = (ip) => ({ headers: { 'x-forwarded-for': ip } });
async function clear() { const s = await db.collection('siteRateLimits').get(); await Promise.all(s.docs.map((d) => d.ref.delete())); mails = []; }

(async () => {
  const express = require('express'); const app = express(); app.use(express.json()); app.all('/', fns.sendContactMessage); server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  await clear();
  // Comportamento original
  let r = await post(uniq(), xff('198.51.100.1'));
  ok(r.code === 200 && r.body.ok === true && mails.length === 1, 'válido → 200 {ok:true} e 1 email');
  ok(mails[0].to === 'geral@weddy.pt' && mails[0].replyTo === 'ana@example.com', 'destinatário fixo e Reply-To do visitante');
  ok(/^\[Site\] Suporte \| Ana Silva$/.test(mails[0].subject), 'assunto no formato original');
  ok(mails[0].text.startsWith('Nome: Ana Silva\nEmail: ana@example.com\nAssunto: Suporte\n\n'), 'corpo no formato original');
  mails = [];
  r = await post(uniq({ nome: 'A\r\nBcc: x@evil.com' }), xff('198.51.100.2'));
  ok(!/[\r\n]/.test(mails[0].subject), 'CR/LF removidos do assunto');
  mails = [];
  r = await post(uniq({ website: 'spam' }), xff('198.51.100.3'));
  ok(r.code === 200 && r.body.ok && !mails.length, 'honeypot → 200 sem enviar');
  r = await post(uniq({ email: 'mau' }), xff('198.51.100.3'));
  ok(r.code === 400 && r.body.ok === false, 'email inválido → 400');
  r = await post(uniq({ nome: '' }), xff('198.51.100.3'));
  ok(r.code === 400, 'nome vazio → 400');
  r = await post(uniq({ msg: '' }), xff('198.51.100.3'));
  ok(r.code === 400, 'mensagem vazia → 400');
  r = await post(uniq(), { method: 'GET' });
  ok(r.code === 405, 'GET → 405');
  mails = [];
  r = await post(uniq({ msg: 'x'.repeat(9000) }), xff('198.51.100.4'));
  ok(mails[0].text.length < 4300, 'mensagem truncada a 4000');
  // todos os assuntos do frontend aceites
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'contactos.html'), 'utf8');
  ok(/nome/.test(html) && /assunto/.test(html) && /website/.test(html), 'frontend envia nome/assunto/website');
  mails = [];
  for (const a of ['Pedido de informação', 'Weddy Premium', 'Parcerias e fornecedores', 'Suporte', 'Outro assunto']) {
    await clear(); mails = [];
    r = await post(uniq({ assunto: a }), xff('198.51.100.5'));
    ok(r.code === 200 && mails.length === 1, 'assunto do frontend aceite: ' + a);
  }

  // Limite por IP (8/h)
  await clear();
  let codes = [];
  for (let i = 0; i < 9; i++) codes.push((await post(uniq(), xff('203.0.113.9'))).code);
  ok(codes.slice(0, 8).every((c) => c === 200) && codes[8] === 429, 'IP: 8 passam, a 9.ª → 429');
  ok(mails.length === 8, 'IP: só 8 emails enviados');
  r = await post(uniq(), xff('203.0.113.10'));
  ok(r.code === 200, 'outro IP não é afetado');
  // IP: não confiar no início do X-Forwarded-For
  await clear();
  codes = [];
  for (let i = 0; i < 9; i++) codes.push((await post(uniq(), xff('1.1.1.' + i + ', 203.0.113.50'))).code);
  ok(codes[8] === 429, 'IP forjado à esquerda no XFF não contorna o limite');
  ok(T.contactClientIp({ headers: { 'x-forwarded-for': 'a, b, c' } }) === 'c', 'IP = último do X-Forwarded-For');
  ok(T.contactClientIp({ headers: {}, ip: '9.9.9.9' }) === '9.9.9.9', 'sem XFF → req.ip');
  // Limite global horário (30)
  await clear();
  codes = [];
  for (let i = 0; i < 31; i++) codes.push((await post(uniq(), xff('192.0.2.' + (i + 1)))).code);
  ok(codes.slice(0, 30).every((c) => c === 200) && codes[30] === 429, 'global: 30/h passam, a 31.ª → 429');
  // Duplicado
  await clear();
  const d = uniq();
  await post(d, xff('203.0.113.20'));
  r = await post(d, xff('203.0.113.21'));
  ok(r.code === 200 && r.body.ok && mails.length === 1, 'duplicado → {ok:true} sem 2.º email');
  // SMTP falha → devolve quota e permite repetir
  await clear();
  smtpFail = true;
  const f = uniq();
  r = await post(f, xff('203.0.113.30'));
  ok(r.code === 500 && r.body.ok === false, 'SMTP falha → 500');
  smtpFail = false;
  r = await post(f, xff('203.0.113.30'));
  ok(r.code === 200 && mails.length === 1, 'após falha SMTP, repetir funciona (quota devolvida)');
  const ipDoc = (await db.collection('siteRateLimits').get()).docs.filter((x) => x.id.startsWith('contact_ip_h_'))[0].data();
  ok(ipDoc.count === 1 && ipDoc.start && ipDoc.expireAt, 'contador 1 com start/expireAt; sem IP em claro');
  ok(!(await db.collection('siteRateLimits').get()).docs.some((x) => /203\.0\.113/.test(x.id)), 'IDs não contêm o IP');
  // Concorrência
  await clear();
  const rs = await Promise.all(Array.from({ length: 20 }, () => post(uniq(), xff('203.0.113.40'))));
  ok(rs.filter((x) => x.code === 200).length === 8 && rs.filter((x) => x.code === 429).length === 12, 'concorrência: 20 em paralelo → exatamente 8 passam');

  // Exports de produção preservados
  for (const e of ['sendContactMessage', 'analyzeCompareProposal', 'generateCompareReport', 'sendRsvpReminders', 'whatsappWebhook', 'classifyWeddyIntent', 'generateSeatingProposal']) {
    ok(typeof fns[e] === 'function', 'export presente: ' + e);
  }
  console.log(`\n${pass} OK, ${fail} FAIL`);
  server.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
