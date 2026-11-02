/* Fase K — matriz de autenticação/autorização de TODAS as funções chamáveis (onCall). Emulador; Storage/Auth/fetch
 * simulados (nada externo). Para cada função: (1) sem sessão, (2) email não verificado, (3) utilizador autenticado
 * SEM casamento, (4) utilizador B com IDs do casamento de A em todos os campos → nunca sucesso nem alteração
 * do casamento de A. Exceções por desenho (token do convidado): getGuestWhatsappConsent/setGuestWhatsappConsent. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } };
global.fetch = async () => { throw new Error('rede bloqueada no teste'); };
Object.defineProperty(admin, 'storage', { configurable: true, value: () => ({ bucket: () => ({ name: 'b', file: () => ({ delete: async () => {}, exists: async () => [false], download: async () => [Buffer.from('')], copy: async () => {}, setMetadata: async () => {} }), getFiles: async () => [[]], deleteFiles: async () => {} }) }) });
Object.defineProperty(admin, 'auth', { configurable: true, value: () => ({ deleteUser: async () => {}, getUser: async () => ({ email: '' }) }) });
const PUBLIC_BY_DESIGN = new Set(['getGuestWhatsappConsent', 'setGuestWhatsappConsent', 'classifyWeddyIntent']); // token do convidado / chatbot do convidado (rsvp.html)
// Funções que ignoram IDs do cliente e atuam só nos casamentos DO chamador (sucesso legítimo; a prova é a vítima inalterada).
const OWN_SCOPE = new Set(['deleteWeddingAccount', 'refreshWeddingSite', 'unpublishWeddingSite', 'googleCalendarDisconnect', 'migrateMemoriesGuestId', 'checkWeddingSiteSlug']);
const A = (email, v) => ({ uid: 'uid-' + email, token: { email, email_verified: v === undefined ? true : v } });
const run = async (fn, auth, data) => { try { await fn.run({ auth, data, rawRequest: { headers: {}, ip: '1.1.1.1' } }); return 'SUCESSO'; } catch (e) { return e.code || ('erro:' + String(e.message).slice(0, 40)); } };
const DENY = new Set(['unauthenticated', 'permission-denied', 'invalid-argument', 'not-found', 'failed-precondition', 'resource-exhausted', 'internal', 'unavailable', 'deadline-exceeded', 'already-exists', 'aborted']);

(async () => {
  const names = Object.keys(fns).filter((k) => fns[k] && typeof fns[k].run === 'function' && fns[k].__endpoint && fns[k].__endpoint.callableTrigger).sort();
  ok(names.length >= 25, 'descobertas ' + names.length + ' funções chamáveis');
  const victimJson = JSON.stringify({ guests: { noiva: { familia: [{ id: 'g1', name: 'Vitima Ficticia' }] } } });
  await db.collection('weddings').doc('wVictim').set({ ownerEmails: ['vitima@teste.pt'], ownerUids: ['uid-vitima@teste.pt'], json: victimJson, subscription: { active: true, premiumUntil: new Date(Date.now() + 86400000 * 300) } });
  await db.collection('guests').doc('tokVictim').set({ weddingId: 'wVictim', name: 'Vitima Ficticia' });
  await db.collection('weddings').doc('wAtacante').set({ ownerEmails: ['atacante@teste.pt'], ownerUids: ['uid-atacante@teste.pt'], json: '{}' });
  const snapshotVictim = async () => JSON.stringify([(await db.collection('weddings').doc('wVictim').get()).data(), (await db.collection('guests').doc('tokVictim').get()).data()]);
  const before = await snapshotVictim();
  const evil = { weddingId: 'wVictim', wedding: 'wVictim', id: 'wVictim', guestToken: 'tokVictim', token: 'tokVictim', slug: 'vitima', compareId: 'c1', proposalId: 'p1', paths: ['memories/wVictim/x.jpg'], calendarId: 'primary', eventId: 'e1', question: 'olá', text: 'olá', draft: {}, returnUrl: 'https://www.weddy.pt/' };
  for (const n of names) {
    const fn = fns[n];
    if (!PUBLIC_BY_DESIGN.has(n)) {
      const r1 = await run(fn, null, {});
      ok(r1 === 'unauthenticated' || r1 === 'permission-denied' || r1 === 'invalid-argument', `${n}: sem sessão recusado (${r1})`);
      const r2 = await run(fn, A('atacante@teste.pt', false), evil);
      ok(r2 !== 'SUCESSO', `${n}: email não verificado não tem sucesso (${r2})`);
    }
    const r3 = await run(fn, A('semcasamento@teste.pt'), {});
    ok(r3 !== 'SUCESSO' || ['checkWeddingSiteSlug', 'googleCalendarDisconnect'].includes(n), `${n}: utilizador sem casamento (${r3})`);
    // deleteWeddingAccount ignora IDs do cliente (só apaga os casamentos DO chamador): o atacante só apaga o seu.
    const r4 = await run(fn, A('atacante@teste.pt'), evil);
    if (!PUBLIC_BY_DESIGN.has(n) && !OWN_SCOPE.has(n)) ok(r4 !== 'SUCESSO', `${n}: IDs do casamento alheio não dão sucesso (${r4})`);
    if (n === 'deleteWeddingAccount') await db.collection('weddings').doc('wAtacante').set({ ownerEmails: ['atacante@teste.pt'], ownerUids: ['uid-atacante@teste.pt'], json: '{}' });
    ok(await snapshotVictim() === before, `${n}: casamento/convidado da vítima inalterado`);
  }
  const after = (await db.collection('weddings').doc('wVictim').get()).exists && (await db.collection('weddings').doc('wAtacante').get()).exists;
  ok(after, 'casamentos da vítima e do atacante continuam a existir');
  // classifyWeddyIntent: role 'couple' sem email verificado NUNCA entra no caminho do casal (Premium/quota do casal)
  await db.collection('aiUsage').doc('wVictim').delete();
  const cl = await run(fns.classifyWeddyIntent, A('atacante@teste.pt', false), { question: 'quanto gastámos?', role: 'couple', weddingId: 'wVictim' });
  const quota = await db.collection('aiUsage').doc('wVictim').get();
  ok(!quota.exists, 'classifyWeddyIntent: não consome a quota do casamento alheio (' + cl + ')');
  // Convidado por token só atua no seu casamento
  const g = await run(fns.getGuestWhatsappConsent, null, { token: 'token-inexistente' });
  ok(g !== 'SUCESSO', 'consentimento: token inexistente recusado (' + g + ')');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
