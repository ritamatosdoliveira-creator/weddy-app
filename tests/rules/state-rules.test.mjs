// A.4.3 — regras do campo "json" (tipo string, ≤ 900000) e da quarentena (fechada ao cliente).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; }
  res.push([blocked===expectBlocked?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO']); };
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],ownerUids:['A'],creatorEmail:'a@x.pt',json:'{}'});
  await setDoc(doc(db,'weddingStateQuarantine/W1_1'),{weddingId:'W1',json:'{x'});
});
const A=env.authenticatedContext('A',{email:'a@x.pt',email_verified:true}); const db=A.firestore();
const W=()=>doc(db,'weddings/W1');
await rec('guardar estado normal (string)',false,()=>updateDoc(W(),{json:JSON.stringify({budget:{total:1}})}));
await rec('guardar estado vazio "{}"',false,()=>updateDoc(W(),{json:'{}'}));
await rec('guardar string com 900000 caracteres',false,()=>updateDoc(W(),{json:'x'.repeat(900000)}));
await rec('recusa string com 900001 caracteres',true,()=>updateDoc(W(),{json:'x'.repeat(900001)}));
await rec('recusa json como objeto',true,()=>updateDoc(W(),{json:{budget:1}}));
await rec('recusa json como array',true,()=>updateDoc(W(),{json:[]}));
await rec('recusa json como número',true,()=>updateDoc(W(),{json:5}));
await rec('recusa json null',true,()=>updateDoc(W(),{json:null}));
await rec('atualizar outro campo sem tocar no json continua permitido',false,()=>updateDoc(W(),{coupleName:'Ana & Rui'}));
const create=(id,json,ctx)=>{ const d=ctx.firestore(); const b=writeBatch(d); b.set(doc(d,'creators/'+ctx.__uid),{weddingId:id}); b.set(doc(d,'weddings/'+id),{ownerEmails:[ctx.__email],ownerUids:[ctx.__uid],creatorEmail:ctx.__email,json}); return b.commit(); };
const C1=env.authenticatedContext('C1',{email:'c1@x.pt',email_verified:true}); C1.__uid='C1'; C1.__email='c1@x.pt';
const C2=env.authenticatedContext('C2',{email:'c2@x.pt',email_verified:true}); C2.__uid='C2'; C2.__email='c2@x.pt';
await rec('criar casamento com json string',false,()=>create('WC1','{}',C1));
await rec('criar casamento com json objeto é recusado',true,()=>create('WC2',{a:1},C2));
await rec('quarentena: dono não lê',true,()=>getDoc(doc(db,'weddingStateQuarantine/W1_1')));
await rec('quarentena: dono não escreve',true,()=>setDoc(doc(db,'weddingStateQuarantine/W1_2'),{json:'x'}));
let bad=0; for(const r of res){ console.log(r.join('  ')); if(r[0]==='FAIL') bad++; }
console.log(`\n${res.length-bad} OK, ${bad} FALHAS`);
await env.cleanup(); process.exit(bad?1:0);
