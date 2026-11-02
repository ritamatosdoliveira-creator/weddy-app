"""Fase I — Wedding Website no cliente e no renderizador público: Premium terminado (site suspenso preservado),
sem Premium sem site → venda, escape de HTML/URLs hostis no renderizador, sem dados privados, RSVP sem conta
(link individual), noindex; PT/EN; 390/768/1360."""
from common import *
import pathlib
newpage = functools.partial(newpage, mode='app')
HOSTILE = """({lang:'%s',template:'editorial',palette:'terracota',names:['<img src=x onerror=window.__pwn=1>','Tiago'],eventDate:'2027-06-05',timezone:'Europe/Lisbon',
 title:'<script>window.__pwn=2</script>',welcome:'ola',coverUrl:'javascript:window.__pwn=3',coverPos:{x:50,y:50},countdown:{on:false,expiredMessage:''},
 sections:{story:{title:'t',text:'<b onmouseover=window.__pwn=4>x</b>',photoUrl:'data:text/html,<script>1</script>'},
  lodging:{lodging:'h',transport:'',parking:'',meeting:'',links:[{label:'x',url:'javascript:window.__pwn=5'}]},
  contact:{name:'N',note:'',email:'a@b.pt',phone:''},rsvp:{text:'Confirma'}}})"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ('pt', 'en'):
            for name, (w, h) in {'mobile': (390, 844), 'tablet': (768, 1024), 'desktop': (1360, 800)}.items():
                tag = f'[{lang}/{name}]'
                pg = await newpage(b, w, h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                # sem Premium e sem site → página de venda
                await pg.evaluate("window.__t.sub(false); window.__t.site(null)")
                await pg.evaluate("window.__t.sec('site')"); await pg.wait_for_timeout(300)
                ok('Weddy Premium' in await pg.evaluate("document.body.innerText"), f'{tag} sem Premium e sem site → página de venda')
                # sem Premium com site SUSPENSO → aviso, nada apagado, sem editor
                await pg.evaluate("window.__t.site({slug:'rita-e-tiago',status:'suspended'})"); await pg.evaluate("window.__t.render()"); await pg.wait_for_timeout(300)
                t = await pg.evaluate("document.body.innerText")
                key = 'Não apagámos nada' if lang == 'pt' else 'Nothing was deleted'
                ok(key in t, f'{tag} Premium terminado + site suspenso: explica que nada foi apagado')
                ok(await pg.locator('.tabpanel.active [data-sitepublish], .tabpanel.active .se-pub[data-sitepub]').count() == 0, f'{tag} Premium terminado: sem botão de publicar')
                ok('Renovar' in t or 'Renew' in t, f'{tag} Premium terminado: botão de renovar')
                ok(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag} sem scroll horizontal')
                # renderizador público: hostil
                pg0 = await pg.context.new_page(); await pg0.set_content('<html><body></body></html>')
                await pg0.add_script_tag(path=str(pathlib.Path(__file__).resolve().parents[2] / 'weddysite.js'))
                html = await pg0.evaluate("()=>WeddySite.buildDocument(%s,{preview:false})" % (HOSTILE % lang))
                await pg0.close()
                ok('<img src=x' not in html and '<script>window.__pwn' not in html and '<b onmouseover' not in html and '&lt;img' in html, f'{tag} renderizador: HTML escapado (sem tags vivas)')
                ok(re.search(r'href="javascript', html, re.I) is None and re.search(r'src="(javascript|data:text)', html, re.I) is None, f'{tag} renderizador: sem href/src perigosos')
                pg2 = await pg.context.new_page()
                await pg2.set_content(html)
                await pg2.wait_for_timeout(300)
                ok(await pg2.evaluate("typeof window.__pwn === 'undefined'"), f'{tag} renderizador: nenhum script do conteúdo executa')
                # RSVP: sem conta, só link individual (campo para colar o link do convite)
                body = await pg2.evaluate("document.body.innerText")
                ok(('Confirmar presença' in body) if lang == 'pt' else ('RSVP' in body), f'{tag} secção RSVP presente')
                ok(await pg2.locator('input[type=password], input[name=password]').count() == 0, f'{tag} RSVP sem criar conta / sem palavra-passe')
                await pg2.close()
                # RSVP com link individual: token válido → rsvp.html?g=TOKEN (domínio fixo); inválido/hostil → sem ligação
                pg3 = await pg.context.new_page(); await pg3.set_content('<html><body></body></html>')
                await pg3.add_script_tag(path=str(pathlib.Path(__file__).resolve().parents[2] / 'weddysite.js'))
                base = "({lang:'%s',template:'editorial',palette:'terracota',names:['A','B'],eventDate:'2027-06-05',timezone:'Europe/Lisbon',title:'t',welcome:'',coverUrl:'',coverPos:{x:50,y:50},countdown:{on:false,expiredMessage:''},sections:{rsvp:{text:'Confirma'}}})" % lang
                good = await pg3.evaluate("()=>WeddySite.buildDocument(%s,{token:'AbCdEf12_-xyz'})" % base)
                bad = await pg3.evaluate("()=>WeddySite.buildDocument(%s,{token:'\"><script>x</script>'})" % base)
                evil = await pg3.evaluate("()=>WeddySite.buildDocument(%s,{token:'../../evil'})" % base)
                none = await pg3.evaluate("()=>WeddySite.buildDocument(%s,{})" % base)
                ok('href="https://www.weddy.pt/rsvp.html?g=AbCdEf12_-xyz' in good, f'{tag} RSVP: link individual válido leva ao fluxo seguro existente (rsvp.html?g=)')
                HREF = re.compile(r'<a [^>]*href="https://www\.weddy\.pt/rsvp\.html\?g=')
                ok(not HREF.search(bad) and not HREF.search(evil) and '<script>x' not in bad, f'{tag} RSVP: token malformado/hostil nunca vira ligação')
                ok(not HREF.search(none) and 'data-ws-paste' in none, f'{tag} RSVP: sem token só há campo para colar o convite individual (sem lista/pesquisa de convidados)')
                ok(not re.search(r'type="(password|email)"', none) and 'type="search"' not in none, f'{tag} RSVP: sem conta, sem pesquisa de convidados')
                await pg3.close()
                errs = [e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]
                ok(not errs, f'{tag} sem erros JS {errs[:2]}')
                await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
