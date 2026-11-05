/* Pré-produção — lembretes de RSVP por email: o link e os nomes nunca entram em bruto no HTML (injeção de HTML/links).
 * Teste unitário puro sobre reminderEmailHtml; o envio real (SMTP) não é exercido. */
'use strict';
const path = require('path');
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
const T = require(path.join(__dirname, '..', '..', 'index.js'))._test;
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const evil = 'x"><a href="https://evil.example/p">clica</a><script>alert(1)</script>';
const base = { guestName: 'Ana', coupleName1: 'A', coupleName2: 'B', deadline: '2026-12-01', daysLeft: 3 };
let html = T.reminderEmailHtml({ ...base, link: 'https://www.weddy.pt/rsvp.html?g=' + evil });
ok(!/<a href="https:\/\/evil/.test(html) && !html.includes('<script>') && !html.includes('"><a'), 'link com HTML malicioso: escapado, sem tag nem atributo injetados');
html = T.reminderEmailHtml({ ...base, link: 'https://www.weddy.pt/rsvp.html?g=' + encodeURIComponent(evil) });
ok(!/[<>]/.test(html.match(/href="([^"]*)"/)[1]) && html.match(/href="([^"]*)"/)[1].startsWith('https://www.weddy.pt/rsvp.html?g=x%22%3E'), 'ID codificado: o href só contém caracteres seguros');
html = T.reminderEmailHtml({ ...base, link: 'https://www.weddy.pt/rsvp.html?g=r0123456789abcdef0123456789abcdef' });
ok(html.includes('href="https://www.weddy.pt/rsvp.html?g=r0123456789abcdef0123456789abcdef"'), 'ID normal: link inalterado');
const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
ok(src.includes("'?g=' + encodeURIComponent(String(job.docId))"), '(estático) o envio codifica o ID do documento ao construir o link');
console.log(fail ? `\n${fail} falhas` : '\nOK'); process.exit(fail ? 1 : 0);
