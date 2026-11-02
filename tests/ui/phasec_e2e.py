"""Fase C — E2E real entre módulos: o rsvp.html REAL produz as escritas, aplicadas a um "Firestore" partilhado
(semântica de caminhos com ponto e apagar campo), e a app do casal REAL consome o documento resultante
(logística, mesas, Wedding Health, Premium). Testes A, B, C, D, F, I, J + 768 px."""
from common import *
import json, copy, datetime

STUB = """
(function(){
  window.__updates=[]; const DEL={__del:true};
  const docRef=()=>({get:()=>Promise.resolve({exists:true,data:()=>JSON.parse(JSON.stringify(window.__guest))}),
     update:(u)=>{ window.__updates.push(JSON.parse(JSON.stringify(u,(k,v)=>v===DEL?'__DELETE__':v))); return Promise.resolve(); },set:()=>Promise.resolve()});
  const col=()=>({doc:docRef,where:()=>({get:()=>Promise.resolve({docs:[]})}),add:()=>Promise.resolve()});
  const fs=()=>({collection:col}); fs.FieldValue={serverTimestamp:()=>'ts',delete:()=>DEL};
  const fnsApp={httpsCallable:()=>()=>Promise.resolve({data:{version:'v1',text:'x',people:[]}})};
  window.firebase={initializeApp:()=>{},firestore:fs,storage:()=>({ref:()=>({})}),functions:()=>fnsApp,app:()=>({functions:()=>fnsApp})};
})();
"""
BASE = {'weddingId':'W1','coupleName1':'Ana','coupleName2':'Rui','weddingDate':'2027-07-01','venue':'Quinta'}

def apply_update(doc, upd):
    for k, v in upd.items():
        parts = k.split('.'); o = doc
        for p in parts[:-1]:
            o = o.setdefault(p, {})
        if v == '__DELETE__': o.pop(parts[-1], None)
        else: o[parts[-1]] = v
    return doc

async def rsvp(b, doc, fn, w=390, h=844):
    ctx = await b.new_context(viewport={'width':w,'height':h}); pg = await ctx.new_page(); pg.errs=[]
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
    await pg.add_init_script("window.__guest=" + json.dumps(doc) + ";" + STUB)
    await pg.goto(ROOT.as_uri()+'/rsvp.html?g=tokenGuest0001'); await pg.wait_for_selector('#form-state:not(.state-hidden)', timeout=5000)
    await fn(pg)
    ups = [u for u in await pg.evaluate('window.__updates') if ('attending' in u) or any(k.startswith('responses.') for k in u) or ('logistics' in u)]
    errs = list(pg.errs); await ctx.close()
    new = copy.deepcopy(doc)
    for u in ups: apply_update(new, u)
    return new, errs

async def fill_single(pg, yes=True, allergy='marisco'):
    await pg.click('#attend-seg button[data-attend=yes]')
    await pg.select_option('#meal-select','carne')
    await pg.click('#toggle-transporte'); await pg.click('#toggle-alojamento')
    await pg.fill('[data-lg="transport.from"]','Porto'); await pg.fill('[data-lg="transport.people"]','2'); await pg.select_option('[data-lg="transport.pref"]','ida-volta')
    await pg.fill('[data-lg="lodging.arrive"]','2027-06-30'); await pg.fill('[data-lg="lodging.depart"]','2027-07-02'); await pg.fill('[data-lg="lodging.nights"]','2')
    await pg.click('[data-lgtoggle=food]'); await pg.fill('[data-lg="food.allergies"]',allergy); await pg.fill('[data-lg="food.intolerances"]','lactose'); await pg.click('[data-lgdiet=vegan]')
    await pg.click('[data-lgtoggle=access]'); await pg.check('[data-lgcheck="access.mobility"]')
    await pg.click('#add-child-btn'); await pg.fill('.child-name','Zé'); await pg.fill('.child-age','3'); await pg.press('.child-age','Tab'); await pg.check('[data-flag=highchair]')
    await pg.click('#send-btn'); await pg.wait_for_timeout(250)

def app_state(entries, assign=None):
    return """(a)=>{ const t=window.__t, s=t.state; s.guests.noiva.familia=a.entries;
      s.seating.tables=[{id:1,seats:6,shape:'round',notes:''},{id:2,seats:6,shape:'round',notes:''}]; s.seating.assignments=a.assign||{}; t.nt.setRsvp(a.docs,true); }"""

async def couple(pg, entries, docs, assign=None):
    await pg.evaluate(app_state(entries), {'entries':entries,'docs':docs,'assign':assign or {}})

def days(n): return (datetime.date.today()+datetime.timedelta(days=n)).isoformat()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ================= A — individual, ponta a ponta
        doc = {**BASE, 'name':'Ana Convidada'}
        doc, errs = await rsvp(b, doc, fill_single)
        ok(not errs, f'A: RSVP sem erros JS {errs[:1]}')
        lg = doc.get('logistics') or {}
        ok(doc['attending'] is True and doc['transporte'] and doc['alojamento'] and lg['transport']['from']=='Porto' and lg['food']['allergies']==['marisco'] and lg['access']=={'mobility':True} and doc['children'][0]['highchair'], 'A: o RSVP real gravou transporte, alojamento, alimentação, acessibilidade e criança')
        for name,(w,h) in {'m':(390,844),'t':(768,900),'d':(1360,900)}.items():
            pg = await newpage(b, w, h, mode='app')
            await couple(pg, [{'name':'Ana','guestId':'a','rsvpToken':'t1'}], {'t1':doc}, {'t1-s1':'a'})
            await pg.evaluate("window.__t.setDate((()=>{const x=new Date(); x.setDate(x.getDate()+60); return x.toISOString().slice(0,10);})())")
            await pg.evaluate("window.__t.lg.screen()")
            nums = dict(await pg.evaluate("[...document.querySelectorAll('.logi-sum-row')].map(r=>[r.querySelector('.logi-sum-l').textContent, r.querySelector('.logi-sum-n').textContent])"))
            ok(nums['Transporte']=='1' and nums['Alojamento']=='1' and nums['Alimentação']=='1' and nums['Necessidades especiais']=='1' and nums['Crianças']=='1', f'A[{name}]: contagens do casal batem com o que o convidado indicou {nums}')
            txt = await pg.inner_text('#logi-list')
            ok('Alergias: marisco' in txt and 'Intolerâncias' in txt and 'vegano' in txt and 'cadeira de bebé' in txt and 'mobilidade reduzida' in txt and 'Porto' in txt and '30/06 → 02/07' in txt, f'A[{name}]: detalhe completo')
            ok(not await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth"), f'A[{name}]: sem overflow horizontal')
            await pg.evaluate("window.__t.mesas.open(1); window.__t.mesas.go()")
            body = await pg.inner_text('body')
            ok('alergia' in body and 'acessibilidade' in body and '1 criança' in body, f'A[{name}]: mesas mostram alergia, acessibilidade e criança')
            hc = [c for c in await pg.evaluate("window.__t.hc()") if c['id']=='logistics']
            ok(len(hc)==1 and '1 convidado' in hc[0]['text'], f'A[{name}]: Wedding Health conta 1 convidado {hc}')
            errs=[e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]; ok(not errs, f'A[{name}]: app sem erros JS {errs[:1]}')
            await pg.screenshot(path=str(SHOTS/f'phasec_a_{name}.png'), full_page=True)
            await pg.context.close()
        # ================= C — alteração de RSVP + "organizado" desatualizado
        pg = await newpage(b); await couple(pg, [{'name':'Ana','guestId':'a','rsvpToken':'t1'}], {'t1':doc}, {'t1-s1':'a'})
        await pg.evaluate("window.__t.setDate((()=>{const x=new Date(); x.setDate(x.getDate()+30); return x.toISOString().slice(0,10);})()); window.__t.lg.screen()")
        for f in ('transport','lodging','needs'):
            await pg.click(f'[data-logifollow^="noiva|familia|0|{f}"]')
        ok(await pg.evaluate("window.__t.lg.all().every(x=>!x.todo)"), 'C: casal marca tudo como organizado')
        ok(not any(c['id']=='logistics' for c in await pg.evaluate("window.__t.hc()")), 'C: Health sem aviso quando está tudo organizado')
        logi = await pg.evaluate("window.__t.state.guests.noiva.familia[0].logi")
        # o convidado muda só a alergia
        async def change_allergy(pg2):
            await pg2.fill('[data-lg="food.allergies"]','marisco, nozes'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        doc2, _ = await rsvp(b, doc, change_allergy)
        ok(doc2['logistics']['food']['allergies']==['marisco','nozes'] and doc2['logistics']['transport']==doc['logistics']['transport'], 'C: alterar só a alimentação não toca no resto da logística')
        await pg.evaluate("(a)=>{ window.__t.nt.setRsvp({t1:a},true); window.__t.lg.screen(); }", doc2)
        todo = await pg.evaluate("window.__t.lg.all().map(x=>x.todo)")
        txt = await pg.inner_text('#logi-list')
        ok(todo==[True] and 'nozes' in txt, 'C: depois de o convidado mudar a alergia, "necessidades" volta a por organizar (nada fica organizado com dados antigos)')
        ok('transport' in (await pg.evaluate("window.__t.state.guests.noiva.familia[0].logi") or {}) and 'Transporte · organizado' in txt, 'C: transporte, que não mudou, continua organizado')
        ok(any(c['id']=='logistics' for c in await pg.evaluate("window.__t.hc()")), 'C: Health volta a avisar')
        # o convidado deixa de comparecer
        async def to_no(pg2):
            await pg2.click('#attend-seg button[data-attend=no]'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        doc3, _ = await rsvp(b, doc2, to_no)
        ok(doc3['attending'] is False and 'logistics' not in doc3 and doc3['transporte'] is False and doc3['children']==[], 'C: "não vou" apaga a logística e os campos antigos de necessidades')
        await pg.evaluate("(a)=>{ window.__t.nt.setRsvp({t1:a},true); window.__t.mesas.open(1); window.__t.mesas.go(); }", doc3)
        ok(await pg.evaluate("window.__t.lg.all().length")==0 and await pg.locator('.seat-tag').count()==0, 'C: casal deixa de ver necessidades e etiquetas das mesas')
        ok(not any(c['id']=='logistics' for c in await pg.evaluate("window.__t.hc()")), 'C: Health sem aviso')
        # volta a "sim" sem preencher: não recria logística
        async def back_yes(pg2):
            await pg2.click('#attend-seg button[data-attend=yes]'); await pg2.select_option('#meal-select','peixe'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        doc4, _ = await rsvp(b, doc3, back_yes)
        ok(doc4['attending'] is True and 'logistics' not in doc4, 'C: voltar a "sim" sem preencher não cria logística')
        await pg.context.close()
        # ================= B — família: isolamento entre membros
        fam = {**BASE, 'name':'Silva','isFamily':True,'members':[{'rsvpMemberId':'m1','guestId':'g1','name':'Joao'},{'rsvpMemberId':'m2','guestId':'g2','name':'Rita'},{'rsvpMemberId':'m3','guestId':'g3','name':'Pedro'}],'responses':{}}
        async def fam_fill(pg2):
            for m in ('m1','m2','m3'): await pg2.click(f'[data-mattend=yes][data-mid={m}]'); await pg2.select_option(f'select[data-mfield=meal][data-mid={m}]','peixe')
            await pg2.click('[data-mtoggle=transporte][data-mid=m1]'); await pg2.fill('[data-lgmid=m1] [data-lg="transport.from"]','Lisboa')
            await pg2.click('[data-lgmid=m2] [data-lgtoggle=food]'); await pg2.fill('[data-lgmid=m2] [data-lg="food.allergies"]','amendoim')
            await pg2.click('[data-lgmid=m3] [data-lgtoggle=access]'); await pg2.check('[data-lgmid=m3] [data-lgcheck="access.mobility"]')
            await pg2.click('[data-addmemberchild=m1]'); await pg2.fill('.child-name','Rui'); await pg2.fill('.child-age','8'); await pg2.press('.child-age','Tab'); await pg2.check('[data-flag=kidsMeal]')
            await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        famd, errs = await rsvp(b, fam, fam_fill); ok(not errs, 'B: RSVP familiar sem erros JS')
        r = famd['responses']
        ok(r['m1']['logistics']['transport']['from']=='Lisboa' and 'food' not in r['m1']['logistics'] and r['m1']['children'][0]['kidsMeal'], 'B: membro 1 só com transporte e criança')
        ok(r['m2']['logistics']=={'v':1,'food':{'allergies':['amendoim']}} and r['m2']['transporte'] is False, 'B: membro 2 só com alergia')
        ok(r['m3']['logistics']=={'v':1,'access':{'mobility':True}}, 'B: membro 3 só com acessibilidade')
        # reabrir e alterar só o membro 2: m1 e m3 ficam byte a byte iguais
        async def edit_m2(pg2):
            await pg2.fill('[data-lgmid=m2] [data-lg="food.allergies"]','soja'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        famd2, _ = await rsvp(b, famd, edit_m2)
        ok(json.dumps(famd2['responses']['m1'],sort_keys=True)==json.dumps(famd['responses']['m1'],sort_keys=True) and json.dumps(famd2['responses']['m3'],sort_keys=True)==json.dumps(famd['responses']['m3'],sort_keys=True) and famd2['responses']['m2']['logistics']['food']['allergies']==['soja'], 'B: alterar um membro não apaga nem altera os restantes')
        # um membro passa a "não": só a sua logística desaparece
        async def m2_no(pg2):
            await pg2.click('[data-mattend=no][data-mid=m2]'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        famd3, _ = await rsvp(b, famd2, m2_no)
        ok(famd3['responses']['m2']['attending'] is False and 'logistics' not in famd3['responses']['m2'] and famd3['responses']['m1']==famd2['responses']['m1'], 'B: membro que recusa perde só a sua logística')
        entries = [{'name':'Joao','guestId':'g1','rsvpToken':'tf','rsvpMemberId':'m1'},{'name':'Rita','guestId':'g2','rsvpToken':'tf','rsvpMemberId':'m2'},{'name':'Pedro','guestId':'g3','rsvpToken':'tf','rsvpMemberId':'m3'}]
        for name,(w,h) in {'m':(390,844),'t':(768,900),'d':(1360,900)}.items():
            pg = await newpage(b, w, h, mode='app')
            await couple(pg, entries, {'tf':famd2}, {'t1-s1':'g1','t2-s1':'g2','t1-s2':'g3'})
            await pg.evaluate("window.__t.setDate((()=>{const x=new Date(); x.setDate(x.getDate()+60); return x.toISOString().slice(0,10);})()); window.__t.lg.screen()")
            nums = dict(await pg.evaluate("[...document.querySelectorAll('.logi-sum-row')].map(r=>[r.querySelector('.logi-sum-l').textContent, r.querySelector('.logi-sum-n').textContent])"))
            ok(nums['Transporte']=='1' and nums['Alimentação']=='1' and nums['Necessidades especiais']=='1' and nums['Crianças']=='1' and nums['Famílias e grupos']=='1', f'B[{name}]: contagens por pessoa e 1 família {nums}')
            lst = await pg.evaluate("[...document.querySelectorAll('#logi-list .rsvp-row-name')].map(e=>e.textContent)")
            ok(lst==['Joao','Rita','Pedro'], f'B[{name}]: 3 pessoas, sem duplicados {lst}')
            await pg.click('.logi-sum-row[data-logifilter=food]')
            lst = await pg.evaluate("[...document.querySelectorAll('#logi-list .rsvp-row-name')].map(e=>e.textContent)")
            ok(lst==['Rita'], f'B[{name}]: filtro alimentação = lista filtrada coerente com o total {lst}')
            hc = [c for c in await pg.evaluate("window.__t.hc()") if c['id']=='logistics']
            ok(len(hc)==1 and '3 convidados' in hc[0]['text'], f'B[{name}]: Health conta 3 pessoas (1 por membro, sem duplicar a família) {hc}')
            await pg.evaluate("window.__t.mesas.open(1); window.__t.mesas.open(2); window.__t.mesas.go()")
            hints = await pg.evaluate("[...document.querySelectorAll('[data-logihint]')].map(e=>e.textContent)")
            ok(any('Silva' in h and 'Mesa 1' in h and 'Mesa 2' in h for h in hints), f'B[{name}]: sugestão de família separada {hints}')
            ok(await pg.evaluate("JSON.stringify(window.__t.state.seating.assignments)")==json.dumps({'t1-s1':'g1','t2-s1':'g2','t1-s2':'g3'},separators=(',',':')), f'B[{name}]: lugares intactos')
            ok(not await pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth"), f'B[{name}]: sem overflow')
            await pg.context.close()
        # ---- H2: dois dispositivos da mesma família (o segundo tem o estado desatualizado)
        async def only_m2(pg2):
            await pg2.fill('[data-lgmid=m2] [data-lg="food.allergies"]','ovo'); await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
            ups=[u for u in await pg2.evaluate('window.__updates') if any(k.startswith('responses.') for k in u)]
            pg2.keys = sorted(k for u in ups for k in u if k.startswith('responses.'))
            only_m2.keys = pg2.keys
        # (famd2 tem m2 com alergia; carregado como "desatualizado")
        stale = copy.deepcopy(famd2); stale['responses']['m2']['logistics']={'v':1,'food':{'allergies':['soja']}}
        newer = copy.deepcopy(stale); newer['responses']['m1']['logistics']={'v':1,'transport':{'from':'Faro'}}   # o outro familiar mudou m1 entretanto
        out, _ = await rsvp(b, stale, only_m2)
        ok(only_m2.keys==['responses.m2'], f'H2: só o membro alterado é escrito {only_m2.keys}')
        merged = copy.deepcopy(newer)
        # aplica as escritas do dispositivo desatualizado sobre o estado mais recente do servidor
        ups_keys = {k:out['responses'][k.split('.')[1]] for k in only_m2.keys}
        for k,v in ups_keys.items(): apply_update(merged,{k:v})
        ok(merged['responses']['m1']['logistics']['transport']['from']=='Faro' and merged['responses']['m2']['logistics']['food']['allergies']==['ovo'], 'H2: a alteração do outro dispositivo (m1) não foi apagada')
        # ---- K: tokens inválidos / submissão duplicada
        ctx = await b.new_context(viewport={'width':390,'height':844}); pgk = await ctx.new_page()
        await pgk.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file://') else r.abort())
        await pgk.add_init_script("window.__guest={};"+STUB.replace("exists:true","exists:false"))
        await pgk.goto(ROOT.as_uri()+'/rsvp.html?g=naoExiste12345'); await pgk.wait_for_timeout(600)
        ok(await pgk.is_visible('#error-state') and not await pgk.is_visible('#form-state'), 'K: token inexistente → ecrã de erro, sem formulário')
        for bad in ['', '?g=a/b', '?g='+'x'*300]:
            await pgk.goto(ROOT.as_uri()+'/rsvp.html'+bad); await pgk.wait_for_timeout(300)
            ok(await pgk.is_visible('#error-state'), f'K: token inválido {bad[:12]!r} → erro')
        await ctx.close()
        async def dbl(pg2):
            await pg2.click('#attend-seg button[data-attend=yes]'); await pg2.select_option('#meal-select','carne')
            await pg2.evaluate("()=>{ const b=document.getElementById('send-btn'); b.click(); b.click(); }"); await pg2.wait_for_timeout(300)
            dbl.n = len([u for u in await pg2.evaluate('window.__updates') if 'attending' in u])
        await rsvp(b, {**BASE,'name':'D'}, dbl)
        ok(dbl.n==1, f'K: duplo clique em enviar → 1 só escrita ({dbl.n})')
        # ================= D — eliminação pelo casal (lado local) + membros
        pg = await newpage(b, mode='app')
        await couple(pg, entries, {'tf':famd2}, {'t1-s1':'g1','t2-s1':'g2','t1-s2':'g3'})
        await pg.evaluate("window.__t.setDate((()=>{const x=new Date(); x.setDate(x.getDate()+60); return x.toISOString().slice(0,10);})())")
        # remover membro Rita (g2): sai a entrada e a resposta (como deleteGuestRSVPDoc faz) e o lugar
        await pg.evaluate("""()=>{ const t=window.__t, s=t.state; s.guests.noiva.familia=s.guests.noiva.familia.filter(e=>e.guestId!=='g2'); delete s.seating.assignments['t2-s1'];
           const d=JSON.parse(JSON.stringify(t.nt.docs?t.nt.docs():{})); }""")
        d_after = copy.deepcopy(famd2); d_after['responses'].pop('m2'); d_after['members'] = [m for m in d_after['members'] if m['rsvpMemberId']!='m2']
        await pg.evaluate("(a)=>{ window.__t.nt.setRsvp({tf:a},true); window.__t.mesas.open(1); window.__t.mesas.go(); }", d_after)
        ok(await pg.evaluate("window.__t.lg.all().map(x=>x.name).join()")=='Joao,Pedro', 'D: membro removido deixa de contar na logística')
        hc = [c for c in await pg.evaluate("window.__t.hc()") if c['id']=='logistics']
        ok(len(hc)==1 and '2 convidados' in hc[0]['text'], 'D: Health recalcula (2 pessoas)')
        ok('amendoim' not in await pg.inner_text('body') and 'soja' not in await pg.inner_text('body'), 'D: nada da logística do membro removido fica visível')
        # remover a família toda
        await pg.evaluate("()=>{ const t=window.__t, s=t.state; s.guests.noiva.familia=[]; s.seating.assignments={}; t.nt.setRsvp({},true); window.__t.mesas.go(); }")
        ok(await pg.locator('.seat-tag').count()==0 and await pg.locator('[data-logihint]').count()==0 and not any(c['id']=='logistics' for c in await pg.evaluate("window.__t.hc()")), 'D: família removida — sem etiquetas, sugestões nem aviso')
        await pg.context.close()
        # ================= F — janela de 120 dias (Health)
        pg = await newpage(b, mode='app')
        gd = {**BASE,'attending':True,'rsvpStatus':'yes','meal':'carne','transporte':True,'children':[],'logistics':{'v':1,'transport':{'from':'X'}}}
        await couple(pg, [{'name':'A','guestId':'a','rsvpToken':'t1'},{'name':'B','guestId':'b','rsvpToken':'t2'}], {'t1':gd,'t2':{**gd,'attending':False,'rsvpStatus':'no','transporte':False,'logistics':None}})
        async def hc_at(n):
            if n is None: await pg.evaluate("window.__t.setDate('')")
            else: await pg.evaluate("(d)=>window.__t.setDate(d)", days(n))
            return [c for c in await pg.evaluate("window.__t.hc()") if c['id']=='logistics']
        ok(len(await hc_at(120))==1, 'F: exatamente 120 dias → avisa')
        ok(len(await hc_at(121))==0, 'F: 121 dias → não avisa')
        ok(len(await hc_at(0))==1, 'F: no próprio dia → avisa')
        ok(len(await hc_at(-1))==0, 'F: data passada → não avisa')
        ok(len(await hc_at(None))==0, 'F: sem data → não avisa')
        h = await hc_at(30); ok(len(h)==1 and '1 convidado ' in h[0]['text'], f'F: não conta quem não comparece {h}')
        await pg.evaluate("(a)=>window.__t.nt.setRsvp({t1:a,t2:{}},true)", {'weddingId':'W1','attending':True,'rsvpStatus':'yes','meal':'carne','children':[],'transporte':False})
        ok(len(await hc_at(30))==0, 'F: confirmado sem necessidades de logística → não conta')
        # ================= I — Premium termina e volta
        await pg.evaluate("(a)=>{ window.__t.nt.setRsvp({t1:a},true); }", gd)
        await hc_at(30); ok(len(await hc_at(30))==1, 'I: com Premium o aviso existe')
        await pg.evaluate("window.__t.sub(false)")
        ok(len(await hc_at(30))==0, 'I: sem Premium o aviso e as etiquetas escondem-se')
        await pg.evaluate("window.__t.mesas.go()"); ok(await pg.locator('.seat-tag').count()==0, 'I: sem Premium as mesas não mostram etiquetas')
        ok(await pg.evaluate("window.__t.nt.setRsvp && JSON.stringify(window.__t.state.guests.noiva.familia[0].logi||null)")=='null', 'I: os dados do casal não foram apagados ao expirar')
        await pg.evaluate("window.__t.sub(true)"); ok(len(await hc_at(30))==1, 'I: com Premium outra vez, tudo volta sem perda')
        await pg.context.close()
        # ================= J — documentos antigos
        old_single = {**BASE,'name':'Velho','attending':True,'rsvpStatus':'yes','meal':'carne','dietary':'sem marisco','transporte':True,'alojamento':False,'children':[{'name':'Zé','age':3,'attending':True}]}
        old_fam = {**BASE,'name':'Antiga','isFamily':True,'members':[{'guestId':'o1','name':'O1'},{'guestId':'o2','name':'O2'}],'responses':{'o1':{'attending':True,'meal':'carne','transporte':True,'children':[]},'o2':{'attending':True,'meal':'peixe','dietary':'vegetariano'}}}
        # formato antigo na app: o convite de família antigo usa guestId como id do membro (rsvpMemberId = o1/o2)
        async def noop(pg2): pass
        for dname, d in (('individual',old_single),('família',old_fam)):
            nd, errs = await rsvp(b, d, noop); ok(not errs, f'J: rsvp.html abre documento antigo ({dname}) sem erros')
        async def old_resubmit(pg2):
            await pg2.click('#send-btn'); await pg2.wait_for_timeout(250)
        nd, _ = await rsvp(b, old_single, old_resubmit)
        ok('logistics' not in nd and nd['dietary']=='sem marisco' and nd['children'][0]['name']=='Zé' and nd['transporte'] is True, 'J: reenviar um documento antigo não inventa logística nem perde dados')
        for name,(w,h) in {'m':(390,844),'t':(768,900),'d':(1360,900)}.items():
            pg = await newpage(b, w, h, mode='app')
            await couple(pg, [{'name':'Velho','guestId':'v','rsvpToken':'ts'},{'name':'O1','guestId':'g1','rsvpToken':'tfo','rsvpMemberId':'o1'},{'name':'O2','guestId':'g2','rsvpToken':'tfo','rsvpMemberId':'o2'}], {'ts':old_single,'tfo':old_fam}, {'t1-s1':'v'})
            await pg.evaluate("window.__t.setDate((()=>{const x=new Date(); x.setDate(x.getDate()+60); return x.toISOString().slice(0,10);})()); window.__t.lg.screen()")
            txt = await pg.inner_text('#logi-list')
            ok('Nota (resposta anterior): sem marisco' in txt and 'Transporte' in txt and 'vegetariano' in txt, f'J[{name}]: antigos aparecem (transporte e nota livre) sem erro')
            await pg.evaluate("window.__t.mesas.open(1); window.__t.mesas.go()"); await pg.wait_for_timeout(100)
            errs=[e for e in pg.errs if 'writeWeddingPayloadSafely' not in e]; ok(not errs, f'J[{name}]: sem erros JS {errs[:1]}')
            await pg.context.close()
        await b.close()
    summary()
asyncio.run(main())
