/* K.3-A — estado da API WhatsApp para a UI. (1) servidor: getWhatsappApiStatus (emulador, sem rede);
 * (2) cliente: GuestCommsService do app/index.html real, executado em vm com Firebase simulado. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
delete process.env.WHATSAPP_API_ENABLED;
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const call = async (auth) => { try { return { r: await fns.getWhatsappApiStatus.run({ auth, data: {}, rawRequest: {} }) }; } catch (e) { return { code: e.code }; } };
(async () => {
  await admin.firestore().collection('weddings').doc('wWA').set({ ownerEmails: ['a@t.pt'], ownerUids: ['u1'], json: '{}' });
  const OK = { uid: 'u1', token: { email: 'a@t.pt', email_verified: true } };
  let x = await call(null); ok(x.code === 'unauthenticated', 'sem sessão → unauthenticated');
  x = await call({ uid: 'u2', token: { email: 'a@t.pt', email_verified: false } }); ok(x.code === 'unauthenticated', 'email não verificado → recusado');
  x = await call({ uid: 'u3', token: { email: 'sem-casamento@t.pt', email_verified: true } }); ok(x.code === 'not-found', 'utilizador sem casamento → recusado');
  x = await call(OK); ok(x.r && x.r.enabled === false, 'flag ausente → enabled=false');
  process.env.WHATSAPP_API_ENABLED = 'false'; x = await call(OK); ok(x.r.enabled === false, 'flag false → false');
  process.env.WHATSAPP_API_ENABLED = 'true'; x = await call(OK); ok(x.r.enabled === true, 'flag true (só em teste) → true');
  ok(Object.keys(x.r).join() === 'enabled', 'resposta só tem o booleano (sem dados de casamentos)');
  delete process.env.WHATSAPP_API_ENABLED;
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');
  const i = src.indexOf('const GuestCommsService = {'); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
  const mk = (cf) => { const ctx = { cloudFunctions: cf, ta: (k) => k, guestPhoneErrorMessage: () => 'g', whatsappSendErrorMessage: (e) => 'msg:' + (e && e.code), console: { error() {} } }; vm.createContext(ctx); vm.runInContext(src.slice(i, j + 1) + '\nthis.G=GuestCommsService;', ctx); return ctx.G; };
  let calls = [];
  const cfWith = (fn) => ({ httpsCallable: (n) => async (p) => { calls.push(n); return fn(n, p); } });
  let G = mk(cfWith((n) => (n === 'getWhatsappApiStatus' ? { data: { enabled: false } } : { data: { messageId: 'm' } })));
  ok(G.whatsappApiVisible() === false, 'por defeito: botão oculto (antes de qualquer resposta)');
  await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'servidor diz false → oculto');
  let r = await G.sendWhatsappRsvpReminder('g1'); ok(r.ok === false && !calls.includes('sendWhatsappRsvpReminder'), 'oculto: o cliente nem chama o envio');
  G = mk(cfWith(() => ({ data: { enabled: true } }))); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === true, 'servidor diz true → visível');
  G = mk(cfWith(() => ({ data: { enabled: 'true' } }))); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'valor não booleano estrito → oculto');
  G = mk(cfWith(() => ({ data: {} }))); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'resposta sem campo → oculto');
  G = mk(cfWith(() => { throw Object.assign(new Error('x'), { code: 'unavailable' }); })); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'função indisponível → oculto');
  G = mk(cfWith(() => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); })); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'sem permissões → oculto');
  G = mk(null); await G.refreshWhatsappApiStatus(); ok(G.whatsappApiVisible() === false, 'sem ligação ao Firebase → oculto');
  ok(!/_waApiEnabled\s*=\s*true/.test(src.replace(/this\._waApiEnabled\s*=\s*!!\(/, '')), 'o cliente não tem forma de se auto-ativar (nenhuma atribuição direta a true)');
  ok(/wa\.me\//.test(src) && /btnSendWhatsappInvite/.test(src), 'fluxos manuais wa.me preservados');
  console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
