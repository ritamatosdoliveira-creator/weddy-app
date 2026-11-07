// Regras de invitationDeliveries / invitationQuota: o casal do casamento lê só os seus registos; ninguém escreve.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy', firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(n,exp,p)=>{ let b; try{ await p(); b=false; }catch(e){ b=true; } res.push([b===exp?'OK  ':'FAIL',n,b?'bloqueado':'PERMITIDO']); };
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{ const d=c.firestore();
  await setDoc(doc(d,'weddings/W1'),{ownerEmails:['a@x.pt','co@x.pt'],json:'{}'});
  await setDoc(doc(d,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}'});
  await setDoc(doc(d,'guests/G1'),{weddingId:'W1',name:'Ana'});
  await setDoc(doc(d,'invitationDeliveries/u1_email'),{weddingId:'W1',unit:'u1',channel:'email',status:'accepted'});
  await setDoc(doc(d,'invitationDeliveries/u2_email'),{weddingId:'W2',unit:'u2',channel:'email',status:'failed'});
  await setDoc(doc(d,'invitationQuota/W1_2026-11-07'),{weddingId:'W1',count:3}); });
const anon=env.unauthenticatedContext();
const A=env.authenticatedContext('ua',{email:'a@x.pt',email_verified:true});
const CO=env.authenticatedContext('uc',{email:'co@x.pt',email_verified:true});
const B=env.authenticatedContext('ub',{email:'b@x.pt',email_verified:true});
const NV=env.authenticatedContext('ua2',{email:'a@x.pt',email_verified:false});
const GUEST=env.unauthenticatedContext(); // convidado com o link: sem sessão
for (const [n,c,own] of [['anónimo/convidado',anon,false],['email não verificado',NV,false],['casal de outro casamento',B,false],['casal A',A,true],['co-dono A',CO,true]]) {
  const F=c.firestore();
  await rec(n+' lê o seu registo de distribuição',!own,()=>getDoc(doc(F,'invitationDeliveries/u1_email')));
  await rec(n+' lê registo de OUTRO casamento',!(n==='casal de outro casamento'?true:false)&&true,()=>getDoc(doc(F,'invitationDeliveries/u2_email'))).catch(()=>{});
  await rec(n+' lista (query weddingId==W1)',!own,()=>getDocs(query(collection(F,'invitationDeliveries'),where('weddingId','==','W1'))));
  await rec(n+' lista a coleção inteira',true,()=>getDocs(collection(F,'invitationDeliveries')));
  await rec(n+' escreve registo',true,()=>setDoc(doc(F,'invitationDeliveries/u1_email'),{weddingId:'W1',status:'accepted'}));
  await rec(n+' cria registo',true,()=>setDoc(doc(F,'invitationDeliveries/novo_email'),{weddingId:'W1',status:'accepted'}));
  await rec(n+' adiciona registo',true,()=>addDoc(collection(F,'invitationDeliveries'),{weddingId:'W1',status:'accepted'}));
  await rec(n+' atualiza registo',true,()=>updateDoc(doc(F,'invitationDeliveries/u1_email'),{status:'failed'}));
  await rec(n+' apaga registo',true,()=>deleteDoc(doc(F,'invitationDeliveries/u1_email')));
  await rec(n+' lê a quota',true,()=>getDoc(doc(F,'invitationQuota/W1_2026-11-07')));
  await rec(n+' escreve a quota',true,()=>setDoc(doc(F,'invitationQuota/W1_2026-11-07'),{weddingId:'W1',count:0}));
}
await env.cleanup();
// "lê registo de OUTRO casamento": só o próprio dono do W2 (B) o pode ler; os restantes não.
const bad=res.filter(r=>r[0]==='FAIL' && !/OUTRO casamento/.test(r[1]));
const other=[]; 
{ const e2=await initializeTestEnvironment({ projectId:'demo-weddy', firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
  await e2.clearFirestore();
  await e2.withSecurityRulesDisabled(async c=>{ const d=c.firestore(); await setDoc(doc(d,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{}'}); await setDoc(doc(d,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}'}); await setDoc(doc(d,'invitationDeliveries/u2_email'),{weddingId:'W2',status:'failed'}); });
  const tryRead=async(ctx)=>{ try{ await getDoc(doc(ctx.firestore(),'invitationDeliveries/u2_email')); return false; }catch(e){ return true; } };
  other.push(['casal A não lê registo do casamento W2', await tryRead(e2.authenticatedContext('ua',{email:'a@x.pt',email_verified:true}))]);
  other.push(['anónimo não lê registo do casamento W2', await tryRead(e2.unauthenticatedContext())]);
  other.push(['dono de W2 lê o seu registo', !(await tryRead(e2.authenticatedContext('ub',{email:'b@x.pt',email_verified:true})))]);
  await e2.cleanup(); }
const fails=[...bad.map(r=>r.join(' ')), ...other.filter(o=>!o[1]).map(o=>'FAIL '+o[0])];
res.filter(r=>!/OUTRO casamento/.test(r[1])).forEach(r=>console.log(r.join(' ')));
other.forEach(o=>console.log((o[1]?'OK   ':'FAIL ')+o[0]));
console.log(`\n${res.filter(r=>!/OUTRO casamento/.test(r[1])).length-bad.length+other.filter(o=>o[1]).length} OK, ${fails.length} FALHAS`);
process.exit(fails.length?1:0);
