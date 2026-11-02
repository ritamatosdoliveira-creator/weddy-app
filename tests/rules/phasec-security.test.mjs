// Fase C — matriz de segurança (secção 5) e concorrência (teste H) contra as regras reais, no emulador.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, deleteField } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy', firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; } res.push([blocked===expectBlocked?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO']); };
const eq=(name,c)=>res.push([c?'OK  ':'FAIL',name,'']);
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{ const db=ctx.firestore();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{"secret":"orcamento"}'});
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}'});
  await setDoc(doc(db,'guests/g1'),{weddingId:'W1',name:'Ana',email:'ana@x.pt',attending:null});
  await setDoc(doc(db,'guests/g2'),{weddingId:'W1',name:'Bruno',email:'b@x.pt',attending:true,logistics:{v:1,food:{allergies:['marisco']}}});
  await setDoc(doc(db,'guests/gFam'),{weddingId:'W1',isFamily:true,members:[{rsvpMemberId:'m1'},{rsvpMemberId:'m2'}],responses:{}});
  await setDoc(doc(db,'guests/gB'),{weddingId:'W2',name:'Outro casamento',attending:true,logistics:{v:1,access:{mobility:true}}});
});
const anon=env.unauthenticatedContext(); const A=env.authenticatedContext('A',{email:'a@x.pt',email_verified:true}); const B=env.authenticatedContext('B',{email:'b@x.pt',email_verified:true});
const A2=env.authenticatedContext('A2',{email:'a@x.pt',email_verified:false});
const F=c=>c.__f||(c.__f=c.firestore()); const G=(c,t)=>doc(F(c),'guests/'+t);
// 1–3: acesso por token é por documento; nunca listagem nem dados do casamento
await rec('convidado não lista a coleção de convidados',true,()=>getDocs(collection(F(anon),'guests')));
await rec('convidado não lista por weddingId',true,()=>getDocs(query(collection(F(anon),'guests'),where('weddingId','==','W1'))));
await rec('convidado não lê o documento do casamento (orçamento/estado)',true,()=>getDoc(doc(F(anon),'weddings/W1')));
await rec('convidado não escreve no casamento',true,()=>updateDoc(doc(F(anon),'weddings/W1'),{json:'{}'}));
await rec('só com o token (ID) lê o seu documento',false,()=>getDoc(G(anon,'g1')));
// 2: convidado altera "outro": só com o token do outro; e só campos de resposta
await rec('convidado com token errado/inexistente não cria documentos',true,()=>setDoc(G(anon,'novo'),{weddingId:'W1',name:'x'}));
await rec('convidado não altera nome/email/weddingId do seu documento',true,()=>updateDoc(G(anon,'g1'),{name:'x'}));
await rec('convidado não escreve estado privado do casal (logi)',true,()=>updateDoc(G(anon,'g1'),{logi:{needs:'done'}}));
await rec('convidado não escreve campos extra (isAdmin)',true,()=>updateDoc(G(anon,'g1'),{isAdmin:true}));
await rec('convidado não escreve memberTables/assignedTable',true,()=>updateDoc(G(anon,'g1'),{assignedTable:5}));
await rec('convidado não escreve contadores de lembretes',true,()=>updateDoc(G(anon,'g1'),{remindersSent:0}));
// 4: outro casamento
await rec('POR DESIGN: leitura por ID (token) é aberta a quem conhece o ID, mesmo de outro casamento — o ID impossível de adivinhar é a credencial',false,()=>getDoc(G(B,'g1')));
await rec('casal de outro casamento não lista convidados de W1',true,()=>getDocs(query(collection(F(B),'guests'),where('weddingId','==','W1'))));
await rec('casal de outro casamento não apaga',true,()=>deleteDoc(G(B,'g2')));
await rec('casal de outro casamento não altera campos do casal',true,()=>updateDoc(G(B,'g1'),{name:'X'}));
await rec('casal não muda o weddingId para plantar convidado noutro casamento',true,()=>updateDoc(G(A,'g1'),{weddingId:'W2'}));
await rec('email não verificado não lista convidados',true,()=>getDocs(query(collection(F(A2),'guests'),where('weddingId','==','W1'))));
await rec('casal dono lê a logística dos seus convidados',false,()=>getDoc(G(A,'g2')));
await rec('casal dono lista os seus convidados',false,()=>getDocs(query(collection(F(A),'guests'),where('weddingId','==','W1'))));
// 6–7: limites e campos extra na logística
await rec('logística com campo extra bloqueada',true,()=>updateDoc(G(anon,'g1'),{logistics:{v:1,admin:1}}));
await rec('logística com lista > 10 bloqueada',true,()=>updateDoc(G(anon,'g1'),{logistics:{v:1,food:{intolerances:Array.from({length:12},(_,i)=>'x'+i)}}}));
await rec('logística com 8+ dietas... (>8) bloqueada',true,()=>updateDoc(G(anon,'g1'),{logistics:{v:1,food:{diets:Array.from({length:9},(_,i)=>'d'+i)}}}));
await rec('datas com texto enorme bloqueadas',true,()=>updateDoc(G(anon,'g1'),{logistics:{v:1,lodging:{arrive:'2027-01-01'.repeat(5)}}}));
await rec('logística null equivale a remover (permitido)',false,()=>updateDoc(G(anon,'g1'),{logistics:null}));
// 5: estado privado só pelo casal no seu próprio documento do casamento
await rec('casal escreve "logi" no documento de convidado? (permitido ao dono, é seu)',false,()=>updateDoc(G(A,'g1'),{logi:{needs:'done'}}));
// H: concorrência — vários dispositivos de uma família e o casal ao mesmo tempo
const writes=[];
for(let i=0;i<12;i++){
  writes.push(updateDoc(G(anon,'gFam'),{'responses.m1':{attending:true,logistics:{v:1,transport:{from:'P'+i}}}}));
  writes.push(updateDoc(G(anon,'gFam'),{'responses.m2':{attending:true,logistics:{v:1,food:{allergies:['a'+i]}}}}));
  writes.push(updateDoc(G(A,'gFam'),{['emails.m'+(1+i%2)]:'e'+i+'@x.pt'}));
}
await Promise.all(writes);
const fam=(await getDoc(G(A,'gFam'))).data();
eq('concorrência: respostas de m1 e m2 ambas presentes e completas',!!fam.responses.m1?.logistics?.transport && !!fam.responses.m2?.logistics?.food?.allergies?.length);
eq('concorrência: a escrita de m1 nunca apagou m2 nem os emails do casal',!!fam.emails && Object.keys(fam.emails).length===2 && fam.members.length===2);
await Promise.all([updateDoc(G(anon,'g2'),{logistics:deleteField()}),updateDoc(G(A,'g2'),{logi:{transport:'done'}})]);
const g2=(await getDoc(G(A,'g2'))).data();
eq('concorrência: convidado remove logística e casal marca organizado — ambos aplicados',g2.logistics===undefined && g2.logi?.transport==='done');
let bad=0; for(const r of res){ console.log(r.join('  ')); if(r[0]==='FAIL') bad++; }
console.log(`\n${res.length-bad} OK, ${bad} FALHAS`);
await env.cleanup(); process.exit(bad?1:0);
