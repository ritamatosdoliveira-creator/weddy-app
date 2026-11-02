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
 back:function(){return weddyBackStep();}, lang:function(l){ appLang=l; },
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
