"""B.2 — mesas: etiquetas e sugestões informativas, sem nunca alterar a distribuição."""
from common import *
newpage = functools.partial(newpage, mode='app')
exec(open(Path(__file__).with_name('logistics_couple.py'),encoding='utf-8').read().split('async def main')[0].split('newpage = functools.partial(newpage, mode=\'app\')')[1])
SEAT = """(assign)=>{ const s=window.__t.state; s.seating.tables=[{id:1,seats:4,shape:'round',notes:''},{id:2,seats:4,shape:'round',notes:''}]; s.seating.assignments=assign; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            pg = await newpage(b,w,h)
            await pg.evaluate(SETUP)
            # Ana + Fam1 na mesa 1, Fam2 na mesa 2 (família dividida); Bruno sem mesa
            a1={'t1-s1':'a','t1-s2':'f1','t2-s1':'f2'}
            await pg.evaluate(SEAT,a1); await pg.evaluate("window.__t.mesas.open(1); window.__t.mesas.go()"); await pg.wait_for_timeout(200)
            body = await pg.inner_text('body')
            ok('alergia' in body and 'acessibilidade' in body, f'[{name}] etiquetas de alergia/acessibilidade junto do convidado sentado')
            ok(await pg.locator('[data-logitable]').count()==1, f'[{name}] resumo da mesa aberta')
            ok((await pg.inner_text('[data-logitable]')).strip()=='1 alergia · 1 acessibilidade · 2 crianças', f'[{name}] resumo da mesa exato')
            hints = await pg.evaluate("[...document.querySelectorAll('[data-logihint]')].map(e=>e.textContent)")
            ok(any('Silva' in h and 'Mesa 1' in h and 'Mesa 2' in h for h in hints), f'[{name}] sugestão: família em mesas diferentes {hints}')
            ok(await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")==__import__('json').dumps(a1,separators=(',',':')), f'[{name}] distribuição das mesas intacta')
            # convidado com acessibilidade sem mesa
            await pg.evaluate(SEAT,{'t1-s1':'f1'}); await pg.evaluate("window.__t.mesas.go()"); await pg.wait_for_timeout(150)
            hints = await pg.evaluate("[...document.querySelectorAll('[data-logihint]')].map(e=>e.textContent)")
            ok(any('acessibilidade ainda sem mesa' in h for h in hints), f'[{name}] sugestão: acessibilidade sem mesa {hints}')
            ok(any('com crianças ainda sem mesa' in h for h in hints), f'[{name}] sugestão: famílias com crianças sem mesa')
            # seletor de lugar
            await pg.evaluate("window.__t.mesas.seat('t1-s2')"); await pg.wait_for_timeout(150)
            pk = await pg.inner_text('#seat-picker-list')
            ok('alergia' in pk and 'acessibilidade' in pk, f'[{name}] seletor de lugar mostra etiquetas')
            ok('marisco' not in pk and 'cadeira de rodas' not in pk, f'[{name}] etiquetas não revelam detalhes (só categoria)')
            ov = await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov, f'[{name}] sem overflow horizontal')
            await pg.evaluate("document.getElementById('seat-sheet').classList.remove('show'); document.getElementById('sheet-backdrop').classList.remove('show')")
            await pg.screenshot(path=str(SHOTS/f'logistica_mesas_{name}.png'))
            errs=[e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]
            ok(not errs, f'[{name}] sem erros JS {errs[:2]}')
            await pg.context.close()
        # sem respostas carregadas / sem dados: nada aparece
        pg = await newpage(b,390,844)
        await pg.evaluate(SEAT,{}); await pg.evaluate("window.__t.nt.setRsvp({},true); window.__t.mesas.go()")
        ok(await pg.locator('[data-logihint]').count()==0 and await pg.locator('.seat-tag').count()==0, 'sem dados de logística: mesas iguais a antes')
        # EN
        await pg.evaluate(SETUP); await pg.evaluate(SEAT,{'t1-s1':'a'}); await pg.evaluate("window.__t.lang('en'); window.__t.mesas.open(1); window.__t.mesas.go()"); await pg.wait_for_timeout(150)
        bd = await pg.inner_text('body')
        ok('allergy' in bd and 'accessibility' in bd, 'EN: etiquetas em inglês')
        await b.close()
    summary()
asyncio.run(main())
