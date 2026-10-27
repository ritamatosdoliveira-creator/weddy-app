/* Weddy · modo demonstração.
   Substitui o Firebase por uma versão em memória, com um casamento de
   exemplo. Só é carregado com ?demo=1 e não liga a nenhum servidor: nada
   do que se faz aqui é guardado nem enviado. */
(function(){
  'use strict';
  window.WEDDY_DEMO = true;
  var WID = 'demo-casamento', UID = 'demo-user', EMAIL = 'demo@weddy.pt';
  var store = Object.create(null), listeners = Object.create(null);

  /* ---------- valores especiais do Firestore ---------- */
  function FV(kind, v){ return { __fv: kind, v: v }; }
  var FieldValue = {
    serverTimestamp: function(){ return FV('ts'); },
    increment: function(n){ return FV('inc', n); },
    delete: function(){ return FV('del'); },
    arrayUnion: function(){ return FV('union', [].slice.call(arguments)); },
    arrayRemove: function(){ return FV('remove', [].slice.call(arguments)); }
  };
  function Timestamp(ms){ this.ms = ms; this.seconds = Math.floor(ms/1000); this.nanoseconds = 0; }
  Timestamp.prototype.toDate = function(){ return new Date(this.ms); };
  Timestamp.prototype.toMillis = function(){ return this.ms; };
  Timestamp.fromDate = function(d){ return new Timestamp(d.getTime()); };
  Timestamp.now = function(){ return new Timestamp(Date.now()); };

  function clone(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o, function(k, v){ return v instanceof Timestamp ? { __ts: v.ms } : v; }), function(k, v){ return v && v.__ts ? new Timestamp(v.__ts) : v; }); }
  function setPath(obj, path, val){
    var p = path.split('.'), o = obj;
    for(var i = 0; i < p.length - 1; i++){ if(typeof o[p[i]] !== 'object' || o[p[i]] === null) o[p[i]] = {}; o = o[p[i]]; }
    var last = p[p.length - 1], cur = o[last];
    if(val && val.__fv){
      switch(val.__fv){
        case 'ts': o[last] = new Timestamp(Date.now()); break;
        case 'inc': o[last] = (typeof cur === 'number' ? cur : 0) + val.v; break;
        case 'del': delete o[last]; break;
        case 'union': { var a = Array.isArray(cur) ? cur.slice() : []; val.v.forEach(function(x){ if(a.indexOf(x) < 0) a.push(x); }); o[last] = a; break; }
        case 'remove': o[last] = (Array.isArray(cur) ? cur : []).filter(function(x){ return val.v.indexOf(x) < 0; }); break;
      }
    } else o[last] = val;
  }
  function applyFV(obj){
    Object.keys(obj).forEach(function(k){
      var v = obj[k];
      if(v && v.__fv) setPath(obj, k, v);
      else if(v && typeof v === 'object' && !(v instanceof Timestamp) && !Array.isArray(v)) applyFV(v);
    });
    return obj;
  }

  /* ---------- documentos e coleções ---------- */
  function Snap(path, data){
    var id = path.split('/').pop();
    this.id = id; this.exists = data !== undefined; this._d = data;
    this.ref = docRef(path);
    this.metadata = { fromCache: false, hasPendingWrites: false };
  }
  Snap.prototype.data = function(){ return this._d === undefined ? undefined : clone(this._d); };
  Snap.prototype.get = function(f){ var o = this._d; String(f).split('.').forEach(function(k){ o = o == null ? undefined : o[k]; }); return o; };

  function notify(path){
    (listeners[path] || []).slice().forEach(function(cb){ setTimeout(function(){ cb(new Snap(path, store[path] === undefined ? undefined : clone(store[path]))); }, 0); });
  }
  function write(path, data, merge, isUpdate){
    var cur = store[path];
    if(isUpdate){
      if(cur === undefined) return Promise.reject({ code: 'not-found', message: 'demo: documento não existe' });
      var n = clone(cur); Object.keys(data).forEach(function(k){ setPath(n, k, data[k]); }); store[path] = n;
    } else if(merge && cur !== undefined){
      var m = clone(cur); Object.keys(data).forEach(function(k){ setPath(m, k, data[k]); }); store[path] = m;
    } else { store[path] = applyFV(clone(data)); }
    notify(path);
    return Promise.resolve();
  }
  function docRef(path){
    var ref = {
      id: path.split('/').pop(), path: path,
      get: function(){ return Promise.resolve(new Snap(path, store[path] === undefined ? undefined : clone(store[path]))); },
      set: function(d, o){ return write(path, d, !!(o && o.merge), false); },
      update: function(d){ return write(path, d, false, true); },
      delete: function(){ delete store[path]; notify(path); return Promise.resolve(); },
      onSnapshot: function(cb){
        (listeners[path] = listeners[path] || []).push(cb);
        setTimeout(function(){ cb(new Snap(path, store[path] === undefined ? undefined : clone(store[path]))); }, 0);
        return function(){ listeners[path] = (listeners[path] || []).filter(function(x){ return x !== cb; }); };
      },
      collection: function(n){ return collRef(path + '/' + n); }
    };
    return ref;
  }
  function QSnap(docs){ this.docs = docs; this.empty = !docs.length; this.size = docs.length; }
  QSnap.prototype.forEach = function(f){ this.docs.forEach(f); };
  QSnap.prototype.docChanges = function(){ return []; };
  function collRef(path, filters){
    filters = filters || [];
    var q = {
      where: function(f, op, v){ return collRef(path, filters.concat([[f, op, v]])); },
      orderBy: function(){ return q; }, limit: function(){ return q; }, startAfter: function(){ return q; },
      get: function(){
        var prefix = path + '/', docs = [];
        Object.keys(store).forEach(function(p){
          if(p.indexOf(prefix) === 0 && p.slice(prefix.length).indexOf('/') < 0){
            var d = store[p], ok = filters.every(function(f){
              var val = d; f[0].split('.').forEach(function(k){ val = val == null ? undefined : val[k]; });
              if(f[1] === 'array-contains') return Array.isArray(val) && val.indexOf(f[2]) >= 0;
              if(f[1] === '==') return val === f[2];
              return true;
            });
            if(ok) docs.push(new Snap(p, clone(d)));
          }
        });
        return Promise.resolve(new QSnap(docs));
      },
      onSnapshot: function(cb){ q.get().then(cb); return function(){}; },
      doc: function(id){ return docRef(path + '/' + (id || ('d' + Math.random().toString(36).slice(2, 10)))); },
      add: function(d){ var r = docRef(path + '/d' + Math.random().toString(36).slice(2, 10)); return r.set(d).then(function(){ return r; }); }
    };
    return q;
  }
  var db = {
    collection: collRef,
    doc: docRef,
    settings: function(){},
    runTransaction: function(fn){
      var tx = {
        get: function(r){ return r.get(); },
        set: function(r, d, o){ return r.set(d, o); },
        update: function(r, d){ return r.update(d); },
        delete: function(r){ return r.delete(); }
      };
      return Promise.resolve(fn(tx));
    },
    batch: function(){
      var ops = [];
      var b = {
        set: function(r, d, o){ ops.push(function(){ return r.set(d, o); }); return b; },
        update: function(r, d){ ops.push(function(){ return r.update(d); }); return b; },
        delete: function(r){ ops.push(function(){ return r.delete(); }); return b; },
        commit: function(){ return Promise.all(ops.map(function(f){ return f(); })).then(function(){}); }
      };
      return b;
    },
    enablePersistence: function(){ return Promise.resolve(); }
  };

  /* ---------- sessão ---------- */
  var user = {
    uid: UID, email: EMAIL, emailVerified: true, displayName: 'Rita & Tiago', providerData: [{ providerId: 'password' }],
    getIdToken: function(){ return Promise.resolve('demo'); },
    reload: function(){ return Promise.resolve(); },
    reauthenticateWithCredential: function(){ return Promise.reject({ code: 'demo', message: 'Modo demonstração' }); }
  };
  var authStateCbs = [];
  var auth = {
    currentUser: user,
    onAuthStateChanged: function(cb){ authStateCbs.push(cb); setTimeout(function(){ cb(user); }, 0); return function(){}; },
    signOut: function(){ return Promise.resolve(); },
    useDeviceLanguage: function(){}
  };
  ['signInWithEmailAndPassword', 'createUserWithEmailAndPassword', 'signInWithPopup', 'signInWithRedirect', 'sendPasswordResetEmail', 'signInWithCredential', 'getRedirectResult']
    .forEach(function(n){ auth[n] = function(){ return Promise.reject({ code: 'demo', message: 'Modo demonstração: não é possível iniciar sessão.' }); }; });
  auth.getRedirectResult = function(){ return Promise.resolve({ user: null }); };

  function authFn(){ return auth; }
  authFn.GoogleAuthProvider = function(){ this.addScope = function(){}; }; authFn.GoogleAuthProvider.credential = function(){ return {}; };
  authFn.OAuthProvider = function(){ this.addScope = function(){}; this.credential = function(){ return {}; }; };
  authFn.EmailAuthProvider = { credential: function(){ return {}; } };
  authFn.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };

  function dbFn(){ return db; }
  dbFn.FieldValue = FieldValue; dbFn.Timestamp = Timestamp;

  /* funções na nuvem: nenhuma chega a correr */
  function callable(name){
    return function(data){
      var out = {}, path = 'weddingSites/' + WID, doc = store[path];
      if(name === 'classifyWeddyIntent') out = { intent: 'UNKNOWN' };
      else if(name === 'saveWeddingSiteDraft'){ store[path] = Object.assign({}, doc || {}, { draft: clone(data.draft) }); }
      else if(name === 'publishWeddingSite'){
        var d = (store[path] && store[path].draft) || {};
        store[path] = Object.assign({}, store[path] || {}, { status: 'published', slug: d.slug || 'rita-e-tiago-2027', publishedDraft: clone(d) });
        out = { ok: true, url: 'https://www.weddy.pt/c/' + store[path].slug };
      }
      else if(name === 'unpublishWeddingSite'){ store[path] = Object.assign({}, store[path] || {}, { status: 'draft' }); }
      else if(name === 'checkWeddingSiteSlug') out = { available: true, ok: true };
      return new Promise(function(res){ setTimeout(function(){ res({ data: out }); }, 350); });
    };
  }
  var fnObj = { httpsCallable: callable };
  function fnFn(){ return fnObj; }
  var storageObj = { ref: function(){ var r = { child: function(){ return r; }, put: function(){ return Promise.reject({ code: 'demo' }); }, putString: function(){ return Promise.reject({ code: 'demo' }); }, getDownloadURL: function(){ return Promise.resolve(''); }, delete: function(){ return Promise.resolve(); } }; return r; } };
  function storageFn(){ return storageObj; }

  window.firebase = {
    initializeApp: function(){}, app: function(){ return { functions: function(){ return fnObj; } }; },
    auth: authFn, firestore: dbFn, storage: storageFn, functions: fnFn
  };
  window.__demoStore = store;

  /* ---------- casamento de exemplo ---------- */
  if(window.WEDDY_DEMO_SEED){ window.WEDDY_DEMO_SEED(store, WID, UID, EMAIL); }
  else {
    store['weddings/' + WID] = {
      ownerEmails: [EMAIL], ownerUids: [UID], creatorEmail: EMAIL,
      consent: { termsVersion: window.__demoTermsVersion || undefined, privacyVersion: window.__demoPrivacyVersion || undefined },
      settings: {}, json: '{}', subscription: { active: true, plan: 'premium12' }
    };
  }
  store['userPrefs/' + UID] = { activeWeddingId: WID };

  /* nada de service worker em modo demonstração */
  try{ if(navigator.serviceWorker){ navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); }); navigator.serviceWorker.register = function(){ return Promise.resolve({ addEventListener: function(){}, update: function(){} }); }; } }catch(e){}
})();
