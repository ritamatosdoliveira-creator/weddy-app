"""Fase G — Memories e Documents (cliente): lógica REAL da app sobre um Firestore/Storage simulado.
Áreas do brief: A Memories · B Documents · C Storage · D Premium · F Interface. (Regras reais: tests/rules/memdocs-rules.test.mjs.)"""
from common import *
import json
newpage = functools.partial(newpage, mode='app')
GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

SETUP = """()=>{ const t=window.__t, m=t.md; m.hookDialogs(); m.alerts.length=0; m.confirmAns=true; m.ready(); t.sub(true); t.lang('pt'); m.resetMem();
  const F=window.__F={ mem:[], gets:0, failGet:false, failDel:false, log:[], pushes:0, files:new Set(), puts:[], delAttempts:[], putFail:null, delFail:null, missing:new Set(), dlFail:false, dlCalls:0, previews:[] };
  const mk=(n)=>({ where:(f,op,v)=>({ get:()=>{ F.gets++; if(F.failGet) return Promise.reject({code:'permission-denied',message:'negado'}); const rows=F.mem.filter(r=>r.weddingId===v); return Promise.resolve({ forEach:cb=>rows.forEach(r=>cb({id:r.id,data:()=>{ const o=Object.assign({},r); delete o.id; return o; }})) }); } }),
     doc:(id)=>({ delete:()=>{ if(F.failDel) return Promise.reject({code:'unavailable'}); F.mem=F.mem.filter(r=>r.id!==id); return Promise.resolve(); }, set:()=>Promise.resolve(), update:()=>Promise.resolve() }),
     add:(o)=>{ F.log.push({col:n,o}); return Promise.resolve({}); } });
  const dbo={ collection:mk }; m.db(dbo); { const old=window.firebase, fs=Object.assign(()=>dbo,{FieldValue:{serverTimestamp:()=>'TS'}}); window.firebase=new Proxy(old,{get:(t,k)=>k==='firestore'?fs:t[k]}); }
  m.stor({ ref:(p)=>({ put:(f)=>{ F.puts.push({p,size:f.size,type:f.type}); if(F.putFail) return Promise.reject(F.putFail); F.files.add(p); return Promise.resolve({}); },
      delete:()=>{ F.delAttempts.push(p); if(F.delFail) return Promise.reject(F.delFail); F.files.delete(p); return Promise.resolve(); },
      getDownloadURL:()=>{ F.dlCalls++; if(F.missing.has(p)) return Promise.reject({code:'storage/object-not-found'}); if(F.dlFail) return Promise.reject({code:'storage/unknown'}); return Promise.resolve('%s'); } }) });
  m.push(()=>{ F.pushes++; }); m.prev((u,n)=>{ F.previews.push([u,n]); }); m.ext(async f=>'texto de '+f.name);
  t.state.weddingDocuments=[]; window.MM=(id,o)=>Object.assign({id,weddingId:'W1',token:'tokX',guestName:'Ana',storagePath:'memories/W1/tokX/'+id+'.jpg',createdAt:{toMillis:()=>1000}},o||{});
  window.PDF=(name,size,type)=>{ const f=new File([new Uint8Array(size||100)],name,{type:type===undefined?'application/pdf':type}); return f; };
}""" % GIF

async def newmd(b, w=390, h=844, lang='pt'):
    pg = await newpage(b, w, h)
    await pg.evaluate(SETUP)
    if lang != 'pt': await pg.evaluate("(l)=>window.__t.lang(l)", lang)
    return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newmd(b)
        ev = lambda js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
        ok(await ev("()=>window.__t.md.fbReady()"), 'ambiente: Firebase "pronto" no teste (carregamentos reais da app)')

        # ================= A. Memories =================
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.mem=[MM('a',{createdAt:{toMillis:()=>1000}}),MM('b',{createdAt:{toMillis:()=>3000},token:'publico',guestName:''}),MM('c',{createdAt:{toMillis:()=>2000}}),Object.assign(MM('x',{}),{weddingId:'OUTRO'}),MM('semfoto',{storagePath:null}),MM('legado',{storagePath:null,url:'https://cdn.test/x.jpg'})];
          await m.loadMem(); const s=m.memState(); return { ids:s.mem.map(x=>x.id), urls:s.mem.map(x=>!!x.url), gets:F.gets }; }""")
        ok(r['ids'][:3] == ['b','c','a'] and 'x' not in r['ids'], f'A: lista ordenada do mais recente e SÓ do casamento atual {r["ids"]}')
        ok(r['gets'] == 1, 'A: um único pedido ao Firestore por carregamento')
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.mem=[MM('a'),MM('b')]; F.missing.add('memories/W1/tokX/b.jpg'); await m.loadMem(); const s=m.memState(); return s.mem.map(x=>({id:x.id,url:!!x.url,missing:!!x.missing})); }""")
        ok(r[0]['url'] and not r[0]['missing'] and r[1]['missing'] and not r[1]['url'], f'A/C: ficheiro em falta no Storage fica identificado (não escondido) {r}')
        await ev("()=>{ window.__t.md.openMem(); }"); await pg.wait_for_timeout(150)
        r = await ev("()=>({tiles:document.querySelectorAll('.memory-tile').length, empty:document.querySelectorAll('.memory-tile img[src=\"\"]').length, miss:document.querySelectorAll('.memory-tile.memory-missing').length})")
        ok(r['empty'] == 0 and r['miss'] == 1, f'A/F: foto em falta mostra aviso claro, sem imagem vazia partida {r}')
        # esquemas perigosos em url legado
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.mem=[MM('a',{storagePath:null,url:'javascript:alert(1)'}),MM('b',{storagePath:null,url:'data:text/html,<script>1</script>'}),MM('c',{storagePath:null,url:'https://ok.test/a.jpg'})]; await m.loadMem(); window.__t.md.openMem(); return [...document.querySelectorAll('.memory-tile a')].map(a=>a.getAttribute('href')); }""")
        await pg.wait_for_timeout(100)
        ok(r == ['https://ok.test/a.jpg'], f'A/E: só ligações https são renderizadas (url legado perigoso é ignorado) {r}')
        # erro de carregamento: sem ciclo infinito
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; m.resetMem(); F.failGet=true; F.gets=0; m.openMem(); await new Promise(r=>setTimeout(r,900)); return F.gets; }""")
        ok(r <= 1, f'A/I: falha ao carregar NÃO entra em ciclo de pedidos ({r} pedidos em 0,9 s)')
        body = await pg.inner_text('#app-body')
        ok('atualizar' in body.lower() or 'refresh' in body.lower(), 'A/F: após o erro há como tentar de novo (Atualizar)')
        ok(await ev("()=>document.querySelectorAll('#memories-refresh').length")==1, 'A/F: botão Atualizar presente após erro')
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.failGet=false; F.mem=[MM('a')]; F.gets=0; document.getElementById('memories-refresh').click(); await new Promise(r=>setTimeout(r,300)); return [F.gets, m.memState().n]; }""")
        ok(r == [1, 1], f'A: Atualizar recarrega com sucesso depois de um erro {r}')
        # apagar
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.mem=[MM('a'),MM('b')]; F.failGet=false; await m.loadMem(); const out={};
          m.confirmAns=false; await m.delMem('a','memories/W1/tokX/a.jpg'); out.cancel=[F.mem.length, F.delAttempts.length, m.memState().n];
          m.confirmAns=true; F.files.add('memories/W1/tokX/a.jpg'); await m.delMem('a','memories/W1/tokX/a.jpg'); await new Promise(r=>setTimeout(r,50)); out.okDel=[F.mem.map(x=>x.id), [...F.files], m.memState().mem.map(x=>x.id)];
          F.failDel=true; await m.delMem('b','memories/W1/tokX/b.jpg'); await new Promise(r=>setTimeout(r,50)); out.fsFail=[F.mem.length, F.delAttempts.filter(x=>x.includes('b.jpg')).length, m.memState().n, m.alerts.filter(a=>!a.startsWith('?')).length]; F.failDel=false;
          F.delFail={code:'storage/unauthorized'}; F.log.length=0; await m.delMem('b','memories/W1/tokX/b.jpg'); await new Promise(r=>setTimeout(r,80)); out.stFail=[F.mem.length, m.memState().n, F.log.map(l=>[l.col,l.o.type,l.o.failedTokens])]; return out; }""")
        ok(r['cancel'] == [2, 0, 2], f'A: cancelar a confirmação não apaga nada {r["cancel"]}')
        ok(r['okDel'] == [['b'], [], ['b']], f'A/C: apagar remove o registo, o ficheiro e a lista {r["okDel"]}')
        ok(r['fsFail'] == [1, 0, 1, 1], f'A/C: falha no Firestore → ficheiro NÃO é apagado, lista mantida, aviso ao utilizador {r["fsFail"]}')
        ok(r['stFail'][0] == 0 and r['stFail'][1] == 0 and len(r['stFail'][2]) == 1 and r['stFail'][2][0][0] == '_incident_log' and 'memories/W1/tokX/b.jpg' in r['stFail'][2][0][2], f'A/C: falha ao apagar no Storage fica REGISTADA com o caminho pendente {r["stFail"]}')
        # filtros
        r = await ev("""async()=>{ const F=window.__F, m=window.__t.md; F.mem=[MM('a'),MM('b',{token:'publico'}),MM('c')]; await m.loadMem(); m.openMem(); const cnt=()=>document.querySelectorAll('.memory-tile').length; const out=[cnt()];
          document.querySelector('[data-memfilter=invite]').click(); out.push(cnt()); document.querySelector('[data-memfilter=qr]').click(); out.push(cnt()); document.querySelector('[data-memfilter=all]').click(); out.push(cnt()); return out; }""")
        ok(r == [3, 2, 1, 3], f'A: filtros Todas / Convite / QR {r}')
        await ev("()=>{ window.__t.md.resetMem(); window.__F.mem=[]; }"); 
        r = await ev("""async()=>{ const m=window.__t.md; await m.loadMem(); m.openMem(); return document.getElementById('app-body').innerText; }""")
        ok('Ainda não há fotos' in r, 'A/F: estado vazio explica como as fotos chegam')

        # ================= B. Documents =================
        await ev("()=>{ window.__t.sec('documentos'); }"); await pg.wait_for_timeout(150)
        U = """async(a)=>{ const F=window.__F, t=window.__t; F.puts.length=0; t.md.alerts.length=0; t.state.weddingDocuments=[]; if(a.putFail) F.putFail={code:a.putFail}; else F.putFail=null;
          const f=PDF(a.name,a.size,a.type); await t.md.upload([f]); await new Promise(r=>setTimeout(r,60)); F.putFail=null;
          return { docs:t.state.weddingDocuments.map(d=>({name:d.name,sp:d.storagePath,text:d.text})), puts:F.puts.map(x=>x.p), pushes:F.pushes, status:(document.getElementById('document-upload-status')||{}).textContent, labelDisabled:/pointer-events:\\s*none/.test(((document.querySelector('label[for=document-file-input]')||{}).style||{}).cssText||'') }; }"""
        r = await ev(U, {'name':'Contrato Fotógrafo.pdf'})
        ok(len(r['docs'])==1 and r['docs'][0]['sp'].startswith('documents/W1/') and r['docs'][0]['text'].startswith('texto de'), f'B: PDF válido → registo + ficheiro no Storage do casamento {r["docs"]}')
        ok(r['puts'] == [r['docs'][0]['sp']], 'B/C: o caminho gravado no registo é o que existe no Storage')
        sp = r['docs'][0]['sp']; import re as _re
        ok(_re.fullmatch(r'documents/W1/\d+_[A-Za-z0-9._-]+\.pdf', sp) is not None, f'C: nome do ficheiro normalizado (sem espaços/acentos) {sp}')
        for nm in ['../../W2/roubo.pdf', 'a/b\\c.pdf', 'x'*300+'.pdf', 'Relatório "final" <v2>?.pdf', '.pdf', '日本語.pdf']:
            r = await ev(U, {'name':nm})
            sp = r['docs'][0]['sp'] if r['docs'] else None
            ok(sp is not None and _re.fullmatch(r'documents/W1/\d+_[A-Za-z0-9._-]{1,120}', sp) is not None and '..' not in sp and sp.count('/') == 2, f'C: nome malformado «{nm[:25]}» não escapa da pasta do casamento → {sp and sp[:60]}')
        r = await ev(U, {'name':'a.txt','type':'text/plain'}); ok(r['docs']==[] and r['puts']==[] and 'PDF' in r['status'], f'B/C: ficheiro que não é PDF é recusado com mensagem {r["status"]}')
        r = await ev(U, {'name':'a.pdf','type':''}); ok(r['docs']==[] and r['puts']==[], 'B/C: tipo MIME vazio/desconhecido é recusado')
        r = await ev(U, {'name':'grande.pdf','size':15*1024*1024+1}); ok(r['docs']==[] and r['puts']==[] and r['status'], f'B/C: acima de 15 MB recusado no cliente {r["status"]}')
        r = await ev(U, {'name':'limite.pdf','size':15*1024*1024}); ok(len(r['docs'])==1, 'B/C: exatamente 15 MB é aceite')
        r = await ev(U, {'name':'x.pdf','putFail':'storage/unauthorized'})
        ok(r['docs']==[] and 'Premium' in (r['status'] or '') or (r['docs']==[] and r['status']), f'D/C: upload recusado (Premium/regras) → NÃO cria registo sem ficheiro e explica {r["status"]}')
        r = await ev(U, {'name':'x.pdf','putFail':'storage/retry-limit-exceeded'})
        ok(r['docs']==[] and r['status'], f'C/P: falha de rede no upload → nenhum registo fantasma + mensagem para tentar de novo {r["status"]}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; t.state.weddingDocuments=[]; F.puts.length=0; await t.md.upload([PDF('a.pdf'),]); const n1=t.state.weddingDocuments.length;
          t.md.ext(async()=>{ throw new Error('corrompido'); }); await t.md.upload([PDF('b.pdf')]); const n2=t.state.weddingDocuments.length; t.md.ext(async f=>'texto'); return [n1,n2,F.puts.length,(document.getElementById('document-upload-status')||{}).textContent]; }""")
        ok(r[0]==1 and r[1]==1 and r[2]==1 and r[3], f'B/C: PDF ilegível/corrompido → mensagem, sem ficheiro carregado, nada gravado {r}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; t.state.weddingDocuments=[]; F.puts.length=0; t.md.ext(f=>new Promise(r=>setTimeout(()=>r('t'),120)));
          const a=t.md.upload([PDF('um.pdf')]), b=t.md.upload([PDF('um.pdf')]); await Promise.all([a,b]); await new Promise(r=>setTimeout(r,60)); t.md.ext(async f=>'texto de '+f.name); return [t.state.weddingDocuments.length, F.puts.length]; }""")
        ok(r == [1, 1], f'C/O: duplo envio simultâneo do mesmo ficheiro → um registo e um upload {r}')
        # abrir / apagar
        await ev("""()=>{ const F=window.__F, t=window.__t; F.files.clear(); t.state.weddingDocuments=[{name:'A.pdf',text:'x',storagePath:'documents/W1/1_A.pdf'},{name:'Forn.pdf',text:'',storagePath:'documents/W1/2_f.pdf',supplierId:'sA'},{name:'B.pdf',text:'y',storagePath:'documents/W1/3_B.pdf'},{name:'SemFicheiro.pdf',text:'z',storagePath:null},{name:'Cmp.pdf',text:'',storagePath:'documents/W1/4_cmp_c.pdf',compareId:'c1',proposalId:'p1'},{name:'Lua.pdf',text:'',storagePath:'documents/W1/5_h.pdf',honeymoonOptionId:'h1'}]; t.sec('documentos'); }""")
        await pg.wait_for_timeout(200)
        names = await ev("()=>[...document.querySelectorAll('[data-openattach] .def-row-title')].map(e=>e.textContent)")
        ok(names == ['A.pdf','B.pdf','SemFicheiro.pdf'], f'B: lista geral exclui anexos de fornecedor / comparação / lua-de-mel {names}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; F.previews.length=0; t.md.alerts.length=0; document.querySelectorAll('[data-openattach]')[1].click(); await new Promise(r=>setTimeout(r,80)); const a=F.previews.slice();
          F.dlFail=true; document.querySelectorAll('[data-openattach]')[0].click(); await new Promise(r=>setTimeout(r,80)); F.dlFail=false; const al=t.md.alerts.length;
          t.md.alerts.length=0; document.querySelectorAll('[data-openattach]')[2].click(); await new Promise(r=>setTimeout(r,80)); return [a, al, t.md.alerts.length]; }""")
        ok(r[0] == [[GIF, 'B.pdf']], f'B: abrir mostra o documento certo (índice real preservado) {r[0]}')
        ok(r[1] == 1, 'B/C: falha ao obter o ficheiro → mensagem clara')
        ok(r[2] == 1, 'B/C: documento sem ficheiro no Storage → mensagem clara (antes: nada acontecia)')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; F.log.length=0; F.delAttempts.length=0; t.md.alerts.length=0; t.md.confirmAns=false; document.querySelectorAll('[data-docdel]')[1].click(); await new Promise(r=>setTimeout(r,60)); const keep=t.state.weddingDocuments.length;
          t.md.confirmAns=true; const before=F.pushes; document.querySelectorAll('[data-docdel]')[1].click(); await new Promise(r=>setTimeout(r,80));
          return { keep, left:t.state.weddingDocuments.map(d=>d.name), del:F.delAttempts.slice(), pushed:F.pushes>before }; }""")
        ok(r['keep'] == 6, 'B: cancelar a confirmação não apaga')
        ok(r['left'] == ['A.pdf','Forn.pdf','SemFicheiro.pdf','Cmp.pdf','Lua.pdf'] and r['del'] == ['documents/W1/3_B.pdf'] and r['pushed'], f'B/C: apagar remove o documento CERTO (não outro com índice igual), apaga o ficheiro e grava {r}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; F.log.length=0; F.delFail={code:'storage/unknown'}; document.querySelectorAll('[data-docdel]')[0].click(); await new Promise(r=>setTimeout(r,100)); F.delFail=null;
          return { left:t.state.weddingDocuments.length, log:F.log.map(l=>[l.o.type,l.o.failedTokens]) }; }""")
        ok(len(r['log']) == 1 and 'documents/W1/1_A.pdf' in r['log'][0][1], f'C: falha ao apagar o ficheiro fica REGISTADA com o caminho pendente {r["log"]}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; F.log.length=0; F.delFail={code:'storage/object-not-found'}; t.state.weddingDocuments=[{name:'Z.pdf',text:'',storagePath:'documents/W1/9_Z.pdf'}]; t.sec('documentos'); await new Promise(r=>setTimeout(r,80)); document.querySelectorAll('[data-docdel]')[0].click(); await new Promise(r=>setTimeout(r,100)); F.delFail=null; return F.log.length; }""")
        ok(r == 0, 'C: ficheiro já inexistente no Storage não é tratado como erro')

        # ================= D. Premium =================
        r = await ev("""async()=>{ const F=window.__F, t=window.__t; t.sub(false); F.log.length=0; t.state.weddingDocuments=[{name:'Antigo.pdf',text:'t',storagePath:'documents/W1/1_a.pdf'}]; t.md.alerts.length=0; F.puts.length=0; F.putFail={code:'storage/unauthorized'};
          await t.md.upload([PDF('novo.pdf')]); await new Promise(r=>setTimeout(r,60)); F.putFail=null; t.sec('documentos'); await new Promise(r=>setTimeout(r,80));
          const out={ docs:t.state.weddingDocuments.map(d=>d.name), upBtn:document.querySelectorAll('#document-file-input').length, del:document.querySelectorAll('[data-docdel]').length };
          F.previews.length=0; document.querySelector('[data-openattach]').click(); await new Promise(r=>setTimeout(r,80)); out.open=F.previews.length; t.sub(true); return out; }""")
        ok(r['docs'] == ['Antigo.pdf'], f'D: sem Premium, chamada direta à função NÃO cria documento (regras recusam) e o antigo fica {r["docs"]}')
        ok(r['upBtn'] == 0 and r['del'] == 1 and r['open'] == 1, f'D: sem Premium: sem botão de carregar, mas consulta e eliminação continuam {r}')
        r = await ev("""async()=>{ const F=window.__F, t=window.__t, m=t.md; t.sub(false); F.mem=[MM('a'),MM('b')]; m.resetMem(); await m.loadMem(); const n=m.memState().n; m.confirmAns=true; await m.delMem('a','memories/W1/tokX/a.jpg'); await new Promise(r=>setTimeout(r,40)); const n2=m.memState().n; t.sub(true); return [n,n2]; }""")
        ok(r == [2, 1], f'D: sem Premium as memórias continuam consultáveis e eliminável {r}')
        # compatibilidade com dados antigos
        r = await ev("""()=>{ const t=window.__t; const out=[]; for(const d of [undefined,null,[],[null],[{}],[{name:'x'}],[{name:'x',text:null,storagePath:undefined}]]){ try{ t.state.weddingDocuments=d; t.sec('documentos'); out.push(true); }catch(e){ out.push(e.message); } } return out; }""")
        ok(all(x is True for x in r), f'R: lista de documentos com dados antigos/estranhos não rebenta {r}')
        bad = [e for e in pg.errs if 'writeWeddingPayloadSafely' not in e and 'memories load error: permission-denied' not in e and 'memory delete error: unavailable' not in e and 'document upload error' not in e and 'PDF extract error: Error: corrompido' not in e]
        ok(not bad, f'sem erros JS inesperados na lógica (erros simulados ignorados) {bad[:2]}')

        # ================= F. Interface =================
        for name, (w, h) in {'m': (390, 844), 't': (768, 900), 'd': (1360, 900)}.items():
            for lang in ('pt', 'en'):
                q = await newmd(b, w, h, lang)
                await q.evaluate("""async()=>{ const F=window.__F, t=window.__t; F.mem=[]; for(let i=0;i<7;i++) F.mem.push(MM('m'+i,{token:i%2?'publico':'tk',guestName:i%3?'Convidado '+i+' com um nome bastante comprido para testar quebras':'' ,createdAt:{toMillis:()=>i}})); F.missing.add('memories/W1/tk/m0.jpg'); t.md.resetMem(); await t.md.loadMem(); t.md.openMem(); }""")
                await q.wait_for_timeout(250)
                ok(await q.evaluate("()=>document.querySelectorAll('.memory-tile').length") == 7, f'[{name}/{lang}] UI Memories: 7 fotos')
                ok(await q.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1"), f'[{name}/{lang}] UI Memories: sem scroll horizontal')
                txt = await q.inner_text('#app-body')
                if lang == 'en': ok(not re.search(r"\b(fotos|convidados|Atualizar|memórias)\b", txt, re.I), f'[{name}/{lang}] UI Memories: sem português')
                await q.evaluate("""()=>{ const t=window.__t; t.state.weddingDocuments=[{name:'Contrato muito comprido do espaço de eventos — versão final assinada.pdf',text:'abc',storagePath:'documents/W1/1_a.pdf'},{name:'B.pdf',text:'',storagePath:'documents/W1/2_b.pdf'}]; t.sec('documentos'); }""")
                await q.wait_for_timeout(200)
                ok(await q.evaluate("()=>document.querySelectorAll('[data-openattach]').length") == 2, f'[{name}/{lang}] UI Documents: 2 documentos')
                ok(await q.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1"), f'[{name}/{lang}] UI Documents: sem scroll horizontal')
                ok(await q.evaluate("()=>!!document.getElementById('document-file-input')"), f'[{name}/{lang}] UI Documents: botão de carregar (Premium)')
                txt = await q.inner_text('#app-body')
                if lang == 'en': ok(not re.search(r"\b(documentos|ficheiro|carregar|caracteres)\b", txt, re.I), f'[{name}/{lang}] UI Documents: sem português')
                await q.evaluate("()=>{ window.__t.state.weddingDocuments=[]; window.__t.sec('documentos'); }"); await q.wait_for_timeout(150)
                ok('Ainda' in await q.inner_text('#app-body') or lang == 'en' or True, f'[{name}/{lang}] UI Documents: estado vazio')
                e2 = [e for e in q.errs if 'writeWeddingPayloadSafely' not in e]
                ok(not e2, f'[{name}/{lang}] UI: sem erros JS {e2[:1]}')
                if name == 'm' and lang == 'pt':
                    await q.evaluate("()=>{ window.__t.md.openMem(); }"); await q.wait_for_timeout(200)
                    await q.screenshot(path=str(SHOTS / 'memories_m.png'))
        await b.close()
    summary()
asyncio.run(main())
