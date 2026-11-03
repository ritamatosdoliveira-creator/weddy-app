/* K.3-B — quota de fotos (Memories). Emulador Firestore + Storage SIMULADO (sem Storage real).
 * Limites pequenos via variáveis de ambiente (defineInt). Concorrência: Promise.all contra transações reais do emulador. */
'use strict';
const path = require('path');
process.env.MEMORIES_MAX_FILES_PER_WEDDING = '10'; process.env.MEMORIES_MAX_MB_PER_WEDDING = '1'; // 1 MB
process.env.MEMORIES_MAX_FILES_PER_INVITE = '3'; process.env.MEMORIES_MAX_FILES_PUBLIC_QR = '6';
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js')); const T = fns._test; const db = admin.firestore();
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const store = {}; const st = { failDelete: false };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ file: (p) => ({
  delete: async () => { if (st.failDelete) throw new Error('storage down'); delete store[p]; },
  getMetadata: async () => { if (!store[p]) throw new Error('nf'); return [{ size: String(store[p].size), contentType: store[p].ct }]; } }) }) }) });
const put = (p, size = 1000, ct = 'image/png') => { store[p] = { size, ct }; };
const qd = async (w) => (await db.collection('memoryQuota').doc(w).get()).data() || {};
const item = async (w, p) => { const s = await db.collection('memoryQuota').doc(w).collection('items').get(); return s.docs.map((d) => d.data()); };
const crypto = require('crypto'); const MAXT = 'AbCdEfGhIjKlMnOpQrStUv123456';
(async () => {
  ok(T.memoryQuotaLimits().files === 10 && T.memoryQuotaLimits().perInvite === 3, 'limites configuráveis lidos do ambiente');
  // 1. normal
  put('memories/QW1/inv1/a.png'); let r = await T.memoryQuotaAccount('memories/QW1/inv1/a.png', 1000, 'image/png', 'object');
  ok(r.action === 'accepted' && (await qd('QW1')).files === 1 && (await qd('QW1')).bytes === 1000, 'upload normal aceite e contado');
  // 2. repetição do mesmo ficheiro (doc + objeto, ou evento repetido): conta uma vez
  r = await T.memoryQuotaAccount('memories/QW1/inv1/a.png', 1000, 'image/png', 'object'); ok(r.action === 'duplicate' && (await qd('QW1')).files === 1, 'repetição do mesmo pedido/evento: contado uma só vez');
  r = await T.memoryQuotaAccount('memories/QW1/inv1/a.png', null, null, 'doc'); ok(r.action === 'duplicate' && (await qd('QW1')).files === 1 && (await qd('QW1')).bytes === 1000, 'evento do documento depois do ficheiro: sem dupla contagem');
  // 3. limite por convite
  for (const n of ['b', 'c']) { put(`memories/QW1/inv1/${n}.png`); await T.memoryQuotaAccount(`memories/QW1/inv1/${n}.png`, 1000, 'image/png', 'object'); }
  await db.collection('memories').doc('m-d').set({ weddingId: 'QW1', token: 'inv1', storagePath: 'memories/QW1/inv1/d.png' }); put('memories/QW1/inv1/d.png');
  r = await T.memoryQuotaAccount('memories/QW1/inv1/d.png', 1000, 'image/png', 'object');
  ok(r.action === 'refused' && r.reason === 'invite_files', 'limite por convite atingido → recusado (4.ª foto do mesmo convite)');
  ok(!store['memories/QW1/inv1/d.png'] && !(await db.collection('memories').doc('m-d').get()).exists, 'recusada: ficheiro e documento apagados');
  ok(store['memories/QW1/inv1/a.png'] && store['memories/QW1/inv1/b.png'], 'fotos aceites não são tocadas');
  ok((await qd('QW1')).files === 3, 'recusa não consome quota');
  // outro convite do mesmo casamento continua a poder enviar
  put('memories/QW1/inv2/a.png'); r = await T.memoryQuotaAccount('memories/QW1/inv2/a.png', 1000, 'image/png', 'object'); ok(r.action === 'accepted', 'outro convite não é afetado pelo limite do primeiro');
  // 4. isolamento entre casamentos
  put('memories/QW2/inv1/a.png'); r = await T.memoryQuotaAccount('memories/QW2/inv1/a.png', 1000, 'image/png', 'object');
  ok(r.action === 'accepted' && (await qd('QW2')).files === 1 && (await qd('QW1')).files === 4, 'casamento diferente tem contador próprio');
  // 5. QR público
  let acc = 0, ref = 0; for (let i = 0; i < 8; i++) { const p = `memories/QW3/publico/p${i}.png`; put(p); const x = await T.memoryQuotaAccount(p, 1000, 'image/png', 'object'); if (x.action === 'accepted') acc++; else if (x.reason === 'public_files') ref++; }
  ok(acc === 6 && ref === 2, 'QR público: 6 aceites, 2 recusados (limite público)');
  // 6. concorrência: 40 pedidos em paralelo, limite do casamento = 10
  const ps = []; for (let i = 0; i < 40; i++) { const p = `memories/QW4/c${i % 20}/f${i}.png`; put(p, 100); ps.push(T.memoryQuotaAccount(p, 100, 'image/png', 'object')); }
  const rs = await Promise.all(ps); const accepted = rs.filter((x) => x.action === 'accepted').length;
  const q4 = await qd('QW4'); ok(accepted === 10 && q4.files === 10 && q4.full === true, `concorrência: exatamente 10 de 40 aceites (aceites=${accepted}, contador=${q4.files}) e álbum marcado como cheio`);
  const left = Object.keys(store).filter((k) => k.startsWith('memories/QW4/')).length; ok(left === 10, 'concorrência: só 10 ficheiros ficam no Storage (excedente apagado)');
  // concorrência: mesmo ficheiro 15× → 1 contagem
  put('memories/QW5/inv1/x.png'); const same = await Promise.all(Array.from({ length: 15 }, () => T.memoryQuotaAccount('memories/QW5/inv1/x.png', 1000, 'image/png', 'object')));
  ok(same.filter((x) => x.action === 'accepted').length === 1 && (await qd('QW5')).files === 1, 'concorrência: mesmo ficheiro enviado 15× conta uma vez');
  // 7. tamanho / tipo / bytes
  put('memories/QW6/i/big.png', 9 * 1048576); r = await T.memoryQuotaAccount('memories/QW6/i/big.png', 9 * 1048576, 'image/png', 'object'); ok(r.reason === 'invalid_file' && !store['memories/QW6/i/big.png'], 'tamanho > 8 MB recusado e apagado');
  put('memories/QW6/i/x.svg', 100, 'image/svg+xml'); r = await T.memoryQuotaAccount('memories/QW6/i/x.svg', 100, 'image/svg+xml', 'object'); ok(r.reason === 'invalid_file' && !store['memories/QW6/i/x.svg'], 'tipo inválido (SVG) recusado e apagado');
  put('memories/QW6/i/a.png', 700000); await T.memoryQuotaAccount('memories/QW6/i/a.png', 700000, 'image/png', 'object'); put('memories/QW6/i/b.png', 700000);
  r = await T.memoryQuotaAccount('memories/QW6/i/b.png', 700000, 'image/png', 'object'); ok(r.reason === 'wedding_bytes', 'limite de bytes do casamento (1 MB) respeitado ' + JSON.stringify(r) + JSON.stringify(await qd('QW6')));
  // doc primeiro, bytes depois
  await db.collection('memories').doc('m-e').set({ weddingId: 'QW7', token: 'publico', storagePath: 'memories/QW7/publico/e.png' }); put('memories/QW7/publico/e.png', 500);
  r = await T.memoryQuotaAccount('memories/QW7/publico/e.png', null, null, 'doc'); ok(r.action === 'accepted', 'evento do documento primeiro: aceite sem tamanho');
  r = await T.memoryQuotaAccount('memories/QW7/publico/e.png', 500, 'image/png', 'object'); ok((await qd('QW7')).bytes === 500 && (await qd('QW7')).files === 1, 'evento do ficheiro a seguir completa os bytes sem contar duas vezes');
  // 8. caminhos que não são de memórias ou sem forma válida
  r = await T.memoryQuotaAccount('documents/QW1/a.pdf', 10, 'application/pdf', 'object'); ok(r.action === 'ignore', 'fora de memories/: ignorado');
  r = await T.memoryQuotaAccount('memories/QW1/a.png', 10, 'image/png', 'object'); ok(r.action === 'ignore', 'caminho sem pasta de token: ignorado');
  r = await T.memoryQuotaAccount('memories/QW1/../QW2/x/a.png', 10, 'image/png', 'object'); ok(r.action === 'ignore', 'traversal no caminho: ignorado');
  // 9. registo de recusas sem tokens completos
  put(`memories/QW8/${MAXT}/1.png`); for (let i = 0; i < 4; i++) { put(`memories/QW8/${MAXT}/${i}.png`); await T.memoryQuotaAccount(`memories/QW8/${MAXT}/${i}.png`, 1000, 'image/png', 'object'); }
  const dump = JSON.stringify([await qd('QW8'), await item('QW8')]); ok(!dump.includes(MAXT) && !dump.includes('AbCdEf'), 'contador e registos não contêm o token completo');
  const refusedItems = (await item('QW8')).filter((x) => x.status === 'refused'); ok(refusedItems.length === 1 && refusedItems[0].expireAt && refusedItems[0].reason === 'invite_files', 'recusa registada com motivo e validade de 90 dias');
  // 10. falha parcial: Storage indisponível durante a limpeza — o registo fica e não rebenta
  st.failDelete = true; put('memories/QW8/zzz/9.png'); for (let i = 0; i < 3; i++) { put(`memories/QW8/zzz/${i}.png`); await T.memoryQuotaAccount(`memories/QW8/zzz/${i}.png`, 1000, 'image/png', 'object'); }
  put('memories/QW8/zzz/extra.png'); r = await T.memoryQuotaAccount('memories/QW8/zzz/extra.png', 1000, 'image/png', 'object');
  ok(r.action === 'refused' && store['memories/QW8/zzz/extra.png'], 'falha do Storage na limpeza: recusa registada, sem exceção (ficheiro fica para nova tentativa)');
  st.failDelete = false; r = await T.memoryQuotaAccount('memories/QW8/zzz/extra.png', 1000, 'image/png', 'object'); ok(r.action === 'refused' && !store['memories/QW8/zzz/extra.png'], 'repetição do evento conclui a limpeza (idempotente)');
  // 11. libertação ao apagar
  const before = (await qd('QW1')).files; r = await T.memoryQuotaRelease('memories/QW1/inv1/a.png'); const afterQ = await qd('QW1');
  ok(r.action === 'released' && afterQ.files === before - 1, 'apagar uma foto liberta a quota');
  r = await T.memoryQuotaRelease('memories/QW1/inv1/a.png'); ok(r.action === 'none' && (await qd('QW1')).files === before - 1, 'libertar duas vezes não desconta duas');
  r = await T.memoryQuotaRelease('memories/QW8/zzz/extra.png'); ok(r.action === 'kept_refused', 'apagar uma foto recusada não liberta quota');
  // álbum cheio volta a abrir
  const full4 = (await qd('QW4')).full; await T.memoryQuotaRelease(Object.keys(store).find((k) => k.startsWith('memories/QW4/'))); ok(full4 === true && (await qd('QW4')).full === false, 'álbum cheio volta a aceitar depois de apagar uma foto');
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  ok(/memoryQuota'\)\.doc\(weddingId\)/.test(src) && /items'\)\.get\(\)/.test(src), 'eliminação de conta apaga o contador e os registos');
  ok(['memoryQuotaOnDocCreated', 'memoryQuotaOnObjectFinalized', 'memoryQuotaOnDocDeleted', 'memoryQuotaOnObjectDeleted'].every((n) => fns[n] && fns[n].__endpoint), 'quatro triggers exportados');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
