"""B.2 — Concierge: só informação dos noivos; nunca dados de logística de terceiros; limpeza ao recusar."""
from common import *
STUB = """
(function(){
  window.__updates=[]; window.__calls=[]; const DEL={__del:true};
  const g0=window.__guest||{};
  const docRef=()=>({get:()=>Promise.resolve({exists:true,data:()=>window.__guest}),
     update:(u)=>{ window.__updates.push(JSON.parse(JSON.stringify(u,(k,v)=>v===DEL?'__DELETE__':v))); return Promise.resolve(); },set:()=>Promise.resolve()});
  const col=()=>({doc:docRef,where:()=>({get:()=>Promise.resolve({docs:[]})}),add:()=>Promise.resolve()});
  const fs=()=>({collection:col}); fs.FieldValue={serverTimestamp:()=>'ts',delete:()=>DEL};
  const fnsApp={httpsCallable:(n)=>(d)=>{ window.__calls.push(n); return Promise.resolve({data:{intent:'UNKNOWN',version:'v1',text:'x',people:[]}}); }};
  window.firebase={initializeApp:()=>{},firestore:fs,storage:()=>({ref:()=>({})}),functions:()=>fnsApp,app:()=>({functions:()=>fnsApp})};
})();
"""
BASE="weddingId:'W1',coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01',venue:'Quinta',guestTransportInfo:'Autocarro às 17h no Rossio',guestAccommodationInfo:'Hotel Sol, código WEDDY'"
SINGLE=f"window.__guest={{{BASE},name:'Maria',attending:true,rsvpStatus:'yes',meal:'carne',transporte:true,alojamento:true,children:[],logistics:{{v:1,transport:{{from:'PortoSecreto'}},food:{{allergies:['marisco']}},access:{{other:'cadeiraXYZ'}}}}}};"
FAMILY=f"window.__guest={{{BASE},name:'Silva',isFamily:true,members:[{{rsvpMemberId:'m1',guestId:'g1',name:'Joao'}},{{rsvpMemberId:'m2',guestId:'g2',name:'Rita'}}],responses:{{m1:{{attending:true,logistics:{{v:1,food:{{allergies:['amendoimSecreto']}}}}}},m2:{{attending:true}}}}}};"
async def ask(pg, q):
    await pg.fill('#concierge-input', q); await pg.click('#concierge-send'); await pg.wait_for_timeout(350)
    return await pg.inner_text('#concierge-log')
async def main():
    res=[]
    def ok(c,m): res.append(bool(c)); print(('OK   ' if c else 'FAIL ')+m)
    async with async_playwright() as p:
        b=await p.chromium.launch()
        async def page(w,h,pre,lang=None):
            ctx=await b.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page(); pg.errs=[]
            pg.on('pageerror',lambda e:pg.errs.append(str(e)))
            await pg.route('**/*',lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
            await pg.add_init_script(pre+STUB)
            await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001'); await pg.wait_for_selector('#form-state:not(.state-hidden)',timeout=5000)
            if lang: await pg.click(f'#lang-switch button[data-lang={lang}]')
            await pg.click('#concierge-fab'); return ctx,pg
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            ctx,pg=await page(w,h,SINGLE)
            log=await ask(pg,'Que transporte há?')
            ok('Autocarro às 17h' in log and 'PortoSecreto' not in log,f'[{name}] transporte: responde com a info dos noivos, não com dados do convidado')
            log=await ask(pg,'Onde posso ficar a dormir?')
            ok('Hotel Sol' in log,f'[{name}] alojamento: info dos noivos')
            n0=len(await pg.evaluate('window.__calls'))
            for q in ['Quem mais precisa de transporte?','Que alergias têm os outros convidados?','Há alguém com mobilidade reduzida na minha mesa?','Which guests need accommodation?','What allergies do the other guests have?']:
                log=await ask(pg,q)
            ok(log.count('Por privacidade')+log.count('For privacy')>=5,f'[{name}] perguntas sobre terceiros: resposta de privacidade em todas')
            ok(len(await pg.evaluate('window.__calls'))==n0,f'[{name}] nenhuma destas perguntas foi enviada ao serviço de IA')
            # ações de RSVP: recusar apaga logística (individual)
            log=await ask(pg,'Afinal não posso ir')
            await pg.click('.concierge-confirm-btn.yes'); await pg.wait_for_timeout(400)
            u=await pg.evaluate("window.__updates.filter(x=>'attending' in x).pop()")
            ok(u and u['attending'] is False and u.get('logistics')=='__DELETE__',f'[{name}] recusar pelo Concierge também apaga a logística {u}')
            ok(not pg.errs,f'[{name}] sem erros JS {pg.errs[:2]}')
            await ctx.close()
            ctx,pg=await page(w,h,FAMILY)
            log=await ask(pg,'Quem tem alergias na minha família?')
            ok('amendoimSecreto' not in log and 'Por privacidade' in log,f'[{name}] família: nunca revela alergias de um membro através do chat')
            log=await ask(pg,'Que transporte há?')
            ok('Autocarro' in log and 'amendoimSecreto' not in log,f'[{name}] família: info dos noivos')
            ok(not pg.errs,f'[{name}] família sem erros JS {pg.errs[:2]}')
            await ctx.close()
        ctx,pg=await page(390,844,SINGLE,'en')
        log=await ask(pg,'Who needs transport?')
        ok('For privacy' in log and 'Por privacidade' not in log,'EN: resposta de privacidade em inglês')
        pt=await pg.inner_text('#privacy-text') if await pg.locator('#privacy-text').count() else ''
        await ctx.close()
        ctx,pg=await page(390,844,SINGLE)
        await pg.evaluate("document.getElementById('privacy-text').classList.add('open')")
        tx=await pg.evaluate("document.getElementById('privacy-text').textContent")
        ok('acessibilidade' in tx and 'treinar modelos' in tx,'texto de privacidade atualizado (acessibilidade, sem treino de modelos)')
        await b.close()
    print(f'\n{sum(res)}/{len(res)} OK'); sys.exit(0 if all(res) else 1)
asyncio.run(main())
