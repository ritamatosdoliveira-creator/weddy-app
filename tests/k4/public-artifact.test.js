/* Pré-produção — o artefacto PÚBLICO (GitHub Pages) só contém a allowlist e nada privado.
 * Uso na CI: node tests/k4/public-artifact.test.js <pasta-do-artefacto>  (sem argumento: constrói numa pasta temporária).
 * Falha se: um ficheiro privado/interno entrar no artefacto; um ficheiro novo da raiz do repositório não estiver classificado
 * (público ou privado); uma página pública referir um ficheiro local que não está no artefacto; houver padrões de segredo. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'); const B = require(path.join(ROOT, 'scripts', 'build-public.js'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'weddy-public-'));
if (!process.argv[2]) B.build(out);
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]);
const built = walk(out); const pub = new Set(B.listPublic());
ok(built.length === pub.size && built.every((f) => pub.has(f)), `o artefacto tem exatamente os ${pub.size} ficheiros da allowlist`);
const FORBIDDEN = [/^docs\//, /^tests\//, /^scripts\//, /^recuperado-producao\//, /^\.git(\/|$)/, /^\.github\//, /node_modules\//, /^index\.js$/, /\.rules$/, /^package(-lock)?\.json$/, /^firebase\.json$/, /^\.firebaserc$/, /^README\.md$/, /^RECUPERACAO\.md$/, /\.md$/, /\.env/, /\.(log|diff|bak|orig|zip|sql|pem|key|p8|p12)$/, /serviceAccount/i, /credentials/i, /dar-premium|quem-comprou|uso-premium/];
const leaked = built.filter((f) => FORBIDDEN.some((re) => re.test(f)));
ok(leaked.length === 0, 'nenhum ficheiro privado/interno no artefacto' + (leaked.length ? ': ' + leaked.join(', ') : ''));
// Classificação obrigatória dos ficheiros da raiz (só quando o repositório git está disponível)
const PRIVATE_ROOT = new Set(['.git', '.github', '.gitignore', '.firebaserc', 'docs', 'tests', 'scripts', 'recuperado-producao', 'node_modules', '_site', 'index.js', 'package.json', 'package-lock.json', 'firebase.json', 'firestore.rules', 'storage.rules', 'README.md', 'RECUPERACAO.md']);
const PUBLIC_ROOT = new Set([...B.ROOT_FILES.map((f) => f.split('/')[0]), ...Object.keys(B.ROOT_DIRS)]);
let unclassified = [];
try { unclassified = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).map((f) => f.split('/')[0]).filter((t, i, a) => a.indexOf(t) === i).filter((t) => !PRIVATE_ROOT.has(t) && !PUBLIC_ROOT.has(t)); } catch (e) { console.log('(git indisponível: classificação da raiz não verificada)'); }
ok(unclassified.length === 0, 'todo o ficheiro/pasta novo na raiz do repositório está classificado como público ou privado' + (unclassified.length ? ': ' + unclassified.join(', ') : ''));
// Referências locais das páginas públicas existem no artefacto
const missingRefs = [];
for (const f of built.filter((x) => /\.html$/.test(x))) {
  const txt = fs.readFileSync(path.join(out, f), 'utf8'); const dir = path.posix.dirname(f);
  for (const m of txt.matchAll(/(?:href|src)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
    const u = m[1]; if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/|blob:|\{|\$)/.test(u) || u === '' || /[{}$<>+\s]/.test(u) || !/[./]/.test(u)) continue; // ignora fragmentos de JS (ex.: href="'+url+'")
    const target = u.startsWith('/') ? u.slice(1) : path.posix.normalize(path.posix.join(dir, u));
    if (target === '' || target.endsWith('/')) continue;
    if (!pub.has(target) && !fs.existsSync(path.join(out, target))) missingRefs.push(`${f} → ${u}`);
  }
}
const KNOWN_DYNAMIC = [/^404\.html → \/?c\//];
const realMissing = missingRefs.filter((r) => !KNOWN_DYNAMIC.some((re) => re.test(r)));
ok(realMissing.length === 0, 'páginas públicas só referem ficheiros presentes no artefacto' + (realMissing.length ? ': ' + realMissing.slice(0, 10).join('; ') : ''));
// Segredos
const SECRET = [/sk_live_[A-Za-z0-9]{10,}/, /whsec_[A-Za-z0-9]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /rk_live_[A-Za-z0-9]{10,}/, /ghp_[A-Za-z0-9]{20,}/];
const hits = built.filter((f) => /\.(html|js|json|txt)$/.test(f)).filter((f) => { const t = fs.readFileSync(path.join(out, f), 'utf8'); return SECRET.some((re) => re.test(t)); });
ok(hits.length === 0, 'sem padrões de segredos no artefacto' + (hits.length ? ': ' + hits.join(', ') : ''));
ok(built.includes('CNAME') && built.includes('.nojekyll') && built.includes('index.html') && built.includes('app/index.html'), 'CNAME, .nojekyll, página inicial e app presentes');
console.log(fail ? `\n${fail} falhas` : '\nOK'); if (!process.argv[2]) fs.rmSync(out, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
