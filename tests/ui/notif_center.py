from common import *
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # A) limite diário
        pg=await newpage(b)
        await ev(pg,"window.__t.nt.run()")
        await ev(pg,"""()=>{ const s=window.__t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
          s.guests.noiva.familia=[{name:'Ana',id:'g1',guestId:'g1',rsvpToken:'t1'}]; window.__t.nt.setRsvp({},true); window.__t.nt.run();
          window.__t.nt.setSettings({rsvpDeadline:d(6)});
          s.todoCategories=[{id:'c',label:'G',icon:'checklist',items:[{text:'A',due:d(3),done:false}]}];
          s.expenses=[{id:'e',desc:'Flores',value:'100',paid:'0',dueDate:d(6)}];
          window.__t.nt.observe({budget:{total:1}},{budget:{total:2}},null,null); }""")
        await ev(pg,"window.__t.nt.run()")
        its=await ev(pg,"window.__t.nt.items().filter(i=>i.prio!=='high').map(i=>i.id.split(':')[0])")
        print('   normais/baixas hoje:',its)
        ok(len(its)<=4,'limite diário: no máximo 4 avisos não urgentes por dia')
        n=len(its)
        await ev(pg,"window.__t.nt.run(new Date(Date.now()+86400000))")
        its2=await ev(pg,"window.__t.nt.items().filter(i=>i.prio!=='high').map(i=>i.id.split(':')[0])")
        ok(len(its2)>=n and len(its2)-n<=4,f'o que ficou de fora volta no dia seguinte, também limitado ({len(its2)-n} novos)')
        ok(not pg.errs,'sem erros '+str(pg.errs[:2])); await pg.context.close()
        # B) preferências, lidas, dispensar
        pg=await newpage(b)
        await ev(pg,"window.__t.nt.run()")
        await ev(pg,"""()=>{ const s=window.__t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
          s.expenses=[{id:'e',desc:'Quinta',value:'100',paid:'0',dueDate:d(-1)}]; s.todoCategories=[{id:'c',label:'G',icon:'checklist',items:[{text:'Provar',due:d(3),done:false}]}]; }""")
        await ev(pg,"window.__t.nt.run()")
        ok(await ev(pg,"window.__t.nt.unread()")>=2,'avisos novos não lidos')
        # UI: sino
        await pg.evaluate("document.getElementById('payment-alert-popup').classList.remove('show')")
        bell=await pg.locator('[data-ntbell]').count()
        ok(bell>=1,'sino na Home'); ok(await pg.locator('[data-ntbell] .nt-dot').count()==1,'ponto de não lidas visível')
        lbl=await pg.locator('[data-ntbell]').first.get_attribute('aria-label'); print('   aria:',lbl); ok('nova' in lbl,'aria-label com contagem')
        await pg.screenshot(path=str(SHOTS/'home_390.png'))
        await pg.click('[data-ntbell]'); await pg.wait_for_timeout(200)
        ok(await ev(pg,"window.__t.nt.isOpen()"),'centro abre')
        txt=await pg.evaluate("document.getElementById('nt-overlay').innerText"); print('   ',txt[:300].replace('\n',' | '))
        await pg.screenshot(path=str(SHOTS/'center_390.png'))
        # abrir preferências
        await pg.evaluate("document.querySelector('.nt-prefs').open=true"); await pg.wait_for_timeout(100)
        await pg.screenshot(path=str(SHOTS/'prefs_390.png'), full_page=False)
        # tipo pagamentos off
        await pg.evaluate("document.querySelector('[data-ntpref=\"type:payment\"]').click()"); await pg.wait_for_timeout(150)
        pf=await ev(pg,"window.__t.nt.prefs().types.payment"); ok(pf==False,'preferência por tipo desliga pagamentos')
        vis=await pg.evaluate("[...document.querySelectorAll('.nt-ti')].map(e=>e.textContent)"); print('   visíveis:',vis)
        ok(not any('pagamento' in v for v in vis),'avisos de pagamentos escondidos')
        await pg.evaluate("document.querySelector('[data-ntpref=\"type:payment\"]').click()"); await pg.wait_for_timeout(100)
        # nível mínimo = só urgente
        await pg.evaluate("(()=>{const e=document.querySelector('select[data-ntpref=\"min\"]'); e.value='high'; e.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(150)
        vis=await pg.evaluate("[...document.querySelectorAll('.nt-ti')].map(e=>e.textContent)"); print('   só urgentes:',vis)
        ok(len(vis)>=1 and all(('atraso' in v or 'breve' in v or 'hoje' in v) for v in vis),'nível "só o urgente" esconde os normais')
        await pg.evaluate("(()=>{const e=document.querySelector('select[data-ntpref=\"min\"]'); e.value='low'; e.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(100)
        # marcar como lida ao abrir + navegar
        await pg.click('.nt-main >> nth=0'); await pg.wait_for_timeout(250)
        ok(not await ev(pg,"window.__t.nt.isOpen()"),'tocar num aviso fecha o centro e navega')
        tab=await ev(pg,"document.querySelector('.tabpanel.active')?.dataset.panel"); print('   separador:',tab)
        ok(tab in ('gastos','todo'),'navegou para o ecrã certo ('+str(tab)+')')
        unread_after=await ev(pg,"window.__t.nt.unread()"); ok(unread_after==2,'o aviso aberto ficou lido (de 3 restam 2)')
        # marcar todas
        await ev(pg,"window.__t.go('inicio')"); await pg.evaluate("document.getElementById('payment-alert-popup').classList.remove('show')")
        await pg.click('[data-ntbell]'); await pg.wait_for_timeout(150); await pg.click('[data-ntreadall]'); await pg.wait_for_timeout(150)
        ok(await ev(pg,"window.__t.nt.unread()")==0,'marcar todas como lidas'); ok(await pg.locator('[data-ntbell] .nt-dot').count()==0,'ponto desaparece')
        await pg.screenshot(path=str(SHOTS/'center_read_390.png'))
        # dispensar
        await pg.click('.nt-x >> nth=0'); await pg.wait_for_timeout(150)
        ok(await ev(pg,"window.__t.nt.items().filter(i=>i.x).length")==1,'dispensar')
        # persistência no estado (sincroniza entre dispositivos)
        ok(await ev(pg,"JSON.parse(JSON.stringify(window.__t.state)).notif.items.some(i=>i.r===1)"),'lidas guardadas em state.notif')
        # Escape e voltar
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100); ok(not await ev(pg,"window.__t.nt.isOpen()"),'Esc fecha')
        await pg.click('[data-ntbell]'); await pg.wait_for_timeout(100); ok(await ev(pg,"window.__t.back()"),'botão voltar do Android fecha'); ok(not await ev(pg,"window.__t.nt.isOpen()"),'… e fecha mesmo')
        # tudo desligado
        await pg.click('[data-ntbell]'); await pg.wait_for_timeout(100); await pg.evaluate("document.querySelector('.nt-prefs').open=true"); await pg.evaluate("document.querySelector('[data-ntpref=\"on\"]').click()"); await pg.wait_for_timeout(150)
        ok(await ev(pg,"window.__t.nt.unread()")==0,'notificações desligadas → 0 não lidas'); print('   ',(await pg.evaluate("document.getElementById('nt-overlay').innerText"))[:120].replace('\n',' | '))
        ok(not pg.errs,'sem erros '+str(pg.errs[:2])); await pg.context.close()
        # C) desktop + EN
        pg=await newpage(b,1360,900)
        await ev(pg,"window.__t.nt.run()")
        await ev(pg,"""()=>{ const s=window.__t.state; const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
          s.expenses=[{id:'e',desc:'Quinta',value:'100',paid:'0',dueDate:d(-1)}]; s.todoCategories=[{id:'c',label:'G',icon:'checklist',items:[{text:'Provar',due:d(0),done:false}]}]; window.__t.lang('en'); }""")
        await ev(pg,"window.__t.nt.run()"); await ev(pg,"window.__t.go('inicio')")
        await pg.evaluate("document.getElementById('payment-alert-popup').classList.remove('show')")
        await pg.click('[data-ntbell]'); await pg.wait_for_timeout(200)
        t=await pg.evaluate("document.getElementById('nt-overlay').innerText"); print('   EN:',t[:260].replace('\n',' | '))
        ok('overdue' in t and 'Notifications' in t and 'Mark all as read' in t,'inglês completo')
        await pg.screenshot(path=str(SHOTS/'center_1360_en.png'))
        ov=await ev(pg,"document.documentElement.scrollWidth-innerWidth"); ok(ov<=1,'sem overflow horizontal desktop')
        await pg.context.close()
        # D) avisos do dispositivo (mock Notification + SW)
        pg=await newpage(b)
        await pg.evaluate("""()=>{ window.__shown=[]; window.Notification=function(){}; Notification.permission='granted'; Notification.requestPermission=async()=>'granted';
           Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve({showNotification:(t,o)=>{window.__shown.push([t,o.body,o.tag]);return Promise.resolve();}})},configurable:true}); }""")
        await ev(pg,"window.__t.nt.run()")
        await pg.evaluate("window.__t.state.notif.prefs={quiet:{on:false}}")
        ok(await pg.evaluate("localStorage.setItem('weddy_nt_device_W','1'),true"),'dispositivo ativado (simulado)')
        hi=lambda i,pri='high':f"{{id:'x{i}',type:'payment',prio:'{pri}',k:'pay',p:{{stage:'od',c:1,amt:10,names:['A']}},at:new Date().toISOString(),r:0,x:0}}"
        await pg.evaluate(f"window.__t.nt.deviceNotify([{hi(1)},{hi(2)},{hi(3)},{hi(4,'normal')}])")
        await pg.wait_for_timeout(200)
        n=await pg.evaluate("window.__shown.length"); print('   avisos do sistema:',n); ok(n==2,'máximo 2 avisos do sistema por dia, só urgentes')
        ok(await pg.evaluate("window.__shown.every(s=>/x[12]/.test(s[2]))"),'os não urgentes nunca vão para o sistema')
        await pg.evaluate(f"window.__t.nt.deviceNotify([{hi(9)}])"); await pg.wait_for_timeout(100)
        ok(await pg.evaluate("window.__shown.length")==2,'limite diário persistente')
        await pg.evaluate("window.__shown.length=0; localStorage.removeItem('weddy_nt_device_W_n'); window.__t.state.notif.prefs={quiet:{on:true,from:'00:00',to:'23:59'}}")
        await pg.evaluate(f"window.__t.nt.deviceNotify([{hi(20)}])"); await pg.wait_for_timeout(100)
        ok(await pg.evaluate('window.__shown.length')==0,'em horário de silêncio nenhum aviso do sistema')
        q=await pg.evaluate("[window.__t.nt.isQuiet({quiet:{on:true,from:'22:00',to:'08:00'}},new Date(2026,10,1,23,0)),window.__t.nt.isQuiet({quiet:{on:true,from:'22:00',to:'08:00'}},new Date(2026,10,1,7,59)),window.__t.nt.isQuiet({quiet:{on:true,from:'22:00',to:'08:00'}},new Date(2026,10,1,8,0)),window.__t.nt.isQuiet({quiet:{on:true,from:'22:00',to:'08:00'}},new Date(2026,10,1,15,0)),window.__t.nt.isQuiet({quiet:{on:false,from:'22:00',to:'08:00'}},new Date(2026,10,1,23,0))]")
        ok(q==[True,True,False,False,False],'horário de silêncio (22h–8h) correto: '+str(q))
        await pg.evaluate("localStorage.removeItem('weddy_nt_device_W_n')"); 
        await pg.evaluate("window.__shown.length=0; window.__t.nt.prefs"); 
        ok(not pg.errs,'sem erros '+str(pg.errs[:2]))
        print(f'\n{sum(CHECKS)}/{len(CHECKS)} OK'); sys.exit(0 if all(CHECKS) else 1); await b.close()
asyncio.run(main())
