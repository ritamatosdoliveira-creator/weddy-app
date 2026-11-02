"""B.2 — área do casal: Logística dos convidados (resumo, filtros, detalhe, acompanhamento, grupos, privacidade)."""
from common import *
newpage = functools.partial(newpage, mode='app')
PT = re.compile(r"\b(não|nao|alergias|transporte|alojamento|crianças|organizar|organizado)\b", re.I)
SETUP = """()=>{ const t=window.__t, s=t.state;
  s.guests.noiva.familia=[
    {name:'Ana',guestId:'a',rsvpToken:'t1'},
    {name:'Bruno',guestId:'b',rsvpToken:'t2'},
    {name:'Carla',guestId:'c',rsvpToken:'t3'},
    {name:'Diogo',guestId:'d',rsvpToken:'t4'},
    {name:'Eva',guestId:'e',rsvpToken:'t5'},
    {name:'Fam1',guestId:'f1',rsvpToken:'t6',rsvpMemberId:'m1'},
    {name:'Fam2',guestId:'f2',rsvpToken:'t6',rsvpMemberId:'m2'},
    {name:'Sem link',guestId:'z'}];
  const R={
    t1:{attending:true,transporte:true,alojamento:true,logistics:{v:1,transport:{from:'Porto',people:3,pref:'ida-volta'},lodging:{nights:2,arrive:'2027-06-30',depart:'2027-07-02',people:2},food:{allergies:['marisco'],intolerances:['lactose'],diets:['vegan'],pref:'sem picante'},access:{mobility:true,other:'cadeira de rodas'}},children:[{name:'Zé',age:3,attending:true,highchair:true,kidsMeal:true}],dietary:'nota antiga'},
    t2:{attending:true,transporte:true,meal:'carne',children:[]},
    t3:{attending:true,meal:'peixe',children:[]},
    t4:{attending:false,transporte:true,logistics:{v:1,food:{allergies:['amendoim']}}},
    t5:{attending:null,logistics:{v:1,access:{assistance:true}}},
    t6:{isFamily:true,name:'Silva',responses:{m1:{attending:true,transporte:true,children:[{name:'Rui',age:8,attending:true,kidsMeal:true}]},m2:{attending:true,logistics:{v:1,food:{intolerances:['gluten']}}}}}};
  t.nt.setRsvp(R,true); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name,(w,h) in {'m':(390,844),'d':(1360,900)}.items():
            pg = await newpage(b,w,h)
            await pg.evaluate(SETUP)
            names = await pg.evaluate("window.__t.lg.all().map(x=>x.name)")
            ok(set(names)=={'Ana','Bruno','Fam1','Fam2'}, f'[{name}] só confirmados com necessidades: {names}')
            ok('Diogo' not in names and 'Eva' not in names and 'Carla' not in names, f'[{name}] recusa/pendente/sem necessidades não aparecem (nem alergia do que recusou)')
            await pg.evaluate("window.__t.lg.hub()")
            ok(await pg.locator('[data-rsvpgoto=logistica]').count()==1, f'[{name}] linha "Logística" no hub do RSVP')
            await pg.click('[data-rsvpgoto=logistica]'); await pg.wait_for_timeout(200)
            nums = await pg.evaluate("[...document.querySelectorAll('.logi-sum-row')].map(r=>[r.querySelector('.logi-sum-l').textContent, r.querySelector('.logi-sum-n').textContent])")
            d = dict(nums)
            ok(d.get('Transporte')=='3' and d.get('Alojamento')=='1' and d.get('Alimentação')=='2' and d.get('Necessidades especiais')=='1' and d.get('Crianças')=='2', f'[{name}] resumo {d}')
            ok(d.get('Famílias e grupos')=='1', f'[{name}] 1 família a organizar em conjunto')
            txt = await pg.inner_text('#logi-list')
            ok('Alergias: marisco' in txt and 'Intolerâncias' in txt and 'vegano' in txt and 'cadeira de bebé' in txt and 'menu infantil' in txt, f'[{name}] detalhe por convidado completo')
            ok('Porto' in txt and '30/06 → 02/07' in txt and 'ida e volta' in txt, f'[{name}] transporte e alojamento no detalhe')
            ok('nota antiga' in txt, f'[{name}] nota antiga (dietary) preservada e identificada')
            ok('amendoim' not in txt, f'[{name}] alergia de quem recusou nunca é mostrada')
            # filtros
            await pg.click('.logi-sum-row[data-logifilter=food]'); await pg.wait_for_timeout(100)
            rows = await pg.evaluate("[...document.querySelectorAll('#logi-list .list-row .rsvp-row-name')].map(e=>e.textContent)")
            ok(set(rows[:2])=={'Ana','Fam2'}, f'[{name}] filtro alimentação {rows}')
            await pg.click('.logi-sum-row[data-logifilter=kids]'); await pg.wait_for_timeout(100)
            rows = await pg.evaluate("[...document.querySelectorAll('#logi-list .list-row .rsvp-row-name')].map(e=>e.textContent)")
            ok(set(rows[:2])=={'Ana','Fam1'}, f'[{name}] filtro crianças {rows}')
            # acompanhamento privado
            await pg.click('.logi-sum-row[data-logifilter=transport]')
            n0 = await pg.evaluate("window.__t.lg.all().filter(x=>x.todo).length")
            await pg.click('[data-logifollow^="noiva|familia|0|transport"]'); await pg.wait_for_timeout(100)
            logi = await pg.evaluate("window.__t.state.guests.noiva.familia[0].logi")
            ok(logi=={'transport':'done'}, f'[{name}] marcar transporte como organizado → {logi}')
            await pg.click('[data-logifollow^="noiva|familia|0|transport"]')
            ok(await pg.evaluate("window.__t.state.guests.noiva.familia[0].logi")==None, f'[{name}] voltar a "por organizar" remove o campo')
            # grupo de transporte
            await pg.fill('[data-logigroup^="noiva|familia|0"]','Carrinha 1'); await pg.press('[data-logigroup^="noiva|familia|0"]','Tab'); await pg.wait_for_timeout(100)
            await pg.fill('[data-logigroup^="noiva|familia|1"]','carrinha 1'); await pg.press('[data-logigroup^="noiva|familia|1"]','Tab'); await pg.wait_for_timeout(100)
            gs = await pg.evaluate("window.__t.lg.groups().map(g=>g.title)")
            ok(any('Carrinha 1' in g for g in gs), f'[{name}] casal junta quem partilha transporte: {gs}')
            ok(await pg.evaluate("window.__t.state.guests.noiva.familia[0].logi.group")=='Carrinha 1', f'[{name}] grupo guardado só na entrada privada do casal')
            # nenhum dado do convidado foi alterado no estado (respostas intactas)
            ov = await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
            ok(not ov, f'[{name}] sem overflow horizontal')
            await pg.screenshot(path=str(SHOTS/f'logistica_{name}.png'),full_page=True)
            # sem forma de aparecer nos emails/notificações: texto do resumo de notificações não contém alergias
            nt = await pg.evaluate("JSON.stringify(window.__t.nt.items())")
            ok('marisco' not in nt and 'amendoim' not in nt and 'cadeira de rodas' not in nt, f'[{name}] notificações não contêm dados de logística')
            errs=[e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]  # limitação do simulador de Firebase
            ok(not errs, f'[{name}] sem erros JS {errs[:2]}')
            await pg.context.close()
        # vazio + EN
        pg = await newpage(b,390,844)
        await pg.evaluate("window.__t.nt.setRsvp({},true)"); await pg.evaluate("window.__t.lg.screen()")
        ok('Ainda ninguém' in await pg.inner_text('body'), 'estado vazio PT')
        await pg.evaluate(SETUP); await pg.evaluate("window.__t.lang('en'); window.__t.lg.screen()"); await pg.wait_for_timeout(200)
        body = await pg.inner_text('.logi-sum')+await pg.inner_text('#logi-list')
        ok('Allergies: marisco' in body and 'Accommodation' in body and 'high chair' in body and not re.search(r'\b(Alergias|Transporte|Alojamento|Crianças)\b', body), 'EN: sem texto PT na logística')
        await b.close()
    summary()
asyncio.run(main())
