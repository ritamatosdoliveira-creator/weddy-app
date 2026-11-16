from common import *

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            pg=await newpage(b,w,h)
            await ev(pg,"window.__t.nt.open()"); await pg.wait_for_timeout(400)
            await pg.click('.nt-prefs summary'); await pg.wait_for_timeout(200)
            d=pg.locator('[data-ntpref="email:digest"]'); a=pg.locator('[data-ntpref="email:alerts"]')
            ok(await d.is_checked() and await a.is_checked(),f'[{name}] defeito: resumo semanal e alertas ligados')
            ok(await ev(pg,"window.__t.state.notif===undefined || !(window.__t.state.notif.prefs&&window.__t.state.notif.prefs.email)"),f'[{name}] abrir não grava nada')
            await d.uncheck(); await pg.wait_for_timeout(200)
            e=await ev(pg,"window.__t.state.notif.prefs.email")
            ok(e['digest']=='off',f'[{name}] desligar resumo grava preferência {e}')
            await pg.click('.nt-prefs summary') if not await pg.locator('[data-ntpref="email:alerts"]').is_visible() else None
            await pg.locator('[data-ntpref="email:alerts"]').uncheck(); await pg.wait_for_timeout(200)
            e=await ev(pg,"window.__t.state.notif.prefs.email")
            ok(e['digest']=='off' and e['alerts'] is False,f'[{name}] desligar alertas mantém o resto {e}')
            pf=await ev(pg,"window.__t.nt.prefs().email")
            ok(pf['digest']=='off' and pf['alerts'] is False,f'[{name}] ntPrefs reflete')
            ov=await ev(pg,"document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov,f'[{name}] sem overflow')
            await pg.screenshot(path=str(SHOTS/f'prefs_email_{name}.png'))
            ok(not pg.errs,f'[{name}] sem erros {pg.errs[:2]}')
        await b.close()
    print(sum(CHECKS),'/',len(CHECKS))
asyncio.run(main())
