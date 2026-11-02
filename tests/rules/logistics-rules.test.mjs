// B.2 — regras do campo "logistics" no convite do convidado (escrita sem sessão).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; }
  res.push([blocked===expectBlocked?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO']); };
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{}'});
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}'});
  await setDoc(doc(db,'guests/tokA'),{weddingId:'W1',name:'Ana',email:'ana@x.pt',attending:null});
  await setDoc(doc(db,'guests/tokFam'),{weddingId:'W1',isFamily:true,members:[{rsvpMemberId:'m1'},{rsvpMemberId:'m2'}],responses:{m1:{attending:true,logistics:{v:1,food:{allergies:['x']}}},m2:{attending:true}}});
  await setDoc(doc(db,'guests/tokDel'),{weddingId:'W1',name:'Del',logistics:{v:1,food:{allergies:['marisco']}}});
  await setDoc(doc(db,'guests/tokOld'),{weddingId:'W1',name:'Velho',attending:true,meal:'carne',transporte:true,children:[]});
});
const anon=env.unauthenticatedContext(); const A=env.authenticatedContext('A',{email:'a@x.pt',email_verified:true}); const B=env.authenticatedContext('B',{email:'b@x.pt',email_verified:true});
const F=c=>c.__f||(c.__f=c.firestore()); const G=(c,t='tokA')=>doc(F(c),'guests/'+t);
const good={v:1,transport:{from:'Porto',people:3,pref:'ida-volta',notes:'ok'},lodging:{nights:2,arrive:'2027-06-10',depart:'2027-06-12',people:2,notes:''},food:{allergies:['marisco'],intolerances:['lactose'],diets:['vegan'],pref:'pouco picante'},access:{mobility:true,assistance:false,other:'cadeira de rodas'}};
await rec('convidado grava logística válida',false,()=>updateDoc(G(anon),{attending:true,logistics:good}));
await rec('convidado remove a logística (deleteField)',false,()=>updateDoc(G(anon),{logistics:deleteField()}));
await rec('convidado grava logística mínima',false,()=>updateDoc(G(anon),{logistics:{v:1,food:{allergies:['nozes']}}}));
await rec('chave desconhecida no topo bloqueada',true,()=>updateDoc(G(anon),{logistics:{v:1,evil:'x'}}));
await rec('chave desconhecida em transport bloqueada',true,()=>updateDoc(G(anon),{logistics:{v:1,transport:{from:'x',admin:true}}}));
await rec('texto gigante em transport.from bloqueado',true,()=>updateDoc(G(anon),{logistics:{v:1,transport:{from:'x'.repeat(500)}}}));
await rec('people fora do intervalo bloqueado',true,()=>updateDoc(G(anon),{logistics:{v:1,transport:{people:99}}}));
await rec('nights fora do intervalo bloqueado',true,()=>updateDoc(G(anon),{logistics:{v:1,lodging:{nights:400}}}));
await rec('mais de 10 alergias bloqueado',true,()=>updateDoc(G(anon),{logistics:{v:1,food:{allergies:Array.from({length:11},(_, i)=>'a'+i)}}}));
await rec('mobility não booleano bloqueado',true,()=>updateDoc(G(anon),{logistics:{v:1,access:{mobility:'sim'}}}));
await rec('logistics como string bloqueado',true,()=>updateDoc(G(anon),{logistics:'tudo'}));
await rec('convidado continua sem poder mudar weddingId',true,()=>updateDoc(G(anon),{weddingId:'W2'}));
await rec('convidado continua sem poder mudar email',true,()=>updateDoc(G(anon),{email:'x@y.pt'}));
await rec('resposta antiga (sem logística) continua válida',false,()=>updateDoc(G(anon,'tokOld'),{attending:false,meal:''}));
await rec('casal dono grava logística no seu convidado',false,()=>updateDoc(G(A),{logistics:good}));
await rec('outro casal (autenticado) não altera campos do casal (nome)',true,()=>updateDoc(G(B),{name:'X'}));
await rec('casal dono lê',false,()=>getDoc(G(A)));
await rec('casal remove um membro da família (responses.m1 inclui a logística)',false,()=>updateDoc(G(A,'tokFam'),{members:[{rsvpMemberId:'m2'}],'responses.m1':deleteField()}));
await rec('convidado/anónimo não apaga o documento',true,()=>deleteDoc(G(anon,'tokDel')));
await rec('outro casal não apaga o documento',true,()=>deleteDoc(G(B,'tokDel')));
await rec('casal apaga o convidado (documento com logística)',false,()=>deleteDoc(G(A,'tokDel')));
await rec('depois de apagado já não existe',true,async()=>{ const s=await getDoc(G(A,'tokDel')); if(s.exists()) throw new Error('ainda existe'); else throw new Error('não existe'); });
const fam=(await getDoc(G(A,'tokFam'))).data();
res.push([(!fam.responses.m1 && fam.responses.m2)?'OK  ':'FAIL','logística do membro removido desapareceu e a do outro ficou','']);
let bad=0; for(const r of res){ console.log(r.join('  ')); if(r[0]==='FAIL') bad++; }
console.log(`\n${res.length-bad} OK, ${bad} FALHAS`);
await env.cleanup(); process.exit(bad?1:0);
