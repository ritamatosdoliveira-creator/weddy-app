/* Testes da migração dos consentimentos WhatsApp antigos (emulador Firestore). */
'use strict';
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const m = require('../../scripts/migrate-whatsapp-consents.js');
admin.initializeApp({ projectId: 'demo-weddy' });
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('OK   ' + msg); } else { fail++; console.log('FAIL ' + msg); } };

// --- função pura ---
const P = '+351912345678';
ok(m.classifyEntry({ phone: P }, null).kind === 'no-preference', 'sem preferências');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: true, optedInAt: 'x' } } }, null).kind === 'couple-asserted-pending', 'consentimento marcado pelo casal sem prova -> pendente');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: true, source: 'guest' } } }, null).kind === 'mirror-without-record', 'espelho "guest" sem registo no servidor -> não confiar');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: true, source: 'guest' } } }, { status: 'granted', phone: P }).kind === 'proof-preserved', 'com registo do servidor e mesmo número -> preservado');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: true } } }, { status: 'granted', phone: '+351900000000' }).kind === 'couple-asserted-pending', 'registo de outro número não serve');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: true } } }, { status: 'revoked', phone: P }).kind === 'couple-asserted-pending', 'registo revogado não serve');
ok(m.classifyEntry({ phone: '', communicationPreferences: { whatsapp: { optedIn: true } } }, null).kind === 'legacy-no-phone', 'consentimento sem número');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: false, optedOutAt: 'd' } } }, null).kind === 'opted-out-kept', 'opt-out mantém-se');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: false, pendingRenewal: true } } }, null).kind === 'already-pending', 'já pendente é ignorado (idempotência)');
ok(m.classifyEntry({ phone: P, communicationPreferences: { whatsapp: { optedIn: 'true' } } }, null).kind === 'not-opted-in', 'valor não booleano não conta como consentimento');

const st = () => ({
  guests: {
    noiva: { familia: [
      { guestId: 'a', name: 'A', phone: '+351911111111', communicationPreferences: { whatsapp: { optedIn: true, optedInAt: '2026-09-01T10:00:00Z', optedOutAt: null } } },
      { guestId: 'b', name: 'B', phone: '+351922222222', communicationPreferences: { whatsapp: { optedIn: true, optedInAt: '2026-10-01T10:00:00Z', source: 'guest' } } },
      { guestId: 'c', name: 'C', phone: '+351933333333', communicationPreferences: { whatsapp: { optedIn: false, optedInAt: '2026-08-01T10:00:00Z', optedOutAt: '2026-08-02T10:00:00Z' } } },
      { guestId: 'd', name: 'D', phone: '' },
    ], amigos: [], duvida: [], staff: [], custom: [{ id: 'x', names: [{ guestId: 'e', name: 'E', phone: '+351944444444', communicationPreferences: { whatsapp: { optedIn: true } } }] }] },
    noivo: {}, conjunto: {},
  },
  settings: { coupleName1: 'Z' }, todo: [{ id: 1 }],
});
(async () => {
  for (const c of ['weddings', 'whatsappConsents']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
  await db.collection('weddings').doc('W1').set({ ownerEmails: ['a@x.pt'], json: JSON.stringify(st()) });
  await db.collection('weddings').doc('W2').set({ ownerEmails: ['b@x.pt'], json: '{not json' });
  await db.collection('weddings').doc('W3').set({ ownerEmails: ['c@x.pt'], json: '{}' });
  // b tem prova real no servidor
  await db.collection('whatsappConsents').doc('W1_b').set({ weddingId: 'W1', guestId: 'b', phone: '+351922222222', status: 'granted' });

  const before = (await db.collection('weddings').doc('W1').get()).data().json;
  const dry = await m.run({ apply: false });
  ok(dry.mode === 'DRY-RUN' && dry.preserved === 1 && dry.wouldMakePending === 2, 'dry-run: 1 preservado (b), 2 pendentes (a, e)');
  ok((await db.collection('weddings').doc('W1').get()).data().json === before, 'dry-run não escreve nada');
  ok(dry.counts['unreadable-json'] === 1 && dry.counts['opted-out-kept'] === 1, 'json ilegível contado e saltado; opt-out contado');
  ok(!JSON.stringify(dry).includes('+351') && !JSON.stringify(dry).includes('"A"'), 'relatório sem telefones nem nomes');
  let threw = false; try { await m.run({ apply: true }); } catch (e) { threw = /--backup/.test(e.message); }
  ok(threw, '--apply sem --backup é recusado');

  const bk = path.join(os.tmpdir(), 'wa-consent-backup-test.json');
  const ap = await m.run({ apply: true, backup: bk });
  const after = JSON.parse((await db.collection('weddings').doc('W1').get()).data().json);
  const g = (id) => { const all = [...after.guests.noiva.familia, ...after.guests.noiva.custom[0].names]; return all.find((e) => e.guestId === id); };
  ok(ap.weddingsWritten === 1, 'apply escreve só o casamento afetado');
  ok(g('a').communicationPreferences.whatsapp.optedIn === false && g('a').communicationPreferences.whatsapp.pendingRenewal === true && g('a').communicationPreferences.whatsapp.legacyOptedInAt === '2026-09-01T10:00:00Z', 'a: pendente de renovação, rasto do consentimento antigo guardado');
  ok(g('e').communicationPreferences.whatsapp.pendingRenewal === true, 'e (categoria personalizada): pendente');
  ok(g('b').communicationPreferences.whatsapp.optedIn === true && g('b').communicationPreferences.whatsapp.source === 'guest', 'b: consentimento com prova preservado');
  ok(g('c').communicationPreferences.whatsapp.optedOutAt === '2026-08-02T10:00:00Z' && g('c').communicationPreferences.whatsapp.optedIn === false, 'c: opt-out intacto');
  ok(g('a').name === 'A' && g('a').phone === '+351911111111' && after.settings.coupleName1 === 'Z' && after.todo.length === 1, 'nomes, telefones e outras chaves intactos');
  const bkj = JSON.parse(fs.readFileSync(bk, 'utf8'));
  ok(bkj.entries.length === 2 && !JSON.stringify(bkj).includes('+351') && !JSON.stringify(bkj).includes('"A"'), 'backup guarda só o estado anterior (2 entradas), sem nomes nem telefones');
  const again = await m.run({ apply: true, backup: bk + '.2' });
  ok(again.weddingsWritten === 0 && again.wouldMakePending === 0 && (await db.collection('weddings').doc('W1').get()).data().json === JSON.stringify(after), 'idempotente: segunda execução não altera nada');
  const rb = await m.rollback({ rollback: bk });
  const restored = JSON.parse((await db.collection('weddings').doc('W1').get()).data().json);
  const ra = restored.guests.noiva.familia[0];
  ok(rb.restored === 2 && ra.communicationPreferences.whatsapp.optedIn === true && ra.communicationPreferences.whatsapp.pendingRenewal === undefined, 'rollback repõe as preferências antigas');
  console.log(`\n${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
