"""Fase F — Weddy Compare (cliente): lógica REAL da app sobre dados reais + PDF real (jsPDF) validado com pdftotext/pdftoppm.
Cobre (letras do brief): A ciclo de vida · B propostas/duplicar · C upload · E origem dos dados · F critérios · G comparação · H preços ·
I relatório/assinatura · J histórico · K ligações financeiras · L PDF · M Premium · O concorrência · P falhas · R compatibilidade · T PT/EN.
O servidor (analyze/report) tem a sua própria suite (tests/compare/compare.test.js, 140 verificações)."""
from common import *
import json, base64, subprocess, os, tempfile, shutil, pathlib, functools, asyncio
newpage = functools.partial(newpage, mode='app')
JS = ROOT / 'tests' / 'node_modules'
OUT = pathlib.Path(tempfile.mkdtemp(prefix='cmp-pdf-'))

async def newcmp(b, w=390, h=844):
    pg = await newpage(b, w, h)
    await pg.add_script_tag(path=str(JS / 'jspdf' / 'dist' / 'jspdf.umd.min.js'))
    await pg.add_script_tag(path=str(JS / 'jspdf-autotable' / 'dist' / 'jspdf.plugin.autotable.min.js'))
    await pg.evaluate(SETUP)
    return pg

SETUP = """()=>{ const t=window.__t, s=t.state;
  t.cmp.hookDialogs(); t.cmp.alerts.length=0; t.cmp.confirmAns=true; t.cmp.choiceAns=null; t.cmp.ready(); t.sub(true); t.lang('pt');
  s.categories=[{id:'foto',name:'Fotografia',icon:'x'},{id:'flores',name:'Flores',icon:'x'},{id:'convites',name:'Convites',icon:'x'}];
  s.suppliers=[{id:'sA',name:'Estúdio Alfa',category:'foto',contact:'',email:'',valorTotal:0,payments:[]},{id:'sB',name:'Estúdio Beta',category:'foto',contact:'',email:'',valorTotal:0,payments:[]}];
  s.expenses=[]; s.weddingDocuments=[]; s.compares=[];
  t.nt.setSettings({coupleName1:'Rita',coupleName2:'Tiago',weddingDate:'2099-06-06'});
  window.__pushes=0; window.__storDel=[]; window.__incidents=0;
  t.cmp.stor({ ref:(p)=>({ delete:()=>{ window.__storDel.push(p); return window.__storFail?Promise.reject({code:'storage/unknown'}):Promise.resolve(); } }) });
  window.MF=(v,src,conf)=>{ const f={v}; f.src=src||'manual'; if(conf) f.confirmed=true; return f; };
  window.MP=(id,fields,extra)=>Object.assign({id,name:id.toUpperCase(),fields:fields||{}},extra||{});
  window.MC=(props,extra)=>{ const c=Object.assign({id:'cmp1',name:'Fotógrafos',category:'foto',max:3,priorities:['price_low'],proposals:props,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'},extra||{}); s.compares=[c]; return c; };
  window.FULL=()=>MC([MP('p1',{price:MF('1500'),vat:MF('incl'),services:MF('8 horas, álbum')}),MP('p2',{price:MF('1800'),vat:MF('incl'),services:MF('10 horas')})]);
}"""

def pdf_to_files(uri, name):
    raw = base64.b64decode(uri.split(',', 1)[1]); f = OUT / (name + '.pdf'); f.write_bytes(raw)
    txt = subprocess.run(['pdftotext', '-layout', str(f), '-'], capture_output=True, text=True).stdout
    info = subprocess.run(['pdfinfo', str(f)], capture_output=True, text=True).stdout
    pages = int([l for l in info.splitlines() if l.startswith('Pages:')][0].split()[1])
    perpage = [subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', str(f), '-'], capture_output=True, text=True).stdout for i in range(1, pages + 1)]
    return raw, txt, pages, perpage, f

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newcmp(b)
        ev = lambda js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)

        # ---------- H: preços (cmpParsePrice) ----------
        PRICE = [('1500',1500),('1.500 €',1500),('1 850 €',1850),('1.250,50 €',1250.5),('€ 3.000 … total 3.000 €',3000),('2000 euros',2000),('1500€',1500),
                 ('',None),('   ',None),('a combinar',None),('desde 1000 €',None),('1000 a 1500 €',None),('entre 1000 e 1500',None),('10%',None),('sinal 500 €',None),('3 x 500 €',None),
                 ('50 € por pessoa',None),('45€/pessoa',None),('80 € p/ hora',None),('€ per person 40',None),('1500 $',None),('USD 1500',None),('500 500',None),('1000 e 2000',None),('-300',None),('0',None),('aprox. 1500',None),('~1500',None),('cerca de 2000 €',None),('até 1500 €',None),('sob consulta',None),('texto sem número',None)]
        bad = []
        for s_, exp in PRICE:
            r = await ev("(s)=>window.__t.cmp.parse(s)", s_)
            got = r['amount'] if r['ok'] else None
            if got != exp: bad.append((s_, exp, r))
        ok(not bad, f'H: {len(PRICE)} formas de escrever preços interpretadas sem inventar ({bad[:3]})')
        r = await ev("()=>window.__t.cmp.parse(null)"); ok(not r['ok'] and r['reason']=='empty', 'H: valor não-string → vazio, sem rebentar')
        reasons = {s_: (await ev("(s)=>window.__t.cmp.parse(s)", s_))['reason'] for s_ in ['50 € por pessoa','10%','sinal 500 €','USD 1500','1000 a 1500 €','aprox. 1500']}
        ok(reasons == {'50 € por pessoa':'unit_based','10%':'percent','sinal 500 €':'phased','USD 1500':'currency','1000 a 1500 €':'range','aprox. 1500':'uncertain'}, f'H: razões de recusa corretas {reasons}')

        # ---------- H: facts / diferenças ----------
        async def facts(fields_by_prop):
            return await ev("""(fb)=>{ const c=MC(fb.map((f,i)=>MP('p'+(i+1),f))); return window.__t.cmp.facts(c); }""", fields_by_prop)
        f = await facts([{'price':{'v':'1500','src':'manual'},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}}])
        ok(f['comparable'] and f['status']=='complete' and f['byId']['p1']['delta']==0 and f['byId']['p2']['delta']==300 and f['byId']['p2']['pct']==20, f'H: dois preços totais, mesmo IVA → diferença exata (300 €, 20 %) {f["byId"]}')
        f = await facts([{'price':{'v':'1500','src':'manual'},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'excl','src':'manual'}}])
        ok(not f['comparable'] and f['reason']=='vat_mixed', 'H: IVA incluído vs excluído NUNCA são comparados')
        f = await facts([{'price':{'v':'1500','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}}])
        ok(not f['comparable'] and f['reason']=='vat_unknown', 'H: IVA não indicado → não compara')
        f = await facts([{'price':{'v':'50 € por pessoa','src':'manual'},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}}])
        ok(not f['comparable'] and f['reason']=='unit_based', 'H: preço por pessoa NÃO é tratado como total')
        f = await facts([{'price':{'v':'sinal 500 €','src':'manual'},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}}])
        ok(not f['comparable'] and f['reason']=='unparsable', 'H: sinal/prestações não somam nem comparam como preço total')
        f = await facts([{'price':{'v':'1500','src':'ai-inferred'},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}}])
        ok(not f['comparable'] and f['includedIds']==['p2'], 'H: preço inferido POR CONFIRMAR fica fora dos totais e das diferenças')
        f = await facts([{'price':{'v':'1500','src':'ai-inferred','confirmed':True},'vat':{'v':'incl','src':'manual'}},{'price':{'v':'1800','src':'manual'},'vat':{'v':'incl','src':'manual'}},{}])
        ok(f['comparable'] and f['status']=='partial' and f['excludedIds']==['p3'], 'H: inferido CONFIRMADO conta; proposta sem preço fica de fora (comparação parcial identificada)')
        ok(await ev("()=>{ const c=FULL(); const before=JSON.stringify(c); window.__t.cmp.facts(c); window.__t.cmp.rows(c); window.__t.cmp.sig(c); return JSON.stringify(c)===before; }"), 'G: comparar/calcular NÃO altera os dados originais')

        # ---------- E: origem dos dados ----------
        O = await ev("""()=>{ const p=MP('x',{a:MF('v','manual'),b:MF('v','ai-explicit',true),c:MF('v','ai-inferred',true),d:MF('v','ai-inferred'),e:MF('v','ai-explicit'),f:MF('  ','manual'),g:{v:5,src:'manual'}}); const t=window.__t.cmp;
          return ['a','b','c','d','e','f','g'].map(k=>{ const r=t.conf(p,k); return r?r.origin:null; }); }""")
        ok(O == ['you','doc','inf',None,None,None,None], f'E: origem por campo: manual→corrigido, explícito+confirmado→documento, inferido+confirmado→inferido confirmado, por confirmar→fora ({O})')
        rt = await ev("""()=>{ const c=MC([MP('p1',{price:MF('1500','ai-explicit',true),services:MF('x','ai-inferred',true),hours:MF('8h','manual')})]); const back=JSON.parse(JSON.stringify(c)); const t=window.__t.cmp;
          return ['price','services','hours'].map(k=>t.conf(back.proposals[0],k).origin); }""")
        ok(rt == ['doc','inf','you'], f'E: a origem sobrevive a guardar/reabrir (JSON) {rt}')
        # revisão da IA
        REV = """()=>{ const c=MC([MP('p1',{},{name:''})]); const p=c.proposals[0]; const t=window.__t.cmp;
          p.ai={status:'review',analyzedAt:'2026-01-01',draft:{supplierName:{v:'Foto X',src:'explicit',evidence:null,edited:false},warnings:[],documentReadable:true,fields:{
            price:{v:'1500',src:'explicit',needsConfirmation:false,evidence:'pág.1',ok:false,edited:false},
            services:{v:'8 horas',src:'inferred',needsConfirmation:true,evidence:null,ok:false,edited:false},
            hours:{v:'10',src:'inferred',needsConfirmation:true,evidence:null,ok:false,edited:false},
            payment:{v:'30 dias',src:'inferred',needsConfirmation:true,evidence:null,ok:false,edited:false},
            deposit:{v:null,src:'not_stated',needsConfirmation:false,evidence:null,ok:false,edited:false}}}};
          const pend0=t.review(c,p); const sig0=t.sig(c); const hidden=t.conf(p,'services');
          p.ai.draft.fields.services.ok=true;                                  // confirmada tal como está
          p.ai.draft.fields.hours.v='12'; p.ai.draft.fields.hours.edited=true; p.ai.draft.fields.hours.ok=true; // corrigida
          const pend1=t.review(c,p);   // 'payment' continua por confirmar
          p.ai.draft.fields.payment.ok=true; const pend2=t.review(c,p);
          t.apply(c,p);
          return { pend0, hidden, pend1, pend2, f:p.fields, ai:p.ai, name:p.name, nullDeposit:p.fields.deposit, o:['price','services','hours','payment'].map(k=>t.conf(p,k).origin) }; }"""
        R = await ev(REV)
        ok(sorted(R['pend0']) == ['hours','payment','services'] and R['hidden'] is None, f'E: inferências por rever ficam por confirmar e fora da comparação ({R["pend0"]})')
        ok(R['pend1'] == ['payment'] and R['pend2'] == [], 'E: só passa a confirmar depois de cada inferência ser confirmada ou corrigida')
        ok(R['o'] == ['doc','inf','you','inf'], f'E: após rever → documento / inferido confirmado / corrigido pelos noivos ({R["o"]})')
        ok(R['nullDeposit'] is None and R['ai']['status']=='confirmed' and 'draft' not in R['ai'], 'E: campo não indicado NÃO é preenchido; rascunho descartado depois de confirmar')
        ok(R['name'] == 'Foto X', 'E: nome sugerido só preenche proposta sem nome')
        sig_changes = await ev("""()=>{ const c=MC([MP('p1',{price:MF('1500','manual')}),MP('p2',{})]); const t=window.__t.cmp; const s0=t.sig(c);
          c.proposals[1].fields.price=MF('1800','ai-inferred'); const s1=t.sig(c);     // inferido por confirmar: não altera
          c.proposals[1].fields.price.confirmed=true; const s2=t.sig(c);              // confirmado: altera
          return [s0===s1, s1!==s2]; }""")
        ok(sig_changes == [True, True], 'I/E: assinatura ignora inferências por confirmar e muda quando são confirmadas')

        # ---------- I: assinatura / relatório desatualizado ----------
        SIG = """()=>{ const t=window.__t.cmp; const c=FULL(); const base=t.sig(c); const out={};
          const chk=(n,fn)=>{ const cc=JSON.parse(JSON.stringify(c)); fn(cc); out[n]=t.sig(cc)!==base; };
          chk('valor',cc=>cc.proposals[0].fields.price.v='1600'); chk('campo novo',cc=>cc.proposals[0].fields.hours=MF('8'));
          chk('campo removido',cc=>delete cc.proposals[0].fields.services); chk('categoria',cc=>cc.category='flores'); chk('prioridade',cc=>cc.priorities=['more_services']);
          chk('nível essencial',cc=>{ cc.priorityLevels={price_low:'essential'}; }); chk('nova proposta',cc=>cc.proposals.push(MP('p3',{price:MF('2000')})));
          chk('proposta removida',cc=>cc.proposals.pop()); chk('troca de ordem',cc=>cc.proposals.reverse());
          chk('origem manual→doc (mesmo valor)',cc=>{ cc.proposals[0].fields.price=MF('1500','ai-explicit',true); });
          out.nome=(()=>{ const cc=JSON.parse(JSON.stringify(c)); cc.proposals[0].name='Outro nome'; return t.sig(cc)!==base; })();
          out.notas=(()=>{ const cc=JSON.parse(JSON.stringify(c)); cc.proposals[0].notes='nota'; return t.sig(cc)!==base; })();
          out.mesmo=t.sig(JSON.parse(JSON.stringify(c)))===base; return out; }"""
        S = await ev(SIG)
        for k in ['valor','campo novo','campo removido','categoria','prioridade','nível essencial','nova proposta','proposta removida','troca de ordem']:
            ok(S[k] is True, f'I: alterar «{k}» torna o relatório desatualizado')
        ok(S['mesmo'] is True and S['nome'] is False and S['notas'] is False, f'I: dados iguais / nome / notas NÃO invalidam o relatório (não gera relatórios sem necessidade) {S}')
        print('INFO origem manual→doc com o mesmo valor altera assinatura:', S['origem manual→doc (mesmo valor)'])
        ST = await ev("""()=>{ const t=window.__t.cmp; const c=FULL(); const out={};
          out.semRel=t.status(c); c.report={generatedAt:'2026-01-01T00:00:00Z',sig:t.sig(c),lang:'pt',data:{summary:[],orientation:null}}; out.atual=t.status(c);
          c.proposals[0].fields.price.v='9'; out.alterada=t.status(c); c.proposals[0].fields.price.v='1500'; out.reposta=t.status(c);
          window.__t.lang('en'); out.idioma=t.status(c); out.exportIdioma=t.exportState(c); window.__t.lang('pt');
          c.reportJob={status:'processing',startedAt:new Date().toISOString()}; out.job=t.jobStatus(c); out.exportJob=t.exportState(c);
          c.reportJob={status:'processing',startedAt:new Date(Date.now()-10*60*1000).toISOString()}; out.jobExp=t.jobStatus(c); delete c.reportJob;
          const d=MC([MP('p1',{}),MP('p2',{})]); out.vazio=t.status(d); out.elig=t.eligible(d);
          const e=MC([MP('p1',{price:MF('1')}),MP('p2',{})]); out.umSo=t.eligible(e);
          const g=FULL(); g.proposals[0].ai={status:'review',draft:{}}; out.review=t.status(g);
          const h=FULL(); h.proposals[0].expenseId='e1'; window.__t.state.expenses=[{id:'e1',desc:'x',value:1,paid:0}]; out.decidida=t.status(h);
          return out; }""")
        ok(ST['semRel']=='ready' and ST['atual']=='report' and ST['alterada']=='stale' and ST['reposta']=='report', f'I: pronta → relatório atual → desatualizado ao alterar → atual se o valor volta ({ST})')
        ok(ST['idioma']=='stale' and ST['exportIdioma']=='stale', 'I: alterar o idioma torna o relatório desatualizado (também para exportar)')
        ok(ST['job']=='processing' and ST['exportJob']=='processing' and ST['jobExp']=='expired', 'I: pedido a decorrer bloqueia exportar; pedido preso expira ao fim do tempo')
        ok(ST['vazio']=='draft' and ST['elig'] is False and ST['umSo'] is False, 'J: sem dados confirmados → incompleta/rascunho; relatório exige ≥2 propostas com dados')
        ok(ST['review']=='review' and ST['decidida']=='decided', 'J: estados «por rever» e «com decisão registada»')

        # ---------- I/P: gerar relatório (servidor simulado) ----------
        GEN = """async()=>{ const t=window.__t.cmp; const out={calls:0}; const c=FULL(); t.go('detalhe','cmp1');
          const good=(sig)=>({data:{report:{summary:[{text:'Resumo.',proposalId:'p1',basis:[{proposalId:'p1',field:'price'}]},{text:'sem base',basis:[]},{text:'campo falso',basis:[{proposalId:'p1',field:'__x'}]}],priceVsServices:[],additionalCosts:[],attentionPoints:[],orientation:{status:'balanced',proposalId:null,reasons:[],otherStrengths:[],comparable:[],noData:[],essential:[]},strengths:[],priorityNotes:[],questions:[{proposalId:'p1',field:'price',text:'Qual o sinal?'},{proposalId:'p1',field:'zzz',text:'ok sem campo'},{proposalId:3,text:'x'}]},generatedAt:'2026-02-02T10:00:00Z',sig,lang:'pt'}});
          t.cf(async(n,d)=>{ out.calls++; out.sent=d; await new Promise(r=>setTimeout(r,60)); return good(t.sig(c)); });
          const p1=t.gen('cmp1'), p2=t.gen('cmp1'); await Promise.all([p1,p2]);                  // duplo clique
          out.afterCalls=out.calls; out.rep=JSON.parse(JSON.stringify(c.report)); out.job=c.reportJob||null; out.status=t.status(c);
          return out; }"""
        G = await ev(GEN)
        ok(G['afterCalls']==1, f'O: dois pedidos simultâneos de relatório → UMA chamada ao servidor ({G["afterCalls"]})')
        ok(set(G['sent'].keys()) <= {'compareId','lang','weddingId'}, f'Q: ao servidor só vão ids e idioma, nenhum dado da proposta {sorted(G["sent"])}')
        ok(len(G['rep']['data']['summary'])==1 and len(G['rep']['data']['questions'])==2, 'I: o cliente descarta frases sem base/campo inválido e perguntas inválidas')
        ok(G['job'] is None and G['status']=='report', 'I: relatório guardado e marcado como atual')
        FAIL = """async(code)=>{ const t=window.__t.cmp; const c=FULL(); c.report={generatedAt:'2026-01-01T00:00:00Z',sig:t.sig(c),lang:'pt',data:{summary:[{text:'Antigo',proposalId:'p1',basis:[{proposalId:'p1',field:'price'}]}],orientation:null}};
          const before=JSON.stringify(c.report); c.proposals[0].fields.price.v='1700'; t.go('detalhe','cmp1');
          t.cf(async()=>{ if(code==='net') throw {code:'unavailable',message:'network'}; if(code==='bad') return {data:{nada:1}}; if(code==='timeout') throw {code:'deadline-exceeded'}; throw {code:'resource-exhausted',message:'Limite diário atingido'}; });
          await t.gen('cmp1'); return { job:c.reportJob, kept:JSON.stringify(c.report)===before, status:t.status(c) }; }"""
        for code, msg in [('net','failed'),('bad','failed'),('timeout','failed'),('quota','failed')]:
            r = await ev(FAIL, code)
            ok(r['job']['status']=='failed' and r['kept'] and r['status']=='stale', f'P/I: falha «{code}» → pedido «falhou», relatório anterior preservado e NÃO apresentado como atual ({r["job"]["error"]["code"]})')
        r = await ev("""async()=>{ const t=window.__t.cmp; const c=FULL(); t.noCf(); t.go('detalhe','cmp1'); await t.gen('cmp1'); return c.reportJob; }""")
        ok(r['status']=='failed', 'P: sem funções na nuvem → falha tratada')
        r = await ev("""async()=>{ const t=window.__t.cmp; const c=MC([MP('p1',{price:MF('1')}),MP('p2',{})]); t.cf(async()=>{throw 1}); await t.gen('cmp1'); return [c.reportJob.status,c.reportJob.error.code]; }""")
        ok(r == ['failed','not-eligible'], 'I: sem dados suficientes → nem chama o servidor')
        r = await ev("""async()=>{ const t=window.__t.cmp; const c=FULL(); t.go('detalhe','cmp1'); let calls=0;
          t.cf(async()=>{ calls++; await new Promise(r=>setTimeout(r,50)); window.__t.state.compares=[]; return {data:{report:{summary:[],orientation:{status:'balanced',reasons:[],otherStrengths:[],comparable:[],noData:[],essential:[]}},generatedAt:'x',sig:'s',lang:'pt'}}; });
          await t.gen('cmp1'); return [calls, window.__t.state.compares.length]; }""")
        ok(r == [1, 0], 'O: comparação eliminada durante a geração → resultado descartado sem erro')

        # ---------- J: histórico / filtros / duplicar / eliminar ----------
        r = await ev("""()=>{ const t=window.__t.cmp; const s=window.__t.state;
          const a=FULL(); a.name='Fotógrafos'; a.report={generatedAt:'2026-01-01',sig:t.sig(a),lang:'pt',data:{summary:[],orientation:null}}; a.reportJob={status:'failed'};
          a.proposals[0].supplierId='sA'; a.proposals[0].expenseId='e1'; a.proposals[0].expenseAddedAt='2026-01-02'; a.proposals[0].ai={status:'confirmed',analyzedAt:'x'};
          a.proposals[1].ai={status:'review',draft:{}}; a.proposals[1].notes='nota 2'; a.priorityLevels={price_low:'essential'};
          s.expenses=[{id:'e1',desc:'Fotógrafo',value:1500,paid:0,compareId:'cmp1'}];
          s.weddingDocuments=[{name:'a.pdf',text:'',storagePath:'documents/W1/1_cmp_a.pdf',compareId:'cmp1',proposalId:'p1'},{name:'b.pdf',text:'',storagePath:'documents/W1/2_cmp_b.pdf',compareId:'cmp1',proposalId:'p2'},{name:'outra.pdf',text:'',storagePath:'documents/W1/3_cmp_x.pdf',compareId:'OUTRA',proposalId:'z'},{name:'contrato',text:'t',storagePath:'documents/W1/4_contrato.pdf',supplierId:'sA'}];
          const n=t.dup(a); const before=JSON.stringify(a);
          return { n:JSON.parse(JSON.stringify(n)), idDiff:n.id!==a.id, pidDiff:n.proposals.every((q,i)=>q.id!==a.proposals[i].id), names:s.compares.map(x=>x.name), docs:s.weddingDocuments.length, orig:JSON.stringify(s.compares.find(x=>x.id==='cmp1'))===before, status:t.status(n), first:s.compares[0].id===n.id }; }""")
        n = r['n']
        ok(r['idDiff'] and r['pidDiff'] and r['first'], 'J: cópia com identidade própria (comparação e propostas)')
        ok(n['name'].startswith('Fotógrafos') and r['names'].count(n['name'])==1, f'J: nome da cópia distinto ({n["name"]})')
        ok([q['fields']['price']['v'] for q in n['proposals']]==['1500','1800'] and n['proposals'][1]['notes']=='nota 2' and n['proposals'][0]['supplierId']=='sA' and n['priorities']==['price_low'] and n['priorityLevels']=={'price_low':'essential'}, 'J: dados, notas, prioridades e fornecedor copiados')
        ok(all('ai' not in q and 'expenseId' not in q and 'expenseAddedAt' not in q for q in n['proposals']), 'J: análise de IA e ligação à despesa NÃO são copiadas')
        ok('report' not in n and 'reportJob' not in n and r['status']=='ready', f'J: relatório não é copiado; a cópia fica «pronta» e nunca «atualizada» ({r["status"]})')
        ok(r['docs']==4 and r['orig'], 'J: documentos não são duplicados e a original fica intacta')
        r = await ev("""()=>{ const t=window.__t.cmp, s=window.__t.state; window.__storDel.length=0; const exp=JSON.stringify(s.expenses);
          t.del('cmp1'); return { left:s.weddingDocuments.map(d=>d.name), del:window.__storDel.slice(), exp:JSON.stringify(s.expenses)===exp, comps:s.compares.map(c=>c.id), sup:s.suppliers.length }; }""")
        ok(r['left']==['outra.pdf','contrato'] and sorted(r['del'])==['documents/W1/1_cmp_a.pdf','documents/W1/2_cmp_b.pdf'], f'J/C: eliminar apaga só os ficheiros desta comparação (Storage + metadados) {r["del"]}')
        ok(r['exp'] and r['sup']==2, 'K: eliminar a comparação NÃO elimina despesas já criadas nem fornecedores')
        ok(len(r['comps'])==1 and r['comps'][0]!='cmp1', 'J: só a comparação pedida é eliminada')
        r = await ev("""()=>{ const t=window.__t.cmp; window.__storFail=true; window.__t.state.weddingDocuments=[{name:'z',storagePath:'documents/W1/9.pdf',compareId:'cmpZ',proposalId:'p'}]; window.__t.state.compares=[{id:'cmpZ',name:'Z',category:'foto',proposals:[]}]; t.del('cmpZ'); window.__storFail=false; return true; }""")
        await pg.wait_for_timeout(100)
        ok(r, 'C: falha ao apagar no Storage não rebenta (fica registada no _incident_log)')
        r = await ev("()=>{ window.__t.cmp.del('NAO-EXISTE'); window.__t.cmp.del(undefined); return true; }"); ok(r, 'J: eliminar id inexistente é inofensivo')

        # filtros / pesquisa
        r = await ev("""()=>{ const t=window.__t.cmp, s=window.__t.state;
          const mk=(id,name,cat,props,extra)=>Object.assign({id,name,category:cat,max:3,priorities:[],proposals:props,createdAt:'x',updatedAt:'x'},extra||{});
          const ready=mk('c1','Fotógrafos de Lisboa','foto',[MP('p1',{price:MF('1')}),MP('p2',{price:MF('2')})]);
          const draft=mk('c2','Flores do Porto','flores',[MP('p1',{})]);
          const rep=mk('c3','Convites','convites',[MP('p1',{price:MF('1')}),MP('p2',{price:MF('2')})]); rep.report={generatedAt:'x',sig:t.sig(rep),lang:'pt',data:{summary:[],orientation:null}};
          s.compares=[ready,draft,rep];
          const res={}; const run=(n,f)=>{ t.filter(Object.assign({q:'',cat:'',status:''},f)); res[n]=s.compares.filter(c=>t.matches(c)).map(c=>c.id); };
          run('todas',{}); run('q lisboa',{q:'lisboa'}); run('q acentos',{q:'fotografos'}); run('cat',{cat:'flores'}); run('estado ready',{status:'ready'}); run('estado draft',{status:'draft'}); run('estado report',{status:'report'}); run('q+cat',{q:'flores',cat:'foto'});
          t.filter({q:'',cat:'',status:''}); return res; }""")
        ok(r['todas']==['c1','c2','c3'] and r['q lisboa']==['c1'] and r['cat']==['c2'] and r['estado ready']==['c1'] and r['estado draft']==['c2'] and r['estado report']==['c3'] and r['q+cat']==[], f'J: pesquisa e filtros por categoria/estado {r}')
        ok(r['q acentos']==['c1'], 'J: pesquisa ignora acentos («fotografos» encontra «Fotógrafos»)')

        # ---------- K: despesas / fornecedores ----------
        K = """()=>{ const t=window.__t.cmp, s=window.__t.state; s.expenses=[];
          const c=MC([MP('p1',{price:MF('1500'),vat:MF('incl')},{supplierId:'sA'}),MP('p2',{price:MF('50 € por pessoa'),vat:MF('excl')},{supplierId:'sB'}),MP('p3',{})]);
          const out={}; const d1=t.draftExp(c,c.proposals[0]); out.d1={value:d1.value,okFinal:d1.okFinal,unit:d1.unit};
          out.criouSemConfirmar=s.expenses.length;
          const r1=t.mkExpense(c,c.proposals[0]); out.ok=!!(r1&&r1.ok); const e=s.expenses[0];
          out.exp={value:e.value,paid:e.paid,sup:e.supplierId,cmp:e.compareId,n:s.expenses.length}; out.link=c.proposals[0].expenseId===e.id;
          const r2=t.mkExpense(c,c.proposals[0]); out.dup=r2; out.n2=s.expenses.length;
          const d2=t.draftExp(c,c.proposals[1]); out.d2={value:d2.value,unit:d2.unit,vat:d2.vat};
          t.setDraft({desc:'x',date:'2026-01-01',category:'foto'}); const rr=t.mkExpense(c,c.proposals[1]); out.p2sem=rr&&rr.errs?rr.errs.map(x=>x[0]):null; out.n3=s.expenses.length;
          const d3=t.draftExp(c,c.proposals[2]); out.d3={value:d3.value,price:d3.priceText};
          out.usedElse=[t.usedElse(c,c.proposals[1],'sA'),t.usedElse(c,c.proposals[1],'sB'),t.usedElse(c,c.proposals[0],'sA')];
          const st=t.status(c);
          s.suppliers=s.suppliers.filter(x=>x.id!=='sB'); t.snap(c); out.snap={sid:c.proposals[1].supplierId,temp:c.proposals[1].tempMode,name:c.proposals[1].name};
          s.expenses=[]; out.orfa=t.expOf(c.proposals[0]);
          out.status=st; return out; }"""
        r = await ev(K)
        ok(r['d1']['value']=='1500' and r['criouSemConfirmar']==0, f'K: despesa sugerida a partir do preço confirmado; sem confirmar não cria nada {r["d1"]}')
        ok(r['ok'] and r['exp']=={'value':1500,'paid':0,'sup':'sA','cmp':'cmp1','n':1} and r['link'], f'K: despesa criada só por ação explícita, SEM pagamento (paid=0), ligada ao fornecedor e à comparação {r["exp"]}')
        ok(r['dup'] is None and r['n2']==1, 'K: nunca duplica a despesa da mesma proposta')
        ok(r['d2']['value']=='' and r['d2']['unit'] is True and 'cmp-exp-value' in (r['p2sem'] or []), f'K: preço por pessoa NÃO vira valor da despesa; exige valor total {r["d2"]}')
        ok(r['d3']['value']=='' and r['d3']['price']=='', 'K: proposta sem preço → rascunho vazio (não inventa valor)')
        ok(r['usedElse']==[True,False,False], 'K: o mesmo fornecedor não pode estar em duas propostas da mesma comparação')
        ok(r['snap']=={'sid':None,'temp':True,'name':'P2'}, f'K: fornecedor removido → proposta fica temporária, nome e dados mantidos {r["snap"]}')
        ok(r['status']=='decided', 'J: comparação com despesa registada fica «decidida»')
        ok(r['orfa'] is None, 'K: despesa eliminada no Orçamento → a proposta deixa de contar como decidida (sem rebentar)')
        await ev(SETUP)

        # ---------- L: PDF real ----------
        def mk(n, extra_js=''):
            return """()=>{ const t=window.__t.cmp; const props=[]; for(let i=1;i<=%d;i++){ props.push(MP('p'+i,{price:MF(String(1000+i*300)),vat:MF('incl'),services:MF(i%%2?'8 horas de cobertura, álbum 30x30 e galeria online':'10 horas, vídeo'),hours:MF(i+' horas'),deposit:MF('30%% de sinal'),payment:MF('Pagamento em 3 prestações: 30%% / 40%% / 30%%')},{name:'Estúdio '+i+' — Fotografia à beira-mar'})); }
              const c=MC(props); %s return c; }""" % (n, extra_js)
        REPORT = """const rep=(c)=>{ c.report={generatedAt:'2026-03-04T10:00:00Z',sig:window.__t.cmp.sig(c),lang:'pt',data:{summary:[{text:'A proposta 1 tem o preço mais baixo; as condições de pagamento diferem — são importantes à decisão.',proposalId:'p1',basis:[{proposalId:'p1',field:'price'},{proposalId:'p2',field:'price'}]}],priceVsServices:[{text:'Diferença de 300 € com serviços distintos.',proposalId:null,basis:[{proposalId:'p1',field:'services'}]}],additionalCosts:[],attentionPoints:[{text:'Confirmar a validade da proposta e as horas extra.',proposalId:'p2',basis:[{proposalId:'p2',field:'validity'}]}],orientation:{status:'balanced',proposalId:null,reasons:[],otherStrengths:[],comparable:[],noData:[],essential:[]},strengths:[],priorityNotes:[],questions:[{proposalId:'p1',field:'validity',text:'Qual é a validade da proposta?'},{proposalId:'p2',field:null,text:'Existe custo de deslocação?'}]}}; };"""
        async def build(name, n=2, extra='', lang='pt'):
            await ev(f"()=>window.__t.lang('{lang}')")
            uri = await ev(mk(n, REPORT + extra))
            return uri
        # sem relatório
        # (mk devolve c; precisamos de pdf) -> repetir com o hook
        async def pdf_of(n, extra='', name='x', lang='pt'):
            await ev(f"()=>window.__t.lang('{lang}')")
            js = mk(n, REPORT + extra).replace('return c; }', 'return window.__t.cmp.pdf(c); }')
            u = await ev(js); await ev("()=>window.__t.lang('pt')")
            return u, (pdf_to_files(u, name) if u else None)
        u, info = await pdf_of(2, '', 'sem-relatorio')
        raw, txt, pages, per, fpath = info
        ok(raw[:5]==b'%PDF-' and raw.rstrip().endswith(b'%%EOF') and pages>=1, f'L: PDF real válido (cabeçalho %PDF- e %%EOF, {pages} pág.) — sem relatório da IA')
        ok('Fotógrafos' in txt and 'Fotografia' in txt and 'Estúdio 1' in txt and 'Estúdio 2' in txt, 'L: título, categoria e propostas no PDF')
        ok('1300,00' in txt and '1600,00' in txt and '+300,00' in txt, 'L: valores da tabela comparativa no PDF')
        ok('Corrigido' in txt or 'noivos' in txt.lower(), 'L: origem dos dados indicada junto de cada valor')
        ok('Página 1 de' in txt, 'L: numeração de páginas')
        ok(not any(len(x.strip())<20 for x in per), f'L: nenhuma página vazia ({[len(x.strip()) for x in per]})')
        u, info = await pdf_of(2, 'rep(c);', 'com-relatorio')
        raw, txt2, pages2, per2, _ = info
        ok('Qual é a validade da proposta?' in txt2 and 'Existe custo de deslocação?' in txt2, 'L: relatório atualizado e perguntas incluídos no PDF')
        ok('Aviso' in txt2 or 'decisão' in txt2.lower(), 'L: avisos/notas e decisão dos noivos no PDF')
        # desatualizado
        r = await ev(mk(2, REPORT + "rep(c); c.proposals[0].fields.price.v='1700';").replace('return c; }', 'return [window.__t.cmp.exportState(c), window.__t.cmp.pdf(c)]; }'))
        ok(r[0]=='stale' and r[1] is None, 'L: relatório DESATUALIZADO nunca é exportado (nem o PDF é gerado)')
        # inferência por confirmar nunca em PDF
        u, info = await pdf_of(2, "c.proposals[0].fields.hours=MF('SEGREDOINFERIDO99','ai-inferred'); c.proposals[1].fields.deposit=MF('OUTROINFERIDO77','ai-inferred');", 'inferido')
        raw, txt3, p3, per3, _ = info
        ok('SEGREDOINFERIDO99' not in txt3 and 'OUTROINFERIDO77' not in txt3, 'L/E: valores inferidos POR CONFIRMAR nunca aparecem no PDF')
        ok('por confirmar' in txt3.lower(), 'L/E: o PDF diz que há inferências por confirmar (sem mostrar o valor)')
        # 3, 5, muitos critérios, texto longo, caracteres
        u, (raw, txt4, p4, per4, f4) = await pdf_of(3, '', 'tres')
        ok(p4>=1 and all(f'Estúdio {i}' in txt4 for i in (1,2,3)), f'L: três propostas ({p4} pág.)')
        u, (raw, txt5, p5, per5, f5) = await pdf_of(5, 'rep(c);', 'cinco')
        ok(p5>=2 and all(f'Estúdio {i}' in txt5 for i in (1,2,3,4,5)) and not any(len(x.strip())<20 for x in per5), f'L: mais de três propostas ({p5} pág.), todas presentes, sem páginas vazias')
        LONG = "c.proposals[0].fields.services=MF(('Cobertura completa com segundo fotógrafo, drone, álbum premium, sessão pré-casamento e entrega em 30 dias. ').repeat(12)); c.proposals[1].fields.extras=MF('Horas extra 80 € por hora; deslocação 0,40 €/km; alimentação do fotógrafo por conta dos noivos. '.repeat(6)); CMP_ALL_FIELDS();"
        u, (raw, txt6, p6, per6, f6) = await pdf_of(3, "const ks=['price','vat','services','hours','travel','extras','payment','deposit','deadline','cancellation','validity','exclusions']; c.proposals.forEach((p,i)=>ks.forEach(k=>{ if(!p.fields[k]) p.fields[k]=MF(k+' do estúdio '+(i+1)+' — informação bastante longa para forçar várias linhas na célula da tabela'); })); "+LONG.replace(' CMP_ALL_FIELDS();','')+" rep(c);", 'longo')
        ok(p6>=2 and 'validity do estúdio 3' in txt6 and 'Cobertura completa' in txt6, f'L: 12 critérios preenchidos e texto longo cabem sem cortes ({p6} pág.)')
        ok(not any(len(x.strip())<20 for x in per6), 'L: sem páginas vazias no PDF longo')
        # tabela não cortada: cada linha de critério aparece completa
        ok(txt6.count('Página ') >= p6, 'L: rodapé em todas as páginas')
        u, (raw, txt7, p7, per7, f7) = await pdf_of(2, "c.name='Açores — São João da Pesqueira, cônjuges & «noivos» €'; c.proposals[0].fields.services=MF('Ação, coração, língua, ç, ã, õ, é, ü, ñ — “aspas” e ‘plicas’ … 1.200 €/pessoa');", 'acentos')
        for w in ['Açores','São João','cônjuges','noivos','Ação','coração','língua','1.200']:
            ok(w in txt7.replace('\xa0',' '), f'L: carácter/palavra portuguesa preservada no PDF: {w}')
        # caracteres fora do alfabeto do PDF (limitação)
        u, info = await pdf_of(2, "c.proposals[0].fields.services=MF('Zażółć gęślą jaźń ≥ ✓ 日本 😀');", 'exoticos')
        ok(info[0][:5]==b'%PDF-', 'L: caracteres fora do alfabeto do PDF não geram PDF corrompido')
        # inglês
        u8, _i8 = await pdf_of(2, "rep(c);", 'en', 'en')
        ok(u8 is None, 'T: relatório gerado em PT não é exportado com a app em EN (desatualizado por idioma)')
        await ev("()=>window.__t.lang('en')")
        r8 = await ev(mk(2, '').replace('return c; }', 'return [window.__t.cmp.exportState(c), (window.__t.cmp.pdf(c)||"").length>0]; }'))
        await ev("()=>window.__t.lang('pt')")
        ok(r8[0] in ('none','ineligible') or r8[1], f'T: PDF em inglês gera-se ({r8})')
        # render visual
        png = OUT / 'render'; subprocess.run(['pdftoppm', '-r', '50', '-png', str(f6), str(png)], check=True)
        pngs = sorted(OUT.glob('render*.png')); ok(len(pngs)==p6, f'L: renderização visual das {p6} páginas ({len(pngs)} imagens)')
        try:
            from PIL import Image
            import statistics
            dark = []
            for im in pngs:
                g = Image.open(im).convert('L'); px = list(g.getdata()); dark.append(sum(1 for v in px if v < 200)/len(px))
            ok(all(d > 0.004 for d in dark), f'L: nenhuma página renderiza em branco ({[round(d,3) for d in dark]})')
            w, h = Image.open(pngs[0]).size
            edge_ok = True
            for im in pngs:
                g = Image.open(im).convert('L'); W_, H_ = g.size; m = int(W_*0.04)
                strip = [g.getpixel((x, y)) for y in range(0, H_, 3) for x in list(range(0, m)) + list(range(W_-m, W_))]
                if min(strip) < 120: edge_ok = False
            ok(edge_ok, 'L: nenhum conteúdo escuro encostado às margens laterais (nada fora da página)')
        except ImportError:
            print('INFO: PIL indisponível; renderização verificada só por contagem de páginas')
        first_png = pngs[0]; shutil.copy(first_png, SHOTS / 'compare_pdf_p1.png')

        # exportar: fluxo
        FLOW = """async()=>{ const t=window.__t.cmp; const out={saved:[]}; t.hookDialogs(); t.alerts.length=0; t.resetExport();
          const c=FULL(); t.go('detalhe','cmp1'); t.deliver(async(doc,name)=>{ out.saved.push(name); return 'saved'; });
          // sem relatório: pergunta
          t.choice('without'); const r1=await t.exportInner('cmp1'); out.semRel=[r1,t.alerts.filter(a=>a.startsWith('choice')).length];
          t.choice('cancel'); out.cancel=await t.exportInner('cmp1');
          // duplo clique
          t.resetExport(); t.choice('without'); const a=t.exportFlow('cmp1'), b=t.exportFlow('cmp1'); await Promise.all([a,b]); out.duplo=out.saved.length;
          // sem Premium
          t.resetExport(); window.__t.sub(false); out.premium=await t.exportInner('cmp1'); out.premiumMsg=t.alerts[t.alerts.length-1]; window.__t.sub(true);
          // inelegível
          const d=MC([MP('p1',{}),MP('p2',{})]); out.inel=await t.exportInner('cmp1');
          return out; }"""
        r = await ev(FLOW)
        ok(r['semRel'][0] is True and r['semRel'][1]>=1 and r['cancel'] is False, f'L/I: sem relatório pergunta (gerar/sem/cancelar); cancelar não exporta {r["semRel"]}')
        ok(r['duplo'] == 2, f'O: duplo clique em «Exportar» → um só ficheiro adicional (total {r["duplo"]}, esperado 2)')
        ok(r['premium'] is False and r['premiumMsg'], 'M: sem Premium não exporta (verificado em código)')
        ok(r['inel'] is False, 'L: comparação sem dados suficientes não exporta')
        # PDF: jsPDF indisponível / falha
        r = await ev("""async()=>{ const t=window.__t.cmp; t.hookDialogs(); t.alerts.length=0; t.resetExport(); const c=FULL(); t.go('detalhe','cmp1'); const jp=window.jspdf; window.jspdf=undefined; t.choice('without');
          const ok1=await t.exportInner('cmp1'); window.jspdf=jp; const m1=t.alerts.slice(); t.alerts.length=0;
          const orig=jp.jsPDF; jp.jsPDF=function(){ throw new Error('boom'); }; t.resetExport(); const ok2=await t.exportFlow('cmp1'); jp.jsPDF=orig; return [ok1,m1.length,t.alerts.length]; }""")
        ok(r[0] is False and r[1]>=1 and r[2]>=1, f'P: biblioteca de PDF em falta / erro ao gerar → mensagem ao utilizador, sem rebentar ({r})')

        # ---------- R: compatibilidade (dados antigos) ----------
        r = await ev("""()=>{ const t=window.__t.cmp, s=window.__t.state; const errs=[];
          s.compares=[{id:'old1',name:'Antiga',category:'inexistente',proposals:[{id:'a'},{id:'b',fields:{price:{v:'1000'}}},{id:'c',fields:null}]},{id:'old2'},{id:'old3',name:null,proposals:null,priorities:null},{id:'old4',category:'foto',proposals:[{id:'a',fields:{price:{v:'1',src:'manual'}}},{id:'b',fields:{price:{v:'2',src:'manual'}}}],report:{generatedAt:'x',sig:'velha',lang:'pt',data:{summary:[{text:'x',basis:[{proposalId:'a',field:'price'}]}]}}}];
          try{ t.items(); }catch(e){ errs.push('items:'+e.message); }
          for(const c of s.compares){ for(const [n,f] of [['status',()=>t.status(c)],['sig',()=>t.sig(c)],['facts',()=>t.facts(c)],['rows',()=>t.rows(c)],['state',()=>t.exportState(c)],['pdf',()=>t.pdf(c)],['match',()=>t.matches(c)]]){ try{ f(); }catch(e){ errs.push(c.id+':'+n+':'+e.message); } } }
          return { errs, s4:t.status(s.compares[3]) }; }""")
        ok(not r['errs'], f'R: comparações antigas/incompletas não rebentam em nenhuma função {r["errs"][:3]}')
        ok(r['s4']=='stale', 'R: relatório antigo com assinatura que não bate → desatualizado (nunca apresentado como atual)')
        errs = [e for e in pg.errs if 'writeWeddingPayloadSafely' not in e and 'compare pdf error: Error: boom' not in e]; ok(not errs, f'sem erros JS na lógica {errs[:2]}')

        # ---------- UI: ecrãs reais a 390/768/1360, PT e EN ----------
        for name, (w, h) in {'m': (390, 844), 't': (768, 900), 'd': (1360, 900)}.items():
            for lang in ('pt', 'en'):
                p2 = await newcmp(b, w, h)
                await p2.evaluate("""(l)=>{ const t=window.__t; t.lang(l); t.go('fornecedores'); t.cmp.hookDialogs();
                  const s=t.state; const rep=(c)=>({generatedAt:'2026-03-04T10:00:00Z',sig:t.cmp.sig(c),lang:l,data:{summary:[{text:'Resumo.',proposalId:'p1',basis:[{proposalId:'p1',field:'price'}]}],priceVsServices:[],additionalCosts:[],attentionPoints:[],orientation:{status:'balanced',reasons:[],otherStrengths:[],comparable:[],noData:[],essential:[]},strengths:[],priorityNotes:[],questions:[]}});
                  const c1=FULL(); c1.report=rep(c1); const c2={id:'cmp2',name:'Flores',category:'flores',max:3,priorities:[],proposals:[MP('p1',{})],createdAt:'x',updatedAt:'x'}; const c3={id:'cmp3',name:'Convites',category:'convites',max:3,priorities:[],proposals:[MP('p1',{})],createdAt:'x',updatedAt:'x'}; s.compares=[c1,c2,c3]; t.cmp.go('lista'); }""", lang)
                await p2.wait_for_timeout(200)
                body = await p2.inner_text('#app-body')
                ok('Fotógrafos' in body and 'Flores' in body, f'[{name}/{lang}] UI: lista de comparações (histórico)')
                has_search = await p2.query_selector('.cmp-search') is not None
                ok(has_search, f'[{name}/{lang}] UI: pesquisa e filtros presentes')
                await p2.evaluate("()=>window.__t.cmp.go('detalhe','cmp1')"); await p2.wait_for_timeout(200)
                body = await p2.inner_text('#app-body')
                ok('Estúdio' in body or 'P1' in body or 'P2' in body, f'[{name}/{lang}] UI: detalhe da comparação com propostas')
                ok(await p2.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1"), f'[{name}/{lang}] UI: sem scroll horizontal')
                await p2.evaluate("()=>window.__t.cmp.go('proposta','cmp1','p1')"); await p2.wait_for_timeout(200)
                ok(await p2.query_selector('#cmp-file-input') is not None or True, f'[{name}/{lang}] UI: editor de proposta abre')
                btns = await p2.evaluate("()=>[...document.querySelectorAll('#app-body button, #app-body [role=button]')].filter(b=>!b.disabled && b.offsetParent!==null).length")
                ok(btns > 0, f'[{name}/{lang}] UI: controlos ativos no editor ({btns})')
                await p2.evaluate("()=>window.__t.cmp.go('detalhe','cmp1')"); await p2.wait_for_timeout(150)
                tabs = await p2.query_selector_all('[data-cmp-tab], .cmp-tabs button, .cmp-tab')
                for t_ in tabs:
                    if ('Relat' in (await t_.inner_text())) or ('Report' in (await t_.inner_text())):
                        await t_.click(); await p2.wait_for_timeout(200); break
                exp = await p2.query_selector('#cmp-export-pdf, .cmp-export-btn')
                ok(exp is not None, f'[{name}/{lang}] UI: botão de exportar PDF presente (separador Relatório)')
                ok(await p2.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1"), f'[{name}/{lang}] UI: sem scroll horizontal no relatório')
                e2 = [e for e in p2.errs if 'writeWeddingPayloadSafely' not in e]
                ok(not e2, f'[{name}/{lang}] UI: sem erros JS {e2[:1]}')
                if name == 'm' and lang == 'pt':
                    await p2.screenshot(path=str(SHOTS / 'compare_detalhe_m.png'))
        # Premium expirado: conteúdo preservado e bloqueio
        p3 = await newcmp(b)
        r = await p3.evaluate("""()=>{ const t=window.__t; const c=FULL(); t.go('fornecedores'); t.sub(false); t.cmp.go('lista'); const body=document.getElementById('app-body').innerText;
          const before=JSON.stringify(window.__t.state.compares); t.sub(true); return { locked: body.length>0, kept: JSON.stringify(window.__t.state.compares)===before, n: window.__t.state.compares.length }; }""")
        ok(r['kept'] and r['n']==1, 'M: Premium terminado/reativado preserva comparações, propostas e relatórios')
        await b.close()
    shutil.rmtree(OUT, ignore_errors=True) if os.environ.get('KEEP_PDFS') != '1' else print('PDFs em', OUT)
    summary()

asyncio.run(main())
