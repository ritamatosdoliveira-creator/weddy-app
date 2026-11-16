// K.3-B — regras do Firestore para a quota de fotos: álbum cheio recusa novos documentos; contador só-servidor;
// donos leem o seu contador; isolamento entre casamentos. Emulador (não é Firebase real).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-weddy', firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; globalThis.__e=String(e.message).slice(0,160); } res.push([blocked===expectBlocked?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO',blocked!==expectBlocked?globalThis.__e:'']); };
const FUT=new Date(Date.now()+365*864e5);
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{ const db=ctx.firestore();
  for (const w of ['W1','W2','W3']) await setDoc(doc(db,'weddings/'+w),{ownerEmails:[w==='W2'?'b@x.pt':'a@x.pt'],json:'{}',subscription:{active:true,startedAt:'2025-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(FUT)}});
  await setDoc(doc(db,'guests/G1'),{weddingId:'W1',name:'F'}); await setDoc(doc(db,'guests/G3'),{weddingId:'W3',name:'F'});
  await setDoc(doc(db,'memoryQuota/W1'),{weddingId:'W1',files:2000,bytes:1,full:true});
  await setDoc(doc(db,'memoryQuota/W3'),{weddingId:'W3',files:3,bytes:1,full:false});
  await setDoc(doc(db,'memoryQuota/W1/items/x'),{status:'accepted'});
});
const anon=env.unauthenticatedContext(), A=env.authenticatedContext('A',{email:'a@x.pt',email_verified:true}), B=env.authenticatedContext('B',{email:'b@x.pt',email_verified:true});
const F=c=>c.__f||(c.__f=c.firestore());
const mem=(w,t,n)=>({weddingId:w,token:t,guestName:'F',storagePath:`memories/${w}/${t}/${n}.png`,createdAt:new Date()});
await rec('álbum cheio (W1): QR público recusado',true,()=>setDoc(doc(F(anon),'memories/m1'),mem('W1','publico','a')));
await rec('álbum cheio (W1): convite recusado',true,()=>setDoc(doc(F(anon),'memories/m2'),mem('W1','G1','a')));
await rec('álbum com espaço (W3, full=false): aceita',false,()=>setDoc(doc(F(anon),'memories/m3'),mem('W3','G3','a')));
await rec('sem contador (W2): aceita (casamento novo)',false,()=>setDoc(doc(F(anon),'memories/m4'),mem('W2','publico','a')));
await rec('cliente não escreve o contador (anónimo)',true,()=>setDoc(doc(F(anon),'memoryQuota/W3'),{full:false,files:0}));
await rec('dono não escreve o contador',true,()=>updateDoc(doc(F(A),'memoryQuota/W1'),{full:false}));
await rec('dono não apaga o contador',true,()=>deleteDoc(doc(F(A),'memoryQuota/W1')));
await rec('dono lê o contador do seu casamento',false,()=>getDoc(doc(F(A),'memoryQuota/W1')));
await rec('outro casal não lê o contador de W1',true,()=>getDoc(doc(F(B),'memoryQuota/W1')));
await rec('anónimo não lê o contador',true,()=>getDoc(doc(F(anon),'memoryQuota/W1')));
await rec('registos por ficheiro (items) não são legíveis',true,()=>getDoc(doc(F(A),'memoryQuota/W1/items/x')));
await rec('convidado de outro casamento não usa quota alheia (token G3 em W1)',true,()=>setDoc(doc(F(anon),'memories/m5'),mem('W1','G3','a')));
// P1 (pós-auditoria K.3): o storagePath tem de ser memories/{weddingId}/{token}/{ficheiro}, coerente com o documento.
await rec('caminho coerente (W3, G3): aceita',false,()=>setDoc(doc(F(anon),'memories/c1'),mem('W3','G3','b')));
await rec('token do documento ≠ token do caminho (G3 vs publico): recusa',true,()=>setDoc(doc(F(anon),'memories/c2'),{...mem('W3','G3','b'),storagePath:'memories/W3/publico/b.png'}));
await rec('documento publico a apontar para pasta de convite G3: recusa',true,()=>setDoc(doc(F(anon),'memories/c3'),{...mem('W3','publico','b'),storagePath:'memories/W3/G3/b.png'}));
await rec('weddingId do documento ≠ caminho (W3 vs W2): recusa',true,()=>setDoc(doc(F(anon),'memories/c4'),{...mem('W3','publico','b'),storagePath:'memories/W2/publico/b.png'}));
await rec('caminho com subpasta extra: recusa',true,()=>setDoc(doc(F(anon),'memories/c5'),{...mem('W3','G3','b'),storagePath:'memories/W3/G3/sub/b.png'}));
await rec('caminho sem nome de ficheiro: recusa',true,()=>setDoc(doc(F(anon),'memories/c6'),{...mem('W3','G3','b'),storagePath:'memories/W3/G3/'}));
await rec('caminho sem pasta de token: recusa',true,()=>setDoc(doc(F(anon),'memories/c7'),{...mem('W3','G3','b'),storagePath:'memories/W3/b.png'}));
await rec('caminho fora de memories/: recusa',true,()=>setDoc(doc(F(anon),'memories/c8'),{...mem('W3','G3','b'),storagePath:'documents/W3/G3/b.png'}));
// K.4 (30): as filas internas (caminhos com token) nunca são acessíveis a clientes — nem anónimos, nem donos verificados.
for (const col of ['memoryQuotaCleanupQueue','memoryQuotaPending','memoryQuotaOrphans']) {
  await rec(`${col}: leitura anónima recusada`,true,()=>getDoc(doc(F(anon),`${col}/x`)));
  await rec(`${col}: escrita anónima recusada`,true,()=>setDoc(doc(F(anon),`${col}/x`),{weddingId:'W3'}));
  await rec(`${col}: leitura pelo dono verificado recusada`,true,()=>getDoc(doc(F(A),`${col}/x`)));
  await rec(`${col}: escrita pelo dono verificado recusada`,true,()=>setDoc(doc(F(A),`${col}/x`),{weddingId:'W3'}));
}
await rec('memories: cliente não pode escrever quotaState (create)',true,()=>setDoc(doc(F(anon),'memories/qs1'),{...mem('W3','G3','b'),quotaState:'pending'}));
console.log(res.map(r=>r.join(' | ')).join('\n')); const nFail=res.filter(r=>r[0]==='FAIL').length; console.log('FAILS:',nFail,'/',res.length);
await env.cleanup(); process.exit(nFail?1:0);
