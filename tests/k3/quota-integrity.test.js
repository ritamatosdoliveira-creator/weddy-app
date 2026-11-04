/* K.3 pós-auditoria (P1 + P3) — integridade da quota de fotos. Emulador Firestore + Storage SIMULADO (mock em memória: NÃO valida o
 * comportamento do Storage real nem os triggers Eventarc reais; chama diretamente as funções de servidor que os triggers executam). */
'use strict';
const path = require('path');
process.env.MEMORIES_MAX_FILES_PER_WEDDING = '10'; process.env.MEMORIES_MAX_MB_PER_WEDDING = '1';
process.env.MEMORIES_MAX_FILES_PER_INVITE = '3'; process.env.MEMORIES_MAX_FILES_PUBLIC_QR = '6';
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js')); const T = fns._test; const db = admin.firestore();
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const store = {}; const st = { failDelete: false, metaErr: null };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ file: (p) => ({
  delete: async () => { if (st.failDelete) throw new Error('storage down'); delete store[p]; },
  getMetadata: async () => { if (st.metaErr) { const e = new Error('unavailable'); e.code = st.metaErr; throw e; } if (!store[p]) { const e = new Error('No such object'); e.code = 404; throw e; } return [{ size: String(store[p].size), contentType: store[p].ct }]; } }) }) }) });
const put = (p, size = 1000, ct = 'image/png') => { store[p] = { size, ct }; };
const qd = async (w) => (await db.collection('memoryQuota').doc(w).get()).data() || {};
const items = async (w) => (await db.collection('memoryQuota').doc(w).collection('items').get()).docs.map((d) => d.data());
const exists = async (col, id) => (await db.collection(col).doc(id).get()).exists;
const mem = async (id, w, t, f) => { await db.collection('memories').doc(id).set({ weddingId: w, token: t, storagePath: `memories/${w}/${t}/${f}`, guestName: 'x' }); return (await db.collection('memories').doc(id).get()).data(); };
(async () => {
  // 1. Documento sem ficheiro nunca conta
  let d = await mem('i-1', 'QI1', 'publico', 'fake.png');
  let r = await T.memoryQuotaHandleDoc('i-1', d);
  ok(r.action === 'pending' && ((await qd('QI1')).files || 0) === 0 && (await items('QI1')).length === 0, '1. documento sem ficheiro: não cria item nem incrementa a quota');
  ok(await exists('memoryQuotaPending', 'i-1'), '1b. fica pendente para reconciliação (prazo)');
  // 2. Muitos documentos falsos não consomem a quota legítima (limite do casamento = 10; QR = 6)
  for (let i = 0; i < 25; i++) { const dd = await mem('i-f' + i, 'QI1', 'publico', `fk${i}.png`); await T.memoryQuotaHandleDoc('i-f' + i, dd); }
  const qf = await qd('QI1'); ok((qf.files || 0) === 0 && qf.full !== true, '2. 25 documentos falsos (> limites): contador a 0 e álbum NÃO fica cheio');
  put('memories/QI1/publico/real.png'); d = await mem('i-real', 'QI1', 'publico', 'real.png'); r = await T.memoryQuotaHandleDoc('i-real', d);
  ok(r.action === 'accepted' && (await qd('QI1')).files === 1 && (await qd('QI1')).bytes === 1000, '2b. upload legítimo seguinte é aceite com o tamanho real');
  // 3. token do documento ≠ token do caminho → apagado, ficheiro e quota intactos
  put('memories/QI3/invA/x.png'); await T.memoryQuotaAccount('memories/QI3/invA/x.png', 1000, 'image/png', 'object');
  const before = await qd('QI3');
  const bad = { weddingId: 'QI3', token: 'invB', storagePath: 'memories/QI3/invA/x.png', guestName: 'x' }; await db.collection('memories').doc('i-bad').set(bad);
  r = await T.memoryQuotaHandleDoc('i-bad', bad);
  const after = await qd('QI3');
  ok(r.action === 'incoherent_deleted' && !(await exists('memories', 'i-bad')) && store['memories/QI3/invA/x.png'], '3. token diferente do caminho: documento apagado, ficheiro do outro convite intocado');
  ok(after.files === before.files && JSON.stringify(after.perToken) === JSON.stringify(before.perToken) && Object.keys(after.perToken).length === 1, '3b. quota do outro convite e do próprio inalteradas (nada atribuído ao token falso)');
  r = await T.memoryQuotaHandleDocDeleted('i-bad', bad); ok(r.action === 'ignore_incoherent' && (await qd('QI3')).files === 1, '3c. apagar o documento incoerente NÃO liberta a quota do ficheiro legítimo');
  // 4. weddingId divergente
  put('memories/QI4a/publico/y.png'); await T.memoryQuotaAccount('memories/QI4a/publico/y.png', 1000, 'image/png', 'object');
  const bad2 = { weddingId: 'QI4b', token: 'publico', storagePath: 'memories/QI4a/publico/y.png', guestName: 'x' }; await db.collection('memories').doc('i-bad2').set(bad2);
  r = await T.memoryQuotaHandleDoc('i-bad2', bad2);
  ok(r.action === 'incoherent_deleted' && ((await qd('QI4b')).files || 0) === 0 && (await qd('QI4a')).files === 1 && store['memories/QI4a/publico/y.png'], '4. weddingId divergente: nada contado em nenhum casamento e ficheiro intacto');
  // 5. ordens diferentes
  put('memories/QI5/publico/o1.png', 700); await T.memoryQuotaAccount('memories/QI5/publico/o1.png', 700, 'image/png', 'object');
  d = await mem('i-o1', 'QI5', 'publico', 'o1.png'); r = await T.memoryQuotaHandleDoc('i-o1', d);
  ok(r.action === 'duplicate' && (await qd('QI5')).files === 1 && (await qd('QI5')).bytes === 700, '5a. objeto primeiro, documento depois: contado uma vez');
  put('memories/QI5/publico/o2.png', 300); d = await mem('i-o2', 'QI5', 'publico', 'o2.png'); r = await T.memoryQuotaHandleDoc('i-o2', d);
  ok(r.action === 'accepted' && (await qd('QI5')).files === 2 && (await qd('QI5')).bytes === 1000, '5b. documento primeiro com o ficheiro já visível: conta com o tamanho real');
  r = await T.memoryQuotaAccount('memories/QI5/publico/o2.png', 300, 'image/png', 'object'); ok(r.action === 'duplicate' && (await qd('QI5')).files === 2, '5c. evento do objeto a seguir: duplicado, sem dupla contagem');
  d = await mem('i-o3', 'QI5', 'publico', 'o3.png'); r = await T.memoryQuotaHandleDoc('i-o3', d); ok(r.action === 'pending' && (await qd('QI5')).files === 2, '5d. documento primeiro, ficheiro ainda inexistente: pendente');
  put('memories/QI5/publico/o3.png', 10); r = await T.memoryQuotaAccount('memories/QI5/publico/o3.png', 10, 'image/png', 'object'); ok(r.action === 'accepted' && (await qd('QI5')).files === 3, '5e. o ficheiro chega depois: conta uma vez');
  const rc = await T.memoryQuotaReconcile(Date.now() + 2 * 3600 * 1000);
  ok((await qd('QI5')).files === 3 && (await exists('memories', 'i-o3')) && !(await exists('memoryQuotaPending', 'i-o3')), '5f. reconciliação com o ficheiro já presente: documento mantido, sem dupla contagem, pendente removido ' + JSON.stringify(rc));
  // 6. eventos duplicados em paralelo
  put('memories/QI6/inv1/z.png'); d = await mem('i-z', 'QI6', 'inv1', 'z.png');
  const rs = await Promise.all(Array.from({ length: 12 }, () => T.memoryQuotaHandleDoc('i-z', d)));
  ok(rs.filter((x) => x.action === 'accepted').length === 1 && (await qd('QI6')).files === 1 && (await qd('QI6')).perToken && Object.values((await qd('QI6')).perToken)[0] === 1, '6. 12 eventos do mesmo documento em paralelo: contado uma vez');
  // 7. falha de limpeza seguida de recuperação
  for (let i = 0; i < 3; i++) { put(`memories/QI7/inv1/${i}.png`); await T.memoryQuotaAccount(`memories/QI7/inv1/${i}.png`, 1000, 'image/png', 'object'); }
  put('memories/QI7/inv1/over.png'); d = await mem('i-over', 'QI7', 'inv1', 'over.png');
  st.failDelete = true; const qkey = async () => (await db.collection('memoryQuotaCleanupQueue').where('weddingId', '==', 'QI7').get()).docs;
  let thrown = 0; for (let i = 0; i < 4; i++) { try { await T.memoryQuotaHandleDoc('i-over', d); } catch (e) { thrown++; } }
  let qs = await qkey();
  ok(thrown === 4 && qs.length === 1 && qs[0].data().attempts === 4 && /storage/.test(qs[0].data().lastError || '') && store['memories/QI7/inv1/over.png'], '7a. falha repetida: erro sobe (retry), fila regista tentativas e último erro, ficheiro mantido');
  ok((await qd('QI7')).files === 3 && (await qd('QI7')).refused === 1 && (await items('QI7')).filter((x) => x.status === 'refused').length === 1, '7b. quota não é libertada nem a recusa duplicada pelas repetições');
  let stopped = true; try { await T.memoryQuotaHandleDoc('i-over', d); } catch (e) { stopped = false; }
  qs = await qkey(); ok(stopped && qs[0].data().attempts === 5, '7c. ao atingir o limite de tentativas do trigger deixa de lançar erro (sem loop infinito)');
  st.failDelete = false; const rc2 = await T.memoryQuotaReconcile();
  qs = await qkey(); ok(rc2.cleaned === 1 && qs.length === 0 && !store['memories/QI7/inv1/over.png'] && !(await exists('memories', 'i-over')), '7d. reconciliação conclui a limpeza (ficheiro e documento apagados, fila removida) ' + JSON.stringify(rc2));
  ok((await qd('QI7')).files === 3 && (await T.memoryQuotaReconcile()).cleaned === 0, '7e. quota continua a 3; nova reconciliação é inofensiva (idempotente)');
  // 8. reenvio do mesmo evento depois de recuperação não volta a contar nem a falhar
  r = await T.memoryQuotaAccount('memories/QI7/inv1/over.png', 1000, 'image/png', 'object'); ok(r.action === 'refused' && (await qd('QI7')).files === 3 && (await qd('QI7')).refused === 1, '8. reenvio do evento do ficheiro já recusado: continua recusado, sem alterar contadores');
  // 9. giveUp
  put('memories/QI9/inv1/g0.png'); for (let i = 0; i < 3; i++) { put(`memories/QI9/inv1/a${i}.png`); await T.memoryQuotaAccount(`memories/QI9/inv1/a${i}.png`, 1000, 'image/png', 'object'); }
  st.failDelete = true; try { await T.memoryQuotaAccount('memories/QI9/inv1/g0.png', 1000, 'image/png', 'object'); } catch (e) { /* esperado */ }
  const k9 = (await db.collection('memoryQuotaCleanupQueue').where('weddingId', '==', 'QI9').get()).docs[0]; await k9.ref.update({ attempts: 19 });
  const rc3 = await T.memoryQuotaReconcile(); const k9b = (await k9.ref.get()).data();
  ok(rc3.gaveUp === 1 && k9b.giveUp === true && k9b.attempts === 20, '9a. após 20 tentativas marca giveUp (erro registado para intervenção manual)');
  const rc4 = await T.memoryQuotaReconcile(); ok(rc4.cleaned === 0 && rc4.cleanupFailed === 0, '9b. entradas giveUp deixam de ser processadas (sem loop)'); st.failDelete = false;
  // 10. reconciliação apaga documentos sem ficheiro só depois do prazo
  d = await mem('i-late', 'QI10', 'publico', 'late.png'); await T.memoryQuotaHandleDoc('i-late', d);
  let rc5 = await T.memoryQuotaReconcile(Date.now()); ok(rc5.docsDeleted === 0 && (await exists('memories', 'i-late')), '10a. dentro do prazo o documento sem ficheiro é mantido');
  rc5 = await T.memoryQuotaReconcile(Date.now() + 2 * 3600 * 1000); ok(rc5.docsDeleted === 1 && !(await exists('memories', 'i-late')) && !(await exists('memoryQuotaPending', 'i-late')) && ((await qd('QI10')).files || 0) === 0, '10b. depois do prazo o documento sem ficheiro é apagado, sem tocar na quota');
  // 11. erro transitório do Storage no evento do documento: repete (não trata como "sem ficheiro")
  put('memories/QI11/publico/t.png'); d = await mem('i-t', 'QI11', 'publico', 't.png'); st.metaErr = 503; let tr = false; try { await T.memoryQuotaHandleDoc('i-t', d); } catch (e) { tr = true; } st.metaErr = null;
  ok(tr && ((await qd('QI11')).files || 0) === 0 && !(await exists('memoryQuotaPending', 'i-t')), '11a. erro transitório de metadados: sobe para o retry, nada contado nem marcado como pendente');
  r = await T.memoryQuotaHandleDoc('i-t', d); ok(r.action === 'accepted' && (await qd('QI11')).files === 1, '11b. na repetição conta uma vez');
  // 12. apagar documento legítimo continua a libertar a quota
  r = await T.memoryQuotaHandleDocDeleted('i-t', d); ok(r.action === 'released' && (await qd('QI11')).files === 0, '12. apagar documento coerente liberta a quota (comportamento anterior preservado)');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
