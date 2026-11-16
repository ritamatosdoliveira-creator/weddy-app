/* Fase K.2 — (A) flag da WhatsApp Business API desligada por defeito; (B) revogação de tokens de download ao remover
 * co-dono. Emulador Firestore; Storage/fetch SIMULADOS (nenhuma chamada real à Meta nem ao Storage). */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
delete process.env.WHATSAPP_API_ENABLED;
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const T = fns._test; const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
let fetchCalls = [];
global.fetch = async (u) => { fetchCalls.push(String(u)); return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.X' }] }), text: async () => '' }; };
// Storage simulado: ficheiros com token
const files = {}; const ops = { deletes: 0, failOn: null, listFail: false };
const mk = (p, tok) => { files[p] = { token: tok || 'orig-' + p }; };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ name: 'b',
  getFiles: async ({ prefix }) => { if (ops.listFail) throw new Error('storage down'); return [Object.keys(files).filter((k) => k.startsWith(prefix)).map((name) => ({ name,
    setMetadata: async (m) => { if (ops.failOn && name === ops.failOn) throw new Error('falha'); files[name].token = m.metadata.firebaseStorageDownloadTokens; },
    delete: async () => { ops.deletes++; delete files[name]; } }))]; } }) }) });
const A = (email) => ({ uid: 'uid-' + email, token: { email, email_verified: true } });
const callWa = async (auth, data) => { try { const r = await fns.sendWhatsappRsvpReminder.run({ auth, data, rawRequest: {} }); return { r }; } catch (e) { return { code: e.code, reason: e.details && e.details.reason, msg: e.message }; } };

(async () => {
  // ---------- A. WhatsApp ----------
  ok(T.whatsappApiEnabled() === false, 'flag WHATSAPP_API_ENABLED desligada por defeito');
  const future = new Date(Date.now() + 200 * 864e5);
  await db.collection('weddings').doc('wA').set({ ownerEmails: ['a@teste.pt'], ownerUids: ['uid-a@teste.pt'], subscription: { active: true, premiumUntil: admin.firestore.Timestamp.fromDate(future), startedAt: new Date().toISOString() },
    json: JSON.stringify({ guests: { noiva: { familia: [{ id: 'g1', guestId: 'gid1', name: 'Convidado Ficticio', phone: '+351000000001', rsvpToken: 'tokenconvite0001' }] } } }) });
  await db.collection('guests').doc('tokenconvite0001').set({ weddingId: 'wA', name: 'Convidado Ficticio' });
  let w = await callWa(null, { guestId: 'gid1' }); ok(w.code === 'unauthenticated', 'sem sessão → unauthenticated (inalterado)');
  w = await callWa(A('a@teste.pt'), { guestId: 'gid1' });
  ok(w.code === 'unavailable' && w.reason === 'whatsapp_api_disabled', 'desligada: unavailable / whatsapp_api_disabled');
  ok(fetchCalls.length === 0, 'desligada: nenhuma chamada à Graph API');
  ok((await db.collection('whatsappReminderDailyUsage').get()).empty && (await db.collection('whatsappReminderRateLimit').get()).empty, 'desligada: não consome limites nem escreve nada');
  for (const v of ['false', '', 'FALSE', '0', 'no', 'sim']) { process.env.WHATSAPP_API_ENABLED = v; ok(T.whatsappApiEnabled() === false, `valor "${v}" não liga a flag`); }
  process.env.WHATSAPP_API_ENABLED = ' TRUE '; ok(T.whatsappApiEnabled() === true, 'só "true" (sem distinguir maiúsculas/espaços) liga a flag');
  w = await callWa(A('a@teste.pt'), { guestId: 'gid1' }); ok(w.reason !== 'whatsapp_api_disabled', 'ligada (apenas em teste): passa a barreira e segue para as restantes verificações (' + (w.code || 'ok') + ')');
  ok(fetchCalls.length === 0, 'ligada em teste mas sem segredos configurados: continua sem chamada real à Meta');
  delete process.env.WHATSAPP_API_ENABLED;
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  ok(/graph\.facebook\.com/.test(src) && /exports\.whatsappWebhook/.test(src), 'código da API e webhook preservados (nada removido)');
  ok(/defineString\('WHATSAPP_API_ENABLED', \{ default: 'false' \}\)/.test(src), 'defeito declarado como false no código');

  // ---------- B. Revogação de tokens ----------
  ok(typeof fns.revokeDownloadTokensOnOwnerRemoval === 'function' && fns.revokeDownloadTokensOnOwnerRemoval.__endpoint && fns.revokeDownloadTokensOnOwnerRemoval.__endpoint.eventTrigger, 'trigger Firestore exportado');
  mk('documents/W1/a.pdf'); mk('documents/W1/b.pdf'); mk('memories/W1/publico/f.png'); mk('memories/W1/tok1/g.jpg'); mk('sites/W1/h.jpg'); mk('public-sites/slug1/h.jpg'); mk('feedback/W1/f1/a.png');
  mk('documents/W2/a.pdf'); mk('memories/W2/publico/f.png'); mk('sites/W2/h.jpg'); mk('documents/W10/a.pdf');
  const snap = () => JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.token])));
  const before = { ownerEmails: ['a@x.pt', 'Co@X.pt'], ownerUids: ['A', 'CO'] };
  let r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt', 'Co@X.pt', 'novo@x.pt'], ownerUids: ['A', 'CO', 'N'] }, 'e0');
  ok(r.action === 'none', 'acrescentar um dono não revoga nada'); 
  ok((await T.handleOwnerRemoval('W1', null, before, 'e0b')).action === 'skip' && (await T.handleOwnerRemoval('W1', before, null, 'e0c')).action === 'skip', 'criação/apagamento do casamento: ignorado');
  r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt', 'CO@x.pt'], ownerUids: ['A', 'CO'] }, 'e0d'); ok(r.action === 'none', 'diferença só de maiúsculas no email não conta como remoção');
  const s0 = snap();
  r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt'], ownerUids: ['A'] }, 'e1');
  ok(r.action === 'revoked' && r.rotated === 5 && r.failed === 0, 'remoção de co-dono: 5 ficheiros (documents, memories, sites) com token novo');
  const s1 = JSON.parse(snap()), o0 = JSON.parse(s0);
  ok(['documents/W1/a.pdf', 'documents/W1/b.pdf', 'memories/W1/publico/f.png', 'memories/W1/tok1/g.jpg', 'sites/W1/h.jpg'].every((k) => s1[k] !== o0[k]), 'tokens dos ficheiros do casamento mudaram');
  ok(['documents/W2/a.pdf', 'memories/W2/publico/f.png', 'sites/W2/h.jpg', 'documents/W10/a.pdf', 'public-sites/slug1/h.jpg', 'feedback/W1/f1/a.png'].every((k) => s1[k] === o0[k]), 'outros casamentos (incl. W10, prefixo parecido), public-sites e feedback intactos');
  ok(ops.deletes === 0 && Object.keys(files).length === 11, 'nenhum ficheiro apagado');
  const led = await db.collection('downloadTokenRevocations').doc('e1').get(); ok(led.exists && led.data().status === 'done' && led.data().weddingId === 'W1' && led.data().rotated === 5, 'registo de auditoria (server-only) gravado');
  ok(!JSON.stringify(led.data()).includes('@'), 'registo de auditoria sem emails');
  const s2 = snap(); r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt'], ownerUids: ['A'] }, 'e1'); ok(r.action === 'duplicate' && snap() === s2, 'mesmo evento entregue duas vezes: não repete');
  r = await T.handleOwnerRemoval('W1', { ownerEmails: ['a@x.pt', 'z@x.pt'], ownerUids: [] }, { ownerEmails: ['a@x.pt'], ownerUids: [] }, 'e2'); ok(r.action === 'revoked', 'segunda remoção (evento novo) volta a revogar (idempotente: nada quebra)');
  r = await T.handleOwnerRemoval('W1', { ownerEmails: ['a@x.pt'], ownerUids: ['A', 'U2'] }, { ownerEmails: ['a@x.pt'], ownerUids: ['A'] }, 'e3'); ok(r.action === 'revoked', 'remoção só do uid também conta');
  // falha parcial e total
  ops.failOn = 'documents/W1/a.pdf'; r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt'], ownerUids: ['A'] }, 'e4');
  ok(r.action === 'revoked' && r.failed === 1 && r.rotated === 4, 'falha num ficheiro: os outros são rodados, sem exceção');
  ok((await db.collection('downloadTokenRevocations').doc('e4').get()).data().status === 'partial', 'registo marca "partial"');
  ops.failOn = null; ops.listFail = true; r = await T.handleOwnerRemoval('W1', before, { ownerEmails: ['a@x.pt'], ownerUids: ['A'] }, 'e5');
  ok(r.action === 'failed' && (await db.collection('downloadTokenRevocations').doc('e5').get()).data().status === 'failed', 'Storage indisponível: não rebenta, regista "failed"');
  ops.listFail = false;
  ok((await db.collection('weddings').doc('wA').get()).exists, 'a revogação não toca em documentos do casamento');
  // eliminação de conta apaga o registo de auditoria
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
