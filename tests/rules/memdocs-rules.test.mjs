// Fase G — Memories e Documents: isolamento, Premium e acesso direto (regras REAIS no emulador).
// Complementa premium-rules.test.mjs (não o substitui). "bloqueado" = a regra recusou.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';
const env = await initializeTestEnvironment({ projectId:'demo-weddy',
  firestore:{ host:'127.0.0.1', port:8085, rules:fs.readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') },
  storage:{ host:'127.0.0.1', port:9195, rules:fs.readFileSync(new URL('../../storage.rules', import.meta.url),'utf8') } });
const res=[]; const rec=async(name,expectBlocked,p)=>{ let blocked; try{ await p(); blocked=false; }catch(e){ blocked=true; globalThis.__e=String(e.message).slice(0,90); }
  const ok = blocked===expectBlocked; res.push([ok?'OK  ':'FAIL',name,blocked?'bloqueado':'PERMITIDO',(!ok)?globalThis.__e||'':'']); };
const FUT=new Date(Date.now()+365*864e5), PAST=new Date(Date.now()-864e5);
async function seed(){
  await env.clearFirestore(); await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(), s=ctx.storage();
    await setDoc(doc(db,'weddings/W1'),{ownerEmails:['a@x.pt'],creatorEmail:'a@x.pt',json:'{}',subscription:{active:true,plan:'premium-12meses',startedAt:new Date().toISOString(),premiumUntil:Timestamp.fromDate(FUT)}});
    await setDoc(doc(db,'weddings/W2'),{ownerEmails:['b@x.pt'],creatorEmail:'b@x.pt',json:'{}',subscription:{active:true,startedAt:'2025-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(FUT)}});
    await setDoc(doc(db,'weddings/W3'),{ownerEmails:['c@x.pt'],creatorEmail:'c@x.pt',json:'{}',subscription:{active:true,startedAt:'2024-01-01T00:00:00Z',premiumUntil:Timestamp.fromDate(PAST)}}); // Premium expirado por data
    await setDoc(doc(db,'weddings/W5'),{ownerEmails:['e@x.pt'],creatorEmail:'e@x.pt',json:'{}',subscription:{active:false,plan:null,startedAt:'2024-01-01T00:00:00Z'}});          // cancelado
    await setDoc(doc(db,'weddings/W6'),{ownerEmails:['f@x.pt'],creatorEmail:'f@x.pt',json:'{}',subscription:'lixo'});                                                                  // estado inválido
    await setDoc(doc(db,'guests/G1'),{weddingId:'W1'}); await setDoc(doc(db,'guests/G2'),{weddingId:'W2'});
    for(const [id,w] of [['M1','W1'],['M2','W2'],['M3','W3'],['M5','W5']]) await setDoc(doc(db,'memories/'+id),{weddingId:w,token:'publico',guestName:'x',storagePath:`memories/${w}/publico/f.png`,createdAt:new Date()});
    for(const w of ['W1','W2','W3','W5','W6']){
      await uploadBytes(ref(s,`documents/${w}/old.pdf`),new Uint8Array([1,2,3]),{contentType:'application/pdf'});
      await uploadBytes(ref(s,`memories/${w}/publico/f.png`),new Uint8Array([1,2,3]),{contentType:'image/png'});
    }
  });
}
const U=(uid,email,verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified});
const A=U('A','a@x.pt'), B=U('B','b@x.pt'), C=U('C','c@x.pt'), E=U('E','e@x.pt'), Fx=U('F','f@x.pt'), Aunv=U('A','a@x.pt',false);
const anon=env.unauthenticatedContext();
const F=c=>c.__f||(c.__f=c.firestore()); const S=c=>c.__s||(c.__s=c.storage());
const bytes=n=>new Uint8Array(n);
const put=(ctx,p,ct='application/pdf',n=3)=>uploadBytes(ref(S(ctx),p),bytes(n),{contentType:ct});
const mem=(w,tok,extra={})=>({weddingId:w,token:tok,guestName:'x',storagePath:`memories/${w}/${tok}/f.png`,createdAt:new Date(),...extra});
await seed();

// ---------- DOCUMENTOS (Storage) ----------
await rec('A (Premium) lê o seu documento',false,()=>getBytes(ref(S(A),'documents/W1/old.pdf')));
await rec('B lê documento de W1 (outro casamento)',true,()=>getBytes(ref(S(B),'documents/W1/old.pdf')));
await rec('B apaga documento de W1',true,()=>deleteObject(ref(S(B),'documents/W1/old.pdf')));
await rec('B substitui (update) documento de W1',true,()=>put(B,'documents/W1/old.pdf'));
await rec('B cria documento em W1',true,()=>put(B,'documents/W1/novo.pdf'));
await rec('anon lê documento de W1 (URL/caminho direto)',true,()=>getBytes(ref(S(anon),'documents/W1/old.pdf')));
await rec('anon apaga documento de W1',true,()=>deleteObject(ref(S(anon),'documents/W1/old.pdf')));
await rec('anon cria documento em W1',true,()=>put(anon,'documents/W1/anon.pdf'));
await rec('anon lista documents/W1',true,()=>listAll(ref(S(anon),'documents/W1')));
await rec('B lista documents/W1',true,()=>listAll(ref(S(B),'documents/W1')));
await rec('dono com e-mail NÃO verificado lê documento',true,()=>getBytes(ref(S(Aunv),'documents/W1/old.pdf')));
await rec('dono com e-mail NÃO verificado cria documento',true,()=>put(Aunv,'documents/W1/nv.pdf'));
await rec('A cria PDF em subpasta (caminho não previsto)',true,()=>put(A,'documents/W1/sub/x.pdf'));
await rec('A cria documento fora da sua pasta (documents/W2)',true,()=>put(A,'documents/W2/x.pdf'));
await rec('A cria ficheiro numa raiz inventada (docs/W1)',true,()=>put(A,'docs/W1/x.pdf'));
await rec('A cria PDF válido (Premium)',false,()=>put(A,'documents/W1/ok.pdf'));
await rec('A cria imagem png (Premium)',false,()=>put(A,'documents/W1/ok.png','image/png'));
await rec('A cria text/html',true,()=>put(A,'documents/W1/x.html','text/html'));
await rec('A cria svg',true,()=>put(A,'documents/W1/x.svg','image/svg+xml'));
await rec('A cria application/zip disfarçado de .pdf (MIME zip)',true,()=>put(A,'documents/W1/x.pdf','application/zip'));
await rec('A cria documento de 15 MB exatos (limite é < 15 MB)',true,()=>put(A,'documents/W1/big.pdf','application/pdf',15*1024*1024));
await rec('A cria documento de 15 MB - 1 byte',false,()=>put(A,'documents/W1/big2.pdf','application/pdf',15*1024*1024-1));
await rec('A (Premium) substitui o seu documento (update)',false,()=>put(A,'documents/W1/old.pdf'));
// Premium: expirado por data / cancelado / estado inválido
await rec('C (expirado) cria documento',true,()=>put(C,'documents/W3/n.pdf'));
await rec('C (expirado) substitui documento antigo',true,()=>put(C,'documents/W3/old.pdf'));
await rec('C (expirado) LÊ documento antigo (preservado)',false,()=>getBytes(ref(S(C),'documents/W3/old.pdf')));
await rec('E (cancelado) cria documento',true,()=>put(E,'documents/W5/n.pdf'));
await rec('E (cancelado) LÊ documento antigo (preservado)',false,()=>getBytes(ref(S(E),'documents/W5/old.pdf')));
await rec('F (subscription inválida) cria documento',true,()=>put(Fx,'documents/W6/n.pdf'));
await rec('F (subscription inválida) LÊ documento antigo',false,()=>getBytes(ref(S(Fx),'documents/W6/old.pdf')));
await rec('C (expirado) APAGA documento antigo',false,()=>deleteObject(ref(S(C),'documents/W3/old.pdf')));
await rec('E (cancelado) APAGA documento antigo',false,()=>deleteObject(ref(S(E),'documents/W5/old.pdf')));

// ---------- MEMORIES (Storage) ----------
await seed();
await rec('A lê foto do seu casamento',false,()=>getBytes(ref(S(A),'memories/W1/publico/f.png')));
await rec('B lê foto de W1',true,()=>getBytes(ref(S(B),'memories/W1/publico/f.png')));
await rec('anon lê foto de W1 (URL direto sem token)',true,()=>getBytes(ref(S(anon),'memories/W1/publico/f.png')));
await rec('anon apaga foto de W1',true,()=>deleteObject(ref(S(anon),'memories/W1/publico/f.png')));
await rec('B apaga foto de W1',true,()=>deleteObject(ref(S(B),'memories/W1/publico/f.png')));
await rec('anon substitui (update) foto existente de W1',true,()=>put(anon,'memories/W1/publico/f.png','image/png'));
await rec('B substitui foto existente de W1',true,()=>put(B,'memories/W1/publico/f.png','image/png'));
await rec('anon cria foto nova (diagnóstico)',false,()=>put(anon,'memories/W1/publico/diag.png','image/png'));
await rec('anon SOBRESCREVE a foto que acabou de criar (update)',true,()=>put(anon,'memories/W1/publico/diag.png','image/png'));
await rec('A (dono Premium) sobrescreve foto existente (update)',true,()=>put(A,'memories/W1/publico/diag.png','image/png'));
await rec('anon lista memories/W1',true,()=>listAll(ref(S(anon),'memories/W1/publico')));
await rec('dono não verificado lê foto',true,()=>getBytes(ref(S(Aunv),'memories/W1/publico/f.png')));
await rec('anon envia foto com token de convidado real de W1',false,()=>put(anon,'memories/W1/G1/n.png','image/png'));
await rec('anon envia foto com token inexistente',true,()=>put(anon,'memories/W1/NAOEXISTE/n.png','image/png'));
await rec('anon envia foto para W1 com token de convidado de W2',true,()=>put(anon,'memories/W1/G2/n.png','image/png'));
await rec('anon envia foto em caminho sem token (memories/W1/n.png)',true,()=>put(anon,'memories/W1/n.png','image/png'));
await rec('anon envia foto para W1 (Premium) formato svg',true,()=>put(anon,'memories/W1/publico/n.svg','image/svg+xml'));
await rec('anon envia pdf como foto',true,()=>put(anon,'memories/W1/publico/n.pdf','application/pdf'));
await rec('anon envia foto de 8 MB exatos (limite < 8 MB)',true,()=>put(anon,'memories/W1/publico/big.png','image/png',8*1024*1024));
await rec('anon envia foto de 8 MB - 1 byte',false,()=>put(anon,'memories/W1/publico/big2.png','image/png',8*1024*1024-1));
await rec('anon envia foto para casamento com Premium expirado',true,()=>put(anon,'memories/W3/publico/n.png','image/png'));
await rec('anon envia foto para casamento cancelado',true,()=>put(anon,'memories/W5/publico/n.png','image/png'));
await rec('anon envia foto para casamento com subscription inválida',true,()=>put(anon,'memories/W6/publico/n.png','image/png'));
await rec('C (Premium expirado) LÊ as fotos antigas',false,()=>getBytes(ref(S(C),'memories/W3/publico/f.png')));
await rec('C (Premium expirado) APAGA as fotos antigas',false,()=>deleteObject(ref(S(C),'memories/W3/publico/f.png')));
await rec('E (cancelado) LÊ as fotos antigas',false,()=>getBytes(ref(S(E),'memories/W5/publico/f.png')));

// ---------- MEMORIES (Firestore) ----------
await seed();
await rec('A lista as suas memories (query por weddingId)',false,()=>getDocs(query(collection(F(A),'memories'),where('weddingId','==','W1'))));
await rec('A lista memories de W2 (query por weddingId alheio)',true,()=>getDocs(query(collection(F(A),'memories'),where('weddingId','==','W2'))));
await rec('A lista TODAS as memories (sem filtro)',true,()=>getDocs(collection(F(A),'memories')));
await rec('B lê memory de W1',true,()=>getDoc(doc(F(B),'memories/M1')));
await rec('anon lê memory',true,()=>getDoc(doc(F(anon),'memories/M1')));
await rec('anon lista memories de W1',true,()=>getDocs(query(collection(F(anon),'memories'),where('weddingId','==','W1'))));
await rec('dono não verificado lê memory',true,()=>getDoc(doc(F(Aunv),'memories/M1')));
await rec('B apaga memory de W1',true,()=>deleteDoc(doc(F(B),'memories/M1')));
await rec('anon apaga memory de W1',true,()=>deleteDoc(doc(F(anon),'memories/M1')));
await rec('A atualiza memory (mudar weddingId para W2)',true,()=>updateDoc(doc(F(A),'memories/M1'),{weddingId:'W2'}));
await rec('A atualiza memory (mudar storagePath)',true,()=>updateDoc(doc(F(A),'memories/M1'),{storagePath:'memories/W2/publico/f.png'}));
await rec('anon atualiza memory',true,()=>updateDoc(doc(F(anon),'memories/M1'),{guestName:'hack'}));
await rec('anon cria memory com campo extra (url javascript:)',true,()=>addDoc(collection(F(anon),'memories'),mem('W1','publico',{url:'javascript:alert(1)'})));
await rec('anon cria memory com storagePath de outro casamento',true,()=>addDoc(collection(F(anon),'memories'),mem('W1','publico',{storagePath:'memories/W2/publico/f.png'})));
await rec('anon cria memory com guestName > 120',true,()=>addDoc(collection(F(anon),'memories'),mem('W1','publico',{guestName:'x'.repeat(121)})));
await rec('anon cria memory com guestName = 120',false,()=>addDoc(collection(F(anon),'memories'),mem('W1','publico',{guestName:'x'.repeat(120)})));
await rec('anon cria memory para casamento inexistente',true,()=>addDoc(collection(F(anon),'memories'),mem('NAOEXISTE','publico')));
await rec('anon cria memory com token de convidado de outro casamento',true,()=>addDoc(collection(F(anon),'memories'),mem('W1','G2')));
await rec('anon cria memory com token numérico',true,()=>addDoc(collection(F(anon),'memories'),mem('W1',123)));
await rec('anon cria memory sem token',true,()=>addDoc(collection(F(anon),'memories'),{weddingId:'W1',storagePath:'memories/W1/publico/f.png',createdAt:new Date()}));
await rec('anon cria memory para casamento cancelado (W5)',true,()=>addDoc(collection(F(anon),'memories'),mem('W5','publico')));
await rec('anon cria memory para casamento com subscription inválida (W6)',true,()=>addDoc(collection(F(anon),'memories'),mem('W6','publico')));
await rec('C (Premium expirado) LÊ memories antigas',false,()=>getDocs(query(collection(F(C),'memories'),where('weddingId','==','W3'))));
await rec('C (Premium expirado) APAGA memory antiga',false,()=>deleteDoc(doc(F(C),'memories/M3')));
await rec('E (cancelado) LÊ memories antigas',false,()=>getDocs(query(collection(F(E),'memories'),where('weddingId','==','W5'))));
await rec('E (cancelado) APAGA memory antiga',false,()=>deleteDoc(doc(F(E),'memories/M5')));
await rec('A apaga a sua memory',false,()=>deleteDoc(doc(F(A),'memories/M1')));

// ---------- Estado do casamento (onde ficam os registos de documentos) ----------
await rec('B reescreve json do casamento W1 (apagar registos de documentos)',true,()=>updateDoc(doc(F(B),'weddings/W1'),{json:'{"weddingDocuments":[]}'}));
await rec('C (expirado) grava json do próprio casamento (preservação/edição)',false,()=>updateDoc(doc(F(C),'weddings/W3'),{json:'{"weddingDocuments":[{"name":"a"}]}'}));

console.log(res.map(r=>r.join(' | ')).join('\n')); const nFail=res.filter(r=>r[0]==='FAIL').length; console.log('FAILS:',nFail,'/',res.length);
await env.cleanup(); process.exit(nFail?1:0);
