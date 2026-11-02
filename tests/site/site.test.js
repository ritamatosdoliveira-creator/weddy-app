/* Wedding Website (Fase I) — servidor. Emulador Firestore; Storage SIMULADO em memória (sem rede, sem
 * publicação real, sem DNS). Valida: criar/guardar rascunho, sanitização, slug (formato, reservados, unicidade),
 * publicação (snapshot só com campos públicos; dados privados nunca), despublicar, ciclo de vida do Premium
 * (suspende sem apagar; reativa), fotos, isolamento entre casamentos e manipulação de IDs. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

// Storage simulado
const store = { files: {}, ops: [] };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ name: 'bkt',
  file: (p) => ({ copy: async (d) => { store.ops.push(['copy', p, d.name]); store.files[d.name] = store.files[p] || 'x'; }, setMetadata: async (m) => { store.ops.push(['meta', p, m]); }, delete: async () => { delete store.files[p]; } }),
  getFiles: async ({ prefix }) => [Object.keys(store.files).filter((k) => k.startsWith(prefix)).map((name) => ({ name, setMetadata: async (m) => { store.ops.push(['rotate', name]); }, delete: async () => { delete store.files[name]; } }))],
  deleteFiles: async ({ prefix }) => { Object.keys(store.files).forEach((k) => { if (k.startsWith(prefix)) delete store.files[k]; }); } }) }) });

const authOf = (email, verified) => ({ uid: 'uid-' + email, token: { email, email_verified: verified === undefined ? true : verified } });
const call = (fn, auth, data) => fn.run({ auth, data: data || {}, rawRequest: {} });
const nowIso = () => new Date().toISOString();
const monthsAgo = (n) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString(); };
const PREM = () => ({ active: true, startedAt: nowIso() });
const STATE = () => ({ daySchedule: [{ id: 's1', time: '16:00', label: 'Cerimónia', place: 'Quinta X', guestVisible: true }, { id: 's2', time: '03:00', label: 'Reunião PRIVADA do casal', guestVisible: false }],
  guests: { noiva: { familia: [{ id: 'g1', name: 'Tia Maria Segredo', phone: '+351912345678', email: 'tia@privado.pt' }] } }, budget: { total: 20000 } });
async function mkWedding(id, owner, sub, extra) {
  await db.collection('weddings').doc(id).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], ...(sub === undefined ? {} : { subscription: sub }),
    settings: { coupleName1: 'Rita', coupleName2: 'Tiago', weddingDate: '2027-06-05' }, json: JSON.stringify(STATE()), ...(extra || {}) });
}
const DRAFT = (over) => Object.assign({ lang: 'pt', template: 'editorial', palette: 'terracota', title: 'Rita & Tiago', welcome: 'Bem-vindos', slug: 'rita-e-tiago', indexable: false,
  sections: { story: { on: true, title: 'A nossa história', text: 'Conhecemo-nos em 2019.' }, schedule: { on: true, note: '' }, location: { on: true, name: 'Quinta X', address: 'Rua Y' }, rsvp: { on: true, text: 'Confirma a tua presença' } } }, over || {});
async function expectErr(p, code, label, detailCode) {
  try { await p; ok(false, label + ' (devia falhar)'); } catch (e) { ok(e.code === code && (!detailCode || (e.details && e.details.code === detailCode)), `${label} → ${code}${detailCode ? '/' + detailCode : ''}${e.code !== code ? ' [obtido ' + e.code + ': ' + e.message + ']' : ''}`); }
}
async function wipe() {
  for (const c of ['weddings', 'weddingSites', 'publicWeddingSites', 'siteSlugs', 'siteRateLimits']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => db.recursiveDelete(d.ref))); }
  store.files = {}; store.ops = [];
}
const site = async (w) => { const s = await db.collection('weddingSites').doc(w).get(); return s.exists ? s.data() : null; };
const pub = async (slug) => { const s = await db.collection('publicWeddingSites').doc(slug).get(); return s.exists ? s.data() : null; };
const A = authOf('a@x.pt'), B = authOf('b@x.pt');
const save = fns.saveWeddingSiteDraft, publish = fns.publishWeddingSite, unpublish = fns.unpublishWeddingSite, check = fns.checkWeddingSiteSlug, refresh = fns.refreshWeddingSite, reactivate = fns.reactivateWeddingSite;

(async () => {
  await wipe();
  await mkWedding('W1', 'a@x.pt', PREM());
  await mkWedding('W2', 'b@x.pt', PREM());

  // ===== autenticação =====
  for (const [n, f] of Object.entries({ save, publish, unpublish, check, refresh, reactivate })) {
    await expectErr(call(f, null, {}), 'unauthenticated', n + ': sem sessão');
    await expectErr(call(f, authOf('a@x.pt', false), {}), 'unauthenticated', n + ': e-mail não verificado');
    await expectErr(call(f, authOf('zz@x.pt'), {}), 'not-found', n + ': conta sem casamento');
  }

  // ===== rascunho =====
  await expectErr(call(save, A, { draft: null }), 'invalid-argument', 'rascunho vazio', 'invalid_draft');
  await expectErr(call(save, A, { draft: { title: 'x'.repeat(90000) } }), 'invalid-argument', 'rascunho gigante (>80 KB)', 'invalid_draft');
  await call(save, A, { draft: DRAFT({ weddingId: 'W2', evil: '<script>alert(1)</script>', source: { names: ['Fake', 'Fake'] } }) });
  let s = await site('W1');
  ok(s && s.draft.slug === 'rita-e-tiago' && s.weddingId === 'W1', 'rascunho gravado em weddingSites/W1');
  ok(!('evil' in s.draft) && !('weddingId' in s.draft) && !('source' in s.draft), 'chaves desconhecidas descartadas (lista branca)');
  ok(!(await site('W2')), 'rascunho não aparece no casamento B (manipular weddingId no pedido não muda o destino)');
  ok(s.premiumUntil && s.photosRevoked === false, 'validade do Premium espelhada para as regras do Storage');
  await call(save, A, { draft: DRAFT({ title: '<img src=x onerror=alert(1)>'.padEnd(200, 'a'), template: 'hacker', palette: 'neon', sections: { story: { on: true, text: 'ok', photoUrl: 'https://evil.com/x.jpg' } } }) });
  s = await site('W1');
  ok(s.draft.template === 'editorial' && s.draft.palette === 'terracota', 'template/paleta inválidos caem no valor por omissão');
  ok(s.draft.sections.story.photoUrl === '', 'foto de domínio externo recusada');
  ok(s.draft.title.length <= 120, 'título limitado ao máximo');
  ok(s.draft.indexable === false, 'não indexável por omissão');

  // ===== slug =====
  const chk = async (slug, auth) => call(check, auth || A, { slug });
  ok((await chk('ab')).problem === 'short' && (await chk('Rita E Tiago')).problem === 'chars' && (await chk('a--b')).problem === 'chars' && (await chk('admin')).problem === 'reserved' && (await chk('x'.repeat(60))).problem === 'long', 'slug: curto / caracteres / duplo hífen / reservado / longo');
  ok((await chk('../../etc')).available === false && (await chk('a/b')).available === false, 'slug com caminhos recusado');
  ok((await chk('rita-e-tiago')).available === true, 'slug livre disponível');
  await call(save, A, { draft: DRAFT() });

  // ===== publicação =====
  await expectErr(call(publish, B), 'failed-precondition', 'B sem rascunho não publica o de A', 'no_draft');
  const r = await call(publish, A);
  ok(r.ok && r.slug === 'rita-e-tiago' && r.url === 'https://www.weddy.pt/c/rita-e-tiago' && r.version === 1, 'publicação: URL público e versão 1');
  const p1 = await pub('rita-e-tiago');
  ok(p1.status === 'published' && p1.indexable === false && p1.validUntil, 'documento público: publicado, não indexável, com validade');
  const snapStr = JSON.stringify(p1);
  ok(!/Segredo|tia@privado|912345678|PRIVADA|20000|ownerEmails|a@x\.pt|uid-/.test(snapStr), 'PRIVACIDADE: snapshot público sem convidados, contactos, orçamento, momentos privados, e-mails/UIDs do casal');
  ok(p1.snapshot.names.join() === 'Rita,Tiago' && p1.snapshot.eventDate === '2027-06-05', 'nomes e data vêm dos dados do casamento (servidor)');
  ok(p1.snapshot.sections.schedule.items.length === 1 && p1.snapshot.sections.schedule.items[0].label === 'Cerimónia', 'programa: só momentos «Mostrar aos convidados»');
  ok((await site('W1')).status === 'published' && (await db.collection('siteSlugs').doc('rita-e-tiago').get()).data().weddingId === 'W1', 'estado privado + reserva do endereço');
  // unicidade: B tenta o mesmo slug
  await call(save, B, { draft: DRAFT({ slug: 'rita-e-tiago' }) });
  await expectErr(call(publish, B), 'already-exists', 'B não consegue o endereço já usado por A', 'slug_taken');
  ok((await pub('rita-e-tiago')).snapshot.names.join() === 'Rita,Tiago' && (await site('W1')).status === 'published', 'tentativa de B não altera o site de A');
  const cB = await call(check, B, { slug: 'rita-e-tiago' });
  ok(cB.available === false && cB.suggestions.length > 0 && !JSON.stringify(cB).includes('W1'), 'verificação de slug ocupado: sugestões, sem revelar de quem é');
  // validação de campos
  await call(save, B, { draft: DRAFT({ slug: 'b-casamento', sections: { story: { on: true, text: '' }, contact: { on: true, email: 'mau', phone: '' } } }) });
  try { await call(publish, B); ok(false, 'devia rejeitar secções vazias'); } catch (e) { ok(e.code === 'failed-precondition' && e.details.errors.includes('story_empty') && e.details.errors.includes('contact_email'), 'campos por corrigir → erros claros (sem publicar)'); }
  ok(!(await pub('b-casamento')), 'nada publicado quando há erros');
  // republicar mantém o slug e incrementa a versão
  await call(save, A, { draft: DRAFT({ slug: 'outro-slug-ignorado', title: 'Nova' }) });
  const r2 = await call(publish, A);
  ok(r2.slug === 'rita-e-tiago' && r2.version === 2, 'endereço fica bloqueado após a 1.ª publicação; versão 2');
  // indexação opt-in
  await call(save, A, { draft: DRAFT({ indexable: true }) }); await call(publish, A);
  ok((await pub('rita-e-tiago')).indexable === true, 'indexável só quando o casal o escolhe explicitamente');
  await call(save, A, { draft: DRAFT({ indexable: 'true' }) }); await call(publish, A);
  ok((await pub('rita-e-tiago')).indexable === false, 'indexable="true" (string) não vale');

  // ===== despublicar =====
  const u0 = await call(unpublish, B); ok(u0.alreadyUnpublished === true && (await pub('rita-e-tiago')).status === 'published', 'B não despublica o site de A');
  await call(unpublish, A);
  const pu = await pub('rita-e-tiago');
  ok(pu.status === 'unpublished' && !pu.snapshot && !pu.validUntil, 'despublicado: sem snapshot nem validade (regras negam a leitura)');
  ok((await site('W1')).draft && (await site('W1')).publishedSnapshot, 'despublicar NÃO apaga o rascunho nem a versão guardada');
  ok((await call(unpublish, A)).alreadyUnpublished === true, 'despublicar duas vezes é idempotente');
  await call(publish, A); ok((await pub('rita-e-tiago')).status === 'published', 'volta a publicar (mesmo endereço)');

  // ===== Premium =====
  for (const [nome, sub] of [['sem subscrição', undefined], ['active=false', { active: false, startedAt: nowIso() }], ['expirada', { active: true, startedAt: monthsAgo(13) }]]) {
    await mkWedding('W3', 'c@x.pt', sub); const C = authOf('c@x.pt');
    await expectErr(call(save, C, { draft: DRAFT({ slug: 'c-site' }) }), 'permission-denied', `guardar rascunho sem Premium (${nome})`);
    await expectErr(call(publish, C), 'permission-denied', `publicar sem Premium (${nome})`);
    await expectErr(call(reactivate, C), 'permission-denied', `reativar sem Premium (${nome})`);
  }
  // site publicado + Premium expira: suspende SEM apagar
  await db.collection('weddings').doc('W1').update({ subscription: { active: true, startedAt: monthsAgo(13) } });
  store.files['sites/W1/foto.jpg'] = 'x'; store.ops = [];
  const lr = await call(refresh, A);
  ok(lr.result === 'suspended', 'Premium expirado: o site publicado é suspenso');
  const ps = await pub('rita-e-tiago');
  ok(ps.status === 'suspended' && !ps.snapshot && !ps.validUntil, 'cópia pública sem snapshot (a regra nega a leitura)');
  const ss = await site('W1');
  ok(ss.status === 'suspended' && ss.suspendedReason === 'premium_expired' && ss.draft && ss.publishedSnapshot, 'rascunho e versão publicada PRESERVADOS (nada apagado)');
  ok(store.files['sites/W1/foto.jpg'] && store.ops.some((o) => o[0] === 'rotate'), 'fotos preservadas; tokens de download rodados (URLs antigos deixam de servir)');
  await expectErr(call(save, A, { draft: DRAFT() }), 'permission-denied', 'editar rascunho sem Premium bloqueado');
  await expectErr(call(publish, A), 'permission-denied', 'publicar sem Premium bloqueado');
  ok((await call(unpublish, A)).ok, 'despublicar continua permitido sem Premium'); 
  // renovar: reativa
  await db.collection('weddings').doc('W1').update({ subscription: PREM() });
  await db.collection('weddingSites').doc('W1').update({ status: 'suspended' }); await db.collection('publicWeddingSites').doc('rita-e-tiago').set({ status: 'suspended' });
  const re = await call(reactivate, A);
  ok(re.ok && (await pub('rita-e-tiago')).status === 'published' && (await pub('rita-e-tiago')).snapshot, 'renovar Premium: reativa a versão que estava publicada');
  await expectErr(call(reactivate, A), 'failed-precondition', 'reativar quando não está suspenso', 'not_suspended');
  // lifecycle com Premium válido
  const lv = (await call(refresh, A)).result; ok(lv !== 'suspended' && lv !== 'expired' && (await pub('rita-e-tiago')).status === 'published', 'Premium válido: lifecycle não suspende [' + lv + ']');
  // site de A não afectado pelo Premium de B
  await db.collection('weddings').doc('W2').update({ subscription: { active: true, startedAt: monthsAgo(14) } });
  await call(refresh, B); ok((await pub('rita-e-tiago')).status === 'published', 'Premium de B expirado não suspende o site de A');

  // ===== fotos =====
  await call(save, A, { draft: DRAFT({ coverUrl: 'https://firebasestorage.googleapis.com/v0/b/bkt/o/' + encodeURIComponent('sites/W1/capa.jpg') + '?alt=media&token=SEGREDO-TOKEN' }) });
  store.files['sites/W1/capa.jpg'] = 'IMG'; store.ops = [];
  await call(publish, A);
  const pf = await pub('rita-e-tiago');
  ok(/public-sites\/rita-e-tiago\/v\d+-cover\.jpg/.test(decodeURIComponent(pf.snapshot.coverUrl)) && !pf.snapshot.coverUrl.includes('SEGREDO-TOKEN') && !pf.snapshot.coverUrl.includes('token='), 'foto pública copiada para public-sites/ e SEM token de download');
  ok(store.ops.some((o) => o[0] === 'meta' && o[2].metadata && o[2].metadata.firebaseStorageDownloadTokens === null), 'token da cópia removido');
  await call(save, A, { draft: DRAFT({ coverUrl: 'https://firebasestorage.googleapis.com/v0/b/bkt/o/' + encodeURIComponent('sites/W2/capa-de-b.jpg') + '?alt=media' }) });
  ok((await site('W1')).draft.coverUrl === '', 'foto de OUTRO casamento (sites/W2/…) recusada no rascunho');

  console.log(`\nRESULT passed=${pass} failed=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
