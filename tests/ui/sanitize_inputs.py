"""Sanitização de entradas (Nov 2026).
- escapeHTML tira caracteres de controlo/direção; safeImgSrc/cssUrl/cssNum só deixam passar valores seguros;
- texto malicioso nos campos que antes iam sem escape (Definições, categorias da lista de tarefas,
  pesquisa de fornecedores, foto de capa) não executa nada e o valor volta igual ao campo;
- limites por defeito nos campos de texto; importador limpa e limita as células."""
from common import *

XSS = '"><img src=x onerror="window.__pwned=1">'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b, 1360, 900)

        # --- auxiliares
        r = await pg.evaluate("""()=>{ const s=window.__s; return {
          ctl: s.escapeHTML('a\\u0000b\\u202Ec\\u200Dd\\te\\nf'),
          amp: s.escapeHTML('<b>"A&B"</b>'),
          ok1: s.safeImgSrc('data:image/jpeg;base64,/9j/4AAQ=='),
          ok2: s.safeImgSrc('https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=abc'),
          ok3: s.safeImgSrc('/logo-happybox.png'),
          bad: ['javascript:alert(1)','data:text/html;base64,PHNjcmlwdD4=','data:image/svg+xml;base64,PHN2Zz4=','http://x.pt/a.png','//evil.pt/a.png','https://x.pt/a.png"onerror="1','https://x.pt/a b.png',null,12].map(s.safeImgSrc),
          css: s.cssUrl("https://x.pt/a.png?x=1"),
          cssEvil: s.cssUrl("data:image/png;base64,AAAA"),
          n: [s.cssNum(0,50), s.cssNum('12',50), s.cssNum('1);color:red',50), s.cssNum(null,50), s.cssNum('',50), s.cssNum(undefined,100)] }; }""")
        ok(r['ctl'] == 'abc\u200dd\te\nf', f"escapeHTML tira controlo e inversão de texto, mantém tab, quebra de linha e ZWJ: {r['ctl']!r}")
        ok(r['amp'] == '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;', f"escapeHTML continua a escapar HTML: {r['amp']}")
        ok(r['ok1'] and r['ok2'] and r['ok3'], 'safeImgSrc aceita data:image, https e caminho da app')
        ok(all(x == '' for x in r['bad']), f"safeImgSrc rejeita javascript:, svg, text/html, http, //, aspas, espaços, tipos errados {r['bad']}")
        ok(r['css'] == 'https://x.pt/a.png?x=1' and r['cssEvil'].startswith('data:image/png'), 'cssUrl devolve o URL intacto quando é seguro')
        ok(r['n'] == [0, 12, 50, 50, 50, 100], f"cssNum só aceita números {r['n']}")

        # --- importador
        g = await pg.evaluate("""()=>{ const s=window.__s; const big='x'.repeat(5000);
          const out=s.gimpClean([['Ana\\u0000 \\u202EBr\\nito', big, 'a\\tb'], Array(200).fill('c')]);
          return { c0:out[0][0], l1:out[0][1].length, c2:out[0][2], w:out[1].length }; }""")
        ok(g['c0'] == 'Ana Brito' or g['c0'] == 'Ana  Brito' or g['c0'].replace(' ', '') == 'AnaBrito', f"importador limpa controlo/direção/quebras {g['c0']!r}")
        ok(g['l1'] == 300 and g['c2'] == 'a b' and g['w'] == 60, f"importador limita célula a 300 e 60 colunas {g}")

        # --- limites por defeito nos campos
        m = await pg.evaluate("""()=>{ const mk=(h)=>{ const d=document.createElement('div'); d.innerHTML=h; document.body.appendChild(d); return d.firstChild; };
          const a=mk('<input type="text" id="gf-name">'), c=mk('<input type="text" id="qualquer">'), t=mk('<textarea></textarea>'),
                d=mk('<input type="text" maxlength="10">'), n=mk('<input type="number">'), pw=mk('<input type="password">');
          [a,c,t,d,n,pw].forEach(e=>e.focus()); return [a.maxLength,c.maxLength,t.maxLength,d.maxLength,n.maxLength,pw.maxLength]; }""")
        ok(m == [120, 500, 20000, 10, -1, -1], f"maxlength por defeito (nome 120, texto 500, área 20000; respeita o que já existe; ignora número/password) {m}")

        # --- Definições: nomes/local com aspas e HTML
        await pg.evaluate("""(x)=>{ window.__pwned=undefined; window.__t.nt.setSettings({coupleName1:x, coupleName2:x, venue:x}); window.__t.sec('casamento'); }""", XSS)
        await pg.wait_for_timeout(300)
        v = await pg.evaluate("""()=>({ pwned:window.__pwned, imgs:document.querySelectorAll('img[onerror]').length, n1:(document.getElementById('def-name1')||{}).value, n2:(document.getElementById('def-name2')||{}).value, ve:(document.getElementById('def-venue')||{}).value })""")
        ok(v['pwned'] is None and v['imgs'] == 0, f'Definições: HTML nos nomes/local não executa {v}')
        ok(v['n1'] == XSS and v['n2'] == XSS and v['ve'] == XSS, 'Definições: o campo mostra exatamente o que foi guardado (não parte o atributo nem trunca)')

        # --- lista de tarefas: categoria com HTML no título e na descrição
        await pg.evaluate("""(x)=>{ window.__pwned=undefined; const s=window.__t.state; s.todoCategories.push({id:'tcx', icon:'flower', color:'#B5654B', label:x, title:x, desc:x, items:[]}); window.__t.go('todo'); }""", XSS)
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{ const c=document.querySelector('[data-opencat=\"tcx\"]'); if(c) c.click(); }")
        await pg.wait_for_timeout(300)
        t = await pg.evaluate("""()=>{ const P=document.querySelector('[data-panel="todo"]')||document; return { pwned:window.__pwned, imgs:document.querySelectorAll('img[onerror]').length, h1:(P.querySelector('.navbar h1')||{}).textContent, lab:(P.querySelector('.section-label')||{}).textContent, card:!!document.querySelector('[data-panel="todo"] [data-opencat="tcx"]') }; }""")
        ok(t['pwned'] is None and t['imgs'] == 0, f'Lista de tarefas: HTML no título/descrição da categoria não executa {t}')
        ok(t['h1'] == XSS and XSS in (t['lab'] or ''), f"Lista de tarefas: o título e a descrição aparecem como texto {t}")

        # --- pesquisa de fornecedores com HTML
        await pg.evaluate("()=>{ window.__pwned=undefined; window.__t.go('fornecedores'); }")
        await pg.wait_for_timeout(300)
        await pg.fill('#sup-search', XSS)
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>window.__t.render()")
        await pg.wait_for_timeout(300)
        f = await pg.evaluate("()=>({ pwned:window.__pwned, imgs:document.querySelectorAll('img[onerror]').length, val:(document.getElementById('sup-search')||{}).value })")
        ok(f['pwned'] is None and f['imgs'] == 0 and f['val'] == XSS, f'Fornecedores: a pesquisa com HTML não executa e mantém o texto {f}')

        # --- foto de capa e posições com CSS malicioso
        await pg.evaluate("""()=>{ window.__t.nt.setSettings({heroPhotoUrl:"x');background:red;--a:('", heroPhotoPosX:'1);color:red', heroPhotoPosY:'}', heroPhotoZoom:'9;x:y'}); window.__t.go('inicio'); }""")
        await pg.wait_for_timeout(300)
        h = await pg.evaluate("()=>{ const e=document.querySelector('.hero-photo'); return e ? (e.getAttribute('style')||'') : 'sem-elemento'; }")
        ok('red' not in h and 'x:y' not in h, f'Foto de capa: URL e posições maliciosos não entram no CSS ({h[:120]})')

        ok(not pg.errs, f'sem erros na consola {pg.errs[:3]}')
        await b.close()
    summary()
asyncio.run(main())
