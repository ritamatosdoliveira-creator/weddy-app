/* Testes do consentimento WhatsApp do convidado (A.3-bis).
 * Correr (emulador Firestore em 127.0.0.1:8085):
 *   NODE_PATH=<node_modules com firebase-admin, firebase-functions, nodemailer> \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GCLOUD_PROJECT=demo-weddy \
 *   WEDDY_EXPOSE_INTERNALS_FOR_TESTS=1 node tests/consent/whatsapp-consent.test.js
 * Chama os handlers das Cloud Functions diretamente (.run) contra o emulador.
 */
'use strict';
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
async function code(p) { try { await p; return 'none'; } catch (e) { return e.code || e.message; } }
async function reason(p) { try { await p; return null; } catch (e) { return (e.details && e.details.reason) || e.code; } }
const call = async (fn, data, auth) => ({ data: await fns[fn].run({ data, auth: auth || null, rawRequest: {} }) });

const V = 'wa-2026-11-v1';
const T1 = 'tokenGuest0001', TF = 'tokenFamily001', T9 = 'tokenOther0009', TN = 'tokenNoPhone01';
const confirmX = (phone, code, g) => fns._test.confirmWhatsappConsentByReply({ weddingId: 'W1', guestId: g }, phone, code);
const couple = { uid: 'u1', token: { email: 'noiva@example.com', email_verified: true } };

// Double opt-in: marcar a caixa deixa "pending"; só o "SIM <código>" do próprio WhatsApp confirma.
async function grant(token, guestId, phone, wedding) {
  const r = (await call('setGuestWhatsappConsent', { token, guestId, optedIn: true, version: V })).data;
  const out = await fns._test.confirmWhatsappConsentByReply({ weddingId: wedding || 'W1', guestId }, phone, r.code);
  return out;
}
async function clear() {
  for (const c of ['weddings', 'guests', 'guestPhoneIndex', 'whatsappConsents', 'whatsappConsentRateLimit', 'whatsappReminderRateLimit', 'whatsappReminderDailyUsage']) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
}
function stateW1() {
  return {
    settings: { coupleName1: 'Ana', coupleName2: 'Rui' },
    guests: {
      noiva: { familia: [
        { guestId: 'g1', name: 'Maria', phone: '+351912345678', rsvpToken: T1 },
        { guestId: 'g2', name: 'Joao', phone: '+351933333333' },
        { guestId: 'g3', name: 'Rita', phone: '+351944444444' },
        { guestId: 'g4', name: 'SemTel', phone: '' },
      ], amigos: [], duvida: [], staff: [], custom: [] },
      noivo: { familia: [], amigos: [], duvida: [], staff: [], custom: [] },
      conjunto: { familia: [], amigos: [], duvida: [], staff: [], custom: [] },
    },
  };
}
async function seed() {
  await clear();
  await db.collection('weddings').doc('W1').set({
    ownerEmails: ['noiva@example.com'], ownerUids: ['u1'],
    subscription: { active: true, startedAt: new Date().toISOString() },
    json: JSON.stringify(stateW1()),
  });
  await db.collection('weddings').doc('W2').set({
    ownerEmails: ['outro@example.com'], json: JSON.stringify({ guests: { noiva: { familia: [{ guestId: 'g9', name: 'Zé', phone: '+351955555555' }], amigos: [], duvida: [], staff: [], custom: [] }, noivo: {}, conjunto: {} } }),
  });
  await db.collection('guests').doc(T1).set({ weddingId: 'W1', guestId: 'g1', name: 'Maria' });
  await db.collection('guests').doc(TF).set({ weddingId: 'W1', isFamily: true, members: [{ guestId: 'g2', rsvpMemberId: 'm2', name: 'Joao' }, { guestId: 'g3', rsvpMemberId: 'm3', name: 'Rita' }] });
  await db.collection('guests').doc(T9).set({ weddingId: 'W2', guestId: 'g9', name: 'Zé' });
  await db.collection('guests').doc(TN).set({ weddingId: 'W1', guestId: 'g4', name: 'SemTel' });
  for (const [ph, w, g] of [['+351912345678', 'W1', 'g1'], ['+351933333333', 'W1', 'g2'], ['+351944444444', 'W1', 'g3'], ['+351955555555', 'W2', 'g9']]) {
    await db.collection('guestPhoneIndex').doc(ph).set({ weddingId: w, guestId: g });
  }
}
const entryOf = async (w, id) => {
  const st = JSON.parse((await db.collection('weddings').doc(w).get()).data().json);
  for (const side of ['noiva', 'noivo', 'conjunto']) for (const c of ['familia', 'amigos']) for (const e of ((st.guests[side] || {})[c] || [])) if (e.guestId === id) return e;
  return null;
};
const rec = async (w, g) => { const s = await db.collection('whatsappConsents').doc(`${w}_${g}`).get(); return s.exists ? s.data() : null; };

(async () => {
  await seed();

  // ---------- estado inicial ----------
  let st = (await call('getGuestWhatsappConsent', { token: T1, lang: 'pt' })).data;
  ok(st.version === V && st.people.length === 1 && st.people[0].granted === false, 'estado inicial: nada consentido (desmarcado por defeito)');
  ok(st.people[0].phoneMasked.includes('•') && !JSON.stringify(st).includes('912345678'), 'o número vem mascarado, nunca completo');
  ok(st.text.includes('STOP') && (await call('getGuestWhatsappConsent', { token: T1, lang: 'en' })).data.text.startsWith('I agree'), 'texto vem do servidor, em PT e EN');
  ok((await call('getGuestWhatsappConsent', { token: TN })).data.people.length === 0, 'convidado sem número: nada para consentir');
  ok(await rec('W1', 'g1') === null, 'sem registo criado só por abrir o convite');

  // ---------- validação de pedido / manipulação ----------
  ok(await code(call('setGuestWhatsappConsent', { token: T1, optedIn: 'true', version: V })) === 'invalid-argument', 'optedIn não booleano é recusado');
  ok(await code(call('setGuestWhatsappConsent', { token: T1, optedIn: 1, version: V })) === 'invalid-argument', 'optedIn=1 recusado');
  ok(await code(call('setGuestWhatsappConsent', { token: '../x', optedIn: true, version: V })) === 'invalid-argument', 'token com caracteres inválidos recusado');
  ok(await code(call('setGuestWhatsappConsent', { token: 'naoExiste123', optedIn: true, version: V })) === 'not-found', 'token inexistente recusado');
  ok(await reason(call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: 'velha' })) === 'text_outdated', 'versão do texto desatualizada é recusada');
  ok(await reason(call('setGuestWhatsappConsent', { token: T1, optedIn: true })) === 'text_outdated', 'sem versão: recusado');
  ok(await code(call('setGuestWhatsappConsent', { token: T1, guestId: 'g9', optedIn: true, version: V })) === 'permission-denied', 'token do casamento A não consente por convidado de B');
  ok(await code(call('setGuestWhatsappConsent', { token: T1, guestId: 'g2', optedIn: true, version: V })) === 'permission-denied', 'token individual não consente por outro convidado do mesmo casamento');
  ok(await code(call('setGuestWhatsappConsent', { token: T9, guestId: 'g1', optedIn: true, version: V })) === 'permission-denied', 'token de outro casamento não alcança g1');
  ok(await reason(call('setGuestWhatsappConsent', { token: TN, optedIn: true, version: V })) === 'no_phone', 'sem número validado não se regista consentimento');
  ok(await rec('W1', 'g1') === null && await rec('W1', 'g4') === null && await rec('W2', 'g9') === null, 'nenhuma tentativa falhada deixou registo');
  // O guestId no corpo não pode redirecionar um convite individual para um membro inexistente
  ok(await code(call('setGuestWhatsappConsent', { token: T1, guestId: { $ne: 1 }, optedIn: true, version: V })) === 'invalid-argument' && await rec('W1', 'g1') === null, 'guestId malformado (objeto) recusado sem criar registo');

  // ---------- dar consentimento (double opt-in) ----------
  const r = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V, lang: 'pt' })).data;
  let c = await rec('W1', 'g1');
  ok(r.ok && r.granted === false && r.pending === true && /^\d{6}$/.test(r.code), 'marcar a caixa => pendente + código de 6 dígitos (ainda NÃO consentido)');
  ok(c && c.status === 'pending' && c.phone === '+351912345678' && c.version === V && c.lang === 'pt' && c.source === 'rsvp_page', 'registo pendente: estado, número, versão, língua, origem');
  ok(c && c.requestedAt && typeof c.requestedAt.toMillis === 'function' && Math.abs(c.requestedAt.toMillis() - Date.now()) < 15000, 'data/hora do pedido vem do relógio do servidor');
  ok(c && c.codeHash && c.codeHash !== r.code && !JSON.stringify(c).includes(r.code), 'o código nunca é guardado em claro (só o hash)');
  ok(c && c.textHash === crypto.createHash('sha256').update(`${V}|pt|${(await call('getGuestWhatsappConsent', { token: T1, lang: 'pt' })).data.text}`).digest('hex'), 'hash do texto mostrado guardado como prova');
  ok(c && c.history.length === 1 && c.history[0].event === 'pending', 'histórico regista o pedido');
  let st1 = (await call('getGuestWhatsappConsent', { token: T1 })).data.people[0];
  ok(st1.pending === true && st1.granted === false, 'estado: pendente, não dado');
  ok((await entryOf('W1', 'g1')).communicationPreferences.whatsapp.optedIn === false, 'espelho no json continua falso enquanto pendente');
  const sendReason0 = (g) => reason(call('sendWhatsappRsvpReminder', { guestId: g }, couple));
  ok(await sendReason0('g1') === 'no_consent', 'PENDENTE não autoriza envios');
  // tentativas de confirmação inválidas
  const confirm = (phone, code, g) => fns._test.confirmWhatsappConsentByReply({ weddingId: 'W1', guestId: g || 'g1' }, phone, code);
  ok(await confirm('+351912345678', r.code === '000000' ? '111111' : '000000') === 'wrong_code', 'código errado não confirma');
  ok(await confirm('+351999999999', r.code) === 'phone_mismatch', 'código certo de outro número não confirma');
  ok((await rec('W1', 'g1')).status === 'pending', 'continua pendente');
  ok(await confirm('+351912345678', r.code) === 'granted', 'SIM + código certo do mesmo número confirma');
  c = await rec('W1', 'g1');
  ok(c.status === 'granted' && c.source === 'rsvp_page+whatsapp_reply' && c.grantedAt && Math.abs(c.grantedAt.toMillis() - Date.now()) < 15000 && c.codeHash === null, 'registo: granted, fonte, data do servidor, código apagado');
  ok(c.history.length === 2 && c.history[1].event === 'granted' && c.history[1].via === 'whatsapp_reply', 'histórico: pedido + confirmação');
  ok(await confirm('+351912345678', r.code) === 'no_pending', 'o mesmo código não se reutiliza');
  let e1 = await entryOf('W1', 'g1');
  ok(e1.communicationPreferences.whatsapp.optedIn === true && e1.communicationPreferences.whatsapp.source === 'guest', 'espelho no json passa a verdadeiro só após confirmar');
  ok((await call('getGuestWhatsappConsent', { token: T1 })).data.people[0].granted === true, 'estado passa a "dado"');
  const again = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V, lang: 'en' })).data;
  ok(again.granted === true && again.pending === false && !again.code && (await rec('W1', 'g1')).status === 'granted', 'marcar de novo quem já consentiu não volta a pedir confirmação');

  // ---------- parser da resposta ----------
  const P = fns._test.parseConsentConfirmation;
  ok(P('SIM 123456') === '123456' && P(' sim: 123456 ') === '123456' && P('Confirmo-123456') === '123456' && P('Yes 123456!') === '123456', 'parser aceita SIM/YES/CONFIRMO + código');
  ok(P('sim') === null && P('123456') === null && P('talvez 123456') === null && P('sim 12345') === null && P('sim 1234567') === null && P('sim 123456 e mais texto') === null && P(null) === null && P({}) === null, 'parser recusa tudo o resto');

  // ---------- retirar ----------
  await call('setGuestWhatsappConsent', { token: T1, optedIn: false, version: V });
  const c2 = await rec('W1', 'g1');
  ok(c2.status === 'revoked' && c2.revokedWhy === 'guest_request' && c2.revokedAt && c2.grantedAtISO, 'retirada: estado revogado, motivo e data; prova de quando foi dado mantém-se');
  ok((await entryOf('W1', 'g1')).communicationPreferences.whatsapp.optedIn === false, 'espelho passa a falso');
  ok(await code(call('setGuestWhatsappConsent', { token: T1, optedIn: false })) === 'none', 'retirar não exige versão do texto e é idempotente');

  // ---------- envio exige o registo do servidor ----------
  const sendReason = (g) => reason(call('sendWhatsappRsvpReminder', { guestId: g }, couple));
  ok(await sendReason('g1') === 'no_consent', 'envio recusado após retirada');
  // O casal forja o campo do json (editável pelo cliente):
  { const w = await db.collection('weddings').doc('W1').get(); const s = JSON.parse(w.data().json);
    s.guests.noiva.familia[0].communicationPreferences = { whatsapp: { optedIn: true, optedInAt: new Date().toISOString(), source: 'guest' } };
    await db.collection('weddings').doc('W1').update({ json: JSON.stringify(s) }); }
  ok(await sendReason('g1') === 'no_consent', 'json forjado (optedIn true) NÃO autoriza o envio');
  await grant(T1, 'g1', '+351912345678');
  const r3 = await sendReason('g1');
  ok(r3 !== 'no_consent' && r3 !== 'no_phone', 'com consentimento real o envio passa a verificação (falha depois, por faltar configuração Meta: ' + r3 + ')');

  // ---------- o casal não consegue dar consentimento ----------
  await seed();
  await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345678', optedIn: true }, couple);
  ok(await rec('W1', 'g1') === null && (await entryOf('W1', 'g1')).communicationPreferences === undefined, 'updateGuestPhone com optedIn:true do casal não cria consentimento');
  await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345679', optedIn: true }, couple);
  ok(await rec('W1', 'g1') === null && (await entryOf('W1', 'g1')).communicationPreferences.whatsapp.optedIn === false, 'novo número com optedIn:true do casal continua sem consentimento');

  // ---------- mudar/remover número anula ----------
  await seed();
  await grant(T1, 'g1', '+351912345678');
  await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345670' }, couple);
  const c3 = await rec('W1', 'g1');
  ok(c3.status === 'revoked' && c3.revokedWhy === 'phone_changed', 'mudar o número anula o consentimento');
  await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345678' }, couple);
  ok((await rec('W1', 'g1')).status === 'revoked' && await sendReason('g1') === 'no_consent', 'voltar ao número antigo não repõe o consentimento');
  ok((await call('getGuestWhatsappConsent', { token: T1 })).data.people[0].granted === false, 'o convidado volta a ver a caixa desmarcada');
  await grant(T1, 'g1', '+351912345678');
  await call('updateGuestPhone', { guestId: 'g1', phone: '' }, couple);
  ok((await rec('W1', 'g1')).revokedWhy === 'phone_removed' && (await entryOf('W1', 'g1')).phone === '', 'remover o número anula o consentimento');

  // ---------- casal regista pedido para parar ----------
  await seed();
  await grant(T1, 'g1', '+351912345678');
  await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345678', optedIn: false }, couple);
  ok((await rec('W1', 'g1')).revokedWhy === 'couple_request', 'casal pode registar que o convidado pediu para parar');

  // ---------- STOP por WhatsApp ----------
  await seed();
  await grant(T1, 'g1', '+351912345678');
  await fns._test.recordWhatsappOptOut('W1', 'g1');
  const c4 = await rec('W1', 'g1');
  ok(c4.status === 'revoked' && c4.revokedWhy === 'whatsapp_stop' && (await entryOf('W1', 'g1')).communicationPreferences.whatsapp.optedIn === false, 'STOP revoga registo e espelho');
  await fns._test.recordWhatsappOptOut('W1', 'g1');
  ok((await rec('W1', 'g1')).history.filter((h) => h.event === 'revoked').length === 1, 'STOP repetido não duplica a revogação');
  await fns._test.recordWhatsappOptOut('W1', 'g404');
  ok(await rec('W1', 'g404') === null, 'STOP de convidado desconhecido não cria registos');

  // ---------- família: um a um ----------
  await seed();
  const fam = (await call('getGuestWhatsappConsent', { token: TF })).data;
  ok(fam.people.length === 2 && fam.people.every((p) => !p.granted), 'convite de família: duas pessoas, ambas desmarcadas');
  ok(await code(call('setGuestWhatsappConsent', { token: TF, optedIn: true, version: V })) === 'permission-denied', 'família sem indicar a pessoa: recusado');
  await call('setGuestWhatsappConsent', { token: TF, guestId: 'g2', optedIn: true, version: V });
  ok((await rec('W1', 'g2')).status === 'pending' && await rec('W1', 'g3') === null, 'pedir por g2 não cria registo para g3');
  ok(await code(call('setGuestWhatsappConsent', { token: TF, guestId: 'g1', optedIn: true, version: V })) === 'permission-denied', 'membro de outro convite recusado');

  // ---------- double opt-in: casos extremos ----------
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    const r2 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    ok(await confirmX('+351912345678', r1.code, 'g1') === 'wrong_code', 'o código antigo deixa de valer após novo pedido');
    ok(await confirmX('+351912345678', r2.code, 'g1') === 'granted', 'o código novo vale'); }
  // expirado
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    await db.collection('whatsappConsents').doc('W1_g1').update({ pendingExpiresAtMs: Date.now() - 1000 });
    ok(await confirmX('+351912345678', r1.code, 'g1') === 'expired' && (await rec('W1', 'g1')).status === 'pending', 'pedido expirado não confirma');
    ok((await call('getGuestWhatsappConsent', { token: T1 })).data.people[0].pending === false, 'expirado deixa de aparecer como pendente'); }
  // bloqueio após 5 tentativas
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    const bad = r1.code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) await confirmX('+351912345678', bad, 'g1');
    ok(await confirmX('+351912345678', r1.code, 'g1') === 'locked' && (await rec('W1', 'g1')).status === 'pending', '5 tentativas erradas bloqueiam (nem o código certo vale)'); }
  // cancelar pendente / STOP / mudar número
  await seed();
  { await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V });
    await call('setGuestWhatsappConsent', { token: T1, optedIn: false });
    const c = await rec('W1', 'g1');
    ok(c.status === 'revoked' && c.revokedWhy === 'guest_cancelled_pending' && c.codeHash === null, 'desmarcar enquanto pendente cancela e apaga o código'); }
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345670' }, couple);
    ok((await rec('W1', 'g1')).status === 'revoked' && await confirmX('+351912345678', r1.code, 'g1') === 'no_pending', 'mudar o número cancela o pedido pendente'); }
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    await fns._test.recordWhatsappOptOut('W1', 'g1');
    ok((await rec('W1', 'g1')).status === 'revoked' && await confirmX('+351912345678', r1.code, 'g1') === 'no_pending', 'STOP cancela o pedido pendente'); }
  // o casal NÃO consegue confirmar: updateGuestPhone ignora, e a confirmação só existe pelo webhook
  await seed();
  { await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V });
    await call('updateGuestPhone', { guestId: 'g1', phone: '+351912345678', optedIn: true }, couple);
    ok((await rec('W1', 'g1')).status === 'pending', 'o casal não consegue passar pendente a dado'); }
  // webhook de ponta a ponta (mensagem da Meta, remetente = telemóvel do convidado)
  await seed();
  { const r1 = (await call('setGuestWhatsappConsent', { token: T1, optedIn: true, version: V })).data;
    await fns._test.handleIncomingWhatsappMessage({ from: '351933333333', id: 'wamid.X1', type: 'text', text: { body: 'SIM ' + r1.code } }, []);
    ok((await rec('W1', 'g1')).status === 'pending', 'mensagem de OUTRO número com o código certo não confirma');
    await fns._test.handleIncomingWhatsappMessage({ from: '351912345678', id: 'wamid.X2', type: 'text', text: { body: 'SIM ' + r1.code } }, []);
    ok((await rec('W1', 'g1')).status === 'granted', 'webhook: SIM + código do próprio número confirma');
    await fns._test.handleIncomingWhatsappMessage({ from: '351912345678', id: 'wamid.X3', type: 'text', text: { body: 'STOP' } }, []);
    ok((await rec('W1', 'g1')).status === 'revoked', 'webhook: STOP depois revoga'); }
  // ---------- limite de pedidos ----------
  await seed();
  let last = 'none';
  for (let i = 0; i < 25; i++) last = await code(call('setGuestWhatsappConsent', { token: T1, optedIn: false, version: V }));
  ok(last === 'resource-exhausted', 'limite de 20 pedidos/hora por convite');

  console.log(`\n${pass} OK, ${fail} FALHAS`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });
