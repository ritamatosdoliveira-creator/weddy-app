/* Verifica, em modo local (sem rede, sem deploy), o pacote que o Firebase CLI enviaria
 * para as Functions: usa o MESMO código de empacotamento do firebase-tools
 * (prepareFunctionsUpload) sobre uma cópia temporária do repositório à qual se
 * acrescentam ficheiros "isco" com falsos segredos. Também confere a configuração
 * do OPENAI_API_KEY (Secret Manager) por análise estática de index.js. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const REPO = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'firebase.json'), 'utf8'));
  const fcfg = cfg.functions[0];
  ok(fcfg.source === '.' && !cfg.hosting, 'firebase.json: functions a partir da raiz; sem hosting (o site é GitHub Pages)');
  const rc = JSON.parse(fs.readFileSync(path.join(REPO, '.firebaserc'), 'utf8'));
  ok(!rc.projects.default && !rc.targets, '.firebaserc: sem projeto "default" (obriga a escolher --project, evita deploy no sítio errado)');
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  ok(pkg.main === 'index.js' && pkg.engines.node === '22' && pkg.dependencies.stripe && pkg.dependencies.nodemailer && pkg.dependencies['firebase-admin'] && pkg.dependencies['firebase-functions'], 'package.json: main, Node 22 e dependências usadas por index.js');

  // cópia temporária: ficheiros versionados + iscos
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weddy-pack-'));
  const tracked = cp.execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const untrackedWanted = ['firebase.json', 'package.json', '.firebaserc', 'index.js'];
  for (const f of new Set(tracked.concat(untrackedWanted))) {
    if (!fs.existsSync(path.join(REPO, f))) continue;
    const dst = path.join(tmp, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(REPO, f), dst);
  }
  const FAKE = 'sk' + '-FAKE-DECOY-NOT-A-REAL-KEY-0000'; // partido para a própria verificação não o apanhar
  const decoys = ['.env', '.env.weddy-app-bd12f', '.env.weddy-premium-teste', '.env.local', 'index.js.bak', 'index.js.antes-comparador', 'index.js.20261030.bak', 'dar-premium.js',
    'quem-comprou-premium-apple.js', 'uso-premium-casamento.js', 'serviceAccountKey.json', 'weddy-credentials.json', 'chave.pem', 'AuthKey_X.p8', 'backup/dados.json', 'backups/x.txt',
    'dump.sql', 'functions-backup.zip', '.DS_Store', 'notas.tmp', 'firebase-debug.log', 'scripts/extra-admin.js', 'tests/x.test.js', 'pasta/.env', 'pasta/sub/index.js.bak'];
  for (const d of decoys) { const p = path.join(tmp, d); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `OPENAI_API_KEY=${FAKE}\n`); }

  const { prepareFunctionsUpload } = require('firebase-tools/lib/deploy/functions/prepareFunctionsUpload');
  const log = console.log; console.log = () => {}; // o CLI imprime "packaged ..."
  const r = await prepareFunctionsUpload(tmp, { source: '.', ignore: fcfg.ignore.slice() });
  console.log = log;
  const entries = cp.execSync(`unzip -Z1 "${r.pathToSource}"`, { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  console.log('     conteúdo do pacote: ' + entries.join(', '));
  ok(entries.join() === 'index.js,package.json', 'pacote contém EXATAMENTE index.js e package.json');
  ok(!entries.some((e) => /(^|\/)\.env/.test(e)), 'nenhum ficheiro .env* no pacote');
  ok(!entries.some((e) => /\.bak$|\.antes-|backup|\.zip$|\.sql$|\.pem$|\.p8$|credentials|serviceAccount/i.test(e)), 'nenhum backup, credencial ou chave no pacote');
  ok(!entries.some((e) => /dar-premium|quem-comprou|uso-premium|^scripts\//.test(e)), 'nenhum script administrativo no pacote');
  // conteúdo: procura padrões de segredo em TODOS os ficheiros do pacote
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'weddy-unz-')); cp.execSync(`unzip -q "${r.pathToSource}" -d "${dir}"`);
  const blob = entries.map((e) => fs.readFileSync(path.join(dir, e), 'utf8')).join('\n');
  const patterns = [[/sk-[A-Za-z0-9_-]{16,}/, 'chave estilo OpenAI (sk-…)'], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada PEM'], [/AIza[0-9A-Za-z_-]{35}/, 'chave de API Google'], [/\b(sk|rk|pk)_live_[0-9A-Za-z]{10,}/, 'chave Stripe live'], [/whsec_[0-9A-Za-z]{10,}/, 'segredo de webhook Stripe'], [/DECOY/, 'isco de teste']];
  for (const [re, name] of patterns) ok(!re.test(blob), 'pacote sem ' + name);
  ok(!/^\s*OPENAI_API_KEY=\S+/m.test(blob), 'pacote sem atribuição OPENAI_API_KEY=<valor>');
  // o próprio pacote do repositório real: sem iscos, nada de segredos em ficheiros versionados
  const tr = tracked.filter((f) => !/^(tests\/node_modules|fonts\/|inicio\/.*\.(jpg|mp4))/.test(f) && /\.(js|json|html|md|rules|txt|diff|producao.*)$/.test(f) || /producao/.test(f));
  let leaks = [];
  for (const f of tr) { let s; try { s = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { continue; } for (const [re, name] of patterns.filter((x) => !/Google/.test(x[1])).slice(0, 4)) if (re.test(s)) leaks.push(f + ' (' + name + ')'); }
  ok(leaks.length === 0, 'ficheiros versionados sem padrões de segredo' + (leaks.length ? ': ' + leaks.join('; ') : ''));
  fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); try { fs.unlinkSync(r.pathToSource); } catch (e) { /* */ }

  // ---- OPENAI_API_KEY via Secret Manager (análise estática) ----
  const src = fs.readFileSync(path.join(REPO, 'index.js'), 'utf8');
  ok(/const OPENAI_API_KEY = defineSecret\('OPENAI_API_KEY'\);/.test(src), 'OPENAI_API_KEY é defineSecret');
  ok(!/defineString\(\s*'OPENAI_API_KEY'/.test(src) && !/process\.env\.OPENAI_API_KEY/.test(src), 'sem defineString nem process.env para a chave (nada de variável local em produção)');
  ok(!/OPENAI_API_KEY\s*=\s*['"`]?sk-/.test(src), 'sem valor da chave no código');
  // Mini-analisador: devolve o fim do bloco que abre em src[open] ('(' ou '{'), ignorando strings, comentários, templates e regex.
  function blockEnd(s, open) {
    const pairs = { '(': ')', '{': '}', '[': ']' }; const stack = []; let prev = '';
    for (let i = open; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (c === '/' && n === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
      if (c === '/' && n === '*') { i = s.indexOf('*/', i) + 1; continue; }
      if (c === '\'' || c === '"') { for (i++; s[i] !== c; i++) if (s[i] === '\\') i++; prev = 'x'; continue; }
      if (c === '`') { for (i++; s[i] !== '`'; i++) { if (s[i] === '\\') i++; else if (s[i] === '$' && s[i + 1] === '{') { i = blockEnd(s, i + 1); } } prev = 'x'; continue; }
      if (c === '/' && /[(,=:\[!&|?{};]|^$/.test(prev)) { for (i++; s[i] !== '/'; i++) { if (s[i] === '\\') i++; else if (s[i] === '[') { for (i++; s[i] !== ']'; i++) if (s[i] === '\\') i++; } } prev = 'x'; continue; }
      if (pairs[c]) stack.push(pairs[c]);
      else if (c === ')' || c === '}' || c === ']') { stack.pop(); if (!stack.length) return i; }
      if (!/\s/.test(c)) prev = c;
    }
    return s.length;
  }
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const blocks = [];
  let mm; const reF = /^(?:async )?function ([A-Za-z0-9_]+)\(/gm;
  while ((mm = reF.exec(src))) { const o = src.indexOf('{', src.indexOf(')', mm.index)); blocks.push({ kind: 'fn', name: mm[1], body: strip(src.slice(mm.index, blockEnd(src, o) + 1)) }); }
  const reE = /^exports\.([A-Za-z0-9_]+)\s*=\s*on[A-Za-z]+\(/gm;
  while ((mm = reE.exec(src))) { const o = src.indexOf('(', mm.index + 8); blocks.push({ kind: 'export', name: mm[1], head: src.slice(mm.index, mm.index + 400), body: strip(src.slice(mm.index, blockEnd(src, o) + 1)) }); }
  const fnsB = blocks.filter((x) => x.kind === 'fn'), expB = blocks.filter((x) => x.kind === 'export');
  const users = new Set(fnsB.filter((f) => /OPENAI_API_KEY\.value\(\)/.test(f.body)).map((f) => f.name));
  for (let k = 0; k < 8; k++) for (const f of fnsB) if (!users.has(f.name) && [...users].some((u) => new RegExp('\\b' + u + '\\(').test(f.body))) users.add(f.name);
  const needing = expB.filter((s) => /OPENAI_API_KEY\.value\(\)/.test(s.body) || [...users].some((u) => new RegExp('\\b' + u + '\\(').test(s.body))).map((s) => s.name).sort();
  const declared = expB.filter((s) => /secrets:\s*\[[^\]]*OPENAI_API_KEY/.test(s.head)).map((s) => s.name).sort();
  console.log('     funções que usam a chave: ' + needing.join(', '));
  ok(needing.join() === 'analyzeCompareProposal,classifyWeddyIntent,generateCompareReport,generateSeatingProposal', 'as 4 funções esperadas (e só elas) usam a chave');
  ok(declared.join() === needing.join(), 'todas as funções que usam a chave declaram secrets:[OPENAI_API_KEY], e mais nenhuma');
  // confirmação em tempo de execução: o que o Firebase vai ler (endpoint) em cada função publicada
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-weddy';
  const fns = require(path.join(REPO, 'index.js'));
  const rt = Object.keys(fns).filter((k) => fns[k] && fns[k].__endpoint && (fns[k].__endpoint.secretEnvironmentVariables || []).some((s) => s.key === 'OPENAI_API_KEY')).sort();
  ok(rt.join() === needing.join(), 'em execução, o endpoint de cada uma das 4 pede o segredo OPENAI_API_KEY (e as outras não)');
  const exported = Object.keys(fns).filter((k) => fns[k] && fns[k].__endpoint).length;
  ok(exported === expB.length, 'todas as ' + expB.length + ' funções exportadas foram analisadas (' + exported + ' no total)');

  console.log(`\n${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
