from common import *
newpage = functools.partial(newpage, mode='bare')
import asyncio, json, re
PT=re.compile(r"\b(não|nao|para|você|ainda|então|está|estão|são|também|já|tens|tua|teu|teus|tuas|convidados?|casamento|noiv[oa]s?|erro|tenta|guardar|guardado|carregar|mensagem|preenche|obrigatório|inválid[oa]|secção|dados|aqui|quando|onde|porque|nenhum[a]?|mais|menos|desde|até|sem|com|uma?|dos|das|nos|nas|pelo|pela|seu|sua|vais|podes|queres|fazer|ver)\b|[áàâãéêíóôõúç]",re.I)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await newpage(b)
        tabs=['inicio','orcamento','convidados','gastos','mesas','inspiracao','checklist','vestido','bolo','votos','papelaria','todo','luademel','fornecedores','definicoes']
        await pg.evaluate("()=>{ const a=window.__a4; a.lang('en'); a.sub(true); }")
        for scenario in ['seed','corrupt']:
            for t in tabs:
                txt=await pg.evaluate("""([t,sc])=>{ const a=window.__a4; const s=a.seed(); if(sc==='corrupt'){ s.expenses='x'; s.todoCategories='x'; s.guests=null; s.seating=null; } a.state=sc==='corrupt'?a.san(JSON.parse(JSON.stringify(s))).state:s; a.go(t); a.render(); const el=document.querySelector('.tabpanel.active'); return el?el.innerText:''; }""",[t,scenario])
                lines=[l.strip() for l in txt.split('\n') if l.strip()]
                bad=[l for l in lines if PT.search(l)]
                print(f'{scenario}/{t}: {len(lines)} linhas, {len(bad)} suspeitas')
                for l in bad[:6]: print('    ',l[:110])
        await b.close()
asyncio.run(main())
