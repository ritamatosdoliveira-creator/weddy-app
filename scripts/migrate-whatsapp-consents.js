#!/usr/bin/env node
/**
 * Migração dos consentimentos WhatsApp ANTIGOS (A.3-bis).
 *
 * Contexto: até Out 2026 o consentimento era uma caixa que o CASAL marcava na
 * ficha do convidado e ficava em state.guests[...].communicationPreferences.
 * whatsapp.optedIn (json do casamento). Isso não é prova de que o CONVIDADO
 * consentiu (RGPD art. 7.º, n.º 1: o responsável tem de poder demonstrar que o
 * titular consentiu). A regra aqui é: SÓ se preserva um consentimento se
 * existir prova do próprio convidado, ou seja, um registo em whatsappConsents
 * (criado por setGuestWhatsappConsent), com estado "granted" e o MESMO número.
 * Tudo o resto fica "pendente de renovação": o espelho passa a optedIn:false
 * com pendingRenewal:true (e o optedInAt antigo guardado em legacyOptedInAt,
 * só como rasto, nunca como prova) e o convidado vê a caixa desmarcada no
 * link do RSVP. Opt-outs (STOP, optedOutAt) são sempre mantidos.
 *
 * NOTA: o servidor (sendWhatsappRsvpReminder) JÁ ignora este campo do json e só
 * aceita whatsappConsents. Esta migração só limpa o espelho que a UI lê e gera
 * o relatório. Não é crítica para a segurança.
 *
 * SEGURANÇA
 *  - Por defeito é DRY-RUN. --apply exige --backup <ficheiro.json>: antes de
 *    escrever, grava o estado anterior de cada entrada tocada (guestId + as
 *    communicationPreferences antigas, sem nomes nem telefones).
 *  - Só altera communicationPreferences.whatsapp. Nunca toca em nomes,
 *    telefones, respostas ou outras chaves. Idempotente (o que já está
 *    "pendingRenewal" ou sem consentimento é ignorado).
 *  - Cada casamento é escrito numa transação que volta a ler o json (se mudou
 *    entretanto, repete a classificação com os dados novos).
 *  - --rollback <backup.json> repõe as communicationPreferences guardadas.
 *  - O relatório não contém telefones nem nomes, só ids e contagens.
 */
'use strict';

function* iterGuestEntries(state) {
  const guests = state && state.guests;
  if (!guests || typeof guests !== 'object') return;
  for (const side of ['noiva', 'noivo', 'conjunto']) {
    const sd = guests[side];
    if (!sd || typeof sd !== 'object') continue;
    for (const cat of ['familia', 'amigos', 'duvida', 'staff']) {
      if (Array.isArray(sd[cat])) for (const e of sd[cat]) if (e && typeof e === 'object') yield e;
    }
    if (Array.isArray(sd.custom)) for (const c of sd.custom) if (c && Array.isArray(c.names)) for (const e of c.names) if (e && typeof e === 'object') yield e;
  }
}

/** Classifica UMA entrada. Função pura. consentRec = documento whatsappConsents (ou null). */
function classifyEntry(entry, consentRec) {
  const w = entry && entry.communicationPreferences && entry.communicationPreferences.whatsapp;
  if (!w || typeof w !== 'object') return { kind: 'no-preference' };
  if (w.pendingRenewal === true && w.optedIn !== true) return { kind: 'already-pending' };
  const phone = typeof entry.phone === 'string' ? entry.phone : '';
  if (w.optedIn !== true) return { kind: w.optedOutAt ? 'opted-out-kept' : 'not-opted-in' };
  if (!phone) return { kind: 'legacy-no-phone' };
  if (consentRec && consentRec.status === 'granted' && consentRec.phone === phone) {
    return { kind: 'proof-preserved' };
  }
  if (w.source === 'guest') return { kind: 'mirror-without-record' }; // espelho diz "convidado" mas não há registo: não confiar
  return { kind: 'couple-asserted-pending' };
}

function renewedPrefs(w) {
  return {
    whatsapp: {
      optedIn: false,
      optedInAt: null,
      optedOutAt: w.optedOutAt || null,
      pendingRenewal: true,
      legacyOptedInAt: w.optedInAt || null,
    },
  };
}

async function run(opts) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp(opts.project ? { projectId: opts.project } : undefined);
  const db = admin.firestore();
  if (opts.apply && !opts.backup) throw new Error('--apply exige --backup <ficheiro.json>');
  const counts = {};
  const perWedding = {};
  const backup = { generatedAt: (opts.now || new Date()).toISOString(), entries: [] };
  let weddings = 0, written = 0, raced = 0;

  const consentFor = async (wid, gid) => {
    const s = await db.collection('whatsappConsents').doc(`${wid}_${gid}`).get();
    return s.exists ? s.data() : null;
  };

  const snap = await db.collection('weddings').get();
  for (const doc of snap.docs) {
    weddings++;
    let state;
    try { state = JSON.parse((doc.data() || {}).json || '{}'); } catch (e) { counts['unreadable-json'] = (counts['unreadable-json'] || 0) + 1; continue; }
    const toChange = [];
    for (const e of iterGuestEntries(state)) {
      const rec = e.guestId ? await consentFor(doc.id, e.guestId) : null;
      const c = classifyEntry(e, rec);
      counts[c.kind] = (counts[c.kind] || 0) + 1;
      if (c.kind === 'couple-asserted-pending' || c.kind === 'mirror-without-record') {
        perWedding[doc.id] = (perWedding[doc.id] || 0) + 1;
        toChange.push(e.guestId || null);
      }
    }
    if (!opts.apply || !toChange.length) continue;
    const outcome = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      let st; try { st = JSON.parse((fresh.data() || {}).json || '{}'); } catch (e) { return 'race'; }
      const entryBackups = [];
      for (const e of iterGuestEntries(st)) {
        const rec = e.guestId ? await tx.get(db.collection('whatsappConsents').doc(`${doc.id}_${e.guestId}`)).then((s) => (s.exists ? s.data() : null)) : null;
        const c = classifyEntry(e, rec);
        if (c.kind !== 'couple-asserted-pending' && c.kind !== 'mirror-without-record') continue;
        entryBackups.push({ weddingId: doc.id, guestId: e.guestId || null, before: e.communicationPreferences });
        e.communicationPreferences = renewedPrefs(e.communicationPreferences.whatsapp);
      }
      if (!entryBackups.length) return 'noop';
      tx.set(doc.ref, { json: JSON.stringify(st) }, { merge: true });
      return { done: 'written', entryBackups };
    });
    if (outcome && outcome.done === 'written') { written++; backup.entries.push(...outcome.entryBackups); } else if (outcome === 'race') raced++;
  }
  if (opts.apply && opts.backup) require('fs').writeFileSync(opts.backup, JSON.stringify(backup, null, 2));
  return {
    mode: opts.apply ? 'APPLY' : 'DRY-RUN', generatedAt: backup.generatedAt, weddingsScanned: weddings, counts,
    wouldMakePending: (counts['couple-asserted-pending'] || 0) + (counts['mirror-without-record'] || 0),
    preserved: counts['proof-preserved'] || 0, weddingsWritten: written, skippedRace: raced, weddingsAffected: perWedding,
  };
}

async function rollback(opts) {
  const admin = require('firebase-admin');
  if (!admin.apps.length) admin.initializeApp(opts.project ? { projectId: opts.project } : undefined);
  const db = admin.firestore();
  const b = JSON.parse(require('fs').readFileSync(opts.rollback, 'utf8'));
  const byWedding = {};
  for (const e of b.entries) (byWedding[e.weddingId] = byWedding[e.weddingId] || []).push(e);
  let restored = 0;
  for (const wid of Object.keys(byWedding)) {
    const ref = db.collection('weddings').doc(wid);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref); if (!s.exists) return;
      const st = JSON.parse(s.data().json || '{}');
      let n = 0;
      for (const e of iterGuestEntries(st)) {
        const hit = byWedding[wid].find((x) => x.guestId && x.guestId === e.guestId);
        // Só repõe se o estado atual ainda for o que a migração escreveu.
        if (hit && e.communicationPreferences && e.communicationPreferences.whatsapp && e.communicationPreferences.whatsapp.pendingRenewal === true) {
          e.communicationPreferences = hit.before; n++;
        }
      }
      if (n) { tx.set(ref, { json: JSON.stringify(st) }, { merge: true }); restored += n; }
    });
  }
  return { restored };
}

function printReport(r) {
  const L = [`Migração de consentimentos WhatsApp — ${r.mode} — ${r.generatedAt}`, `Casamentos analisados: ${r.weddingsScanned}`];
  Object.keys(r.counts).sort().forEach((k) => L.push(`  ${k.padEnd(26)} ${r.counts[k]}`));
  L.push(`Consentimentos preservados (com prova do convidado): ${r.preserved}`);
  L.push(`Passam a pendentes de renovação: ${r.wouldMakePending} em ${Object.keys(r.weddingsAffected).length} casamento(s)`);
  if (r.mode === 'APPLY') L.push(`Casamentos escritos: ${r.weddingsWritten} | saltados por alteração concorrente: ${r.skippedRace}`);
  else L.push('DRY-RUN: nada foi escrito.');
  return L.join('\n');
}

function parseArgs(argv) {
  const o = { apply: false, project: null, report: null, backup: null, rollback: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--project') o.project = argv[++i];
    else if (a === '--report') o.report = argv[++i];
    else if (a === '--backup') o.backup = argv[++i];
    else if (a === '--rollback') o.rollback = argv[++i];
    else throw new Error('Argumento desconhecido: ' + a);
  }
  return o;
}

module.exports = { classifyEntry, renewedPrefs, iterGuestEntries, run, rollback, printReport, parseArgs };

if (require.main === module) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (!process.env.FIRESTORE_EMULATOR_HOST && (o.apply || o.rollback) && process.env.WEDDY_CONFIRM_PROD !== 'sim') {
    console.error('A ESCREVER NUM PROJETO REAL. Confirma com WEDDY_CONFIRM_PROD=sim.'); process.exit(2);
  }
  (o.rollback ? rollback(o).then((r) => console.log('Repostos:', r.restored)) : run(o).then((r) => {
    console.log(printReport(r));
    if (o.report) { require('fs').writeFileSync(o.report, JSON.stringify(r, null, 2)); console.log('Relatório: ' + o.report); }
  })).catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
}
