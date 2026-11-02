from common import *

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await newpage(b)
        # estado de teste
        await ev(pg,"""()=>{ const t=window.__t, s=t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
          window.__d=d; s.expenses=[{id:'e1',desc:'Quinta',value:'5000',paid:'1000',dueDate:d(-3)},{id:'e2',desc:'Fotógrafo',value:'800',paid:'0',dueDate:d(5)},{id:'e3',desc:'Flores',value:'300',paid:'300',dueDate:d(1)}];
          s.todoCategories=[{id:'c1',label:'Geral',icon:'checklist',items:[{text:'Provar menu',due:d(1),done:false},{text:'Escolher alianças',due:d(-2),done:false},{text:'Já feito',due:d(0),done:true}]}]; }""")
        # 1) 1.ª execução: baseline silenciosa
        await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().length")==0,'1.ª execução não cria avisos (baseline silenciosa)')
        ok(await ev(pg,"!!window.__t.state.notif.init"),'init gravado')
        ok(await ev(pg,"window.__t.nt.run()")==False,'2.ª execução idempotente (nada a alterar)')
        # 2) novos acontecimentos depois da baseline
        await ev(pg,"""()=>{ const s=window.__t.state, d=window.__d; s.expenses.push({id:'e4',desc:'Bolo',value:'400',paid:'0',dueDate:d(-1)}); s.expenses.push({id:'e5',desc:'DJ',value:'600',paid:'0',dueDate:d(2)});
           s.todoCategories[0].items.push({text:'Enviar convites',due:d(0),done:false},{text:'Reservar carro',due:d(3),done:false}); }""")
        await ev(pg,"window.__t.nt.run()")
        its=await ev(pg,"window.__t.nt.items().map(i=>[i.id.split(':').slice(0,2).join(':'),i.prio,i.p.c])")
        print('   itens:',its)
        ids=[i[0] for i in its]
        ok('pay:od' in ids and 'pay:d2' in ids and 'task:d1' in ids and 'task:d3' in ids and 'task:od' not in ids,'fases geradas só para o que é NOVO (o atraso antigo da baseline não reaparece)')
        ok(all(i[1]=='high' for i in its if i[0] in ('pay:od','pay:d2','task:od','task:d1')) and [i for i in its if i[0]=='task:d3'][0][1]=='normal','prioridades: urgentes high, d3 normal')
        n1=len(its)
        await ev(pg,"window.__t.nt.run()"); await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().length")==n1,'repetir execuções NÃO duplica avisos')
        # 3) amanhã: tarefa d3 passa a d1 → novo aviso só para ela; o resto não repete
        tomorrow="new Date(Date.now()+86400000)"
        r=await ev(pg,f"window.__t.nt.run({tomorrow})")
        its2=await ev(pg,"window.__t.nt.items().map(i=>i.id)")
        print('   amanhã novos:',its2[:len(its2)-n1])
        newids=its2[:len(its2)-n1]; ok([i for i in newids if not i.startswith('health')]==[i for i in newids if i.startswith('task:od')],'no dia seguinte só surge o que passou de fase (a tarefa que ficou em atraso); pagamentos/tarefas anteriores não repetem')
        await ev(pg,f"window.__t.nt.run({tomorrow})")
        ok(await ev(pg,"window.__t.nt.items().length")==len(its2),'repetir no mesmo dia continua idempotente')
        # 4) RSVP
        await ev(pg,"""()=>{ const s=window.__t.state; s.guests.noiva.familia=[{name:'Ana',id:'g1',guestId:'g1',rsvpToken:'tok1'},{name:'Bruno',id:'g2',guestId:'g2',rsvpToken:'tok2'},{name:'Carla',id:'g3',guestId:'g3',rsvpToken:'tok3'}]; window.__t.nt.setRsvp({},true); }""")
        await ev(pg,"window.__t.nt.run()")  # baseline rsvp
        base=await ev(pg,"window.__t.nt.items().length")
        await ev(pg,"window.__t.nt.setRsvp({tok1:{attending:true}},true)"); await ev(pg,"window.__t.nt.run()")
        it=await ev(pg,"window.__t.nt.items().find(i=>i.type==='rsvp')")
        ok(it and it['p']['c']==1 and it['k']=='rsvp','1 resposta → 1 aviso individual')
        await ev(pg,"window.__t.nt.setRsvp({tok1:{attending:true},tok2:{attending:false},tok3:{rsvpStatus:'maybe'}},true)"); await ev(pg,"window.__t.nt.run()")
        rs=await ev(pg,"window.__t.nt.items().filter(i=>i.type==='rsvp')")
        ok(len(rs)==1 and rs[0]['p']['c']==3 and rs[0]['r']==0,'mais respostas no mesmo dia FUNDEM-SE no mesmo aviso (3), voltando a não lido')
        await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().filter(i=>i.type==='rsvp')[0].p.c")==3,'RSVP sem novidades não reconta')
        # 5) prazo RSVP
        await ev(pg,"""()=>{ window.__t.nt.setRsvp({tok1:{attending:true}},true); window.__t.nt.setSettings({rsvpDeadline:window.__d(2)}); }""")
        await ev(pg,"window.__t.nt.run()")
        dl=await ev(pg,"window.__t.nt.items().filter(i=>i.type==='rsvpPending'&&i.k==='rsvpdl')")
        ok(len(dl)==1 and dl[0]['prio']=='high','prazo RSVP a 2 dias com pendentes → 1 aviso high')
        await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().filter(i=>i.k==='rsvpdl').length")==1,'prazo RSVP não repete na mesma fase')
        # 6) alterações do par
        await ev(pg,"window.__t.nt.dirty(true)"); await ev(pg,"window.__t.nt.observe(null,null,{weddingDate:'2027-01-01'},{weddingDate:'2027-02-02'})"); await ev(pg,"window.__t.nt.dirty(false)")
        await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().filter(i=>i.type==='change').length")==0,'alteração com gravações locais pendentes NÃO gera aviso (evita falso positivo)')
        await ev(pg,"window.__t.nt.observe(null,null,{weddingDate:'2027-01-01',venue:'A'},{weddingDate:'2027-02-02',venue:'B'})"); await ev(pg,"window.__t.nt.run()")
        ch=await ev(pg,"window.__t.nt.items().filter(i=>i.type==='change').map(i=>[i.p.f,i.prio])")
        ok(sorted(ch)==[['date','high'],['venue','high']],'data e local alterados pelo par → 2 avisos high')
        await ev(pg,"window.__t.nt.observe(null,null,{weddingDate:'2027-01-01'},{weddingDate:'2027-01-01'})"); await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.items().filter(i=>i.type==='change').length")==2,'sem diferença → sem aviso')
        print('errs',pg.errs[:3]); ok(not pg.errs,'sem erros JS')
        await pg.context.close()
        # 7) limite diário
        pg=await newpage(b)
        await ev(pg,"window.__t.nt.run()")
        await ev(pg,"""()=>{ for(let i=0;i<12;i++) window.__t.nt.observe({budget:{total:1000+i}},{budget:{total:2000+i}},null,null); }""")
        await ev(pg,"window.__t.nt.run()")
        # observe coalesce por campo → só 1; usar rsvpdl low/d14 + health? Testar cap com vários tipos normais
        await ev(pg,"""()=>{ const s=window.__t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
           s.todoCategories=[{id:'c',label:'G',icon:'checklist',items:[]}]; }""")
        await pg.context.close()
        # 8) extremos: 500 tarefas e 300 pagamentos em atraso
        pg=await newpage(b)
        await ev(pg,"window.__t.nt.run()")
        await ev(pg,"""()=>{ const s=window.__t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
          s.todoCategories=[{id:'c',label:'G',icon:'checklist',items:Array.from({length:500},(_,i)=>({text:'Tarefa '+i,due:d(-(i%10)),done:false}))}];
          s.expenses=Array.from({length:300},(_,i)=>({id:'x'+i,desc:'Desp '+i,value:'100',paid:'0',dueDate:d(-(i%20))})); }""")
        await ev(pg,"window.__t.nt.run()")
        its=await ev(pg,"window.__t.nt.items()")
        print('   extremos:',[(i['id'],i['p'].get('c')) for i in its]); ok(len([i for i in its if i['type'] in ('task','payment')])<=4 and len(its)<=8,f'500 tarefas + 300 pagamentos em atraso → {len(its)} avisos agrupados (não 800)')
        ok(all(len(i['p'].get('names',[]))<=3 for i in its),'listas de nomes limitadas a 3')
        ok(await ev(pg,"JSON.stringify(window.__t.state.notif).length")<20000,'estado das notificações pequeno')
        # simular 200 dias com novos acontecimentos diários → poda
        await ev(pg,"""()=>{ window.__big=0; }""")
        for day in range(1,181):
            await ev(pg,f"""()=>{{ const s=window.__t.state; const base=new Date(Date.now()+{day}*86400000); const x=new Date(base); x.setDate(x.getDate()+1); s.expenses.push({{id:'n{day}',desc:'Novo {day}',value:'50',paid:'0',dueDate:x.toISOString().slice(0,10)}}); window.__t.nt.run(base); }}""")
        sz=await ev(pg,"[window.__t.state.notif.items.length, Object.keys(window.__t.state.notif.keys).length]")
        print('   após 180 dias:',sz); ok(sz[0]<=60,'itens ≤ 60 após 180 dias'); ok(sz[1]<2000,'chaves podadas (<2000)')
        ok(not pg.errs,'sem erros JS nos extremos '+str(pg.errs[:2]))
        await pg.context.close()
        # 9) estado corrompido
        for bad in ["'x'","null","[]","{items:'x',keys:5,prefs:7,day:1}","{items:[null,5,{id:3},{id:'a',type:'zzz'}]}"]:
            pg=await newpage(b)
            await ev(pg,f"window.__t.state.notif={bad}")
            try:
                await ev(pg,"window.__t.nt.run(); window.__t.nt.open(); window.__t.nt.close(); window.__t.go('inicio')")
                ok(not pg.errs,f'estado corrompido notif={bad[:30]} sem erros')
            except Exception as e: ok(False,f'corrompido {bad}: {str(e)[:80]}')
            await pg.context.close()
        print(f'\n{sum(CHECKS)}/{len(CHECKS)} OK'); sys.exit(0 if all(CHECKS) else 1); await b.close()
asyncio.run(main())
