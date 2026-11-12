"""RSVP — crianças declaradas no link ficam confirmadas; confirmados à mão não contam como "por responder".

Bug (Nov 2026, conta demo): o Luís, declarado pela Catarina numa resposta "Vou",
entrava em Convidados → Crianças e no total, mas nunca em "Confirmados".
E a Beatriz, confirmada à mão sem ter aberto o link, contava como pendente
(Health "18 por responder", Assistente "1 convidado ainda não respondeu").
"""
import common
from common import *

EXTRA = r"""
window.__k={ apply:function(){ return applyRSVPResponsesToState(); }, pending:function(){ return flattenAllGuestsForRSVP().filter(isRsvpPending).map(function(g){return g.entry.name;}); },
 sugg:function(){ return getProactiveSuggestions().map(function(s){return s.text;}); } };
"""
APP = common.build_hooked(EXTRA)

SETUP = """()=>{ const t=window.__t, s=t.state;
  s.guests.noiva.familia=[
    {name:'Catarina',guestId:'c',rsvpToken:'t1'},
    {name:'Beatriz',guestId:'b',rsvpToken:'t2'},
    {name:'Diogo',guestId:'d',rsvpToken:'t3'},
    {name:'Sem link',guestId:'z'}];
  s.guests.noiva.custom=[{id:'criancas',label:'Crianças',names:[{name:'Tomás',guestId:'k1',id:'k1',age:4,payingPct:1}]}];
  s.confirmed={b:true};
  t.nt.setRsvp({
    t1:{attending:true,rsvpStatus:'yes',children:[{name:'Luís',age:7,attending:true},{name:'Tomás',age:4,attending:true}]},
    t2:{},
    t3:{attending:false,rsvpStatus:'no',children:[{name:'Ana',age:5,attending:true}]}},true); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b, url=APP.as_uri())
        await pg.evaluate(SETUP)
        await pg.evaluate("window.__k.apply()")
        st = await pg.evaluate("(()=>{const s=window.__t.state; const kids=s.guests.noiva.custom.find(c=>c.id==='criancas').names; return {kids:kids.map(k=>({n:k.name,id:k.guestId,c:!!s.confirmed[k.guestId]})), conf:Object.keys(s.confirmed).sort()};})()")
        kids = {k['n']: k for k in st['kids']}
        ok('Luís' in kids and kids['Luís']['c'], f'criança nova declarada numa resposta "Vou" fica confirmada {st}')
        ok(kids.get('Tomás', {}).get('c'), 'criança já existente adotada pela resposta "Vou" fica confirmada')
        ok(not any(k['n'] == 'Ana' and k['c'] for k in st['kids']), 'criança de quem respondeu "Não vou" não fica confirmada')
        ok('c' in st['conf'] and 'd' not in st['conf'], 'convidado principal: "Vou" confirmado, "Não vou" não')
        # o casal desmarca o Luís à mão: a sincronização seguinte não o volta a confirmar
        await pg.evaluate("(()=>{const s=window.__t.state; const l=s.guests.noiva.custom.find(c=>c.id==='criancas').names.find(k=>k.name==='Luís'); delete s.confirmed[l.guestId];})()")
        await pg.evaluate("window.__k.apply()")
        again = await pg.evaluate("(()=>{const s=window.__t.state; const l=s.guests.noiva.custom.find(c=>c.id==='criancas').names.find(k=>k.name==='Luís'); return !!s.confirmed[l.guestId];})()")
        ok(not again, 'desmarcar à mão é respeitado (não volta a confirmar sozinho)')
        pend = await pg.evaluate("window.__k.pending()")
        ok('Beatriz' not in pend, f'confirmada à mão sem abrir o link não conta como pendente {pend}')
        ok('Sem link' in pend and 'Catarina' not in pend and 'Diogo' not in pend, f'pendentes = só quem não respondeu nem está confirmado {pend}')
        sug = ' '.join(await pg.evaluate("window.__k.sugg()"))
        n = len(pend)
        ok(f'{n} convidado' in sug, f'Assistente usa a mesma contagem de pendentes ({n}): {sug[:120]}')
        hc = await pg.evaluate("window.__t.hc()")
        ok(not pg.errs, f'sem erros {pg.errs[:3]}')
        await b.close()
    summary()

asyncio.run(main())
