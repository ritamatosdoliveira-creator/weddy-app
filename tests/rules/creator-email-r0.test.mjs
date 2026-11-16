// R0 (Nov 2026, decisão Q0 da Weddy Planning) — creatorEmail só pode existir se foi gravado na criação do casamento.
// Num casamento que não o tem, nenhum dono o pode acrescentar depois; num que o tem, não muda nem desaparece.
// Também confirma que TODAS as escritas reais da app no documento do casamento continuam permitidas,
// com e sem creatorEmail (login, convidar/remover participante, estado, definições, snapshot, restauro,
// consentimento, cancelar subscrição) e que a proteção do criador já existente se mantém.
// Por omissão usa ../../firestore.rules; WEDDY_RULES_FILE=<caminho> permite correr contra outra versão
// (ex.: as regras anteriores à R0, para provar que os casos R0 detetam a lacuna).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';

const rulesPath = process.env.WEDDY_RULES_FILE || new URL('../../firestore.rules', import.meta.url);
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(rulesPath,'utf8') } });
// Só conta como «bloqueado» uma recusa real das regras (permission-denied); qualquer outro erro é FAIL (ERRO),
// para que um problema do próprio teste nunca passe por recusa das regras.
const res=[]; const rec=async(name,expectBlocked,p)=>{ let out;
  try{ await p(); out='PERMITIDO'; }catch(e){ out = (e && e.code==='permission-denied') ? 'bloqueado' : 'ERRO: '+String(e && (e.code||e.message)).slice(0,120); }
  const ok = expectBlocked ? out==='bloqueado' : out==='PERMITIDO';
  res.push([ok?'OK  ':'FAIL',name,out]); };

await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  // W1: casamento com criador (a@) e parceiro (b@), Premium ativo.
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt','b@x.pt'],ownerUids:['A'],creatorEmail:'a@x.pt',json:'{}',settings:{},
    subscription:{active:true,plan:'premium',updatedAt:new Date()}});
  // W2: casamento antigo SEM creatorEmail (c@ e d@).
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['c@x.pt','d@x.pt'],ownerUids:['C'],json:'{}',settings:{}});
  // W3: criador (e@) que vai sair do casamento, com outro dono (f@).
  await setDoc(doc(db,'weddings/W3'),{ownerEmails:['e@x.pt','f@x.pt'],ownerUids:['E'],creatorEmail:'e@x.pt',json:'{}',settings:{}});
});

// Uma única instância do Firestore por utilizador (chamar .firestore() duas vezes no mesmo contexto dá erro do SDK).
const ctx=(uid,email)=>{ const c=env.authenticatedContext(uid,{email,email_verified:true}); c.__uid=uid; c.__email=email; c.__db=c.firestore(); return c; };
const A=ctx('A','a@x.pt'), B=ctx('B','b@x.pt'), C=ctx('C','c@x.pt'), D=ctx('D','d@x.pt'), E=ctx('E','e@x.pt');
const W=(c,id)=>doc(c.__db,'weddings/'+id);

// Criação tal como a app a faz (mesmo lote: casamento + creators/{uid} + userPrefs/{uid}).
const createWedding=(c,id,extra)=>{ const d=c.__db; const b=writeBatch(d);
  b.set(doc(d,'weddings/'+id),Object.assign({ownerEmails:[c.__email],ownerUids:[c.__uid],settings:{},json:'{}',
    consent:{termsVersion:'t',privacyVersion:'p',acceptedAt:serverTimestamp()},createdAt:serverTimestamp()},extra));
  b.set(doc(d,'creators/'+c.__uid),{weddingId:id,email:c.__email,createdAt:serverTimestamp()});
  b.set(doc(d,'userPrefs/'+c.__uid),{activeWeddingId:id,updatedAt:serverTimestamp()},{merge:true});
  return b.commit(); };
const N1=ctx('N1','n1@x.pt'), N2=ctx('N2','n2@x.pt'), N3=ctx('N3','n3@x.pt');

// ── 1. Criação ────────────────────────────────────────────────────────────
await rec('criar casamento com creatorEmail = próprio email (como a app)',false,()=>createWedding(N1,'WN1',{creatorEmail:'n1@x.pt'}));
await rec('criar casamento sem creatorEmail (apps antigas) continua permitido',false,()=>createWedding(N2,'WN2',{}));
await rec('criar casamento com creatorEmail de outra pessoa é recusado',true,()=>createWedding(N3,'WN3',{creatorEmail:'outra@x.pt'}));

// ── 2. R0: acrescentar creatorEmail a um casamento que não o tem ───────────
await rec('R0: dono acrescenta o próprio email como creatorEmail (casamento antigo) é recusado',true,()=>updateDoc(W(C,'W2'),{creatorEmail:'c@x.pt'}));
await rec('R0: outro dono acrescenta creatorEmail de terceiro (casamento antigo) é recusado',true,()=>updateDoc(W(D,'W2'),{creatorEmail:'c@x.pt'}));
await rec('R0: set com merge que inclui creatorEmail (casamento antigo) é recusado',true,()=>setDoc(W(C,'W2'),{creatorEmail:'c@x.pt',json:'{}'},{merge:true}));
await rec('R0: dono acrescenta creatorEmail ao casamento criado sem ele (WN2) é recusado',true,()=>updateDoc(W(N2,'WN2'),{creatorEmail:'n2@x.pt'}));

// ── 3. creatorEmail existente: não muda nem desaparece ─────────────────────
await rec('criador altera creatorEmail é recusado',true,()=>updateDoc(W(A,'W1'),{creatorEmail:'outro@x.pt'}));
await rec('parceiro altera creatorEmail para si é recusado',true,()=>updateDoc(W(B,'W1'),{creatorEmail:'b@x.pt'}));
await rec('criador remove creatorEmail (deleteField) é recusado',true,()=>updateDoc(W(A,'W1'),{creatorEmail:deleteField()}));
await rec('set sem merge que omite creatorEmail é recusado',true,()=>setDoc(W(A,'W1'),{ownerEmails:['a@x.pt','b@x.pt'],json:'{}'}));
await rec('regravar creatorEmail com o mesmo valor continua permitido',false,()=>updateDoc(W(A,'W1'),{creatorEmail:'a@x.pt'}));

// ── 4. Proteção do criador já existente ────────────────────────────────────
await rec('parceiro retira o criador dos donos é recusado',true,()=>updateDoc(W(B,'W1'),{ownerEmails:arrayRemove('a@x.pt')}));
await rec('o próprio criador sai do casamento continua permitido',false,()=>updateDoc(W(E,'W3'),{ownerEmails:arrayRemove('e@x.pt'),ownerUids:arrayRemove('E')}));

// ── 5. Escritas reais da app (com e sem creatorEmail) ──────────────────────
const login=(c,id)=>updateDoc(W(c,id),{
  ['lastLoginByEmail.'+c.__email.replace(/\./g,'_')]:serverTimestamp(),
  ownerUids:arrayUnion(c.__uid),
  ['uidByEmail.'+c.__email.replace(/\./g,'_')]:c.__uid });
await rec('app: login do parceiro (ownerUids, uidByEmail, lastLoginByEmail) — com creatorEmail',false,()=>login(B,'W1'));
await rec('app: login de dono — casamento sem creatorEmail',false,()=>login(D,'W2'));
await rec('app: convidar participante (arrayUnion) — com creatorEmail',false,()=>updateDoc(W(A,'W1'),{ownerEmails:arrayUnion('g@x.pt')}));
await rec('app: convidar participante (arrayUnion) — sem creatorEmail',false,()=>updateDoc(W(C,'W2'),{ownerEmails:arrayUnion('g@x.pt')}));
await rec('app: remover participante — com creatorEmail',false,()=>updateDoc(W(A,'W1'),{ownerEmails:arrayRemove('g@x.pt')}));
await rec('app: remover participante — sem creatorEmail',false,()=>updateDoc(W(C,'W2'),{ownerEmails:arrayRemove('g@x.pt')}));
await rec('app: gravar estado (set merge json+settings) — com creatorEmail',false,()=>setDoc(W(B,'W1'),{json:JSON.stringify({budget:{total:1}}),settings:{a:1},updatedAt:serverTimestamp()},{merge:true}));
await rec('app: gravar estado (set merge json+settings) — sem creatorEmail',false,()=>setDoc(W(D,'W2'),{json:JSON.stringify({budget:{total:2}}),settings:{a:2},updatedAt:serverTimestamp()},{merge:true}));
await rec('app: guardar definições (set merge settings) — com creatorEmail',false,()=>setDoc(W(A,'W1'),{settings:{b:1},updatedAt:serverTimestamp()},{merge:true}));
await rec('app: snapshot automático (lastAutoSnapshotAt) — sem creatorEmail',false,()=>updateDoc(W(C,'W2'),{lastAutoSnapshotAt:serverTimestamp()}));
await rec('app: restaurar cópia (set merge settings+json) — com creatorEmail',false,()=>setDoc(W(A,'W1'),{settings:{r:1},json:'{}',updatedAt:serverTimestamp()},{merge:true}));
await rec('app: reaceitar termos (consent) — sem creatorEmail',false,()=>updateDoc(W(D,'W2'),{consent:{termsVersion:'t2',privacyVersion:'p2',acceptedAt:serverTimestamp()}}));
await rec('app: cancelar subscrição (subscription.active=false) — com creatorEmail',false,()=>updateDoc(W(A,'W1'),{'subscription.active':false,'subscription.updatedAt':serverTimestamp()}));
await rec('cliente não pode reativar a subscrição (proteção existente)',true,()=>updateDoc(W(A,'W1'),{'subscription.active':true}));

let bad=0; for(const r of res){ console.log(r.join('  ')); if(r[0]==='FAIL') bad++; }
console.log(`\n${res.length-bad} OK, ${bad} FALHAS`);
await env.cleanup(); process.exit(bad?1:0);
