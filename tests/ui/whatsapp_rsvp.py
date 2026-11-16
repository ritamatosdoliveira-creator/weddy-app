from common import *
RSVP_STUB = """
(function(){
  window.__calls=[]; window.__consent={granted:false,pending:false};
  const guest={weddingId:'W1',guestId:'g1',name:'Maria Silva',coupleName1:'Ana',coupleName2:'Rui',weddingDate:'2027-07-01',venue:'Quinta',attending:null};
  const docRef=(path)=>({get:()=>Promise.resolve({exists:true,data:()=>guest}),update:()=>Promise.resolve(),set:()=>Promise.resolve()});
  const col=()=>({doc:docRef,where:()=>({get:()=>Promise.resolve({docs:[]})}),add:()=>Promise.resolve()});
  const fs=()=>({collection:col});
  fs.FieldValue={serverTimestamp:()=>'ts'};
  const fnsApp={httpsCallable:(name)=>(data)=>{
    window.__calls.push({name,data});
    if(window.__fail) return Promise.reject({code:'internal',message:'x'});
    if(name==='getGuestWhatsappConsent'){
      if(window.__nophone) return Promise.resolve({data:{version:'v1',text:'TEXTO '+data.lang,people:[]}});
      return Promise.resolve({data:{version:'v1',text:(data.lang==='en'?'I agree to receive WhatsApp messages. ':'Aceito receber mensagens por WhatsApp. ')+'STOP',people:[{guestId:'g1',name:'',phoneMasked:'+351 ••• ••• 678',granted:window.__consent.granted,pending:window.__consent.pending,grantedAt:window.__consent.granted?'2026-11-01T10:00:00Z':null}]}});
    }
    if(name==='setGuestWhatsappConsent'){ if(data.optedIn){ window.__consent.pending=true; window.__consent.granted=false; return Promise.resolve({data:{ok:true,granted:false,pending:true,code:'123456',expiresAt:'2026-11-05T10:00:00Z',whatsappNumber:'351900000000'}}); } window.__consent.granted=false; window.__consent.pending=false; return Promise.resolve({data:{ok:true,granted:false,pending:false}}); }
    return Promise.resolve({data:{intent:'UNKNOWN'}});
  }};
  window.firebase={initializeApp:()=>{},firestore:fs,storage:()=>({ref:()=>({})}),functions:()=>fnsApp,app:()=>({functions:()=>fnsApp})};
})();
"""
newpage = functools.partial(newpage, mode='x')

async def main():
    res=[]
    def ok(c,m): res.append(c); print(('OK   ' if c else 'FAIL ')+m)
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            ctx=await b.new_context(viewport={'width':w,'height':h})
            pg=await ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            async def rt(r):
                u=r.request.url
                if u.startswith('file://'): await r.continue_()
                else: await r.abort()
            await pg.route('**/*',rt)
            await pg.add_init_script(RSVP_STUB)
            await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001')
            await pg.wait_for_selector('#wa-consent:not(.state-hidden)',timeout=5000)
            ok(await pg.is_visible('#wa-consent'),f'[{name}] bloco de consentimento visível')
            ok(not await pg.is_checked('#wa-cb-0'),f'[{name}] caixa desmarcada por defeito')
            ok('Aceito receber' in await pg.inner_text('#wa-people'),f'[{name}] texto do servidor mostrado')
            ok('678' in await pg.inner_text('#wa-people') and '912' not in await pg.inner_text('#wa-people'),f'[{name}] número mascarado')
            calls=await pg.evaluate('window.__calls.map(c=>c.name)')
            ok('setGuestWhatsappConsent' not in calls,f'[{name}] nada gravado só por abrir/visualizar')
            # independente do RSVP: botão enviar RSVP continua desativado, e consentir não o ativa
            ok(await pg.is_disabled('#send-btn'),f'[{name}] RSVP continua por responder')
            # guardar sem alterar nada: não chama o servidor
            await pg.click('#wa-save'); await pg.wait_for_timeout(200)
            ok('setGuestWhatsappConsent' not in await pg.evaluate('window.__calls.map(c=>c.name)'),f'[{name}] guardar sem mexer não grava nada')
            await pg.check('#wa-cb-0'); await pg.click('#wa-save'); await pg.wait_for_timeout(400)
            sc=await pg.evaluate("window.__calls.filter(c=>c.name==='setGuestWhatsappConsent')")
            ok(len(sc)==1 and sc[0]['data']['optedIn'] is True and sc[0]['data']['version']=='v1' and sc[0]['data']['token']=='tokenGuest0001',f'[{name}] marcar+guardar envia optedIn true com versão e token')
            ok('pedido registado' in (await pg.inner_text('#wa-msg')).lower(),f'[{name}] mensagem: falta confirmar no WhatsApp')
            txt=await pg.inner_text('#wa-people')
            ok('SIM 123456' in txt and 'Pedido registado' in txt,f'[{name}] mostra instrução e código')
            await pg.locator('#wa-consent').scroll_into_view_if_needed(); await pg.screenshot(path=str(SHOTS/f'rsvp_pending_{name}.png'))
            href=await pg.get_attribute('#wa-people .wa-confirm a','href')
            ok(href=='https://wa.me/351900000000?text=SIM%20123456',f'[{name}] link wa.me com o texto pré-preenchido')
            ok(await pg.is_checked('#wa-cb-0') and 'Consentimento dado' not in txt,f'[{name}] pendente NÃO aparece como consentimento dado')
            ok(await pg.is_disabled('#send-btn'),f'[{name}] RSVP não foi afetado pelo consentimento')
            # novo código
            await pg.click('#wa-people .wa-confirm button'); await pg.wait_for_timeout(300)
            ok(len(await pg.evaluate("window.__calls.filter(c=>c.name==='setGuestWhatsappConsent')"))==2,f'[{name}] gerar novo código volta a pedir ao servidor')
            # o convidado confirma no WhatsApp (simulado) e a página é recarregada (troca de idioma)
            await pg.evaluate("window.__consent.granted=true; window.__consent.pending=false")
            await pg.click('#lang-switch button[data-lang=pt]'); await pg.wait_for_timeout(500)
            ok(await pg.is_checked('#wa-cb-0') and 'Consentimento dado' in await pg.inner_text('#wa-people') and await pg.locator('.wa-confirm').count()==0,f'[{name}] depois de confirmar: estado "dado" e sem caixa de confirmação')
            # recarregar com pendente (sem código em memória): mostra aviso de pedido enviado
            await pg.evaluate("window.__consent.granted=false; window.__consent.pending=true; delete window.__x")
            await pg.click('#lang-switch button[data-lang=en]'); await pg.wait_for_timeout(500)
            await pg.click('#lang-switch button[data-lang=pt]'); await pg.wait_for_timeout(500)
            t2=await pg.inner_text('#wa-people')
            ok('Pedido registado' in t2 or 'SIM 123456' in t2,f'[{name}] pendente após recarregar mostra como concluir')
            await pg.evaluate("window.__consent.granted=true; window.__consent.pending=false")
            await pg.uncheck('#wa-cb-0'); await pg.click('#wa-save'); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("window.__consent.granted")==False and 'retirado' in (await pg.inner_text('#wa-msg')).lower(),f'[{name}] retirar consentimento funciona')
            # EN
            await pg.click('#lang-switch button[data-lang=en]'); await pg.wait_for_timeout(500)
            ok('I agree' in await pg.inner_text('#wa-people') and 'WhatsApp reminders' in await pg.inner_text('#wa-consent'),f'[{name}] versão EN')
            ov=await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov,f'[{name}] sem overflow horizontal')
            await pg.locator('#wa-consent').scroll_into_view_if_needed()
            await pg.screenshot(path=str(SHOTS/f'rsvp_{name}.png'))
            ok(not errs,f'[{name}] sem erros JS {errs[:2]}')
            await ctx.close()
        # falha do servidor: bloco não aparece / erro amigável
        ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        await pg.route('**/*',lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
        await pg.add_init_script(RSVP_STUB+"window.__nophone=true;")
        await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001'); await pg.wait_for_timeout(1200)
        ok(not await pg.is_visible('#wa-consent'),'convidado sem número: bloco escondido')
        await ctx.close()
        ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        await pg.route('**/*',lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
        await pg.add_init_script(RSVP_STUB+"window.__fail=true;")
        await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001'); await pg.wait_for_timeout(1200)
        ok(not await pg.is_visible('#wa-consent') and await pg.is_visible('#form-state'),'função indisponível: RSVP funciona, bloco escondido')
        await b.close()
    print(f'\n{sum(res)}/{len(res)} OK'); sys.exit(0 if all(res) else 1)
asyncio.run(main())
