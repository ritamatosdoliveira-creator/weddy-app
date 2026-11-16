"""Premium terminado: Memories e Documentos continuam a mostrar o que já existe (ler/apagar),
com uma explicação clara; o que exige Premium (carregar/receber novo) fica indisponível.
PT+EN, mobile+desktop."""
from common import *
newpage = functools.partial(newpage, mode='app')
PT = re.compile(r"\b(não|nao|já|ainda|convidados?|fotos|terminou|documentos?)\b|[áàâãéêíóôõúç]", re.I)
DOC = "[{name:'Contrato.pdf',text:'abc def',storagePath:'documents/W/1_c.pdf'},{name:'Orcamento.pdf',text:'ghi'}]"
MEM = "[{id:'m1',token:'tokX',guestName:'Ana',storagePath:'memories/W/tokX/a.jpg',url:'data:image/gif;base64,R0lGODlhAQABAAAAACw='},{id:'m2',token:'publico',guestName:'',storagePath:'memories/W/publico/b.jpg',url:'data:image/gif;base64,R0lGODlhAQABAAAAACw='}]"

async def body(pg):
    return await pg.evaluate("document.body.innerText")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('pt', 'en'):
            for name, (w, h) in {'mobile': (390, 844), 'desktop': (1280, 800)}.items():
                tag = f'[{lang}/{name}]'
                pg = await newpage(b, w, h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                # --- Documentos, sem Premium, COM documentos antigos
                await pg.evaluate(f"window.__t.sub(false); window.__t.state.weddingDocuments={DOC}; window.__t.sec('documentos')")
                await pg.wait_for_timeout(300)
                t = await body(pg)
                ok('Contrato.pdf' in t and 'Orcamento.pdf' in t, f'{tag} documentos: lista antiga continua visível sem Premium')
                ok(await pg.locator('[data-docdel]').count() == 2, f'{tag} documentos: continua a ser possível apagar')
                ok(await pg.locator('#document-file-input').count() == 0, f'{tag} documentos: sem botão de carregar sem Premium')
                ok(await pg.locator('#lapsed-premium-btn').count() == 1, f'{tag} documentos: botão para ver o Premium')
                note = 'reativar o Premium' if lang == 'pt' else 'reactivate Premium'
                ok(note in t, f'{tag} documentos: explicação do bloqueio ({note!r})')
                if lang == 'en':
                    bad = [l for l in t.split('\n') if PT.search(l)]
                    ok(not bad, f'{tag} documentos: sem português {bad[:3]}')
                await pg.click('#lapsed-premium-btn'); await pg.wait_for_timeout(200)
                ok(await pg.evaluate("window.__t.section()") == 'subscricao', f'{tag} documentos: botão leva à página do Premium')
                # sem documentos antigos → página de venda (como antes)
                await pg.evaluate("window.__t.state.weddingDocuments=[]; window.__t.sec('documentos')"); await pg.wait_for_timeout(200)
                ok(await pg.locator('[data-docdel]').count() == 0 and await pg.locator('#document-file-input').count() == 0, f'{tag} documentos: sem nada guardado → página de venda')
                # com Premium → igual ao de sempre
                await pg.evaluate(f"window.__t.sub(true); window.__t.state.weddingDocuments={DOC}; window.__t.sec('documentos')"); await pg.wait_for_timeout(200)
                ok(await pg.locator('#document-file-input').count() == 1 and await pg.locator('#lapsed-premium-btn').count() == 0, f'{tag} documentos: com Premium há carregar e não há aviso')
                # --- Memories, sem Premium
                await pg.evaluate(f"window.__t.sub(false); window.__t.mem({MEM}); window.__t.sec('memories')"); await pg.wait_for_timeout(300)
                t = await body(pg)
                ok(await pg.locator('.memory-tile').count() == 2, f'{tag} memories: fotos antigas continuam visíveis sem Premium')
                ok(await pg.locator('#memories-public-link-btn').count() == 0 and await pg.locator('#memories-qr-btn').count() == 0, f'{tag} memories: link/QR de envio escondidos (já não funcionam)')
                ok(await pg.locator('#memories-refresh').count() == 1, f'{tag} memories: atualizar continua disponível')
                note = 'já não conseguem enviar novas fotos' if lang == 'pt' else 'can no longer send new photos'
                ok(note in t, f'{tag} memories: explicação do bloqueio ({note!r})')
                if lang == 'en':
                    bad = [l for l in t.split('\n') if PT.search(l)]
                    ok(not bad, f'{tag} memories: sem português {bad[:3]}')
                ok(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag} memories: sem scroll horizontal')
                await pg.click('#lapsed-premium-btn'); await pg.wait_for_timeout(200)
                ok(await pg.evaluate("window.__t.section()") == 'subscricao', f'{tag} memories: botão leva à página do Premium')
                await pg.evaluate("window.__t.mem([]); window.__t.sec('memories')"); await pg.wait_for_timeout(200)
                ok(await pg.locator('.memory-tile').count() == 0 and await pg.locator('#memories-refresh').count() == 0, f'{tag} memories: sem fotos e sem Premium → página de venda')
                await pg.evaluate(f"window.__t.sub(true); window.__t.mem({MEM}); window.__t.sec('memories')"); await pg.wait_for_timeout(200)
                ok(await pg.locator('#memories-public-link-btn').count() == 1 and await pg.locator('#lapsed-premium-btn').count() == 0, f'{tag} memories: com Premium há link/QR e não há aviso')
                ok(not pg.errs, f'{tag} sem erros JS {pg.errs[:2]}')
                await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
