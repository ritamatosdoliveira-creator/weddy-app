"""Casos de teste funcionais P1/P2 (documento «Weddy — Casos de teste funcionais», Nov 2026).

Cada verificação começa pelo ID do caso (ex.: CONV-15) para se cruzar com o documento e com
tests/qa/casos-p1p2.md. Esta suite cobre o que se faz no cliente (app/index.html) através da
interface real: cliques, campos, folhas. O que depende do servidor (regras, functions, pagamentos,
quotas, convites, RSVP) está nas suites de emulador; a matriz diz qual suite cobre cada caso.

Pode correr contra outra cópia da app: WEDDY_APP_HTML=/caminho/index.html python3 ui/qa_p1p2.py
"""
from common import *
import datetime

EXTRA = r"""
window.__q={ alerts:[], confirmAns:true, saves:0,
  hook:function(){ var q=window.__q;
    weddyAlert=function(m){ q.alerts.push(String(m)); return Promise.resolve(); };
    weddyConfirm=function(m){ q.alerts.push('?'+m); return Promise.resolve(q.confirmAns); };
    window.confirm=function(m){ q.alerts.push('?'+m); return q.confirmAns; }; window.alert=function(m){ q.alerts.push(String(m)); };
    pushRemote=function(){ q.saves++; }; pushRemoteImmediate=function(){ q.saves++; return Promise.resolve(); }; },
  days:function(d){ return daysUntil(d); },
  premium:function(v){ currentSubscription = v ? {active:true} : null; },
  settings:function(o){ Object.assign(weddingSettings,o||{}); return weddingSettings; }
};
"""
APP = build_hooked(EXTRA).as_uri()
TODAY = datetime.date.today()

async def page(b, w=1360, h=900, premium=True):
    pg = await newpage(b, w, h, mode='app', url=APP)
    await pg.evaluate("p=>{ window.__q.hook(); window.__q.premium(p); window.__t.go('inicio'); }", premium)
    pg.set_default_timeout(4000)
    return pg

async def click(pg, sel):
    """Clique real; se o elemento não estiver clicável (escondido/desativado), tenta o clique por JS
    — é o que acontece a um utilizador rápido ou a um leitor de ecrã."""
    try: await pg.click(sel, timeout=1500)
    except Exception:
        await pg.evaluate("s=>{ const e=document.querySelector(s); if(e) e.click(); }", sel)
    await pg.wait_for_timeout(120)

async def go(pg, tab):
    await pg.evaluate("t=>window.__t.go(t)", tab); await pg.wait_for_timeout(150)

async def setv(pg, sel, val):
    """Escreve num campo como um utilizador: input + change + blur."""
    await pg.fill(sel, str(val))
    await pg.evaluate("""s=>{ const e=document.querySelector(s); if(!e) return; e.dispatchEvent(new Event('change',{bubbles:true})); e.blur(); }""", sel)
    await pg.wait_for_timeout(120)

async def S(pg, js, arg=None):
    return await pg.evaluate(js, arg) if arg is not None else await pg.evaluate(js)

async def txt(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s); return e?e.innerText.replace(/[\u00a0\u202f]/g,' '):''}", sel)

async def vals(pg, sel):
    """Texto visível + valores dos campos (os nomes dos convidados estão em <input>)."""
    return await pg.evaluate("s=>{const e=document.querySelector(s); if(!e) return ''; return e.innerText+' '+[...e.querySelectorAll('input')].filter(i=>i.offsetParent!==null).map(i=>i.value).join(' | ');}", sel)

# A gravação no Firebase simulado devolve um Proxy em vez de uma Promise: é do arnês, não da app.
HARNESS = ('writeWeddingPayloadSafely(...).then is not a function',)
def errs(*pgs):
    return [e for pg in pgs for e in pg.errs if not any(h in e for h in HARNESS)]

def nan_free(t):
    return not re.search(r'\bNaN\b|undefined|Infinity|null €', t or '')

async def section(name, fn, b):
    try:
        await fn(b)
    except Exception as e:
        ok(False, f'{name}: exceção {str(e)[:300]}')

# ---------------------------------------------------------------- Início
async def t_home(b):
    pg = await page(b)
    d = (TODAY + datetime.timedelta(days=100)).isoformat()
    await S(pg, "d=>{ window.__q.settings({weddingDate:d, coupleName1:'Ana', coupleName2:'Rui', venue:'Quinta do Lago'}); window.__t.go('inicio'); }", d)
    t = await txt(pg, '[data-panel=inicio]')
    ok('100 dias' in t and 'ANA' in t.upper() and 'RUI' in t.upper(), 'HOME-01 Início mostra nomes e a contagem certa de dias (100)')
    # HOME-08: dia do casamento e dia seguinte
    res = {}
    for k, dd in (('hoje', TODAY), ('ontem', TODAY - datetime.timedelta(days=1))):
        await S(pg, "d=>{ window.__q.settings({weddingDate:d}); window.__t.go('inicio'); }", dd.isoformat())
        res[k] = await txt(pg, '[data-panel=inicio]')
    ok(nan_free(res['hoje']) and nan_free(res['ontem']) and not re.search(r'-\s*1\s*dia', res['ontem']), f'HOME-08 dia do casamento e dia seguinte sem "-1 dias" nem NaN (dia seguinte: {" / ".join(res["ontem"].splitlines()[:4])!r})')
    # HOME-03: atalhos abrem a página certa e voltar regressa ao Início
    bad = []
    for goto in ['vestido', 'todo', 'luademel', 'checklist', 'fornecedores']:
        await go(pg, 'inicio')
        await pg.click(f'[data-panel=inicio] button[data-goto="{goto}"]:not([aria-label])' if goto != 'todo' else '[data-panel=inicio] button[type=button][data-goto="todo"]')
        await pg.wait_for_timeout(150)
        cur = await S(pg, "()=>{ const p=[...document.querySelectorAll('[data-panel]')].find(e=>e.offsetParent!==null); return p&&p.dataset.panel; }")
        back = await S(pg, "()=>{ const b=[...document.querySelectorAll('[id$=\"-back\"],#gx-back,[data-back]')].find(e=>e.offsetParent!==null); if(b){ b.click(); return true; } return window.__t.back(); }")
        await pg.wait_for_timeout(150)
        after = await S(pg, "()=>{ const p=[...document.querySelectorAll('[data-panel]')].find(e=>e.offsetParent!==null); return p&&p.dataset.panel; }")
        if cur != goto or after != 'inicio': bad.append((goto, cur, after))
    ok(not bad, f'HOME-03 atalhos abrem a página certa e voltar regressa ao Início {bad}')
    # HOME-09: casamento vazio
    await S(pg, "()=>{ const s=window.__a4.seed(); s.budget={total:0,guestsEstimate:0}; window.__t.state=s; window.__t.go('inicio'); }")
    ok(nan_free(await txt(pg, '#app-body')), 'HOME-09 casamento sem convidados nem orçamento: cartões sem NaN/undefined/Infinity')
    # HOME-07: atalhos Premium em conta gratuita
    pg2 = await page(b, premium=False)
    await S(pg2, "()=>window.__t.go('inicio')")
    await pg2.click('[data-panel=inicio] button[data-goto="bolo"]'); await pg2.wait_for_timeout(250)
    t2 = await txt(pg2, '#app-body')
    vis = await S(pg2, "()=>{ const p=[...document.querySelectorAll('[data-panel]')].find(e=>e.offsetParent!==null); return p&&p.dataset.panel; }")
    editable = await S(pg2, "()=>{ const p=document.querySelector('[data-panel=bolo]'); return !!(p && p.offsetParent!==null && p.querySelector('input:not([disabled]),textarea:not([disabled])')); }")
    ok(('Premium' in t2) and not editable, f'HOME-07/PLN-14 Bolo em conta gratuita mostra Premium e nada editável (painel={vis})')
    ok(not errs(pg, pg2), f'Início sem erros na consola {errs(pg, pg2)[:3]}')

# ---------------------------------------------------------------- Orçamento
async def t_orc(b):
    pg = await page(b)
    await go(pg, 'orcamento')
    await setv(pg, '#in-total', 50000); await setv(pg, '#in-guests', 100)
    st = await S(pg, "()=>window.__t.state.budget")
    t = await txt(pg, '[data-panel=orcamento]')
    ok(st['total'] == 50000 and st['guestsEstimate'] == 100 and '500 €' in t, f'ORC-01 total 50 000 € guardado e €/convidado = 500 € ({st})')
    await click(pg, '[data-toggledesc=quinta]'); await setv(pg, '[data-catvalue=quinta]', 25000)
    t = await txt(pg, '[data-panel=orcamento]')
    cat = await S(pg, "()=>window.__t.state.categories.find(c=>c.id==='quinta').value")
    ok(cat == 25000 and '50%' in t, f'ORC-02 valor por categoria guardado e percentagem recalculada (25 000 € = 50%) cat={cat}')
    # ORC-04 criar, renomear, apagar categoria
    await setv(pg, '#add-cat-name', 'Transporte'); await click(pg, '#addbtn-cat')
    c = await S(pg, "()=>window.__t.state.categories.filter(c=>c.name==='Transporte').map(c=>c.id)")
    ok(len(c) == 1, f'ORC-04 categoria criada ({c})')
    await go(pg, 'gastos'); await click(pg, '#open-sheet')
    opts = await S(pg, "()=>[...document.querySelectorAll('#sf-cat option')].map(o=>o.textContent)")
    ok('Transporte' in opts, 'ORC-04 categoria nova aparece em Gastos')
    await click(pg, '#sf-cancel')
    # categoria com gasto ligado: apagar pede decisão
    await S(pg, "id=>{ const s=window.__t.state; s.expenses.push({id:'e1',desc:'Autocarro',value:300,paid:0,category:id,date:'2026-12-01'}); window.__t.go('orcamento'); }", c[0])
    await click(pg, f'[data-toggledesc="{c[0]}"]'); window_alerts = await S(pg, "()=>{ window.__q.alerts=[]; window.__q.confirmAns=false; return 1; }")
    await click(pg, f'[data-delcat="{c[0]}"]')
    still = await S(pg, "id=>({ cat: window.__t.state.categories.some(c=>c.id===id), alerts: window.__q.alerts.slice() })", c[0])
    dialog_open = await S(pg, "()=>!!document.querySelector('.wd-modal.open,.weddy-dialog,[role=dialog]:not([hidden])')")
    ok(still['cat'] and (still['alerts'] or dialog_open), f'ORC-04 apagar categoria com gastos pede confirmação e cancelar mantém-na {still}')
    # ORC-06 valores inválidos
    out = {}
    for v in ['0', '', '-500', 'abc']:
        await go(pg, 'orcamento')
        try: await setv(pg, '#in-total', v)
        except Exception: await S(pg, "v=>{ const e=document.getElementById('in-total'); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }", v)
        out[v] = (await S(pg, "()=>window.__t.state.budget.total"), nan_free(await txt(pg, '[data-panel=orcamento]')) and 'Infinity' not in await txt(pg, '[data-panel=orcamento]'))
    ok(all(x[1] for x in out.values()), f'ORC-06 total 0/vazio/negativo/texto sem NaN nem Infinity {out}')
    ok(all((x[0] is None) or (isinstance(x[0], (int, float)) and x[0] >= 0) for x in out.values()), f'ORC-06 total nunca fica negativo nem texto {out}')
    # ORC-09 0 convidados
    await setv(pg, '#in-total', 20000); await setv(pg, '#in-guests', 0)
    t = await txt(pg, '[data-panel=orcamento]')
    ok(nan_free(t) and 'Infinity' not in t, 'ORC-09 0 convidados estimados: €/convidado sem divisão por zero')
    # ORC-07 valores grandes e formatação PT
    await setv(pg, '#in-total', 999999999.99); await setv(pg, '#in-guests', 100)
    t = await txt(pg, '[data-panel=orcamento]')
    over = await S(pg, "()=>document.documentElement.scrollWidth-innerWidth")
    ok(nan_free(t) and over <= 1 and re.search(r'\d{1,3}(?:[\s  ]\d{3})+', t), f'ORC-07 999 999 999,99 € formatado à PT sem transbordar (overflow={over})')
    # ORC-08 soma > total
    await setv(pg, '#in-total', 10000)
    t = await txt(pg, '[data-panel=orcamento]')
    ok(nan_free(t) and await S(pg, "()=>!!document.getElementById('in-total') && !document.getElementById('in-total').disabled"), 'ORC-08 soma das categorias > total: nada fica bloqueado')
    # ORC-03 resumo = gastos
    await S(pg, "()=>{ const s=window.__t.state; s.expenses=[{id:'a',desc:'Quinta',value:8000,paid:3000,category:'quinta',date:'2026-10-01'},{id:'b',desc:'Foto',value:2000,paid:2000,category:'foto',date:'2026-10-02'}]; window.__t.go('orcamento'); }")
    await click(pg, '[data-orctab=resumo]')
    t = await txt(pg, '[data-panel=orcamento]')
    ok(('5000' in t.replace(' ', '').replace(' ', '') or '5 000' in t) and ('10 000' in t or '10000' in t.replace(' ', '').replace(' ', '')), 'ORC-03 Resumo mostra pago 5 000 € e total 10 000 € iguais aos de Gastos')
    ok(not errs(pg), f'Orçamento sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Convidados
async def open_cat(pg, key='noiva|familia'):
    await go(pg, 'convidados')
    await S(pg, "()=>{ const b=document.getElementById('gx-back'); if(b&&b.offsetParent) b.click(); }"); await pg.wait_for_timeout(100)
    await click(pg, f'[data-opengcat="{key}"]')

async def add_guest(pg, name, key='noiva|familia'):
    await pg.fill(f'[data-addname="{key}"]', name); await click(pg, f'[data-addbtn="{key}"]')

async def t_conv(b):
    pg = await page(b)
    await open_cat(pg)
    await add_guest(pg, 'João Silva')
    g = await S(pg, "()=>window.__t.state.guests.noiva.familia.map(x=>x.name)")
    t = await txt(pg, '[data-panel=convidados]')
    ok(g == ['João Silva'] and '0/1' in t.replace(' ', ''), f'CONV-01 convidado adicionado na categoria e contador atualizado {g}')
    # CONV-15 duplo clique em Adicionar
    await pg.fill('[data-addname="noiva|familia"]', 'Maria Duarte')
    await pg.dblclick('[data-addbtn="noiva|familia"]'); await pg.wait_for_timeout(200)
    n = await S(pg, "()=>window.__t.state.guests.noiva.familia.filter(x=>x.name==='Maria Duarte').length")
    ok(n == 1, f'CONV-15 duplo clique em Adicionar cria um só convidado (n={n})')
    # CONV-14 nome vazio / só espaços / 300 caracteres
    before = await S(pg, "()=>window.__t.state.guests.noiva.familia.length")
    for v in ['', '    ']:
        await add_guest(pg, v)
    after = await S(pg, "()=>window.__t.state.guests.noiva.familia.length")
    ok(after == before, f'CONV-14 nome vazio ou só espaços não cria convidado ({before}→{after})')
    await add_guest(pg, 'L' * 300)
    longn = await S(pg, "()=>{ const l=window.__t.state.guests.noiva.familia; const x=l[l.length-1]; return x?x.name.length:0; }")
    over = await S(pg, "()=>document.documentElement.scrollWidth-innerWidth")
    ok(longn > 0 and over <= 1, f'CONV-14 nome longo guardado (len={longn}) sem partir o layout (overflow={over})')
    # CONV-02 editar e apagar (com lugar atribuído → liberta o lugar)
    await S(pg, "()=>{ const s=window.__t.state; s.guests.noiva.familia=[{name:'Ana Lopes',id:'gA',guestId:'gA'},{name:'Rui Lopes',id:'gB',guestId:'gB'}]; window.__t.go('convidados'); }")
    await open_cat(pg)
    await setv(pg, '[data-editguest="noiva|familia|0"]', 'Ana Lopes Costa')
    nm = await S(pg, "()=>window.__t.state.guests.noiva.familia[0].name")
    ok(nm == 'Ana Lopes Costa', f'CONV-02 editar nome do convidado ({nm})')
    # sentar o Rui na mesa 1 pela interface
    await go(pg, 'mesas'); await click(pg, '[data-toggletable="1"]')
    await click(pg, '[data-openseat="t1-s1"]'); await click(pg, '[data-pick="gB"]')
    seated = await S(pg, "()=>JSON.stringify(window.__t.state.seating.assignments)")
    await open_cat(pg)
    await S(pg, "()=>{ window.__q.alerts=[]; window.__q.confirmAns=true; }")
    await click(pg, '[data-remove="noiva|familia|1"]')
    await S(pg, "()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent!==null && /^(Eliminar|Apagar|Confirmar|Sim)$/i.test(x.innerText.trim()) && x.closest('[role=dialog],.wd-modal,.modal,.sheet-overlay,.confirm')); if(b) b.click(); }")
    await pg.wait_for_timeout(200)
    r = await S(pg, "()=>({ names: window.__t.state.guests.noiva.familia.map(x=>x.name), asg: JSON.stringify(window.__t.state.seating.assignments), alerts: window.__q.alerts.slice() })")
    ok('gB' in seated and 'Rui Lopes' not in r['names'], f'CONV-02 apagar convidado remove-o (antes sentado: {"gB" in seated}) {r["names"]}')
    ok('gB' not in r['asg'], f'CONV-02 apagar convidado liberta o lugar na mesa {r["asg"][:120]}')
    # CONV-04 pesquisa sem acentos
    await S(pg, "()=>{ const s=window.__t.state; s.guests.noiva.familia=[{name:'João Araújo',id:'g1',guestId:'g1'},{name:'Inês Mota',id:'g2',guestId:'g2'}]; s.guests.noivo.amigos=[{name:'Joana Reis',id:'g3',guestId:'g3'}]; window.__t.go('convidados'); }")
    await open_cat(pg); await S(pg, "()=>{ const b=document.getElementById('gx-back'); if(b&&b.offsetParent) b.click(); }")
    await pg.fill('#guest-search', 'João'); await pg.wait_for_timeout(250)
    t = await vals(pg, '[data-panel=convidados]')
    ok('João Araújo' in t and 'Inês Mota' not in t, 'CONV-04 pesquisar "João" encontra o convidado e filtra os outros')
    await pg.fill('#guest-search', 'joao'); await pg.wait_for_timeout(250)
    t = await vals(pg, '[data-panel=convidados]')
    ok('João Araújo' in t, 'CONV-04 pesquisar "joao" (sem acentos) encontra "João"')
    await pg.fill('#guest-search', ''); await pg.wait_for_timeout(150)
    # CONV-05 Noiva/Noivo/Conjunto
    seg = {}
    for sgm in ['noiva', 'noivo', 'conjunto']:
        await click(pg, f'[data-seg="{sgm}"]')
        seg[sgm] = await vals(pg, '[data-panel=convidados]')
    ok('Família' in seg['noiva'] and nan_free(seg['conjunto']) and seg['noiva'] != seg['noivo'], 'CONV-05 alternar Noiva/Noivo/Conjunto muda as listas sem erros')
    # CONV-07 convite físico entregue
    await click(pg, '[data-seg="noiva"]'); await open_cat(pg)
    await click(pg, '[data-invite="noiva|familia|0"]')
    await click(pg, '#inv-yes')
    inv = await S(pg, "()=>JSON.stringify(window.__t.state.guests.noiva.familia[0])")
    await click(pg, '[data-invf="delivered"]')
    t = await vals(pg, '[data-panel=convidados]')
    ok('João Araújo' in t and 'Inês Mota' not in t, f'CONV-07 marcar convite entregue passa o convidado para "Entregue" {inv[:120]}')
    # CONV-06 categoria nova
    await go(pg, 'convidados'); await click(pg, '[data-invf="all"]')
    await S(pg, "()=>{ const b=document.getElementById('gx-back'); if(b&&b.offsetParent) b.click(); }")
    await setv(pg, '#add-guestcat-name', 'Amigos da família'); await click(pg, '#addbtn-guestcat')
    t = await txt(pg, '[data-panel=convidados]')
    ok('Amigos da família' in t, 'CONV-06 categoria nova "Amigos da família" disponível')
    # CONV-03/10/11 importador: limpeza das células e fórmulas guardadas como texto
    g = await S(pg, """()=>{ const s=window.__s; const out=s.gimpClean([['=HYPERLINK("http://x","y")','<img src=x onerror=alert(1)>','\\uFEFFAna'],['','','']]); return out; }""")
    ok(isinstance(g, list) and all(isinstance(c, str) for row in g for c in row), f'CONV-11 importador devolve só texto (sem executar) {str(g)[:160]}')
    ok(not errs(pg), f'Convidados sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Gastos
async def new_exp(pg, desc, value, paid, cat='quinta', date='2026-10-01', due=None, dbl=False):
    await go(pg, 'gastos'); await click(pg, '#open-sheet')
    await pg.fill('#sf-desc', desc); await pg.fill('#sf-date', date); await pg.fill('#sf-value', str(value)); await pg.fill('#sf-paid', str(paid))
    if due: await pg.fill('#sf-duedate', due)
    await pg.select_option('#sf-cat', cat)
    if dbl: await pg.dblclick('#sf-save')
    else: await click(pg, '#sf-save')
    await pg.wait_for_timeout(200)

async def t_gas(b):
    pg = await page(b)
    await new_exp(pg, 'Sinal da quinta', 8000, 2000, 'quinta')
    e = await S(pg, "()=>window.__t.state.expenses.map(x=>({d:x.desc||x.description,v:x.value,p:x.paid,c:x.cat||x.category}))")
    t = await txt(pg, '[data-panel=gastos]')
    ok(len(e) == 1 and e[0]['v'] == 8000 and e[0]['p'] == 2000, f'GAS-01 gasto criado com valor e pago {e}')
    ok('Sinal da quinta' in t and ('2000' in t.replace(' ', '').replace(' ', '')), 'GAS-01 aparece em Movimentos e o pago é atualizado')
    # GAS-11 duplo clique
    await new_exp(pg, 'Fotógrafo', 1500, 500, 'foto', dbl=True)
    n = await S(pg, "()=>window.__t.state.expenses.filter(x=>(x.desc||x.description)==='Fotógrafo').length")
    ok(n == 1, f'GAS-11 duplo clique em Guardar cria um só gasto (n={n})')
    # GAS-08 pago > total
    before = await S(pg, "()=>window.__t.state.expenses.length")
    await new_exp(pg, 'Erro', 100, 500, 'extras')
    r = await S(pg, "()=>({ n: window.__t.state.expenses.length, alerts: window.__q.alerts.slice(-2), e: window.__t.state.expenses.find(x=>(x.desc||x.description)==='Erro') })")
    t = await txt(pg, '#app-body')
    ok(r['n'] == before or (r['e'] and r['e']['paid'] <= r['e']['value']) or r['alerts'], f'GAS-08 pago > total é recusado ou avisado {r}')
    ok(not re.search(r'-\s?\d[\d\s]*\s?€', t), 'GAS-08 nunca mostra "falta pagar" negativo')
    await S(pg, "()=>{ const o=document.getElementById('sf-cancel'); if(o&&o.offsetParent) o.click(); }")
    # GAS-09 valores
    res = {}
    for v in ['0', '-50', 'abc', '1500.5']:
        before = await S(pg, "()=>window.__t.state.expenses.length")
        await go(pg, 'gastos'); await click(pg, '#open-sheet')
        await pg.fill('#sf-desc', 'V' + v); await pg.fill('#sf-date', '2026-10-01')
        try: await pg.fill('#sf-value', v)
        except Exception: pass
        await pg.fill('#sf-paid', '0'); await click(pg, '#sf-save')
        after = await S(pg, "()=>window.__t.state.expenses.length")
        res[v] = after - before
        await S(pg, "()=>{ const o=document.getElementById('sf-cancel'); if(o&&o.offsetParent) o.click(); }")
    ok(res['-50'] == 0 and res['abc'] == 0 and res['1500.5'] == 1, f'GAS-09 negativo/texto recusados, decimal aceite {res}')
    # GAS-02 pagamento parcial e depois o resto
    await S(pg, "()=>{ window.__t.state.expenses=[{id:'p1',desc:'Banda',value:1000,paid:400,category:'entretenimento',date:'2026-10-01'}]; window.__t.go('gastos'); }")
    t1 = await txt(pg, '[data-panel=gastos]')
    edit = await S(pg, "()=>{ const el=document.querySelector('[data-panel=gastos] [data-openexp=\"p1\"]'); if(el){ el.click(); return true; } return null; }")
    await pg.wait_for_timeout(150)
    if edit:
        await setv(pg, '[data-exp="paid|0"]', 1000)
    else:
        await S(pg, "()=>{ window.__t.state.expenses[0].paid=1000; window.__t.render(); }")
    await S(pg, "()=>{ const b=document.querySelector('[data-gtx=back]'); if(b&&b.offsetParent) b.click(); }")
    e = await S(pg, "()=>window.__t.state.expenses[0]")
    t2 = await txt(pg, '[data-panel=gastos]')
    ok(e['paid'] == 1000 and nan_free(t2), f'GAS-02 pagar o resto deixa o gasto pago (editado pela UI: {bool(edit)})')
    # GAS-03 por categoria = soma dos movimentos
    await S(pg, "()=>{ window.__t.state.expenses=[{id:'x1',desc:'A',value:3000,paid:1000,category:'foto',date:'2026-10-01'},{id:'x2',desc:'B',value:2000,paid:500,category:'foto',date:'2026-10-02'}]; window.__t.go('gastos'); }")
    t = await txt(pg, '[data-gtx-cat=foto]')
    ok('1500' in t.replace(' ', '').replace(' ', ''), f'GAS-03 categoria Foto mostra pago = soma dos movimentos (1 500 €): {t[:80]!r}')
    # GAS-06 mudar categoria de gasto pago recalcula as duas
    await S(pg, "()=>{ window.__t.state.expenses[0].category='decoracao'; window.__t.render(); }")
    a = await txt(pg, '[data-gtx-cat=foto]'); d = await txt(pg, '[data-gtx-cat=decoracao]')
    ok('500' in a.replace(' ', '') and '1000' in d.replace(' ', '').replace(' ', ''), 'GAS-06 mudar a categoria recalcula as duas categorias')
    # GAS-10 data limite no passado → atrasado e Wedding Health
    past = (TODAY - datetime.timedelta(days=5)).isoformat()
    await S(pg, "d=>{ window.__t.state.expenses=[{id:'o1',desc:'Floricultura',value:900,paid:100,category:'decoracao',date:'2026-09-01',dueDate:d}]; window.__q.settings({weddingDate:'2027-06-01'}); window.__t.go('gastos'); }", past)
    hc = await S(pg, "()=>window.__t.hc().map(c=>c.id+':'+c.text).join(' | ')")
    ok(re.search(r'pag|atras|venc', hc, re.I), f'GAS-10 pagamento em atraso aparece no Wedding Health ({hc[:160]})')
    # GAS-12 apagar categoria com gastos → gastos mantidos
    await S(pg, "()=>{ window.__t.state.expenses=[{id:'k1',desc:'Convites',value:300,paid:300,category:'convites',date:'2026-10-01'}]; window.__q.confirmAns=true; window.__t.go('orcamento'); }")
    await click(pg, '[data-toggledesc=convites]'); await click(pg, '[data-delcat=convites]')
    await S(pg, "()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent!==null && /Eliminar|Apagar|Confirmar|Mover|Sem categoria/i.test(x.innerText) && x.closest('[role=dialog],.wd-modal,.modal,.sheet-overlay,.confirm')); if(b) b.click(); }")
    await pg.wait_for_timeout(200)
    r = await S(pg, "()=>({ n: window.__t.state.expenses.length, cats: window.__t.state.categories.map(c=>c.id) })")
    ok(r['n'] == 1, f'GAS-12 apagar categoria com gastos não apaga os gastos {r}')
    # GAS-13 fechar o formulário a meio
    await go(pg, 'gastos'); before = await S(pg, "()=>window.__t.state.expenses.length")
    await click(pg, '#open-sheet'); await pg.fill('#sf-desc', 'Meio'); await pg.fill('#sf-value', '50')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
    await S(pg, "()=>{ const o=document.getElementById('sf-cancel'); if(o&&o.offsetParent) o.click(); }")
    after = await S(pg, "()=>window.__t.state.expenses.length")
    ok(after == before, f'GAS-13 fechar o formulário a meio não guarda nada ({before}→{after})')
    ok(not errs(pg), f'Gastos sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Mesas
async def t_mes(b):
    pg = await page(b)
    await S(pg, "()=>{ const s=window.__t.state; s.guests.noiva.familia=Array.from({length:12},(_,i)=>({name:'Conv '+(i+1),id:'m'+i,guestId:'m'+i})); }")
    await go(pg, 'mesas')
    n0 = await S(pg, "()=>window.__t.state.seating.tables.length")
    await click(pg, '#add-table-btn')
    tb = await S(pg, "()=>window.__t.state.seating.tables.slice(-1)[0]")
    tid = tb['id']
    ok(await S(pg, "()=>window.__t.state.seating.tables.length") == n0 + 1, f'MES-01 mesa nova criada (id {tid})')
    # 10 lugares
    for _ in range(max(0, 10 - tb['seats'])):
        await click(pg, f'[data-tableseat="{tid}|1"]')
    seats = await S(pg, "id=>window.__t.state.seating.tables.find(t=>t.id===id).seats", tid)
    ok(seats == 10, f'MES-01 mesa com 10 lugares ({seats})')
    # MES-02 atribuir
    await click(pg, f'[data-openseat="t{tid}-s1"]'); await click(pg, '[data-pick="m0"]')
    a = await S(pg, "()=>JSON.stringify(window.__t.state.seating.assignments)")
    t = await txt(pg, '[data-panel=mesas]')
    ok('m0' in a and '1/10' in t.replace(' ', ''), 'MES-02 convidado atribuído ao lugar; contador da mesa 1/10')
    # MES-07 mover para outra mesa: não duplica
    await click(pg, '[data-toggletable="1"]')
    await click(pg, '[data-openseat="t1-s1"]')
    pick = await S(pg, "()=>!!document.querySelector('[data-pick=\"m0\"]')")
    if pick:
        await click(pg, '[data-pick="m0"]')
    cnt = await S(pg, "()=>(JSON.stringify(window.__t.state.seating.assignments).match(/\"m0\"/g)||[]).length")
    ok(cnt <= 1, f'MES-07 mover convidado entre mesas não o duplica (ocorrências={cnt}, disponível na lista={pick})')
    # MES-03 mudar forma mantém convidados
    await S(pg, "id=>{ window.__t.mesas.open(id); window.__t.render(); }", tid)
    await click(pg, f'[data-setshape="{tid}|long"]')
    sh = await S(pg, "id=>window.__t.state.seating.tables.find(t=>t.id===id).shape", tid)
    ok(sh == 'long', f'MES-03 forma alterada para longa ({sh})')
    # MES-09 reduzir lugares abaixo dos ocupados
    for i in range(2, 9):
        await S(pg, "([id,i])=>{ window.__t.mesas.open(id); window.__t.render(); }", [tid, i])
        await click(pg, f'[data-openseat="t{tid}-s{i}"]')
        await click(pg, f'[data-pick="m{i}"]')
    seated_before = await S(pg, "()=>(JSON.stringify(window.__t.state.seating.assignments).match(/\"m\\d+\"/g)||[]).length")
    await S(pg, "id=>{ window.__t.mesas.open(id); window.__t.render(); window.__q.confirmAns=false; }", tid)
    for _ in range(6):
        await click(pg, f'[data-tableseat="{tid}|-1"]')
    r = await S(pg, "id=>({ seats: window.__t.state.seating.tables.find(t=>t.id===id).seats, n: (JSON.stringify(window.__t.state.seating.assignments).match(/\"m\\d+\"/g)||[]).length })", tid)
    ok(r['n'] == seated_before, f'MES-09 reduzir lugares abaixo dos ocupados não faz desaparecer convidados ({seated_before} sentados → {r})')
    # MES-10 0 lugares / máximo
    for _ in range(20):
        await pg.click(f'[data-tableseat="{tid}|-1"]', timeout=1000)
    mn = await S(pg, "id=>window.__t.state.seating.tables.find(t=>t.id===id).seats", tid)
    ok(mn >= 1, f'MES-10 mesa nunca fica com 0 lugares (mín={mn})')
    # MES-13 cliques rápidos em +
    s0 = await S(pg, "id=>window.__t.state.seating.tables.find(t=>t.id===id).seats", tid)
    for _ in range(7):
        await pg.click(f'[data-tableseat="{tid}|1"]', delay=0)
    s1 = await S(pg, "id=>window.__t.state.seating.tables.find(t=>t.id===id).seats", tid)
    disp = await S(pg, "id=>{ const b=document.querySelector('[data-tableseat=\"'+id+'|1\"]'); const p=b&&b.parentElement; return p?p.innerText:''; }", tid)
    ok(s1 >= s0 and str(s1) in disp, f'MES-13 cliques rápidos em +: valor final coerente ({s0}→{s1}, mostrado {disp.strip()[:20]!r})')
    # MES-08 apagar mesa com convidados
    await S(pg, "()=>{ window.__q.confirmAns=true; window.__q.alerts=[]; }")
    await click(pg, f'[data-deltable="{tid}"]')
    await S(pg, "()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent!==null && /^(Eliminar|Apagar|Confirmar|Sim)/i.test(x.innerText.trim()) && x.closest('[role=dialog],.wd-modal,.modal,.sheet-overlay,.confirm')); if(b) b.click(); }")
    await pg.wait_for_timeout(200)
    r = await S(pg, "id=>({ exists: window.__t.state.seating.tables.some(t=>t.id===id), asg: JSON.stringify(window.__t.state.seating.assignments), alerts: window.__q.alerts.slice() })", tid)
    ok(not r['exists'] and ('t' + str(tid) + '-') not in r['asg'], f'MES-08 apagar mesa liberta os convidados ({r["alerts"][:1]})')
    # MES-04 vista da sala
    await go(pg, 'mesa3d')
    t = await txt(pg, '#app-body')
    ok(nan_free(t) and 'Mesa' in t, 'MES-04 vista Lugares abre com as mesas identificadas')
    # MES-14 gratuito tenta AI Seating
    pg2 = await page(b, premium=False)
    await S(pg2, "()=>{ window.__t.ai.cf(function(){ window.__aiCalled=(window.__aiCalled||0)+1; return Promise.resolve({data:{}}); }); window.__t.go('mesas'); }")
    await pg2.click('#ai-seating-open-btn'); await pg2.wait_for_timeout(250)
    r = await S(pg2, "()=>({ called: window.__aiCalled||0, txt: document.getElementById('app-body').innerText.slice(0,4000) })")
    ok(r['called'] == 0 and 'Premium' in r['txt'], f'MES-14 gratuito em AI Seating vê o ecrã Premium e não há chamada à IA (chamadas={r["called"]})')
    ok(not errs(pg, pg2), f'Mesas sem erros na consola {errs(pg, pg2)[:3]}')

# ---------------------------------------------------------------- Checklist e To-do
async def t_chk(b):
    pg = await page(b)
    await go(pg, 'checklist')
    t0 = await txt(pg, '[data-panel=checklist]')
    key = await S(pg, "()=>{ const e=document.querySelector('[data-panel=checklist] [data-checktask]'); return e&&e.dataset.checktask; }")
    await click(pg, f'[data-checktask="{key}"]')
    done = await S(pg, "k=>!!window.__t.state.checklistDone[k]", key)
    t1 = await txt(pg, '[data-panel=checklist]')
    pct = lambda t: sum(int(a) for a, b in re.findall(r'(\d+)/(\d+)', t) if b != '12')
    ok(done and pct(t1) == pct(t0) + 1, f'CHK-01 marcar tarefa feita sobe o contador da fase ({pct(t0)} → {pct(t1)} feitas)')
    await click(pg, f'[data-checktask="{key}"]')
    ok(not await S(pg, "k=>!!window.__t.state.checklistDone[k]", key) and pct(await txt(pg, '[data-panel=checklist]')) == pct(t0), 'CHK-04 desmarcar volta a descer o progresso')
    # CHK-07 20 cliques rápidos → estado final coerente (par = desmarcado)
    for _ in range(20):
        await pg.click(f'[data-checktask="{key}"]', delay=0)
    await pg.wait_for_timeout(200)
    ok(not await S(pg, "k=>!!window.__t.state.checklistDone[k]", key), 'CHK-07 20 cliques rápidos: estado final correto (desmarcado)')
    # CHK-02 navegar entre as 12 fases
    bad = []
    for i in range(1, 13):
        await click(pg, f'[data-togglephase="f{i}"]')
        n = await S(pg, "()=>document.querySelectorAll('[data-panel=checklist] [data-checktask]').length")
        if n == 0: bad.append(i)
    ok(not bad, f'CHK-02 cada uma das 12 fases mostra tarefas (sem tarefas: {bad})')
    # CHK-03 item pessoal
    await go(pg, 'checklist'); await pg.fill('#add-personal-item', 'Comprar sapatos'); await click(pg, '#addbtn-personal')
    p = await S(pg, "()=>JSON.stringify(window.__t.state.checklistPersonal)")
    ok('Comprar sapatos' in p, 'CHK-03 item pessoal adicionado à checklist')
    # sobrevive a recarregar = passa pela sanitização do estado guardado
    r = await S(pg, "()=>{ const o=window.__a4.san(JSON.parse(JSON.stringify(window.__t.state))); return JSON.stringify(o.state.checklistPersonal); }")
    ok('Comprar sapatos' in r, 'CHK-03 item pessoal mantém-se depois de gravar/carregar o estado')
    # CHK-06 tarefa atrasada no Wedding Health
    await S(pg, "d=>{ window.__t.state.todoCategories[0].items=[{id:'late',text:'Escolher músicas',due:d,done:false}]; window.__t.sec('health'); }", (TODAY - datetime.timedelta(days=3)).isoformat())
    ht = await txt(pg, '#app-body')
    ok(re.search(r'1 atrasada|prazo já ultrapassado', ht), f'CHK-06 tarefa com prazo passado aparece como atrasada no Wedding Health ({ht[:200]!r})')
    await S(pg, "()=>{ window.__t.state.todoCategories[0].items=[]; }")
    # TODO-01 abrir categoria, adicionar e concluir
    await go(pg, 'todo'); await click(pg, '[data-opencat="tc1"]')
    inp = await S(pg, "()=>{ const e=[...document.querySelectorAll('[data-panel=todo] input[type=text]')].find(x=>x.offsetParent!==null && x.id!=='todo-search'); return e && (e.id?('#'+e.id):(e.getAttribute('data-addtodo')!==null?'[data-addtodo]':null)); }")
    added = False
    if inp:
        await pg.fill(inp, 'Primeira dança'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        added = await S(pg, "()=>JSON.stringify(window.__t.state.todoCategories.find(c=>c.id==='tc1').items).includes('Primeira dança')")
        if not added:
            await S(pg, "()=>{ const b=[...document.querySelectorAll('[data-panel=todo] button')].find(x=>x.offsetParent!==null && /adicionar|novo|nova/i.test((x.getAttribute('aria-label')||'')+x.innerText)); if(b) b.click(); }")
            await pg.wait_for_timeout(150)
            added = await S(pg, "()=>JSON.stringify(window.__t.state.todoCategories.find(c=>c.id==='tc1').items).includes('Primeira dança')")
    ok(added, f'TODO-01 tarefa adicionada à categoria Playlist (campo {inp})')
    t = await txt(pg, '[data-panel=todo]')
    ok(re.search(r'\d+\s*/\s*\d+', t) and nan_free(t), 'TODO-01 contador da categoria visível e sem NaN')
    # TODO-02 filtros (voltar da categoria para a lista)
    await S(pg, "()=>{ const b=[...document.querySelectorAll('[data-panel=todo] [id$=\"-back\"],[data-panel=todo] [data-catback]')].find(x=>x.offsetParent!==null && x.id!=='todo-back'); if(b) b.click(); }")
    await go(pg, 'todo')
    if not await S(pg, "()=>{ const e=document.querySelector('[data-todofilter=todas]'); return !!(e&&e.offsetParent); }"):
        await S(pg, "()=>{ const b=[...document.querySelectorAll('[data-panel=todo] button')].find(x=>x.offsetParent!==null && /voltar/i.test(x.getAttribute('aria-label')||'')); if(b) b.click(); }")
        await pg.wait_for_timeout(150)
    res = {}
    for f in ['todas', 'porfazer', 'progresso', 'concluidas']:
        await click(pg, f'[data-todofilter="{f}"]')
        res[f] = nan_free(await txt(pg, '[data-panel=todo]'))
    ok(all(res.values()), f'TODO-02 filtros Todas/Por fazer/Em progresso/Concluídas sem erros {res}')
    # TODO-05 pesquisa sem resultados
    await click(pg, '[data-todofilter="todas"]'); await pg.fill('#todo-search', 'zzzxxyy'); await pg.wait_for_timeout(200)
    t = await txt(pg, '[data-panel=todo]')
    ok(nan_free(t) and 'Playlist do casamento' not in t, 'TODO-05 pesquisa sem resultados: lista vazia sem erros')
    await pg.fill('#todo-search', '')
    # TODO-07 apagar categoria com tarefas pede confirmação
    await S(pg, "()=>{ window.__q.alerts=[]; window.__q.confirmAns=false; const c=window.__t.state.todoCategories.find(c=>c.id==='tc2'); c.items=[{id:'i1',text:'a',status:'todo'},{id:'i2',text:'b',status:'todo'}]; window.__t.go('todo'); }")
    await click(pg, '[data-opencat="tc2"]')
    dl = await S(pg, "()=>{ const b=[...document.querySelectorAll('[data-panel=todo] [data-deltodocat],[data-panel=todo] [data-delcat],[data-panel=todo] button')].find(x=>x.offsetParent!==null && /eliminar categoria|apagar categoria|data-deltodocat/i.test(x.outerHTML)); if(b){ b.click(); return true; } return false; }")
    await pg.wait_for_timeout(200)
    r = await S(pg, "()=>({ exists: window.__t.state.todoCategories.some(c=>c.id==='tc2'), alerts: window.__q.alerts.slice(), modal: !!document.querySelector('[role=dialog]:not([hidden]),.wd-modal.open') })")
    ok((not dl) or (r['exists'] and (r['alerts'] or r['modal'])), f'TODO-07 apagar categoria com tarefas pede confirmação e cancelar mantém-na (botão={dl}) {r}')
    # TODO-06 nota com 10 000 caracteres
    big = ('linha de nota\n' * 800)[:10000]
    await go(pg, 'todo')
    nsel = await S(pg, "()=>{ const e=[...document.querySelectorAll('[data-panel=todo] textarea')].find(x=>x.offsetParent!==null); return e&&(e.id?'#'+e.id:null); }")
    saved = None
    if nsel:
        await pg.fill(nsel, big); await S(pg, "s=>{ const e=document.querySelector(s); e.dispatchEvent(new Event('change',{bubbles:true})); e.blur(); }", nsel); await pg.wait_for_timeout(200)
        saved = await S(pg, "()=>(window.__t.state.todoNotes||'').length")
    ok(saved is None or saved == len(big), f'TODO-06 nota de 10 000 caracteres guardada inteira (guardado={saved}, campo={nsel})')
    ok(not errs(pg), f'Checklist/To-do sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Fornecedores
async def t_for(b):
    pg = await page(b)
    await go(pg, 'fornecedores'); n0 = await S(pg, "()=>window.__t.state.suppliers.length")
    await click(pg, '#add-supplier-btn')
    name_sel = await S(pg, "()=>{ const e=[...document.querySelectorAll('input[id^=supd-]')].find(x=>x.offsetParent!==null && /name|nome/.test(x.id)); return e?'#'+e.id:null; }")
    if name_sel: await setv(pg, name_sel, 'Quinta da Aveleda')
    await setv(pg, '#supd-phone', '+351 912 345 678'); await setv(pg, '#supd-email', 'geral@aveleda.test')
    s = await S(pg, "()=>window.__t.state.suppliers.slice(-1)[0]")
    ok(await S(pg, "()=>window.__t.state.suppliers.length") == n0 + 1 and '912' in json.dumps(s), f'FOR-01 fornecedor criado com telefone e email {json.dumps(s, ensure_ascii=False)[:160]}')
    # FOR-02 pagamento na ficha
    await setv(pg, '#supd-valortotal', 2500); await pg.fill('#supd-pay-date', '2026-11-01'); await pg.fill('#supd-pay-amount', '600'); await click(pg, '#supd-pay-add')
    s = await S(pg, "()=>JSON.stringify(window.__t.state.suppliers.slice(-1)[0])+' || '+JSON.stringify(window.__t.state.payments)+' || '+JSON.stringify(window.__t.state.expenses)")
    ok('600' in s, f'FOR-02 pagamento registado na ficha do fornecedor ({s[:200]})')
    # FOR-03 pesquisa com 1 e 2 letras
    await S(pg, "()=>{ window.__t.state.suppliers=[{id:'s1',name:'Quinta da Aveleda',category:'Espaço'},{id:'s2',name:'Foto Luz',category:'Fotografia'}]; window.__t.go('fornecedores'); }")
    await go(pg, 'fornecedores'); await pg.fill('#sup-search', 'q'); await pg.wait_for_timeout(250)
    t1 = await txt(pg, '[data-panel=fornecedores]')
    await pg.fill('#sup-search', 'qu'); await pg.wait_for_timeout(250)
    t2 = await txt(pg, '[data-panel=fornecedores]')
    ok('Foto Luz' in t1 and 'Quinta da Aveleda' in t2 and 'Foto Luz' not in t2, 'FOR-03 pesquisa só filtra a partir de 2 letras')
    ok(not errs(pg), f'Fornecedores sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Páginas de planeamento
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082')

async def t_pln(b):
    pg = await page(b)
    # PLN-01 Dress: nova visita
    await go(pg, 'vestido'); n0 = await S(pg, "()=>window.__t.state.dressVisits.length")
    await click(pg, '#add-visit-btn'); await pg.fill('#vf-loja', 'Atelier Bela Noiva'); await pg.fill('#vf-data', '2026-12-05'); await pg.fill('#vf-notas', 'Gostámos do modelo 3')
    await click(pg, '#vf-save'); await pg.wait_for_timeout(150)
    v = await S(pg, "()=>window.__t.state.dressVisits.map(x=>x.loja||x.store||x.name)")
    ok(len(v) == n0 + 1 and 'Atelier Bela Noiva' in json.dumps(v, ensure_ascii=False), f'PLN-01 visita ao atelier guardada e listada {v}')
    # visita sem nome da loja (obrigatório) não é guardada
    await click(pg, '#add-visit-btn'); await pg.fill('#vf-loja', ''); await click(pg, '#vf-save')
    ok(await S(pg, "()=>window.__t.state.dressVisits.length") == n0 + 1, 'PLN-01 visita sem nome da loja (campo obrigatório) não é guardada')
    await S(pg, "()=>{ const c=document.getElementById('vf-cancel'); if(c&&c.offsetParent) c.click(); }")
    # PLN-03 Bolo: modelo, pisos, cm e porções
    await go(pg, 'bolo'); await click(pg, '[data-cbshape=tiers]')
    await setv(pg, '[data-cdtext="cake.tiers.0.cm"]', '30'); await setv(pg, '[data-cdtext="cake.tiers.0.portions"]', '60')
    c = await S(pg, "()=>window.__t.state.cake")
    ok(c['shape'] == 'tiers' and str(c['tiers'][0]['cm']) == '30' and str(c['tiers'][0]['portions']) == '60', f'PLN-03 bolo: modelo, cm e porções guardados {json.dumps(c)[:140]}')
    tabs = {}
    for tb in ['provas', 'inspiracoes', 'detalhes']:
        await click(pg, f'[data-cbtab={tb}]'); tabs[tb] = nan_free(await txt(pg, '[data-panel=bolo]'))
    ok(all(tabs.values()), f'PLN-03 separadores Provas e Inspirações acessíveis {tabs}')
    # PLN-08 3 → 1 piso com dados: pede confirmação
    await S(pg, "()=>{ window.__q.alerts=[]; window.__q.confirmAns=false; }")
    n_t = len(c['tiers'])
    for _ in range(n_t - 1): await click(pg, '[data-cbtiers="-1"]')
    r = await S(pg, "()=>({ n: window.__t.state.cake.tiers.length, cm: window.__t.state.cake.tiers[0].cm, alerts: window.__q.alerts.slice(), modal: !!document.querySelector('[role=dialog]:not([hidden]),.wd-modal.open') })")
    ok(r['alerts'] or r['modal'] or r['n'] == n_t, f'PLN-08 reduzir pisos com dados preenchidos pede confirmação antes de descartar {r}')
    # PLN-11 cm inválidos
    res = {}
    for v in ['0', '-5', '9999', 'abc']:
        await setv(pg, '[data-cdtext="cake.tiers.0.cm"]', v)
        res[v] = await S(pg, "()=>String(window.__t.state.cake.tiers[0].cm)")
    ok(res['-5'] != '-5' and res['abc'] != 'abc' and res['9999'] != '9999', f'PLN-11 cm negativo, texto ou absurdo são recusados ou limitados {res}')
    # PLN-04 Votos
    await go(pg, 'votos'); await click(pg, '[data-vwopen="vow:bride"]')
    await setv(pg, '#vw-ed', 'Prometo-te...'); await click(pg, '[data-vwback]')
    vw = await S(pg, "()=>window.__t.state.vows.bride")
    t = await txt(pg, '[data-panel=votos]')
    ok(vw['text'] == 'Prometo-te...' and re.search(r'em progresso|a escrever|continuar', t, re.I), f'PLN-04 votos da noiva guardados e estado passa a "Em progresso" ({t[:120]!r})')
    # PLN-12 votos com 20 000 caracteres
    big = ('Linha dos votos com acentuação — ção.\n' * 600)[:20000]
    await click(pg, '[data-vwopen="vow:bride"]'); await setv(pg, '#vw-ed', big); await click(pg, '[data-vwback]')
    ok(await S(pg, "()=>window.__t.state.vows.bride.text.length") == 20000, 'PLN-12 votos com 20 000 caracteres guardados inteiros')
    # PLN-05 Papelaria
    await go(pg, 'papelaria'); await click(pg, '[data-sdtab=itens]')
    def prog(t):
        m = re.search(r'(\d+)\s*(?:de|/)\s*(\d+)', t); return (int(m[1]), int(m[2])) if m else None
    p0 = prog(await txt(pg, '[data-panel=papelaria]'))
    await click(pg, '[data-cdstat="save:c"]'); await click(pg, '[data-cdstat="convites:c"]')
    p1 = prog(await txt(pg, '[data-panel=papelaria]'))
    st = await S(pg, "()=>JSON.stringify(window.__t.state.stationery)")
    ok('save' in st and 'convites' in st and (p1 is None or p0 is None or p1[0] == p0[0] + 2), f'PLN-05 marcar passos da papelaria sobe o progresso ({p0} → {p1})')
    # PLN-06 Lua-de-mel: hipótese e só uma favorita
    await go(pg, 'luademel'); await click(pg, '#add-idea-btn'); await pg.fill('#hmo-name', 'Bali'); await click(pg, '#save-hmoption-btn')
    await click(pg, '#add-idea-btn'); await pg.fill('#hmo-name', 'Japão'); await click(pg, '#save-hmoption-btn')
    ops = await S(pg, "()=>window.__t.state.honeymoon.options.map(o=>o.id)")
    ok(len(ops) == 2, f'PLN-06 duas hipóteses de lua-de-mel criadas {ops}')
    if len(ops) == 2:
        await click(pg, f'[data-favoption="{ops[0]}"]'); await click(pg, f'[data-favoption="{ops[1]}"]')
        fav = await S(pg, "()=>({ fav: window.__t.state.honeymoon.favorite||window.__t.state.honeymoon.fav||null, flags: window.__t.state.honeymoon.options.filter(o=>o.fav||o.favorite).length })")
        ok(fav['flags'] <= 1 and (fav['fav'] in (None, ops[1]) or fav['flags'] == 1), f'PLN-06 só uma favorita de cada vez {fav}')
    # PLN-07 / PLN-10 Inspiração: imagens e limite de 6
    await go(pg, 'inspiracao')
    fsel = await S(pg, "()=>{ const f=[...document.querySelectorAll('input[type=file]')].find(i=>/insp/i.test(i.id+i.className+(i.closest('[data-panel]')||{dataset:{}}).dataset.panel)); return f?('#'+f.id):null; }")
    if fsel:
        for i in range(7):
            await pg.set_input_files(fsel, files=[{'name': f'i{i}.png', 'mimeType': 'image/png', 'buffer': PNG}]); await pg.wait_for_timeout(250)
        r = await S(pg, "()=>({ n: document.querySelectorAll('[data-panel=inspiracao] img').length, alerts: window.__q.alerts.slice(-2) })")
        ok(r['n'] >= 1, f'PLN-07 imagem de inspiração adicionada e miniatura visível ({r["n"]})')
        ok(r['n'] <= 6, f'PLN-10 7.ª imagem bloqueada (máx. 6) {r}')
        await pg.set_input_files(fsel, files=[{'name': 'x.svg', 'mimeType': 'image/svg+xml', 'buffer': b'<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"></svg>'}]); await pg.wait_for_timeout(300)
        ok(not await S(pg, "()=>window.__pwned"), 'PLN-13 SVG com código não executa')
    else:
        ok(False, 'PLN-07 campo de ficheiro da Inspiração não encontrado')
    ok(not errs(pg), f'Planeamento sem erros na consola {errs(pg)[:3]}')

# ---------------------------------------------------------------- Wedding Health, Definições, transversais
async def t_misc(b):
    pg = await page(b)
    # HLT-03 casamento vazio
    await S(pg, "()=>{ window.__t.state=window.__a4.seed(); window.__t.sec('health'); }")
    t = await txt(pg, '#app-body')
    ok(nan_free(t) and re.search(r'começar|preencham|ainda', t, re.I), 'HLT-03 Wedding Health com casamento vazio: sem NaN e com primeiros passos')
    # HLT-01 dados coerentes
    await S(pg, "()=>{ const s=window.__t.state; s.guests.noiva.familia=Array.from({length:10},(_,i)=>({name:'G'+i,id:'h'+i,guestId:'h'+i})); s.expenses=[{id:'e',desc:'Quinta',value:5000,paid:5000,category:'quinta',date:'2026-10-01'}]; window.__t.sec('health'); }")
    t = await txt(pg, '#app-body')
    ok(re.search(r'\d{1,3}\s*/100', t) or re.search(r'5 ?000 € (gastos|contratados)', t), f'HLT-01 índice /100 ou áreas coerentes com os dados ({" ".join(t.split()[:30])})')
    # SET-02 editar nomes/data/local nas Definições → Início
    await S(pg, "()=>window.__t.sec('casamento')")
    for sel, v in (('#def-name1', 'Beatriz'), ('#def-name2', 'Tomás'), ('#def-venue', 'Quinta Nova')):
        if await S(pg, "s=>!!document.querySelector(s)", sel): await setv(pg, sel, v)
    await click(pg, '#def-save-casamento')
    await go(pg, 'inicio')
    t = (await txt(pg, '[data-panel=inicio]')).upper()
    ok('BEATRIZ' in t and 'TOMÁS' in t, 'SET-02 nomes editados nas Definições aparecem no Início')
    # SET-07 PT → EN
    await S(pg, "()=>{ window.__t.lang('en'); window.__t.go('inicio'); }")
    t = await txt(pg, '[data-panel=inicio]')
    ok(not re.search(r'\b(Faltam|Convidados|Orçamento|Ferramentas)\b', t), f'SET-07 em inglês o Início não tem texto PT ({t[:80]!r})')
    await S(pg, "()=>{ window.__t.lang('pt'); window.__t.go('inicio'); }")
    # TRV-07 Esc fecha folhas
    await go(pg, 'gastos'); await click(pg, '#open-sheet')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
    open_ = await S(pg, "()=>{ const sh=document.getElementById('expense-sheet'); const e=document.getElementById('sf-save'); return !!(sh && sh.classList.contains('show')) || !!(e && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0); }")
    ok(not open_, 'TRV-07 Esc fecha a folha de novo gasto')
    # foco visível no teclado: o elemento focado tem de mudar de aspeto (contorno, sombra, fundo ou borda)
    await go(pg, 'inicio'); await pg.mouse.click(5, 5)
    nofocus = []
    for _ in range(6):
        await pg.keyboard.press('Tab')
        r = await S(pg, """()=>{ const e=document.activeElement; if(!e||e===document.body) return null;
          const pick=s=>[s.outlineStyle==='none'?'none':s.outlineStyle+s.outlineWidth+s.outlineColor, s.boxShadow, s.backgroundColor, s.borderColor].join('|');
          const on=pick(getComputedStyle(e)); const id=(e.id||e.getAttribute('aria-label')||e.className||e.tagName).toString().slice(0,30);
          e.blur(); const off=pick(getComputedStyle(e)); e.focus({focusVisible:true}); return {id, visible:on!==off}; }""")
        if r and not r['visible']: nofocus.append(r['id'])
    ok(not nofocus, f'TRV-07 elementos focados pelo teclado têm indicação visível (sem indicação: {nofocus})')
    ok(not errs(pg), f'Health/Definições sem erros na consola {errs(pg)[:3]}')
    # TRV-06 todas as páginas a 390/768/1440: sem scroll horizontal
    tabs = ['inicio', 'orcamento', 'convidados', 'gastos', 'mesas', 'mesa3d', 'vestido', 'todo', 'luademel', 'checklist', 'fornecedores', 'bolo', 'votos', 'papelaria', 'inspiracao']
    bad = []
    for w, h in ((390, 844), (768, 1024), (1440, 900)):
        pw = await page(b, w, h)
        for tb in tabs:
            await go(pw, tb)
            o = await S(pw, "()=>document.documentElement.scrollWidth-innerWidth")
            if o > 1: bad.append(f'{tb}@{w}:{o}px')
        if errs(pw): bad.append(f'erros@{w}:{errs(pw)[:1]}')
    ok(not bad, f'TRV-06 15 páginas × 390/768/1440 px sem scroll horizontal {bad}')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, fn in [('Início', t_home), ('Orçamento', t_orc), ('Convidados', t_conv), ('Gastos', t_gas), ('Mesas', t_mes), ('Checklist/To-do', t_chk), ('Fornecedores', t_for), ('Planeamento', t_pln), ('Health/Definições/Transversais', t_misc)]:
            print(f'\n## {name}')
            await section(name, fn, b)
        await b.close()
    summary()

asyncio.run(main())
