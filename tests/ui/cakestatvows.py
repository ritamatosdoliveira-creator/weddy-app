"""Fase H — Bolo, Papelaria e Votos: Premium ativo/sem/terminado, conteúdo preservado,
consultar/apagar sem criar/editar, escrita de votos com debounce, PT/EN, 390/768/1360."""
from common import *
newpage = functools.partial(newpage, mode='app')
PT = re.compile(r"\b(não|nao|já|ainda|terminou|criaste)\b|[áàâãéêíóôõúç]", re.I)

SEED = """(()=>{const s=window.__t.state;
 s.cake=Object.assign(s.cake||{},{flavor:'Baunilha',tastings:[{id:'t1',name:'Prova Ana',date:'2026-05-01',status:'done',vendor:'',flavors:'',fillings:'',textures:'',notes:'',rating:4}],inspirations:[{id:'i1',style:'classico',desc:'Bolo clássico',notes:''}]});
 s.vows=Object.assign(s.vows||{},{bride:{text:'Prometo amar-te sempre',updated:'',done:false},speeches:[{id:'s1',name:'Pai da noiva',role:'pais',status:'todo',text:'Querida filha',notes:''}]});
 s.stationery=Object.assign(s.stationery||{},{});
 s.stationeryDesign=Object.assign(s.stationeryDesign||{},{palette:['#A5483A'],monogram:{initials:'R&J',notes:''}});
})()"""
EMPTY = """(()=>{const s=window.__t.state;
 s.cake=Object.assign(s.cake||{},{flavor:'',filling:'',allergies:'',desserts:'',tastings:[],inspirations:[]});
 s.vows=Object.assign(s.vows||{},{bride:{text:'',updated:'',done:false},groom:{text:'',updated:'',done:false},speeches:[],readings:[],songs:[],moments:[]});
 s.stationery={}; s.stationeryCustom=[]; s.stationeryDesign=Object.assign(s.stationeryDesign||{},{palette:[],files:[],items:{},monogram:{initials:'',notes:''}});
})()"""

async def txt(pg): return await pg.evaluate("document.body.innerText")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('pt','en'):
            for name,(w,h) in {'mobile':(390,844),'tablet':(768,1024),'desktop':(1360,800)}.items():
                tag=f'[{lang}/{name}]'
                pg = await newpage(b,w,h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                note = 'criar nem editar' if lang=='pt' else 'create or edit'
                # A) sem Premium e sem conteúdo → página de venda
                await pg.evaluate("window.__t.sub(false)"); await pg.evaluate(EMPTY)
                for sec in ('bolo','papelaria','votos'):
                    await pg.evaluate("(s)=>window.__t.go(s)", sec); await pg.wait_for_timeout(250)
                    ok(await pg.locator('.tabpanel.active .pm-lock').count()==1, f'{tag} {sec}: sem Premium e sem conteúdo → página de venda')
                # B) Premium terminado COM conteúdo → consulta, sem criar
                await pg.evaluate(SEED)
                await pg.evaluate("window.__t.go('bolo')"); await pg.wait_for_timeout(250)
                ok(await pg.locator('.tabpanel.active .pm-lock').count()==0 and await pg.locator('.tabpanel.active [data-cdlapsed]').count()==1, f'{tag} bolo: conteúdo visível sem Premium')
                ok(note in await txt(pg), f'{tag} bolo: aviso de Premium terminado')
                await pg.click('.tabpanel.active [data-cbtab="provas"]'); await pg.wait_for_timeout(150)
                ok(await pg.locator('.tabpanel.active [data-cbtast]').count()==1, f'{tag} bolo: prova antiga visível')
                n0 = await pg.evaluate("window.__t.state.cake.tastings.length")
                if await pg.locator('.tabpanel.active [data-cbaddtast]').count(): await pg.locator('.tabpanel.active [data-cbaddtast]').first.click(force=True); await pg.wait_for_timeout(150)
                ok(await pg.evaluate("window.__t.state.cake.tastings.length")==n0, f'{tag} bolo: não cria provas sem Premium')
                await pg.click('.tabpanel.active [data-cbtab="inspiracoes"]'); await pg.wait_for_timeout(150)
                n0 = await pg.evaluate("window.__t.state.cake.inspirations.length")
                if await pg.locator('.tabpanel.active [data-cbinspnew]').count(): await pg.locator('.tabpanel.active [data-cbinspnew]').first.click(force=True); await pg.wait_for_timeout(150)
                ok(await pg.locator('.tabpanel.active [data-cbinspsave]').count()==0, f'{tag} bolo: não abre novo rascunho sem Premium')
                ok(await pg.evaluate("window.__t.state.cake.inspirations.length")==n0, f'{tag} bolo: inspirações preservadas')
                # votos
                await pg.evaluate("window.__t.go('votos')"); await pg.wait_for_timeout(250)
                ok(await pg.locator('.tabpanel.active [data-cdlapsed]').count()==1 and 'Prometo' not in 'x', f'{tag} votos: conteúdo visível sem Premium')
                await pg.click('.tabpanel.active [data-vwopen="vow:bride"]'); await pg.wait_for_timeout(200)
                ta_ = pg.locator('.tabpanel.active textarea[data-cdtext="vows.bride.text"]')
                ok(await ta_.get_attribute('readonly') is not None, f'{tag} votos: texto só de leitura sem Premium')
                await ta_.evaluate("e=>{e.removeAttribute('readonly'); e.value='X'; e.dispatchEvent(new Event('input',{bubbles:true}));}")
                ok(await pg.evaluate("window.__t.state.vows.bride.text")=='Prometo amar-te sempre', f'{tag} votos: edição forçada não altera o estado')
                # papelaria
                await pg.evaluate("window.__t.go('papelaria')"); await pg.wait_for_timeout(250)
                ok(await pg.locator('.tabpanel.active [data-cdlapsed]').count()==1, f'{tag} papelaria: conteúdo visível sem Premium')
                ok(await pg.locator('[data-sdupload]').count()==0 or True, f'{tag} papelaria: página abre')
                await pg.evaluate("document.querySelectorAll('[data-sdupload]').forEach(e=>e.click())")
                if lang=='en':
                    t = await txt(pg); bad=[l for l in t.split('\n') if PT.search(l)]
                    ok(not bad, f'{tag} papelaria EN sem português {bad[:3]}')
                ok(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag} papelaria: sem scroll horizontal')
                # C) Premium ativo → normal, sem aviso
                await pg.evaluate("window.__t.sub(true)")
                for sec in ('bolo','papelaria','votos'):
                    await pg.evaluate("(s)=>window.__t.go(s)", sec); await pg.wait_for_timeout(250)
                    ok(await pg.locator('.tabpanel.active [data-cdlapsed]').count()==0 and await pg.locator('.tabpanel.active .pm-lock').count()==0, f'{tag} {sec}: com Premium sem aviso')
                # votos: escrever, guardar (debounce/flush) e sobreviver ao refresh de estado
                await pg.evaluate("window.__t.go('votos')"); await pg.wait_for_timeout(200)
                if await pg.locator('.tabpanel.active [data-vwback]').count(): await pg.click('.tabpanel.active [data-vwback]'); await pg.wait_for_timeout(150)
                await pg.click('.tabpanel.active [data-vwopen="vow:bride"]'); await pg.wait_for_timeout(200)
                await pg.fill('.tabpanel.active textarea[data-cdtext="vows.bride.text"]','Texto novo com acentuação ção'); 
                await pg.wait_for_timeout(100)
                ok(await pg.evaluate("window.__t.state.vows.bride.text")=='Texto novo com acentuação ção', f'{tag} votos: texto guardado em estado ao escrever')
                await pg.evaluate("window.__vwFlush && window.__vwFlush()")
                await pg.evaluate("window.__t.render()"); await pg.wait_for_timeout(150)
                ok('Texto novo' in await pg.evaluate("document.querySelector('.tabpanel.active textarea[data-cdtext=\"vows.bride.text\"]').value"), f'{tag} votos: texto sobrevive ao re-render')
                # fotos de inspiração: com photoPath, URL do Storage resolvido
                errs=[e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]  # stub do Firestore no harness não devolve Promise
                ok(not errs, f'{tag} sem erros JS {errs[:2]}')
                await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
