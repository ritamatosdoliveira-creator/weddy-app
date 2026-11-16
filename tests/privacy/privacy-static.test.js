/* Fase J (RGPD) — verificações estáticas de privacidade (sem emulador, sem rede). Falham se alguém reintroduzir
 * pedidos a terceiros não declarados, analítica, cookies, ou chamadas à OpenAI que guardem conteúdo. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const htmls = fs.readdirSync(root).filter((f) => f.endsWith('.html')).concat(['app/index.html']);

// 1. Sem Google Fonts (enviava o IP dos visitantes à Google) — tipos de letra alojados em /fonts.
for (const f of htmls) { const t = read(f); ok(!/fonts\.(googleapis|gstatic)\.com/.test(t), `${f}: sem pedidos ao Google Fonts`); }
for (const f of ['cormorant-garamond.woff', 'cormorant-garamond-italic.woff', 'manrope.woff']) ok(fs.existsSync(path.join(root, 'fonts', f)), `fonts/${f} existe`);

// 2. Sem analítica / pixéis / cookies próprios.
const BAD = /google-analytics|googletagmanager|gtag\(|fbq\(|connect\.facebook\.net|hotjar|clarity\.ms|mixpanel|segment\.com|plausible|matomo|doubleclick|firebase-analytics|getAnalytics/i;
for (const f of htmls) ok(!BAD.test(read(f)), `${f}: sem analítica/pixéis`);
for (const f of htmls) ok(!/document\.cookie\s*=/.test(read(f)), `${f}: não escreve cookies próprios`);
ok(!BAD.test(read('index.js')), 'index.js: sem analítica');

// 3. Origens externas de scripts: só as declaradas (CDNs técnicos + EmailJS), nunca desconhecidas.
const ALLOWED = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'www.gstatic.com', 'apis.google.com', 'www.googleapis.com', 'js.stripe.com', 'appleid.cdn-apple.com'];
for (const f of htmls) {
  const hosts = [...read(f).matchAll(/<script[^>]+src=["']https?:\/\/([^\/"']+)/g)].map((m) => m[1]);
  ok(hosts.every((h) => ALLOWED.includes(h)), `${f}: scripts externos só de origens declaradas (${[...new Set(hosts)].join(', ') || 'nenhum'})`);
}

// 4. OpenAI: nenhuma chamada sem store:false (o conteúdo não fica retido na plataforma).
const idx = read('index.js');
const calls = [...idx.matchAll(/https:\/\/api\.openai\.com\/v1\/responses/g)].length;
ok(calls >= 1, `existem ${calls} chamadas à OpenAI inventariadas`);
const bodies = idx.split(/\n(?=(?:async )?function |const \w+ = (?:async )?\()/).filter((b) => /api\.openai\.com/.test(b) || /model: *OPENAI_MODEL/.test(b));
ok(/store: *false/.test(idx), 'index.js declara store:false para a OpenAI');
const noStore = [...idx.matchAll(/model: *OPENAI_MODEL,\s*\n\s*(?:store|input)/g)].filter((m) => !/store: *false/.test(idx.slice(m.index - 300, m.index + 500)));
ok(noStore.length === 0, 'todos os pedidos à OpenAI com model: OPENAI_MODEL têm store:false (' + noStore.length + ' sem)');

// 5. Corpo de erro da OpenAI nunca vai para logs.
ok(!/OpenAI respondeu \$\{[^}]*\}\s*[:\-]\s*\$\{/.test(idx), 'erros da OpenAI só com código HTTP');

// 6. Regras: _incident_log só criação (sem leitura pelo cliente); coleções sensíveis só servidor.
const rules = read('firestore.rules');
const blk = (name) => { const m = rules.match(new RegExp('match /' + name + '/\\{[^}]*\\} \\{([\\s\\S]*?)\\n    \\}')); return m ? m[1] : ''; };
ok(!/allow (read|get|list|update|delete)/.test(blk('_incident_log')), '_incident_log: cliente só cria');
for (const c of ['weddingStateQuarantine', 'notifState', 'rsvpReminderSends']) ok(/allow read, write: if false/.test(blk(c)), `${c}: só servidor`);

// 7. Política de privacidade: declara os prestadores usados no código.
const pol = read('privacidade.html') + read('app/index.html');
for (const k of ['Firebase', 'Stripe', 'OpenAI', 'EmailJS', 'RevenueCat']) ok(pol.includes(k), `política menciona ${k}`);

// 8. Dados de teste fictícios: sem emails reais da Rita em testes.
function walk(d, out) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '__pycache__') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; }
const tf = walk(path.join(root, 'tests'), []).filter((f) => /\.(js|mjs|py)$/.test(f));
ok(tf.every((f) => !/ritamatosoliveira|926 ?378 ?303/.test(fs.readFileSync(f, 'utf8')) || /privacy-static/.test(f)), 'testes sem dados pessoais reais');
console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
