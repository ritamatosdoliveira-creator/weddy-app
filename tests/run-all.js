#!/usr/bin/env node
/* Runner único das suites da Weddy. Tudo local: emuladores Firebase (projeto demo-weddy) e Chromium.
 * Nunca toca em produção. Uso (a partir de tests/):
 *   npm install && npx playwright install chromium   (uma vez; python: pip install playwright)
 *   npm test                         # todas as suites
 *   node run-all.js --list           # lista as suites
 *   node run-all.js --only unit,ui   # grupos ou ids (separados por vírgula)
 * Relatório: tests/reports/last-run.md e last-run.json (+ um .log por suite).
 * Código de saída: 0 = tudo passou; 1 = alguma suite falhou.
 */
'use strict';
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const NM = path.join(ROOT, 'node_modules');
const REPORTS = path.join(ROOT, 'reports');

const py = (f) => ['python3', path.join('ui', f)];
const SUITES = [
  { id: 'i18n-parity', group: 'unit', name: 'Paridade PT/EN (app + rsvp)', cmd: ['node', 'unit/i18n-parity.test.js'] },
  { id: 'validate-state', group: 'validate', name: 'Validação servidor do estado JSON', cmd: ['node', 'validate/state-validation.test.js'], emu: true },
  { id: 'consent', group: 'consent', name: 'Consentimento WhatsApp (functions)', cmd: ['node', 'consent/whatsapp-consent.test.js'], emu: true },
  { id: 'stop', group: 'consent', name: 'WhatsApp STOP: revogação robusta', cmd: ['node', 'consent/stop-revocation.test.js'], emu: true },
  { id: 'rsvp-reminders', group: 'rsvp', name: 'Lembretes RSVP: legado, Autopilot, idempotência', cmd: ['node', 'rsvp/reminders.test.js'], emu: true },
  { id: 'migrate', group: 'migrate', name: 'Migração de consentimentos', cmd: ['node', 'consent/migrate-consents.test.js'], emu: true },
  { id: 'packaging', group: 'packaging', name: 'Pacote de deploy sem segredos + OPENAI_API_KEY', cmd: ['node', 'packaging/package-contents.test.js'], emu: false },
  { id: 'compare', group: 'compare', name: 'Comparador (Premium)', cmd: ['node', 'compare/compare.test.js'], emu: true },
  { id: 'contact', group: 'contact', name: 'Formulário de contacto', cmd: ['node', 'contact/send-contact.test.js'], emu: true },
  { id: 'contact-stress', group: 'contact', name: 'Formulário de contacto: concorrência repetida', cmd: ['node', 'contact/concurrency-stress.test.js'], emu: true },
  { id: 'notify', group: 'notify', name: 'Email resumo (functions)', cmd: ['node', 'notify/email-digest.test.js'], emu: true },
  { id: 'backfill', group: 'backfill', name: 'Backfill premiumUntil', cmd: ['node', 'backfill/backfill-premium-until.test.js'], emu: true },
  { id: 'rules-premium', group: 'rules', name: 'Regras Firestore+Storage (Premium)', cmd: ['node', 'rules/premium-rules.test.mjs'], emu: true },
  { id: 'rules-state', group: 'rules', name: 'Regras do estado JSON + quarentena', cmd: ['node', 'rules/state-rules.test.mjs'], emu: true },
  { id: 'rules-consent', group: 'rules', name: 'Regras de consentimento', cmd: ['node', 'rules/consent-rules.test.mjs'], emu: true },
  { id: 'rules-logistics', group: 'rules', name: 'Regras da logística do convidado', cmd: ['node', 'rules/logistics-rules.test.mjs'], emu: true },
  { id: 'ui-notif-core', group: 'ui', name: 'UI notificações (núcleo)', cmd: py('notif_core.py') },
  { id: 'ui-notif-center', group: 'ui', name: 'UI centro de notificações', cmd: py('notif_center.py') },
  { id: 'ui-notif-email', group: 'ui', name: 'UI preferências do email resumo', cmd: py('notif_email_prefs.py') },
  { id: 'ui-wa-sheet', group: 'ui', name: 'UI ficha do convidado (WhatsApp)', cmd: py('whatsapp_guest_sheet.py') },
  { id: 'ui-wa-rsvp', group: 'ui', name: 'UI RSVP + consentimento', cmd: py('whatsapp_rsvp.py') },
  { id: 'ui-robust-state', group: 'ui', name: 'UI robustez: estados corrompidos', cmd: py('robustness_state.py') },
  { id: 'ui-robust-paths', group: 'ui', name: 'UI robustez: todos os caminhos', cmd: py('robustness_paths.py') },
  { id: 'ui-autopilot', group: 'ui', name: 'UI RSVP Autopilot (B.1)', cmd: py('rsvp_autopilot.py') },
  { id: 'ui-premium-lapsed', group: 'ui', name: 'UI Premium terminado: conteúdo antigo visível', cmd: py('premium_lapsed.py') },
  { id: 'ui-logistics-rsvp', group: 'ui', name: 'UI RSVP com logística (B.2)', cmd: py('logistics_rsvp.py') },
  { id: 'ui-state-shape', group: 'ui', name: 'Paridade cliente/servidor do estado', cmd: py('state_shape.py') },
  { id: 'ui-i18n-en', group: 'ui', name: 'UI inglês: sem texto PT (desktop+mobile)', cmd: py('i18n_en.py') },
];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

if (flag('--list')) { SUITES.forEach((s) => console.log(`${s.id.padEnd(18)} [${s.group}] ${s.name}${s.emu ? ' (emulador)' : ''}`)); process.exit(0); }

const only = val('--only') ? val('--only').split(',').map((x) => x.trim()).filter(Boolean) : null;
const selected = SUITES.filter((s) => !only || only.includes(s.id) || only.includes(s.group));
if (!selected.length) { console.error('Nenhuma suite corresponde a --only. Use --list.'); process.exit(2); }

const needsEmu = selected.some((s) => s.emu);
if (needsEmu && !process.env.FIRESTORE_EMULATOR_HOST && !flag('--inner')) {
  // Arranca os emuladores e volta a chamar-se a si próprio dentro deles.
  const bin = path.join(NM, '.bin', process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
  if (!fs.existsSync(bin)) { console.error('Falta "npm install" em tests/ (firebase-tools).'); process.exit(2); }
  // O CLI exige as regras dentro da pasta do projeto: usa uma cópia fresca em tests/.build/emulator/.
  const proj = path.join(ROOT, '.build', 'emulator');
  fs.mkdirSync(proj, { recursive: true });
  fs.copyFileSync(path.join(ROOT, '..', 'firestore.rules'), path.join(proj, 'firestore.rules'));
  fs.copyFileSync(path.join(ROOT, '..', 'storage.rules'), path.join(proj, 'storage.rules'));
  fs.writeFileSync(path.join(proj, 'firebase.json'), JSON.stringify({
    firestore: { rules: 'firestore.rules' }, storage: { rules: 'storage.rules' },
    emulators: { firestore: { host: '127.0.0.1', port: 8085 }, storage: { host: '127.0.0.1', port: 9195 }, ui: { enabled: false }, singleProjectMode: true },
  }, null, 2));
  const inner = `node ${JSON.stringify(path.join(ROOT, 'run-all.js'))} --inner ${only ? '--only ' + only.join(',') : ''}`;
  const r = spawnSync(bin, ['emulators:exec', '--only', 'firestore,storage', '--project', 'demo-weddy', inner], { cwd: proj, stdio: 'inherit', env: process.env });
  process.exit(r.status === null ? 1 : r.status);
}

fs.mkdirSync(REPORTS, { recursive: true });
const env = Object.assign({}, process.env, {
  NODE_PATH: [NM, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
  GCLOUD_PROJECT: 'demo-weddy',
  WEDDY_EXPOSE_INTERNALS_FOR_TESTS: '1',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085',
  FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9195',
  PYTHONDONTWRITEBYTECODE: '1',
});
// Segurança: nunca contra produção.
for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN']) delete env[k];

const results = [];
for (const s of selected) {
  const t0 = Date.now();
  process.stdout.write(`▶ ${s.id.padEnd(18)} ${s.name} ... `);
  const r = spawnSync(s.cmd[0], s.cmd.slice(1), { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(path.join(REPORTS, s.id + '.log'), out);
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  const summary = [...lines].reverse().find((l) => /(\d+\s*\/\s*\d+\s*OK|\d+\s*OK,\s*\d+\s*(?:FALHAS|FAIL)|FAILS:|verificações OK|RESULT passed)/.test(l)) || lines[lines.length - 1] || '';
  const passed = r.status === 0;
  results.push({ id: s.id, name: s.name, group: s.group, passed, status: r.status, seconds: Math.round((Date.now() - t0) / 100) / 10, summary });
  console.log(passed ? `OK  (${results[results.length - 1].seconds}s) ${summary}` : `FALHOU (exit ${r.status}) ${summary}`);
  if (!passed) lines.filter((l) => /^FAIL|FALHOU|Error|ERRO/.test(l)).slice(0, 8).forEach((l) => console.log('     ' + l));
}

const failed = results.filter((r) => !r.passed);
const md = ['# Relatório de testes Weddy', '', `Data: ${new Date().toISOString()}`, '', '| Suite | Estado | Tempo | Resumo |', '|---|---|---|---|']
  .concat(results.map((r) => `| ${r.id} — ${r.name} | ${r.passed ? 'PASSOU' : 'FALHOU'} | ${r.seconds}s | ${r.summary.replace(/\|/g, '/')} |`))
  .concat(['', `**${results.length - failed.length}/${results.length} suites passaram.**`]).join('\n');
fs.writeFileSync(path.join(REPORTS, 'last-run.md'), md + '\n');
fs.writeFileSync(path.join(REPORTS, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} suites passaram. Relatório: tests/reports/last-run.md`);
process.exit(failed.length ? 1 : 0);
