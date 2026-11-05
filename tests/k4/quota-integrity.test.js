/* K.4 — integridade 1:1 documento↔objeto, libertação pelo objeto, marcadores terminais, casamento eliminado, reconciliação robusta,
 * sanitização e inundação. Emulador Firestore + Storage SIMULADO (mock em memória): NÃO valida o Storage real, o Eventarc nem o Cloud
 * Scheduler; chama diretamente as funções de servidor que os triggers executam. */
'use strict';
const path = require('path');
process.env.MEMORIES_MAX_FILES_PER_WEDDING = '10'; process.env.MEMORIES_MAX_MB_PER_WEDDING = '1';
process.env.MEMORIES_MAX_FILES_PER_INVITE = '3'; process.env.MEMORIES_MAX_FILES_PUBLIC_QR = '6';
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js')); const T = fns._test; const db = admin.firestore();
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── Storage simulado ──
const store = {}; const st = { deleteErr: null, metaErrPaths: {} };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ file: (p) => ({
  delete: async () => { if (st.deleteErr) throw st.deleteErr; delete store[p]; },
  getMetadata: async () => { if (st.metaErrPaths[p]) { const e = new Error('unavailable'); e.code = st.metaErrPaths[p]; throw e; } if (!store[p]) { const e = new Error('No such object'); e.code = 404; throw e; } return [{ size: String(store[p].size), contentType: store[p].ct }]; } }) }) }) });
const put = (p, size = 1000, ct = 'image/png') => { store[p] = { size, ct }; };
const mkErr = (code, message = 'storage down') => { const e = new Error(message); if (code !== undefined) e.code = code; return e; };
// ── Captura de logs (para provar que nada privado é escrito) ──
let logBuf = ''; const ow = process.stdout.write.bind(process.stdout), oe = process.stderr.write.bind(process.stderr);
process.stdout.write = (c, ...a) => { logBuf += String(c); return ow(c, ...a); }; process.stderr.write = (c, ...a) => { logBuf += String(c); return oe(c, ...a); };
// ── Contagem de transações (prova da pré-leitura) ──
let txCount = 0; const origTx = db.runTransaction.bind(db); db.runTransaction = (...a) => { txCount++; return origTx(...a); };
// ── Auxiliares ──
const qd = async (w) => (await db.collection('memoryQuota').doc(w).get()).data() || {};
const item = async (p) => { const m = /^memories\/([^/]+)\//.exec(p); const s = await db.collection('memoryQuota').doc(m[1]).collection('items').doc(require('crypto').createHash('sha256').update(p).digest('hex').slice(0, 40)).get(); return s.exists ? s.data() : null; };
const qhash = (p) => require('crypto').createHash('sha256').update(p).digest('hex').slice(0, 40);
const exists = async (col, id) => (await db.collection(col).doc(id).get()).exists;
const mkdoc = async (id, w, t, f) => { const d = { weddingId: w, token: t, storagePath: `memories/${w}/${t}/${f}`, guestName: 'x' }; await db.collection('memories').doc(id).set(d); return d; };
const seedQueue = async (p, extra = {}) => { const m = memPath(p); await db.collection('memoryQuotaCleanupQueue').doc(qhash(p)).set({ kind: 'refused', weddingId: m.w, path: p, reason: 'x', attempts: 0, giveUp: false, ...extra }); };
const memPath = (p) => { const m = /^memories\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(p); return { w: m[1], t: m[2] }; };
const seedRefused = async (p, extra) => { await db.collection('memoryQuota').doc(memPath(p).w).collection('items').doc(qhash(p)).set({ status: 'refused', reason: 'invite_files', tokenKey: 'x', bytes: 10 }); await seedQueue(p, extra); put(p); };
(async () => {
  let r, d;
  // ═════ Integridade 1:1 (1–8) ═════
  put('memories/K1/inv1/a.png'); d = await mkdoc('k1', 'K1', 'inv1', 'a.png');
  r = await T.memoryQuotaAccount('memories/K1/inv1/a.png', 1000, 'image/png', 'object');
  r = await T.memoryQuotaHandleDoc('k1', d); let it = await item('memories/K1/inv1/a.png');
  ok(r.action === 'duplicate' && r.claimed && it.ownerMemoryId === 'k1' && (await qd('K1')).files === 1, '1a. objeto primeiro, documento depois: o documento torna-se dono e conta-se uma vez');
  put('memories/K1/inv1/b.png'); d = await mkdoc('k1b', 'K1', 'inv1', 'b.png'); r = await T.memoryQuotaHandleDoc('k1b', d);
  ok(r.action === 'accepted' && (await item('memories/K1/inv1/b.png')).ownerMemoryId === 'k1b', '1b. documento primeiro (ficheiro visível): aceite com dono');
  r = await T.memoryQuotaAccount('memories/K1/inv1/b.png', 1000, 'image/png', 'object'); ok(r.action === 'duplicate' && (await qd('K1')).files === 2, '1c. evento do objeto a seguir: duplicado');
  put('memories/K1/inv1/nodoc.png');
  r = await T.memoryQuotaAccount('memories/K1/inv1/nodoc.png', 1000, 'image/png', 'doc', 'ghost'); ok(r.action === 'doc_gone' && !(await item('memories/K1/inv1/nodoc.png')), '1d. documento que já não existe não reclama nem conta');
  put('memories/K2/inv1/a.png'); const d2a = await mkdoc('k2a', 'K2', 'inv1', 'a.png'); const d2b = await mkdoc('k2b', 'K2', 'inv1', 'a.png');
  r = await T.memoryQuotaHandleDoc('k2a', d2a); const r2 = await T.memoryQuotaHandleDoc('k2b', d2b);
  ok(r.action === 'accepted' && r2.action === 'duplicate_doc_deleted' && (await exists('memories', 'k2a')) && !(await exists('memories', 'k2b')) && (await qd('K2')).files === 1, '2a. dois documentos para o mesmo caminho: só o primeiro é dono; o segundo é removido; conta uma vez');
  put('memories/K2/inv1/r.png'); const dra = await mkdoc('k2ra', 'K2', 'inv1', 'r.png'), drb = await mkdoc('k2rb', 'K2', 'inv1', 'r.png');
  await Promise.all([T.memoryQuotaHandleDoc('k2ra', dra), T.memoryQuotaHandleDoc('k2rb', drb)]);
  const both = [await exists('memories', 'k2ra'), await exists('memories', 'k2rb')].filter(Boolean).length; const own = (await item('memories/K2/inv1/r.png')).ownerMemoryId;
  ok(both === 1 && (own === 'k2ra' || own === 'k2rb') && (await exists('memories', own)) && (await qd('K2')).files === 2, '2b. dois documentos em simultâneo: exatamente um dono e um documento sobrevive');
  r = await T.memoryQuotaHandleDocDeleted('k2b', d2b);
  ok(r.action === 'not_owner' && store['memories/K2/inv1/a.png'] && (await qd('K2')).files === 2 && (await item('memories/K2/inv1/a.png')).status === 'accepted', '3. apagar o documento NÃO dono: não liberta, o objeto fica');
  await db.collection('memories').doc('k2a').delete(); r = await T.memoryQuotaHandleDocDeleted('k2a', d2a);
  ok(r.action === 'released' && !store['memories/K2/inv1/a.png'] && (await qd('K2')).files === 1 && (await item('memories/K2/inv1/a.png')).status === 'released', '4. apagar o documento dono: o servidor apaga o objeto, confirma e liberta (marcador terminal)');
  // 5/6 falha de Storage e retry
  put('memories/K5/inv1/a.png'); const d5 = await mkdoc('k5', 'K5', 'inv1', 'a.png'); await T.memoryQuotaHandleDoc('k5', d5); await db.collection('memories').doc('k5').delete();
  st.deleteErr = mkErr(503); let thrown = null; try { await T.memoryQuotaHandleDocDeleted('k5', d5); } catch (e) { thrown = e; }
  const qe = (await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/K5/inv1/a.png')).get()).data();
  ok(thrown && store['memories/K5/inv1/a.png'] && (await qd('K5')).files === 1 && (await item('memories/K5/inv1/a.png')).status === 'accepted' && qe && qe.kind === 'owner_delete' && qe.attempts === 1, '5. falha de Storage ao apagar: NÃO liberta, mantém o dono, regista fila e o erro sobe (retry)');
  st.deleteErr = null; r = await T.memoryQuotaHandleDocDeleted('k5', d5);
  ok(r.action === 'released' && !store['memories/K5/inv1/a.png'] && (await qd('K5')).files === 0 && !(await exists('memoryQuotaCleanupQueue', qhash('memories/K5/inv1/a.png'))), '6. retry depois da falha: apaga, liberta e remove a entrada da fila');
  put('memories/K7/inv1/a.png'); const d7 = await mkdoc('k7', 'K7', 'inv1', 'a.png'); await T.memoryQuotaHandleDoc('k7', d7); delete store['memories/K7/inv1/a.png']; await db.collection('memories').doc('k7').delete();
  r = await T.memoryQuotaHandleDocDeleted('k7', d7); ok(r.action === 'released' && (await qd('K7')).files === 0, '7. objeto já inexistente (not-found): trata-se como apagado e liberta');
  put('memories/K8/inv1/a.png'); const d8 = await mkdoc('k8', 'K8', 'inv1', 'a.png'); delete store['memories/K8/inv1/a.png'];
  r = await T.memoryQuotaRelease('memories/K8/inv1/a.png'); const late = await T.memoryQuotaAccount('memories/K8/inv1/a.png', 1000, 'image/png', 'object'); const rd = await T.memoryQuotaHandleDoc('k8', d8);
  ok(r.action === 'tombstoned' && late.action === 'released_ignored' && rd.action === 'pending' && ((await qd('K8')).files || 0) === 0, '8. objeto apagado com o evento de criação ainda por processar: o evento tardio não conta e o documento fica pendente');
  // ═════ Eventos tardios (9–13) ═════
  r = await T.memoryQuotaAccount('memories/K2/inv1/a.png', 1000, 'image/png', 'object');
  ok(r.action === 'released_ignored' && (await qd('K2')).files === 1 && (await item('memories/K2/inv1/a.png')).status === 'released', '9. onObjectFinalized depois da libertação: não volta a contar');
  put('memories/K9/inv1/n.png'); const rs = await Promise.all(Array.from({ length: 8 }, () => T.memoryQuotaAccount('memories/K9/inv1/n.png', 1000, 'image/png', 'object')));
  ok(rs.filter((x) => x.action === 'accepted').length === 1 && (await qd('K9')).files === 1, '10. evento de criação duplicado (8 em paralelo): conta uma vez');
  delete store['memories/K9/inv1/n.png']; const rl = await Promise.all(Array.from({ length: 8 }, () => T.memoryQuotaRelease('memories/K9/inv1/n.png')));
  ok(rl.filter((x) => x.action === 'released').length === 1 && (await qd('K9')).files === 0, '11. evento de eliminação duplicado (8 em paralelo): liberta uma vez');
  ok((await T.memoryQuotaAccount('memories/K9/inv1/n.png', 1000, 'image/png', 'object')).action === 'released_ignored' && (await qd('K9')).files === 0, '12. criação processada depois da eliminação (fora de ordem): resultado final igual (0)');
  txCount = 0; for (let i = 0; i < 6; i++) { await T.memoryQuotaAccount('memories/K9/inv1/n.png', 1000, 'image/png', 'object'); await T.memoryQuotaRelease('memories/K9/inv1/n.png'); }
  ok(txCount === 0 && (await qd('K9')).files === 0 && (await item('memories/K9/inv1/n.png')).status === 'released', '13. repetição após marcador terminal: sem alterações e sem transações (pré-leitura) ');
  txCount = 0; put('memories/K13/inv1/a.png'); await T.memoryQuotaAccount('memories/K13/inv1/a.png', 1000, 'image/png', 'object'); const tx1 = txCount; txCount = 0;
  for (let i = 0; i < 6; i++) await T.memoryQuotaAccount('memories/K13/inv1/a.png', 1000, 'image/png', 'object');
  ok(tx1 >= 1 && txCount === 0 && (await qd('K13')).files === 1, '13b. duplicados de um item já aceite não abrem transação sobre o contador (G) e não alteram o resultado');
  // ═════ Casamento eliminado (14–18) ═════
  put('memories/K14/inv1/a.png'); await T.memoryQuotaAccount('memories/K14/inv1/a.png', 1000, 'image/png', 'object');
  await db.collection('memoryQuotaPending').doc('p14').set({ weddingId: 'K14', memoryId: 'm14', due: admin.firestore.Timestamp.fromMillis(Date.now() - 1000), attempts: 0, giveUp: false });
  await T.memoryQuotaPurgeWedding('K14'); const mk = await qd('K14');
  ok(mk.deleted === true && mk.files === undefined && (await db.collection('memoryQuota').doc('K14').collection('items').get()).empty, '14a. eliminação: o contador passa a marcador e os itens desaparecem');
  put('memories/K14/inv1/b.png'); r = await T.memoryQuotaAccount('memories/K14/inv1/b.png', 1000, 'image/png', 'object');
  ok(r.action === 'wedding_deleted' && !(await item('memories/K14/inv1/b.png')) && (await qd('K14')).files === undefined, '14. evento de objeto depois da eliminação: nada é recriado');
  const d14 = await mkdoc('k14', 'K14', 'inv1', 'b.png'); r = await T.memoryQuotaHandleDoc('k14', d14);
  ok(r.action === 'wedding_deleted' && !(await exists('memoryQuotaPending', 'k14')), '15. evento de documento depois da eliminação: sem pendente nem item');
  st.deleteErr = mkErr(503); let cr; try { cr = await T.memoryQuotaOwnerDelete('K14', 'memories/K14/inv1/b.png', 'k14'); } catch (e) { cr = { err: true }; } st.deleteErr = null;
  ok(!cr.err && !(await exists('memoryQuotaCleanupQueue', qhash('memories/K14/inv1/b.png'))), '16. retry de limpeza depois da eliminação (mesmo com Storage em falha): não recria a fila');
  await db.collection('memoryQuotaCleanupQueue').doc('q14').set({ kind: 'refused', weddingId: 'K14', path: 'memories/K14/inv1/c.png', attempts: 0, giveUp: false });
  await db.collection('memoryQuotaPending').doc('p14b').set({ weddingId: 'K14', memoryId: 'm14b', due: admin.firestore.Timestamp.fromMillis(Date.now() - 1000), attempts: 0, giveUp: false });
  const rc = await T.memoryQuotaReconcile();
  ok(rc.stale >= 3 && !(await exists('memoryQuotaCleanupQueue', 'q14')) && !(await exists('memoryQuotaPending', 'p14')) && !(await exists('memoryQuotaPending', 'p14b')), '17. reconciliação depois da eliminação: descarta as entradas desse casamento ' + JSON.stringify(rc));
  r = await T.memoryQuotaRelease('memories/K14/inv1/b.png'); delete store['memories/K14/inv1/b.png']; r = await T.memoryQuotaRelease('memories/K14/inv1/b.png');
  const fin = await qd('K14');
  ok(r.action === 'wedding_deleted' && Object.keys(fin).sort().join() === 'deleted,deletedAt,expireAt,weddingId' && (await db.collection('memoryQuota').doc('K14').collection('items').get()).empty && (await db.collection('memoryQuotaPending').where('weddingId', '==', 'K14').get()).empty && (await db.collection('memoryQuotaCleanupQueue').where('weddingId', '==', 'K14').get()).empty, '18. nenhuma estrutura de quota é recriada (só o marcador)');
  // ═════ Reconciliação (19–26) ═════
  const cw = 'K19'; for (let i = 0; i < 3; i++) await seedRefused(`memories/${cw}/inv1/f${i}.png`);
  await db.collection('memoryQuota').doc(cw).collection('items').doc(qhash('memories/K19/inv1/bad.png')).set({ status: 'accepted', ownerMemoryId: 'a/b', tokenKey: 'x', bytes: 1 });
  await db.collection('memoryQuotaCleanupQueue').doc('0000-bad').set({ kind: 'owner_delete', weddingId: cw, path: 'memories/K19/inv1/bad.png', memoryId: 'a/b', attempts: 0, giveUp: false });
  let rc2 = await T.memoryQuotaReconcile(); const bad = (await db.collection('memoryQuotaCleanupQueue').doc('0000-bad').get()).data();
  ok(rc2.errors === 1 && rc2.cleaned === 3 && [0, 1, 2].every((i) => !store[`memories/K19/inv1/f${i}.png`]) && bad && bad.attempts === 1, '19. entrada defeituosa (exceção) seguida de válidas: as válidas são limpas; a defeituosa regista tentativa ' + JSON.stringify(rc2));
  for (let i = 0; i < 19; i++) await T.memoryQuotaReconcile(); const bad2 = (await db.collection('memoryQuotaCleanupQueue').doc('0000-bad').get()).data();
  ok(bad2.giveUp === true && bad2.attempts === 20, '19b. a entrada defeituosa não fica a falhar para sempre: giveUp ao fim de 20 tentativas');
  for (let i = 0; i < 5; i++) await seedRefused(`memories/K20/inv1/f${i}.png`);
  let perr = null; let rp; try { rp = await Promise.all([T.memoryQuotaReconcile(), T.memoryQuotaReconcile()]); } catch (e) { perr = e; }
  ok(!perr && [0, 1, 2, 3, 4].every((i) => !store[`memories/K20/inv1/f${i}.png`]) && (await db.collection('memoryQuotaCleanupQueue').where('weddingId', '==', 'K20').get()).empty && (await qd('K20')).files === undefined, '20. duas reconciliações em paralelo: sem erro, efeito único, contadores intactos');
  await seedRefused('memories/K21/inv1/a.png', { attempts: 19 }); st.deleteErr = mkErr(403); const rc3 = await T.memoryQuotaReconcile(); const g = (await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/K21/inv1/a.png')).get()).data();
  ok(g.giveUp === true && g.attempts === 20 && rc3.gaveUp === 1, '21. entrada que atinge 20 tentativas: giveUp');
  const rc4 = await T.memoryQuotaReconcile(); ok(rc4.cleaned === 0 && rc4.cleanupFailed === 0 && store['memories/K21/inv1/a.png'], '22. entrada giveUp deixa de ser processada');
  st.deleteErr = null; await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/K21/inv1/a.png')).update({ giveUp: false, attempts: 0 }); const rc5 = await T.memoryQuotaReconcile();
  ok(rc5.cleaned === 1 && !store['memories/K21/inv1/a.png'] && !(await exists('memoryQuotaCleanupQueue', qhash('memories/K21/inv1/a.png'))), '23. recuperação manual (giveUp=false, attempts=0): a próxima reconciliação conclui a limpeza');
  put('memories/K24/inv1/a.png'); await T.memoryQuotaAccount('memories/K24/inv1/a.png', 1000, 'image/png', 'object'); await seedQueue('memories/K24/inv1/a.png');
  const rc6 = await T.memoryQuotaReconcile(); ok(rc6.stale === 1 && store['memories/K24/inv1/a.png'] && (await item('memories/K24/inv1/a.png')).status === 'accepted' && !(await exists('memoryQuotaCleanupQueue', qhash('memories/K24/inv1/a.png'))), '24. entrada de limpeza que deixou de estar recusada: descartada SEM apagar o objeto legítimo');
  await seedRefused('memories/K25/inv1/a.png'); st.deleteErr = mkErr(503); const rt = await T.memoryQuotaReconcile(); const e25 = (await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/K25/inv1/a.png')).get()).data();
  ok(rt.cleanupFailed === 1 && e25.attempts === 1 && e25.giveUp === false && store['memories/K25/inv1/a.png'], '25a. erro de Storage transitório: tentativa registada, objeto mantido'); st.deleteErr = null;
  const rt2 = await T.memoryQuotaReconcile(); ok(rt2.cleaned === 1 && !store['memories/K25/inv1/a.png'], '25b. na execução seguinte a limpeza conclui');
  await seedRefused('memories/K26/inv1/a.png'); st.deleteErr = mkErr(403); for (let i = 0; i < 25; i++) await T.memoryQuotaReconcile();
  const e26 = (await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/K26/inv1/a.png')).get()).data(); st.deleteErr = null;
  ok(e26.giveUp === true && e26.attempts === 20, '26. erro permanente: pára em giveUp ao fim de 20 tentativas (não repete para sempre)');
  // ═════ Privacidade (27–29) ═════
  const secretPath = 'memories/K27/SECRETTOKEN123/f.png'; await seedRefused(secretPath);
  st.deleteErr = mkErr(undefined, 'request to https://storage.googleapis.com/storage/v1/b/bkt/o/memories%2FK27%2FSECRETTOKEN123%2Ff.png failed, reason: boom'); logBuf = '';
  await T.memoryQuotaReconcile(); const e27 = (await db.collection('memoryQuotaCleanupQueue').doc(qhash(secretPath)).get()).data(); st.deleteErr = null;
  ok(e27.attempts === 1 && typeof e27.lastError === 'string' && !/SECRETTOKEN123|storage\.googleapis|boom/.test(e27.lastError), '27/28. erro cujo message contém o caminho com token: lastError guarda só categoria/código (' + e27.lastError + ')');
  let g1 = null; try { await T.memoryGuard('teste', async () => { throw new Error('falhou em memories/K27/SECRETTOKEN123/f.png'); }); } catch (e) { g1 = e; }
  ok(g1 && !/SECRETTOKEN123/.test(g1.message) && !/SECRETTOKEN123/.test(logBuf), '29. nem o erro que sobe ao runtime nem os logs contêm o token');
  const se = T.memorySafeError(Object.assign(new Error('x memories/K/TOK/f'), { code: 'memories/K/TOK/f' })); ok(!/TOK/.test(JSON.stringify(se)), '29b. um code com barras (caminho) é rejeitado pela sanitização');
  // ═════ Inundação (31–34) ═════
  const N = 260; for (let b = 0; b < N; b += 200) { const w = db.batch(); for (let i = b; i < Math.min(N, b + 200); i++) { w.set(db.collection('memories').doc('f31-' + i), { weddingId: 'K31', token: 'publico', storagePath: `memories/K31/publico/f${i}.png`, guestName: 'x', quotaState: 'pending' }); w.set(db.collection('memoryQuotaPending').doc('f31-' + i), { weddingId: 'K31', memoryId: 'f31-' + i, due: admin.firestore.Timestamp.fromMillis(Date.now() - 5000), attempts: 0, giveUp: false }); } await w.commit(); }
  const rf = await T.memoryQuotaReconcile();
  ok(rf.docsDeleted === N && !rf.truncated && (await db.collection('memoryQuotaPending').where('weddingId', '==', 'K31').get()).empty && (await db.collection('memories').where('weddingId', '==', 'K31').get()).empty, `31. ${N} documentos pendentes (>100) tratados numa só execução (paginação) ` + JSON.stringify(rf));
  const w32 = db.batch(); for (let i = 0; i < 6; i++) { w32.set(db.collection('memories').doc('f32-' + i), { weddingId: 'K32', token: 'publico', storagePath: `memories/K32/publico/f${i}.png`, guestName: 'x', quotaState: 'pending' }); w32.set(db.collection('memoryQuotaPending').doc('f32-' + i), { weddingId: 'K32', memoryId: 'f32-' + i, due: admin.firestore.Timestamp.fromMillis(Date.now() - 5000 + i), attempts: 0, giveUp: false }); } await w32.commit();
  st.metaErrPaths['memories/K32/publico/f0.png'] = 503; const rb = await T.memoryQuotaReconcile(); const p0 = (await db.collection('memoryQuotaPending').doc('f32-0').get()).data(); st.metaErrPaths = {};
  ok(rb.docsDeleted === 5 && rb.pendingFailed === 1 && p0.attempts === 1 && p0.due.toMillis() > Date.now(), '32. entrada com erro transitório à cabeça não bloqueia o lote (adiada com backoff; as outras 5 tratadas)');
  let capped = 0, pend = 0; for (let i = 0; i < 210; i++) { const dd = await mkdoc('c33-' + i, 'K33', 'publico', `f${i}.png`); const x = await T.memoryQuotaHandleDoc('c33-' + i, dd); if (x.action === 'pending_cap_deleted') capped++; else if (x.action === 'pending') pend++; }
  const flagged = (await db.collection('memories').doc('c33-0').get()).data();
  ok(pend === 200 && capped === 10 && flagged.quotaState === 'pending', '33a. documentos sem objeto ficam marcados quotaState=pending; acima do teto (200) são removidos');
  ok(((await qd('K33')).files || 0) === 0 && ((await qd('K33')).bytes || 0) === 0 && (await db.collection('memoryQuota').doc('K33').collection('items').get()).empty, '34. documentos pendentes não consomem quota nem criam itens');
  put('memories/K33/publico/f0.png'); await db.collection('memoryQuotaPending').doc('c33-0').update({ due: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) }); await T.memoryQuotaReconcile();
  const f0 = (await db.collection('memories').doc('c33-0').get()).data();
  ok(f0 && f0.quotaState === undefined && (await qd('K33')).files === 1 && (await item('memories/K33/publico/f0.png')).ownerMemoryId === 'c33-0', '33b. quando o ficheiro aparece a reconciliação conta-o, atribui o dono e a fotografia deixa de estar pendente');
  const appSrc = require('fs').readFileSync(path.join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');
  ok(/quotaState==='pending'\)\s*return/.test(appSrc), '33c. (verificação estática, complementar) a galeria do casal ignora documentos quotaState=pending');
  // ═════ Pós-auditoria independente (A1, A2, A5, A6, A7) ═════
  // A2: item legado (K.3) ou ainda sem dono — apagar o único documento liberta pelo servidor; com outro documento, não
  put('memories/KL/inv1/leg.png'); await T.memoryQuotaAccount('memories/KL/inv1/leg.png', 1000, 'image/png', 'object');
  const dl = await mkdoc('kl1', 'KL', 'inv1', 'leg.png'); await db.collection('memories').doc('kl1').delete();
  r = await T.memoryQuotaHandleDocDeleted('kl1', dl);
  ok((await item('memories/KL/inv1/leg.png')).status === 'released' && !store['memories/KL/inv1/leg.png'] && (await qd('KL')).files === 0 && r.action === 'released', 'A2a. item sem dono (legado): apagar o único documento apaga o objeto e liberta a quota');
  put('memories/KL/inv1/two.png'); await T.memoryQuotaAccount('memories/KL/inv1/two.png', 1000, 'image/png', 'object');
  const dla = await mkdoc('kl2a', 'KL', 'inv1', 'two.png'); await mkdoc('kl2b', 'KL', 'inv1', 'two.png'); await db.collection('memories').doc('kl2a').delete();
  r = await T.memoryQuotaHandleDocDeleted('kl2a', dla);
  ok(r.action === 'not_owner' && store['memories/KL/inv1/two.png'] && (await qd('KL')).files === 1, 'A2b. item sem dono mas com outro documento a referir o ficheiro: não apaga nem liberta');
  // A5: objeto apagado mas libertação falha → a entrada de fila mantém-se e a reconciliação conclui
  put('memories/KR/inv1/a.png'); const dr = await mkdoc('kr1', 'KR', 'inv1', 'a.png'); await T.memoryQuotaHandleDoc('kr1', dr); await db.collection('memories').doc('kr1').delete();
  st.metaErrPaths['memories/KR/inv1/a.png'] = 503; thrown = null; try { await T.memoryQuotaHandleDocDeleted('kr1', dr); } catch (e) { thrown = e; }
  let qeR = await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/KR/inv1/a.png')).get();
  ok(thrown && !store['memories/KR/inv1/a.png'] && qeR.exists && (await item('memories/KR/inv1/a.png')).status === 'accepted' && (await qd('KR')).files === 1, 'A5a. objeto apagado mas libertação falhou: a entrada de fila mantém-se (não se perde a recuperação)');
  delete st.metaErrPaths['memories/KR/inv1/a.png']; await T.memoryQuotaReconcile();
  qeR = await db.collection('memoryQuotaCleanupQueue').doc(qhash('memories/KR/inv1/a.png')).get();
  ok((await item('memories/KR/inv1/a.png')).status === 'released' && (await qd('KR')).files === 0 && !qeR.exists, 'A5b. a reconciliação liberta a quota e só então remove a entrada');
  // A6: entradas abandonadas (giveUp) não contam para o teto de pendentes
  { const b = db.batch(); for (let i = 0; i < 200; i++) b.set(db.collection('memoryQuotaPending').doc('dead' + i), { weddingId: 'KG', memoryId: 'dead' + i, giveUp: true, attempts: 20, due: admin.firestore.Timestamp.fromMillis(4102444800000) }); await b.commit(); }
  const dg = await mkdoc('kg1', 'KG', 'inv1', 'nofile.png'); r = await T.memoryQuotaHandleDoc('kg1', dg);
  ok(r.action === 'pending' && (await exists('memories', 'kg1')), 'A6. 200 entradas abandonadas não bloqueiam novos pendentes legítimos');
  // A7: o cursor permite passar das primeiras 100 entradas mesmo que estas não saiam da consulta
  { const b = db.batch(); for (let i = 0; i < 130; i++) b.set(db.collection('memoryQuotaPending').doc('s' + String(i).padStart(3, '0')), { weddingId: 'KS', memoryId: 's' + i, giveUp: false, attempts: 0, due: admin.firestore.Timestamp.fromMillis(1000 + i) }); await b.commit(); }
  const res = await T.memoryQuotaReconcile(); const left = (await db.collection('memoryQuotaPending').where('weddingId', '==', 'KS').get()).size;
  ok(left === 0 && res.stale >= 130, 'A7. mais de 100 pendentes numa execução são todos tratados (cursor)');
  // A1: o marcador de casamento eliminado é revertido se a eliminação falhar (verificação estática: a callable não é executável isoladamente)
  const srcIdx = require('fs').readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  ok(/erro durante o apagamento[\s\S]{0,400}collection\('memoryQuota'\)\.doc\(weddingId\)\.delete\(\)/.test(srcIdx), 'A1. (verificação estática, complementar) falha na eliminação com o casamento ainda vivo repõe a quota (remove o marcador)');
  // ═════ R4 — objetos sem documento (uploads interrompidos) ═════
  const GR = T.MEMORIES_ORPHAN_GRACE_MS; const FUT = Date.now() + GR + 120000; const orphan = async (p) => (await db.collection('memoryQuotaOrphans').doc(qhash(p)).get());
  // 1. upload interrompido: dentro da janela de tolerância nada é apagado
  put('memories/KO1/inv1/a.png'); await T.memoryQuotaAccount('memories/KO1/inv1/a.png', 1000, 'image/png', 'object');
  const ent = await orphan('memories/KO1/inv1/a.png');
  ok(ent.exists && !(JSON.stringify(ent.data()).includes('"owner"')) && (await qd('KO1')).files === 1, 'R4-1. objeto aceite sem documento fica registado como candidato a órfão e conta na quota');
  await T.memoryQuotaReconcile(); ok(store['memories/KO1/inv1/a.png'] && (await qd('KO1')).files === 1 && (await orphan('memories/KO1/inv1/a.png')).exists, 'R4-2. dentro da janela de tolerância (upload em curso): nada é apagado nem libertado');
  // 3. fora da janela: apaga o objeto, liberta, marcador terminal; eventos tardios não recontam
  r = await T.memoryQuotaReconcile(FUT);
  ok(!store['memories/KO1/inv1/a.png'] && (await qd('KO1')).files === 0 && (await item('memories/KO1/inv1/a.png')).status === 'released' && !(await orphan('memories/KO1/inv1/a.png')).exists && r.orphansDeleted >= 1, 'R4-3. fora da janela: objeto órfão apagado, quota libertada só depois de confirmada a eliminação, entrada removida');
  r = await T.memoryQuotaAccount('memories/KO1/inv1/a.png', 1000, 'image/png', 'object');
  ok(r.action === 'released_ignored' && (await qd('KO1')).files === 0 && !(await orphan('memories/KO1/inv1/a.png')).exists, 'R4-4. evento tardio de criação do objeto eliminado não o recontam');
  const rBefore = JSON.stringify(await qd('KO1')); await T.memoryQuotaReconcile(FUT);
  ok(JSON.stringify(await qd('KO1')) === rBefore, 'R4-5. idempotente: nova execução não altera nada');
  // 6. fotografia legítima (documento chega a tempo): reivindica, sem entrada de órfão, nunca apagada
  put('memories/KO2/inv1/ok.png'); await T.memoryQuotaAccount('memories/KO2/inv1/ok.png', 1000, 'image/png', 'object');
  const dok = await mkdoc('ko2', 'KO2', 'inv1', 'ok.png'); await T.memoryQuotaHandleDoc('ko2', dok);
  ok(!(await orphan('memories/KO2/inv1/ok.png')).exists && (await item('memories/KO2/inv1/ok.png')).ownerMemoryId === 'ko2', 'R4-6. documento a tempo: reivindica o ficheiro e remove o candidato a órfão');
  await T.memoryQuotaReconcile(FUT); ok(store['memories/KO2/inv1/ok.png'] && (await qd('KO2')).files === 1 && (await exists('memories', 'ko2')), 'R4-7. fotografia legítima nunca é apagada');
  // 8. documento existe mas o evento de reivindicação perdeu-se: a reconciliação reivindica, não apaga
  put('memories/KO3/inv1/lost.png'); await T.memoryQuotaAccount('memories/KO3/inv1/lost.png', 1000, 'image/png', 'object'); await mkdoc('ko3', 'KO3', 'inv1', 'lost.png');
  r = await T.memoryQuotaReconcile(FUT);
  ok(store['memories/KO3/inv1/lost.png'] && (await item('memories/KO3/inv1/lost.png')).ownerMemoryId === 'ko3' && (await qd('KO3')).files === 1 && !(await orphan('memories/KO3/inv1/lost.png')).exists && r.orphansClaimed >= 1, 'R4-8. documento com evento perdido: a reconciliação atribui o dono e mantém a foto');
  // 9. falha de Storage: sem libertação, backoff, retry e conclusão
  put('memories/KO4/inv1/f.png'); await T.memoryQuotaAccount('memories/KO4/inv1/f.png', 1000, 'image/png', 'object');
  st.deleteErr = mkErr(503); await T.memoryQuotaReconcile(FUT); const of = (await orphan('memories/KO4/inv1/f.png')).data();
  ok(store['memories/KO4/inv1/f.png'] && (await qd('KO4')).files === 1 && of && of.attempts === 1 && !JSON.stringify(of).includes('storage down'), 'R4-9. falha de Storage: o objeto fica, a quota não é libertada, tentativa registada (sem mensagem em bruto)');
  st.deleteErr = null; await T.memoryQuotaReconcile(FUT + 3600000);
  ok(!store['memories/KO4/inv1/f.png'] && (await qd('KO4')).files === 0 && !(await orphan('memories/KO4/inv1/f.png')).exists, 'R4-10. no ciclo seguinte (Storage recuperado) apaga e liberta');
  // 11. erro transitório ao ler metadados: nada é apagado nem libertado
  put('memories/KO5/inv1/m.png'); await T.memoryQuotaAccount('memories/KO5/inv1/m.png', 1000, 'image/png', 'object'); st.metaErrPaths['memories/KO5/inv1/m.png'] = 503;
  await T.memoryQuotaReconcile(FUT); delete st.metaErrPaths['memories/KO5/inv1/m.png'];
  ok(store['memories/KO5/inv1/m.png'] && (await qd('KO5')).files === 1 && (await orphan('memories/KO5/inv1/m.png')).exists, 'R4-11. erro transitório de metadados: não apaga, não liberta, a entrada fica');
  // 12. objeto já desapareceu sem evento: liberta só depois de confirmar
  put('memories/KO6/inv1/g.png'); await T.memoryQuotaAccount('memories/KO6/inv1/g.png', 1000, 'image/png', 'object'); delete store['memories/KO6/inv1/g.png'];
  r = await T.memoryQuotaReconcile(FUT); ok((await qd('KO6')).files === 0 && (await item('memories/KO6/inv1/g.png')).status === 'released' && r.orphansReleased >= 1, 'R4-12. objeto desaparecido sem evento: quota libertada depois de confirmada a inexistência');
  // 13. casamento eliminado: nada é recriado, entrada descartada
  put('memories/KO7/inv1/w.png'); await T.memoryQuotaAccount('memories/KO7/inv1/w.png', 1000, 'image/png', 'object'); await T.memoryQuotaPurgeWedding('KO7');
  await T.memoryQuotaReconcile(FUT); ok(!(await orphan('memories/KO7/inv1/w.png')).exists && (await qd('KO7')).deleted === true && (await qd('KO7')).files === undefined, 'R4-13. casamento eliminado: candidato descartado e nenhum contador recriado');
  // 14. público (QR): upload direto sem documento é recolhido
  put('memories/KO8/publico/spam.png'); await T.memoryQuotaAccount('memories/KO8/publico/spam.png', 1000, 'image/png', 'object'); await T.memoryQuotaReconcile(FUT);
  ok(!store['memories/KO8/publico/spam.png'] && (await qd('KO8')).files === 0, 'R4-14. objeto enviado diretamente ao QR público sem documento é recolhido e a quota libertada');
  console.log(`\n${pass} ok, ${fail} falhas`); process.stdout.write = ow; process.stderr.write = oe; process.exit(fail ? 1 : 0);
})().catch((e) => { process.stdout.write = ow; process.stderr.write = oe; console.error('ERRO', e); process.exit(2); });
