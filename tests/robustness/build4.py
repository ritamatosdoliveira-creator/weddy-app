import re
s=open('/home/claude/g293/app/index.html',encoding='utf-8').read()
idx=[m.start() for m in re.finditer(r'\n\}\)\(\);',s)]; pos=idx[-8]
hook="""
window.__a4={ san:a4SanitizeState, sanIn:a4SanitizeIncoming, seed:seedData, get state(){return state;}, set state(v){state=v;}, render:function(){ return render(); }, errs:function(){ return a4ViewErrors; },
 attach:function(){ if(!auth||!auth.currentUser) auth={currentUser:{}}; currentWeddingId='W'; attachFirestoreSync(); }, firstSync:function(){ return firstSyncDone; }, go:function(t){ activeTab=t; }, sub:function(v){ currentSubscription = v?{active:true}:null; } };"""
open('/tmp/sx/app_a4.html','w',encoding='utf-8').write(s[:pos]+hook+s[pos:])
