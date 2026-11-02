import asyncio, json
from playwright.async_api import async_playwright
STUB="""
(function(){
 window.__snap=null;
 function mk(){ var f=function(){ return p; }; var p=new Proxy(f,{get:function(t,k){ if(k==='then') return undefined; if(k==='onSnapshot') return function(cb){ window.__snap=cb; return function(){}; }; if(k==='onAuthStateChanged') return function(cb){ setTimeout(function(){cb(null)},0); return function(){}; }; if(k===Symbol.toPrimitive) return function(){return ''}; return p; }, apply:function(){ return p; }}); return p; }
 window.firebase = mk();
})();
"""
RES=[]
def ok(c,m): RES.append(bool(c)); print(('OK   ' if c else 'FAIL ')+m)
async def newpage(b,w=390,h=844):
    ctx=await b.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page()
    pg.errs=[]; pg.on('pageerror',lambda e:pg.errs.append(str(e)[:200]))
    pg.cons=[]; pg.on('console',lambda m: pg.cons.append(m.text[:200]) if m.type=='error' else None)
    pg.on('dialog',lambda d:asyncio.ensure_future(d.dismiss()))
    await pg.route('**/*',lambda r: r.continue_() if r.request.url.startswith('file:///tmp/sx') else r.abort())
    await pg.add_init_script(STUB)
    await pg.goto('file:///tmp/sx/app_a4.html'); await pg.wait_for_timeout(700)
    await pg.add_style_tag(content='#login-screen,.login-screen{display:none !important}')
    return pg
BAD=[None,'texto',5,True,[],{},[None,1,'a'],{'a':1}]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await newpage(b)
        ok(await pg.evaluate("typeof window.__a4")=='object','harness carregado')
        # 1) estado válido não é alterado
        r=await pg.evaluate("""()=>{ const a=window.__a4; const s=a.seed(); s.expenses=[{id:'e1',desc:'Quinta',value:'5000',paid:'100'}]; s.guests.noiva.familia=['Ana',{guestId:'g1',name:'Rui'}]; const before=JSON.stringify(s); const r=a.san(JSON.parse(before)); return {same: JSON.stringify(r.state)===before, n:r.repairs.length}; }""")
        ok(r['same'] and r['n']==0,'estado válido passa sem alterações nem reparações')
        # 2) matriz: cada chave de topo × valores errados
        keys=await pg.evaluate("Object.keys(window.__a4.seed())")
        bad_total=0; fails=[]
        for k in keys:
            for v in BAD:
                res=await pg.evaluate("""([k,v])=>{ const a=window.__a4; const s=a.seed(); s[k]=v; let out; try{ out=a.san(JSON.parse(JSON.stringify(s))); }catch(e){ return {thrown:String(e)}; }
                  if(!out.state) return {nostate:true};
                  a.state=out.state; try{ a.render(); }catch(e){ return {renderThrown:String(e)}; }
                  const body=document.getElementById('app-body'); return { len:body.innerHTML.length, viewerr:body.querySelectorAll('[data-viewerr]').length, kinds:Object.keys(a.errs()) }; }""",[k,v])
                bad_total+=1
                if 'thrown' in res or 'renderThrown' in res or res.get('nostate') or res.get('viewerr',0)>0 or res.get('len',0)<500: fails.append((k,v,res))
        ok(not fails,f'matriz {len(keys)} chaves × {len(BAD)} valores errados = {bad_total} casos: sanitizar+desenhar sem falhas {fails[:3]}')
        # 3) SEM sanitizar: o isolamento de páginas evita o ecrã em branco
        fails=[]; showed=0
        for k in keys:
            for v in BAD:
                res=await pg.evaluate("""([k,v])=>{ const a=window.__a4; const s=a.seed(); s[k]=v; a.state=s; try{ a.render(); }catch(e){ return {renderThrown:String(e)}; }
                  const body=document.getElementById('app-body'); return { len:body.innerHTML.length, viewerr:body.querySelectorAll('[data-viewerr]').length, panels:body.querySelectorAll('.tabpanel').length }; }""",[k,v])
                if 'renderThrown' in res or res['panels']!=15: fails.append((k,v,res))
                showed+= 1 if res.get('viewerr',0)>0 else 0
        ok(not fails,f'sem sanitizar, render() nunca lança e desenha as 15 páginas ({showed} casos com aviso isolado) {fails[:2]}')
        # 4) retry funciona e aviso tem texto
        await pg.evaluate("()=>{ const a=window.__a4; const s=a.seed(); s.expenses='lixo'; a.state=s; a.go('gastos'); a.render(); }")
        n=await pg.locator('[data-viewerr]').count()
        ok(n>=1 and 'Esta secção não abriu' in await pg.locator('[data-viewerr]').first.inner_text(),'aviso por página com texto Weddy')
        await pg.evaluate("()=>{ const a=window.__a4; a.state=a.seed(); }")
        await pg.locator('.tabpanel.active [data-viewretry]').first.click(); await pg.wait_for_timeout(200)
        ok(await pg.locator('[data-viewerr]').count()==0,'"Tentar de novo" volta a desenhar a página')
        # 5) casos concretos pedidos
        cases={
         'guests=null':"s.guests=null", 'guests.noiva=texto':"s.guests.noiva='x'", 'guests.noiva.familia=objeto':"s.guests.noiva.familia={a:1}",
         'todoCategories=texto':"s.todoCategories='x'", 'todoCategories[0].items=null':"s.todoCategories[0].items=null",
         'expenses com nulos':"s.expenses=[null,5,'x',{id:'e'}]", 'seating.tables=null':"s.seating.tables=null", 'seating=null':"s.seating=null",
         'budget=null':"s.budget=null", 'categories com lixo':"s.categories=[null,{id:1},{name:5}]", 'suppliers=objeto':"s.suppliers={}",
         'compares=texto':"s.compares='x'", 'weddingDocuments com nulos':"s.weddingDocuments=[null,1]", 'vows.bride=null':"s.vows.bride=null",
         'cake.tiers=objeto':"s.cake.tiers={}", 'confirmed=array':"s.confirmed=[1,2]", 'checklistDone=null':"s.checklistDone=null",
        }
        for name,js in cases.items():
            res=await pg.evaluate("(js)=>{ const a=window.__a4; const s=a.seed(); new Function('s',js)(s); let out=a.san(JSON.parse(JSON.stringify(s))); a.state=out.state; try{ a.render(); }catch(e){ return {t:String(e)}; } return {ve:document.querySelectorAll('[data-viewerr]').length, rep:out.repairs.length}; }",js)
            ok('t' not in res and res['ve']==0,f'caso concreto: {name} → reparado e desenhado (reparações {res.get("rep")})')
        # 6) chaves perigosas
        r=await pg.evaluate("""()=>{ const a=window.__a4; const raw=JSON.parse('{"__proto__":{"x":1},"budget":{"total":5,"constructor":{"y":1}}}'); const o=a.san(raw); return { proto:Object.prototype.hasOwnProperty.call(o.state,'__proto__'), ctor:Object.prototype.hasOwnProperty.call(o.state.budget,'constructor'), polluted:({}).x }; }""")
        ok(not r['proto'] and not r['ctor'] and r['polluted'] is None,'chaves __proto__/constructor removidas, sem poluição')
        # 7) raiz inválida
        r=await pg.evaluate("()=>{ const a=window.__a4; return [null,5,'x',[1],true].map(v=>a.san(v).state); }")
        ok(all(x is None for x in r),'raiz que não é objeto → sem estado (o chamador mantém o local)')
        # 8) backup local + desempenho
        r=await pg.evaluate("""()=>{ const a=window.__a4; const s=a.seed(); s.expenses='lixo'; const out=a.sanIn(JSON.parse(JSON.stringify(s)),'teste'); const k=Object.keys(localStorage).filter(x=>x.indexOf('weddy-corrupt-backup-')===0); return { ok:Array.isArray(out.expenses), backup:k.length, has:k.length? localStorage.getItem(k[0]).indexOf('lixo')>0 : false }; }""")
        ok(r['ok'] and r['backup']==1 and r['has'],'valor corrompido original guardado em backup local antes de repor')
        t=await pg.evaluate("""()=>{ const a=window.__a4; const s=a.seed(); s.guests.noiva.familia=Array.from({length:6000},(_,i)=>({guestId:'g'+i,name:'N'+i})); s.expenses=Array.from({length:3000},(_,i)=>({id:'e'+i,value:'1',paid:'0'})); const raw=JSON.parse(JSON.stringify(s)); const t0=performance.now(); a.san(raw); return performance.now()-t0; }""")
        ok(t<300,f'6000 convidados + 3000 despesas sanitizados em {t:.0f} ms')
        ok(not pg.errs,f'sem erros JS não tratados {pg.errs[:2]}')
        await pg.context.close()

        # 9) caminho do snapshot: json corrompido nunca prende a app
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            pg=await newpage(b,w,h)
            await pg.evaluate("window.__a4.attach()")
            ok(await pg.evaluate("typeof window.__snap")=='function',f'[{name}] listener do snapshot registado')
            seed=await pg.evaluate("window.__a4.seed()")
            seed['todoCategories']='lixo'; seed['guests']={'noiva':None,'noivo':'x','conjunto':[]}; seed['expenses']=[None,3,{'id':'e1','value':'100','paid':'0','desc':'ok'}]; seed['seating']=None
            await pg.evaluate("""(js)=>{ window.__snap({ exists:true, data:()=>({ json: js, settings:{coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01'}, ownerEmails:['a@x.pt'], subscription:{active:true} }) }); }""",json.dumps(seed))
            await pg.wait_for_timeout(500)
            ok(await pg.evaluate("window.__a4.firstSync()"),f'[{name}] 1.º snapshot com campos corrompidos conclui a sincronização')
            st=await pg.evaluate("window.__a4.state")
            ok(isinstance(st['todoCategories'],list) and len(st['todoCategories'])==3 and isinstance(st['guests']['noiva'],dict) and st['seating'] is not None and len(st['expenses'])==1 and st['expenses'][0]['desc']=='ok',f'[{name}] estado reparado em memória; despesa válida preservada')
            body=await pg.evaluate("document.getElementById('app-body').innerHTML.length")
            ok(body>2000 and await pg.locator('[data-viewerr]').count()==0,f'[{name}] app desenhada, sem páginas com erro')
            ok(await pg.evaluate("document.querySelector('.tabpanel.active')!==null"),f'[{name}] página ativa visível (não está em branco)')
            # json ilegível + snapshot seguinte válido
            await pg.evaluate("""()=>{ window.__snap({ exists:true, data:()=>({ json:'{corrompido', settings:{coupleName1:'Ana',coupleName2:'Rui'} }) }); }""")
            await pg.wait_for_timeout(300)
            ok(await pg.evaluate("window.__a4.firstSync()") and await pg.evaluate("Array.isArray(window.__a4.state.expenses)"),f'[{name}] json truncado ignorado, app continua')
            # json = null / array / número
            for jv in ['null','[1,2]','5','"x"']:
                await pg.evaluate("(j)=>{ window.__snap({ exists:true, data:()=>({ json:j, settings:{coupleName1:'Ana'} }) }); }",jv)
                await pg.wait_for_timeout(150)
            ok(await pg.evaluate("window.__a4.firstSync() && typeof window.__a4.state==='object' && !Array.isArray(window.__a4.state)"),f'[{name}] json "null"/array/número/texto não substitui o estado')
            ov=await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov,f'[{name}] sem overflow horizontal')
            await pg.evaluate("()=>{ const a=window.__a4; const s=a.seed(); s.expenses='lixo'; a.state=s; a.go('gastos'); a.render(); }")
            await pg.screenshot(path=f'/tmp/sx/a4/viewerr_{name}.png')
            ok(not pg.errs,f'[{name}] sem erros JS não tratados {pg.errs[:2]}')
            await pg.context.close()
        await b.close()
    print(f"\n{sum(RES)}/{len(RES)} OK")
asyncio.run(main())
