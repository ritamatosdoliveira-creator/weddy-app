"""Utilitários comuns dos testes de interface (Playwright, Python).

Tudo é relativo ao repositório: nada depende de /tmp nem de ficheiros fora de tests/.
- Constrói uma cópia da app com ganchos de teste (window.__t / window.__a4) em tests/.build/
- O Firebase é simulado por um Proxy (nunca há rede nem serviços de produção).
- Qualquer pedido que não seja file:// do repositório é bloqueado.
"""
import asyncio, re, sys, json, functools
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'tests' / '.build'
BUILD.mkdir(parents=True, exist_ok=True)
SHOTS = BUILD / 'shots'
SHOTS.mkdir(parents=True, exist_ok=True)

HOOK = r"""
window.__t={get state(){return state;}, set state(v){state=v;}, get gimp(){return gimp;}, render:function(){render();}, go:function(t){ activeTab=t; render(); }, sub:function(v){ currentSubscription = v?{active:true}:null; },
 sheet:{ open:function(side,cat,idx){ currentWeddingId='W'; return openGuestPhoneSheet(side,cat,idx); }, ok:guestWaConsentOK, setStatus:setGuestConsentStatus },
 nt:{ run:function(d){ return ntRun(d); }, items:ntItems, unread:ntUnread, prefs:ntPrefs, open:ntOpenCenter, close:ntClose, observe:ntObserveRemote, isQuiet:ntIsQuiet, deviceNotify:ntDeviceNotify, days:ntDays,
   ready:function(){ if(!auth||!auth.currentUser) auth={currentUser:{}}; currentWeddingId='W'; firstSyncDone=true; render=function(){ _origRender(); }; },
   setRsvp:function(r,loaded){ rsvpResponses=r; rsvpResponsesLoaded=loaded!==false; },
   setSettings:function(o){ Object.assign(weddingSettings,o); }, dirty:function(v){ pendingSaveDirty=v; }, isOpen:function(){ return ntOpen; } },
 sec:function(sec){ activeTab='definicoes'; definicoesSection=sec; render(); }, section:function(){ return definicoesSection; }, mem:function(list){ weddingMemories=list; memoriesLoaded=true; memoriesLoading=false; memoriesLapsedProbed=true; },
 back:function(){return weddyBackStep();}, lang:function(l){ appLang=l; },
 mesas:{ open:function(id){ openTable[id]=true; }, go:function(){ activeTab='mesas'; render(); }, seat:function(k){ return openSeatSheet(k); } },
 hc:function(){ return getWeddingHealthChecks().map(function(c){ return {id:c.id,text:c.text,severity:c.severity}; }); }, setDate:function(d){ weddingSettings.weddingDate=d; },
 diet:function(){ return WeddyActions.read.getDietaryList(); },
 ai:{ cf:function(f){ cloudFunctions={httpsCallable:function(){return f;}}; }, open:function(){ activeTab='mesas'; aiSeatingScreen='prefs'; aiSeatingProposal=null; aiSeatingConstraints=[]; aiSeatingFreeText=''; aiSeatingErrorMsg=null; render(); }, proposal:function(){ return aiSeatingProposal; }, screen:function(){ return aiSeatingScreen; }, mode:function(m){ aiSeatingMode=m; }, constraints:function(c){ aiSeatingConstraints=c; }, attrs:function(){ return aiSeatingAttrs(); }, stale:function(){ return aiSeatingProposalIsStale(aiSeatingProposal); }, sel:function(){ return aiSeatingSelectedMoves?Array.from(aiSeatingSelectedMoves):null; } },
 cp:{ ask:function(q){ return respondeAssistente(q); }, classify:function(q,c){ return classifyCopilotIntent(q,c||null); }, pending:function(){ return copilotPending; }, setPending:function(v){ copilotPending=v; }, perm:function(i,c){ return checkCopilotIntentPermission(i,c); }, level:function(i){ return copilotIntentLevel(i); },
   push:function(f){ pushRemoteImmediate=f; }, subRaw:function(v){ currentSubscription=v; }, openPanel:function(){ openChatPanel(); }, uid:function(u){ auth={currentUser:{uid:u}}; }, wid:function(w){ currentWeddingId=w; }, aiStub:function(f){ AIService.classify=f; }, executing:function(){ return copilotExecuting; }, ctx:function(){ return lastCopilotContext; },
   cats:function(){ return state.todoCategories; }, intents:function(){ return Object.keys(WEDDY_COPILOT_INTENTS); }, policy:function(){ return COPILOT_POLICY; }, ttl:COPILOT_PENDING_TTL_MS, write:WeddyActions.write, read:WeddyActions.read, fn:function(f){ return window['__x']=f; } },
 cmp:{ parse:function(x){ return cmpParsePrice(x); }, facts:function(c){ return cmpPriceFacts(c); }, sig:function(c){ return cmpSigOf(c); }, conf:function(p,k){ return cmpConfirmed(p,k); }, status:function(c){ return cmpStatusOf(c); },
   dup:function(c){ return cmpDuplicate(c); }, del:function(id){ return cmpDeleteCompareById(id); }, pdf:function(c){ var d=cmpBuildPdf(c); return d ? d.output('datauristring') : null; }, exportState:function(c){ return cmpExportState(c); },
   rows:function(c){ var r=cmpRows(c); return {withData:r.withData.map(function(x){return {k:x.k,diff:x.diff,same:x.same,missing:x.missing};}), empty:r.empty.map(function(x){return x.k;})}; }, list:function(){ return cmpList(); }, get:function(id){ return cmpGet(id); }, eligible:function(c){ return cmpReportEligible(c); },
   gen:function(id){ return cmpGenerateReport(id); }, analyze:function(c,p){ return cmpAnalyze(c,p); }, review:function(c,p){ return cmpReviewPending(c,p); }, apply:function(c,p){ return cmpApplyReview(c,p); }, mkExpense:function(c,p){ return cmpCreateExpense(c,p); },
   draftExp:function(c,p){ compareExpenseDraft=cmpExpenseDraftFor(c,p); return compareExpenseDraft; }, setDraft:function(o){ Object.assign(compareExpenseDraft,o); }, expOf:function(p){ return cmpExpenseOf(p); }, usedElse:function(c,p,sid){ return !!cmpSupplierUsedElsewhere(c,p,sid); }, snap:function(c){ return cmpRefreshSnapshots(c); },
   items:function(){ return cmpItemsHTML(); }, matches:function(c){ return cmpMatchesFilter(c); }, filter:function(f){ cmpFilter=f; }, go:function(v,c,p){ return cmpGo(v,c,p); }, cf:function(f){ cloudFunctions={httpsCallable:function(n,o){ return function(d){ return f(n,d,o); }; }}; }, noCf:function(){ cloudFunctions=null; },
   stor:function(f){ storage=f; }, alerts:[], confirmAns:true, hookDialogs:function(){ var self=window.__t.cmp; weddyAlert=function(m){ self.alerts.push(m); return Promise.resolve(); }; weddyConfirm=function(m){ self.alerts.push('?'+m); return Promise.resolve(self.confirmAns); }; cmpChoice=function(m,b){ self.alerts.push('choice:'+m); return Promise.resolve(self.choiceAns||'cancel'); }; }, choice:function(a){ window.__t.cmp.choiceAns=a; },
   exportFlow:function(id){ return cmpExportFlow(id); }, exportInner:function(id){ return cmpExportFlowInner(id); }, resetExport:function(){ cmpExportBusy=false; cmpExportCooldownUntil=0; }, deliver:function(f){ cmpDeliverPdf=f; }, upload:function(files){ return cmpUploadFiles(files); }, open:function(c,p){ openCompareId=c; openProposalId=p||null; },
   sup:function(){ return state.suppliers; }, reportStale:function(c){ return cmpExportState(c); }, jobStatus:function(c){ return cmpReportJobStatus(c); }, aiStatus:function(p){ return cmpAiStatus(p); }, nb:function(s){ return cmpPdfNb(s); }, pendInf:function(p,k){ return cmpPdfPendingInf(p,k); }, ready:function(){ if(!auth||!auth.currentUser) auth={currentUser:{uid:'u1'}}; currentWeddingId='W1'; firstSyncDone=true; } },
 md:{ ready:function(){ if(!auth||!auth.currentUser) auth={currentUser:{uid:'u1'}}; currentWeddingId='W1'; firstSyncDone=true; },
   db:function(o){ db=o; }, stor:function(o){ storage=o; }, push:function(f){ pushRemote=f; }, prev:function(f){ previewAttachment=f; }, fbReady:function(){ return FIREBASE_READY; }, ext:function(f){ extractPdfText=f; },
   loadMem:function(){ return loadMemories(); }, delMem:function(id,p){ return deleteMemory(id,p); }, upload:function(files){ return handleDocumentUpload(files); },
   hookDialogs:function(){ var self=window.__t.md; weddyAlert=function(m){ self.alerts.push(m); return Promise.resolve(); }; weddyConfirm=function(m){ self.alerts.push('?'+m); return Promise.resolve(self.confirmAns); }; }, alerts:[], confirmAns:true,
   memState:function(){ return { loaded:memoriesLoaded, loading:memoriesLoading, n:weddingMemories.length, mem:weddingMemories }; },
   resetMem:function(){ weddingMemories=[]; memoriesLoaded=false; memoriesLoading=false; memoriesLapsedProbed=false; memFilter='all'; },
   openMem:function(){ activeTab='definicoes'; definicoesSection='memories'; render(); } },
 lg:{ screen:function(f){ activeTab='definicoes'; definicoesSection='rsvp'; rsvpSubScreen='logistica'; if(f) logiFilter=f; render(); }, hub:function(){ activeTab='definicoes'; definicoesSection='rsvp'; rsvpSubScreen=null; render(); }, all:function(){ return logiAll().map(function(x){ return {name:x.item.name, todo:x.todo}; }); }, groups:function(){ return logiGroups(logiAll()); } },
 ap:{ insights:function(){ return rsvpAutopilotInsights(); }, list:function(){ return rsvpAutopilotList().map(function(x){ return {name:x.item.name, bucket:x.bucket}; }); }, cfg:function(){ return rsvpAutopilotConfig(); }, settings:function(){ return weddingSettings; }, screen:function(){ activeTab='definicoes'; definicoesSection='rsvp'; rsvpSubScreen='deadline'; render(); } }};
window.__a4={ san:a4SanitizeState, sanIn:a4SanitizeIncoming, seed:seedData, get state(){return state;}, set state(v){state=v;}, render:function(){ return render(); }, errs:function(){ return a4ViewErrors; },
 attach:function(){ if(!auth||!auth.currentUser) auth={currentUser:{}}; currentWeddingId='W'; attachFirestoreSync(); }, firstSync:function(){ return firstSyncDone; }, go:function(t){ activeTab=t; }, sub:function(v){ currentSubscription = v?{active:true}:null; }, lang:function(l){ appLang=l; }, i18n:APP_I18N, T:ta };
"""
HOOK_EXTRA = ""

def build_hooked(extra_hook=''):
    src = (ROOT / 'app' / 'index.html').read_text(encoding='utf-8')
    idx = [m.start() for m in re.finditer(r'\n\}\)\(\);', src)]
    pos = idx[-8]  # fim do IIFE principal (ver tests/README.md)
    out = BUILD / 'app_hooked.html'
    out.write_text(src[:pos] + '\n' + HOOK + extra_hook + src[pos:], encoding='utf-8')
    return out

APP_FILE = build_hooked()
APP_URI = APP_FILE.as_uri()

# Firebase simulado: tudo devolve um Proxy; onSnapshot guarda o callback em window.__snap
STUB = """
(function(){
 window.__snap=null;
 function mk(){ var f=function(){ return p; }; var p=new Proxy(f,{get:function(t,k){ if(k==='then') return undefined; if(k==='onSnapshot') return function(cb){ window.__snap=cb; return function(){}; }; if(k==='onAuthStateChanged') return function(cb){ setTimeout(function(){cb(null)},0); return function(){}; }; if(k===Symbol.toPrimitive) return function(){return ''}; return p; }, apply:function(){ return p; }}); return p; }
 window.firebase = mk();
})();
"""

CHECKS = []
def ok(c, msg):
    CHECKS.append(bool(c)); print(('OK   ' if c else 'FAIL ') + msg)

def ev(pg, js, arg=None):
    return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)

def allow_local(route):
    u = route.request.url
    if u.startswith(ROOT.as_uri()): return route.continue_()
    return route.abort()

async def newpage(b, w=390, h=844, lang=None, mode='app', url=None):
    """mode='app': sessão simulada (Premium, nt.ready); mode='bare': app acabada de carregar."""
    ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page()
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)[:200]))
    pg.on('console', lambda m: pg.errs.append('console:' + m.text[:160]) if m.type == 'error' and 'Failed to load' not in m.text and 'net::' not in m.text and 'Estado com campos' not in m.text and 'Snapshot do Firestore' not in m.text and 'Falha ao' not in m.text and 'Weddy]' not in m.text else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
    await pg.route('**/*', allow_local)
    await pg.add_init_script(STUB)
    await pg.goto(url or APP_URI); await pg.wait_for_timeout(700)
    await pg.add_style_tag(content='#login-screen,.login-screen{display:none !important}')
    if mode == 'wa':
        await pg.evaluate('window.__t.sub(true); window.__t.go("inicio"); (document.getElementById("payment-alert-ok")||{click(){}}).click()')
    elif mode == 'app':
        await pg.evaluate('window.__t.sub(true); window.__t.nt.ready(); window.__t.go("inicio"); (document.getElementById("payment-alert-ok")||{click(){}}).click()')
    return pg

def summary():
    passed = sum(CHECKS); failed = len(CHECKS) - passed
    print(f"\n{passed}/{len(CHECKS)} OK")
    print(f"RESULT passed={passed} failed={failed}")
    if failed: sys.exit(1)

RES = CHECKS  # alias usado por suites antigas
