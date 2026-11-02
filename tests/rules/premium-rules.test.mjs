import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, Timestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') },
  storage:{ host:'127.0.0.1', port:9195, rules:fs.readFileSync(new URL('../../storage.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; globalThis.__e=String(e.message).slice(0,90); }
  const ok = blocked===expectBlocked; res.push([ok?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO',(!ok&&blocked)?globalThis.__e:'']); };
const FUT=new Date(Date.now()+365*864e5), PAST=new Date(Date.now()-864e5);
async function seed(){
  await env.clearFirestore(); await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    // wedding W1: premium owner A; W2: free owner B; W3: premium EXPIRED-by-premiumUntil owner C ; V: victim wedding owner D (premium)
    await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],ownerUids:['A'],creatorEmail:'a@x.pt',json:'{}',subscription:{active:true,plan:'premium-12meses',startedAt:new Date().toISOString(),premiumUntil:Timestamp.fromDate(FUT),stripeCheckoutSessionIds:['cs_1']}});
    await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],ownerUids:['B'],creatorEmail:'b@x.pt',json:'{}'});
    await setDoc(doc(db,'weddings/W3'),{ownerEmails:['c@x.pt'],ownerUids:['C'],creatorEmail:'c@x.pt',json:'{}',subscription:{active:true,startedAt:'2024-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(PAST)}});
    await setDoc(doc(db,'weddings/W4'),{ownerEmails:['d@x.pt'],ownerUids:['D'],creatorEmail:'d@x.pt',json:'{}',subscription:{active:true,startedAt:'2025-06-01T00:00:00Z'}}); // legado, sem premiumUntil
    await setDoc(doc(db,'guests/G1'),{weddingId:'W1'}); await setDoc(doc(db,'guests/G2'),{weddingId:'W2'}); await setDoc(doc(db,'guests/G3'),{weddingId:'W3'});
    await setDoc(doc(db,'weddingSites/W1'),{premiumUntil:Timestamp.fromDate(FUT)});
  });
}
const U=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true});
const A=U('A','a@x.pt'), B=U('B','b@x.pt'), C=U('C','c@x.pt'), D=U('D','d@x.pt'), X=U('X','x@x.pt');
const anon=env.unauthenticatedContext();
const F=c=>c.__f||(c.__f=c.firestore()); const S=c=>c.__s||(c.__s=c.storage());
const png=new Uint8Array([1,2,3]);
await seed();
// ---- Subscrição
await rec('B (free) tenta ativar subscription.active=true',true,()=>updateDoc(doc(F(B),'weddings/W2'),{subscription:{active:true,startedAt:new Date().toISOString()}}));
await rec('B campo pontilhado subscription.active=true',true,()=>updateDoc(doc(F(B),'weddings/W2'),{'subscription.active':true}));
await rec('B subscription:{active:false, premiumUntil:futuro} (forjar validade)',true,()=>updateDoc(doc(F(B),'weddings/W2'),{subscription:{active:false,premiumUntil:Timestamp.fromDate(FUT)}}));
await rec('B subscription:{active:false,startedAt:2099} lixo extra',true,()=>updateDoc(doc(F(B),'weddings/W2'),{subscription:{active:false,startedAt:'2099-01-01',foo:'x'}}));
await rec('A reescreve subscription alterando premiumUntil p/ futuro longínquo',true,()=>updateDoc(doc(F(A),'weddings/W1'),{'subscription.active':false,'subscription.premiumUntil':Timestamp.fromDate(new Date('2099-01-01'))}));
await rec('B (sem subscription) cria subscription:{active:false}',true,()=>updateDoc(doc(F(B),'weddings/W2'),{subscription:{active:false}}));
await rec('A apaga idempotência stripe via subscription:{active:false}',true,()=>updateDoc(doc(F(A),'weddings/W1'),{subscription:{active:false,plan:null,startedAt:'x'}}));
await rec('A tenta mudar só plan',true,()=>updateDoc(doc(F(A),'weddings/W1'),{'subscription.active':false,'subscription.plan':'x'}));
await rec('A cancela legitimamente (dotted active:false+updatedAt)',false,()=>updateDoc(doc(F(A),'weddings/W1'),{'subscription.active':false,'subscription.updatedAt':new Date()}));
await seed();
await rec('A cancela à moda antiga (mapa completo, cliente velho)',true,()=>updateDoc(doc(F(A),'weddings/W1'),{subscription:{active:false,plan:null,startedAt:'2025-01-01',updatedAt:new Date()}}));
await seed();
await rec('B apaga campo subscription',true,()=>updateDoc(doc(F(B),'weddings/W1'),{subscription:null}));
await rec('B escreve em wedding alheio W1',true,()=>updateDoc(doc(F(B),'weddings/W1'),{json:'{"x":1}'}));
await rec('B lê wedding alheio W1',true,()=>getDoc(doc(F(B),'weddings/W1')));
await rec('B adiciona-se a ownerEmails de W1',true,()=>updateDoc(doc(F(B),'weddings/W1'),{ownerEmails:['a@x.pt','b@x.pt']}));
await rec('anon lê wedding',true,()=>getDoc(doc(F(anon),'weddings/W1')));
await rec('B cria wedding com subscription ativa',true,()=>setDoc(doc(F(B),'weddings/WB'),{ownerEmails:['b@x.pt'],creatorEmail:'b@x.pt',subscription:{active:true}}));
await rec('B apaga wedding',true,()=>deleteDoc(doc(F(B),'weddings/W2')));
// ---- weddingId / guests
await rec('B muda weddingId de guest G2 para W1',true,()=>updateDoc(doc(F(B),'guests/G2'),{weddingId:'W1'}));
await rec('B cria guest em wedding alheio W1',true,()=>setDoc(doc(F(B),'guests/GX'),{weddingId:'W1'}));
await rec('anon lista guests',true,()=>getDocs(collection(F(anon),'guests')));
await rec('anon altera email do guest',true,()=>updateDoc(doc(F(anon),'guests/G1'),{weddingId:'W9'}));
await rec('anon escreve resposta RSVP (legítimo)',false,()=>updateDoc(doc(F(anon),'guests/G1'),{attending:true,rsvpStatus:'yes'}));
// ---- weddingSites
await rec('A escreve weddingSites (premiumUntil forjado)',true,()=>setDoc(doc(F(A),'weddingSites/W1'),{premiumUntil:Timestamp.fromDate(FUT)}));
await rec('B escreve weddingSites/W2',true,()=>setDoc(doc(F(B),'weddingSites/W2'),{premiumUntil:Timestamp.fromDate(FUT)}));
await rec('B lê rascunho de W1',true,()=>getDoc(doc(F(B),'weddingSites/W1')));
await rec('anon escreve publicWeddingSites',true,()=>setDoc(doc(F(anon),'publicWeddingSites/s'),{status:'published'}));
await rec('A escreve siteSlugs',true,()=>setDoc(doc(F(A),'siteSlugs/s'),{weddingId:'W1'}));
// ---- Memories (Firestore)
const mem=(w,tok)=>({weddingId:w,token:tok,guestName:'x',storagePath:`memories/${w}/${tok}/f.png`,createdAt:new Date()});
await rec('anon cria memory em W1 (premium) com token publico',false,()=>addDoc(collection(F(anon),'memories'),mem('W1','publico')));
await rec('anon cria memory em W2 (NÃO premium)',true,()=>addDoc(collection(F(anon),'memories'),mem('W2','publico')));
await rec('anon cria memory em W3 (premiumUntil expirado)',true,()=>addDoc(collection(F(anon),'memories'),mem('W3','publico')));
await rec('anon cria memory em W1 com token de guest de W2',true,()=>addDoc(collection(F(anon),'memories'),mem('W1','G2')));
await rec('anon cria memory em W4 (legado sem premiumUntil)',false,()=>addDoc(collection(F(anon),'memories'),mem('W4','publico')));
// ---- Storage
const st=(ctx,p,ct='image/png')=>uploadBytes(ref(ctx.storage(),p),png,{contentType:ct});
await rec('anon upload memory W1/publico',false,()=>st(anon,'memories/W1/publico/a.png'));
await rec('anon upload memory W2/publico (free)',true,()=>st(anon,'memories/W2/publico/a.png'));
await rec('anon upload memory W3/publico (expirado)',true,()=>st(anon,'memories/W3/publico/a.png'));
await rec('anon upload memory W4/publico (legado)',false,()=>st(anon,'memories/W4/publico/a.png'));
await rec('anon upload memory W1 com token de outro casamento',true,()=>st(anon,'memories/W1/G2/a.png'));
await rec('anon upload memory html',true,()=>st(anon,'memories/W1/publico/a.html','text/html'));
await rec('B (free) upload documents/W2',true,()=>st(B,'documents/W2/c.pdf','application/pdf'));
await rec('A (premium) upload documents/W1',false,()=>st(A,'documents/W1/c.pdf','application/pdf'));
await rec('C (expirado) upload documents/W3',true,()=>st(C,'documents/W3/c.pdf','application/pdf'));
await rec('D (legado) upload documents/W4',false,()=>st(D,'documents/W4/c.pdf','application/pdf'));
await rec('B upload documents em W1 (alheio)',true,()=>st(B,'documents/W1/x.pdf','application/pdf'));
await rec('B lê documents/W1',true,()=>getBytes(ref(S(B),'documents/W1/c.pdf')));
await rec('B (free) upload sites/W2',true,()=>st(B,'sites/W2/a.png'));
await rec('A upload sites/W1 svg',true,()=>st(A,'sites/W1/a.svg','image/svg+xml'));
await rec('A upload sites/W1 png (premium)',false,()=>st(A,'sites/W1/a.png'));
await rec('anon lê public-sites inexistente',true,()=>getBytes(ref(S(anon),'public-sites/zz/a.png')));
await rec('B apaga documents/W1',true,()=>deleteObject(ref(S(B),'documents/W1/c.pdf')));
await rec('C (expirado) APAGA os seus documents (deve poder)',false,async()=>{ await env.withSecurityRulesDisabled(async c=>{await uploadBytes(ref(c.storage(),'documents/W3/o.pdf'),png,{contentType:'application/pdf'})}); await deleteObject(ref(S(C),'documents/W3/o.pdf')); });
await rec('C (expirado) LÊ os seus documents (deve poder)',false,async()=>{ await getBytes(ref(S(C),'documents/W3/o.pdf')).catch(async e=>{ await env.withSecurityRulesDisabled(async c=>{await uploadBytes(ref(c.storage(),'documents/W3/o2.pdf'),png,{contentType:'application/pdf'})}); await getBytes(ref(S(C),'documents/W3/o2.pdf')); }); });
await rec('B feedback upload em W1 (alheio)',true,()=>st(B,'feedback/W1/f1/a.png'));

await seed();
await rec('REGRESSÃO A grava json do casamento',false,()=>updateDoc(doc(F(A),'weddings/W1'),{json:'{"a":1}',settings:{x:1}}));
await rec('REGRESSÃO A convida parceiro (ownerEmails)',false,()=>updateDoc(doc(F(A),'weddings/W1'),{ownerEmails:['a@x.pt','p@x.pt']}));
await rec('REGRESSÃO A cria guest no seu casamento',false,()=>setDoc(doc(F(A),'guests/NEW1'),{weddingId:'W1',name:'x'}));
await rec('REGRESSÃO A atualiza guest próprio',false,()=>updateDoc(doc(F(A),'guests/G1'),{rsvpEmail:'e@x.pt'}));
await rec('REGRESSÃO B (free) grava json no seu casamento',false,()=>updateDoc(doc(F(B),'weddings/W2'),{json:'{}'}));
await rec('REGRESSÃO B (free) lê o seu casamento',false,()=>getDoc(doc(F(B),'weddings/W2')));
await rec('REGRESSÃO novo utilizador cria casamento (sem subscription)',false,async()=>{ const N=U('N','n@x.pt'); const b=writeBatch(F(N)); b.set(doc(F(N),'weddings/WN'),{ownerEmails:['n@x.pt'],creatorEmail:'n@x.pt',ownerUids:['N'],json:'{}'}); b.set(doc(F(N),'creators/N'),{weddingId:'WN',email:'n@x.pt',createdAt:new Date()}); await b.commit(); });
await rec('REGRESSÃO A (premium) lê memories do seu casamento',false,async()=>{ await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'memories/M1'),mem('W1','publico'))}); const {getDoc:g}=await import('firebase/firestore'); await g(doc(F(A),'memories/M1')); });
await rec('REGRESSÃO C (expirado) apaga/lê memories dele',false,async()=>{ await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'memories/M3'),mem('W3','publico'))}); await getDoc(doc(F(C),'memories/M3')); await deleteDoc(doc(F(C),'memories/M3')); });
await rec('REGRESSÃO A site photo: premium ok',false,()=>st(A,'sites/W1/b.png'));
await rec('A forja integrations/googleCalendar',true,()=>setDoc(doc(F(A),'weddings/W1/integrations/googleCalendar'),{connected:true,calendarId:'victim@gmail.com'}));
await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'weddings/W1/integrations/googleCalendar'),{connected:true,calendarId:'primary'})});
await rec('REGRESSÃO A lê integrations/googleCalendar',false,()=>getDoc(doc(F(A),'weddings/W1/integrations/googleCalendar')));
await rec('B lê integrations de W1',true,()=>getDoc(doc(F(B),'weddings/W1/integrations/googleCalendar')));
await rec('A escreve oauthStates',true,()=>setDoc(doc(F(A),'oauthStates/x'),{used:false}));
await rec('A escreve guestPhoneIndex (forjar validação de telefone)',true,()=>setDoc(doc(F(A),'guestPhoneIndex/+351900000000'),{weddingId:'W1',guestId:'g'}));
await rec('A escreve whatsappMessageStatus',true,()=>setDoc(doc(F(A),'whatsappMessageStatus/x'),{status:'sent'}));
await rec('A escreve siteRateLimits',true,()=>setDoc(doc(F(A),'siteRateLimits/save_W1'),{start:1,count:0}));
await rec('A lê privateIntegrations (refresh token)',true,()=>getDoc(doc(F(A),'weddings/W1/privateIntegrations/googleCalendar')));
await rec('A escreve privateIntegrations',true,()=>setDoc(doc(F(A),'weddings/W1/privateIntegrations/googleCalendar'),{encryptedRefreshToken:'x'}));
await rec('A escreve aiUsage (repor quota)',true,()=>setDoc(doc(F(A),'aiUsage/W1'),{count:0}));
console.log(res.map(r=>r.join(' | ')).join('\n')); const nFail=res.filter(r=>r[0]==='FAIL').length; console.log('FAILS:',nFail,'/',res.length);
await env.cleanup(); process.exit(nFail?1:0);
