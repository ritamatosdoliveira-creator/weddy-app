/* Weddy Invitations — envio e distribuição (servidor). Emulador Firestore; SMTP simulado; sem rede.
 * Valida: Premium, isolamento, ligações individuais, famílias, duplicados, concorrência, limite diário,
 * falhas SMTP e reenvio, texto editável sem injeção, distribuição separada do RSVP. */
'use strict';
const path = require('path');
process.env.SMTP_FROM = 'Weddy <geral@weddy.pt>'; process.env.SMTP_HOST = 'smtp.test'; process.env.SMTP_PORT = '465'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
process.env.INVITATION_EMAILS_PER_DAY = '50';
const nodemailer = require('nodemailer');
const sent = []; let failFor = null; let delayMs = 0; let hold = null;
nodemailer.createTransport = () => ({ sendMail: async (m) => {
  if (hold) await hold;
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  if (failFor && (failFor === true || failFor.has(m.to))) { const e = new Error('SMTP 550'); e.code = 'EENVELOPE'; throw e; }
  sent.push(m); return { accepted: [m.to] };
} });
const admin = require('firebase-admin');
const fns = require(path.join(__dirname, '..', '..', 'index.js'));
const db = admin.firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const authOf = (email, verified) => ({ uid: 'uid-' + email, token: { email, email_verified: verified === undefined ? true : verified } });
const call = (fn, auth, data) => fn.run({ auth, data: data || {}, rawRequest: {} });
const PREM = () => ({ active: true, startedAt: new Date().toISOString() });
const LAPSED = () => ({ active: true, startedAt: '2023-01-01T00:00:00Z' });
const A = authOf('a@x.pt'), B = authOf('b@x.pt');
const send = fns.sendInvitationEmails, prev = fns.previewInvitationEmail, share = fns.recordInvitationShare, info = fns.getInvitationShareInfo;
const sha = (t) => require('crypto').createHash('sha256').update(t).digest('hex').slice(0, 32);
async function err(p, code, label, dc) { try { await p; ok(false, label + ' (devia falhar)'); } catch (e) { ok(e.code === code && (!dc || (e.details && e.details.code === dc)), `${label} → ${code}${e.code !== code ? ' (obtido ' + e.code + ')' : ''}`); } }
async function wipe() { for (const c of ['weddings', 'weddingInvitations', 'publicInvitations', 'guests', 'invitationDeliveries', 'invitationQuota', 'siteRateLimits']) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); } }
async function mk(id, owner, sub) { await db.collection('weddings').doc(id).set({ ownerEmails: [owner], ownerUids: ['uid-' + owner], ...(sub ? { subscription: sub } : {}), settings: {}, json: '{}' }); }
async function pubInv(id, slug, extra) { await db.collection('weddingInvitations').doc(id).set({ weddingId: id, slug, status: 'published', publishedVersion: 1, publishedConfig: { names: 'Rita & Tiago', lang: 'pt' }, ...(extra || {}) }); }
async function guest(token, wid, o) { const d = { weddingId: wid, name: 'Ana Silva', email: 'ana@ex.pt', attending: null, ...(o || {}) }; Object.keys(d).forEach((k) => d[k] === undefined && delete d[k]); await db.collection('guests').doc(token).set(d); }
const resetRate = async () => { const q = await db.collection('siteRateLimits').get(); await Promise.all(q.docs.map((d) => d.ref.delete())); };
const del = async (t, ch) => { const s = await db.collection('invitationDeliveries').doc(sha(t) + '_' + (ch || 'email')).get(); return s.exists ? s.data() : null; };
const quota = async (w) => { const s = await db.collection('invitationQuota').get(); const d = s.docs.find((x) => x.id.startsWith(w + '_')); return d ? d.data().count : 0; };
const T1 = 'r' + 'a'.repeat(32), T2 = 'r' + 'b'.repeat(32), T3 = 'r' + 'c'.repeat(32), TF = 'r' + 'f'.repeat(32), TO = 'r' + '9'.repeat(32);

(async () => {
  await wipe();
  await mk('W1', 'a@x.pt', PREM()); await mk('W2', 'b@x.pt', PREM()); await mk('W3', 'c@x.pt', LAPSED()); await mk('W4', 'd@x.pt', null);
  await pubInv('W1', 'rita-tiago-ab12c'); await pubInv('W2', 'outro-casal-12345'); await pubInv('W3', 'caducado-12345'); await pubInv('W4', 'semsub-12345');
  await guest(T1, 'W1'); await guest(T2, 'W1', { name: 'Bruno', email: 'bruno@ex.pt' }); await guest(T3, 'W1', { name: 'Sem Email', email: '' });
  await guest(TO, 'W2', { name: 'De Outro Casamento', email: 'outro@ex.pt' });

  // ---- acesso
  for (const [n, f] of Object.entries({ send, prev, share, info })) {
    await err(call(f, null, { units: [{ token: T1 }] }), 'unauthenticated', n + ': sem sessão');
    await err(call(f, authOf('a@x.pt', false), { units: [{ token: T1 }] }), 'unauthenticated', n + ': email não verificado');
    await err(call(f, authOf('zz@x.pt'), { units: [{ token: T1 }] }), 'not-found', n + ': sem casamento');
    await err(call(f, authOf('c@x.pt'), { units: [{ token: T1 }] }), 'permission-denied', n + ': Premium expirado (validado no servidor)');
    await err(call(f, authOf('d@x.pt'), { units: [{ token: T1 }] }), 'permission-denied', n + ': sem subscrição');
  }
  ok(sent.length === 0, 'nenhum email saiu nos acessos recusados');
  await err(call(send, A, { units: [] }), 'invalid-argument', 'lista vazia', 'units');
  await err(call(send, A, { units: 'x' }), 'invalid-argument', 'lista inválida', 'units');
  await err(call(send, A, { units: Array.from({ length: 51 }, (_, i) => ({ token: 'r' + String(i).padStart(32, '0') })) }), 'invalid-argument', 'mais de 50 por pedido', 'units');
  await err(call(send, A, { units: [{ token: 'a/b' }, { token: 'curto' }, { token: '' }, 7, null] }), 'invalid-argument', 'tokens inválidos descartados', 'units');
  // convite por publicar
  await db.collection('weddingInvitations').doc('W1').update({ status: 'unpublished' });
  await err(call(send, A, { units: [{ token: T1 }] }), 'failed-precondition', 'envio sem convite publicado', 'not_published');
  await db.collection('weddingInvitations').doc('W1').update({ status: 'published' });

  // ---- envio individual
  let r = await call(send, A, { units: [{ token: T1 }, { token: T2 }] });
  ok(r.ok && r.results.length === 2 && r.results.every((x) => x.status === 'accepted'), 'envia 2 emails individuais');
  ok(sent.length === 2 && sent[0].to === 'ana@ex.pt' && sent[1].to === 'bruno@ex.pt', 'um email por destinatário, cada um para o seu endereço');
  ok(sent[0].html.includes('https://www.weddy.pt/i/rita-tiago-ab12c?g=' + T1) && sent[1].html.includes('?g=' + T2) && !sent[0].html.includes(T2), 'ligação individual /i/<slug>?g=<token>, sem o token de outro');
  ok(sent[0].subject === 'O nosso convite de casamento 🤍 — Rita & Tiago', 'assunto por omissão com os nomes dos noivos');
  ok(sent[0].html.includes('Olá, Ana Silva!') && sent[0].html.includes('Com carinho,') && sent[0].html.includes('Consultar convite'), 'texto e botão em português');
  ok(sent[0].text.includes('?g=' + T1) && !/<[a-z]/i.test(sent[0].text), 'versão em texto simples com a ligação');
  ok(!/\?g=[^"]*(ana|@|silva)/i.test(sent[0].html), 'sem dados pessoais nos URLs');
  const d1 = await del(T1);
  ok(d1 && d1.status === 'accepted' && d1.channel === 'email' && d1.weddingId === 'W1' && d1.attempts === 1 && d1.completedAt && !d1.opId, 'registo: aceite, 1 tentativa, sem reserva pendente');
  ok(!JSON.stringify(d1).includes(T1) && !JSON.stringify(d1).includes('ana@ex.pt') && !JSON.stringify(d1).includes('Ana'), 'registo sem token, email nem nome');
  ok((await quota('W1')) === 2, 'quota diária = 2');
  ok((await db.collection('guests').doc(T1).get()).data().attending === null && !('invitation' in (await db.collection('guests').doc(T1).get()).data()), 'guests/{token} não foi alterado (distribuição separada do RSVP)');

  await resetRate();
  // ---- duplicados
  r = await call(send, A, { units: [{ token: T1 }] });
  ok(r.results[0].status === 'skipped' && r.results[0].reason === 'already_sent' && sent.length === 2, 'segundo pedido: não reenvia (já aceite)');
  r = await call(send, A, { units: [{ token: T1, confirmResend: true }] });
  ok(r.results[0].status === 'accepted' && sent.length === 3 && (await del(T1)).attempts === 2, 'reenvio só com confirmação explícita');
  // simultâneos
  delayMs = 60;
  await guest(T3, 'W1', { name: 'Carla', email: 'carla@ex.pt' });
  const before = sent.length;
  const par = await Promise.all([call(send, A, { units: [{ token: T3 }] }), call(send, A, { units: [{ token: T3 }] }), call(send, A, { units: [{ token: T3 }] })]);
  delayMs = 0;
  ok(sent.length - before === 1, 'três pedidos simultâneos: sai um único email (saiu ' + (sent.length - before) + ')');
  ok(par.filter((x) => x.results[0].status === 'accepted').length === 1 && par.filter((x) => ['in_progress', 'already_sent'].includes(x.results[0].reason)).length === 2, 'os outros dois são recusados (in_progress/already_sent)');
  ok((await quota('W1')) === 4, 'quota só conta o envio real (4)');

  await resetRate();
  // ---- sem email / outro casamento / inexistente
  await guest(T3 + 'x', 'W1', { name: 'Sem Email', email: '' });
  r = await call(send, A, { units: [{ token: T3 + 'x' }, { token: TO }, { token: 'r' + '0'.repeat(32) }, { token: T3 + 'y' }] });
  ok(r.results[0].reason === 'no_email' && r.results[1].reason === 'not_found' && r.results[2].reason === 'not_found' && r.results[3].reason === 'not_found', 'sem email e tokens inexistentes/de outro casamento são recusados');
  ok(!sent.some((m) => m.to === 'outro@ex.pt') && !(await del(TO)), 'isolamento: nada enviado nem registado para outro casamento');
  await guest(T3 + 'z', 'W1', { name: 'Inválido', email: 'nao-e-email' });
  ok((await call(send, A, { units: [{ token: T3 + 'z' }] })).results[0].reason === 'no_email', 'email inválido é recusado');
  const nB = sent.length;
  r = await call(send, B, { units: [{ token: T1 }] });
  ok(r.results[0].reason === 'not_found' && sent.length === nB && !(await db.collection('invitationDeliveries').doc(sha(T1) + '_email').get()).data().attempts !== 0, 'o outro casal não consegue enviar a convidados do primeiro (isolamento)');

  await resetRate();
  // ---- famílias
  await guest(TF, 'W1', { name: undefined, isFamily: true, email: undefined, members: [{ rsvpMemberId: 'm1', name: 'Marta' }, { rsvpMemberId: 'm2', name: 'Nuno' }, { rsvpMemberId: 'm3', name: 'Rui' }], emails: { m1: '', m2: 'nuno@ex.pt', m3: 'rui@ex.pt' } });
  const n0 = sent.length;
  r = await call(send, A, { units: [{ token: TF, name: 'Família Silva' }] });
  ok(sent.length - n0 === 1 && sent[sent.length - 1].to === 'nuno@ex.pt', 'família: UMA mensagem por agregado, para o primeiro email válido');
  ok(sent[sent.length - 1].html.includes('Olá, Família Silva!') && sent[sent.length - 1].html.includes('?g=' + TF), 'família: dirigida ao nome do agregado, com o token familiar');
  r = await call(send, A, { units: [{ token: TF }] });
  ok(r.results[0].reason === 'already_sent' && sent.length - n0 === 1, 'família: não volta a enviar');
  ok((await db.collection('guests').doc(TF).get()).data().members.length === 3 && !(await db.collection('guests').doc(TF).get()).data().responses, 'família: documento RSVP intacto');

  await resetRate();
  // ---- falha SMTP e reenvio só dos falhados
  await guest('r' + 'd'.repeat(32), 'W1', { name: 'D', email: 'd@ex.pt' }); await guest('r' + 'e'.repeat(32), 'W1', { name: 'E', email: 'e@ex.pt' });
  const TD = 'r' + 'd'.repeat(32), TE = 'r' + 'e'.repeat(32);
  failFor = new Set(['d@ex.pt']);
  const q0 = await quota('W1'), s0 = sent.length;
  r = await call(send, A, { units: [{ token: TD }, { token: TE }] });
  ok(r.results[0].status === 'failed' && r.results[0].reason === 'smtp' && r.results[1].status === 'accepted', 'SMTP falha num; o outro sai');
  const dd = await del(TD);
  ok(dd.status === 'failed' && dd.errCode === 'smtp' && dd.attempts === 1 && !dd.completedAt, 'falha registada como "failed" (nunca como aceite)');
  ok((await quota('W1')) === q0 + 1, 'quota devolvida ao falhar (só conta o aceite)');
  failFor = null;
  r = await call(send, A, { units: [{ token: TD }, { token: TE }] });
  ok(r.results[0].status === 'accepted' && r.results[1].reason === 'already_sent' && sent.length === s0 + 2, 'reenvio: só o falhado sai');
  ok((await del(TD)).status === 'accepted' && !(await del(TD)).errCode, 'depois do reenvio fica aceite e sem erro');
  // reenvio confirmado que falha mantém "aceite"
  failFor = true;
  r = await call(send, A, { units: [{ token: TE, confirmResend: true }] });
  const de = await del(TE);
  ok(r.results[0].status === 'failed' && de.status === 'accepted' && de.errCode === 'smtp', 'reenvio confirmado que falha mantém o estado anterior (aceite) e guarda o erro');
  failFor = null;

  await resetRate();
  process.env.INVITATION_EMAILS_PER_DAY = '6';
  // ---- limite diário (6 por dia neste teste)
  await db.collection('invitationQuota').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
  await db.collection('invitationDeliveries').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
  const many = []; for (let i = 0; i < 9; i++) { const t = 'r' + String(i).padStart(2, '0') + 'k'.repeat(30); await guest(t, 'W1', { name: 'G' + i, email: 'g' + i + '@ex.pt' }); many.push({ token: t }); }
  const s1 = sent.length;
  r = await call(send, A, { units: many });
  ok(sent.length - s1 === 6 && r.results.filter((x) => x.status === 'accepted').length === 6 && r.results.filter((x) => x.reason === 'daily_limit').length === 3, 'limite diário no servidor: 6 aceites, 3 recusados (daily_limit)');
  ok(r.limitPerDay === 6 && (await quota('W1')) === 6, 'quota = 6');
  r = await call(send, A, { units: [many[8]] });
  ok(r.results[0].reason === 'daily_limit' && sent.length - s1 === 6, 'novo pedido no mesmo dia também recusado');
  ok((await quota('W2')) === 0, 'quota é por casamento');

  await resetRate();
  // ---- texto editável sem injeção
  await db.collection('invitationQuota').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
  await guest('r' + 'h'.repeat(32), 'W1', { name: '<img src=x onerror=alert(1)>', email: 'h@ex.pt' });
  const s2 = sent.length;
  await call(send, A, { replyTo: true, units: [{ token: 'r' + 'h'.repeat(32) }], texts: { subject: 'Olá\r\nBcc: x@evil.pt [nome]', body: 'Oi [nome] <script>alert(1)</script> https://evil.example\n\n[ligação]\n\n<a href="https://evil.example">clica</a>\n[noivos]' } });
  const m = sent[s2];
  ok(!/[\r\n]/.test(m.subject) && !m.html.includes('<script>') && !m.html.includes('<img src=x') && !m.html.includes('<a href="https://evil.example">'), 'assunto sem quebras de linha e HTML escapado (sem script/img/ligações injetadas)');
  ok(m.html.includes('&lt;script&gt;') && m.html.includes('https://www.weddy.pt/i/rita-tiago-ab12c?g='), 'texto do casal aparece escapado; ligação do convite é sempre a da Weddy');
  ok(m.replyTo === 'a@x.pt', 'Reply-To só com opção ligada, e só o email de quem enviou');
  ok(!('bcc' in m) && !('cc' in m), 'sem cópias ocultas');
  await call(send, A, { lang: 'en', units: [{ token: 'r' + '1'.repeat(32) }] }).catch(() => null);
  await guest('r' + '2'.repeat(32), 'W1', { name: 'John', email: 'john@ex.pt' });
  await call(send, A, { lang: 'en', units: [{ token: 'r' + '2'.repeat(32) }] });
  const en = sent[sent.length - 1];
  ok(en.subject.startsWith('Our wedding invitation') && en.html.includes('Hi John!') && en.html.includes('View the invitation') && !en.html.includes('Olá') && !en.html.includes('Consultar'), 'inglês: mensagem completa em inglês, sem misturar português');
  ok(!en.html.includes('responde a este email'), 'inglês: sem texto de rodapé em português');

  // ---- pré-visualização (não envia)
  const s3 = sent.length;
  const pv = await call(prev, A, { name: 'Sofia', texts: { subject: 'x [nome]' }, replyTo: false });
  ok(pv.ok && pv.subject === 'x Sofia' && pv.html.includes('Olá, Sofia!') && sent.length === s3, 'pré-visualização gera HTML e não envia');
  ok(pv.html.includes('?g=exemplo') && pv.defaults.subject.includes('[noivos]'), 'pré-visualização usa token de exemplo e devolve os textos por omissão');
  const inf = await call(info, A, {});
  ok(inf.slug === 'rita-tiago-ab12c' && inf.limitPerDay === 6 && inf.texts.pt.body.includes('[ligação]') && inf.texts.en.body.includes('[link]'), 'getInvitationShareInfo devolve slug, limite e textos PT/EN');

  await resetRate();
  // ---- partilha WhatsApp (só regista "partilha iniciada")
  r = await call(share, A, { units: [{ token: T1 }, { token: TO }, { token: T1 }] });
  ok(r.results.length === 2 && r.results[0].status === 'shared' && r.results[1].reason === 'not_found', 'partilha: regista o próprio; outro casamento recusado; duplicado no pedido ignorado');
  const w1 = await del(T1, 'whatsapp');
  ok(w1.status === 'shared' && w1.attempts === 1 && w1.channel === 'whatsapp' && !JSON.stringify(w1).includes(T1), 'WhatsApp: estado "shared" (partilha iniciada), sem token');
  await call(share, A, { units: [{ token: T1 }] });
  ok((await del(T1, 'whatsapp')).attempts === 2 && !(await del(TO, 'whatsapp')), 'repetir a partilha só soma tentativas (histórico), sem afirmar entrega');
  ok(!('delivered' in w1) && !('sent' in w1) && w1.status !== 'delivered' && w1.status !== 'sent', 'nunca "enviado/entregue" para WhatsApp');
  await call(send, A, { units: [{ token: T1 }] }); await resetRate();
  ok((await del(T1, 'email')).channel === 'email' && (await del(T1, 'whatsapp')).channel === 'whatsapp' && (await del(T1, 'whatsapp')).status === 'shared', 'email e WhatsApp são registos separados (estados independentes)');

  // ---- limite de pedidos por hora
  await db.collection('siteRateLimits').get().then((s) => Promise.all(s.docs.map((d) => d.ref.delete())));
  let blocked = 0; for (let i = 0; i < 22; i++) { try { await call(send, A, { units: [{ token: T3 + 'y' }] }); } catch (e) { if (e.code === 'resource-exhausted') blocked++; } }
  ok(blocked === 2, 'controlo de utilização: máximo 20 pedidos de envio por hora (bloqueados ' + blocked + ')');

  console.log(`\n${pass} OK, ${fail} FALHAS`);
  // Dá tempo a que os rollbacks assíncronos do SDK cheguem ao emulador: sair de imediato deixava bloqueios de transação (~60 s) que faziam falhar as suites de regras seguintes.
  await new Promise((r) => setTimeout(r, 2500));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
