/* ============================================================================
   Weddy Invitations — renderizador partilhado dos convites digitais
   Usado em: index.html (editor/pré-visualização), convite.html (página pública)
   e na geração do cartão digital (PNG).
   REGRAS: só recebe uma configuração já normalizada por sanitize(); todo o texto
   passa por esc(), todo o URL por safeUrl() (só https), cores só #rrggbb e
   tipos de letra só da lista permitida. Nunca injeta HTML/JS de utilizadores.
   ========================================================================== */
(function(root){
  'use strict';
  var FONTS = ['Cormorant Garamond','Manrope','Georgia','Helvetica'];
  var LIM = { names:60, intro:200, message:300, venue:120, address:240, dress:300, mapUrl:300, prog:12, progT:12, progD:80, mono:8 };
  var SECTIONS = ['cover','message','datetime','location','map','program','dress'];
  function P(id,name,bg,ink,ac,soft){ return { id:id, name:name, bg:bg, ink:ink, ac:ac, soft:soft }; }
  var TEMPLATES = [
    { id:'editorial', name:{pt:'Editorial',en:'Editorial'}, desc:{pt:'Elegância intemporal, com um toque natural.',en:'Timeless elegance with a natural touch.'}, style:'classicos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('creme','Creme','#F6F0E6','#2E2A25','#6F8458','#E7DEC9'),P('areia','Areia','#F3EADF','#2B2622','#A86A52','#E8D8C6'),P('salvia','Sálvia','#F1F2EA','#26301F','#5E7A57','#DDE3D0')] },
    { id:'minimal', name:{pt:'Minimal',en:'Minimal'}, desc:{pt:'Linhas puras e modernas.',en:'Clean, modern lines.'}, style:'minimalistas', fonts:['Manrope','Cormorant Garamond'], photo:false,
      palettes:[P('branco','Branco','#FFFFFF','#1F1D1B','#8B6B5E','#F1ECE8'),P('pedra','Pedra','#F4F2EF','#1F1D1B','#5B5551','#E4E0DB'),P('noite','Noite','#EEF0F2','#1B2128','#3F5568','#DCE1E6')] },
    { id:'jardim', name:{pt:'Jardim',en:'Garden'}, desc:{pt:'Floral e romântico.',en:'Floral and romantic.'}, style:'botanicos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('folha','Folha','#F7F5EC','#2A3224','#5F7F4E','#E3EAD6'),P('rosa','Rosa','#FBF3F0','#3A2A2A','#B9685F','#F3DCD6'),P('lavanda','Lavanda','#F6F3F8','#2E2838','#7C6A98','#E6DEEE')] },
    { id:'classico', name:{pt:'Clássico',en:'Classic'}, desc:{pt:'Tradicional e sofisticado.',en:'Traditional and sophisticated.'}, style:'classicos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('bordeaux','Bordeaux','#F8F2EC','#3A1F25','#7A2E3A','#EBDCD3'),P('marinho','Marinho','#F4F3EE','#1B2433','#2F4A6D','#E0E1DC'),P('esmeralda','Esmeralda','#F3F4EE','#18291F','#2F5E46','#DDE3D6')] },
    { id:'mediterranico', name:{pt:'Mediterrânico',en:'Mediterranean'}, desc:{pt:'Inspirado no Mediterrâneo.',en:'Inspired by the Mediterranean.'}, style:'contemporaneos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('terracota','Terracota','#FBF1E6','#3A261C','#B8603E','#F1DCC6'),P('azul','Azul','#F3F6F7','#1D2B38','#3C6E8F','#DCE6EA'),P('oliva','Oliva','#F7F3E6','#2D3320','#7C8A45','#E8E6C9')] },
    { id:'romantico', name:{pt:'Romântico',en:'Romantic'}, desc:{pt:'Delicado e encantador.',en:'Delicate and enchanting.'}, style:'romanticos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('blush','Blush','#FCF1EE','#42282B','#B5666A','#F5DADA'),P('pessego','Pêssego','#FDF3EA','#44291F','#BE7550','#F6DFCB'),P('malva','Malva','#F8F1F5','#3B2A38','#A66A8F','#EBD6E3')] },
    { id:'couture', name:{pt:'Couture',en:'Couture'}, desc:{pt:'Sofisticação em tons profundos.',en:'Sophistication in deep tones.'}, style:'contemporaneos', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('preto','Preto e ouro','#1E1B19','#F3EBDD','#C9A86A','#34302C'),P('verde','Verde profundo','#18261F','#EEF0E6','#C9B27A','#26382E'),P('vinho','Vinho','#2A1519','#F6E9E4','#D4A98A','#3E2227')] },
    { id:'campestre', name:{pt:'Campestre',en:'Countryside'}, desc:{pt:'Simples, caloroso e ao ar livre.',en:'Simple, warm and outdoorsy.'}, style:'botanicos', fonts:['Manrope','Cormorant Garamond'], photo:false,
      palettes:[P('kraft','Kraft','#EFE3D0','#3A2E22','#8A5A3B','#E1D0B5'),P('trigo','Trigo','#F5EBD5','#3B3220','#A57F2F','#E8D9B4'),P('campo','Campo','#EEF0E1','#2B3320','#6D7F3C','#DADFC0')] }
  ];
  var STYLES = ['classicos','minimalistas','romanticos','botanicos','contemporaneos'];
  var STR = {
    pt:{ months:['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], and:'e', save:'Guardem a data', msgT:'Uma mensagem', whenT:'Data e hora', whereT:'Local', mapBtn:'Ver no mapa', progT:'Programa', dressT:'Dress code', rsvpT:'Confirmar presença', rsvpBtn:'Confirmar presença', rsvpNo:'Para responderes, usa o link individual do teu convite, enviado pelos noivos.', at:'às', foot:'Feito com Weddy', defMsg:'Com muita alegria, convidamos-vos para celebrar connosco este dia tão especial.', invite:'Convite' },
    en:{ months:['January','February','March','April','May','June','July','August','September','October','November','December'], and:'and', save:'Save the date', msgT:'A message', whenT:'Date & time', whereT:'Venue', mapBtn:'View on map', progT:'Schedule', dressT:'Dress code', rsvpT:'RSVP', rsvpBtn:'RSVP', rsvpNo:'To reply, use the individual link from your invitation, sent by the couple.', at:'at', foot:'Made with Weddy', defMsg:'With great joy, we invite you to celebrate this special day with us.', invite:'Invitation' }
  };
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function safeUrl(u){ u = String(u||'').trim(); if(!/^https:\/\/[^\s"'<>]+$/i.test(u)) return ''; try{ var p = new URL(u); return p.protocol==='https:' ? p.href : ''; }catch(e){ return ''; } }
  function hex(c, d){ return /^#[0-9a-f]{6}$/i.test(String(c||'')) ? String(c).toLowerCase() : d; }
  function lum(h){ var c=[1,3,5].map(function(i){ var v=parseInt(h.substr(i,2),16)/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
  function contrast(a,b){ var x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  function tplOf(id){ for(var i=0;i<TEMPLATES.length;i++) if(TEMPLATES[i].id===id) return TEMPLATES[i]; return TEMPLATES[0]; }
  function clip(s,n){ return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,n); }
  function fontOk(f){ f = String(f||'').trim().toLowerCase(); for(var i=0;i<FONTS.length;i++) if(FONTS[i].toLowerCase()===f) return FONTS[i]; return ''; }
  function validDate(d){ if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return ''; var t = new Date(d+'T00:00:00Z'); return isNaN(t.getTime()) || t.toISOString().slice(0,10)!==d ? '' : d; }
  function validTime(t){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(t||'') ? t : ''; }
  // Normaliza qualquer entrada (rascunho do cliente ou pedido ao servidor) para uma configuração segura.
  function sanitize(raw, lang){
    raw = (raw && typeof raw==='object') ? raw : {};
    var tpl = tplOf(raw.tpl), pal = null;
    var cp = raw.pal && typeof raw.pal==='object' ? raw.pal : {};
    var pid = String(raw.palette||'');
    for(var i=0;i<tpl.palettes.length;i++) if(tpl.palettes[i].id===pid) pal = tpl.palettes[i];
    if(!pal && pid==='custom'){
      var base = tpl.palettes[0], ac = hex(cp.ac, ''), soft = hex(cp.soft, '');
      if(ac && contrast(ac, base.bg) >= 3){ pal = P('custom','Weddy', base.bg, base.ink, ac, soft || base.soft); }
    }
    if(!pal) pal = tpl.palettes[0];
    var out = { v:1, tpl:tpl.id, palette:pal.id, colors:{ bg:pal.bg, ink:pal.ink, ac:pal.ac, soft:pal.soft },
      names: clip(raw.names, LIM.names).trim(), intro: clip(raw.intro, LIM.intro).trim(), message: clip(raw.message, LIM.message).trim(),
      date: validDate(raw.date), time: validTime(raw.time), venue: clip(raw.venue, LIM.venue).trim(), address: clip(raw.address, LIM.address).trim(),
      mapUrl: safeUrl(clip(raw.mapUrl, LIM.mapUrl)), dress: clip(raw.dress, LIM.dress).trim(), mono: clip(raw.mono, LIM.mono).trim(),
      fontMain: fontOk(raw.fontMain) || tpl.fonts[0], fontSecond: fontOk(raw.fontSecond) || tpl.fonts[1], deco: raw.deco !== false,
      program: [], sections:{}, lang: lang==='en'||raw.lang==='en' ? 'en' : 'pt' };
    (Array.isArray(raw.program)?raw.program:[]).slice(0, LIM.prog).forEach(function(p){ if(!p||typeof p!=='object') return; var t=validTime(p.t), d=clip(p.d, LIM.progD).trim(); if(d) out.program.push({ t:t, d:d }); });
    var sc = raw.sections && typeof raw.sections==='object' ? raw.sections : {};
    SECTIONS.forEach(function(k){ out.sections[k] = (k==='cover') ? true : (sc[k] !== false && sc[k] !== 0); });
    if(raw.sections && raw.sections.dress == null) out.sections.dress = true;
    return out;
  }
  function dateLong(cfg){ var S=STR[cfg.lang]; if(!cfg.date) return ''; var p=cfg.date.split('-'); return cfg.lang==='en' ? S.months[+p[1]-1]+' '+(+p[2])+', '+p[0] : (+p[2])+' de '+S.months[+p[1]-1]+' de '+p[0]; }
  function dateDots(cfg){ if(!cfg.date) return ''; var p=cfg.date.split('-'); return p[2]+' · '+p[1]+' · '+p[0]; }
  function splitNames(cfg){ var n = cfg.names||''; var m = n.split(/\s+(?:&|e|and)\s+/i); return m.length>=2 ? [m[0].trim(), m.slice(1).join(' ').trim()] : [n, '']; }
  function monoOf(cfg){ if(cfg.mono) return cfg.mono; var a=splitNames(cfg); var f=function(s){ return (s||'').trim().charAt(0).toUpperCase(); }; return a[1] ? f(a[0])+'&'+f(a[1]) : f(a[0]); }
  /* ---------- ornamentos (SVG inline originais) ---------- */
  function leaf(x,y,r,rot){ return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+(r*0.42)+'" ry="'+r+'" transform="rotate('+rot+' '+x+' '+y+')"/>'; }
  function sprig(w,h,flip){ var L=''; for(var i=0;i<7;i++){ var y=20+i*20; L+=leaf(48-8,y,13,-35)+leaf(56,y+8,13,35); } L+=leaf(48,8,12,0);
    return '<svg class="wi-orn" viewBox="0 0 100 160" width="'+w+'" height="'+h+'" style="'+(flip?'transform:scaleX(-1) rotate(180deg)':'')+'" aria-hidden="true"><path d="M52 150 C50 100 52 60 50 10" fill="none" stroke="var(--ac)" stroke-width="1.4"/><g fill="var(--ac)" opacity=".55">'+L+'</g></svg>'; }
  function wreath(){ var L=''; for(var i=0;i<28;i++){ var a=i*360/28, r=118; var x=150+r*Math.cos(a*Math.PI/180), y=150+r*Math.sin(a*Math.PI/180); L+=leaf(x.toFixed(1),y.toFixed(1),11,(a+90+(i%2?25:-25)).toFixed(0)); }
    return '<svg class="wi-orn wi-wreath" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="118" fill="none" stroke="var(--ac)" stroke-width="1" opacity=".6"/><g fill="var(--ac)" opacity=".45">'+L+'</g></svg>'; }
  function flower(x,y,r){ var P=''; for(var i=0;i<6;i++) P+='<ellipse cx="'+x+'" cy="'+(y-r*0.62)+'" rx="'+(r*0.38)+'" ry="'+(r*0.62)+'" transform="rotate('+(i*60)+' '+x+' '+y+')"/>'; return '<g fill="var(--ac)" opacity=".5">'+P+'</g><circle cx="'+x+'" cy="'+y+'" r="'+(r*0.2)+'" fill="var(--ac)"/>'; }
  function corners(){ var F=flower(34,34,22)+flower(70,18,11)+flower(20,72,11)+'<path d="M40 60 C60 70 70 80 80 100" stroke="var(--ac)" fill="none" opacity=".5"/>';
    return '<svg class="wi-orn wi-cn wi-cn1" viewBox="0 0 110 110" aria-hidden="true">'+F+'</svg><svg class="wi-orn wi-cn wi-cn2" viewBox="0 0 110 110" aria-hidden="true">'+F+'</svg>'; }
  function frame2(){ return '<svg class="wi-orn wi-frame" viewBox="0 0 360 540" preserveAspectRatio="none" aria-hidden="true"><rect x="14" y="14" width="332" height="512" fill="none" stroke="var(--ac)" stroke-width="1.6"/><rect x="22" y="22" width="316" height="496" fill="none" stroke="var(--ac)" stroke-width=".7"/><g fill="var(--ac)"><rect x="10" y="10" width="8" height="8"/><rect x="342" y="10" width="8" height="8"/><rect x="10" y="522" width="8" height="8"/><rect x="342" y="522" width="8" height="8"/></g></svg>'; }
  function arch(){ var rays=''; for(var i=0;i<9;i++){ var a=(-80+i*20)*Math.PI/180; rays+='<line x1="'+(100+34*Math.sin(a)).toFixed(1)+'" y1="'+(104-34*Math.cos(a)).toFixed(1)+'" x2="'+(100+50*Math.sin(a)).toFixed(1)+'" y2="'+(104-50*Math.cos(a)).toFixed(1)+'"/>'; }
    return '<svg class="wi-orn wi-arch" viewBox="0 0 200 250" aria-hidden="true"><path d="M10 245 V105 A90 90 0 0 1 190 105 V245 Z" fill="var(--soft)" stroke="var(--ac)" stroke-width="1.6"/><circle cx="100" cy="104" r="22" fill="var(--ac)" opacity=".85"/><g stroke="var(--ac)" stroke-width="2" stroke-linecap="round">'+rays+'</g><path d="M10 215 q20-10 40 0 t40 0 t40 0 t40 0 t20 0" fill="none" stroke="var(--ac)" stroke-width="1.6" opacity=".7"/><path d="M10 230 q20-10 40 0 t40 0 t40 0 t40 0 t20 0" fill="none" stroke="var(--ac)" stroke-width="1.2" opacity=".5"/></svg>'; }
  function gold(){ return '<svg class="wi-orn wi-gold" viewBox="0 0 360 540" preserveAspectRatio="none" aria-hidden="true"><rect x="18" y="18" width="324" height="504" fill="none" stroke="var(--ac)" stroke-width="1"/><path d="M18 70 H342 M18 470 H342" stroke="var(--ac)" stroke-width=".6" opacity=".7"/><g fill="var(--ac)"><rect x="176" y="66" width="8" height="8" transform="rotate(45 180 70)"/><rect x="176" y="466" width="8" height="8" transform="rotate(45 180 470)"/></g></svg>'; }
  function bunting(){ var T='', cols=['var(--ac)','var(--soft)','var(--ink)']; for(var i=0;i<9;i++){ var x=18+i*40; T+='<path d="M'+x+' 8 L'+(x+34)+' 8 L'+(x+17)+' 40 Z" fill="'+cols[i%3]+'" opacity="'+(i%3===2?.55:.8)+'"/>'; }
    return '<svg class="wi-orn wi-bunt" viewBox="0 0 360 46" aria-hidden="true"><path d="M0 6 Q180 22 360 6" fill="none" stroke="var(--ink)" opacity=".5"/><g transform="translate(0,4)">'+T+'</g></svg><div class="wi-dots" aria-hidden="true"></div>'; }
  function ornaments(cfg){
    if(!cfg.deco) return '';
    switch(cfg.tpl){
      case 'editorial': return '<span class="wi-o wi-o-a">'+sprig(96,154,false)+'</span><span class="wi-o wi-o-b">'+sprig(88,142,true)+'</span>';
      case 'minimal': return '<i class="wi-ln" aria-hidden="true"></i>';
      case 'jardim': return wreath();
      case 'classico': return frame2();
      case 'mediterranico': return arch();
      case 'romantico': return corners();
      case 'couture': return gold();
      default: return bunting();
    }
  }
  /* ---------- cartão digital (vertical 360×540) ---------- */
  function vars(cfg){ var c=cfg.colors; return '--bg:'+c.bg+';--ink:'+c.ink+';--ac:'+c.ac+';--soft:'+c.soft+';--fm:\''+cfg.fontMain+'\','+(cfg.fontMain==='Manrope'||cfg.fontMain==='Helvetica'?'sans-serif':'serif')+';--fs:\''+cfg.fontSecond+'\','+(cfg.fontSecond==='Manrope'||cfg.fontSecond==='Helvetica'?'sans-serif':'serif')+';'; }
  function cardHTML(cfg){
    var S=STR[cfg.lang], n=splitNames(cfg), dd=dateDots(cfg), mono=monoOf(cfg);
    var names = n[1] ? '<span class="wi-n1">'+esc(n[0])+'</span><span class="wi-and">'+esc(S.and)+'</span><span class="wi-n2">'+esc(n[1])+'</span>' : '<span class="wi-n1">'+esc(n[0])+'</span>';
    return '<div class="wi-card wi-t-'+cfg.tpl+'" style="'+vars(cfg)+'">'+ornaments(cfg)+
      '<div class="wi-cc"><div class="wi-mono">'+esc(mono)+'</div><div class="wi-names">'+names+'</div>'+
      (dd?'<div class="wi-date">'+esc(dd)+'</div>':'')+(cfg.venue?'<div class="wi-venue">'+esc(cfg.venue)+'</div>':'')+
      (cfg.intro?'<div class="wi-intro">'+esc(cfg.intro)+'</div>':'')+'</div></div>';
  }
  var CSS = [
   '.wi-card{position:relative;width:360px;height:540px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--fs);box-sizing:border-box}',
   '.wi-card *{box-sizing:border-box}',
   '.wi-orn{position:absolute;display:block}',
   '.wi-cc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 40px;gap:14px}',
   '.wi-mono{font-family:var(--fm);font-size:30px;font-style:italic;color:var(--ac);letter-spacing:.02em}',
   '.wi-names{display:flex;flex-direction:column;align-items:center;gap:6px;font-family:var(--fm)}',
   '.wi-n1,.wi-n2{font-size:34px;letter-spacing:.22em;text-transform:uppercase;line-height:1.1;overflow-wrap:anywhere}',
   '.wi-and{font-size:20px;font-style:italic;color:var(--ac)}',
   '.wi-date{font-size:13px;letter-spacing:.34em;color:var(--ink);opacity:.85}',
   '.wi-venue{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}',
   '.wi-intro{font-size:12px;line-height:1.5;opacity:.75;max-width:240px}',
   /* editorial */
   '.wi-t-editorial .wi-o{position:absolute}.wi-t-editorial .wi-o .wi-orn{position:static}.wi-t-editorial .wi-o-a{top:-6px;right:-6px}.wi-t-editorial .wi-o-b{bottom:-6px;left:-6px}',
   /* minimal */
   '.wi-t-minimal .wi-cc{align-items:flex-start;text-align:left;justify-content:flex-end;padding:0 36px 60px}.wi-t-minimal .wi-mono{font-style:normal;font-family:var(--fs);font-size:14px;letter-spacing:.3em;position:absolute;top:40px;left:36px}.wi-t-minimal .wi-names{align-items:flex-start}.wi-t-minimal .wi-n1,.wi-t-minimal .wi-n2{font-size:30px;letter-spacing:.08em;font-weight:300}.wi-t-minimal .wi-and{font-size:14px}.wi-t-minimal .wi-ln{position:absolute;left:36px;right:36px;bottom:40px;height:1px;background:var(--ac);opacity:.6}',
   /* jardim */
   '.wi-t-jardim .wi-wreath{left:30px;top:120px;width:300px;height:300px}.wi-t-jardim .wi-cc{padding:150px 78px;gap:8px}.wi-t-jardim .wi-mono{font-size:22px}.wi-t-jardim .wi-n1,.wi-t-jardim .wi-n2{font-size:24px;letter-spacing:.16em}.wi-t-jardim .wi-venue,.wi-t-jardim .wi-intro{display:none}.wi-t-jardim .wi-date{letter-spacing:.14em;font-size:11px}',
   /* classico */
   '.wi-t-classico .wi-frame{inset:0;width:100%;height:100%}.wi-t-classico .wi-mono{width:70px;height:70px;border:1px solid var(--ac);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px}.wi-t-classico .wi-n1,.wi-t-classico .wi-n2{font-style:italic;text-transform:none;letter-spacing:.04em;font-size:38px;font-weight:500}.wi-t-classico .wi-date{letter-spacing:.2em;border-top:1px solid var(--ac);border-bottom:1px solid var(--ac);padding:8px 14px}',
   /* mediterranico */
   '.wi-t-mediterranico .wi-arch{left:50px;top:36px;width:260px;height:325px}.wi-t-mediterranico .wi-cc{justify-content:flex-end;padding:0 30px 34px}.wi-t-mediterranico .wi-mono{display:none}.wi-t-mediterranico .wi-n1,.wi-t-mediterranico .wi-n2{font-size:27px;letter-spacing:.18em}.wi-t-mediterranico .wi-intro{display:none}',
   /* romantico */
   '.wi-t-romantico .wi-cn{width:130px;height:130px}.wi-t-romantico .wi-cn1{top:0;left:0}.wi-t-romantico .wi-cn2{bottom:0;right:0;transform:rotate(180deg)}.wi-t-romantico .wi-n1,.wi-t-romantico .wi-n2{text-transform:none;font-style:italic;letter-spacing:.02em;font-size:44px;font-weight:400}.wi-t-romantico .wi-and{font-size:22px}.wi-t-romantico .wi-mono{font-size:22px}',
   /* couture */
   '.wi-t-couture .wi-gold{inset:0;width:100%;height:100%}.wi-t-couture .wi-mono{font-size:76px;font-style:normal;font-weight:300;letter-spacing:.04em;line-height:1}.wi-t-couture .wi-names{margin-top:8px}.wi-t-couture .wi-n1,.wi-t-couture .wi-n2{font-size:20px;letter-spacing:.42em;font-family:var(--fs);font-weight:300}.wi-t-couture .wi-and{font-size:14px}.wi-t-couture .wi-date{color:var(--ac);letter-spacing:.42em;margin-top:18px}',
   /* campestre */
   '.wi-t-campestre .wi-bunt{top:0;left:0;width:100%}.wi-t-campestre .wi-dots{position:absolute;inset:14px;border:2px dotted var(--ac);opacity:.55;border-radius:6px;pointer-events:none}.wi-t-campestre .wi-n1,.wi-t-campestre .wi-n2{font-family:var(--fs);font-weight:700;font-size:28px;letter-spacing:.1em}.wi-t-campestre .wi-and{font-family:var(--fm)}.wi-t-campestre .wi-cc{padding-top:80px}'
  ].join('');
  /* ---------- página interativa ---------- */
  var PAGE_CSS = [
   '*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--ink);font-family:var(--fs);-webkit-text-size-adjust:100%}',
   '.wp{max-width:560px;margin:0 auto;background:var(--bg);color:var(--ink);min-height:100vh}',
   '.wp-hero{position:relative;display:flex;justify-content:center;padding:28px 0 8px}',
   '.wp-hero .wi-card{transform-origin:top center}',
   '.wp-sec{padding:28px 28px;text-align:center;border-top:1px solid color-mix(in srgb,var(--ac) 25%,transparent)}',
   '.wp-sec h2{font-family:var(--fm);font-weight:500;font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--ac);margin:0 0 12px}',
   '.wp-big{font-family:var(--fm);font-size:26px;line-height:1.25;margin:0 0 4px}',
   '.wp-p{font-size:15px;line-height:1.7;margin:0;opacity:.88;white-space:pre-line;overflow-wrap:anywhere}',
   '.wp-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 28px;border-radius:999px;background:var(--ac);color:var(--bg);text-decoration:none;font-weight:600;font-size:15px;margin-top:16px;border:0}',
   '.wp-btn.ghost{background:transparent;color:var(--ac);border:1px solid var(--ac)}',
   '.wp-prog{list-style:none;margin:0;padding:0;text-align:left}.wp-prog li{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 12%,transparent);font-size:15px}.wp-prog b{min-width:56px;font-family:var(--fm);color:var(--ac);font-size:17px}',
   '.wp-foot{padding:26px;text-align:center;font-size:12px;opacity:.55;letter-spacing:.08em}',
   '.wp-note{font-size:13px;opacity:.75;margin:14px auto 0;max-width:340px;line-height:1.6}',
   '.wp-t-couture .wp-sec{border-top-color:var(--ac)}.wp-t-campestre .wp-sec{border-top-style:dotted}.wp-t-classico .wp-sec{border-top:3px double var(--ac)}.wp-t-minimal .wp-sec{text-align:left}',
   '@media(max-width:380px){.wp-hero .wi-card{zoom:.9}}@media(max-width:340px){.wp-hero .wi-card{zoom:.8}}@media(max-width:280px){.wp-hero .wi-card{zoom:.62}}'
  ].join('');
  function mapLink(cfg){ if(cfg.mapUrl) return cfg.mapUrl; var q=[cfg.venue,cfg.address].filter(Boolean).join(', '); return q ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q) : ''; }
  function page(cfg, opts){
    opts = opts || {}; var S=STR[cfg.lang], sc=cfg.sections, h='';
    var tok = /^[A-Za-z0-9_-]{8,80}$/.test(opts.token||'') ? opts.token : '';
    h += '<main class="wp wp-t-'+cfg.tpl+'" style="'+vars(cfg)+'"><div class="wp-hero">'+cardHTML(cfg)+'</div>';
    if(sc.message && (cfg.message || true)) h += '<section class="wp-sec" id="mensagem"><h2>'+esc(S.msgT)+'</h2><p class="wp-p">'+esc(cfg.message || S.defMsg)+'</p></section>';
    if(sc.datetime && (cfg.date||cfg.time)) h += '<section class="wp-sec" id="data"><h2>'+esc(S.whenT)+'</h2><p class="wp-big">'+esc(dateLong(cfg))+'</p>'+(cfg.time?'<p class="wp-p">'+esc(S.at+' '+cfg.time)+'</p>':'')+'</section>';
    if(sc.location && (cfg.venue||cfg.address)){
      h += '<section class="wp-sec" id="local"><h2>'+esc(S.whereT)+'</h2>'+(cfg.venue?'<p class="wp-big">'+esc(cfg.venue)+'</p>':'')+(cfg.address?'<p class="wp-p">'+esc(cfg.address)+'</p>':'');
      var ml = sc.map ? mapLink(cfg) : '';
      if(ml) h += '<a class="wp-btn ghost" href="'+esc(ml)+'" target="_blank" rel="noopener noreferrer">'+esc(S.mapBtn)+'</a>';
      h += '</section>';
    }
    if(sc.program && cfg.program.length) h += '<section class="wp-sec" id="programa"><h2>'+esc(S.progT)+'</h2><ul class="wp-prog">'+cfg.program.map(function(p){ return '<li><b>'+esc(p.t||'·')+'</b><span>'+esc(p.d)+'</span></li>'; }).join('')+'</ul></section>';
    if(sc.dress && cfg.dress) h += '<section class="wp-sec" id="dresscode"><h2>'+esc(S.dressT)+'</h2><p class="wp-p">'+esc(cfg.dress)+'</p></section>';
    h += '<section class="wp-sec" id="rsvp"><h2>'+esc(S.rsvpT)+'</h2>'+(tok ? '<a class="wp-btn" href="https://www.weddy.pt/rsvp.html?g='+esc(tok)+'">'+esc(S.rsvpBtn)+'</a>' : '<p class="wp-note">'+esc(S.rsvpNo)+'</p>')+'</section>';
    h += '<div class="wp-foot">'+esc(S.foot)+'</div></main>';
    var title = (cfg.names ? cfg.names+' · ' : '') + S.invite;
    return { html:h, css:CSS+PAGE_CSS, bodyStyle:vars(cfg), title:title, description: (cfg.names||'')+(cfg.date?' — '+dateLong(cfg):'') };
  }
  /* ---------- cartão em PNG (só no navegador) ---------- */
  function b64(buf){ var s='', b=new Uint8Array(buf); for(var i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(s); }
  function fontCss(base){
    var f = [['Cormorant Garamond','cormorant-garamond.woff','normal'],['Cormorant Garamond','cormorant-garamond-italic.woff','italic'],['Manrope','manrope.woff','normal']];
    return Promise.all(f.map(function(x){ return fetch(base+'fonts/'+x[1]).then(function(r){ return r.ok ? r.arrayBuffer() : null; }).catch(function(){ return null; }).then(function(b){ return b ? '@font-face{font-family:\''+x[0]+'\';font-style:'+x[2]+';font-weight:100 900;src:url(data:font/woff;base64,'+b64(b)+') format(\'woff\')}' : ''; }); })).then(function(a){ return a.join(''); });
  }
  function cardPng(cfg, scale, base){
    scale = scale || 3; base = base || '/';
    return fontCss(base).then(function(fc){
      var xml = '<svg xmlns="http://www.w3.org/2000/svg" width="'+(360*scale)+'" height="'+(540*scale)+'" viewBox="0 0 360 540"><foreignObject width="360" height="540"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+fc+CSS.replace(/&/g,'&amp;')+'</style>'+cardHTML(cfg).replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g,'&amp;')+'</div></foreignObject></svg>';
      return new Promise(function(res, rej){
        var img = new Image(); img.onload = function(){ var c=document.createElement('canvas'); c.width=360*scale; c.height=540*scale; var g=c.getContext('2d'); g.drawImage(img,0,0); c.toBlob(function(b){ b ? res(b) : rej(new Error('png')); }, 'image/png'); };
        img.onerror = function(){ rej(new Error('img')); };
        img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
      });
    });
  }
  root.WeddyInvite = { TEMPLATES:TEMPLATES, STYLES:STYLES, SECTIONS:SECTIONS, FONTS:FONTS, LIM:LIM, STR:STR, sanitize:sanitize, cardHTML:cardHTML, page:page, css:CSS, pageCss:PAGE_CSS, cardPng:cardPng, esc:esc, safeUrl:safeUrl, contrast:contrast, tpl:tplOf, mapLink:mapLink, dateLong:dateLong };
  if(typeof module!=='undefined' && module.exports) module.exports = root.WeddyInvite;
})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));
