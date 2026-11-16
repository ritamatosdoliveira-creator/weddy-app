// K.3-G — valida a revogação de tokens com Storage REAL do projeto de teste (ficheiros fictícios). Passos 1-10 do brief.
// Pré-requisitos (feitos pela Rita): functions do projeto de teste publicadas com revokeDownloadTokensOnOwnerRemoval;
// GOOGLE_CLOUD_PROJECT=weddy-premium-teste; credenciais da Rita (ADC). Não escreve nada em produção. Sem segredos.
const admin = require('firebase-admin');
if (process.env.GOOGLE_CLOUD_PROJECT !== 'weddy-premium-teste') { console.error('ABORTADO: projeto != teste'); process.exit(2); }
admin.initializeApp({ projectId: 'weddy-premium-teste', storageBucket: 'weddy-premium-teste.firebasestorage.app' });
const db = admin.firestore(), bucket = admin.storage().bucket(); const crypto = require('crypto');
const W = 'k3-ficticio-' + Date.now().toString(36).replace(/[^a-z0-9-]/g, ''); const files = { doc: `documents/${W}/k3.pdf`, mem: `memories/${W}/publico/k3.png`, site: `sites/${W}/k3.jpg` };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');
const urlFor = async (p) => { const [m] = await bucket.file(p).getMetadata(); const t = (m.metadata || {}).firebaseStorageDownloadTokens; return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(p)}?alt=media&token=${t}`; };
const status = async (u) => (await fetch(u)).status; const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  await db.collection('weddings').doc(W).set({ ownerEmails: ['dono1@exemplo.invalid', 'dono2@exemplo.invalid'], ownerUids: ['u1', 'u2'], json: '{}', fictitious: true });
  for (const p of Object.values(files)) await bucket.file(p).save(png, { metadata: { contentType: p.endsWith('.pdf') ? 'application/pdf' : 'image/png', metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } } });
  const old = {}; for (const [k, p] of Object.entries(files)) { old[k] = await urlFor(p); ok(await status(old[k]) === 200, `URL antigo funciona (${k})`); }
  await db.collection('weddings').doc(W).update({ ownerEmails: ['dono1@exemplo.invalid'], ownerUids: ['u1'] }); // remove o co-dono
  await new Promise((r) => setTimeout(r, 25000)); // tempo para o trigger
  for (const k of Object.keys(files)) ok(await status(old[k]) === 403 || (await status(old[k])) === 404, `URL antigo deixou de funcionar (${k})`);
  for (const [k, p] of Object.entries(files)) { const [ex] = await bucket.file(p).exists(); ok(ex, `ficheiro continua a existir (${k})`); const nu = await urlFor(p); ok(await status(nu) === 200, `novo URL funciona (${k}) — o dono restante obtém-no via getDownloadURL`); }
  const led = await db.collection('downloadTokenRevocations').where('weddingId', '==', W).get(); ok(!led.empty && led.docs[0].data().status === 'done', 'registo de auditoria "done"');
  // limpeza dos dados fictícios
  for (const p of Object.values(files)) await bucket.file(p).delete({ ignoreNotFound: true }); await db.collection('weddings').doc(W).delete(); for (const d of led.docs) await d.ref.delete();
  console.log('Limpo. Falha parcial (passo 10): repetir com uma regra temporária que recuse setMetadata num ficheiro e confirmar estado "partial" — ver VALIDACAO-STORAGE-REAL.md.');
})();
