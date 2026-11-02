#!/usr/bin/env node
/* SÓ LEITURA. Conta casos que as novas regras do Firestore/Storage afetariam. Nunca escreve nada e
 * nunca imprime conteúdo (só contagens e até 5 ids por categoria). Usa o teu login do gcloud (ADC):
 *   GOOGLE_CLOUD_PROJECT=weddy-app-bd12f node scripts/auditar-dados-para-regras.js
 * Para testar contra o emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GCLOUD_PROJECT=demo-weddy node ... */
'use strict';
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
(async () => {
  const cats = { total: 0, jsonNaoTexto: [], jsonGrande: [], subscricaoSemValidade: [], premiumUntilNaoTimestamp: [], ativaSemSubscricao: [] };
  const snap = await db.collection('weddings').get();
  snap.forEach((d) => {
    const w = d.data(); cats.total++;
    if ('json' in w && typeof w.json !== 'string') cats.jsonNaoTexto.push(d.id);
    if (typeof w.json === 'string' && w.json.length > 900000) cats.jsonGrande.push(d.id);
    const s = w.subscription;
    if (s && s.active === true && !('premiumUntil' in s)) cats.subscricaoSemValidade.push(d.id);
    if (s && 'premiumUntil' in s && !(s.premiumUntil && typeof s.premiumUntil.toMillis === 'function')) cats.premiumUntilNaoTimestamp.push(d.id);
    if (s && typeof s !== 'object') cats.ativaSemSubscricao.push(d.id);
  });
  console.log('Casamentos lidos:', cats.total);
  for (const k of Object.keys(cats)) if (Array.isArray(cats[k])) console.log(`${k}: ${cats[k].length}${cats[k].length ? ' (ex.: ' + cats[k].slice(0, 5).join(', ') + ')' : ''}`);
  console.log('\nLeitura: jsonNaoTexto/jsonGrande > 0 = essas contas ficariam sem poder gravar; subscricaoSemValidade = contam pelo "active" até ao backfill; premiumUntilNaoTimestamp > 0 = a regra nega por erro.');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
