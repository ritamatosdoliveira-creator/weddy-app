import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy', firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(n,exp,p)=>{ let b; try{ await p(); b=false; }catch(e){ b=true; } res.push([b===exp?'OK  ':'FAIL',n,b?'bloqueado':'PERMITIDO']); };
const FUT=Timestamp.fromDate(new Date(Date.now()+864e5*365)), PAST=Timestamp.fromDate(new Date(Date.now()-864e5));
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c=>{ const d=c.firestore();
  await setDoc(doc(d,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{}'});
  await setDoc(doc(d,'publicInvitations/ok'),{status:'published',validUntil:FUT,snapshot:{names:'A'}});
  await setDoc(doc(d,'publicInvitations/exp'),{status:'published',validUntil:PAST,snapshot:{names:'A'}});
  await setDoc(doc(d,'publicInvitations/susp'),{status:'suspended'});
  await setDoc(doc(d,'publicInvitations/unp'),{status:'unpublished'});
  await setDoc(doc(d,'publicInvitations/nov'),{status:'published',snapshot:{}});
  await setDoc(doc(d,'weddingInvitations/W1'),{slug:'ok',publishedConfig:{}});
  await setDoc(doc(d,'invitationSlugs/ok'),{weddingId:'W1'}); });
const anon=env.unauthenticatedContext(), A=env.authenticatedContext('ua',{email:'a@x.pt',email_verified:true}), B=env.authenticatedContext('ub',{email:'b@x.pt',email_verified:true});
for (const [n,c] of [['anon',anon],['dono A',A],['outro B',B]]) {
  const F=c.firestore();
  await rec(n+' lê convite publicado e válido',false,()=>getDoc(doc(F,'publicInvitations/ok')));
  await rec(n+' lê convite expirado',true,()=>getDoc(doc(F,'publicInvitations/exp')));
  await rec(n+' lê convite suspenso',true,()=>getDoc(doc(F,'publicInvitations/susp')));
  await rec(n+' lê convite despublicado',true,()=>getDoc(doc(F,'publicInvitations/unp')));
  await rec(n+' lê convite sem validUntil',true,()=>getDoc(doc(F,'publicInvitations/nov')));
  await rec(n+' lê convite inexistente',true,()=>getDoc(doc(F,'publicInvitations/naoexiste')));
  await rec(n+' lista publicInvitations',true,()=>getDocs(collection(F,'publicInvitations')));
  await rec(n+' query status==published',true,()=>getDocs(query(collection(F,'publicInvitations'),where('status','==','published'))));
  await rec(n+' escreve publicInvitations',true,()=>setDoc(doc(F,'publicInvitations/ok'),{status:'published',validUntil:FUT}));
  await rec(n+' cria publicInvitations novo',true,()=>setDoc(doc(F,'publicInvitations/novo'),{status:'published',validUntil:FUT}));
  await rec(n+' atualiza publicInvitations',true,()=>updateDoc(doc(F,'publicInvitations/ok'),{status:'published'}));
  await rec(n+' apaga publicInvitations',true,()=>deleteDoc(doc(F,'publicInvitations/ok')));
  await rec(n+' lê weddingInvitations/W1',true,()=>getDoc(doc(F,'weddingInvitations/W1')));
  await rec(n+' escreve weddingInvitations/W1',true,()=>setDoc(doc(F,'weddingInvitations/W1'),{status:'published'}));
  await rec(n+' lê invitationSlugs/ok',true,()=>getDoc(doc(F,'invitationSlugs/ok')));
  await rec(n+' escreve invitationSlugs/x',true,()=>setDoc(doc(F,'invitationSlugs/x'),{weddingId:'W1'}));
  await rec(n+' lista invitationSlugs',true,()=>getDocs(collection(F,'invitationSlugs')));
}
await env.cleanup(); let f=0; for(const r of res){ console.log(r.join(' ')); if(r[0]==='FAIL') f++; }
console.log(`RESULT passed=${res.length-f} failed=${f}`); process.exit(f?1:0);
