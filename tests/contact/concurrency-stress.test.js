/* sendContactMessage: concorrência repetida (investigação do teste intermitente).
 * Mede, em cada repetição, quantos passam / são limitados / foram "fail-open" (limite indisponível,
 * normalmente "too much contention" do emulador). NÃO enfraquece nenhum limite: só observa.
 * REPS (defeito 25) repetições por cenário; CPU_LOAD=1 acrescenta carga de CPU para imitar a suite completa. */
'use strict';
const path = require('path');
const http = require('http');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
const REPS = Number(process.env.REPS || 25);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>'; process.env.SMTP_HOST = 'smtp.test'; process.env.SMTP_PORT = '465'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
let mails = [], smtpFailFirst = 0, smtpCalls = 0;
nodemailer.createTransport = () => ({ sendMail: async (m) => { smtpCalls++; if (smtpFailFirst > 0) { smtpFailFirst--; throw new Error('smtp down'); } mails.push(m); } });
let failOpen = 0, releaseFail = 0;
const origWarn = console.warn;
console.warn = (...a) => { const s = String(a[0] || ''); if (s.includes('limite indisponível')) { failOpen++; lastErr = String(a[1] || ''); } else if (s.includes('release falhou')) releaseFail++; else origWarn(...a); };
let lastErr = '';
const origErr = console.error; console.error = (...a) => { if (String(a[0] || '').startsWith('sendContactMessage')) return; origErr(...a); };

let base, n = 0;
const uniq = () => ({ nome: 'Ana', email: 'ana@example.com', assunto: 'Suporte', msg: 'm ' + (++n) + ' ' + Math.random(), website: '' });
const post = async (body, ip) => { const r = await fetch(base, { method: 'POST', headers: { origin: 'https://www.weddy.pt', 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }); return r.status; };
async function clear() { const s = await db.collection('siteRateLimits').get(); await Promise.all(s.docs.map((d) => d.ref.delete())); mails = []; smtpFailFirst = 0; smtpCalls = 0; failOpen = 0; releaseFail = 0; }
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

(async () => {
  const express = require('express'); const app = express(); app.use(express.json()); app.all('/', fns.sendContactMessage);
  const server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
  let burners = [];
  if (process.env.CPU_LOAD) { const { fork } = require('child_process'); for (let i = 0; i < 3; i++) burners.push(require('child_process').spawn(process.execPath, ['-e', 'for(;;){}'])); }

  const scenarios = [
    { name: 'IP único, 20 em paralelo', run: async () => { const c = await Promise.all(Array.from({ length: 20 }, () => post(uniq(), '203.0.113.40'))); return { c, expectOk: 8 }; } },
    { name: 'IP único, 10 em paralelo', run: async () => { const c = await Promise.all(Array.from({ length: 10 }, () => post(uniq(), '203.0.113.41'))); return { c, expectOk: 8 }; } },
    { name: 'IP único, 40 em paralelo', run: async () => { const c = await Promise.all(Array.from({ length: 40 }, () => post(uniq(), '203.0.113.42'))); return { c, expectOk: 8 }; } },
    { name: 'IP único, 60 em paralelo', run: async () => { const c = await Promise.all(Array.from({ length: 60 }, () => post(uniq(), '203.0.113.43'))); return { c, expectOk: 8 }; } },
    { name: '40 IPs distintos misturados (limite global 30/h)', run: async () => { const ips = shuffle(Array.from({ length: 40 }, (_, i) => '192.0.2.' + (i + 1))); const c = await Promise.all(ips.map((ip) => post(uniq(), ip))); return { c, expectOk: 30 }; } },
    { name: '3 IPs × 6 pedidos entrelaçados (8/h por IP)', run: async () => { const ips = shuffle(['198.51.100.1', '198.51.100.2', '198.51.100.3'].flatMap((ip) => Array(6).fill(ip))); const c = await Promise.all(ips.map((ip) => post(uniq(), ip))); return { c, expectOk: 18 }; } },
    { name: 'mesma mensagem 12× em paralelo (duplicados → 1 envio)', run: async () => { const b = uniq(); const c = await Promise.all(Array.from({ length: 12 }, (_, i) => post(b, '203.0.113.' + (60 + i)))); return { c, expectOk: 12, expectMails: 1 }; } },
  ];
  for (const sc of scenarios) {
    let bad = 0, bypass = 0, dupMails = 0, totalFailOpen = 0, minOk = 1e9, maxOk = 0;
    for (let i = 0; i < REPS; i++) {
      await clear();
      const { c, expectOk, expectMails } = await sc.run();
      const okN = c.filter((x) => x === 200).length, lim = c.filter((x) => x === 429).length;
      minOk = Math.min(minOk, okN); maxOk = Math.max(maxOk, okN); totalFailOpen += failOpen;
      const want = expectMails != null ? expectMails : expectOk;
      if (mails.length > want) bypass++;                       // PROTEÇÃO CONTORNADA (mais envios do que o permitido)
      if (expectMails == null && okN !== expectOk) bad++;
      if (expectMails != null && mails.length !== want) bad++;
      const subjects = mails.map((m) => m.text); if (new Set(subjects).size !== subjects.length) dupMails++;
      if (c.some((x) => x !== 200 && x !== 429)) bad++;
    }
    ok(bypass === 0, `[${sc.name}] nunca passa mais do que o limite (${REPS} repetições)`);
    ok(dupMails === 0, `[${sc.name}] sem emails duplicados`);
    ok(bad === 0, `[${sc.name}] resultado exato em todas as repetições (ok entre ${minOk} e ${maxOk}; fail-open=${totalFailOpen}, desvios=${bad})`);
  }

  // SMTP falha em rajada: a quota volta; nada de contagem a mais nem a menos
  let badSmtp = 0;
  for (let i = 0; i < REPS; i++) {
    await clear(); smtpFailFirst = 5;
    const c1 = await Promise.all(Array.from({ length: 5 }, () => post(uniq(), '203.0.113.90')));
    const docs = (await db.collection('siteRateLimits').get()).docs.filter((d) => d.id.startsWith('contact_ip_h_')).map((d) => d.data().count);
    if (!c1.every((x) => x === 500) || docs.some((x) => x !== 0)) badSmtp++;
    const c2 = await Promise.all(Array.from({ length: 12 }, () => post(uniq(), '203.0.113.90')));
    if (c2.filter((x) => x === 200).length !== 8 || mails.length !== 8) badSmtp++;
  }
  ok(badSmtp === 0, `falhas SMTP em rajada devolvem a quota exatamente (${REPS} repetições; desvios=${badSmtp})`);

  burners.forEach((b) => b.kill());
  console.log(`\n${pass} OK, ${fail} FAIL`);
  server.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
