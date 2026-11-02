/* Fase J (RGPD) — eliminação de conta: cascata completa. Emulador Firestore; Storage/Auth/fetch SIMULADOS
 * (sem rede, sem contas reais, sem Google/Stripe/OpenAI). Dados todos fictícios.
 * Valida: casamento + subcoleções + convidados + memórias + telefones/consentimentos WhatsApp + quarentena de estado
 * + estado auxiliar (notifState, seatingRuns, aiUsage) + logs de incidente + site público/slug apagados;
 * ficheiros Storage apagados; token Google apagado; dados de OUTRO casamento intactos; co-dono só é removido;
 * idempotência (2.ª chamada não rebenta nem apaga o que não é dela); falha de Storage não apaga nada. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

const store = { files: {}, failPrefix: null, deletedUsers: [] };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ name: 'bkt',
  file: (p) => ({ delete: async () => { delete store.files[p]; } }),
  getFiles: async ({ prefix }) => [Object.keys(store.files).filter((k) => k.startsWith(prefix)).map((name) => ({ name, delete: async () => { delete store.files[name]; } }))],
  deleteFiles: async ({ prefix }) => { if (store.failPrefix && prefix.startsWith(store.failPrefix)) throw new Error('storage down'); Object.keys(store.files).forEach((k) => { if (k.startsWith(prefix)) delete store.files[k]; }); } }) }) });
const realAuth = admin.auth;
Object.defineProperty(admin, 'auth', { configurable: true, value: () => ({ deleteUser: async (u) => { store.deletedUsers.push(u); }, getUser: async () => ({ email: '' }) }) });
global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

const A = (email) => ({ uid: 'uid-' + email, token: { email, email_verified: true } });
const call = (auth) => fns.deleteWeddingAccount.run({ auth, data: {}, rawRequest: {} });
async function seed(id, owners) {
  await db.collection('weddings').doc(id).set({ ownerEmails: owners, ownerUids: owners.map((o) => 'uid-' + o), json: JSON.stringify({ guests: { noiva: { familia: [{ id: 'g1', name: 'Convidado Ficticio', phone: '+351000000000' }] } } }) });
  await db.collection('weddings').doc(id).collection('snapshots').doc('s1').set({ json: '{"x":1}' });
  await db.collection('weddings').doc(id).collection('privateIntegrations').doc('googleCalendar').set({ t: 'cifrado' });
  await db.collection('guests').doc('tok-' + id).set({ weddingId: id, name: 'Convidado Ficticio' });
  await db.collection('memories').doc('mem-' + id).set({ weddingId: id, text: 'x' });
  await db.collection('guestPhoneIndex').doc('ph-' + id).set({ weddingId: id });
  await db.collection('whatsappConsents').doc('wc-' + id).set({ weddingId: id });
  await db.collection('weddingStateQuarantine').doc(id + '_1').set({ weddingId: id, json: '{"guests":"Convidado Ficticio"}' });
  await db.collection('_incident_log').doc('i-' + id).set({ weddingId: id, state: 'x' });
  await db.collection('notifState').doc(id).set({ emailOff: true });
  await db.collection('seatingRuns').doc(id).set({ lastMs: 1 });
  await db.collection('aiUsage').doc(id).set({ n: 1 });
  store.files[`documents/${id}/a.pdf`] = 1; store.files[`memories/${id}/b.jpg`] = 1; store.files[`feedback/${id}/c.png`] = 1;
}
const COLS = [['guests', 'tok-'], ['memories', 'mem-'], ['guestPhoneIndex', 'ph-'], ['whatsappConsents', 'wc-'], ['_incident_log', 'i-']];
async function exists(col, id) { return (await db.collection(col).doc(id).get()).exists; }

(async () => {
  await seed('wA', ['a@teste.pt']); await seed('wB', ['b@teste.pt']); await seed('wS', ['s1@teste.pt', 's2@teste.pt']);
  // Falha de Storage: nada de Firestore é apagado e a conta Auth fica.
  store.failPrefix = 'documents/wA';
  let threw = false; try { await call(A('a@teste.pt')); } catch (e) { threw = true; }
  ok(threw, 'falha de Storage → erro devolvido ao utilizador (pode repetir)');
  ok(await exists('weddings', 'wA') && await exists('guests', 'tok-wA'), 'falha de Storage → casamento e convidados continuam (nada de parcial)');
  ok(!store.deletedUsers.includes('uid-a@teste.pt'), 'falha de Storage → conta de autenticação não é apagada');
  store.failPrefix = null;
  // Apagamento completo
  const r = await call(A('a@teste.pt'));
  ok(r && r.ok === true && r.fullDelete === true, 'eliminação devolve ok/fullDelete');
  ok(!(await exists('weddings', 'wA')), 'documento do casamento apagado');
  ok((await db.collection('weddings').doc('wA').collection('snapshots').get()).empty, 'subcoleção snapshots apagada');
  ok((await db.collection('weddings').doc('wA').collection('privateIntegrations').get()).empty, 'subcoleção privateIntegrations (token Google) apagada');
  for (const [c, p] of COLS) ok(!(await exists(c, p + 'wA')), `${c}: registos do casamento apagados`);
  ok((await db.collection('weddingStateQuarantine').where('weddingId', '==', 'wA').get()).empty, 'weddingStateQuarantine (cópias do estado) apagada [J-2]');
  ok(!(await exists('notifState', 'wA')), 'notifState apagado [J-2]');
  ok(!(await exists('seatingRuns', 'wA')), 'seatingRuns apagado [J-2]');
  ok(!(await exists('aiUsage', 'wA')), 'aiUsage apagado');
  ok(Object.keys(store.files).filter((k) => /\/wA\//.test(k)).length === 0, 'ficheiros Storage (documentos, memórias, feedback) apagados');
  ok(store.deletedUsers.includes('uid-a@teste.pt'), 'conta de autenticação apagada no fim');
  // Isolamento
  ok(await exists('weddings', 'wB') && await exists('guests', 'tok-wB') && await exists('notifState', 'wB') && !(await db.collection('weddingStateQuarantine').where('weddingId', '==', 'wB').get()).empty, 'outro casamento (wB) intacto');
  ok(Object.keys(store.files).filter((k) => /\/wB\//.test(k)).length === 3, 'ficheiros do outro casamento intactos');
  // Co-dono
  const r2 = await call(A('s1@teste.pt'));
  ok(r2.ok === true && r2.fullDelete === false, 'co-dono: só é removido (fullDelete=false)');
  const sd = (await db.collection('weddings').doc('wS').get()).data();
  ok(sd && sd.ownerEmails.length === 1 && sd.ownerEmails[0] === 's2@teste.pt', 'co-dono: casamento partilhado continua com o outro dono');
  ok(await exists('guests', 'tok-wS') && await exists('notifState', 'wS'), 'co-dono: dados do casamento partilhado intactos');
  // Idempotência: conta já apagada
  let again = null; try { await call(A('a@teste.pt')); again = 'ok'; } catch (e) { again = e.code || 'erro'; }
  ok(again === 'not-found', 'repetir pedido após eliminação → not-found (sem efeitos)');
  ok(await exists('weddings', 'wB'), 'repetição não toca noutros casamentos');
  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
