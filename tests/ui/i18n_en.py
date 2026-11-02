"""Inglês sem português esquecido (desktop + mobile).
- paridade das chaves APP_I18N pt/en da app real;
- todos os separadores em EN, com dados de origem e com estado corrompido (recuperação), sem linhas com PT;
- mensagens de erro/validação/recuperação em EN.
Texto semeado (categorias/listas por defeito guardadas nos dados do utilizador) é ignorado: ver docs/seguranca/A4-robustez.md."""
from common import *
newpage = functools.partial(newpage, mode='bare')
PT = re.compile(r"\b(não|nao|você|ainda|então|está|estão|são|também|já|tens|tua|teu|convidados?|casamento|noiv[oa]s?|erro|tenta|guardar|guardado|carregar|mensagem|preenche|obrigatório|inválid[oa]|secção|dados|aqui|quando|onde|porque|nenhum[a]?|desde|até|vais|podes|queres|fazer)\b|[áàâãéêíóôõúç]", re.I)
TABS = ['inicio','orcamento','convidados','gastos','mesas','inspiracao','checklist','vestido','bolo','votos','papelaria','todo','luademel','fornecedores','definicoes']

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b)
        par = await pg.evaluate("""()=>{ const i=window.__a4.i18n; const a=Object.keys(i.pt), e=new Set(Object.keys(i.en)); return {n:a.length, missing:a.filter(k=>!e.has(k)), extra:Object.keys(i.en).filter(k=>!(k in i.pt))}; }""")
        ok(par['n'] > 1000 and not par['missing'] and not par['extra'], f"paridade APP_I18N pt/en ({par['n']} chaves) missing={par['missing'][:5]} extra={par['extra'][:5]}")
        await pg.context.close()
        for name, (w, h) in {'mobile': (390, 844), 'desktop': (1360, 900)}.items():
            pg = await newpage(b, w, h)
            await pg.evaluate("()=>{ const a=window.__a4; a.lang('en'); a.sub(true); }")
            seedtxt = await pg.evaluate("""()=>{ const out=[]; (function w(v){ if(typeof v==='string'){ if(v.length>=3) out.push(v.toLowerCase()); } else if(Array.isArray(v)) v.forEach(w); else if(v&&typeof v==='object') Object.keys(v).forEach(k=>w(v[k])); })(window.__a4.seed()); return out; }""")
            seeds = sorted(set(seedtxt), key=len, reverse=True)
            for scenario in ['seed', 'corrupt']:
                bad_all = []
                for t in TABS:
                    txt = await pg.evaluate("""([t,sc])=>{ const a=window.__a4; const s=a.seed(); if(sc==='corrupt'){ s.expenses='x'; s.todoCategories='x'; s.guests=null; s.seating=null; } a.state=sc==='corrupt'?a.san(JSON.parse(JSON.stringify(s))).state:s; a.go(t); a.render(); const el=document.querySelector('.tabpanel.active'); return el?el.innerText:''; }""", [t, scenario])
                    lines = [l.strip() for l in txt.split('\n') if l.strip()]
                    for l in lines:
                        if PT.search(l) and not any(s in l.lower() for s in seeds):
                            bad_all.append(f'{t}: {l[:100]}')
                ok(not bad_all, f'[{name}] {scenario}: sem texto PT nos separadores EN {bad_all[:4]}')
            # vista de recuperação (erro numa vista): texto em EN
            r = await pg.evaluate("""()=>{ const a=window.__a4; a.lang('en'); return [a.T('viewErrTitle'), a.T('viewErrBody'), a.T('viewErrRetry')]; }""")
            ok(all(x and not PT.search(x) for x in r), f'[{name}] mensagens de recuperação em EN {r}')
            await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
