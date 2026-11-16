// Regras Firestore para o consentimento WhatsApp (A.3-bis): o cliente nunca escreve.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; }
  res.push([blocked===expectBlocked?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO']); };
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{}'});
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}'});
  await setDoc(doc(db,'whatsappConsents/W1_g1'),{weddingId:'W1',guestId:'g1',phone:'+351912345678',status:'granted'});
  await setDoc(doc(db,'whatsappConsentRateLimit/tok'),{count:1});
});
const U=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true});
const A=U('A','a@x.pt'), B=U('B','b@x.pt'); const anon=env.unauthenticatedContext();
const unverified=env.authenticatedContext('A',{email:'a@x.pt',email_verified:false});
const F=c=>c.__f||(c.__f=c.firestore());
await rec('casal dono lê o consentimento dos seus convidados',false,()=>getDoc(doc(F(A),'whatsappConsents/W1_g1')));
await rec('outro casal não lê',true,()=>getDoc(doc(F(B),'whatsappConsents/W1_g1')));
await rec('anónimo (convidado) não lê o registo',true,()=>getDoc(doc(F(anon),'whatsappConsents/W1_g1')));
await rec('dono com email não verificado não lê',true,()=>getDoc(doc(F(unverified),'whatsappConsents/W1_g1')));
await rec('ninguém lista a coleção (dono)',true,()=>getDocs(collection(F(A),'whatsappConsents')));
await rec('ninguém lista por weddingId (dono)',true,()=>getDocs(query(collection(F(A),'whatsappConsents'),where('weddingId','==','W1'))));
await rec('dono não cria consentimento',true,()=>setDoc(doc(F(A),'whatsappConsents/W1_g2'),{weddingId:'W1',guestId:'g2',status:'granted'}));
await rec('dono não altera consentimento existente',true,()=>updateDoc(doc(F(A),'whatsappConsents/W1_g1'),{status:'granted'}));
await rec('dono não apaga consentimento (prova)',true,()=>deleteDoc(doc(F(A),'whatsappConsents/W1_g1')));
await rec('anónimo não cria consentimento',true,()=>setDoc(doc(F(anon),'whatsappConsents/W1_g1'),{weddingId:'W1',guestId:'g1',status:'granted'}));
await rec('outro casal não cria',true,()=>setDoc(doc(F(B),'whatsappConsents/W1_g3'),{weddingId:'W1',guestId:'g3',status:'granted'}));
await rec('ninguém lê o contador de limite',true,()=>getDoc(doc(F(A),'whatsappConsentRateLimit/tok')));
await rec('ninguém escreve o contador de limite',true,()=>setDoc(doc(F(anon),'whatsappConsentRateLimit/tok'),{count:0}));
await rec('guestPhoneIndex continua fechado ao cliente',true,()=>setDoc(doc(F(A),'guestPhoneIndex/+351900000000'),{weddingId:'W1',guestId:'g1'}));
let bad=0; for(const r of res){ console.log(r.join('  ')); if(r[0]==='FAIL') bad++; }
console.log(`\n${res.length-bad} OK, ${bad} FALHAS`);
await env.cleanup(); process.exit(bad?1:0);
