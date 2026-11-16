// Fase K — regras adversariais (Firestore + Storage reais no emulador): acesso cruzado, utilizador removido,
// coleções só-servidor, escrita de campos protegidos, uploads (MIME/SVG/tamanho/substituição), Premium expirado.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, arrayRemove, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') },
  storage:{ host:'127.0.0.1', port:9195, rules:fs.readFileSync(new URL('../../storage.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; globalThis.__e=String(e.message).slice(0,90); }
  const ok = blocked===expectBlocked; res.push([ok?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO',(!ok)?globalThis.__e||'':'']); };
const FUT=new Date(Date.now()+365*864e5), PAST=new Date(Date.now()-864e5);
await env.clearFirestore(); await env.clearStorage();
await env.withSecurityRulesDisabled(async ctx=>{ const db=ctx.firestore(), s=ctx.storage();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt','co@x.pt'],ownerUids:['A','CO'],creatorEmail:'a@x.pt',json:'{}',subscription:{active:true,plan:'premium-12meses',startedAt:new Date().toISOString(),premiumUntil:Timestamp.fromDate(FUT)}});
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],ownerUids:['B'],creatorEmail:'b@x.pt',json:'{}',subscription:{active:true,startedAt:'2025-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(FUT)}});
  await setDoc(doc(db,'weddings/W3'),{ownerEmails:['c@x.pt'],ownerUids:['C'],creatorEmail:'c@x.pt',json:'{}',subscription:{active:true,startedAt:'2024-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(PAST)}});
  await setDoc(doc(db,'weddings/W1/snapshots/s1'),{json:'{}'});
  await setDoc(doc(db,'weddings/W1/privateIntegrations/googleCalendar'),{t:'x'});
  await setDoc(doc(db,'userPrefs/A'),{activeWeddingId:'W1'}); await setDoc(doc(db,'creators/A'),{weddingId:'W1',email:'a@x.pt',createdAt:new Date()});
  await setDoc(doc(db,'_incident_log/i1'),{weddingId:'W1'});
  for (const c of ['weddingStateQuarantine','notifState','rsvpReminderSends','oauthStates','siteRateLimits','guestPhoneIndex','whatsappInbox','whatsappMessageStatus','whatsappReminderRateLimit','whatsappReminderDailyUsage','aiUsage','seatingRuns']) await setDoc(doc(db,c+'/x1'),{weddingId:'W1',v:1});
  await setDoc(doc(db,'guests/G1'),{weddingId:'W1',name:'Ficticio'});
  await uploadBytes(ref(s,'documents/W1/old.pdf'),new Uint8Array([1]),{contentType:'application/pdf'});
  await uploadBytes(ref(s,'memories/W1/publico/f.png'),new Uint8Array([1]),{contentType:'image/png'});
  await uploadBytes(ref(s,'feedback/W1/f1/a.png'),new Uint8Array([1]),{contentType:'image/png'});
  await uploadBytes(ref(s,'sites/W1/h.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'});
  await uploadBytes(ref(s,'public-sites/slug1/h.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'});
  await uploadBytes(ref(s,'documents/W3/old.pdf'),new Uint8Array([1]),{contentType:'application/pdf'});
});
const U=(uid,email,v=true)=>env.authenticatedContext(uid,{email,email_verified:v});
const A=U('A','a@x.pt'), CO=U('CO','co@x.pt'), B=U('B','b@x.pt'), C=U('C','c@x.pt'), anon=env.unauthenticatedContext(), Aunv=U('A','a@x.pt',false);
const F=c=>c.__f||(c.__f=c.firestore()); const S=c=>c.__s||(c.__s=c.storage());
const put=(c,p,ct,n=3)=>uploadBytes(ref(S(c),p),new Uint8Array(n),{contentType:ct});
// --- coleções só-servidor: nem o dono lê/escreve/apaga
for (const c of ['weddingStateQuarantine','notifState','rsvpReminderSends','oauthStates','siteRateLimits','guestPhoneIndex','whatsappInbox','whatsappMessageStatus','whatsappReminderRateLimit','whatsappReminderDailyUsage','aiUsage','seatingRuns']) {
  await rec(`dono não lê ${c}`,true,()=>getDoc(doc(F(A),c+'/x1')));
  await rec(`dono não escreve ${c}`,true,()=>setDoc(doc(F(A),c+'/x1'),{weddingId:'W1',v:2}));
  await rec(`dono não apaga ${c}`,true,()=>deleteDoc(doc(F(A),c+'/x1')));
}
// --- _incident_log: cliente só cria
await rec('dono não lê _incident_log',true,()=>getDoc(doc(F(A),'_incident_log/i1')));
await rec('dono não apaga _incident_log',true,()=>deleteDoc(doc(F(A),'_incident_log/i1')));
await rec('dono não altera _incident_log',true,()=>updateDoc(doc(F(A),'_incident_log/i1'),{weddingId:'W2'}));
await rec('anónimo não cria _incident_log',true,()=>setDoc(doc(F(anon),'_incident_log/n1'),{a:1}));
await rec('email não verificado não cria _incident_log',true,()=>setDoc(doc(F(Aunv),'_incident_log/n2'),{a:1}));
const okInc={weddingId:'W1',type:'sync_x',at:'2026-11-03T10:00:00Z',userAgent:'UA',errorMessage:'falha',paths:['a.b'],failedTokens:['…123456'],before:{guests:3,todos:1},after:null,expireAt:new Date(Date.now()+90*864e5)};
await rec('verificado cria _incident_log válido (esquema K.2)',false,()=>setDoc(doc(F(A),'_incident_log/n3'),okInc));
await rec('_incident_log: campo desconhecido negado',true,()=>setDoc(doc(F(A),'_incident_log/n4'),{...okInc,extra:'x'}));
await rec('_incident_log: sem type negado',true,()=>setDoc(doc(F(A),'_incident_log/n5'),{weddingId:'W1'}));
await rec('_incident_log: erro >300 negado',true,()=>setDoc(doc(F(A),'_incident_log/n6'),{...okInc,error:'x'.repeat(301)}));
await rec('_incident_log: userAgent >200 negado',true,()=>setDoc(doc(F(A),'_incident_log/n7'),{...okInc,userAgent:'u'.repeat(201)}));
await rec('_incident_log: >20 paths negado',true,()=>setDoc(doc(F(A),'_incident_log/n8'),{...okInc,paths:Array.from({length:21},()=>'p')}));
await rec('_incident_log: >50 failedTokens negado',true,()=>setDoc(doc(F(A),'_incident_log/n9'),{...okInc,failedTokens:Array.from({length:51},()=>'t')}));
await rec('_incident_log: before com estado completo negado',true,()=>setDoc(doc(F(A),'_incident_log/n10'),{...okInc,before:{guests:{noiva:[{name:'Ana'}]}} ,after:{coupleName1:'Ana'}}));
await rec('_incident_log: expireAt não-timestamp negado',true,()=>setDoc(doc(F(A),'_incident_log/n11'),{...okInc,expireAt:'amanha'}));
// --- acesso cruzado Firestore
await rec('B não lê casamento W1',true,()=>getDoc(doc(F(B),'weddings/W1')));
await rec('B não lê snapshots de W1',true,()=>getDoc(doc(F(B),'weddings/W1/snapshots/s1')));
await rec('B não escreve snapshots de W1',true,()=>setDoc(doc(F(B),'weddings/W1/snapshots/s9'),{json:'{}'}));
await rec('B não se acrescenta aos donos de W1',true,()=>updateDoc(doc(F(B),'weddings/W1'),{ownerEmails:['a@x.pt','co@x.pt','b@x.pt']}));
await rec('B não lê userPrefs/creators de A',true,()=>getDoc(doc(F(B),'userPrefs/A')));
await rec('B não lê creators de A',true,()=>getDoc(doc(F(B),'creators/A')));
await rec('B não escreve userPrefs de A',true,()=>setDoc(doc(F(B),'userPrefs/A'),{activeWeddingId:'W2'}));
await rec('dono não apaga o casamento',true,()=>deleteDoc(doc(F(A),'weddings/W1')));
await rec('dono não ativa Premium em W3 (expirado) pelo cliente',true,()=>updateDoc(doc(F(C),'weddings/W3'),{subscription:{active:true,premiumUntil:Timestamp.fromDate(FUT)}}));
await rec('dono não estende premiumUntil',true,()=>updateDoc(doc(F(A),'weddings/W1'),{'subscription.premiumUntil':Timestamp.fromDate(new Date(Date.now()+9e12))}));
await rec('dono não troca creatorEmail',true,()=>updateDoc(doc(F(CO),'weddings/W1'),{creatorEmail:'co@x.pt'}));
await rec('co-dono não retira o criador',true,()=>updateDoc(doc(F(CO),'weddings/W1'),{ownerEmails:['co@x.pt'],ownerUids:['CO']}));
await rec('json que não é string é recusado',true,()=>updateDoc(doc(F(A),'weddings/W1'),{json:{x:1}}));
await rec('json gigante (>900000) recusado',true,()=>updateDoc(doc(F(A),'weddings/W1'),{json:'x'.repeat(900001)}));
await rec('co-dono edita o estado',false,()=>updateDoc(doc(F(CO),'weddings/W1'),{json:'{"a":1}'}));
// --- utilizador removido perde acesso (Firestore e Storage)
await env.withSecurityRulesDisabled(async ctx=>{ await updateDoc(doc(ctx.firestore(),'weddings/W1'),{ownerEmails:['a@x.pt'],ownerUids:['A']}); });
await rec('co-dono removido já não lê o casamento',true,()=>getDoc(doc(F(CO),'weddings/W1')));
await rec('co-dono removido já não escreve',true,()=>updateDoc(doc(F(CO),'weddings/W1'),{json:'{"b":1}'}));
await rec('co-dono removido já não lê documentos (Storage)',true,()=>getBytes(ref(S(CO),'documents/W1/old.pdf')));
await rec('co-dono removido já não lê memórias (Storage)',true,()=>getBytes(ref(S(CO),'memories/W1/publico/f.png')));
await rec('co-dono removido já não apaga documentos',true,()=>deleteObject(ref(S(CO),'documents/W1/old.pdf')));
// --- Storage: isolamento e tipos
await rec('B não lê documentos de W1',true,()=>getBytes(ref(S(B),'documents/W1/old.pdf')));
await rec('B não carrega em documents/W1',true,()=>put(B,'documents/W1/b.pdf','application/pdf'));
await rec('anónimo não lê documentos',true,()=>getBytes(ref(S(anon),'documents/W1/old.pdf')));
await rec('A não carrega SVG em documents',true,()=>put(A,'documents/W1/x.svg','image/svg+xml'));
await rec('A não carrega HTML em documents',true,()=>put(A,'documents/W1/x.html','text/html'));
await rec('A não carrega executável em documents',true,()=>put(A,'documents/W1/x.exe','application/octet-stream'));
await rec('A não carrega >15 MB em documents',true,()=>put(A,'documents/W1/big.pdf','application/pdf',15*1024*1024+1));
await rec('A carrega PDF válido',false,()=>put(A,'documents/W1/ok.pdf','application/pdf'));
await rec('A não carrega em documents de W3 (não é dono)',true,()=>put(A,'documents/W3/z.pdf','application/pdf'));
await rec('C (Premium expirado) lê os seus documentos',false,()=>getBytes(ref(S(C),'documents/W3/old.pdf')));
await rec('C (Premium expirado) não carrega novos',true,()=>put(C,'documents/W3/new.pdf','application/pdf'));
await rec('C (Premium expirado) apaga os seus',false,()=>deleteObject(ref(S(C),'documents/W3/old.pdf')));
await rec('email não verificado não lê documentos',true,()=>getBytes(ref(S(Aunv),'documents/W1/old.pdf')));
await rec('anónimo não escreve em memories de W1 com token inventado',true,()=>put(anon,'memories/W1/inventado/f.png','image/png'));
await rec('anónimo não carrega SVG em memories',true,()=>put(anon,'memories/W1/publico/x.svg','image/svg+xml'));
await rec('anónimo não carrega >8 MB em memories',true,()=>put(anon,'memories/W1/publico/big.png','image/png',8*1024*1024+1));
await rec('anónimo não substitui memória existente',true,()=>put(anon,'memories/W1/publico/f.png','image/png'));
await rec('anónimo não lê memórias',true,()=>getBytes(ref(S(anon),'memories/W1/publico/f.png')));
await rec('anónimo não escreve memories em casamento sem Premium ativo (W3)',true,()=>put(anon,'memories/W3/publico/n.png','image/png'));
await rec('feedback: ninguém lê pelo cliente',true,()=>getBytes(ref(S(A),'feedback/W1/f1/a.png')));
await rec('feedback: B não carrega no casamento de A',true,()=>put(B,'feedback/W1/f2/a.png','image/png'));
await rec('feedback: SVG recusado',true,()=>put(A,'feedback/W1/f3/a.svg','image/svg+xml'));
await rec('sites: B não lê rascunho de A',true,()=>getBytes(ref(S(B),'sites/W1/h.jpg')));
await rec('public-sites: sem publicação não lê',true,()=>getBytes(ref(S(anon),'public-sites/slug1/h.jpg')));
await rec('public-sites: ninguém escreve',true,()=>put(A,'public-sites/slug1/z.jpg','image/jpeg'));
await rec('caminho fora das regras recusado (raiz)',true,()=>put(A,'qualquer/coisa.pdf','application/pdf'));
await rec('traversal no nome não contorna isolamento',true,()=>put(B,'documents/W2/../W1/evil.pdf','application/pdf'));
console.log(res.map(r=>r.join(' | ')).join('\n')); const nFail=res.filter(r=>r[0]==='FAIL').length; console.log('FAILS:',nFail,'/',res.length);
await env.cleanup(); process.exit(nFail?1:0);
