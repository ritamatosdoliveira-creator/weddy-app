/* Google Calendar (Fase I) — servidor. Emulador Firestore; a API do Google é SIMULADA em memória
 * (global.fetch intercepta *.googleapis.com / accounts.google.com). NENHUMA chamada real, NENHUMA
 * credencial real: os "segredos" abaixo são valores falsos só para o teste.
 * Valida: OAuth state (CSRF/reutilização/expiração), scopes, tokens cifrados, ligação, sync sem duplicados,
 * atualização/eliminação/recriação, falhas parciais e de rede, REAUTH, desconexão, Premium, isolamento. */
'use strict';
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
process.env.GOOGLE_CALENDAR_CLIENT_ID = 'fake-client-id-TEST';
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'fake-client-secret-TEST';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

const realST = global.setTimeout;
global.setTimeout = (fn, ms, ...a) => realST(fn, (ms >= 1000 && ms <= 8300 && a.length === 0) ? 2 : ms, ...a); // só os recuos do fetchWithBackoff

// ---------- Google simulado ----------
const G = { events: {}, calls: [], revoked: [], calendars: null, tokenMode: 'ok', failEvents: null, netFail: false, codeTokens: null };
const resetG = () => {
  G.events = {}; G.calls = []; G.revoked = []; G.tokenMode = 'ok'; G.failEvents = null; G.netFail = false; G.codeTokens = null;
  G.calendars = [
    { id: 'rita@gmail.com', summary: 'Rita', accessRole: 'owner', primary: true, timeZone: 'Europe/Lisbon' },
    { id: 'cal-casamento', summary: 'Casamento', accessRole: 'writer', timeZone: 'Europe/Lisbon' },
    { id: 'cal-readonly', summary: 'Feriados', accessRole: 'reader' },
  ];
};
const J = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body || {}) });
global.fetch = async (url, opts) => {
  opts = opts || {}; const u = new URL(String(url)); const m = opts.method || 'GET';
  if (G.netFail) throw new Error('network down');
  G.calls.push({ m, host: u.host, path: u.pathname, auth: opts.headers && opts.headers.Authorization, body: opts.body });
  if (u.host === 'oauth2.googleapis.com' && u.pathname === '/token') {
    const p = new URLSearchParams(String(opts.body));
    if (p.get('grant_type') === 'authorization_code') {
      if (G.tokenMode === 'bad_code') return J(400, { error: 'invalid_grant' });
      return J(200, G.codeTokens || { access_token: 'AT-1', refresh_token: 'RT-SECRET-123', expires_in: 3600, scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly', token_type: 'Bearer' });
    }
    if (G.tokenMode === 'revoked') return J(400, { error: 'invalid_grant' });
    if (G.tokenMode === 'down') return J(503, {});
    return J(200, { access_token: 'AT-REFRESHED', expires_in: 3600 });
  }
  if (u.host === 'oauth2.googleapis.com' && u.pathname === '/revoke') { G.revoked.push(u.searchParams.get('token')); return J(200, {}); }
  if (u.pathname === '/calendar/v3/users/me/calendarList') return J(200, { items: G.calendars });
  const mm = u.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/(.+))?$/);
  if (mm) {
    const cal = decodeURIComponent(mm[1]); const id = mm[2] && decodeURIComponent(mm[2]);
    const key = cal + '|' + (id || '');
    if (G.failEvents && G.failEvents(m, id, opts)) return J(500, { error: 'boom' });
    if (m === 'POST') { const b = JSON.parse(opts.body); const k = cal + '|' + b.id; if (G.events[k]) return J(409, {}); G.events[k] = b; return J(200, b); }
    if (m === 'PUT') { if (!G.events[key]) return J(404, {}); G.events[key] = Object.assign({}, JSON.parse(opts.body), { id }); return J(200, G.events[key]); }
    if (m === 'DELETE') { if (!G.events[key]) return J(404, {}); delete G.events[key]; return J(204, {}); }
    if (m === 'GET') return J(200, { items: Object.values(G.events) });
  }
  throw new Error('fetch inesperado: ' + url);
};
const evCalls = (m) => G.calls.filter((c) => c.path.includes('/events') && (!m || c.m === m));

// ---------- helpers ----------
const authOf = (email, verified) => ({ uid: 'uid-' + email, token: { email, email_verified: verified === undefined ? true : verified } });
const call = (fn, auth, data) => fn.run({ auth, data: data || {}, rawRequest: {} });
const nowIso = () => new Date().toISOString();
const monthsAgo = (n) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString(); };
const PREM = () => ({ active: true, startedAt: nowIso() });
const STATE = () => ({ daySchedule: [{ id: 's1', time: '16:00', label: 'Cerimónia', place: 'Quinta X' }, { id: 's2', time: '18:30', label: 'Copo de água' }], expenses: [{ id: 'e1', desc: 'Fotógrafo', value: 1000, paid: 200, dueDate: '2027-03-01' }], dressVisits: [] });
async function mkWedding(id, owner, sub, st) {
  await db.collection('weddings').doc(id).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], ...(sub === undefined ? {} : { subscription: sub }), settings: { weddingDate: '2027-06-05', rsvpDeadline: '2027-04-01', timeZone: 'Europe/Lisbon' }, json: JSON.stringify(st || STATE()) });
}
async function wipe() {
  for (const id of ['W1', 'W2', 'W3']) { try { await db.recursiveDelete(db.collection('weddings').doc(id)); } catch (e) { /* */ } }
  const s = await db.collection('oauthStates').get(); await Promise.all(s.docs.map((d) => d.ref.delete()));
}
async function expectErr(p, code, label, msgPart) {
  try { await p; ok(false, label + ' (devia falhar)'); } catch (e) { ok(e.code === code && (!msgPart || String(e.message).includes(msgPart)), `${label} → ${code}${e.code !== code ? ' [obtido ' + e.code + ': ' + e.message + ']' : ''}`); }
}
const fakeRes = () => { const r = { loc: null, redirect(u) { r.loc = u; } }; return r; };
const callback = async (q) => { const res = fakeRes(); await fns.googleCalendarOAuthCallback({ query: q, method: 'GET', headers: {} }, res); return res.loc; };
const integ = async (w) => { const s = await db.collection('weddings').doc(w).collection('integrations').doc('googleCalendar').get(); return s.exists ? s.data() : null; };
const cred = async (w) => { const s = await db.collection('weddings').doc(w).collection('privateIntegrations').doc('googleCalendar').get(); return s.exists ? s.data() : null; };
const mappings = async (w) => (await db.collection('weddings').doc(w).collection('integrations').doc('googleCalendar').collection('events').get()).docs.map((d) => d.data());
const unthrottle = (w) => db.collection('weddings').doc(w).collection('integrations').doc('googleCalendar').set({ lastSyncAt: new Date(Date.now() - 120000), syncInProgress: false }, { merge: true });
const A = authOf('a@x.pt'), B = authOf('b@x.pt');

(async () => {
  resetG(); await wipe();
  await mkWedding('W1', 'a@x.pt', PREM());
  await mkWedding('W2', 'b@x.pt', PREM());

  // ===== AUTENTICAÇÃO / PREMIUM nas funções callable =====
  const callables = { start: fns.googleCalendarStartOAuth, list: fns.googleCalendarListCalendars, connect: fns.googleCalendarConnectCalendar, sync: fns.googleCalendarSync, finalize: fns.googleCalendarFinalizeOAuth, events: fns.googleCalendarListEvents, create: fns.googleCalendarCreateEvent, del: fns.googleCalendarDeleteEvent, disc: fns.googleCalendarDisconnect };
  for (const [n, f] of Object.entries(callables)) {
    await expectErr(call(f, null, {}), 'unauthenticated', n + ': sem sessão');
    await expectErr(call(f, authOf('a@x.pt', false), {}), 'unauthenticated', n + ': e-mail não verificado');
    await expectErr(call(f, authOf('a@x.pt', 'true'), {}), 'unauthenticated', n + ': email_verified string "true"');
    await expectErr(call(f, authOf('zz@x.pt'), {}), 'not-found', n + ': conta sem casamento');
  }
  ok(G.calls.length === 0, 'recusas de autenticação não chamam o Google');

  // ===== OAUTH: início =====
  const s1 = await call(callables.start, A);
  const au = new URL(s1.authorizationUrl); const state1 = au.searchParams.get('state');
  ok(au.host === 'accounts.google.com' && au.searchParams.get('response_type') === 'code', 'authorizationUrl aponta ao Google (code flow)');
  const scopes = au.searchParams.get('scope').split(' ').sort();
  ok(scopes.length === 2 && scopes[0].endsWith('/calendar.calendarlist.readonly') && scopes[1].endsWith('/calendar.events'), 'scopes mínimos: calendar.events + calendarlist.readonly (sem email/contactos/calendar total)');
  ok(!/gmail|contacts|drive|userinfo|openid/.test(au.searchParams.get('scope')), 'nenhum scope de e-mail/contactos/Drive');
  ok(au.searchParams.get('access_type') === 'offline' && !s1.authorizationUrl.includes('fake-client-secret') && !s1.authorizationUrl.includes('RT-'), 'URL sem segredos; offline para refresh token');
  ok(/^[0-9a-f]{48}$/.test(state1), 'state aleatório de 24 bytes');
  const st1 = (await db.collection('oauthStates').doc(state1).get()).data();
  ok(st1.uid === 'uid-a@x.pt' && st1.weddingId === 'W1' && st1.used === false, 'state guarda uid + weddingId no servidor (não vem do cliente)');
  const s1b = await call(callables.start, A, { weddingId: 'W2', uid: 'x' });
  ok((await db.collection('oauthStates').doc(new URL(s1b.authorizationUrl).searchParams.get('state')).get()).data().weddingId === 'W1', 'manipular weddingId no pedido não muda o casamento do state');

  // ===== OAUTH: callback =====
  ok((await callback({ error: 'access_denied', state: state1 })).endsWith('?googleCalendar=cancelled'), 'consentimento cancelado → cancelled');
  ok((await callback({})).endsWith('?googleCalendar=error'), 'callback sem code/state → error');
  ok((await callback({ code: 'c', state: 'inventado' })).endsWith('?googleCalendar=error'), 'state desconhecido (CSRF) → error');
  ok((await callback({ code: 'c', state: ['a', 'b'] })).endsWith('?googleCalendar=error'), 'state como array → error');
  ok(G.calls.length === 0, 'callbacks inválidos nunca chegam ao Google (sem troca de code)');
  await db.collection('oauthStates').doc(state1).update({ createdAt: new Date(Date.now() - 11 * 60 * 1000) });
  ok((await callback({ code: 'c', state: state1 })).endsWith('?googleCalendar=error'), 'state expirado (>10 min) → error');
  const s2 = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state');
  G.tokenMode = 'bad_code';
  ok((await callback({ code: 'c', state: s2 })).endsWith('?googleCalendar=error') && !(await cred('W1')), 'Google recusa o code → error e nada guardado');
  ok((await callback({ code: 'c', state: s2 })).endsWith('?googleCalendar=error'), 'state já usado não volta a servir (uso único)');
  G.tokenMode = 'ok';
  const s3 = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state');
  G.codeTokens = { access_token: 'AT-1', expires_in: 3600, scope: 'x' };
  ok((await callback({ code: 'c', state: s3 })).endsWith('?googleCalendar=error') && !(await cred('W1')), 'sem refresh_token → error, nada guardado'); G.codeTokens = null;
  const s4 = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state');
  const loc = await callback({ code: 'good', state: s4 });
  ok(/\?googleCalendar=pending&gstate=[0-9a-f]{48}&gfs=[0-9a-f]{48}$/.test(loc) && !/token|RT-|AT-/i.test(loc), 'callback devolve «pending» + segredo de finalização; URL sem tokens');
  ok(!(await cred('W1')) && !(await integ('W1')), 'LOGIN-CSRF: o callback sozinho NÃO liga nada ao casamento');
  const gs = new URL(loc).searchParams.get('gstate'), gfs = new URL(loc).searchParams.get('gfs');
  ok(gs === s4 && !JSON.stringify((await db.collection('oauthStates').doc(s4).get()).data()).includes('RT-SECRET'), 'tokens em espera só cifrados no state');
  // ataque: a vítima (B) completa o consentimento iniciado por A → o segredo vai para o browser da vítima, mas o uid não coincide
  await expectErr(call(callables.finalize, B, { state: gs, secret: gfs }), 'failed-precondition', 'finalizar com sessão de OUTRO utilizador (login-CSRF) é recusado', 'OAUTH_FINALIZE_INVALID');
  ok(!(await cred('W1')) && !(await cred('W2')), 'tentativa de outro utilizador não liga nada a nenhum casamento');
  // atacante que conhece o state mas não o segredo
  const sx = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state');
  const locx = await callback({ code: 'good', state: sx });
  await expectErr(call(callables.finalize, A, { state: sx, secret: 'f'.repeat(48) }), 'failed-precondition', 'finalizar com state certo e segredo ERRADO é recusado', 'OAUTH_FINALIZE_INVALID');
  await expectErr(call(callables.finalize, A, { state: sx, secret: new URL(locx).searchParams.get('gfs') }), 'failed-precondition', 'depois de uma tentativa falhada o state fica queimado', 'OAUTH_FINALIZE_INVALID');
  await expectErr(call(callables.finalize, A, { state: '../x', secret: 'zz' }), 'failed-precondition', 'state/segredo malformados', 'OAUTH_FINALIZE_INVALID');
  await expectErr(call(callables.finalize, A, {}), 'failed-precondition', 'finalizar sem parâmetros', 'OAUTH_FINALIZE_INVALID');
  await expectErr(call(callables.finalize, null, { state: gs, secret: gfs }), 'unauthenticated', 'finalizar sem sessão');
  await expectErr(call(callables.finalize, authOf('a@x.pt', false), { state: gs, secret: gfs }), 'unauthenticated', 'finalizar com e-mail não verificado');
  // pending expirado
  await db.collection('oauthStates').doc(gs).update({ pendingAt: new Date(Date.now() - 11 * 60 * 1000) });
  await expectErr(call(callables.finalize, A, { state: gs, secret: gfs }), 'failed-precondition', 'pending expirado (>10 min) é recusado', 'OAUTH_FINALIZE_INVALID');
  // fluxo legítimo
  const s4b = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state');
  const loc2 = await callback({ code: 'good', state: s4b });
  const fin1 = await call(callables.finalize, A, { state: new URL(loc2).searchParams.get('gstate'), secret: new URL(loc2).searchParams.get('gfs') });
  ok(fin1.ok === true, 'finalização legítima (mesma sessão + segredo do redirect)');
  await expectErr(call(callables.finalize, A, { state: s4b, secret: new URL(loc2).searchParams.get('gfs') }), 'failed-precondition', 'repetir a finalização (replay) é recusado', 'OAUTH_FINALIZE_INVALID');
  ok(!(await db.collection('oauthStates').doc(s4b).get()).exists, 'tokens em espera apagados após finalizar');
  const c1 = await cred('W1'), i1 = await integ('W1');
  ok(c1 && c1.encryptedRefreshToken && !JSON.stringify(c1).includes('RT-SECRET-123'), 'refresh token guardado CIFRADO (AES-GCM) — texto simples ausente');
  ok(/^[^:]+:[^:]+:[^:]+$/.test(c1.encryptedRefreshToken), 'formato iv:tag:cifra');
  ok(i1.connected === true && i1.status === 'CONNECTED' && !JSON.stringify(i1).includes('RT-SECRET') && !JSON.stringify(i1).includes('AT-1'), 'documento público de integração sem tokens');
  ok(i1.googleAccountEmail === 'rita@gmail.com', 'conta Google identificada pelo calendário principal (sem scope de e-mail)');
  ok(!G.calls.some((c) => c.path.includes('userinfo')), 'já não chama /userinfo (precisaria de scope extra)');

  // Premium termina entre o consentimento e a finalização
  await db.collection('weddings').doc('W2').update({ subscription: { active: true, startedAt: monthsAgo(13) } });
  const sB2 = new URL((await call(callables.start, B).catch(() => ({ authorizationUrl: 'http://x/?state=none' }))).authorizationUrl).searchParams.get('state');
  ok(sB2 === 'none', 'Premium expirado: nem sequer inicia o OAuth');
  await db.collection('weddings').doc('W2').update({ subscription: PREM() });

  // ===== listar / escolher calendário =====
  const lc = await call(callables.list, A);
  ok(lc.calendars.map((c) => c.id).sort().join() === 'cal-casamento,rita@gmail.com', 'lista só calendários onde se pode escrever (sem readonly)');
  await expectErr(call(callables.connect, A, {}), 'invalid-argument', 'connect sem calendarId');
  await expectErr(call(callables.connect, A, { calendarId: 123 }), 'invalid-argument', 'connect calendarId não-string');
  await expectErr(call(callables.connect, A, { calendarId: 'cal-readonly' }), 'permission-denied', 'connect calendário só de leitura');
  await expectErr(call(callables.connect, A, { calendarId: 'calendario-de-outra-pessoa' }), 'permission-denied', 'connect calendário inexistente/alheio');
  ok(!(await integ('W1')).calendarId, 'tentativas inválidas não gravam calendarId');
  G.calls = [];
  await call(callables.connect, A, { calendarId: 'cal-casamento' });
  const items1 = Object.values(G.events);
  ok(items1.length === 4, `primeira sync cria 4 eventos (2 programa + RSVP + pagamento) [${items1.length}]`);
  ok(evCalls('POST').length === 4 && new Set(evCalls('POST').map((c) => JSON.parse(c.body).id)).size === 4, 'IDs determinísticos distintos');
  ok(items1.every((e) => /^evt[0-9a-f]{64}$/.test(e.id)), 'IDs Google válidos (evt + sha256)');
  const sched = items1.find((e) => /Cerimónia/.test(e.summary));
  ok(sched.start.dateTime === '2027-06-05T16:00:00' && sched.start.timeZone === 'Europe/Lisbon', 'hora «de parede» + fuso do casamento (sem deslocar para UTC)');
  ok(evCalls().every((c) => c.auth === 'Bearer AT-REFRESHED'), 'usa o access token obtido por refresh (nunca guarda access token)');
  ok((await mappings('W1')).length === 4 && (await integ('W1')).lastSyncStatus === 'success', 'mapeamentos gravados; estado success');
  ok(!JSON.stringify(await integ('W1')).includes('AT-REFRESHED'), 'access token nunca persistido');

  // ===== sincronização repetida: sem duplicados =====
  await expectErr(call(callables.sync, A), 'resource-exhausted', 'sync repetida <30 s é recusada', 'SYNC_TOO_SOON');
  await unthrottle('W1'); G.calls = [];
  await call(callables.sync, A);
  ok(evCalls().length === 0 && Object.keys(G.events).length === 4, 'sync repetida sem alterações: 0 chamadas de eventos, 0 duplicados');
  // lock concorrente
  await db.collection('weddings').doc('W1').collection('integrations').doc('googleCalendar').set({ syncInProgress: true, syncLockAt: new Date(), lastSyncAt: new Date(Date.now() - 120000) }, { merge: true });
  await expectErr(call(callables.sync, A), 'already-exists', 'sync concorrente é recusada', 'SYNC_ALREADY_RUNNING');
  await db.collection('weddings').doc('W1').collection('integrations').doc('googleCalendar').set({ syncInProgress: true, syncLockAt: new Date(Date.now() - 6 * 60 * 1000) }, { merge: true });
  await call(callables.sync, A); ok(true, 'lock antigo (>5 min) destrava sozinho');

  // ===== atualizar / apagar / recriar =====
  let st = STATE(); st.daySchedule[0].time = '16:30'; st.daySchedule.pop(); await db.collection('weddings').doc('W1').update({ json: JSON.stringify(st) });
  await unthrottle('W1'); G.calls = [];
  await call(callables.sync, A);
  ok(evCalls('PUT').length === 1 && evCalls('DELETE').length === 1 && evCalls('POST').length === 0, 'alterar 1 + remover 1 → 1 PUT + 1 DELETE (sem POST)');
  ok(Object.keys(G.events).length === 3 && (await mappings('W1')).length === 3, 'Google e mapeamentos coerentes (3)');
  // apagado à mão no Google → recria (Weddy é a fonte de verdade)
  const rsvpKey = Object.keys(G.events).find((k) => /RSVP/.test(G.events[k].summary)); delete G.events[rsvpKey];
  st = STATE(); st.daySchedule[0].time = '17:00'; await db.collection('weddings').doc('W1').update({ json: JSON.stringify(st) });
  await unthrottle('W1'); G.calls = [];
  await call(callables.sync, A);
  ok(Object.values(G.events).some((e) => /RSVP/.test(e.summary)) === false, 'evento apagado no Google só é recriado se mudar na Weddy (idempotência por hash — comportamento documentado)');
  await db.collection('weddings').doc('W1').update({ settings: { weddingDate: '2027-06-05', rsvpDeadline: '2027-04-02', timeZone: 'Europe/Lisbon' } });
  await unthrottle('W1'); G.calls = [];
  await call(callables.sync, A);
  const rsvps = Object.values(G.events).filter((e) => /RSVP/.test(e.summary));
  ok(rsvps.length === 1 && rsvps[0].start.date === '2027-04-02', 'evento removido externamente é recriado (404 → POST) sem duplicar');
  // 409 no POST → PUT
  const keyOf = Object.keys(G.events)[0]; const saved = G.events[keyOf];
  await db.collection('weddings').doc('W1').collection('integrations').doc('googleCalendar').collection('events').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
  st = STATE(); st.daySchedule[0].label = 'Cerimónia civil'; await db.collection('weddings').doc('W1').update({ json: JSON.stringify(st) });
  await unthrottle('W1'); G.calls = [];
  await call(callables.sync, A);
  ok(Object.keys(G.events).length === 4, 'sem mapeamentos locais: 409 do Google → PUT, sem duplicar (4 eventos) [' + Object.keys(G.events).length + ': ' + Object.values(G.events).map((e) => e.summary).join(' / ') + ']');
  ok(new Set(Object.values(G.events).map((e) => e.id)).size === Object.keys(G.events).length, 'IDs únicos no Google após recuperação');

  // ===== falhas =====
  await unthrottle('W1'); st = STATE(); st.expenses[0].dueDate = '2027-03-02'; await db.collection('weddings').doc('W1').update({ json: JSON.stringify(st) });
  G.failEvents = (m, id) => m === 'PUT' || m === 'POST'; 
  await call(callables.sync, A);
  const ip = await integ('W1');
  ok(ip.lastSyncStatus === 'partial' && ip.lastSyncFailedItems >= 1 && /^PARTIAL_/.test(ip.lastSyncError), 'falhas parciais da API deixam de aparecer como «success»'); G.failEvents = null;
  await unthrottle('W1'); G.netFail = true;
  try { await call(callables.sync, A); ok(false, 'rede em baixo: devia falhar'); } catch (e) { ok(/network down/.test(e.message), 'rede em baixo durante a sync → erro (em produção o wrapper devolve «internal»)'); } G.netFail = false;
  ok((await integ('W1')).lastSyncStatus === 'error' && (await integ('W1')).syncInProgress === false, 'falha de rede: estado error e lock libertado');
  await unthrottle('W1'); G.tokenMode = 'down';
  await expectErr(call(callables.sync, A), 'internal', 'Google indisponível (503) ao renovar token'); G.tokenMode = 'ok';
  await unthrottle('W1'); G.tokenMode = 'revoked';
  await expectErr(call(callables.sync, A), 'failed-precondition', 'token revogado no Google', 'REAUTH_REQUIRED');
  ok((await integ('W1')).status === 'REAUTH_REQUIRED', 'estado REAUTH_REQUIRED registado para o cliente pedir nova autorização'); G.tokenMode = 'ok';

  // ===== ISOLAMENTO =====
  G.calls = [];
  await expectErr(call(callables.sync, B), 'failed-precondition', 'B sem ligação própria não sincroniza (não usa a de A)', 'NOT_CONNECTED');
  await expectErr(call(callables.events, B, { weddingId: 'W1' }), 'failed-precondition', 'B com weddingId=W1 no pedido continua preso a W2', 'NOT_CONNECTED');
  await call(callables.disc, B, { weddingId: 'W1' });
  ok((await cred('W1')) && (await integ('W1')).connected === true, 'B (disconnect com weddingId=W1) não toca na ligação de A');
  ok(!G.calls.some((c) => c.path.includes('/events')), 'nenhuma chamada a eventos de A feita em nome de B');
  const sB = new URL((await call(callables.start, B)).authorizationUrl).searchParams.get('state');
  ok((await db.collection('oauthStates').doc(sB).get()).data().weddingId === 'W2', 'state de B pertence a W2');

  // ===== PREMIUM =====
  for (const [nome, sub] of [['sem subscrição', undefined], ['active=false', { active: false, startedAt: nowIso() }], ['expirada (13 meses)', { active: true, startedAt: monthsAgo(13) }]]) {
    await mkWedding('W3', 'c@x.pt', sub); const C = authOf('c@x.pt');
    for (const [n, f] of Object.entries(callables)) { if (n === 'disc') continue; await expectErr(call(f, C, {}), 'permission-denied', `${n} sem Premium (${nome})`); }
  }
  ok(!G.calls.some((c) => c.host.includes('googleapis') || c.host.includes('accounts')), 'sem Premium: nenhuma chamada ao Google');
  // ligação existente + Premium expira: dados preservados, sync bloqueada, desconexão permitida
  await db.collection('weddings').doc('W1').update({ subscription: { active: true, startedAt: monthsAgo(13) } });
  const jsonBefore = (await db.collection('weddings').doc('W1').get()).data().json;
  await unthrottle('W1'); G.calls = [];
  await expectErr(call(callables.sync, A), 'permission-denied', 'Premium expirado: nova sincronização bloqueada no servidor');
  ok(Object.keys(G.events).length >= 3 && (await mappings('W1')).length >= 3, 'Premium expirado: eventos no Google e mapeamentos NÃO são apagados');
  ok((await integ('W1')).connected === true, 'Premium expirado: ligação mantém-se (só para consulta/desligar)');
  const rt = G.revoked.length;
  const nEv = Object.keys(G.events).length;
  await call(callables.disc, A);
  ok(G.revoked.length === rt + 1 && G.revoked[G.revoked.length - 1] === 'RT-SECRET-123', 'desconexão sem Premium revoga o refresh token no Google');
  ok(!(await cred('W1')) && (await integ('W1')).connected === false && (await integ('W1')).status === 'DISCONNECTED', 'credenciais apagadas; estado DISCONNECTED');
  ok((await mappings('W1')).length === 0 && !(await integ('W1')).calendarId, 'mapeamentos e calendário removidos');
  ok(Object.keys(G.events).length === nEv && evCalls('DELETE').length === 0, 'desconexão NÃO apaga eventos do Google Calendar');
  ok((await db.collection('weddings').doc('W1').get()).data().json === jsonBefore, 'dados do casamento intactos');
  await expectErr(call(callables.sync, A), 'permission-denied', 'depois de desligar e sem Premium continua sem sync');
  await call(callables.disc, A); ok(true, 'desconectar duas vezes não falha (idempotente)');

  // revogação falha no Google → desconexão continua
  await db.collection('weddings').doc('W1').update({ subscription: PREM() });
  const s5 = new URL((await call(callables.start, A)).authorizationUrl).searchParams.get('state'); const l5 = new URL(await callback({ code: 'good', state: s5 })); await call(callables.finalize, A, { state: l5.searchParams.get('gstate'), secret: l5.searchParams.get('gfs') });
  ok(!!(await cred('W1')), 'religa (nova ligação com Premium)');
  G.netFail = true; await call(callables.disc, A); G.netFail = false;
  ok(!(await cred('W1')), 'revogação falhou na rede → credenciais locais apagadas na mesma');

  console.log(`\nRESULT passed=${pass} failed=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(2); });
