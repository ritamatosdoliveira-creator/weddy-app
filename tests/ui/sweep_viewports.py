"""Fase K — varrimento transversal: secções principais × 390/768/1360 × PT/EN. Verifica: sem erros de página/consola,
sem scroll horizontal da página, texto visível não vazio, imagens sem 'undefined'/'[object' no texto, sem pedidos
externos (rede bloqueada pelo harness). Dados fictícios; sem rede."""
from common import *
newpage = functools.partial(newpage, mode='app')
TABS = ['inicio','orcamento','convidados','gastos','mesas','inspiracao','checklist','vestido','bolo','votos','papelaria','todo','luademel','fornecedores']
SECS = ['documentos','memories','site','googlecalendar','rsvp','subscricao']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('pt','en'):
            for name,(w,h) in {'mobile':(390,844),'tablet':(768,1024),'desktop':(1360,800)}.items():
                pg = await newpage(b,w,h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                for t in TABS:
                    await pg.evaluate("(s)=>window.__t.go(s)", t); await pg.wait_for_timeout(200)
                    await check(pg, f'[{lang}/{name}] {t}', w)
                for s in SECS:
                    await pg.evaluate("(s)=>window.__t.sec(s)", s); await pg.wait_for_timeout(200)
                    await check(pg, f'[{lang}/{name}] definições/{s}', w)
                ok(not pg.errs, f'[{lang}/{name}] sem erros de página/consola ({pg.errs[:2]})')
                await pg.context.close()
        await b.close()
async def check(pg, tag, w):
    ov = await pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    ok(ov <= 1, f'{tag}: sem scroll horizontal (excesso {ov}px)')
    t = await pg.evaluate("document.querySelector('.tabpanel.active') ? document.querySelector('.tabpanel.active').innerText : ''")
    ok(len(t.strip()) > 20, f'{tag}: conteúdo visível')
    ok('undefined' not in t and '[object' not in t and 'NaN' not in t, f'{tag}: sem undefined/NaN/[object] no texto')
asyncio.run(main()); summary()
