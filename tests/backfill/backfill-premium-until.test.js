// Teste do backfill contra o emulador do Firestore (nunca produção).
// Correr com: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node tests/backfill/backfill-premium-until.test.js
'use strict';
const assert = require('assert');
const admin = require('firebase-admin');
const { classify, run, expiryFromStartedAt } = require('../../scripts/backfill-premium-until.js');
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('Só corre contra o emulador.'); process.exit(2); }
admin.initializeApp({ projectId: 'demo-weddy' });
const db = admin.firestore(); const TS = admin.firestore.Timestamp;
const NOW = new Date('2026-11-01T12:00:00Z');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('OK  ', m); };

(async () => {
  // — parte pura
  ok(classify(null, NOW).kind === 'no-subscription', 'sem subscrição');
  ok(classify({ active: false, startedAt: '2025-01-01' }, NOW).kind === 'inactive', 'inativa ignorada');
  ok(classify({ active: true }, NOW).kind === 'legacy-no-startedAt', 'sem startedAt => decisão humana');
  ok(classify({ active: true, startedAt: 'lixo' }, NOW).kind === 'invalid-date', 'data ilegível');
  ok(classify({ active: true, startedAt: 12345 }, NOW).kind === 'invalid-date', 'startedAt não-texto');
  ok(classify({ active: true, startedAt: '2030-01-01T00:00:00Z' }, NOW).kind === 'future-date', 'data no futuro');
  ok(classify({ active: true, startedAt: '2026-11-02T00:00:00Z' }, NOW).kind === 'update', 'até 1,5 dia à frente tolerado');
  ok(classify({ active: true, startedAt: '2024-01-01T00:00:00Z' }, NOW).kind === 'update-expired', 'expirada');
  ok(classify({ active: true, startedAt: '2025-11-20T00:00:00Z' }, NOW).kind === 'update-expiring-soon', 'a expirar em <30 dias');
  ok(classify({ active: true, startedAt: '2026-06-01T00:00:00Z' }, NOW).kind === 'update', 'normal');
  const exp = expiryFromStartedAt('2026-06-01T00:00:00Z');
  ok(classify({ active: true, startedAt: '2026-06-01T00:00:00Z', premiumUntil: TS.fromDate(exp) }, NOW).kind === 'already-ok', 'já correto');
  ok(classify({ active: true, startedAt: '2026-06-01T00:00:00Z', premiumUntil: TS.fromDate(new Date('2030-01-01')) }, NOW).kind === 'mismatch', 'valor diferente não é pisado');
  ok(classify({ active: true, startedAt: '2026-06-01T00:00:00Z', premiumUntil: 'x' }, NOW).kind === 'invalid-existing', 'premiumUntil existente inválido');
  ok(expiryFromStartedAt('2026-01-31T00:00:00Z').toISOString() === new Date(new Date('2026-01-31T00:00:00Z').setMonth(12)).toISOString(), 'regra +12 meses igual à de index.js');

  // — emulador
  const col = db.collection('weddings');
  { const old = await col.get(); await Promise.all(old.docs.map((d) => d.ref.delete())); } // emulador limpo
  const seed = {
    W_new: { subscription: { active: true, startedAt: '2026-06-01T00:00:00Z', plan: 'premium-12meses', stripeCheckoutSessionIds: ['cs_1'] }, json: '{"x":1}', ownerEmails: ['a@x.pt'] },
    W_exp: { subscription: { active: true, startedAt: '2024-01-01T00:00:00Z' } },
    W_soon: { subscription: { active: true, startedAt: '2025-11-20T00:00:00Z' } },
    W_legacy: { subscription: { active: true } },
    W_bad: { subscription: { active: true, startedAt: 'não é data' } },
    W_future: { subscription: { active: true, startedAt: '2031-01-01T00:00:00Z' } },
    W_done: { subscription: { active: true, startedAt: '2026-06-01T00:00:00Z', premiumUntil: TS.fromDate(expiryFromStartedAt('2026-06-01T00:00:00Z')) } },
    W_renewed: { subscription: { active: true, startedAt: '2026-06-01T00:00:00Z', premiumUntil: TS.fromDate(new Date('2028-01-01T00:00:00Z')) } },
    W_cancelled: { subscription: { active: false, startedAt: '2025-01-01T00:00:00Z' } },
    W_free: { json: '{}' },
  };
  for (const [id, d] of Object.entries(seed)) await col.doc(id).set(d);
  const snapshotBefore = {}; for (const id of Object.keys(seed)) snapshotBefore[id] = JSON.stringify((await col.doc(id).get()).data());

  const dry = await run({ apply: false, now: NOW });
  ok(dry.scannedActive === 8, 'dry-run analisa só as ativas (8)');
  ok(dry.written === 0, 'dry-run não escreve');
  for (const id of Object.keys(seed)) ok(JSON.stringify((await col.doc(id).get()).data()) === snapshotBefore[id], `dry-run: ${id} intacto`);
  ok(dry.wouldUpdate === 3 && dry.counts['update-expired'] === 1 && dry.counts['update-expiring-soon'] === 1 && dry.counts['update'] === 1, 'dry-run: 3 a atualizar (1 expirada, 1 a expirar, 1 normal)');
  ok(dry.impact.untouchedNeedHumanDecision === 4, 'dry-run: 4 a aguardar decisão (legacy, bad, future, mismatch)');
  ok(!JSON.stringify(dry).includes('@'), 'relatório sem emails');

  const fs = require('fs'), os = require('os'), path = require('path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-'));
  const dryFile = path.join(tmp, 'dry.json'), bkFile = path.join(tmp, 'backup.json');
  const rejects = async (opts, re) => { try { await run(opts); return false; } catch (e) { return re.test(e.message); } };

  // --- portões de segurança do apply
  ok(await rejects({ apply: true, now: NOW }, /--backup/), 'apply sem --backup é recusado');
  ok(await rejects({ apply: true, now: NOW, backup: bkFile }, /--confirm-dry-run/), 'apply sem dry-run revisto é recusado');
  fs.writeFileSync(dryFile, JSON.stringify({ ...dry, mode: 'APPLY' }));
  ok(await rejects({ apply: true, now: NOW, backup: bkFile, confirmDryRun: dryFile }, /não é de um dry-run/), 'relatório que não é de dry-run é recusado');
  fs.writeFileSync(dryFile, JSON.stringify(dry));
  ok(await rejects({ apply: true, now: new Date(NOW.getTime() + 25 * 3600e3), backup: bkFile, confirmDryRun: dryFile }, /24 h/), 'dry-run com mais de 24 h é recusado');
  ok(await rejects({ apply: true, now: NOW, limit: 2, backup: bkFile, confirmDryRun: dryFile }, /--limit/), '--limit com --apply é recusado');
  ok(!fs.existsSync(bkFile), 'nenhuma recusa criou backup nem escreveu');
  for (const id of Object.keys(seed)) ok(JSON.stringify((await col.doc(id).get()).data()) === snapshotBefore[id], `após recusas: ${id} intacto`);
  // dados mudam depois do dry-run => recusa
  await col.doc('W_late').set({ subscription: { active: true, startedAt: '2026-07-01T00:00:00Z' } });
  ok(await rejects({ apply: true, now: NOW, backup: bkFile, confirmDryRun: dryFile }, /mudaram desde o dry-run/), 'casamento novo depois do dry-run => recusado, pede novo dry-run');
  await col.doc('W_late').delete();

  // --- apply válido
  const ap = await run({ apply: true, now: NOW, backup: bkFile, confirmDryRun: dryFile });
  ok(ap.written === 3, 'apply: escreveu exatamente 3');
  const bk = JSON.parse(fs.readFileSync(bkFile, 'utf8'));
  ok(bk.entries.length === 3 && bk.entries.every((e) => e.id && e.wroteMs && e.hadPremiumUntil === false) && !JSON.stringify(bk).includes('@'), 'backup gravado com os 3 casamentos, sem emails');
  const w = (await col.doc('W_new').get()).data();
  ok(w.subscription.premiumUntil.toMillis() === expiryFromStartedAt('2026-06-01T00:00:00Z').getTime(), 'premiumUntil correto (+12 meses)');
  ok(w.subscription.active === true && w.subscription.startedAt === '2026-06-01T00:00:00Z' && w.subscription.plan === 'premium-12meses' && w.subscription.stripeCheckoutSessionIds[0] === 'cs_1' && w.json === '{"x":1}' && w.ownerEmails[0] === 'a@x.pt', 'só premiumUntil mudou (resto intacto)');
  for (const id of ['W_legacy', 'W_bad', 'W_future', 'W_renewed', 'W_cancelled', 'W_free', 'W_done']) ok(JSON.stringify((await col.doc(id).get()).data()) === snapshotBefore[id], `apply: ${id} intocado`);
  ok((await col.doc('W_legacy').get()).data().subscription.premiumUntil === undefined, 'contas sem startedAt ficam intocadas (sem premiumUntil)');

  // --- idempotência: 2.º dry-run + apply não escrevem nada
  const dry2 = await run({ apply: false, now: NOW });
  ok(dry2.wouldUpdate === 0 && dry2.counts['already-ok'] === 4, 'idempotente: novo dry-run não tem nada a atualizar (4 já corretos)');
  const dryFile2 = path.join(tmp, 'dry2.json'); fs.writeFileSync(dryFile2, JSON.stringify(dry2));
  const again = await run({ apply: true, now: NOW, backup: path.join(tmp, 'b2.json'), confirmDryRun: dryFile2 });
  ok(again.written === 0, 'idempotente: 2.º apply não escreve nada');

  // --- renovação entre o apply e o rollback não é pisada
  await col.doc('W_soon').update({ 'subscription.premiumUntil': TS.fromDate(new Date('2028-05-05T00:00:00Z')) });
  const rb = await require('../../scripts/backfill-premium-until.js').rollback({ rollback: bkFile });
  ok(rb.removed === 2 && rb.kept === 1, 'rollback: remove os 2 que ainda têm o valor escrito, mantém o renovado');
  ok((await col.doc('W_soon').get()).data().subscription.premiumUntil.toMillis() === new Date('2028-05-05T00:00:00Z').getTime(), 'rollback não toca no valor renovado entretanto');
  ok((await col.doc('W_new').get()).data().subscription.premiumUntil === undefined && (await col.doc('W_new').get()).data().subscription.active === true, 'rollback: W_new sem premiumUntil, subscrição ativa intacta');
  ok(JSON.stringify((await col.doc('W_done').get()).data()) === snapshotBefore['W_done'], 'rollback não toca no que o script nunca escreveu');
  console.log(`\n${pass} verificações OK`);
  process.exit(0);
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
