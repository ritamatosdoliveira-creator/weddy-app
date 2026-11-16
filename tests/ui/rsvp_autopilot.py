"""B.1 RSVP Autopilot: estados honestos, frequência, intervenção, recuperação (lógica + ecrã, PT/EN, mobile+desktop)."""
from common import *
newpage = functools.partial(newpage, mode='app')
PT = re.compile(r"\b(não|nao|já|ainda|convidados?|lembretes?|responderam|abriram|prazo|atenção|máximo)\b|[áàâãéêíóôõúç]", re.I)

DISMISS = "(()=>{ const o=document.getElementById('weddy-alert-overlay'); if(o) o.remove(); })()"
SETUP = """(deadlineDays)=>{ const t=window.__t, s=t.state; const iso=(n)=>{ const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString(); };
  const ymd=(n)=>iso(n).slice(0,10);
  s.guests.noiva.familia=[
    {name:'Ana',guestId:'a',phone:'+351911111111',rsvpToken:'tok1'},
    {name:'Bruno',guestId:'b',phone:'+351922222222',rsvpToken:'tok2'},
    {name:'Carla',guestId:'c',rsvpToken:'tok3'},
    {name:'Diogo',guestId:'d',rsvpEmail:'d@example.com',rsvpToken:'tok4'},
    {name:'Eva',guestId:'e'},
    {name:'Fam1',guestId:'f1',rsvpToken:'tok5',rsvpMemberId:'m1'},
    {name:'Fam2',guestId:'f2',rsvpToken:'tok5',rsvpMemberId:'m2'}];
  const R={
    tok1:{attending:null},
    tok2:{attending:null,openedAt:iso(-2),remindersSent:1,lastReminderAt:iso(-1)},
    tok3:{attending:null,remindersSent:3,lastReminderAt:iso(-10)},
    tok4:{attending:true,openedAt:iso(-6),respondedAt:iso(0),remindersSent:1,lastReminderAt:iso(-3)},
    tok5:{isFamily:true,responses:{m1:{attending:true}},reminders:{m2:{remindersSent:1,lastReminderAt:iso(-8)}}}};
  t.nt.setRsvp(R,true); t.nt.setSettings({rsvpDeadline:ymd(deadlineDays)}); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b)
        await pg.evaluate(SETUP, 5)
        ins = await pg.evaluate("window.__t.ap.insights()")
        st = ins['stages']
        ok(st == {'nolink': 1, 'linkready': 3, 'opened': 1, 'responded': 2}, f'estados por pessoa {st}')
        ok(ins['groups'] == 6, f"família conta como 1 grupo ({ins['groups']} grupos para 7 pessoas)")
        lst = {x['name']: x['bucket'] for x in await pg.evaluate("window.__t.ap.list()")}
        ok(lst.get('Ana') == 'due' and lst.get('Bruno') == 'resting' and lst.get('Carla') == 'maxed' and lst.get('Fam2') == 'due', f'buckets {lst}')
        ok('Diogo' not in lst and 'Fam1' not in lst and 'Eva' not in lst, 'quem respondeu ou não tem link não entra na lista de lembretes')
        s = ins['stats']
        ok(s['reminded'] == 4 and s['respondedAfter'] == 1 and s['stillPending'] == 3 and s['rate'] == 25, f'recuperação {s}')
        names = {tuple(x['names']): x['reasons'] for x in ins['intervention']}
        ok(len(ins['intervention']) == 4, f'intervenção: 4 grupos {names}')
        ok(set(names[('Carla',)]) == {'nocontact', 'exhausted', 'unopened'}, 'Carla: sem contacto + esgotado + por abrir')
        ok(names[('Ana',)] == ['unopened'] and names[('Eva',)] == ['nolink'] and set(names[('Fam2',)]) == {'nocontact', 'unopened'}, 'Ana/Eva/Família: motivos certos')
        ok(not any('Bruno' in k or 'Diogo' in k for k in names), 'quem abriu ou respondeu não pede intervenção')
        # atrasado: lembrado há pouco continua a descansar, não volta a ser sugerido
        await pg.evaluate(SETUP, -2)
        lst = {x['name']: x['bucket'] for x in await pg.evaluate("window.__t.ap.list()")}
        ok(lst['Ana'] == 'late' and lst['Bruno'] == 'resting' and lst['Carla'] == 'maxed' and lst['Fam2'] == 'late', f'prazo passado: {lst}')
        # configuração
        await pg.evaluate(SETUP, 5)
        c = await pg.evaluate("window.__t.ap.cfg()")
        ok(c == {'intervalDays': 5, 'maxReminders': 3}, f'configuração por defeito {c}')
        for bad in [None, 'x', 5, [], {'intervalDays': 'x', 'maxReminders': -5}, {'intervalDays': 0, 'maxReminders': 99}, {'intervalDays': NaN if False else None}]:
            c = await pg.evaluate("(v)=>{ window.__t.nt.setSettings({rsvpAutopilot:v}); return window.__t.ap.cfg(); }", bad)
            ok(c == {'intervalDays': 5, 'maxReminders': 3}, f'configuração inválida {bad!r} volta ao defeito')
        await pg.evaluate("window.__t.nt.setSettings({rsvpAutopilot:{intervalDays:10,maxReminders:5}})")
        lst = {x['name']: x['bucket'] for x in await pg.evaluate("window.__t.ap.list()")}
        ok(lst['Carla'] == 'due', f"máximo 5: Carla já não está esgotada ({lst['Carla']})")
        ok(lst['Fam2'] == 'resting', f"intervalo 10: Fam2 (lembrada há 8 dias) ainda descansa ({lst['Fam2']})")
        await pg.evaluate("window.__t.nt.setSettings({rsvpAutopilot:undefined})")
        # estados degenerados nunca rebentam
        r = await pg.evaluate("""()=>{ const t=window.__t; const out=[]; [{}, null, {tok1:null}, {tok1:{isFamily:true}}, {tok1:{reminders:'x',isFamily:true,responses:5}}, {tok2:{remindersSent:'a',lastReminderAt:'zzz',openedAt:{}}}].forEach(r=>{ try{ t.nt.setRsvp(r||{}, true); t.ap.insights(); t.ap.list(); out.push('ok'); }catch(e){ out.push(String(e)); } }); return out; }""")
        ok(all(x == 'ok' for x in r), f'dados de respostas degenerados não rebentam {r}')
        await pg.context.close()
        # ecrã
        for lang in ['pt', 'en']:
            for name, (w, h) in {'mobile': (390, 844), 'desktop': (1360, 900)}.items():
                pg = await newpage(b, w, h)
                await pg.evaluate("(l)=>window.__t.lang(l)", lang)
                await pg.evaluate(SETUP, 5)
                await pg.evaluate("window.__t.ap.screen()"); await pg.wait_for_timeout(250)
                txt = await pg.inner_text('body')
                ok(await pg.locator('#ap-track-card').count() == 1 and await pg.locator('#ap-inter-card').count() == 1 and await pg.locator('#ap-cfg-card').count() == 1, f'[{lang}/{name}] cartões presentes')
                ok(await pg.locator('[data-ap-inter]').count() == 4, f'[{lang}/{name}] 4 itens de intervenção')
                stages = await pg.inner_text('[data-ap-stages]')
                ok(('2 responderam' in stages and '1 abriram' in stages) if lang == 'pt' else ('2 replied' in stages and '1 opened' in stages), f'[{lang}/{name}] resumo de estados: {stages!r}')
                stats = await pg.inner_text('[data-ap-stats]')
                ok('25%' in stats, f'[{lang}/{name}] estatística de recuperação {stats[:70]!r}')
                ok(await pg.input_value('#ap-cfg-interval') == '5' and await pg.input_value('#ap-cfg-max') == '3', f'[{lang}/{name}] campos de configuração')
                if lang == 'en':
                    card = ' '.join([await pg.inner_text(f'#{i}') for i in ('ap-track-card', 'ap-inter-card', 'ap-cfg-card')])
                    bad = [l for l in card.split('\n') if PT.search(l)]
                    ok(not bad, f'[en/{name}] sem português nos cartões {bad[:3]}')
                ok(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'[{lang}/{name}] sem scroll horizontal')
                # guardar com valores absurdos fica limitado (sem ligação ao servidor: não grava, mas não rebenta)
                await pg.fill('#ap-cfg-interval', '999'); await pg.fill('#ap-cfg-max', '0')
                await pg.click('#ap-cfg-save'); await pg.wait_for_timeout(200); await pg.evaluate(DISMISS)
                cfg = await pg.evaluate("window.__t.ap.cfg()")
                ok(cfg == {'intervalDays': 5, 'maxReminders': 3}, f'[{lang}/{name}] valores absurdos limitados {cfg}')
                await pg.fill('#ap-cfg-interval', '7'); await pg.fill('#ap-cfg-max', '2'); await pg.click('#ap-cfg-save'); await pg.wait_for_timeout(200); await pg.evaluate(DISMISS)
                cfg = await pg.evaluate("window.__t.ap.cfg()")
                ok(cfg == {'intervalDays': 7, 'maxReminders': 2}, f'[{lang}/{name}] valores válidos aplicados {cfg}')
                if lang == 'pt': await pg.screenshot(path=str(SHOTS / f'autopilot_{name}.png'), full_page=True)
                ok(not pg.errs, f'[{lang}/{name}] sem erros JS {pg.errs[:2]}')
                await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
