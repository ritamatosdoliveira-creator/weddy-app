/* K.3 consolidação — valores EFETIVOS (predefinidos) da quota de Memories, sem variáveis de ambiente.
 * Decisão aprovada: 20 por convite · 500 no QR público · 2.000 por casamento · 5 GB por casamento. */
'use strict';
const path = require('path');
for (const k of ['MEMORIES_MAX_FILES_PER_WEDDING', 'MEMORIES_MAX_MB_PER_WEDDING', 'MEMORIES_MAX_FILES_PER_INVITE', 'MEMORIES_MAX_FILES_PUBLIC_QR']) delete process.env[k];
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
const admin = require('firebase-admin'); const fns = require(path.join(__dirname, '..', '..', 'index.js')); const T = fns._test; const db = admin.firestore();
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const store = {};
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ file: (p) => ({ delete: async () => { delete store[p]; }, getMetadata: async () => [{ size: '1000', contentType: 'image/png' }] }) }) }) });
(async () => {
  const L = T.memoryQuotaLimits();
  ok(L.perInvite === 20, 'predefinição: 20 fotografias por convite');
  ok(L.publicQr === 500, 'predefinição: 500 fotografias no QR público');
  ok(L.files === 2000, 'predefinição: 2.000 fotografias por casamento');
  ok(L.bytes === 5 * 1024 * 1024 * 1024, 'predefinição: 5 GB por casamento (' + L.bytes + ' bytes)');
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  ok(/MEMORIES_MAX_FILES_PUBLIC_QR', \{ default: 500 \}/.test(src) && !/MEMORIES_MAX_FILES_PUBLIC_QR', \{ default: 300/.test(src), 'código: valor 500 no defineInt do QR (já não 300)');
  // fronteiras com os valores efetivos (QR: 500 aceita, 501.ª recusa; convite: 20 aceita, 21.ª recusa)
  let acc = 0, ref = 0, last;
  for (let i = 0; i < 20; i++) { const p = `memories/DQ1/inv/f${i}.png`; const x = await T.memoryQuotaAccount(p, 1000, 'image/png', 'object'); x.action === 'accepted' ? acc++ : ref++; }
  last = await T.memoryQuotaAccount('memories/DQ1/inv/f20.png', 1000, 'image/png', 'object');
  ok(acc === 20 && last.action === 'refused' && last.reason === 'invite_files', 'convite: 20.ª aceite, 21.ª recusada');
  // QR: 500 em paralelo + 1
  // 500 pedidos em 20 rajadas simultâneas de 25 (500 transações num só documento ao mesmo tempo esgota o emulador, não é um cenário realista)
  let okQr = 0; for (let b = 0; b < 20; b++) { const ps = []; for (let i = 0; i < 25; i++) ps.push(T.memoryQuotaAccount(`memories/DQ2/publico/p${b * 25 + i}.png`, 1000, 'image/png', 'object')); (await Promise.all(ps)).forEach((x) => { if (x.action === 'accepted') okQr++; }); }
  const extra = await T.memoryQuotaAccount('memories/DQ2/publico/p500.png', 1000, 'image/png', 'object');
  ok(okQr === 500 && extra.action === 'refused' && extra.reason === 'public_files', `QR público: ${okQr} de 500 pedidos (rajadas simultâneas de 25) aceites, a 501.ª recusada`);
  // casamento: contador semeado a 1.999 (a acumulação real até 2.000 é a mesma transação já exercida acima); a 2.000.ª entra, a 2.001.ª é recusada
  await db.collection('memoryQuota').doc('DQ3').set({ weddingId: 'DQ3', files: 1999, bytes: 1999000, perToken: {}, full: false });
  const l2000 = await T.memoryQuotaAccount('memories/DQ3/c1/f0.png', 1000, 'image/png', 'object');
  const q3a = (await db.collection('memoryQuota').doc('DQ3').get()).data();
  const over = await T.memoryQuotaAccount('memories/DQ3/c2/f0.png', 1000, 'image/png', 'object');
  ok(l2000.action === 'accepted' && q3a.files === 2000 && q3a.full === true && over.action === 'refused' && over.reason === 'wedding_files', 'casamento: a 2.000.ª foto entra (álbum passa a cheio), a 2.001.ª é recusada');
  // 5 GB: contador semeado a 5 GB − 8 MB; uma foto de 8 MB entra (= 5 GB exatos), qualquer byte a mais é recusado
  const GB5 = 5 * 1024 * 1024 * 1024, MB8 = 8 * 1024 * 1024;
  await db.collection('memoryQuota').doc('DQ4').set({ weddingId: 'DQ4', files: 639, bytes: GB5 - MB8, perToken: {}, full: false });
  const lastB = await T.memoryQuotaAccount('memories/DQ4/c1/f0.png', MB8, 'image/png', 'object');
  const overB = await T.memoryQuotaAccount('memories/DQ4/c2/f0.png', 1, 'image/png', 'object');
  ok(lastB.action === 'accepted' && (await db.collection('memoryQuota').doc('DQ4').get()).data().bytes === GB5 && overB.action === 'refused' && overB.reason === 'wedding_bytes', 'bytes: a foto que completa 5 GB exatos entra, o byte seguinte é recusado');
  ok(MB8 === 8 * 1024 * 1024 && /request.resource.size < 8 \* 1024 \* 1024/.test(require('fs').readFileSync(path.join(__dirname, '..', '..', 'storage.rules'), 'utf8')), 'tamanho por foto: 8 MB, igual às regras do Storage');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
