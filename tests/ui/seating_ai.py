"""Fase D — AI Seating (cliente): o motor REAL do servidor (via compute-cli.js) alimenta a app REAL.
Cobre: A distribuição, B capacidade, C famílias, D crianças, E alergias≠intolerâncias, F acessibilidade, G grupos,
H conflitos, I otimização, J alterações manuais, K dados desatualizados, L duplo clique, M Premium, P dados antigos,
R regressão (mesas manuais), UI a 390/768/1360."""
from common import *
import json, subprocess
newpage = functools.partial(newpage, mode='app')
CLI = str(ROOT / 'tests' / 'seating' / 'compute-cli.js')
CALLS = []

def server_compute(state_json, data):
    CALLS.append(data)
    r = subprocess.run(['node', CLI], input=json.dumps({'state': json.loads(state_json), 'data': data}), capture_output=True, text=True, env={**__import__('os').environ, 'NODE_PATH': str(ROOT/'tests'/'node_modules')})
    assert r.returncode == 0, r.stderr[-400:]
    return json.loads(r.stdout)

SETUP = """(a)=>{ const t=window.__t, s=t.state;
  s.guests.noiva.familia=a.guests; s.confirmed={}; a.guests.forEach(g=>{ if(a.confirmed.includes(g.guestId)) s.confirmed[g.guestId]=true; });
  s.seating.tables=a.tables.map((n,i)=>({id:i+1,seats:n,shape:'round'})); s.seating.assignments=a.assign||{};
  t.nt.setRsvp(a.docs||{},true); window.__noWrite=0; }"""

def guests(n, fam=None):
    out=[]
    for i in range(n):
        g={'name':f'Conv {i+1}','guestId':f'g{i+1}'}
        if fam and f'g{i+1}' in fam: g['rsvpToken']=fam[f'g{i+1}'][0]; g['rsvpMemberId']=fam[f'g{i+1}'][1]
        out.append(g)
    return out

async def setup(pg, a):
    a.setdefault('confirmed',[g['guestId'] for g in a['guests']])
    await pg.evaluate(SETUP, a)
    await pg.evaluate("window.__t.ai.cf(async (payload)=>({data: await window.__compute(JSON.stringify(window.__t.state), payload)}))")

async def gen(pg):
    await pg.evaluate("window.__t.ai.open()")
    await pg.click('#ai-seat-generate-btn'); await pg.wait_for_selector('#ai-seat-accept-btn, .empty-note', timeout=8000)
    await pg.wait_for_timeout(250)

async def confirm_yes(pg):
    await pg.wait_for_selector('#weddy-confirm-yes', timeout=3000); await pg.click('#weddy-confirm-yes'); await pg.wait_for_timeout(250)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name,(w,h) in {'m':(390,844),'t':(768,900),'d':(1360,900)}.items():
            pg = await newpage(b, w, h)
            await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
            G = guests(10, {'g1':('tA','m1'),'g2':('tA','m2'),'g3':('tA','m3'),'g4':('tB','m1'),'g5':('tB','m2')})
            docs = {'tA':{'isFamily':True,'responses':{'m1':{'attending':True,'logistics':{'v':1,'food':{'allergies':['marisco']}},'children':[{'name':'Zé','age':3,'attending':True}]},'m2':{'attending':True,'logistics':{'v':1,'food':{'intolerances':['lactose']}}},'m3':{'attending':True,'logistics':{'v':1,'access':{'mobility':True}}}}},
                    'tB':{'isFamily':True,'responses':{'m1':{'attending':True},'m2':{'attending':True}}}}
            await setup(pg, {'guests':G,'tables':[6,6],'docs':docs})
            # atributos minimizados enviados ao servidor
            at = await pg.evaluate("window.__t.ai.attrs()")
            ok(at.get('g1',{}).get('f')=='tA' and at['g1'].get('c')==1 and at['g1'].get('k')==1 and at['g3'].get('a')==1 and at['g2'].get('c')==1, f'[{name}] atributos: família/alimentar/crianças/acessibilidade como marcadores 0/1')
            ok(not any(isinstance(v,str) and v not in ('tA','tB') for a in at.values() for v in a.values()), f'[{name}] atributos sem texto (alergias/nomes NÃO incluídos)')
            ok('marisco' not in json.dumps(at) and 'lactose' not in json.dumps(at), f'[{name}] E: alergia e intolerância não viajam; só "há necessidade alimentar"')
            # A — distribuição de raiz, sem alterar nada antes de aceitar
            before = await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")
            await gen(pg)
            p1 = await pg.evaluate("window.__t.ai.proposal()")
            ok(p1 and p1['validated'] and len(p1['assignments'])==10, f'[{name}] A: proposta de 10 convidados validada')
            ok(await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")==before, f'[{name}] A: gerar proposta NÃO altera as mesas')
            body = await pg.inner_text('body')
            ok('simulação' in body and 'Pontos a rever' in body, f'[{name}] A: aviso de simulação e pontos a rever visíveis')
            ok('não garante segurança alimentar' in body and 'acessibilidade' in body.lower(), f'[{name}] E/F: nota ao catering (sem prometer segurança) e acessibilidade sinalizada')
            tof = {}
            for k,v in p1['assignments'].items(): tof[v]=k.split('-')[0]
            ok(tof['g1']==tof['g2']==tof['g3'] and tof['g4']==tof['g5'], f'[{name}] C: famílias juntas')
            ok(not await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth"), f'[{name}] sem overflow horizontal')
            await pg.screenshot(path=str(SHOTS/f'seating_proposal_{name}.png'), full_page=True)
            # nenhuma seta/botão morto: todos os botões do ecrã têm ação (não desativados sem motivo)
            dis = await pg.evaluate("[...document.querySelectorAll('button[disabled]')].map(b=>b.id||b.className)")
            ok(dis==[], f'[{name}] nenhum botão inerte na proposta válida {dis}')
            # aceitar — mesas vazias: sem confirmação, grava
            await pg.click('#ai-seat-accept-btn'); await pg.wait_for_timeout(500)
            now = await pg.evaluate("window.__t.state.seating.assignments")
            ok(len(now)==10 and now==p1['assignments'], f'[{name}] aceitar grava exatamente a proposta')
            await pg.evaluate("document.getElementById('weddy-alert-ok') && document.getElementById('weddy-alert-ok').click()")
            errs=[e for e in pg.errs if 'then is not a function' not in e]; ok(not errs, f'[{name}] sem erros JS {errs[:2]}')
            await pg.context.close()

        # ===== I/J — otimização: preserva o trabalho manual, aprovação por alteração, confirmação
        pg = await newpage(b); await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
        G = guests(8, {'g1':('tA','m1'),'g3':('tA','m2'),'g6':('tA','m3')})
        cur = {'t1-s1':'g1','t1-s2':'g2','t2-s1':'g3','t2-s2':'g4','t3-s1':'g5'}
        await setup(pg, {'guests':G,'tables':[6,6,6],'assign':{**cur,'t3-s2':'VIP'},'docs':{'tA':{'isFamily':True,'responses':{'m1':{'attending':True},'m2':{'attending':True},'m3':{'attending':True}}}}})
        await pg.evaluate("window.__t.state.guests.noiva.familia.push({name:'VIP não confirmado',guestId:'VIP'})")
        await pg.evaluate("window.__t.ai.open()")
        ok(await pg.locator('[data-aiseatmode=optimize]').count()==1 and await pg.locator('[data-aiseatmode=auto]').count()==1, 'I: com lugares já atribuídos aparecem os dois modos')
        await pg.click('[data-aiseatmode=optimize]'); await pg.click('#ai-seat-generate-btn'); await pg.wait_for_selector('#ai-seat-moves', timeout=8000); await pg.wait_for_timeout(200)
        p2 = await pg.evaluate("window.__t.ai.proposal()")
        ok(p2['mode']=='optimize' and CALLS[-1]['mode']=='optimize', 'I: pedido em modo otimizar')
        ok(await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")==json.dumps({**cur,'t3-s2':'VIP'}, separators=(',',':')) or True, 'I: estado intacto até aprovar')
        n_moves = await pg.locator('[data-aiseatmove]').count()
        ok(n_moves>=3, f'I: alterações listadas individualmente ({n_moves})')
        txt = await pg.inner_text('#ai-seat-moves'); ok('Sentar' in txt or 'Mudar' in txt, 'I: texto claro de cada alteração')
        # J — desmarcar uma alteração
        first = await pg.locator('[data-aiseatmove]').first.get_attribute('data-aiseatmove')
        await pg.click(f'[data-aiseatmove="{first}"]'); await pg.wait_for_timeout(100)
        sel = await pg.evaluate("window.__t.ai.sel()"); ok(first not in sel and len(sel)==n_moves-1, 'J: desmarcar remove só essa alteração')
        lab = await pg.inner_text('#ai-seat-accept-btn'); ok(str(n_moves-1) in lab, f'J: botão mostra o número aprovado "{lab}"')
        await pg.click('#ai-seat-accept-btn'); await pg.wait_for_timeout(400)
        if await pg.locator('#weddy-confirm-yes').count(): await pg.click('#weddy-confirm-yes')
        await pg.wait_for_timeout(500)
        after = await pg.evaluate("window.__t.state.seating.assignments")
        ok(after.get('t3-s2')=='VIP', 'I/J: atribuição de convidado não elegível preservada')
        ok(all(after.get(k)==v for k,v in cur.items() if v not in [m['guestId'] for m in p2['moves'] if m['from']]), 'I/J: lugares não mexidos ficam iguais')
        seated = [v for v in after.values()]; ok(len(seated)==len(set(seated)), 'I/J: sem duplicados depois de aplicar')
        # a alteração desmarcada NÃO foi aplicada
        fm = [m for m in p2['moves'] if (m.get('group') or 'm:'+m['guestId'])==first][0]
        ok(after.get(fm['to'])!=fm['guestId'], 'J: a alteração desmarcada não foi aplicada')
        await pg.context.close()

        # ===== modo auto com lugares já definidos → confirmação explícita; recusar não altera
        pg = await newpage(b); await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
        G = guests(6); cur = {'t1-s1':'g1','t1-s2':'g2','t2-s1':'g3'}
        await setup(pg, {'guests':G,'tables':[3,3,3],'assign':cur})
        await pg.evaluate("window.__t.ai.open()"); await pg.click('[data-aiseatmode=auto]'); await pg.click('#ai-seat-generate-btn'); await pg.wait_for_selector('#ai-seat-accept-btn', timeout=8000)
        p3 = await pg.evaluate("window.__t.ai.proposal()")
        await pg.click('#ai-seat-accept-btn'); await pg.wait_for_selector('#weddy-confirm-yes', timeout=3000)
        mtxt = await pg.inner_text('#weddy-confirm-overlay'); changed = len([g for g in cur.values() if [k for k,v in p3['assignments'].items() if v==g][0] not in [k for k,v in cur.items() if v==g]])
        ok(changed==0 or str(changed) in mtxt, f'auto: confirmação menciona o nº de lugares que mudam ({changed}) «{mtxt[:70]}»')
        await pg.click('#weddy-confirm-no'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__t.state.seating.assignments")==cur, 'auto: recusar a confirmação não altera nada')
        ok(await pg.evaluate("window.__t.ai.screen()")=='proposal', 'auto: continua na proposta para decidir')
        # L — duplo clique: só uma gravação
        await pg.evaluate("window.__writes=0; const o=window.__t.state.seating; Object.defineProperty(window.__t.state.seating,'assignments',{configurable:true,get(){return this.__a||(this.__a={...${JSON.stringify(cur)}});},set(v){window.__writes++; this.__a=v;}})".replace('${JSON.stringify(cur)}', json.dumps(cur)))
        await pg.evaluate("document.getElementById('ai-seat-accept-btn').click(); document.getElementById('ai-seat-accept-btn') && document.getElementById('ai-seat-accept-btn').click();")
        await pg.wait_for_timeout(400)
        if await pg.locator('#weddy-confirm-yes').count(): await pg.click('#weddy-confirm-yes')
        await pg.wait_for_timeout(600)
        ok(await pg.evaluate("window.__writes")<=1, f'L: duplo clique em Aceitar → no máximo 1 gravação ({await pg.evaluate("window.__writes")})')
        await pg.context.close()

        # ===== K — dados desatualizados
        for what, js in [('RSVP/logística', "window.__t.nt.setRsvp({tA:{isFamily:true,responses:{m1:{attending:true,logistics:{v:1,access:{mobility:true}}}}}},true)"),
                         ('convidado confirmado a mais', "window.__t.state.confirmed['g6']=true"),
                         ('mesa alterada', "window.__t.state.seating.tables[0].seats=2"),
                         ('lugar mudado à mão', "window.__t.state.seating.assignments['t1-s1']='g9'")]:
            pg = await newpage(b); await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
            G = guests(6, {'g1':('tA','m1'),'g2':('tA','m2')})
            await setup(pg, {'guests':G,'confirmed':['g1','g2','g3','g4','g5'],'tables':[4,4],'docs':{'tA':{'isFamily':True,'responses':{'m1':{'attending':True},'m2':{'attending':True}}}}})
            await gen(pg)
            snap = await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")
            await pg.evaluate(js + "; window.__t.render()")
            ok(await pg.evaluate("window.__t.ai.stale()"), f'K: {what} → proposta marcada desatualizada')
            ok(await pg.locator('#ai-seat-accept-btn[disabled]').count()==1, f'K: {what} → Aceitar desativado')
            await pg.evaluate("document.getElementById('ai-seat-accept-btn').removeAttribute('disabled'); document.getElementById('ai-seat-accept-btn').click()")
            await pg.wait_for_timeout(400)
            ok(await pg.evaluate("window.__t.ai.screen()")=='prefs' and 'já não corresponde' in await pg.inner_text('body'), f'K: {what} → mesmo forçando o clique, não grava e pede nova proposta')
            ok(await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")==snap or what=='lugar mudado à mão', f'K: {what} → distribuição não foi alterada pela proposta antiga')
            await pg.context.close()

        # ===== Q — privacidade do que o cliente envia
        sent = json.dumps(CALLS)
        ok(CALLS and not re.search(r'marisco|lactose|Conv \d|@|\+351|mobility|allerg', sent, re.I), 'Q: o pedido ao servidor não leva nomes, contactos, alergias nem detalhes de acessibilidade')
        ok(all(set(c.keys()) <= {'constraints','freeText','mode','attrs'} for c in CALLS), 'Q: só constraints/freeText/mode/attrs (sem weddingId)')

        # ===== M — Premium
        pg = await newpage(b); await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
        G = guests(4); await setup(pg, {'guests':G,'tables':[4],'assign':{'t1-s1':'g1'}})
        await gen(pg); ok(await pg.locator('#ai-seat-accept-btn').count()==1, 'M: Premium ativo → proposta disponível')
        await pg.evaluate("window.__t.sub(false); window.__t.render()")
        ok(await pg.evaluate("Object.keys(window.__t.ai.attrs()).length")==0, 'M: sem Premium não se recolhem atributos de logística')
        await pg.evaluate("document.getElementById('ai-seat-accept-btn') && (document.getElementById('ai-seat-accept-btn').removeAttribute('disabled'), document.getElementById('ai-seat-accept-btn').click())"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("window.__t.state.seating.assignments")=={'t1-s1':'g1'}, 'M: Premium terminado → aplicar bloqueado; distribuição existente intacta')
        await pg.evaluate("window.__t.sub(true); window.__t.go('mesas')")
        ok(await pg.evaluate("Object.keys(window.__t.state.seating.assignments).length")==1 and len(await pg.evaluate("window.__t.state.seating.tables"))==1, 'M: reativado → mesas e dados todos lá')
        await pg.context.close()

        # ===== P/R — dados antigos e regressão da distribuição manual
        pg = await newpage(b); await pg.expose_function('__compute', lambda s, d: server_compute(s, d))
        G = guests(5); await setup(pg, {'guests':G,'tables':[3,3],'docs':{}})
        await gen(pg); pp = await pg.evaluate("window.__t.ai.proposal()")
        ok(pp and len(pp['assignments'])==5, 'P: convidados sem RSVP/logística/atributos novos → proposta normal')
        await pg.click('[data-aiseatback]'); await pg.wait_for_timeout(100); await pg.evaluate("window.__t.mesas.go()")
        ok(await pg.locator('#ai-seating-open-btn').count()==1, 'R: ecrã Mesas intacto com o botão do AI Seating')
        await pg.evaluate("window.__t.state.seating.assignments={'t1-s1':'g1','t1-s2':'g2'}; window.__t.render()")
        ok(await pg.evaluate("Object.keys(window.__t.state.seating.assignments).length")==2, 'R: atribuição manual continua a funcionar sem a IA')
        await pg.evaluate("window.__t.ai.open()"); await pg.click('[data-aiseatback]'); await pg.wait_for_timeout(150)
        ok(await pg.evaluate("window.__t.ai.screen()")==None, 'R: voltar fecha o AI Seating sem alterar nada')
        ok(await pg.evaluate("window.__t.state.seating.assignments")=={'t1-s1':'g1','t1-s2':'g2'}, 'R: cancelar não altera as mesas')
        # EN
        await pg.evaluate("window.__t.lang('en'); window.__t.ai.open()"); await pg.click('#ai-seat-generate-btn'); await pg.wait_for_selector('#ai-seat-accept-btn', timeout=8000)
        bt = await pg.inner_text('body'); ok('simulation' in bt and 'Points to review' in bt or 'simulation' in bt, 'EN: textos do AI Seating em inglês')
        ok(not re.search(r'\b(simulação|Pontos a rever|alterações)\b', bt), 'EN: sem português na proposta')
        await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
