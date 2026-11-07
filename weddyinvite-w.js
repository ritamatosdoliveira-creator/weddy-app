/* ============================================================================
   Weddy Invitations — modelos «w-*» (os 8 convites premium com capa animada)
   Fase 1: motor + modelo 1 (w-verde).
   - A abertura é CSS puro (checkbox + label): funciona na página pública, na
     pré-visualização (iframe) e sem JavaScript. Respeita prefers-reduced-motion.
   - Texturas e tipos de letra são ficheiros em /convites8/ (substituíveis).
   - Fotografias: cfg.photos.cover / cfg.photos.gallery[] (URL https). Sem valor,
     usa as fotografias demonstrativas de /convites8/demo/. O código dos modelos
     nunca referencia uma fotografia concreta.
   Regras do motor mantidas: todo o texto passa por esc(); cores/fonts vêm do
   sanitize(); nunca se injeta HTML de utilizador.
   ========================================================================== */
(function(root){
  'use strict';
  var BASE = (function(){
    try { var s = document.currentScript && document.currentScript.src; if(s) return new URL('convites8/', s).href; } catch(e){}
    return 'https://www.weddy.pt/convites8/';
  })();
  var O = '.wv-chk:checked~.wv-stage';          /* estado «a abrir» */
  var DEMO = { cover:'demo/walk.jpg', gallery:['demo/walk.jpg','demo/hills.jpg','demo/beach.jpg'] };
  function U(p){ return 'url('+BASE+p+')'; }
  function url(p){ return 'url('+BASE+p+')'; }
  function ph(cfg, i){
    var P = cfg.photos || {}, g = Array.isArray(P.gallery) ? P.gallery : [];
    var u = g[i] || DEMO.gallery[i % DEMO.gallery.length];
    return /^https:\/\//.test(u) ? u : BASE + u;
  }
  function demo(cfg, i){ var P = cfg.photos || {}, g = Array.isArray(P.gallery) ? P.gallery : []; return !g[i]; }

  /* ---------- partes comuns ---------- */
  var BASE_CSS = [
    /* cartão estático (também usado no PNG): sem imagens externas */
    '.wv-card{position:relative;width:360px;height:540px;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:stretch;text-align:center;background:#f1eee6;color:var(--ink)}.wv-card>*{flex:1 1 auto}',
    '.wv-card *{box-sizing:border-box}'
  ].join('');

  /* ---------- modelo 1: verde-oliva texturizado ---------- */
  function card1(cfg, full, esc, parts){
    var n = parts.names, m = parts.mono, d = parts.date;
    return '<div class="w1-cd'+(full?' w1-full':'')+'"><div class="w1-mo">'+esc(m)+'</div><div class="w1-cap">'+esc(parts.intro)+'</div>'+
      '<div class="w1-nm">'+esc(n[0])+(n[1]?'<span>&amp;</span>'+esc(n[1]):'')+'</div>'+(d?'<div class="w1-dt">'+esc(d)+'</div>':'')+
      (full && cfg.venue ? '<div class="w1-vn">'+esc(cfg.venue)+'</div>' : '')+'</div>';
  }
  function cover1(cfg, esc, parts){
    var nm = parts.names, d = parts.date;
    return '<div class="w1-env"><div class="w1-in"></div><div class="w1-card">'+card1(cfg,false,esc,parts)+'</div>'+
      '<div class="w1-pk w1-l"></div><div class="w1-pk w1-r"></div><div class="w1-pk w1-b"></div>'+
      '<svg class="w1-cr" viewBox="0 0 312 520" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="w1bl"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g filter="url(#w1bl)" stroke="rgba(0,0,0,.45)" stroke-width="3" fill="none"><path d="M0 0L156 260L0 520M312 0L156 260L312 520M0 520L156 260L312 520"/></g><g stroke="rgba(255,255,255,.22)" stroke-width="1" fill="none"><path d="M1 3L157 262M311 3L155 262M2 518L156 263L310 518"/></g></svg>'+
      '<div class="w1-flap"><div class="w1-ff w1-fr"></div><div class="w1-ff w1-bk"></div></div><div class="w1-seal"></div></div>'+
      '<div class="w1-names"><div class="n">'+esc(nm[0])+(nm[1]?' &amp; '+esc(nm[1]):'')+'</div>'+(d?'<div class="d">'+esc(d)+'</div>':'')+'</div>';
  }
  function css1(){
    var s = '.wv-verde{--olive:#454d2e;--olive2:#8b9567;--band:#6a7747;--paper:#f1eee6;--fh:\'W Great Vibes\',cursive;--fp:\'W Playfair\',Georgia,serif}';
    s += '.wv-verde .wv-stage{background:'+url('img/m1_lining.jpg')+';background-size:300px;background-color:#38432a}';
    s += '.wv-verde .wv-stage::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 40%,rgba(0,0,0,.38));pointer-events:none}';
    s += '.w1-env,.w1-env>*{position:absolute}.w1-env{left:0;top:0;width:100%;height:100%;perspective:1600px}';
    s += '.w1-in{inset:0;background:'+url('img/m1_lining.jpg')+';background-size:300px;box-shadow:inset 0 0 40px rgba(0,0,0,.55)}';
    s += '.w1-card{left:9%;top:15%;width:82%;height:70%;z-index:2;background:'+url('img/m1_ivory.jpg')+';background-size:300px;background-color:#f1eee6;color:var(--olive);box-shadow:0 2px 8px rgba(0,0,0,.4);overflow:hidden;display:grid;place-items:center;text-align:center;transform-origin:50% 50%;transition:transform 1.9s cubic-bezier(.45,.05,.25,1) 2s}';
    s += '.w1-card::before{content:"";position:absolute;inset:12px;border:1px solid var(--olive2)}';
    s += '.w1-card::after{content:"";position:absolute;inset:0;background:rgba(10,14,4,.55);transition:opacity 1.6s ease 1.6s}';
    s += O+' .w1-card{transform:scale(1.22)}'+O+' .w1-card::after{opacity:0}';
    s += '.w1-pk{inset:0;z-index:3;background:'+url('img/m1_envelope.jpg')+' center/cover;transition:transform 2.1s cubic-bezier(.5,.02,.25,1)}';
    s += '.w1-l{clip-path:polygon(0 0,50% 50%,0 100%);transition-delay:1.15s}.w1-r{clip-path:polygon(100% 0,50% 50%,100% 100%);transition-delay:1.3s}.w1-b{clip-path:polygon(0 100%,50% 50%,100% 100%);transition-delay:1.5s}';
    s += '.w1-l::after,.w1-r::after,.w1-b::after{content:"";position:absolute;inset:0}';
    s += '.w1-l::after{background:linear-gradient(90deg,rgba(0,0,0,.05),rgba(0,0,0,.2) 62%)}.w1-r::after{background:linear-gradient(270deg,rgba(255,255,255,.04),rgba(0,0,0,.12) 62%)}.w1-b::after{background:linear-gradient(0deg,rgba(255,255,255,.05),rgba(0,0,0,.16) 72%)}';
    s += O+' .w1-l{transform:translateX(-104%) rotate(-3deg)}'+O+' .w1-r{transform:translateX(104%) rotate(3deg)}'+O+' .w1-b{transform:translateY(104%)}';
    s += '.w1-cr{inset:0;z-index:4;width:100%;height:100%;pointer-events:none;transition:opacity .7s ease 1.1s}'+O+' .w1-cr{opacity:0}';
    s += '.w1-flap{left:0;top:0;width:100%;height:50%;z-index:6;transform-origin:50% 0;transform-style:preserve-3d;transition:transform 1.9s cubic-bezier(.45,.03,.25,1) .55s,z-index 0s 1.3s}';
    s += O+' .w1-flap{transform:rotateX(180deg);z-index:1}';
    s += '.w1-ff{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;clip-path:polygon(0 0,100% 0,50% 100%)}';
    s += '.w1-fr{background:'+url('img/m1_envelope.jpg')+' top center/cover}.w1-bk{transform:rotateY(180deg);background:'+url('img/m1_lining.jpg')+';background-size:300px}';
    s += '.w1-fr::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.14));animation:none}'+O+' .w1-fr::after{animation:w1fd 1.25s .5s ease forwards}';
    s += '@keyframes w1fd{0%{opacity:1}45%{opacity:2.2}100%{opacity:2.2}}';
    s += '.w1-bk::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.5),rgba(0,0,0,0) 70%);opacity:.9}'+O+' .w1-bk::after{animation:w1bl 1.25s .5s ease forwards}';
    s += '@keyframes w1bl{0%{opacity:.9}100%{opacity:0}}';
    s += '.w1-seal{left:50%;top:50%;width:78px;height:78px;margin:-39px 0 0 -39px;z-index:7;background:'+url('img/m1_seal.png')+' center/contain no-repeat;filter:drop-shadow(0 5px 4px rgba(0,0,0,.45));transition:transform 1.1s cubic-bezier(.4,0,.6,1),opacity .9s ease .1s}';
    s += O+' .w1-seal{transform:translateY(10px) scale(1.06);opacity:0}';
    s += '.w1-names{position:absolute;left:0;right:0;bottom:21%;text-align:center;z-index:5;pointer-events:none;transition:opacity .8s ease}'+O+' .w1-names{opacity:0}';
    s += '.w1-names .n{font:400 40px/.95 var(--fh);color:#f1eee0;text-shadow:0 -1px 0 rgba(0,0,0,.35),0 1px 0 rgba(255,255,255,.12)}.w1-names .d{font:400 12px/1 var(--fp);letter-spacing:.28em;color:#e8e6d2;margin-top:12px}';
    /* cartão (capa e topo da página) */
    s += '.w1-cd{display:grid;gap:10px;justify-items:center;padding:0 18px}.w1-cd.w1-full{gap:12px;padding:0 22px;min-height:100vh;min-height:100svh;align-content:center}';
    s += '.w1-mo{width:64px;height:64px;border:1px solid var(--olive2);border-radius:50%;display:grid;place-items:center;font:italic 400 21px/1 var(--fp);color:#7b8560}.w1-full .w1-mo{width:78px;height:78px;font-size:25.6px}';
    s += '.w1-cap{font:500 9.5px/1.4 var(--fp);letter-spacing:.3em;text-transform:uppercase}.w1-full .w1-cap{font-size:11.6px}';
    s += '.w1-nm{font:400 48px/.92 var(--fh);overflow-wrap:anywhere}.w1-nm span{display:block;font-size:25px}.w1-full .w1-nm{font-size:58.5px}.w1-full .w1-nm span{font-size:30.5px}';
    s += '.w1-dt{font:500 11px/1 var(--fp);letter-spacing:.3em;color:#7b8560}.w1-full .w1-dt{font-size:13.4px}.w1-vn{font:400 12px/1.4 var(--fp);opacity:.8;position:absolute;left:0;right:0;text-align:center;top:calc(50% + 190px)}.w1-cd.w1-full{position:relative}';
    /* interior */
    s += '.wv-verde .wp{background:'+url('img/m1_ivory.jpg')+';background-size:420px;background-color:#f1eee6;color:var(--olive);font-family:var(--fp)}';
    s += '.wv-verde .wp-hero{padding:0}.wv-verde .wp-sec{border-top:0;font-family:var(--fp)}.wv-verde .wp-sec h2{font-family:var(--fp);font-style:italic;font-weight:400;letter-spacing:.04em;text-transform:none;font-size:27px;color:var(--olive)}';
    s += '.wv-verde .wp-big{font-family:var(--fp);font-weight:400}.wv-verde .wp-p{font-family:var(--fp)}';
    s += '.wv-verde #data,.wv-verde #rsvp{background:'+url('img/m1_band.jpg')+';background-size:cover;background-color:#6a7747;color:#f2efe4}.wv-verde #data h2,.wv-verde #rsvp h2{color:#f2efe4}.wv-verde #data .wp-p,.wv-verde #rsvp .wp-note{color:#f2efe4;opacity:.92}';
    s += '.wv-verde .wp-btn{background:#6a7747;color:#f2efe4;border-radius:999px;font-family:var(--fp)}.wv-verde #rsvp .wp-btn{background:#f2efe4;color:#454d2e}.wv-verde .wp-btn.ghost{background:transparent;color:#454d2e;border:1px solid #6a7747}';
    s += '.wv-ph{margin:0;padding:8px 28px 8px}.wv-ph img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;box-shadow:0 8px 22px rgba(40,46,20,.28)}.wv-ph.w{padding:8px 0}.wv-ph.w img{aspect-ratio:4/3;box-shadow:none}';
    s += '.wv-demo{font:500 9px/1 var(--fp);letter-spacing:.16em;text-transform:uppercase;opacity:.55;text-align:center;margin-top:6px}';
    s += '.wv-verde .wp-green{background:'+url('img/m1_band.jpg')+';background-size:cover;background-color:#6a7747;color:#f2efe4}.wv-verde .wp-green h2{color:#f2efe4;opacity:1}.wv-verde .wp-cd b{font-family:var(--fp);font-weight:400}';
    s += '.wv-verde .wp-ev h3{font-family:var(--fp);font-style:italic;font-weight:400;font-size:22px;letter-spacing:.02em;text-transform:none;color:#454d2e}.wv-verde .wp-ev svg{stroke:#6a7747}.wv-verde .wp-ev b{font-family:var(--fp);font-weight:400;font-size:20px;color:#6a7747}.wv-verde .wp-ev span{font-family:var(--fp)}.wv-verde .wp-ev hr{border:0;border-top:1px solid #cdd0b6;width:40px;margin:10px 0 0}';
    s += '.wv-verde .wp-prog li{border-bottom:0;position:relative;padding:14px 0 14px 28px;border-left:1px solid #8b9567;margin-left:12px}.wv-verde .wp-prog li::before{content:"";position:absolute;left:-5px;top:21px;width:9px;height:9px;border-radius:50%;background:#6a7747;box-shadow:0 0 0 3px #f1eee6}.wv-verde .wp-prog b{font-family:var(--fp);font-weight:400;color:#6a7747}';
    s += '.wv-verde #data .wp-ev h3,.wv-verde #data .wp-ev b,.wv-verde #data .wp-ev span{color:#f2efe4}.wv-verde #data .wp-ev svg{stroke:#f2efe4}.wv-verde #data .wp-ev hr{border-top-color:rgba(242,239,228,.5)}';
    s += '.wv-ic{width:30px;height:30px;color:#6a7747;display:block;margin:0 auto 8px}.wv-ic-p{position:absolute;left:-14px;top:12px;width:26px;height:26px;margin:0;padding:3px;border-radius:50%;background:#f1eee6;color:#6a7747}.wv-verde .wp-prog li{align-items:flex-start}.wv-verde .wp-prog li::before{display:none}.wv-ic-d{margin-bottom:12px}.wv-ic-l{width:26px;height:26px}';
    s += '.wv-quote{padding:36px 36px}.wv-quote p{margin:0 auto;max-width:28ch;font:italic 400 17px/1.6 var(--fp);color:#454d2e}.wv-quote p::before,.wv-quote p::after{content:"\\201C";display:block;font:400 34px/1 var(--fh);color:#8b9567}.wv-quote p::after{content:"\\201D"}';
    s += '.wv-song{padding:26px 28px}.wv-sl{margin:0 0 8px;font-size:13px;opacity:.8}.wv-st{font:italic 400 22px/1.2 var(--fp)}.wv-sa{font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-top:4px}';
    s += '.wv-hash{padding:30px 28px}.wv-hn{font:400 38px/1.1 var(--fh);color:#6a7747;margin:6px 0 10px;overflow-wrap:anywhere}';
    s += '.wv-gq{display:grid;gap:14px;justify-items:center;margin-top:16px}.wv-qr{width:150px;height:150px;background:#fff;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.25)}.wv-verde #gifts{background:'+url('img/m1_band.jpg')+';background-size:cover;background-color:#6a7747;color:#f2efe4}.wv-verde #gifts h2{color:#f2efe4}.wv-verde #gifts .wp-p{color:#f2efe4}.wv-verde #gifts .wp-btn.ghost{color:#f2efe4;border-color:#f2efe4}';
    s += '.wv-verde .wp{--ink:#454d2e;--soft:#7b8560;--rule:#cdd0b6;--hit:#6c7a46;--hitfg:#fff;--btn:#6a7747;--btnfg:#f2efe4;--fui:\'W Jost\',system-ui,sans-serif}';
    s += '.w1s{position:relative;padding:54px 28px;text-align:center;color:var(--ink)}.w1band{--ink:#f2efe4;--soft:#cfd5b4;--rule:#97a372;--hit:#f2efe4;--hitfg:#6a7747;background:'+url('img/m1_band.jpg')+';background-size:360px;background-color:#6a7747;color:#f2efe4}';
    s += '.w1s h3{margin:10px 0 0;font:italic 400 27px/1.15 var(--fp);color:var(--ink);text-wrap:balance}.w1s p{margin:12px auto 0;max-width:30ch;font:400 14px/1.6 var(--fp);color:var(--ink);text-wrap:pretty}';
    s += '.cap{font:500 11px/1.4 var(--fp);letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}.eyebrow{font:400 10.5px/1.4 var(--fui);letter-spacing:.32em;text-transform:uppercase;color:var(--soft)}.w1small{font:300 12px/1.5 var(--fui);color:var(--soft);margin-top:6px}.scr{font-family:var(--fh);font-weight:400;color:var(--ink);line-height:1.05}';
    s += '.shd{box-shadow:0 14px 24px rgba(30,25,15,.28),0 2px 4px rgba(30,25,15,.22)}.w1p{position:relative;margin:0;overflow:hidden;background:#444}.w1p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.r34{aspect-ratio:3/4}.r43{aspect-ratio:4/3}.r45{aspect-ratio:4/5}.w1-bleed{margin:0 -28px}.w1-bleed .w1p{box-shadow:none}.w1p-d{position:absolute;left:10px;top:10px;font:400 8.5px/1 var(--fui);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.85);background:rgba(0,0,0,.35);padding:4px 7px;border-radius:99px}';
    s += '.w1q{max-width:28ch!important;font-size:14px!important;font-style:italic}.w1lead{max-width:28ch!important;font-size:13px!important}.w1date{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:22px}.w1dl{font-size:10px;border-bottom:1px solid var(--rule);padding:0 10px 6px}.w1dn{font-size:54px;color:var(--ink)}.w1mo2{font-size:10px;margin-top:8px;color:var(--soft)}';
    s += '.w1cnt{display:flex;justify-content:center;gap:10px;margin-top:18px;font-variant-numeric:tabular-nums}.w1cnt div{display:grid;gap:5px;min-width:56px}.w1cnt div+div{border-left:1px solid var(--rule)}.w1cnt b{font:400 30px/1 var(--fp);color:var(--ink)}.w1cnt small{font:400 9px/1 var(--fui);letter-spacing:.24em;text-transform:uppercase;color:var(--soft)}';
    s += '.w1cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px 0;max-width:270px;margin:18px auto 0;font:400 12px/1 var(--fui);color:var(--ink);font-variant-numeric:tabular-nums}.w1cal b{font-weight:400;color:var(--soft);font-size:9.5px;letter-spacing:.1em;padding-bottom:6px}.w1cal span{height:30px;display:grid;place-items:center;position:relative}.w1cal .hit{color:var(--hitfg);z-index:1}.w1cal .hit::before{content:"";position:absolute;width:30px;height:30px;border-radius:50%;background:var(--hit);z-index:-1}';
    s += '.w1ev{display:grid;gap:6px;justify-items:center}.w1ev .t{font:400 30px/1 var(--fp);color:var(--ink)}.w1ev .where{font:400 14px/1.6 var(--fp);max-width:26ch;margin:0}.w1btn{display:inline-block;margin-top:14px;padding:11px 22px;border-radius:99px;background:var(--btn);color:var(--btnfg);font:500 10px/1 var(--fui);letter-spacing:.22em;text-transform:uppercase;text-decoration:none}.w1band .w1btn,.w1btn-l{background:#f2efe4;color:#454d2e}';
    s += '.w1tl{list-style:none;margin:24px auto 0;padding:0;max-width:290px;text-align:left}.w1tl li{display:grid;grid-template-columns:40px 18px 1fr;align-items:start;padding:0 0 22px;position:relative}.w1tl .d{position:relative;height:100%}.w1tl .d::before{content:"";position:absolute;left:6px;top:8px;width:7px;height:7px;border-radius:50%;background:var(--ink)}.w1tl .d::after{content:"";position:absolute;left:9px;top:18px;bottom:-6px;width:1px;background:var(--rule)}.w1tl li:last-child .d::after{display:none}.w1tl .x{font:400 14px/1.3 var(--fp)}.w1tl .x b{font:500 12px/1.4 var(--fui);letter-spacing:.06em;color:var(--ink);display:block;font-variant-numeric:tabular-nums}.w1tl .wv-ic{width:34px;height:34px;margin:0;color:var(--ink)}';
    s += '.w1tips{display:grid;gap:14px;margin:22px auto 0;max-width:280px;text-align:left}.w1tips div{border-top:1px solid var(--rule);padding-top:12px}.w1tips strong{display:block;font:500 10.5px/1.4 var(--fui);letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}.w1tips span{font:400 14px/1.6 var(--fp)}';
    s += '.w1foot{padding:36px 28px 54px;text-align:center;font:400 10px/1.8 var(--fui);letter-spacing:.3em;text-transform:uppercase;color:#7b8560}.w1s .wv-ic{color:var(--ink);width:34px;height:34px;margin:0 auto}.w1s .wv-qr{width:150px;height:150px;margin:18px auto 0;padding:8px}.w1band .wp-btn.ghost{color:#f2efe4;border-color:#f2efe4}';
    s += '.wv-song{background:none!important}.w1s.wv-song,.wv-verde .wv-song{padding:26px 28px}.wv-verde .wv-song .wv-ic{color:var(--ink)}.wv-verde .wp-ic{}';
    s += '.wv-verde .wp-foot{font-family:var(--fp);font-style:italic;letter-spacing:.04em;opacity:.6;background:none}';
    return s;
  }


  /* ---------- blocos opcionais (citação, canção, QR, hashtag, ícones) ---------- */
  var IC = {church:'<path d="M12 3v4M10 5h4M7 21V12l5-4 5 4v9M3 21h18M10 21v-5a2 2 0 014 0v5"/>',glasses:'<path d="M6 3h5l-.5 6a2.5 2.5 0 01-4 0zM8.5 11v8M6 19h5M14 6h5l-.5 5a2.5 2.5 0 01-4 0zM16.5 13v6M14 19h5"/>',plate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/><path d="M3 4v7M5 4v7M4 11v9M21 4c-2 2-2 6 0 8v8"/>',disco:'<circle cx="12" cy="13" r="7"/><path d="M5 13h14M12 6v14M7 8c3 2 7 2 10 0M7 18c3-2 7-2 10 0M12 2v4"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',car:'<path d="M4 15v-3l2-5h12l2 5v3zM4 15v3h3v-3M17 15v3h3v-3"/><circle cx="8" cy="12.5" r=".8"/><circle cx="16" cy="12.5" r=".8"/>',heart:'<path d="M12 20S4 14.5 4 9a4 4 0 018-1 4 4 0 018 1c0 5.5-8 11-8 11z"/>',music:'<path d="M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z"/>',couple:'<circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><path d="M6 21v-9l2-3 2 3v9M14 21v-9l2-3 2 3v9"/>'};
  function ic(k, c){ return '<svg class="wv-ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[k]+'</svg>'; }
  function iconFor(t){ t=String(t).toLowerCase();
    if(/cerim|igreja|capela|missa|casamento/.test(t)) return 'church'; if(/cocktail|c[oó]ctel|brinde|aperitivo|bar\b/.test(t)) return 'glasses';
    if(/jantar|almo[cç]o|banquete|refei|ceia/.test(t)) return 'plate'; if(/festa|baile|dan[cç]|dj|m[uú]sica/.test(t)) return 'disco';
    if(/chegada|receção de|rece[cç][aã]o de|transporte|autocarro/.test(t)) return 'car'; if(/fim|encerr|despedida|t[eé]rmin/.test(t)) return 'clock'; return 'heart'; }
  function quoteHtml(cfg, esc){ return cfg.quote ? '<section class="wp-sec wv-quote" id="citacao"><p>'+esc(cfg.quote)+'</p></section>' : ''; }
  function songHtml(cfg, esc){ var S = cfg.song; if(!S || !(S.t||S.a)) return '';
    var en = cfg.lang==='en';
    return '<section class="wp-sec wv-song" id="cancao">'+ic('music','wv-ic-l')+'<p class="wv-sl">'+(en?'Press play on our song':'Dê play à nossa canção')+'</p><div class="wv-st">'+esc(S.t)+'</div>'+(S.a?'<div class="wv-sa">'+esc(S.a)+'</div>':'')+
      (S.u ? '<a class="wp-btn ghost" href="'+esc(S.u)+'" target="_blank" rel="noopener noreferrer">'+(en?'Listen':'Ouvir')+'</a>' : '')+'</section>'; }
  function hashHtml(cfg, esc){ if(!cfg.hash) return ''; var en = cfg.lang==='en';
    return '<section class="wp-sec wv-hash" id="hashtag"><h2>'+(en?'Share your moments':'Partilhem os vossos momentos')+'</h2><div class="wv-hn">'+esc(cfg.hash)+'</div><p class="wp-p">'+(en?'Use our hashtag on your photos and videos from the day.':'Usem a nossa hashtag nas fotografias e vídeos do dia.')+'</p></section>'; }
  function qrSvg(text){
    if(!root.qrcode || !text) return '';
    try { var q = root.qrcode(0, 'M'); q.addData(text); q.make(); var n = q.getModuleCount(), d = '';
      for(var r=0;r<n;r++) for(var c=0;c<n;c++) if(q.isDark(r,c)) d += 'M'+c+' '+r+'h1v1h-1z';
      return '<svg class="wv-qr" viewBox="-2 -2 '+(n+4)+' '+(n+4)+'" shape-rendering="crispEdges" role="img" aria-label="QR"><rect x="-2" y="-2" width="'+(n+4)+'" height="'+(n+4)+'" fill="#fff"/><path d="'+d+'" fill="#2b3019"/></svg>';
    } catch(e){ return ''; } }
  function giftQr(cfg, esc, S){ if(!cfg.giftUrl) return ''; var en = cfg.lang==='en';
    return '<div class="wv-gq">'+qrSvg(cfg.giftUrl)+'<a class="wp-btn ghost" href="'+esc(cfg.giftUrl)+'" target="_blank" rel="noopener noreferrer">'+(en?'Open gift link':'Abrir ligação de presentes')+'</a></div>'; }

  /* ---------- interior do modelo 1 (estrutura e CSS do protótipo aprovado) ---------- */
  function sec(cls, inner){ return '<section class="w1s'+(cls?' '+cls:'')+'">'+inner+'</section>'; }
  function photo(cfg, i, cls, bleed, esc){ return sec('', '<div class="'+(bleed?'w1-bleed':'')+'"><figure class="w1p shd '+cls+'"><img src="'+esc(ph(cfg,i))+'" alt="" loading="lazy" decoding="async">'+(demo(cfg,i)?'<span class="w1p-d">Fotografia demonstrativa</span>':'')+'</figure></div>'); }
  function evBlock(kind, e, cfg, H, esc){ if(!e || !(e.t||e.p||e.a)) return '';
    var en = cfg.lang==='en', title = kind==='church' ? (en?'Ceremony':'Cerimónia religiosa') : (en?'Reception':'Receção');
    var q = [e.p, e.a].filter(Boolean).join(', '), link = q ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q) : '';
    return '<div class="w1ev">'+ic(kind)+'<h3>'+esc(title)+'</h3>'+(e.t?'<div class="t">'+esc(e.t)+'</div>':'')+(e.p?'<div class="cap">'+esc(e.p)+'</div>':'')+(e.a?'<p class="where">'+esc(e.a)+'</p>':'')+
      (link && H.sc.map ? '<a class="w1btn" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+(en?'View location':'Ver localização')+'</a>' : '')+'</div>'; }
  function tipsHtml(cfg, esc){ var lines = String(cfg.tips||'').split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean); if(!lines.length) return '';
    return '<div class="w1tips">'+lines.map(function(l){ var m = l.match(/^([^:]{2,28}):\s*(.+)$/); return m ? '<div><strong>'+esc(m[1])+'</strong><span>'+esc(m[2])+'</span></div>' : '<div><span>'+esc(l)+'</span></div>'; }).join('')+'</div>'; }
  function interior1(cfg, esc, H){
    var en = cfg.lang==='en', S = H.S, sc = cfg.sections, h = '', P = [];
    h += photo(cfg, 0, 'r34', false, esc);
    if(cfg.quote) h += sec('', '<p class="w1q">'+esc(cfg.quote)+'</p>');
    h += songHtml(cfg, esc);
    if(sc.datetime && cfg.date){ var d = cfg.date.split('-').map(Number), dt = new Date(Date.UTC(d[0],d[1]-1,d[2])), wd = (en?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[dt.getUTCDay()];
      var off = (new Date(Date.UTC(d[0],d[1]-1,1)).getUTCDay()+6)%7, dim = new Date(Date.UTC(d[0],d[1],0)).getUTCDate(), cal = '';
      S.wd.forEach(function(x){ cal += '<b>'+esc(x)+'</b>'; }); for(var i=0;i<off;i++) cal += '<span></span>'; for(var k=1;k<=dim;k++) cal += '<span'+(k===d[2]?' class="hit"':'')+'>'+k+'</span>';
      var iso = cfg.date+'T'+(cfg.time||'00:00')+':00', ms = new Date(iso).getTime()-Date.now(), v = [0,0,0,0];
      if(ms>0) v = [Math.floor(ms/864e5), Math.floor(ms%864e5/36e5), Math.floor(ms%36e5/6e4), Math.floor(ms%6e4/1e3)];
      var cnt = ms>0 ? '<div class="eyebrow" style="margin-top:26px">'+esc(en?'Countdown':'Faltam')+'</div><div class="w1cnt" data-wi-count="'+iso+'" role="timer">'+[S.dd,S.hh,S.mm,S.ss].map(function(l,i){ return '<div><b data-u="'+i+'">'+(i?('0'+v[i]).slice(-2):v[i])+'</b><small>'+esc(l)+'</small></div>'; }).join('')+'</div>' : '';
      h += sec('w1band', '<p class="w1lead">'+esc(cfg.message || S.defMsg)+'</p><div class="w1date"><span class="cap w1dl">'+esc(wd)+'</span><span class="scr w1dn">'+d[2]+'</span><span class="cap w1dl">'+d[0]+'</span></div><div class="cap w1mo2">'+esc(S.months[d[1]-1])+'</div>'+(cfg.time?'<div class="w1small">'+esc(S.at+' '+cfg.time)+'</div>':'')+cnt+'<div class="eyebrow" style="margin-top:34px">'+esc(en?'The big day':'O grande dia')+'</div><div class="w1cal">'+cal+'</div>');
    } else if(cfg.message) h += sec('', '<p class="w1lead">'+esc(cfg.message)+'</p>');
    if(sc.location){ var ev = evBlock('church', cfg.cer, cfg, H, esc), ev2 = evBlock('glasses', cfg.rec, cfg, H, esc);
      if(!ev && !ev2 && (cfg.venue||cfg.address)){ ev = evBlock('church', { t:cfg.time, p:cfg.venue, a:cfg.address }, cfg, H, esc).replace(esc(en?'Ceremony':'Cerimónia religiosa'), esc(S.whereT)); }
      if(ev||ev2) h += sec('', ev+(ev2 ? '<div style="margin-top:34px">'+ev2+'</div>' : '')); }
    if(sc.program && cfg.program.length) h += sec('', '<h3>'+esc(en?'Schedule':'Itinerário de atividades')+'</h3><ul class="w1tl">'+cfg.program.map(function(p){ return '<li>'+ic(iconFor(p.d))+'<span class="d"></span><span class="x"><b>'+esc(p.t||'·')+'</b>'+esc(p.d)+'</span></li>'; }).join('')+'</ul>');
    h += photo(cfg, 1, 'r43', true, esc);
    if(sc.dress && cfg.dress) h += sec('', '<h3>'+esc(en?'Dress code':'Código de vestuário')+'</h3><div style="margin-top:12px">'+ic('couple')+'</div><p style="font-size:13px">'+esc(cfg.dress)+'</p>');
    if(sc.gifts && (cfg.gifts || cfg.giftUrl)) h += sec('w1band', ic('gift')+'<h3 style="font-style:italic">'+esc(S.giftsT)+'</h3>'+(cfg.gifts?'<p style="font-size:13px">'+esc(cfg.gifts)+'</p>':'')+(cfg.giftUrl ? giftQr(cfg, esc, S) : ''));
    var rs = H.tok ? '<a class="w1btn w1btn-l" href="https://www.weddy.pt/rsvp.html?g='+esc(H.tok)+'">'+esc(S.rsvpBtn)+'</a>' : '<p class="w1small">'+esc(S.rsvpNo)+'</p>';
    h += sec('w1band', ic('cal')+'<h3 style="font-style:italic">'+esc(S.rsvpT)+'</h3><p style="font-size:13px">'+esc(en?'Please confirm your attendance.':'Agradecemos que confirme a presença.')+'</p>'+rs);
    var tp = (sc.tips && cfg.tips) ? tipsHtml(cfg, esc) : '', kd = (sc.kids && cfg.kids) ? '<p style="font-size:12.5px;margin-top:22px"><b class="cap" style="font-size:10px">'+esc(S.kidsT)+'</b><br>'+esc(cfg.kids)+'</p>' : '';
    h += sec('', ic('heart')+(tp?'<div class="cap" style="margin-top:8px">'+esc(en?'Recommendations':'Recomendações')+'</div>'+tp:'')+kd+'<p class="scr" style="font-size:30px;margin-top:20px">'+esc(en?'Thank you!':'Muito obrigado!')+'</p>');
    h += photo(cfg, 2, 'r45', false, esc);
    h += hashHtml(cfg, esc);
    h += '<div class="w1foot">'+esc(cfg.names)+(cfg.date?' · '+esc(H.dots):'')+'</div>';
    return h; }

  function decorate(html, cfg, esc){
    html = html.replace(/<li><b>([^<]*)<\/b><span>([^<]*)<\/span><\/li>/g, function(m, t, d){ return '<li><b>'+t+'</b>'+ic(iconFor(d),'wv-ic-p')+'<span>'+d+'</span></li>'; });
    html = html.replace(/(<section class="wp-sec" id="dresscode"><h2>[^<]*<\/h2>)/, '$1'+ic('couple','wv-ic-d'));
    return html; }


  /* ======================= MOTOR GENÉRICO DE INTERIOR (modelos 2–8) =======================
     Cada modelo declara: vars (tokens do protótipo), secs (ordem das secções), cover/card/css.
     O interior reproduz as secções do protótipo aprovado com os dados reais do convite. */
  var DEMOK = { walk:'demo/walk.jpg', hills:'demo/hills.jpg', beach:'demo/beach.jpg', bw:'demo/bw.jpg', aisle:'demo/aisle.jpg', table:'demo/table.jpg', rings:'demo/rings.jpg' };
  function gph(cfg, n, key){ var P = cfg.photos || {}, g = Array.isArray(P.gallery) ? P.gallery : [], u = g[n]; return { src: u ? u : BASE + (DEMOK[key] || DEMOK.walk), demo: !u }; }
  function gimg(cfg, n, key, cls, esc, bleed){ var o = gph(cfg, n, key);
    return '<div class="'+(bleed?'g-bleed':'')+'"><figure class="g-ph g-shd '+cls+'"><img src="'+esc(o.src)+'" alt="" loading="lazy" decoding="async">'+(o.demo?'<span class="g-demo">Fotografia demonstrativa</span>':'')+'</figure></div>'; }
  function gsec(cls, inner){ return '<section class="g-sec'+(cls?' '+cls:'')+'">'+inner+'</section>'; }
  function gev(kind, e, cfg, H, esc, one){ if(!e || !(e.t||e.p||e.a)) return '';
    var en = cfg.lang==='en', title = kind==='church' ? (en?'Ceremony':'Cerimónia religiosa') : (en?'Reception':'Receção');
    var q = [e.p, e.a].filter(Boolean).join(', '), link = q ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q) : '';
    var btn = link && H.sc.map ? '<a class="g-btn'+(one?' sq':'')+'" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+(en?'View location':'Ver localização')+'</a>' : '';
    if(one) return '<div class="g-ev">'+ic(kind,'g-ico')+(e.t?'<div class="g-cap" style="font-size:11px">'+esc(e.t)+'</div>':'')+'<h3 style="font-size:16px;font-style:normal;font-weight:600;letter-spacing:.1em;text-transform:uppercase">'+esc(title)+'</h3>'+(e.p?'<div class="g-cap" style="font-size:10.5px">'+esc(e.p)+'</div>':'')+(e.a?'<p class="where" style="font-size:12.5px">'+esc(e.a)+'</p>':'')+btn+'</div>';
    return '<div class="g-ev">'+ic(kind,'g-ico')+'<h3>'+esc(title)+'</h3>'+(e.t?'<div class="t">'+esc(e.t)+'</div>':'')+(e.p?'<div class="g-cap" style="font-size:10.5px">'+esc(e.p)+'</div>':'')+(e.a?'<p class="where">'+esc(e.a)+'</p>':'')+btn+'</div>'; }
  function gtl(cfg, esc, vert){ return '<ul class="g-tl'+(vert?' vert':'')+'">'+cfg.program.map(function(p){ return '<li>'+(vert?'':ic(iconFor(p.d),'g-ico'))+'<span class="d"></span><span class="x"><b>'+esc(p.t||'·')+'</b>'+esc(p.d)+'</span></li>'; }).join('')+'</ul>'; }
  function gdate(cfg, H, esc, plain){ var en = cfg.lang==='en', S = H.S; if(!cfg.date) return '';
    var d = cfg.date.split('-').map(Number), dt = new Date(Date.UTC(d[0],d[1]-1,d[2])), wd = (en?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[dt.getUTCDay()];
    var off = (new Date(Date.UTC(d[0],d[1]-1,1)).getUTCDay()+6)%7, dim = new Date(Date.UTC(d[0],d[1],0)).getUTCDate(), cal = '';
    S.wd.forEach(function(x){ cal += '<b>'+esc(x)+'</b>'; }); for(var i=0;i<off;i++) cal += '<span></span>'; for(var k=1;k<=dim;k++) cal += '<span'+(k===d[2]?' class="hit"':'')+'>'+k+'</span>';
    return { head:'<div class="g-date"><span class="g-cap g-dl">'+esc(wd)+'</span><span class="g-scr g-dn">'+d[2]+'</span><span class="g-cap g-dl">'+d[0]+'</span></div><div class="g-cap" style="font-size:10px;margin-top:8px;color:var(--soft)">'+esc(S.months[d[1]-1])+'</div>'+(cfg.time?'<div class="g-small">'+esc(S.at+' '+cfg.time)+'</div>':''), cal:'<div class="g-eyebrow" style="margin-top:34px">'+esc(en?'The big day':'O grande dia')+'</div><div class="g-cal">'+cal+'</div>' }; }
  function gcount(cfg, H, esc, cls, big){ if(!cfg.date) return ''; var S = H.S, iso = cfg.date+'T'+(cfg.time||'00:00')+':00', ms = new Date(iso).getTime()-Date.now(); if(isNaN(ms) || ms<=0) return '';
    var v = [Math.floor(ms/864e5), Math.floor(ms%864e5/36e5), Math.floor(ms%36e5/6e4), Math.floor(ms%6e4/1e3)];
    return '<div class="g-count '+(cls||'')+'" data-wi-count="'+iso+'" role="timer">'+[S.dd,S.hh,S.mm,S.ss].map(function(l,i){ return '<div><b data-u="'+i+'">'+(i?('0'+v[i]).slice(-2):v[i])+'</b><small>'+esc(l)+'</small></div>'; }).join('')+'</div>'; }
  function genInterior(cfg, esc, H, def){
    var en = cfg.lang==='en', S = H.S, sc = cfg.sections, h = '', pn = 0, secs = def.secs;
    var rs = function(band){ return H.tok ? '<a class="g-btn g-btn-r" href="https://www.weddy.pt/rsvp.html?g='+esc(H.tok)+'">'+esc(S.rsvpBtn)+'</a>' : '<p class="g-small">'+esc(S.rsvpNo)+'</p>'; };
    secs.forEach(function(k){ var a = k.split(':'), t = a[0];
      if(t==='photo'){ h += gsec('', gimg(cfg, pn++, a[1], a[2]||'r34', esc, a[3]==='bleed')); }
      else if(t==='quote'){ if(cfg.quote) h += gsec('', '<p style="max-width:28ch;font-size:14px">'+esc(cfg.quote)+'</p>'); }
      else if(t==='song'){ var sg = cfg.song; if(sg && (sg.t||sg.a)) h += gsec(a[1]==='band'?'band':'', '<p style="font-size:13px">'+esc(en?'Press play on our song':'Dê play à nossa canção')+'</p><h3 style="font-size:20px">'+esc(sg.t)+'</h3>'+(sg.a?'<div class="g-small">'+esc(sg.a)+'</div>':'')+(sg.u?'<a class="g-btn" href="'+esc(sg.u)+'" target="_blank" rel="noopener noreferrer">'+(en?'Listen':'Ouvir')+'</a>':'')); }
      else if(t==='datecount'){ var d = sc.datetime && gdate(cfg, H, esc); if(d){ h += gsec('band', '<p style="font-size:13px;max-width:28ch">'+esc(cfg.message || S.defMsg)+'</p>'+d.head+(gcount(cfg,H,esc,'colon')?'<div class="g-eyebrow" style="margin-top:26px">'+esc(en?'Countdown':'Faltam')+'</div>'+gcount(cfg,H,esc,'colon'):'')+(a[1]==='plain'?'':d.cal)); } }
      else if(t==='count'){ var c = sc.datetime && gcount(cfg,H,esc,''); if(c) h += gsec('', '<h3 style="font-style:italic">'+esc(en?'The big day is coming':'O grande dia está a chegar')+'</h3>'+c); }
      else if(t==='msg'){ if(a[1]==='verse'){ if(cfg.message) h += gsec('', '<p style="font-size:12px;max-width:30ch;font-style:italic">'+esc(cfg.message)+'</p>'); } else if(sc.message) h += gsec('', '<h3>'+esc(en?'With great joy':'Com muita alegria')+'</h3><p>'+esc(cfg.message || S.defMsg)+'</p>'); }
      else if(t==='evpair'||t==='evone'){ if(!sc.location) return; var one = t==='evone', e1 = gev('church', cfg.cer, cfg, H, esc), e2 = gev('glasses', cfg.rec, cfg, H, esc, one);
        if(!e1 && !e2 && (cfg.venue||cfg.address)) e1 = gev(one?'glasses':'church', { t:cfg.time, p:cfg.venue, a:cfg.address }, cfg, H, esc, one).replace(esc(en?'Ceremony':'Cerimónia religiosa'), esc(S.whereT)).replace(esc(en?'Reception':'Receção'), esc(S.whereT));
        if(one){ e1 = gev('glasses', cfg.rec || cfg.cer || { t:cfg.time, p:cfg.venue, a:cfg.address }, cfg, H, esc, true); e2 = ''; }
        if(e1||e2) h += gsec('', e1+(e2?'<div style="margin-top:34px">'+e2+'</div>':'')); }
      else if(t==='itin'){ if(sc.program && cfg.program.length) h += gsec('', '<h3>'+esc(en?'Schedule':'Itinerário de atividades')+'</h3>'+gtl(cfg, esc, false)); }
      else if(t==='schedule'){ if(sc.program && cfg.program.length) h += gsec('', '<div class="g-stripe"><div><div class="g-scr" style="font-size:42px">'+esc(en?'The programme':'O programa')+'</div>'+gtl(cfg, esc, true)+'</div></div>'); }
      else if(t==='dress'){ if(sc.dress && cfg.dress){ if(a[1]==='old') h += gsec('', '<div class="g-scr" style="font-size:42px">Dress code</div><p style="font-size:13px">'+esc(cfg.dress)+'</p>'); else h += gsec('', '<h3>'+esc(en?'Dress code':'Código de vestuário')+'</h3><div style="margin-top:12px">'+ic('couple','g-ico')+'</div><p style="font-size:13px">'+esc(cfg.dress)+'</p>'); } }
      else if(t==='gift'){ if(sc.gifts && (cfg.gifts||cfg.giftUrl)){ var band = a[2]==='band'||a[1]==='band' ? 'band' : ''; var qr = cfg.giftUrl ? giftQr(cfg, esc, S) : ''; h += gsec(band, ic('gift','g-ico')+(a[1]==='qr'?'<h3 style="font-style:italic">'+esc(S.giftsT)+'</h3>':'<div class="g-cap" style="font-size:11px;margin-top:8px">'+esc(S.giftsT)+'</div>')+(cfg.gifts?'<p style="font-size:13px">'+esc(cfg.gifts)+'</p>':'')+qr); } }
      else if(t==='hotel'){ if(cfg.hotel) h += gsec('band', ic('hotel','g-ico')+'<div class="g-cap" style="font-size:11px;margin-top:10px">'+esc(en?'Suggested accommodation':'Alojamento sugerido')+'</div><p style="font-size:12.5px">'+esc(cfg.hotel)+'</p>'+(cfg.hotelUrl?'<a class="g-btn g-btn-o" href="'+esc(cfg.hotelUrl)+'" target="_blank" rel="noopener noreferrer">'+(en?'More information':'Mais informação')+'</a>':'')); }
      else if(t==='rsvp'){ if(a[1]==='band') h += gsec('band', ic('cal','g-ico')+'<h3 style="font-style:italic">'+esc(S.rsvpT)+'</h3><p style="font-size:13px">'+esc(en?'Please confirm your attendance.':'Agradecemos que confirme a presença.')+'</p>'+rs()); else h += gsec('', '<div class="g-scr" style="font-size:42px">RSVP</div><p style="font-size:14px;max-width:26ch">'+esc(en?'Let us know if you can join us.':'Diga-nos se conta estar presente.')+'</p>'+rs()); }
      else if(t==='tips'){ var lines = (sc.tips && cfg.tips) ? String(cfg.tips).split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean) : [];
        var tp = lines.length ? '<div class="g-tips">'+lines.map(function(l){ var m = l.match(/^([^:]{2,28}):\s*(.+)$/); return m ? '<div><strong>'+esc(m[1])+'</strong><span>'+esc(m[2])+'</span></div>' : '<div><span>'+esc(l)+'</span></div>'; }).join('')+'</div>' : '';
        var kd = (sc.kids && cfg.kids) ? '<p style="font-size:12.5px;margin-top:22px"><b class="g-cap" style="font-size:10px">'+esc(S.kidsT)+'</b><br>'+esc(cfg.kids)+'</p>' : '';
        if(tp||kd) h += gsec('', ic('heart','g-ico')+(tp?'<div class="g-cap" style="font-size:11px;margin-top:8px">'+esc(en?'Recommendations':'Recomendações')+'</div>'+tp:'')+kd); }
      else if(t==='thanks'){ h += gsec(a[1]==='band'?'band':'', '<div class="g-scr" style="font-size:54px;line-height:.9">'+esc(en?'Thank you':'Obrigado')+'</div><p style="font-size:13px">'+esc(en?'Thank you for celebrating this day with us.':'Obrigado por celebrarem connosco este dia e por o tornarem um dos mais especiais das nossas vidas.')+'</p><div class="g-scr" style="font-size:28px;margin-top:14px">'+esc(cfg.names)+'</div>'); }
      else if(t==='mono'){ var mp = H.mono; h += gsec('', '<div style="font:var(--f-mono, 400 44px/1 var(--f-serif));letter-spacing:.06em">'+esc(mp[0])+'<span style="font-weight:300;margin:0 10px;color:var(--soft)">|</span>'+esc(mp[1])+'</div><div class="g-cap" style="font-size:10.5px;margin-top:14px">'+esc(en?'We are getting married!':'Vamos casar!')+'</div>'); }
      else if(t==='parents'){ if(cfg.parents) h += gsec('band', '<p style="font-size:12.5px">'+esc(en?'With the love that unites us and the support of our parents:':'Com o amor que nos une e o apoio dos nossos pais:')+'</p><p style="font-style:italic;font-size:13px;margin-top:14px">'+esc(cfg.parents).replace(/\n/g,'<br>')+'</p>'); }
      else if(t==='yes'){ h += gsec('', '<div class="g-cardin" style="transform:rotate(-1.5deg)"><div class="g-scr" style="font-size:40px">'+esc(en?'She said yes!':'Ela disse sim!')+'</div><p style="font-size:13px">'+esc(en?'We would be delighted to invite you to our wedding on':'Teremos muito gosto em convidá-lo para o nosso casamento a')+'</p><div class="g-scr" style="font-size:26px;margin-top:10px">'+esc(H.dl)+'</div></div>'); }
      else if(t==='story'){ if(cfg.story){ var p1 = gph(cfg, pn++, 'walk'), p2 = gph(cfg, pn++, 'beach'); h += gsec('', '<div class="g-scr" style="font-size:44px">'+esc(en?'Our story':'A nossa história')+'</div><p style="font-size:13px;max-width:28ch">'+esc(cfg.story)+'</p><div class="g-polas"><div class="g-pola"><figure class="g-ph"><img src="'+esc(p1.src)+'" alt="" loading="lazy"></figure></div><div class="g-pola"><figure class="g-ph"><img src="'+esc(p2.src)+'" alt="" loading="lazy"></figure></div></div>'); } }
      else if(t==='faq'){ var fl = (cfg.tips||'').split(/\n+/).map(function(x){ return x.match(/^([^:]{2,60}):\s*(.+)$/); }).filter(Boolean); if(sc.tips && fl.length) h += gsec('', '<div class="g-scr" style="font-size:40px">'+esc(en?'Details and questions':'Detalhes e dúvidas')+'</div><div class="g-faq">'+fl.map(function(m){ return '<div><i>'+esc(m[1])+'</i><span>'+esc(m[2])+'</span></div>'; }).join('')+'</div>'); }
      else if(t==='addr'){ var ad = [['church',cfg.cer],['glasses',cfg.rec]].filter(function(x){ return x[1] && (x[1].p||x[1].a); }); if(!ad.length && (cfg.venue||cfg.address)) ad = [['church',{p:cfg.venue,a:cfg.address}]]; if(ad.length) h += gsec('band', '<div class="g-scr" style="font-size:38px">'+esc(en?'Addresses':'Moradas')+'</div><div style="text-align:left;max-width:270px;margin:22px auto 0;display:grid;gap:18px">'+ad.map(function(x,i){ return '<div><i class="g-scr" style="font-size:26px">'+esc(i?(en?'Reception':'Receção'):(en?'Ceremony':'Cerimónia'))+'</i><p style="margin:4px 0 0;font-size:12.5px;max-width:none">'+esc([x[1].p,x[1].a].filter(Boolean).join(', '))+'</p></div>'; }).join('')+'</div>'); }
      else if(t==='hash'){ h += hashHtml(cfg, esc); }
      else if(t==='flor'){ h += '<div class="g-flor" style="background-image:var(--a-flor'+(a[1]||1)+')"></div>'; }
      else if(t==='foot'){ h += '<div class="g-foot">'+esc(cfg.names)+(cfg.date?' · '+esc(H.dots):'')+'</div>'; }
    });
    return h; }
  function genCss(){
    return [
      '.g-sec{position:relative;padding:54px 28px;text-align:center;color:var(--ink)}',
      '.g-sec.band{--ink:var(--bandfg);--soft:var(--bandsoft);--rule:var(--bandrule);--hit:var(--bandfg);--hitfg:var(--bandbg);--chipfg:var(--bandbg);--paperc:var(--bandbg);background-color:var(--bandbg);background-image:var(--bandimg);background-size:360px;color:var(--bandfg)}',
      '.g-eyebrow{font:400 10.5px/1.4 var(--f-ui);letter-spacing:.32em;text-transform:uppercase;color:var(--soft)}',
      '.g-sec h3{margin:10px 0 0;font:var(--h3);color:var(--ink);text-wrap:balance}.g-sec p{margin:12px auto 0;max-width:30ch;font:var(--fp);color:var(--ink);text-wrap:pretty}',
      '.g-scr{font-family:var(--f-scr);font-weight:400;color:var(--ink);line-height:1.05}.g-cap{font:var(--fcap);letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}',
      '.g-small{font:300 12px/1.5 var(--f-ui);color:var(--soft);margin-top:6px}',
      '.g-ph{position:relative;display:block;overflow:hidden;background:#444;margin:0}.g-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.g-demo{position:absolute;left:10px;top:10px;font:400 8.5px/1 var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.85);background:rgba(0,0,0,.35);padding:4px 7px;border-radius:99px}',
      '.g-shd{box-shadow:0 14px 24px rgba(30,25,15,.28),0 2px 4px rgba(30,25,15,.22)}.r45{aspect-ratio:4/5}.r34{aspect-ratio:3/4}.r43{aspect-ratio:4/3}.r32{aspect-ratio:3/2}.r11{aspect-ratio:1/1}.g-bleed{margin:0 -28px}.g-bleed .g-ph{box-shadow:none}',
      '.g-date{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:22px}.g-dl{font-size:10px;border-bottom:1px solid var(--rule);padding:0 10px 6px}.g-dn{font-size:54px}',
      '.g-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px 0;max-width:270px;margin:18px auto 0;font:400 12px/1 var(--f-ui);color:var(--ink);font-variant-numeric:tabular-nums}.g-cal b{font-weight:400;color:var(--soft);font-size:9.5px;letter-spacing:.1em;padding-bottom:6px}.g-cal span{height:30px;display:grid;place-items:center;position:relative}.g-cal .hit{color:var(--hitfg);z-index:1}.g-cal .hit::before{content:"";position:absolute;width:30px;height:30px;border-radius:50%;background:var(--hit);z-index:-1}',
      '.g-count{display:flex;justify-content:center;gap:10px;margin-top:18px;font-variant-numeric:tabular-nums}.g-count div{display:grid;gap:5px;min-width:56px}.g-count b{font:var(--hn);color:var(--ink)}.g-count small{font:400 9px/1 var(--f-ui);letter-spacing:.24em;text-transform:uppercase;color:var(--soft)}.g-count.colon div+div{border-left:1px solid var(--rule)}',
      '.g-ev{display:grid;gap:6px;justify-items:center}.g-ev .t{font:var(--hn);color:var(--ink)}.g-ev .where{font:var(--fp);max-width:26ch;margin:0}',
      '.g-btn{display:inline-block;margin-top:14px;padding:11px 22px;border-radius:99px;background:var(--btn);color:var(--btnfg);font:500 10px/1 var(--f-ui);letter-spacing:.22em;text-transform:uppercase;text-decoration:none;border:0}.g-btn.sq{border-radius:2px}.g-sec.band .g-btn{background:var(--bandfg);color:var(--bandbg)}.g-btn-o{background:transparent!important;color:var(--bandfg)!important;border:1px solid var(--bandrule)!important}',
      '.g-ico{width:34px;height:34px;color:var(--ink);display:block;margin:0 auto}',
      '.g-tl{list-style:none;margin:24px auto 0;padding:0;max-width:290px;text-align:left}.g-tl li{display:grid;grid-template-columns:40px 18px 1fr;align-items:start;padding:0 0 22px;position:relative}.g-tl .d{position:relative;height:100%}.g-tl .d::before{content:"";position:absolute;left:6px;top:8px;width:7px;height:7px;border-radius:50%;background:var(--ink)}.g-tl .d::after{content:"";position:absolute;left:9px;top:18px;bottom:-6px;width:1px;background:var(--rule)}.g-tl li:last-child .d::after{display:none}.g-tl .x{font:var(--fp);line-height:1.3}.g-tl .x b{font:500 12px/1.4 var(--f-ui);letter-spacing:.06em;color:var(--ink);display:block;font-variant-numeric:tabular-nums}',
      '.g-tl.vert{text-align:center;max-width:240px}.g-tl.vert li{display:block;padding:0 0 4px}.g-tl.vert li::after{content:"";display:block;width:1px;height:26px;background:var(--ink);margin:12px auto}.g-tl.vert li:last-child::after{display:none}.g-tl.vert .d{display:none}',
      '.g-tips{display:grid;gap:14px;margin:22px auto 0;max-width:280px;text-align:left}.g-tips div{border-top:1px solid var(--rule);padding-top:12px}.g-tips strong{display:block;font:500 10.5px/1.4 var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}.g-tips span{font:var(--fp)}',
      '.g-faq{display:grid;gap:18px;margin:22px auto 0;max-width:280px}.g-faq i{display:block;font:var(--f-faq);color:var(--ink);margin-bottom:6px}.g-faq span{font:var(--fp)}',
      '.g-foot{padding:36px 28px 54px;text-align:center;font:400 10px/1.8 var(--f-ui);letter-spacing:.3em;text-transform:uppercase;color:var(--soft)}',
      '.g-stripe{position:relative;padding:34px 22px}.g-stripe::before{content:"";position:absolute;inset:6px;border:1px solid var(--ink);pointer-events:none}.g-stripe::after{content:"";position:absolute;inset:12px;border:.5px solid var(--soft);pointer-events:none}.g-stripe>div{padding:18px 8px}',
      '.g-polas{position:relative;height:215px;margin:20px auto 0;max-width:300px}.g-pola{position:absolute;width:150px;background:#fbfaf7;padding:7px 7px 24px;box-shadow:0 10px 18px rgba(0,0,0,.28)}.g-pola .g-ph{aspect-ratio:1/1}.g-pola:nth-child(1){left:4px;top:14px;transform:rotate(-4deg)}.g-pola:nth-child(2){right:4px;top:0;transform:rotate(3deg)}.g-pola::before{content:"";position:absolute;top:-8px;left:50%;width:46px;height:15px;margin-left:-23px;background:rgba(220,205,170,.7);transform:rotate(-2deg);z-index:2}',
      '.g-cardin{position:relative;margin:0 auto;max-width:280px;background-color:#fbfbf9;padding:26px 18px;box-shadow:0 14px 24px rgba(40,30,15,.28),0 2px 4px rgba(40,30,15,.2)}',
      '.g-flor{height:96px;background:center/contain no-repeat;margin:-14px -10px}',
      '.g-sec .wv-qr{width:150px;height:150px;margin:18px auto 0;padding:8px;background:#fff}.g-sec .wp-btn{margin-top:14px}.g-sec.band .wp-btn.ghost{color:var(--bandfg);border-color:var(--bandfg)}.wv-gq{display:grid;gap:14px;justify-items:center;margin-top:16px}',
      '.wv .wp-hero{display:block}.wv .wp{background-color:var(--paperc);background-image:var(--paperimg);background-size:420px;color:var(--ink)}.wv .wp-hero{padding:0}',
      '.wv-hash{padding:30px 28px;text-align:center;color:var(--ink)}.wv-hash h2{font:var(--h3);margin:0;color:var(--ink);text-transform:none;letter-spacing:0;font-size:22px}.wv-hn{font:400 34px/1.1 var(--f-scr);color:var(--ink);margin:6px 0 10px;overflow-wrap:anywhere}.wv-hash .wp-p{font:var(--fp)}'
    ].join('');
  }

  /* ---------- modelos portados do protótipo (convites8/m-*.js) ---------- */
  function ctx(cfg, esc, P){
    var mm = String(P.mono||'').split('·'), dd = cfg.date ? cfg.date.split('-') : null;
    var X = { dnum: esc(P.date), dot2: dd ? dd[2]+'.'+dd[1]+'.'+dd[0] : '', venue: esc(cfg.venue||''), town: esc(cfg.address||''), n1: esc(P.names[0]||''), n2: esc(P.names[1]||''), m1: esc(mm[0]||''), m2: esc(mm[1]||''), verse: esc(cfg.quote||''),
      U: function(f){ return BASE+'img/'+f; },
      cov: function(k){ var u = cfg.photos && cfg.photos.cover; return u ? u : BASE+(DEMOK[k]||DEMOK.walk); },
      ph: function(id, cls, key){ return '<figure class="ph g-ph '+esc(cls||'')+'"><img src="'+esc(X.cov(key))+'" alt="" loading="eager"></figure>'; } };
    return X; }
  function resolveU(str){ return str.replace(/\{\{U:([^}]+)\}\}/g, function(m, f){ return BASE+'img/'+f; }); }
  function registerPorted(id, d){
    var n = id.slice(2), root_ = '.wv-'+n;
    var stageBg = d.stage ? 'background-image:url('+BASE+'img/'+d.stage+');background-size:360px;' : '';
    MODELS[id] = { secs:d.secs,
      vars:function(){ return resolveU(d.vars)+";--f-ui:'W Jost',system-ui,sans-serif"; },
      css:function(){
        var g = resolveU(d.css).replace(/@O/g, O);
        return root_+'{'+resolveU(d.vars)+";--f-ui:'W Jost',system-ui,sans-serif}"+
          root_+' .wv-stage{background-color:var(--tablec);'+stageBg+'}'+root_+' .wv-stage::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 40%,rgba(0,0,0,.38));pointer-events:none}'+
          root_+' .wv-hint{color:var(--hint)}'+root_+' .scr{font-family:var(--f-scr);font-weight:400;color:var(--ink);line-height:1.05}'+root_+' .cap{font:var(--fcap);letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}'+root_+' .small{font:300 12px/1.5 var(--f-ui);color:var(--soft);margin-top:6px}'+root_+' .band{--ink:var(--bandfg);--soft:var(--bandsoft);--rule:var(--bandrule);color:var(--bandfg);background-color:var(--bandbg);background-image:var(--bandimg);background-size:360px}'+g; },
      cover:function(cfg, esc, P){ return d.cover(ctx(cfg, esc, P)); },
      card:function(cfg, full, esc, P){ var h = d.hero(ctx(cfg, esc, P)); return full ? h : h.replace(/min-height:700px/g,'min-height:0'); } };
  }
  function register(id, def){ MODELS[id] = def; }

  var MODELS = {
    'w-verde': { cover:cover1, card:card1, css:css1, interior:interior1, photos:3 }
  };

  /* ---------- estrutura comum (palco + página) ---------- */
  var WRAP_CSS = [
    '.wv{position:relative}',
    '.wv-chk{position:fixed;left:-9999px;top:0;opacity:0}',
    '.wv-stage{position:fixed;inset:0;z-index:50;overflow:hidden;cursor:pointer;display:block}',
    '.wv-chk:focus-visible~.wv-stage{outline:3px solid #fff;outline-offset:-6px}',
    '.wv-hint{position:absolute;bottom:34px;left:0;right:0;text-align:center;font:500 11px/1 system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#e5e8d0;z-index:9;transition:opacity .5s;pointer-events:none}',
    '.wv-chk:checked~.wv-stage .wv-hint{opacity:0}',
    '.wv-page{visibility:hidden}',
    '.wv-chk:checked~.wv-page{animation:wvshow 0s linear 3.6s forwards}',
    '@keyframes wvshow{to{visibility:visible}}',
    '.wv-chk:checked~.wv-stage{animation:wvfade 1.4s ease 3.6s forwards}',
    '@keyframes wvfade{to{opacity:0;visibility:hidden}}',
    '@media(prefers-reduced-motion:reduce){.wv-stage *{transition:none!important;animation:none!important}.wv-chk:checked~.wv-page{animation:none;visibility:visible}.wv-chk:checked~.wv-stage{animation:none;display:none}}'
  ].join('');
  var FONT_CSS = function(){
    var L = [['W Great Vibes','great-vibes.woff2','400','normal'],['W Playfair','playfair.woff2','400','normal'],['W Playfair','playfair-italic.woff2','400','italic'],
      ['W Jost','jost-300.woff2','300','normal'],['W Jost','jost-400.woff2','400','normal'],['W Jost','jost-500.woff2','500','normal'],
      ['W Pinyon','pinyon-script-400.woff2','400','normal'],['W Bodoni','bodoni-moda-400.woff2','400','normal'],['W Bodoni','bodoni-moda-400i.woff2','400','italic'],
      ['W Alex Brush','alex-brush-400.woff2','400','normal'],['W Allura','allura-400.woff2','400','normal'],['W Italiana','italiana-400.woff2','400','normal'],
      ['W Mrs Saint','mrs-saint-delafield-400.woff2','400','normal'],['W Parisienne','parisienne-400.woff2','400','normal'],
      ['W Cormorant','cormorant-garamond-400.woff2','400','normal'],['W Cormorant','cormorant-garamond-400i.woff2','400','italic'],['W Cormorant','cormorant-garamond-500.woff2','500','normal']];
    return L.map(function(f){ return '@font-face{font-family:\''+f[0]+'\';font-weight:'+f[2]+';font-style:'+f[3]+';src:url('+BASE+'fonts/'+f[1]+') format(\'woff2\');font-display:swap}'; }).join('');
  };

  function isW(id){ return !!MODELS[id]; }
  /* css extra para a página (inclui só o modelo em uso) */
  function pageCss(id){ var m = MODELS[id]; if(!m) return ''; var n = id.slice(2); return FONT_CSS()+WRAP_CSS+(m.secs ? genCss()+'.wv-'+n+' .wp{'+m.vars(U)+'}' : '')+m.css(); }
  /* parts: calculado pelo motor (nomes, monograma, data) para não duplicar lógica */
  function wrap(id, cfg, innerHtml, parts, esc){
    var m = MODELS[id];
    var hero = m.card(cfg, true, esc, parts);
    var gal = function(i, wide){ return '<figure class="wv-ph'+(wide?' w':'')+'"><img src="'+esc(ph(cfg,i))+'" alt="" loading="lazy" decoding="async">'+(demo(cfg,i)?'<div class="wv-demo">Fotografia demonstrativa</div>':'')+'</figure>'; };
    var out = '<div class="wv wv-'+id.slice(2)+'"><input type="checkbox" class="wv-chk" id="wv-open" aria-label="'+esc(parts.openLabel)+'">'+
      '<label for="wv-open" class="wv-stage" aria-label="'+esc(parts.openLabel)+'">'+m.cover(cfg, esc, parts)+'<div class="wv-hint">'+esc(parts.openLabel)+'</div></label>'+
      '<div class="wv-page">'+decorate(innerHtml, cfg, esc).replace('<!--WV-HERO-->', hero).replace('<!--WV-HASH-->', hashHtml(cfg, esc)).replace('<!--WV-PH0-->', gal(0)+quoteHtml(cfg, esc)+songHtml(cfg, esc)).replace('<!--WV-PH1-->', gal(1,true))+'</div></div>';
    return out;
  }
  root.WeddyInviteW = { register:register, registerPorted:registerPorted, genInterior:genInterior, h:{ic:ic, iconFor:iconFor, url:url, U:U, O:O, BASE:BASE}, isW:isW, pageCss:pageCss, baseCss:BASE_CSS, wrap:wrap, models:MODELS, base:BASE, giftQr:giftQr };
  if(typeof module!=='undefined' && module.exports) module.exports = root.WeddyInviteW;
})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));
