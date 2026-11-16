from common import *
newpage = functools.partial(newpage, mode='wa')
import re
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await newpage(b)
        await pg.evaluate("document.getElementById('payment-alert-popup') && document.getElementById('payment-alert-popup').classList.remove('show')")
        await pg.evaluate("""()=>{ const s=window.__t.state; window.__t.sub(true);
          s.guests.noiva.familia=[
            {name:'Legado',guestId:'a',phone:'+351911111111',rsvpToken:'tok11111111',communicationPreferences:{whatsapp:{optedIn:true,optedInAt:'2026-09-01T10:00:00Z'}}},
            {name:'Real',guestId:'b',phone:'+351922222222',rsvpToken:'tok22222222',communicationPreferences:{whatsapp:{optedIn:true,optedInAt:'2026-11-01T10:00:00Z',source:'guest'}}},
            {name:'Pend',guestId:'c',phone:'+351933333333',rsvpToken:'tok33333333'},
            {name:'Stop',guestId:'d',phone:'+351944444444',rsvpToken:'tok44444444',communicationPreferences:{whatsapp:{optedIn:false,optedOutAt:'2026-10-02T10:00:00Z'}}}]; }""")
        ok(await pg.locator('#gp-consent-toggle').count()==0,'já não existe o botão para o casal dar consentimento')
        exp={0:('por renovar|needs renewal',False),1:('Consentimento dado',True),2:('Pendente',False),3:('Retirado',False)}
        for i,(pat,btn) in exp.items():
            await pg.evaluate(f"window.__t.sheet.open('noiva','familia',{i})"); await pg.wait_for_timeout(150)
            t=await pg.inner_text('#gp-consent-status'); v=await pg.is_visible('#gp-send-whatsapp')
            print('  ',i,t[:80],'| botão WhatsApp:',v)
            ok(re.search(pat,t) is not None,f'estado do convidado {i}: {pat}')
            ok(v==btn,f'botão "Enviar lembrete WhatsApp" {"visível" if btn else "escondido"} (convidado {i})')
            await pg.evaluate("document.getElementById('gp-cancel').click()")
        await pg.evaluate("window.__t.sheet.open('noiva','familia',2)"); await pg.wait_for_timeout(150)
        await pg.screenshot(path=str(SHOTS/'sheet_m.png'))
        await pg.evaluate("window.__t.lang('en'); window.__t.sheet.open('noiva','familia',1)")
        ok('Consent given' in await pg.inner_text('#gp-consent-status'),'EN')
        ok(not pg.errs,'sem erros JS '+str(pg.errs[:2]))
        await b.close()
    print(f'\n{sum(CHECKS)}/{len(CHECKS)} OK'); sys.exit(0 if all(CHECKS) else 1)
asyncio.run(main())
