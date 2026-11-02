/* STOP do WhatsApp: revogação efetiva, sem reversão por dados antigos, sem reativação sem ação do convidado.
 * Chama as funções reais contra o emulador. Linhas "GAP" = comportamento desejado que o código atual
 * AINDA NÃO cumpre (informativo, não falha a suite) — ficam registadas para a correção depois da
 * comparação com os zips de produção. */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
const T = fns._test;
let pass = 0, fail = 0, gaps = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const gap = (c, m) => { if (c) { pass++; console.log('OK   ' + m + ' (já cumprido)'); } else { gaps++; console.log('GAP  ' + m); } };
const call = async (fn, data, auth) => fns[fn].run({ data, auth: auth || null, rawRequest: {} });
const reason = async (p) => { try { await p; return null; } catch (e) { return (e.details && e.details.reason) || e.code; } };
const V = 'wa-2026-11-v1';
const couple = { uid: 'u1', token: { email: 'noiva@example.com', email_verified: true } };
const P1 = '+351912345678', P2 = '+351966666666';
const rec = async (g) => { const s = await db.collection('whatsappConsents').doc(`W1_${g}`).get(); return s.exists ? s.data() : null; };
const state = async () => JSON.parse((await db.collection('weddings').doc('W1').get()).data().json);
const entryOf = async (g) => { const s = await state(); return s.guests.noiva.familia.find((e) => e.guestId === g); };
const stop = (body, from) => T.handleIncomingWhatsappMessage({ from: (from || P1).replace('+', ''), id: 'wamid.' + Math.random(), type: 'text', text: { body } }, [{ profile: { name: 'Nome Privado' } }]);
const sendReason = (g) => reason(call('sendWhatsappRsvpReminder', { guestId: g }, couple));
async function clear() { for (const c of ['weddings', 'guests', 'guestPhoneIndex', 'whatsappConsents', 'whatsappConsentRateLimit', 'whatsappReminderRateLimit', 'whatsappReminderDailyUsage', 'whatsappInbox']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } }
async function seed(over) {
  await clear();
  const fam = [{ guestId: 'g1', name: 'Maria', phone: P1, rsvpToken: 'tokenGuest0001' }, { guestId: 'g2', name: 'Joao', phone: '+351933333333' }];
  if (over && over.legacy) fam[0].communicationPreferences = { whatsapp: { optedIn: true, optedInAt: '2026-08-01T10:00:00Z', optedOutAt: null } };
  await db.collection('weddings').doc('W1').set({ ownerEmails: ['noiva@example.com'], ownerUids: ['u1'], subscription: { active: true, startedAt: new Date().toISOString() },
    json: JSON.stringify({ settings: { coupleName1: 'Ana', coupleName2: 'Rui' }, guests: { noiva: { familia: fam, amigos: [], duvida: [], staff: [], custom: [] }, noivo: { familia: [], amigos: [], duvida: [], staff: [], custom: [] }, conjunto: { familia: [], amigos: [], duvida: [], staff: [], custom: [] } } }) });
  await db.collection('guests').doc('tokenGuest0001').set({ weddingId: 'W1', guestId: 'g1', name: 'Maria' });
  for (const [ph, g] of [[P1, 'g1'], ['+351933333333', 'g2']]) await db.collection('guestPhoneIndex').doc(ph).set({ weddingId: 'W1', guestId: g });
}
async function grant() { const r = await call('setGuestWhatsappConsent', { token: 'tokenGuest0001', optedIn: true, version: V }); return T.confirmWhatsappConsentByReply({ weddingId: 'W1', guestId: 'g1' }, P1, r.code); }

(async () => {
  // 1. Consentimento ANTIGO (só no json, sem registo do servidor)
  await seed({ legacy: true });
  ok(await sendReason('g1') === 'no_consent', 'antigo: o espelho do json nunca autoriza envios');
  await stop('STOP');
  ok((await entryOf('g1')).communicationPreferences.whatsapp.optedIn === false && (await entryOf('g1')).communicationPreferences.whatsapp.optedOutAt, 'antigo: STOP desliga o espelho e regista a data');
  ok(await rec('g1') === null, 'antigo: STOP não inventa um registo de consentimento');
  await call('updateGuestPhone', { guestId: 'g1', phone: P1, optedIn: true }, couple);
  ok((await entryOf('g1')).communicationPreferences.whatsapp.optedIn === false && await sendReason('g1') === 'no_consent', 'antigo: o casal não consegue reativar (optedIn:true ignorado)');

  // 2. Consentimento NOVO (granted)
  await seed();
  ok(await grant() === 'granted', 'preparação: consentimento novo concedido');
  await stop('STOP');
  let c = await rec('g1');
  ok(c.status === 'revoked' && c.revokedWhy === 'whatsapp_stop' && c.revokedAtISO && c.revokedAt && c.codeHash === null, 'novo: STOP revoga (estado, origem, data, sem código)');
  ok(await sendReason('g1') === 'no_consent', 'novo: depois do STOP não há envios');
  ok(!JSON.stringify(c).includes('Nome Privado') && !/"STOP"/.test(JSON.stringify(c)), 'registo de consentimento não guarda o conteúdo nem o nome do contacto');
  // sincronização posterior com dados antigos (estado do cliente com optedIn:true)
  const st = await state(); st.guests.noiva.familia[0].communicationPreferences = { whatsapp: { optedIn: true, optedInAt: '2026-08-01T10:00:00Z', optedOutAt: null } };
  await db.collection('weddings').doc('W1').update({ json: JSON.stringify(st) });
  ok(await sendReason('g1') === 'no_consent' && (await rec('g1')).status === 'revoked', 'novo: sincronização antiga (json com optedIn:true) não reverte a revogação');
  const g = (await call('getGuestWhatsappConsent', { token: 'tokenGuest0001' })).people[0];
  ok(g.granted === false, 'novo: o ecrã do convidado mostra NÃO consentido (a verdade é o servidor)');

  // 3. PENDENTE
  await seed();
  const r3 = await call('setGuestWhatsappConsent', { token: 'tokenGuest0001', optedIn: true, version: V });
  await stop('stop');
  c = await rec('g1');
  ok(c.status === 'revoked' && c.revokedWhy === 'whatsapp_stop' && c.codeHash === null && c.pendingExpiresAtMs === null, 'pendente: STOP invalida o pedido e o código');
  ok(await T.confirmWhatsappConsentByReply({ weddingId: 'W1', guestId: 'g1' }, P1, r3.code) === 'no_pending', 'pendente: o código antigo já não confirma nada');

  // 4. JÁ REVOGADO + 5. STOP repetido (sequencial e concorrente)
  await seed(); await grant(); await stop('STOP');
  const t1 = (await rec('g1')).revokedAtISO, h1 = (await rec('g1')).history.length;
  await stop('STOP'); await stop('PARAR');
  c = await rec('g1');
  ok(c.status === 'revoked' && c.revokedAtISO === t1 && c.history.length === h1, 'revogado: STOP repetido não altera data nem duplica o histórico');
  await seed(); await grant();
  await Promise.all(Array.from({ length: 6 }, () => stop('STOP')));
  ok((await rec('g1')).history.filter((h) => h.event === 'revoked').length === 1, 'STOP concorrente (6 em paralelo): exatamente 1 revogação registada');
  await seed(); await grant(); await stop('STOP');
  const e1 = (await entryOf('g1')).communicationPreferences.whatsapp.optedOutAt; await new Promise((r) => setTimeout(r, 15)); await stop('STOP');
  ok((await entryOf('g1')).communicationPreferences.whatsapp.optedOutAt === e1, 'STOP repetido mantém a data da PRIMEIRA revogação também no espelho do json');

  // 6. Alteração posterior do número
  await seed(); await grant();
  await call('updateGuestPhone', { guestId: 'g1', phone: P2 }, couple);
  c = await rec('g1');
  ok(c.status === 'revoked' && c.revokedWhy === 'phone_changed', 'número alterado: consentimento do número antigo revogado');
  await stop('STOP', P1);
  ok((await rec('g1')).revokedWhy === 'phone_changed', 'STOP vindo do número ANTIGO não mexe no registo (índice já não aponta)');
  await stop('STOP', P2);
  ok((await rec('g1')).status === 'revoked', 'STOP do número novo, sem consentimento: nada de novo é criado/ativado');
  ok(await sendReason('g1') === 'no_consent', 'número alterado: sem envios até novo consentimento do convidado');

  // 7. Reativação sem ação explícita do convidado
  await seed(); await grant(); await stop('STOP');
  await call('updateGuestPhone', { guestId: 'g1', phone: P1, optedIn: true }, couple);
  ok((await rec('g1')).status === 'revoked' && await sendReason('g1') === 'no_consent', 'casal com optedIn:true não reativa');
  ok(await T.confirmWhatsappConsentByReply({ weddingId: 'W1', guestId: 'g1' }, P1, '123456') === 'no_pending', '"SIM <código>" sem pedido pendente não reativa');
  await stop('SIM 123456');
  ok((await rec('g1')).status === 'revoked', 'webhook: "SIM 123456" recebido não reativa (sem confirmação automática)');
  await call('setGuestWhatsappConsent', { token: 'tokenGuest0001', optedIn: true, version: V });
  ok((await rec('g1')).status === 'pending' && await sendReason('g1') === 'no_consent', 'nova ação explícita do convidado só cria PENDENTE (nunca envia sem confirmação)');
  await stop('STOP');
  ok((await rec('g1')).status === 'revoked', 'e um novo STOP volta a revogar');

  // 8. Reconhecimento do STOP
  const variants = [['STOP', true], ['  Stop. ', true], ['stop!!', true], ['PARAR', true], ['Parar de enviar', true], ['Unsubscribe', true], ['Sair', true], ['cancelar', true], ['Stop all', true]];
  for (const [txt, expect] of variants) { await seed(); await grant(); await stop(txt); ok(((await rec('g1')).status === 'revoked') === expect, `reconhecido: «${txt.trim()}»`); }
  const wanted = ['Pare', 'pára', 'Pára!', 'PÁRA', 'Para', 'Cancel', 'QUIT', 'END', 'Remover', 'Não quero receber mais mensagens', 'nao quero mais', 'Deixem de me enviar mensagens', 'não me mandem mais nada', 'opt out', 'Opt-out', '🛑 STOP', '  sTOp  \n', 'PARE JÁ', 'Quit please', 'Remove me'];
  for (const txt of wanted) { await seed(); await grant(); await stop(txt); ok((await rec('g1')).status === 'revoked', `STOP também reconhece «${txt}»`); }
  for (const txt of ['Sim, obrigada', 'A que horas é o jantar?', 'ok', 'Para quando é o casamento?', 'Para a mesa 3, obrigada', 'Vou estar lá, sem falta', 'Podem enviar a morada?', '']) { await seed(); await grant(); await stop(txt); ok((await rec('g1')).status === 'granted', `não revoga com «${txt}»`); }

  // 9. Conteúdo desnecessário da mensagem
  await seed(); await grant(); await stop('STOP');
  let inbox = (await db.collection('whatsappInbox').get()).docs.map((d) => d.data());
  const keys = Object.keys(inbox[0] || {}).sort().join(',');
  ok(inbox.length === 1 && inbox[0].kind === 'stop' && inbox[0].guestId === 'g1', 'whatsappInbox: um registo "stop" ligado ao convidado');
  ok(keys === 'guestId,kind,receivedAt,type,waMessageId,weddingId', 'whatsappInbox: só campos mínimos (sem texto, sem número, sem nome, sem payload bruto): ' + keys);
  ok(!JSON.stringify(inbox).includes('Nome Privado') && !JSON.stringify(inbox).includes('351912345678') && !JSON.stringify(inbox).includes('STOP'), 'whatsappInbox: nome, número e texto da mensagem não aparecem em lado nenhum');
  await stop('Olá, tudo bem? Um segredo pessoal', '+351900000000');
  inbox = (await db.collection('whatsappInbox').get()).docs.map((d) => d.data());
  ok(inbox.length === 2 && inbox.filter((x) => x.kind === 'message' && x.guestId === null).length === 1 && !JSON.stringify(inbox).includes('segredo'), 'mensagem de número desconhecido: registo mínimo sem conteúdo');
  // revogação com data e origem
  const rv = await rec('g1');
  ok(rv.status === 'revoked' && rv.revokedWhy === 'whatsapp_stop' && !!rv.revokedAtISO && rv.history.some((h) => h.event === 'revoked' && h.why === 'whatsapp_stop' && h.at), 'revogação registada com data e origem (whatsapp_stop)');
  ok(!JSON.stringify(rv).toLowerCase().includes('"stop"'), 'registo de revogação não guarda o texto da mensagem');

  console.log(`\n${pass} OK, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });
