#!/usr/bin/env node
/* Pré-verificação LOCAL do plano de deploy (sem rede, sem Firebase CLI, sem credenciais). Falha se:
 *  - uma função exportada por index.js não estiver atribuída a um lote nem justificada em "excluded";
 *  - um lote referir uma função que não existe (erro de nome → o deploy tentaria apagar/ignorar);
 *  - uma função estiver em dois lotes; ou funções que têm de ir juntas estiverem em lotes diferentes.
 * Imprime os comandos EXPLÍCITOS (nome a nome) por ambiente. NUNCA os executa. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function exportsOf(file) { return [...fs.readFileSync(file, 'utf8').matchAll(/^exports\.([A-Za-z0-9_]+)\s*=/gm)].map((m) => m[1]).sort(); }
function check(plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy-plan.json'), 'utf8'))) {
  const errors = []; const local = exportsOf(path.join(ROOT, 'index.js'));
  const prodFile = path.join(ROOT, 'recuperado-producao', 'index.js.producao-2026-10-30');
  const prod = fs.existsSync(prodFile) ? exportsOf(prodFile) : null;
  const seen = new Map();
  for (const b of plan.batches) for (const f of b.functions) {
    if (!local.includes(f)) errors.push(`lote ${b.id}: função inexistente em index.js: ${f}`);
    if (seen.has(f)) errors.push(`função em dois lotes: ${f} (${seen.get(f)} e ${b.id})`); seen.set(f, b.id);
  }
  for (const f of local) if (!seen.has(f) && !(plan.excluded || {})[f]) errors.push(`função exportada sem lote nem justificação: ${f}`);
  for (const f of Object.keys(plan.excluded || {})) if (!local.includes(f)) errors.push(`"excluded" refere função inexistente: ${f}`);
  for (const b of plan.batches) for (const grp of b.together || []) { const ids = grp.map((f) => seen.get(f)); if (new Set(ids).size > 1) errors.push(`funções que têm de ir juntas estão em lotes diferentes: ${grp.join(' + ')}`); }
  const missingFromProd = prod ? prod.filter((f) => !local.includes(f)) : [];
  if (missingFromProd.length) errors.push('funções de produção que deixam de existir no código local (o deploy pediria para as apagar): ' + missingFromProd.join(', '));
  return { errors, local, prod, seen };
}
function commands(plan, project) {
  return plan.batches.map((b) => `firebase deploy --only ${b.functions.map((f) => 'functions:' + f).join(',')} --project ${project}`);
}
module.exports = { check, commands, exportsOf };
if (require.main === module) {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy-plan.json'), 'utf8')); const r = check(plan);
  if (r.errors.length) { console.error('PLANO INVÁLIDO:\n - ' + r.errors.join('\n - ')); process.exit(1); }
  const novas = r.prod ? r.local.filter((f) => !r.prod.includes(f)) : [];
  console.log(`index.js exporta ${r.local.length} funções; ${r.prod ? r.prod.length + ' existem em produção (recuperado), ' + novas.length + ' novas' : 'produção recuperada indisponível'}; ${Object.keys(plan.excluded).length} excluída(s) deliberadamente.`);
  for (const env of ['staging', 'production']) { console.log(`\n# ${env} (${plan.projects[env]}) — NÃO executado por este script`); commands(plan, plan.projects[env]).forEach((c, i) => console.log(`# lote ${plan.batches[i].id}\n${c}`)); }
}
