"""Android — campos de dinheiro aceitam vírgula (telemóvel em inglês) e botões pequenos têm área de toque ≥44px.

Bug (Nov 2026, Chrome Android 149 com o sistema em inglês): num <input type=number> o Chrome apagava a
vírgula do teclado decimal, por isso «12,5» ficava gravado como 125.
"""
from common import *

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b, 412, 915)
        await pg.evaluate("window.__t.go('gastos')")
        await pg.wait_for_timeout(200)
        nums = await pg.evaluate("[...document.querySelectorAll('input[inputmode=decimal]')].filter(i=>i.type==='number').length")
        ok(nums == 0, f'nenhum campo de dinheiro continua type=number ({nums})')
        tags = await pg.evaluate("document.querySelectorAll('#sf-value[data-num], #sf-paid[data-num]').length")
        ok(tags == 2, 'Valor total e Já pago são campos data-num')
        # escrever tecla a tecla (como o teclado), com vírgula
        # campo com o mesmo comportamento (data-num) visível, para escrever tecla a tecla
        await pg.evaluate("(()=>{ const i=document.createElement('input'); i.type='text'; i.inputMode='decimal'; i.setAttribute('data-num',''); i.id='tnum'; i.style.cssText='position:fixed;top:10px;left:10px;z-index:99999'; document.body.appendChild(i); })()")
        await pg.focus('#tnum')
        await pg.keyboard.type('12,5')
        v = await pg.evaluate("document.getElementById('tnum').value")
        ok(v == '12.5', f'«12,5» fica 12.5 (não 125): {v!r}')
        await pg.evaluate("document.getElementById('tnum').value=''")
        await pg.keyboard.type('1.234,56')
        v2 = await pg.evaluate("document.getElementById('tnum').value")
        ok(v2 in ('1.23456', '1.234'), f'só um separador decimal fica: {v2!r}')
        await pg.evaluate("document.getElementById('tnum').value=''")
        await pg.keyboard.type('-50')
        v3 = await pg.evaluate("document.getElementById('tnum').value")
        ok(v3 == '-50', f'«-» inicial mantém-se para a validação recusar: {v3!r}')
        await pg.evaluate("document.getElementById('tnum').value=''")
        await pg.keyboard.type('3 600 €')
        v4 = await pg.evaluate("document.getElementById('tnum').value")
        ok(v4 == '3600', f'espaços e € são removidos: {v4!r}')
        # campos de texto livre com inputmode decimal (Compare, bolo) não são tocados
        free = await pg.evaluate("""(()=>{ const i=document.createElement('input'); i.type='text'; i.inputMode='decimal'; document.body.appendChild(i); i.focus(); return i; })() && true""")
        await pg.keyboard.type('a combinar')
        v5 = await pg.evaluate("document.activeElement.value")
        ok(v5 == 'a combinar', f'campos de texto livre sem data-num ficam intactos: {v5!r}')
        # área de toque
        await pg.evaluate("window.__t.go('inicio')")
        await pg.wait_for_timeout(300)
        hit = await pg.evaluate("""(()=>{ const out={};
          const area = el => { const r=el.getBoundingClientRect(); const a=getComputedStyle(el,'::after'); const ins = a.content && a.content!=='none' ? -parseFloat(a.top||0) : 0; return Math.round(Math.min(r.width,r.height) + 2*ins); };
          const q = s => document.querySelector('.tabpanel.active '+s);
          for (const [k,s] of [['bell','.home-icon-btn'],['del','.timeline-del'],['add','.nav-action']]) { const e=q(s); out[k]= e? area(e): null; }
          return out; })()""")
        ok(all(v is None or v >= 44 for v in hit.values()) and hit.get('bell'), f'área de toque ≥44px nos botões pequenos {hit}')
        # o toque na zona alargada chega ao botão (✕ do momento)
        hitTest = await pg.evaluate("""(()=>{ const d=document.querySelector('.tabpanel.active .timeline-del'); if(!d) return 'sem ✕'; d.scrollIntoView({block:'center'}); const r=d.getBoundingClientRect(); const el=document.elementFromPoint(r.left-8, r.top+r.height/2); return el===d || d.contains(el); })()""")
        ok(hitTest is True or hitTest == 'sem ✕', f'tocar 8px ao lado do ✕ ainda acerta no ✕ ({hitTest})')
        ok(not pg.errs, f'sem erros {pg.errs[:3]}')
        await b.close()
    summary()

asyncio.run(main())
