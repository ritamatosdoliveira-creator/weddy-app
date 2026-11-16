// K.3-D — semeia registos FICTÍCIOS no projeto de teste para provar o TTL. Requer: GOOGLE_CLOUD_PROJECT=weddy-premium-teste
// e credenciais da própria Rita (gcloud auth application-default login). Não contém segredos.
const admin = require('firebase-admin');
if (process.env.GOOGLE_CLOUD_PROJECT !== 'weddy-premium-teste') { console.error('ABORTADO: projeto != teste'); process.exit(2); }
admin.initializeApp({ projectId: 'weddy-premium-teste' });
const db = admin.firestore(); const D = 86400000; const ts = (ms) => admin.firestore.Timestamp.fromMillis(Date.now() + ms);
(async () => {
  const base = { type: 'k3_ttl_teste', weddingId: 'FICTICIO', at: admin.firestore.FieldValue.serverTimestamp() };
  await db.collection('_incident_log').doc('k3-ttl-futuro').set({ ...base, expireAt: ts(90 * D) });
  await db.collection('_incident_log').doc('k3-ttl-passado').set({ ...base, expireAt: ts(-2 * D) });
  await db.collection('_incident_log').doc('k3-ttl-sem-expireAt').set({ ...base });
  await db.collection('_incident_log').doc('k3-ttl-financeiro').set({ type: 'stripeWebhook', reason: 'teste', weddingId: 'FICTICIO' });
  await db.collection('stripePayments').doc('pi_k3_ttl_teste').set({ weddingId: 'FICTICIO', amount: 3000, status: 'paid' });
  console.log('Semeado. Ativar o TTL e verificar passadas ~24-72h: só "k3-ttl-passado" deve desaparecer.');
})();
