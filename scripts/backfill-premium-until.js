#!/usr/bin/env node
/**
 * Backfill de weddings/{id}.subscription.premiumUntil (Timestamp) a partir de
 * subscription.startedAt + 12 meses — a MESMA regra de subscriptionExpiryDate()
 * em index.js e de hasActiveSubscription() na app.
 *
 * Porquê: as regras do Firestore/Storage (Memories, Documentos) comparam
 * premiumUntil com a hora do servidor. Os webhooks novos já o gravam; as
 * subscrições anteriores não o têm e contam só pelo campo "active".
 *
 * SEGURANÇA
 *  - Por defeito é DRY-RUN: não escreve nada. Só escreve com --apply.
 *  - Só toca em subscription.premiumUntil (campo pontilhado). Nunca altera
 *    active, startedAt, ids de pagamento nem qualquer outro campo.
 *  - Idempotente: o que já tem o valor certo é ignorado; correr duas vezes não
 *    altera nada na segunda. Cada escrita é uma transação que volta a ler e
 *    confirma active/startedAt antes de escrever (se mudaram entretanto, salta).
 *  - Datas validadas: sem startedAt, inválida ou no futuro => NÃO se escreve,
 *    fica no relatório para decisão humana.
 *  - O relatório não contém emails nem nomes (só ids de casamento e contagens).
 *
 * PROCEDIMENTO OBRIGATÓRIO (ver docs/seguranca/PROCEDIMENTO-PUBLICACAO.md):
 *   1) Dry-run (por defeito, não escreve):
 *        node scripts/backfill-premium-until.js --project <id> --report dry.json
 *   2) Revisão humana do relatório de impacto.
 *   3) Backup completo da coleção (gcloud firestore export) FORA deste script.
 *   4) Apply — só aceita se: (a) --confirm-dry-run dry.json for um dry-run com
 *      menos de 24 h, (b) uma nova análise der EXATAMENTE os mesmos casamentos a
 *      atualizar que o dry-run, (c) --backup <ficheiro> for indicado (grava o
 *      valor anterior de cada casamento tocado, ANTES de escrever):
 *        WEDDY_CONFIRM_PROD=sim node scripts/backfill-premium-until.js --project <id> \
 *          --apply --confirm-dry-run dry.json --backup backup-premiumUntil.json
 *   5) Reverter (só remove premiumUntil onde ainda é o valor que o script escreveu):
 *        ... --rollback backup-premiumUntil.json
 *   --now <ISO> fixa "agora" (testes) | --limit N limita o nº analisado (só dry-run)
 * Para testar contra o emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
 */
'use strict';

const SUBSCRIPTION_MAX_MONTHS = 12; // = index.js e app/index.html
const FUTURE_TOLERANCE_MS = 36 * 3600 * 1000; // relógios/fusos: até 1,5 dias à frente é aceitável
const SOON_DAYS = 30;

function expiryFromStartedAt(startedAt) {
  const started = new Date(startedAt);
  if (isNaN(started.getTime())) return null;
  const expiry = new Date(started);
  expiry.setMonth(expiry.getMonth() + SUBSCRIPTION_MAX_MONTHS);
  return expiry;
}

/** Decide o que fazer com UMA subscrição. Função pura (testada à parte). */
function classify(sub, now) {
  if (!sub || typeof sub !== 'object') return { kind: 'no-subscription' };
  if (sub.active !== true) return { kind: 'inactive' };
  if (sub.startedAt === undefined || sub.startedAt === null || sub.startedAt === '') {
    return { kind: 'legacy-no-startedAt' }; // válida para sempre pelas regras antigas — decisão humana
  }
  if (typeof sub.startedAt !== 'string') return { kind: 'invalid-date', detail: 'startedAt não é texto' };
  const expiry = expiryFromStartedAt(sub.startedAt);
  if (!expiry) return { kind: 'invalid-date', detail: 'startedAt ilegível' };
  const started = new Date(sub.startedAt);
  if (started.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return { kind: 'future-date', detail: sub.startedAt };
  // premiumUntil já presente?
  const cur = sub.premiumUntil;
  if (cur !== undefined && cur !== null) {
    const curMs = cur && typeof cur.toMillis === 'function' ? cur.toMillis() : (cur instanceof Date ? cur.getTime() : NaN);
    if (isNaN(curMs)) return { kind: 'invalid-existing', expiry };
    if (curMs === expiry.getTime()) return { kind: 'already-ok', expiry };
    return { kind: 'mismatch', expiry, existingMs: curMs }; // p.ex. renovação feita pelos webhooks novos: não mexer
  }
  const msLeft = expiry.getTime() - now.getTime();
  if (msLeft <= 0) return { kind: 'update-expired', expiry };
  if (msLeft <= SOON_DAYS * 86400000) return { kind: 'update-expiring-soon', expiry };
  return { kind: 'update', expiry };
}

const DRY_RUN_MAX_AGE_MS = 24 * 3600 * 1000;
const UPDATE_KINDS = ['update', 'update-expired', 'update-expiring-soon'];

/** Garante que o apply corresponde EXATAMENTE ao que foi revisto no dry-run. */
async function assertMatchesDryRun(opts) {
  if (!opts.backup) throw new Error('--apply exige --backup <ficheiro.json>.');
  if (!opts.confirmDryRun) throw new Error('--apply exige --confirm-dry-run <relatorio-dry-run.json> (faz primeiro um dry-run e revê-o).');
  const prev = JSON.parse(require('fs').readFileSync(opts.confirmDryRun, 'utf8'));
  if (prev.mode !== 'DRY-RUN') throw new Error('O relatório indicado não é de um dry-run.');
  const now = opts.now || new Date();
  const age = now.getTime() - new Date(prev.generatedAt).getTime();
  if (!(age >= 0) || age > DRY_RUN_MAX_AGE_MS) throw new Error('O dry-run tem mais de 24 h (ou data inválida). Repete-o e revê-o.');
  const fresh = await run({ ...opts, apply: false, limit: 0 });
  for (const k of UPDATE_KINDS) {
    const a = (prev.ids && prev.ids[k] || []).slice().sort().join(',');
    const b = (fresh.ids[k] || []).slice().sort().join(',');
    if (a !== b) throw new Error(`Os dados mudaram desde o dry-run (${k}). Repete o dry-run e revê o novo relatório.`);
  }
  // Backup ANTES de qualquer escrita: o que vai ser escrito, com o valor anterior
  // (nenhum — o script só escreve onde premiumUntil não existe). O rollback
  // só apaga onde o valor ainda for o escrito por este script.
  require('fs').writeFileSync(opts.backup, JSON.stringify({ generatedAt: (opts.now || new Date()).toISOString(), note: 'premiumUntil não existia nestes casamentos antes do apply', entries: fresh.plan }, null, 2));
}

async function run(opts) {
  if (opts.apply) {
    if (opts.limit) throw new Error('--limit não é permitido com --apply.');
    await assertMatchesDryRun(opts);
  }
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp(opts.project ? { projectId: opts.project } : undefined);
  const db = admin.firestore();
  const Timestamp = admin.firestore.Timestamp;
  const now = opts.now || new Date();
  const counts = {};
  const ids = {};
  const bump = (k, id) => { counts[k] = (counts[k] || 0) + 1; (ids[k] = ids[k] || []).push(id); };
  let scanned = 0, written = 0, skippedRace = 0;
  const plan = [];

  let last = null;
  for (;;) {
    let q = db.collection('weddings').where('subscription.active', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      last = doc.id;
      if (opts.limit && scanned >= opts.limit) break;
      scanned++;
      const sub = (doc.data() || {}).subscription;
      const c = classify(sub, now);
      bump(c.kind, doc.id);
      if (c.kind.startsWith('update')) plan.push({ id: doc.id, startedAt: sub.startedAt, hadPremiumUntil: false, wroteMs: c.expiry.getTime() });
      if (!opts.apply || !c.kind.startsWith('update')) continue;
      const outcome = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const f = (fresh.data() || {}).subscription;
        // Voltar a decidir com os dados frescos: se mudou (renovação, cancelamento), não escrever.
        const c2 = classify(f, now);
        if (!c2.kind.startsWith('update') || !f || f.startedAt !== sub.startedAt) return 'race';
        tx.update(doc.ref, { 'subscription.premiumUntil': Timestamp.fromDate(c2.expiry) });
        return 'written';
      });
      if (outcome === 'written') written++; else skippedRace++;
    }
    if (opts.limit && scanned >= opts.limit) break;
  }

  const toUpdate = (counts['update'] || 0) + (counts['update-expired'] || 0) + (counts['update-expiring-soon'] || 0);
  return {
    mode: opts.apply ? 'APPLY' : 'DRY-RUN',
    generatedAt: now.toISOString(),
    scannedActive: scanned,
    counts,
    wouldUpdate: toUpdate,
    written,
    skippedRace,
    impact: {
      expiredNowLoseMemoriesAndDocumentsUploads: counts['update-expired'] || 0,
      expiringWithinDays: { days: SOON_DAYS, weddings: counts['update-expiring-soon'] || 0 },
      untouchedNeedHumanDecision: (counts['legacy-no-startedAt'] || 0) + (counts['invalid-date'] || 0) + (counts['future-date'] || 0) + (counts['invalid-existing'] || 0) + (counts['mismatch'] || 0),
    },
    ids,
    plan,
  };
}

async function rollback(opts) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp(opts.project ? { projectId: opts.project } : undefined);
  const db = admin.firestore();
  const b = JSON.parse(require('fs').readFileSync(opts.rollback, 'utf8'));
  let removed = 0, kept = 0;
  for (const e of b.entries) {
    const ref = db.collection('weddings').doc(e.id);
    const out = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const cur = s.exists && s.data().subscription && s.data().subscription.premiumUntil;
      // Só remove se ainda for exatamente o valor que este script escreveu (renovações novas não são tocadas).
      if (cur && typeof cur.toMillis === 'function' && cur.toMillis() === e.wroteMs && !e.hadPremiumUntil) {
        tx.update(ref, { 'subscription.premiumUntil': admin.firestore.FieldValue.delete() });
        return 'removed';
      }
      return 'kept';
    });
    if (out === 'removed') removed++; else kept++;
  }
  return { removed, kept };
}

function printReport(r) {
  const L = [];
  L.push(`Backfill premiumUntil — ${r.mode} — ${r.generatedAt}`);
  L.push(`Subscrições ativas analisadas: ${r.scannedActive}`);
  Object.keys(r.counts).sort().forEach((k) => L.push(`  ${k.padEnd(24)} ${r.counts[k]}`));
  L.push(`A atualizar: ${r.wouldUpdate} | escritas: ${r.written} | saltadas por alteração concorrente: ${r.skippedRace}`);
  L.push(`Impacto: ${r.impact.expiredNowLoseMemoriesAndDocumentsUploads} casamento(s) com Premium já expirado passam a não poder carregar Memories/Documentos; ${r.impact.expiringWithinDays.weddings} expiram nos próximos ${r.impact.expiringWithinDays.days} dias; ${r.impact.untouchedNeedHumanDecision} ficam intocados a aguardar decisão.`);
  if (r.mode === 'DRY-RUN') L.push('DRY-RUN: nada foi escrito. Usa --apply para escrever.');
  return L.join('\n');
}

function parseArgs(argv) {
  const o = { apply: false, project: null, report: null, limit: 0, now: null, backup: null, confirmDryRun: null, rollback: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--project') o.project = argv[++i];
    else if (a === '--report') o.report = argv[++i];
    else if (a === '--backup') o.backup = argv[++i];
    else if (a === '--confirm-dry-run') o.confirmDryRun = argv[++i];
    else if (a === '--rollback') o.rollback = argv[++i];
    else if (a === '--limit') o.limit = Number(argv[++i]) || 0;
    else if (a === '--now') { o.now = new Date(argv[++i]); if (isNaN(o.now.getTime())) throw new Error('--now inválido'); }
    else throw new Error('Argumento desconhecido: ' + a);
  }
  return o;
}

module.exports = { classify, expiryFromStartedAt, run, rollback, printReport, parseArgs, SUBSCRIPTION_MAX_MONTHS };

if (require.main === module) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (!process.env.FIRESTORE_EMULATOR_HOST && (o.apply || o.rollback)) {
    console.error('A ESCREVER NUM PROJETO REAL (--apply sem emulador). Confirma com WEDDY_CONFIRM_PROD=sim.');
    if (process.env.WEDDY_CONFIRM_PROD !== 'sim') process.exit(2);
  }
  if (o.rollback) { rollback(o).then((r) => console.log(`Rollback: removidos ${r.removed}, mantidos ${r.kept} (valor já diferente do escrito)`)).catch((e) => { console.error('Falhou:', e.message); process.exit(1); }); return; }
  run(o).then((r) => {
    console.log(printReport(r));
    if (o.report) { require('fs').writeFileSync(o.report, JSON.stringify(r, null, 2)); console.log('Relatório: ' + o.report); }
  }).catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
}
