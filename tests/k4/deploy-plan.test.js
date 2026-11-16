/* Pré-produção — o plano de deploy é consistente com index.js e só usa comandos EXPLÍCITOS (nome a nome). Pura análise local:
 * sem Firebase CLI, sem rede, sem credenciais. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'); const P = require(path.join(ROOT, 'scripts', 'deploy-preflight.js'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-plan.json'), 'utf8'));
let r = P.check(plan);
ok(r.errors.length === 0, 'plano consistente com index.js (cada função num lote ou justificada)' + (r.errors.length ? ': ' + r.errors.join('; ') : ''));
ok(r.local.length === 53, `index.js exporta 53 funções (${r.local.length})`); // 45 + 4 de publicação de convites + 4 de envio/distribuição
if (r.prod) ok(r.prod.every((f) => r.local.includes(f)), 'nenhuma função de produção (recuperada) desaparece do código local → o deploy não pede para apagar nenhuma');
// deteção de erros: nome inexistente, função esquecida, par separado
const clone = () => JSON.parse(JSON.stringify(plan));
let bad = clone(); bad.batches[0].functions.push('funcaoQueNaoExiste'); ok(P.check(bad).errors.some((e) => /inexistente/.test(e)), 'deteta nome de função inexistente');
bad = clone(); bad.batches[3].functions = bad.batches[3].functions.filter((f) => f !== 'stripeWebhook'); ok(P.check(bad).errors.some((e) => /sem lote/.test(e)), 'deteta função exportada esquecida');
bad = clone(); bad.batches[1].functions = bad.batches[1].functions.filter((f) => f !== 'googleCalendarFinalizeOAuth'); bad.batches[0].functions.push('googleCalendarFinalizeOAuth'); ok(P.check(bad).errors.some((e) => /juntas/.test(e)), 'deteta googleCalendarOAuthCallback e googleCalendarFinalizeOAuth em lotes diferentes');
bad = clone(); bad.batches[0].functions.push('stripeWebhook'); ok(P.check(bad).errors.some((e) => /dois lotes/.test(e)), 'deteta função em dois lotes');
// comandos gerados
const cmds = [...P.commands(plan, plan.projects.production), ...P.commands(plan, plan.projects.staging)];
ok(cmds.every((c) => /^firebase deploy --only functions:[A-Za-z0-9_]+(,functions:[A-Za-z0-9_]+)* --project (weddy-app-bd12f|weddy-premium-teste)$/.test(c)), 'todos os comandos são explícitos (functions:<nome>,…) e com --project');
ok(!cmds.some((c) => /--force|firebase functions:delete/.test(c)) && !cmds.some((c) => /validateWeddingStateOnWrite/.test(c)), 'sem --force, sem apagar funções e sem a função excluída');
// documento do plano: nenhum comando genérico
const doc = path.join(ROOT, 'docs', 'seguranca', 'fase-k4', 'PLANO-DEPLOY-EXPLICITO.md');
if (fs.existsSync(doc)) {
  const lines = fs.readFileSync(doc, 'utf8').split('\n').filter((l) => /firebase deploy/.test(l) && !/^\s*(\||>|-\s+\*\*Nunca|\*\*Nunca)/.test(l) && !/nunca|NUNCA|proibido|PROIBIDO|não/i.test(l));
  const generic = lines.filter((l) => !/--only functions:[A-Za-z]/.test(l) && !/--only (firestore|storage)/.test(l));
  ok(generic.length === 0, 'o documento do plano não contém "firebase deploy" genérico' + (generic.length ? ': ' + generic[0].trim().slice(0, 80) : ''));
}
console.log(fail ? `\n${fail} falhas` : '\nOK'); process.exit(fail ? 1 : 0);
