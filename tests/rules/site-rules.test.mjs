// Fase I — Wedding Website: regras REAIS (Firestore + Storage) no emulador.
// Leitura pública só de sites publicados e dentro da validade; rascunhos e reservas privados; sem listagem.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') },
  storage:{ host:'127.0.0.1', port:9195, rules:fs.readFileSync(new URL('../../storage.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; globalThis.__e=String(e.message).slice(0,90); }
  const ok = blocked===expectBlocked; res.push([ok?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO',(!ok)?globalThis.__e||'':'']); };
const FUT=Timestamp.fromDate(new Date(Date.now()+365*864e5)), PAST=Timestamp.fromDate(new Date(Date.now()-864e5));
await env.clearFirestore(); await env.clearStorage();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(), s=ctx.storage();
  await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],json:'{}',subscription:{active:true,startedAt:new Date().toISOString()}});
  await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],json:'{}',subscription:{active:true,startedAt:new Date().toISOString()}});
  await setDoc(doc(db,'weddings/W3'),{ownerEmails:['c@x.pt'],json:'{}',subscription:{active:true,startedAt:'2024-01-01T00:00:00Z'}});
  await setDoc(doc(db,'weddingSites/W1'),{weddingId:'W1',draft:{title:'x'},premiumUntil:FUT,status:'published',slug:'pub'});
  await setDoc(doc(db,'weddingSites/W3'),{weddingId:'W3',draft:{title:'x'},premiumUntil:PAST});
  await setDoc(doc(db,'publicWeddingSites/pub'),{status:'published',validUntil:FUT,snapshot:{names:['A','B']}});
  await setDoc(doc(db,'publicWeddingSites/expirado'),{status:'published',validUntil:PAST,snapshot:{names:['A','B']}});
  await setDoc(doc(db,'publicWeddingSites/suspenso'),{status:'suspended'});
  await setDoc(doc(db,'publicWeddingSites/despub'),{status:'unpublished'});
  await setDoc(doc(db,'siteSlugs/pub'),{weddingId:'W1'});
  for(const p of ['sites/W1/capa.jpg','public-sites/pub/v1-cover.jpg','public-sites/suspenso/v1-cover.jpg','public-sites/despub/v1-cover.jpg','public-sites/expirado/v1-cover.jpg'])
    await uploadBytes(ref(s,p),new Uint8Array([1,2,3]),{contentType:'image/jpeg'});
});
const U=(uid,email,verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified});
const A=U('ua','a@x.pt'), B=U('ub','b@x.pt'), C=U('uc','c@x.pt'), Aunv=U('ua2','a@x.pt',false), anon=env.unauthenticatedContext();
const _f=new Map(), _s=new Map();
const F=c=>{ if(!_f.has(c)) _f.set(c,c.firestore()); return _f.get(c); };
const S=c=>{ if(!_s.has(c)) _s.set(c,c.storage()); return _s.get(c); };
// aquecimento (a 1.ª utilização de cada contexto autenticado no emulador pode falhar por arranque, não por regras)
// --- publicWeddingSites (página pública)
await rec('anon lê site publicado e válido',false,()=>getDoc(doc(F(anon),'publicWeddingSites/pub')));
await rec('anon lê site publicado mas EXPIRADO (validUntil no passado)',true,()=>getDoc(doc(F(anon),'publicWeddingSites/expirado')));
await rec('anon lê site SUSPENSO',true,()=>getDoc(doc(F(anon),'publicWeddingSites/suspenso')));
await rec('anon lê site DESPUBLICADO',true,()=>getDoc(doc(F(anon),'publicWeddingSites/despub')));
await rec('anon lê site inexistente',true,()=>getDoc(doc(F(anon),'publicWeddingSites/naoexiste')));
await rec('anon lista publicWeddingSites (enumeração)',true,()=>getDocs(collection(F(anon),'publicWeddingSites')));
await rec('A (dono) escreve publicWeddingSites (forjar publicação)',true,()=>setDoc(doc(F(A),'publicWeddingSites/pub'),{status:'published',validUntil:FUT}));
await rec('A apaga publicWeddingSites',true,()=>deleteDoc(doc(F(A),'publicWeddingSites/pub')));
// --- rascunho privado
await rec('A lê o seu rascunho',false,()=>getDoc(doc(F(A),'weddingSites/W1')));
await rec('B lê rascunho de A',true,()=>getDoc(doc(F(B),'weddingSites/W1')));
await rec('anon lê rascunho',true,()=>getDoc(doc(F(anon),'weddingSites/W1')));
await rec('dono com e-mail NÃO verificado lê rascunho',true,()=>getDoc(doc(F(Aunv),'weddingSites/W1')));
await rec('A lista weddingSites',true,()=>getDocs(collection(F(A),'weddingSites')));
await rec('A escreve o próprio rascunho diretamente (só via Cloud Function)',true,()=>setDoc(doc(F(A),'weddingSites/W1'),{premiumUntil:FUT}));
await rec('A reserva um slug diretamente',true,()=>setDoc(doc(F(A),'siteSlugs/meu'),{weddingId:'W1'}));
await rec('anon lê siteSlugs (descobrir quem usa o endereço)',true,()=>getDoc(doc(F(anon),'siteSlugs/pub')));
await rec('A lê siteSlugs',true,()=>getDoc(doc(F(A),'siteSlugs/pub')));
// --- Storage: rascunho de fotos
await rec('A lê foto do seu rascunho',false,()=>getBytes(ref(S(A),'sites/W1/capa.jpg')));
await rec('B lê foto de rascunho de A',true,()=>getBytes(ref(S(B),'sites/W1/capa.jpg')));
await rec('anon lê foto de rascunho',true,()=>getBytes(ref(S(anon),'sites/W1/capa.jpg')));
await rec('B apaga foto de rascunho de A',true,()=>deleteObject(ref(S(B),'sites/W1/capa.jpg')));
await rec('A (Premium) carrega foto jpeg',false,()=>uploadBytes(ref(S(A),'sites/W1/nova.jpg'),new Uint8Array([1,2,3]),{contentType:'image/jpeg'}));
await rec('A carrega SVG',true,()=>uploadBytes(ref(S(A),'sites/W1/x.svg'),new Uint8Array([1]),{contentType:'image/svg+xml'}));
await rec('A carrega PDF como foto',true,()=>uploadBytes(ref(S(A),'sites/W1/x.pdf'),new Uint8Array([1]),{contentType:'application/pdf'}));
await rec('A carrega foto de 5 MB',true,()=>uploadBytes(ref(S(A),'sites/W1/big.jpg'),new Uint8Array(5*1024*1024),{contentType:'image/jpeg'}));
await rec('B carrega foto na pasta de A',true,()=>uploadBytes(ref(S(B),'sites/W1/b.jpg'),new Uint8Array([1,2,3]),{contentType:'image/jpeg'}));
await rec('C (Premium expirado, premiumUntil no passado) carrega foto',true,()=>uploadBytes(ref(S(C),'sites/W3/c.jpg'),new Uint8Array([1,2,3]),{contentType:'image/jpeg'}));
await rec('A carrega em subpasta não prevista',true,()=>uploadBytes(ref(S(A),'sites/W1/sub/x.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}));
await rec('A apaga foto do seu rascunho',false,()=>deleteObject(ref(S(A),'sites/W1/nova.jpg')));
await rec('B lista sites/W1 (enumerar fotos de A)',true,()=>listAll(ref(S(B),'sites/W1')));
await rec('anon lista sites/W1',true,()=>listAll(ref(S(anon),'sites/W1')));
// --- Storage: fotos públicas
await rec('anon lê foto pública de site publicado',false,()=>getBytes(ref(S(anon),'public-sites/pub/v1-cover.jpg')));
await rec('anon lê foto pública de site SUSPENSO',true,()=>getBytes(ref(S(anon),'public-sites/suspenso/v1-cover.jpg')));
await rec('anon lê foto pública de site DESPUBLICADO',true,()=>getBytes(ref(S(anon),'public-sites/despub/v1-cover.jpg')));
await rec('anon lê foto pública de site EXPIRADO',true,()=>getBytes(ref(S(anon),'public-sites/expirado/v1-cover.jpg')));
await rec('anon lista public-sites/pub',true,()=>listAll(ref(S(anon),'public-sites/pub')));
await rec('A escreve em public-sites (só o servidor copia)',true,()=>uploadBytes(ref(S(A),'public-sites/pub/v9-x.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}));
await rec('A apaga foto pública',true,()=>deleteObject(ref(S(A),'public-sites/pub/v1-cover.jpg')));
console.log(res.map(r=>r.join(' | ')).join('\n')); const nFail=res.filter(r=>r[0]==='FAIL').length; console.log('FAILS:',nFail,'/',res.length);
await env.cleanup(); process.exit(nFail?1:0);
