/* Convites Digitais — ensaio controlado (Fase 4): 8 modelos, conta/casamento de TESTE, emulador Firestore, funções reais.
 * Rascunho vs publicado, publicação, falha na gravação (versão anterior intacta), validação, Premium, token RSVP, despublicar.
 * Dados sintéticos (nada de clientes). Variável INV_CLIENT_DIR = raiz do cliente (por defeito ../../). */
'use strict';
const path = require('path'), fs = require('fs');
const admin = require('firebase-admin');
const R = (process.env.INV_CLIENT_DIR || path.join(__dirname, '..', '..')) + '/';
if (!fs.existsSync(R + 'weddyinvite.js')) { console.log('cliente não encontrado em ' + R + ' — definir INV_CLIENT_DIR (suite corre com cliente+servidor no mesmo repositório)'); process.exit(0); }
global.window = global; global.document = { currentScript: { src: 'http://localhost/weddyinvite-w.js' } };
require(R + 'weddyinvite-w.js');
for (const f of fs.readdirSync(R + 'convites8').filter((f) => /^m-.*\.js$/.test(f))) require(R + 'convites8/' + f);
require(R + 'weddyinvite.js'); require(R + 'convites8/schema.js');
if (!global.qrcode) { const q = require(R + 'convites8/qrcode.js'); global.qrcode = typeof q === 'function' ? q : q.qrcode; }
const W = global.WeddyInvite, SC = global.WeddyInviteSchema.SCHEMA;
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); console.log('FAIL ' + m); } };
const authOf = (email) => ({ uid: 'uid-' + email, token: { email, email_verified: true } });
const call = (fn, auth, data) => fn.run({ auth, data: data || {}, rawRequest: {} });
const IMG = 'https://firebasestorage.googleapis.com/v0/b/demo-weddy.appspot.com/o/invitations%2FWT-';
const TOK = 'abcdefgh12345678';
const pubDoc = async (s) => { const x = await db.collection('publicInvitations').doc(s).get(); return x.exists ? x.data() : null; };
const html = (cfg) => W.page(W.sanitize(cfg, 'pt'), { token: TOK, mode: 'public' }).html;
(async () => {
  for (const c of ['weddings', 'weddingInvitations', 'publicInvitations', 'invitationSlugs', 'siteRateLimits']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
  for (const tpl of Object.keys(SC)) {
    const wid = 'WT-' + tpl, owner = tpl + '@teste.weddy', A = authOf(owner), m = SC[tpl];
    await db.collection('weddings').doc(wid).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], subscription: { active: true, startedAt: new Date().toISOString() }, settings: {}, json: '{}' });
    const opt = m.secoes.filter((s) => s.ocultavel).map((s) => s.id), tit = m.secoes.find((s) => s.titulo);
    let draft = { tpl, lang: 'pt', names: 'Teste & Exemplo', date: '2027-07-12', time: '16:00', venue: 'Local de teste', address: 'Rua Teste 1', message: 'Mensagem de teste', story: 'História de teste', dress: 'Formal', dressF: 'F teste', dressM: 'M teste', thanks: 'Obrigado teste', hash: '#teste',
      song: { t: 'Canção', a: 'Artista', u: 'https://open.spotify.com/track/abc' }, program: [{ t: '16:00', d: 'Cerimónia' }],
      photos: { cover: IMG + tpl + '%2Fc1.jpg?alt=media', gallery: [IMG + tpl + '%2Fg0.jpg?alt=media', IMG + tpl + '%2Fg1.jpg?alt=media', '', ''] },
      titles: tit ? { [tit.id]: 'Título de teste' } : {}, hiddenSections: opt.slice(0, 1), photoFocus: { [m.fotos[0].slot]: { x: 25, y: 75 } }, schemaVersion: 2 };
    draft.colors = W.sanitize(draft, 'pt').colors;
    // rascunho gravado (como a app) — não existe versão pública
    await db.collection('weddings').doc(wid).update({ json: JSON.stringify({ invitation: { draft } }) });
    ok(!(await db.collection('weddingInvitations').doc(wid).get()).exists, tpl + ': rascunho gravado não cria versão publicada');
    // publicar
    const r1 = await call(fns.publishInvitation, A, { draft });
    ok(r1.ok && r1.version === 1 && r1.url === 'https://www.weddy.pt/i/' + r1.slug, tpl + ': publicação v1');
    const p1 = await pubDoc(r1.slug);
    ok(p1.status === 'published' && html(p1.snapshot) === html(draft), tpl + ': público = rascunho (render idêntico)');
    const noPh = JSON.stringify(Object.assign({}, p1, { snapshot: Object.assign({}, p1.snapshot, { photos: null }) })); // os URLs das fotografias levam o caminho invitations/<weddingId>/ (desenho existente do Storage com token)
    ok(!noPh.includes(owner) && !noPh.includes(wid) && !noPh.includes(TOK) && !('weddingId' in p1), tpl + ': público sem email, weddingId nem token (fora dos URLs das fotografias)');
    ok(p1.snapshot.photoFocus && p1.snapshot.hiddenSections.length === 1 && (!tit || p1.snapshot.titles[tit.id] === 'Título de teste'), tpl + ': titles/hiddenSections/photoFocus no público');
    ok(new RegExp('rsvp\\.html\\?g=' + TOK).test(html(p1.snapshot)), tpl + ': RSVP individual com token');
    // alterar rascunho → público não muda
    const d2 = JSON.parse(JSON.stringify(draft)); d2.names = 'Alterado & Rascunho'; d2.photos.cover = ''; d2.hiddenSections = [];
    await db.collection('weddings').doc(wid).update({ json: JSON.stringify({ invitation: { draft: d2 } }) });
    const p1b = await pubDoc(r1.slug); ok(p1b.version === 1 && p1b.snapshot.names === 'Teste & Exemplo' && p1b.snapshot.photos.cover.includes('c1.jpg'), tpl + ': alterar rascunho não altera o público');
    // falha na gravação → versão anterior intacta
    const WB = require('@google-cloud/firestore').WriteBatch, orig = WB.prototype.commit; WB.prototype.commit = async () => { throw new Error('falha simulada'); };
    let code = ''; try { await call(fns.publishInvitation, A, { draft: d2 }); } catch (e) { code = e.code + '/' + (e.details && e.details.code); } finally { WB.prototype.commit = orig; }
    ok(code === 'unavailable/commit', tpl + ': falha de gravação devolve erro (' + code + ')');
    const p1c = await pubDoc(r1.slug), wi = (await db.collection('weddingInvitations').doc(wid).get()).data();
    ok(p1c.version === 1 && p1c.snapshot.names === 'Teste & Exemplo' && wi.publishedVersion === 1 && wi.publishedConfig.names === 'Teste & Exemplo', tpl + ': após falha a versão pública anterior mantém-se');
    // rascunho inválido → rejeitado, público intacto
    let c2 = ''; try { await call(fns.publishInvitation, A, { draft: Object.assign({}, draft, { hiddenSections: ['inexistente'] }) }); } catch (e) { c2 = e.details && e.details.code; }
    ok(c2 === 'validation', tpl + ': secção inexistente rejeitada'); ok((await pubDoc(r1.slug)).version === 1, tpl + ': após rejeição o público mantém-se');
    // republicar OK
    const r2 = await call(fns.publishInvitation, A, { draft: d2 });
    ok(r2.slug === r1.slug && r2.version === 2 && (await pubDoc(r1.slug)).snapshot.names === 'Alterado & Rascunho', tpl + ': republicar → v2, mesmo URL');
    // outro casal não publica sobre este
    const other = authOf('outro@teste.weddy'); let c3 = ''; try { await call(fns.publishInvitation, other, { draft }); } catch (e) { c3 = e.code; }
    ok(c3 === 'not-found' || c3 === 'permission-denied', tpl + ': conta sem casamento não publica (' + c3 + ')');
    // Premium expirado
    await db.collection('weddings').doc(wid).update({ subscription: { active: true, startedAt: '2023-01-01T00:00:00Z' } });
    let c4 = ''; try { await call(fns.publishInvitation, A, { draft }); } catch (e) { c4 = e.code; }
    ok(c4 === 'permission-denied', tpl + ': Premium expirado não publica'); ok((await pubDoc(r1.slug)).version === 2, tpl + ': Premium expirado não toca no público');
    await db.collection('weddings').doc(wid).update({ subscription: { active: true, startedAt: new Date().toISOString() } });
    // despublicar
    await call(fns.unpublishInvitation, A, {}); ok((await pubDoc(r1.slug)).status !== 'published', tpl + ': despublicar retira o convite');
  }
  console.log(`\n${pass} ok, ${fail} falhas`);
  await new Promise((r) => setTimeout(r, 2500)); // deixa chegar os rollbacks ao emulador (evita bloqueios nas suites seguintes)
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERRO', e); process.exit(1); });
