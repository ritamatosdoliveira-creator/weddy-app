"""B.2 — RSVP com logística: individual e família, condicional, PT/EN, 390 e 1360 px."""
from common import *
STUB = """
(function(){
  window.__updates=[]; const DEL={__del:true};
  window.__guest = window.__guest || {weddingId:'W1',name:'Maria',coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01',venue:'Quinta',attending:null};
  const docRef=()=>({get:()=>Promise.resolve({exists:true,data:()=>window.__guest}),
     update:(u)=>{ window.__updates.push(JSON.parse(JSON.stringify(u,(k,v)=>v===DEL?'__DELETE__':v))); return Promise.resolve(); },set:()=>Promise.resolve()});
  const col=()=>({doc:docRef,where:()=>({get:()=>Promise.resolve({docs:[]})}),add:()=>Promise.resolve()});
  const fs=()=>({collection:col}); fs.FieldValue={serverTimestamp:()=>'ts',delete:()=>DEL};
  const fnsApp={httpsCallable:()=>()=>Promise.resolve({data:{version:'v1',text:'x',people:[]}})};
  window.firebase={initializeApp:()=>{},firestore:fs,storage:()=>({ref:()=>({})}),functions:()=>fnsApp,app:()=>({functions:()=>fnsApp})};
})();
"""
FAMILY = "window.__guest={weddingId:'W1',name:'Silva',coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01',venue:'Quinta',isFamily:true,members:[{rsvpMemberId:'m1',guestId:'g1',name:'Joao'},{rsvpMemberId:'m2',guestId:'g2',name:'Rita'}],responses:{}};"
OLD = "window.__guest={weddingId:'W1',name:'Velho',coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01',venue:'Quinta',attending:true,rsvpStatus:'yes',meal:'carne',dietary:'sem marisco',transporte:true,alojamento:false,children:[{name:'Zé',age:3,attending:true}]};"

async def main():
    res=[]
    def ok(c,m): res.append(bool(c)); print(('OK   ' if c else 'FAIL ')+m)
    async with async_playwright() as p:
        b=await p.chromium.launch()
        async def page(w,h,pre=''):
            ctx=await b.new_context(viewport={'width':w,'height':h}); pg=await ctx.new_page(); pg.errs=[]
            pg.on('pageerror',lambda e:pg.errs.append(str(e)))
            await pg.route('**/*',lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
            await pg.add_init_script(pre+STUB)
            await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001'); await pg.wait_for_selector('#form-state:not(.state-hidden)',timeout=5000)
            return ctx,pg
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            # ---- individual novo
            ctx,pg=await page(w,h)
            await pg.click('#attend-seg button[data-attend=yes]')
            ok(await pg.locator('#lg-single .lg-block').count()==0,f'[{name}] sem transporte/alojamento: nenhum detalhe de logística')
            ok(await pg.locator('#lg-single [data-lgtoggle=food]').count()==1,f'[{name}] alimentação/acessibilidade são opcionais (recolhidas)')
            await pg.click('#toggle-transporte')
            ok(await pg.locator('[data-lg="transport.from"]').count()==1 and await pg.locator('[data-lg="lodging.arrive"]').count()==0,f'[{name}] transporte → só campos de transporte')
            await pg.click('#toggle-alojamento')
            ok(await pg.locator('[data-lg="lodging.arrive"]').count()==1,f'[{name}] alojamento → campos de alojamento')
            await pg.fill('[data-lg="transport.from"]','Porto'); await pg.fill('[data-lg="transport.people"]','3'); await pg.select_option('[data-lg="transport.pref"]','ida-volta')
            await pg.fill('[data-lg="lodging.arrive"]','2027-06-30'); await pg.fill('[data-lg="lodging.depart"]','2027-06-28')
            await pg.click('[data-lgtoggle=food]')
            await pg.fill('[data-lg="food.allergies"]','marisco, nozes'); await pg.fill('[data-lg="food.intolerances"]','lactose')
            await pg.click('[data-lgdiet=vegan]'); await pg.fill('[data-lg="food.pref"]','pouco picante')
            await pg.click('[data-lgtoggle=access]'); await pg.check('[data-lgcheck="access.mobility"]'); await pg.fill('[data-lg="access.other"]','cadeira de rodas')
            await pg.select_option('#meal-select','carne')
            await pg.click('#add-child-btn'); await pg.fill('.child-name','Zé'); await pg.fill('.child-age','3'); await pg.press('.child-age','Tab')
            ok(await pg.locator('[data-flag=highchair]').count()==1 and await pg.locator('[data-flag=kidsMeal]').count()==1,f'[{name}] criança de 3 anos: cadeira de bebé e menu infantil')
            await pg.check('[data-flag=highchair]')
            await pg.fill('.child-age','9'); await pg.press('.child-age','Tab')
            ok(await pg.locator('[data-flag=highchair]').count()==0 and await pg.locator('[data-flag=kidsMeal]').count()==1,f'[{name}] criança de 9 anos: sem cadeira de bebé')
            await pg.fill('.child-age','3'); await pg.press('.child-age','Tab'); await pg.check('[data-flag=kidsMeal]')
            await pg.screenshot(path=str(SHOTS/f'rsvp_logistics_{name}.png'),full_page=True)
            ov=await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov,f'[{name}] sem overflow horizontal')
            await pg.click('#send-btn'); await pg.wait_for_timeout(200)
            ok('anterior' in (await pg.inner_text('#form-msg')) and await pg.evaluate("window.__updates.filter(x=>'attending' in x).length")==0,f'[{name}] chegada depois da saída: erro e nada gravado')
            await pg.fill('[data-lg="lodging.depart"]','2027-07-02')
            await pg.click('#send-btn'); await pg.wait_for_timeout(300)
            u=await pg.evaluate('window.__updates[window.__updates.length-1]')
            lg=u.get('logistics') or {}
            ok(lg.get('v')==1 and lg['transport']=={'from':'Porto','people':3,'pref':'ida-volta'},f'[{name}] transporte gravado {lg.get("transport")}')
            ok(lg['lodging']=={'arrive':'2027-06-30','depart':'2027-07-02'},f'[{name}] alojamento gravado (só o preenchido)')
            ok(lg['food']=={'allergies':['marisco','nozes'],'intolerances':['lactose'],'diets':['vegan'],'pref':'pouco picante'},f'[{name}] alergias separadas de intolerâncias e preferências')
            ok(lg['access']=={'mobility':True,'other':'cadeira de rodas'},f'[{name}] acessibilidade gravada')
            ok(u['children']==[{'name':'Zé','age':3,'attending':True,'highchair':True,'kidsMeal':True}],f'[{name}] criança com cadeira e menu infantil {u["children"]}')
            ok(u['transporte'] is True and u['alojamento'] is True,f'[{name}] interruptores antigos mantêm-se (fonte única do "precisa")')
            ok(not pg.errs,f'[{name}] sem erros JS {pg.errs[:2]}')
            await ctx.close()
            # ---- individual: dados antigos sem logística
            ctx,pg=await page(w,h,OLD)
            ok(await pg.locator('[data-lg="transport.from"]').count()==1,f'[{name}] antigo com transporte=true mostra campos de transporte vazios')
            ok(await pg.input_value('#dietary-text')=='sem marisco',f'[{name}] antigo: nota de alimentação preservada')
            await pg.click('#send-btn'); await pg.wait_for_timeout(300)
            u=await pg.evaluate('window.__updates[window.__updates.length-1]')
            ok('logistics' not in u,f'[{name}] antigo reenviado sem preencher: não cria "logistics" nem apaga nada')
            ok(u['dietary']=='sem marisco' and u['children'][0]['name']=='Zé' and 'highchair' not in u['children'][0],f'[{name}] antigo: restantes dados intactos')
            await ctx.close()
            # ---- família: necessidades diferentes por membro
            ctx,pg=await page(w,h,FAMILY)
            ok(await pg.locator('.lg-wrap').count()==2,f'[{name}] família: um bloco de logística por pessoa')
            await pg.click('[data-mattend=yes][data-mid=m1]'); await pg.click('[data-mattend=yes][data-mid=m2]')
            for mid in ('m1','m2'): await pg.select_option(f'select[data-mfield=meal][data-mid={mid}]','peixe')
            await pg.click('[data-mtoggle=transporte][data-mid=m1]')
            ok(await pg.locator('[data-lgmid=m1] [data-lg="transport.from"]').count()==1 and await pg.locator('[data-lgmid=m2] [data-lg="transport.from"]').count()==0,f'[{name}] transporte só para quem o pediu')
            await pg.fill('[data-lgmid=m1] [data-lg="transport.from"]','Lisboa')
            await pg.click('[data-lgmid=m2] [data-lgtoggle=food]'); await pg.fill('[data-lgmid=m2] [data-lg="food.allergies"]','amendoim')
            await pg.click('#send-btn'); await pg.wait_for_timeout(300)
            u=await pg.evaluate('window.__updates[window.__updates.length-1]')
            r1=u['responses.m1']; r2=u['responses.m2']
            ok(r1['logistics']['transport']=={'from':'Lisboa'} and 'food' not in r1['logistics'],f'[{name}] membro 1: só transporte')
            ok(r2['logistics']=={'v':1,'food':{'allergies':['amendoim']}} and r2['transporte'] is False,f'[{name}] membro 2: só alergia')
            await pg.screenshot(path=str(SHOTS/f'rsvp_logistics_family_{name}.png'),full_page=True)
            ok(not pg.errs,f'[{name}] família sem erros JS {pg.errs[:2]}')
            await ctx.close()
            # ---- EN
            ctx,pg=await page(w,h)
            await pg.click('#lang-switch button[data-lang=en]'); await pg.click('#attend-seg button[data-attend=yes]'); await pg.click('#toggle-transporte'); await pg.click('[data-lgtoggle=food]')
            txt=await pg.inner_text('#lg-single')
            ok('Allergies' in txt and 'Where will you leave from' in txt and 'Alergias' not in txt and 'Transporte' not in txt,f'[{name}] EN: sem texto PT na logística')
            ok('Only shared with' in txt or 'only shared with the couple' in txt,f'[{name}] EN: nota de privacidade')
            await ctx.close()
            # ---- apagar resposta limpa logística
        await b.close()
    print(f'\n{sum(res)}/{len(res)} OK'); sys.exit(0 if all(res) else 1)
asyncio.run(main())
