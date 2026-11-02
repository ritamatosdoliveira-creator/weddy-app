"""Fase I — Google Calendar no cliente: Premium terminado com ligação existente (consultar/desligar, sem sincronizar),
sem ligação → página de venda, Premium ativo: conta Google e sync parcial visíveis; PT/EN; 390/768/1360.
Sem chamadas reais ao Google (o cliente do harness usa o STUB do Firebase)."""
from common import *
newpage = functools.partial(newpage, mode='app')
PT = re.compile(r"\b(não|nao|já|ainda|terminou|sincroniza\w*|ligação)\b|[áàâãéêíóôõúç]", re.I)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('pt', 'en'):
            for name, (w, h) in {'mobile': (390, 844), 'tablet': (768, 1024), 'desktop': (1360, 800)}.items():
                tag = f'[{lang}/{name}]'
                pg = await newpage(b, w, h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                setup = "(c)=>window.__t.gcal(c)"
                CONN = "{connected:true,status:'CONNECTED',calendarId:'cal1',calendarName:'Casamento',googleAccountEmail:'rita@gmail.com'}"
                # sem Premium e SEM ligação → página de venda
                await pg.evaluate("window.__t.sub(false)")
                await pg.evaluate(f"({setup})({{connected:false}})"); await pg.evaluate("window.__t.sec('googlecalendar')"); await pg.wait_for_timeout(250)
                ok('Weddy Premium' in await pg.evaluate("document.body.innerText") and await pg.locator('#gcal-disconnect-btn').count() == 0, f'{tag} sem Premium e sem ligação → página de venda')
                # sem Premium COM ligação → só estado + desligar
                await pg.evaluate(f"({setup})({CONN})"); await pg.evaluate("window.__t.render()"); await pg.wait_for_timeout(250)
                t = await pg.evaluate("document.body.innerText")
                ok(await pg.locator('#gcal-disconnect-btn').count() == 1, f'{tag} Premium terminado: botão de desligar disponível')
                ok(await pg.locator('#gcal-sync-btn').count() == 0 and await pg.locator('#gcal-change-btn').count() == 0, f'{tag} Premium terminado: sem sincronizar nem alterar calendário')
                ok('rita@gmail.com' in t and 'Casamento' in t, f'{tag} Premium terminado: mostra a conta e o calendário ligados')
                note = 'não são apagados' if lang == 'pt' else 'are not deleted'
                ok(note in t, f'{tag} Premium terminado: explica que nada é apagado ({note!r})')
                if lang == 'en':
                    bad = [l for l in t.split('\n') if PT.search(l)]
                    ok(not bad, f'{tag} EN sem português {bad[:3]}')
                ok(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag} sem scroll horizontal')
                # Premium ativo: conta + sync parcial
                await pg.evaluate("window.__t.sub(true)")
                await pg.evaluate(f"({setup})({{connected:true,status:'CONNECTED',calendarId:'cal1',calendarName:'Casamento',googleAccountEmail:'rita@gmail.com',lastSyncStatus:'partial',lastSyncFailedItems:2,lastSyncError:'PARTIAL_2'}})")
                await pg.evaluate("window.__t.render()"); await pg.wait_for_timeout(250)
                t = await pg.evaluate("document.body.innerText")
                ok('rita@gmail.com' in t, f'{tag} Premium: conta Google visível')
                ok(('2 eventos não foram atualizados' in t) if lang == 'pt' else ('2 events were not updated' in t), f'{tag} Premium: sincronização parcial explicada sem código técnico')
                ok('PARTIAL_' not in t, f'{tag} código interno não aparece ao utilizador')
                ok(await pg.locator('#gcal-sync-btn').count() == 1, f'{tag} Premium: sincronizar disponível')
                errs = [e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]
                ok(not errs, f'{tag} sem erros JS {errs[:2]}')
                await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
