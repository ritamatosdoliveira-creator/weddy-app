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
  var FONTS = ['Cormorant Garamond','Manrope','Georgia','Helvetica','Pinyon Script'];
  var LIM = { tips:300, kids:300, gifts:300, names:60, intro:200, message:300, venue:120, address:240, dress:300, mapUrl:300, prog:12, progT:12, progD:80, mono:8 };
  var SECTIONS = ['cover','message','datetime','location','map','program','dress','tips','kids','gifts'];
  function P(id,name,bg,ink,ac,soft){ return { id:id, name:name, bg:bg, ink:ink, ac:ac, soft:soft }; }
  var TEMPLATES = [
    { id:'colorido', lot:true, name:{pt:'Colorido Artístico',en:'Artistic Colour'}, desc:{pt:'Flores pintadas à mão, cor expressiva e composição assimétrica.',en:'Hand-painted flowers, expressive colour and asymmetry.'}, style:'premium', fonts:['Pinyon Script','Cormorant Garamond'], photo:false,
      palettes:[P('cobalto','Cobalto e manteiga','#FAF4E1','#1F2A52','#2D4BB0','#F4D77A'),P('coral','Coral e rosa','#FCF1EC','#4A2A2C','#E8604C','#F3B4C0'),P('verdeazul','Verde e azul','#F2F5EE','#1F3A36','#2F7F6F','#8DB9D6'),P('terracota','Terracota e lilás','#F8EFE9','#47302A','#C2552F','#C9B2E0')] },
    { id:'natural', lot:true, long:true, name:{pt:'Minimal Natural',en:'Natural Minimal'}, desc:{pt:'Página longa em verde azeitona: envelope, contagem, calendário e RSVP.',en:'Long olive-green page: envelope, countdown, calendar and RSVP.'}, style:'premium', fonts:['Pinyon Script','Cormorant Garamond'], photo:false,
      palettes:[P('azeitona','Azeitona','#F4EFE2','#2F3520','#5C6639','#E6E0CB'),P('salvia','Sálvia','#F3F2EA','#2B3328','#6F8460','#E0E4D2'),P('musgo','Musgo','#F5F1E6','#262E1F','#4A5A34','#E4DEC6')] },
    { id:'luxo', lot:true, name:{pt:'Papelaria de Luxo',en:'Luxury Stationery'}, desc:{pt:'Papel de algodão, relevo seco, monograma em foil e selo.',en:'Cotton paper, blind emboss, foil monogram and seal.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('marfim','Marfim e ouro','#F3ECE1','#3B332B','#9B7B3C','#E6DAC5'),P('prata','Prata','#F1EFEC','#2F3236','#7B8088','#E2E1DE'),P('champanhe','Champanhe','#F2E7DA','#3A2E25','#B08C5A','#E4D3BC')] },
    { id:'arquitetura', lot:true, name:{pt:'Arquitetura do Casamento',en:'Wedding Architecture'}, desc:{pt:'O local do casamento desenhado a traço fino.',en:'Your venue drawn in fine line.'}, style:'premium', fonts:['Pinyon Script','Cormorant Garamond'], photo:false,
      palettes:[P('papel','Papel','#F4EFE4','#3A3530','#8C7B5E','#E6DFCF'),P('salvia','Sálvia','#F1F2E8','#2E3428','#6F845E','#DFE3D2'),P('azul','Azul pó','#F1F3F3','#27323C','#5F7F95','#DDE4E8')] },
    { id:'romance', lot:true, name:{pt:'Romance Contemporâneo',en:'Contemporary Romance'}, desc:{pt:'Laço de seda, papel vegetal e monograma em diagonal.',en:'Silk bow, vellum and a slash monogram.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:false,
      palettes:[P('rosa','Rosa antigo','#F6E9E4','#5A3F3C','#C99A97','#EED8D2'),P('marfim','Marfim e vinho','#F7F1E8','#4A2A2F','#8E4A55','#EBDDD0'),P('castanho','Castanho','#F3EAE2','#4B3A33','#A47C6C','#E4D3C8')] },
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
      palettes:[P('kraft','Kraft','#EFE3D0','#3A2E22','#8A5A3B','#E1D0B5'),P('trigo','Trigo','#F5EBD5','#3B3220','#A57F2F','#E8D9B4'),P('campo','Campo','#EEF0E1','#2B3320','#6D7F3C','#DADFC0')] },
    { id:'w-verde', w:true, name:{pt:'Verde-oliva texturizado',en:'Textured Olive'}, desc:{pt:'Envelope de 4 abas em papel texturizado, selo de cera e cartão marfim.',en:'Four-flap textured envelope, wax seal and ivory card.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('oliva','Verde-oliva','#F1EEE6','#454D2E','#6A7747','#CDD0B6')] },
    { id:'w-romantico', w:true, name:{pt:'Romântico verde-oliva',en:'Olive Romantic'}, desc:{pt:'Fotografia com cartões de papel rasgado.',en:'Photo with torn-paper cards.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Romântico verde-oliva','#F4EEE4','#4B5232','#6A7047','#8A8F6C')] },
    { id:'w-editorial', w:true, name:{pt:'Editorial minimalista',en:'Minimal Editorial'}, desc:{pt:'Cartão de algodão com papel vegetal e pino.',en:'Cotton card under vellum with a pin.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Editorial minimalista','#EEEDE9','#171514','#171514','#7C7771')] },
    { id:'w-bordo', w:true, name:{pt:'Bordô com flores',en:'Burgundy Florals'}, desc:{pt:'Bolso com banda e aba geométrica.',en:'Pocket with band and geometric flap.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Bordô com flores','#F1ECE6','#3D1D25','#5B1F2C','#8C6B72')] },
    { id:'w-beige', w:true, name:{pt:'Editorial luxo bege',en:'Beige Luxe'}, desc:{pt:'Envelope taupe com aba em V e selo dourado.',en:'Taupe envelope, V-flap and gold seal.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Editorial luxo bege','#F3EEE7','#3A3028','#3A3028','#8C7C6C')] },
    { id:'w-monograma', w:true, name:{pt:'Monograma e brasão',en:'Monogram Crest'}, desc:{pt:'Portas duplas com brasão em relevo.',en:'Double doors with an embossed crest.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Monograma e brasão','#EEF0E2','#3A4026','#4D5A2F','#7C8564')] },
    { id:'w-destino', w:true, name:{pt:'Destino romântico',en:'Destination Romance'}, desc:{pt:'Cartão de renda sobre a fotografia do local.',en:'Lace card over the venue photo.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Destino romântico','#F7F0E4','#4A4636','#6D7550','#8A8570')] },
    { id:'w-relevo', w:true, name:{pt:'Relevo minimalista',en:'Minimal Emboss'}, desc:{pt:'Envelope com painel lateral e selo branco.',en:'Envelope with side panel and white seal.'}, style:'premium', fonts:['Cormorant Garamond','Manrope'], photo:true,
      palettes:[P('base','Relevo minimalista','#F3F1E2','#444630','#5D6140','#8C8D72')] }
  ];
  var STYLES = ['premium','classicos','minimalistas','romanticos','botanicos','contemporaneos'];
  var STR = {
    pt:{ months:['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], and:'e', save:'Guardem a data', msgT:'Uma mensagem', whenT:'Data e hora', whereT:'Local', mapBtn:'Ver no mapa', progT:'Programa', cerT:'Cerimónia', recT:'Receção', tipsT:'Recomendações aos convidados', kidsT:'Crianças', giftsT:'Presentes', countT:'Faltam', dd:'Dias', hh:'Horas', mm:'Min', ss:'Seg', wd:['S','T','Q','Q','S','S','D'], dressT:'Dress code', rsvpT:'Confirmar presença', rsvpBtn:'Confirmar presença', rsvpNo:'Para responderes, usa o link individual do teu convite, enviado pelos noivos.', at:'às', foot:'Feito com Weddy', defMsg:'Com muita alegria, convidamos-vos para celebrar connosco este dia tão especial.', invite:'Convite' },
    en:{ months:['January','February','March','April','May','June','July','August','September','October','November','December'], and:'and', save:'Save the date', msgT:'A message', whenT:'Date & time', whereT:'Venue', mapBtn:'View on map', progT:'Schedule', cerT:'Ceremony', recT:'Reception', tipsT:'Guest recommendations', kidsT:'Children', giftsT:'Gifts', countT:'Countdown', dd:'Days', hh:'Hours', mm:'Min', ss:'Sec', wd:['M','T','W','T','F','S','S'], dressT:'Dress code', rsvpT:'RSVP', rsvpBtn:'RSVP', rsvpNo:'To reply, use the individual link from your invitation, sent by the couple.', at:'at', foot:'Made with Weddy', defMsg:'With great joy, we invite you to celebrate this special day with us.', invite:'Invitation' }
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
      fontMain: fontOk(raw.fontMain) || tpl.fonts[0], fontSecond: (fontOk(raw.fontSecond)!=='Pinyon Script' && fontOk(raw.fontSecond)) || (tpl.fonts[1]==='Pinyon Script'?FONTS[1]:tpl.fonts[1]), deco: raw.deco !== false,
      program: [], tips:clip(raw.tips, LIM.tips).trim(), kids:clip(raw.kids, LIM.kids).trim(), gifts:clip(raw.gifts, LIM.gifts).trim(), sections:{}, opt:sanitizeOpt(tpl.id, raw.opt), cer:sanitizeEv(raw.cer), rec:sanitizeEv(raw.rec), lang: lang==='en'||raw.lang==='en' ? 'en' : 'pt', photos: sanitizePhotos(raw.photos), quote: clip(raw.quote, 200).trim(), song: sanitizeSong(raw.song), hash: sanitizeHash(raw.hash), giftUrl: safeUrl(clip(raw.giftUrl, 300)), story: clip(raw.story, 400).trim(), parents: clip(raw.parents, 200).trim(), hotel: clip(raw.hotel, 120).trim(), hotelUrl: safeUrl(clip(raw.hotelUrl, 300)) , org: clip(raw.org, 100).trim(), orgTel: clip(raw.orgTel, 20).replace(/[^0-9+ ]/g,'').trim(), flowers: clip(raw.flowers, 200).trim(), dcol: (Array.isArray(raw.dcol)?raw.dcol:String(raw.dcol||'').split(/[\s,;]+/)).slice(0,6).map(function(c){ return hex(c,''); }).filter(Boolean) };
    (Array.isArray(raw.program)?raw.program:[]).slice(0, LIM.prog).forEach(function(p){ if(!p||typeof p!=='object') return; var t=validTime(p.t), d=clip(p.d, LIM.progD).trim(); if(d) out.program.push({ t:t, d:d, x:clip(p.x, 140).trim() }); });
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
  /* ====================== Lote B — Colorido Artístico e Minimal Natural ====================== */
  function wcf(){ return '<filter id="wcf" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".024" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10"/></filter>'; }
  function petalP(x,y,len,w,rot,fill,op){ return '<path d="M0 0C'+(-w)+' '+(-len*0.35)+' '+(-w*0.8)+' '+(-len*0.85)+' 0 '+(-len)+'C'+(w*0.8)+' '+(-len*0.85)+' '+w+' '+(-len*0.35)+' 0 0Z" transform="translate('+x+' '+y+') rotate('+rot+')" style="fill:'+fill+'" opacity="'+op+'"/>'; }
  var C_MIX='color-mix(in srgb,var(--ac) 55%,var(--ink))', C_LEAF='color-mix(in srgb,var(--ink) 60%,var(--ac))', C_MID='color-mix(in srgb,var(--ac) 55%,var(--soft))';
  function paintFlower(x,y,s){ var h='',i; for(i=0;i<6;i++) h+=petalP(x,y,62*s,26*s,i*60+8,'var(--ac)',.88); for(i=0;i<6;i++) h+=petalP(x,y,40*s,17*s,i*60+38,C_MID,.85); for(i=0;i<5;i++) h+=petalP(x,y,20*s,8*s,i*72,'var(--soft)',.95); return h+'<circle cx="'+x+'" cy="'+y+'" r="'+(5*s)+'" style="fill:'+C_MIX+'"/>'; }
  function paintLeaf(x,y,len,rot,op){ return '<path d="M0 0C'+(len*0.3)+' '+(-len*0.28)+' '+(len*0.75)+' '+(-len*0.3)+' '+len+' 0C'+(len*0.7)+' '+(len*0.26)+' '+(len*0.3)+' '+(len*0.26)+' 0 0Z" transform="translate('+x+' '+y+') rotate('+rot+')" style="fill:'+C_LEAF+'" opacity="'+(op||.75)+'"/>'; }
  function paintArt(flip, crop){
    var g='<defs>'+wcf()+'</defs><g filter="url(#wcf)">';
    g+='<path d="M-30 -20H255C300 40 262 118 204 150C150 180 156 240 92 256C30 270 -30 236 -30 190Z" style="fill:var(--soft)" opacity=".85"/>';
    g+='<path d="M360 330C318 350 300 400 306 450C312 500 340 540 380 560H210C250 520 232 470 262 420C290 372 330 358 360 330Z" style="fill:var(--soft)" opacity=".7"/>';
    g+=paintLeaf(60,170,110,-50)+paintLeaf(110,200,96,-20)+paintLeaf(160,120,92,-85,.65)+paintLeaf(30,120,84,-100)+paintLeaf(212,18,80,60,.6);
    g+=paintFlower(96,104,1.45)+paintFlower(196,52,.92)+paintFlower(40,206,.8);
    g+=paintLeaf(330,470,92,200)+paintLeaf(300,520,84,235,.65)+paintFlower(318,492,1.05);
    g+='</g>';
    return '<svg class="wi-orn wi-paint" viewBox="'+(crop?'0 360 360 180':'0 0 360 540')+'" aria-hidden="true">'+(flip?'<g transform="translate(0 540) scale(1 -1)">'+g+'</g>':g)+'</svg>';
  }
  function envFlap(){ return '<svg class="wi-orn wi-flap" viewBox="0 0 360 400" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H360V318L180 392L0 318Z" style="fill:var(--ac)"/><path d="M0 318L180 392L360 318" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/><path d="M0 0H360V318L180 392L0 318Z" fill="url(#flg)"/><defs><linearGradient id="flg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs></svg>'; }
  function heartSvg(){ return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>'; }
  function calHTML(cfg){
    if(!cfg.date) return ''; var S=STR[cfg.lang], p=cfg.date.split('-').map(Number);
    var dow=(new Date(Date.UTC(p[0],p[1]-1,1)).getUTCDay()+6)%7, dim=new Date(Date.UTC(p[0],p[1],0)).getUTCDate(), c='', i;
    for(i=0;i<dow;i++) c+='<u></u>';
    for(i=1;i<=dim;i++) c+= i===p[2] ? '<b class="on">'+heartSvg()+'<em>'+i+'</em></b>' : '<span>'+i+'</span>';
    return '<div class="wp-cal"><div class="wp-cal-h"><span>'+esc(S.months[p[1]-1].toUpperCase())+'</span><b>'+p[2]+'</b><span>'+p[0]+'</span></div><div class="wp-cal-g">'+S.wd.map(function(w){ return '<i>'+esc(w)+'</i>'; }).join('')+c+'</div></div>';
  }
  function countHTML(cfg){
    if(!cfg.date) return ''; var S=STR[cfg.lang], iso=cfg.date+'T'+(cfg.time||'00:00')+':00', ms=new Date(iso).getTime()-Date.now();
    if(isNaN(ms) || ms<=0) return '';
    var v=[Math.floor(ms/864e5), Math.floor(ms%864e5/36e5), Math.floor(ms%36e5/6e4), Math.floor(ms%6e4/1e3)];
    return '<div class="wp-cd" data-wi-count="'+iso+'" role="timer">'+[S.dd,S.hh,S.mm,S.ss].map(function(l,i){ return '<div><b data-u="'+i+'">'+(i?('0'+v[i]).slice(-2):v[i])+'</b><small>'+esc(l)+'</small></div>'; }).join('<span>:</span>')+'</div>';
  }
  var LOTB_CSS = [
   '.wi-t-colorido .wi-paint{left:0;top:0;width:100%;height:100%}.wi-t-colorido .wi-mono{display:none}.wi-t-colorido .wi-cc{padding:262px 28px 70px;gap:8px}.wi-t-colorido.wi-c-base .wi-cc{justify-content:flex-start;padding:88px 28px 0}',
   '.wi-t-colorido .wi-names{gap:0}.wi-t-colorido .wi-n1,.wi-t-colorido .wi-n2{font-size:50px;font-weight:400;text-transform:none;letter-spacing:0;line-height:1.02;color:var(--ac)}.wi-t-colorido .wi-and{font-size:34px;color:var(--ink);font-family:var(--fs)}',
   '.wi-t-colorido .wi-date{margin-top:10px;font-size:12px;letter-spacing:.32em}.wi-t-colorido .wi-venue{font-size:11px}.wi-t-colorido .wi-intro{display:none}',
   '.wi-t-natural .wi-flap{left:0;top:0;width:100%;height:340px}.wi-t-natural .wi-mono{display:none}.wi-t-natural .wi-cc{justify-content:flex-start;padding:70px 24px 0;gap:6px}.wi-t-natural .wi-names{gap:2px;color:var(--bg)}',
   '.wi-t-natural .wi-n1,.wi-t-natural .wi-n2{font-size:48px;font-weight:400;text-transform:none;letter-spacing:0;line-height:1.05;color:var(--bg)}.wi-t-natural .wi-and{font-size:26px;color:var(--bg);opacity:.85;font-family:var(--fs);font-style:italic}',
   '.wi-nvd{position:absolute;left:0;right:0;top:384px;text-align:center}.wi-nvd em{display:block;font-family:var(--fm);font-style:italic;font-size:26px;color:var(--ac)}.wi-nvd small{display:block;margin-top:10px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;opacity:.7}',
   '.wi-t-natural .wi-venue,.wi-t-natural .wi-intro{display:none}.wi-t-natural .wi-cc .wi-date{display:block;margin-top:22px;font-size:14px;letter-spacing:.34em;color:var(--bg);opacity:.9}',
   '.wp-green{background:var(--ac);color:var(--bg);border-top:0}.wp-green h2{color:var(--bg);opacity:.85}.wp-cd{display:flex;justify-content:center;align-items:flex-start;gap:8px}.wp-cd div{text-align:center;min-width:54px}.wp-cd b{display:block;font-family:var(--fm);font-weight:400;font-size:38px;line-height:1.1}.wp-cd small{font-size:11px;letter-spacing:.12em;opacity:.8}.wp-cd>span{font-size:30px;line-height:1.2;opacity:.7}',
   '.wp-cal{margin-top:22px;border-top:1px solid color-mix(in srgb,var(--bg) 35%,transparent);padding-top:18px}.wp-cal-h{display:flex;justify-content:center;align-items:baseline;gap:14px;letter-spacing:.24em;font-size:13px}.wp-cal-h b{font-family:var(--fm);font-size:44px;font-weight:300;letter-spacing:0;font-style:italic}',
   '.wp-cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:6px 0;margin-top:14px;font-size:13px;text-align:center}.wp-cal-g i{font-style:normal;opacity:.65;font-size:11px;letter-spacing:.1em}.wp-cal-g span,.wp-cal-g b{display:flex;align-items:center;justify-content:center;height:30px;position:relative}.wp-cal-g .on svg{position:absolute;width:34px;height:34px;fill:none;stroke:var(--bg);stroke-width:1.4}.wp-cal-g .on em{font-style:normal;font-weight:700;position:relative;top:-1px}',
   '.wp-t-natural .wp-sec{border-top-color:color-mix(in srgb,var(--ac) 20%,transparent)}',
   '.wp-close .wi-paint{position:static;width:100%;height:150px}'
  ].join('');
  var OPTSB = {
    colorido:[{k:'comp',t:'sel',v:['topo','base'],d:'topo',l:{pt:'Composição',en:'Composition'},vl:{topo:{pt:'Flores no topo',en:'Flowers on top'},base:{pt:'Flores na base',en:'Flowers at the bottom'}}}],
    natural:[{k:'flap',t:'bool',d:true,l:{pt:'Capa com efeito de envelope',en:'Envelope cover'}},{k:'count',t:'bool',d:true,l:{pt:'Contagem decrescente e calendário',en:'Countdown and calendar'}}]
  };
  function lotCardB(cfg){
    var n=splitNames(cfg), S=STR[cfg.lang], o=cfg.opt||{}, dd=dateDot2(cfg);
    var names = n[1] ? '<span class="wi-n1">'+esc(n[0])+'</span><span class="wi-and">&amp;</span><span class="wi-n2">'+esc(n[1])+'</span>' : '<span class="wi-n1">'+esc(n[0])+'</span>';
    var dateH = dd ? '<div class="wi-date">'+esc(dd)+'</div>' : '';
    if(cfg.tpl==='colorido') return '<div class="wi-card wi-t-colorido'+(o.comp==='base'?' wi-c-base':'')+'" style="'+vars(cfg)+'">'+(cfg.deco?paintArt(o.comp==='base'):'')+'<div class="wi-cc"><div class="wi-names">'+names+'</div>'+dateH+(cfg.venue?'<div class="wi-venue">'+esc(cfg.venue)+'</div>':'')+'</div></div>';
    return '<div class="wi-card wi-t-natural" style="'+vars(cfg)+'">'+(o.flap!==false?envFlap():'<div class="wi-orn" style="left:0;right:0;top:0;height:330px;background:var(--ac)"></div>')+'<div class="wi-cc"><div class="wi-names">'+names+'</div>'+dateH+'</div><div class="wi-nvd"><em>'+esc(S.save)+'</em>'+(cfg.venue?'<small>'+esc(cfg.venue)+'</small>':'')+'</div></div>';
  }
  function extraSecs(cfg){ var S=STR[cfg.lang], sc=cfg.sections, h='';
    [['tips',S.tipsT,cfg.tips],['kids',S.kidsT,cfg.kids],['gifts',S.giftsT,cfg.gifts]].forEach(function(e){ if(sc[e[0]] && e[2]) h+='<section class="wp-sec" id="'+e[0]+'"><h2>'+esc(e[1])+'</h2><p class="wp-p">'+esc(e[2])+'</p>'+(e[0]==='gifts' && root.WeddyInviteW && root.WeddyInviteW.isW(cfg.tpl) ? root.WeddyInviteW.giftQr(cfg, esc, S) : '')+'</section>'; });
    return h; }
  function countBlock(cfg){ var o=cfg.opt||{}; if((cfg.tpl!=='natural' && !(root.WeddyInviteW && root.WeddyInviteW.isW(cfg.tpl))) || o.count===false || !cfg.sections.datetime) return ''; var S=STR[cfg.lang], c=countHTML(cfg), k=calHTML(cfg);
    return (c||k) ? '<section class="wp-sec wp-green" id="contagem">'+(c?'<h2>'+esc(S.countT)+'</h2>'+c:'')+k+'</section>' : ''; }
  /* ====================== Lote A — Coleção Premium (luxo, arquitetura, romance) ====================== */
  function dateDot2(cfg){ if(!cfg.date) return ''; var p=cfg.date.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; }
  function monoParts(cfg){ var m=monoOf(cfg).replace(/[^A-Za-zÀ-ÿ0-9]+/g,''); return m.length>=2 ? [m.charAt(0), m.charAt(m.length-1)] : [m||'·', '']; }
  function emboss(inner){ return '<g transform="translate(-1.3,-1.3)" fill="#fff" stroke="#fff" opacity=".95">'+inner+'</g><g transform="translate(1.5,1.7)" fill="#000" stroke="#000" opacity=".12">'+inner+'</g><g fill="var(--bg)" stroke="var(--bg)">'+inner+'</g>'; }
  function bloom(x,y,r){ var s=''; for(var i=0;i<6;i++) s+='<ellipse cx="'+x+'" cy="'+(y-r*0.58)+'" rx="'+(r*0.34)+'" ry="'+(r*0.6)+'" transform="rotate('+(i*60+8)+' '+x+' '+y+')" stroke-width=".4"/>'; return s+'<circle cx="'+x+'" cy="'+y+'" r="'+(r*0.2)+'" stroke-width=".4"/>'; }
  function relief(){
    var st='<path d="M-14 232 C30 190 70 120 96 44 C104 24 116 10 126 -4" fill="none" stroke-width="2.2"/><path d="M26 150 C52 140 70 120 78 96" fill="none" stroke-width="1.6"/><path d="M-6 120 C20 112 34 100 44 84" fill="none" stroke-width="1.6"/>';
    var lv=''; [[40,186,-50],[58,160,-40],[74,128,-30],[84,98,-20],[92,70,-12],[112,30,10],[16,168,-120],[44,132,-100],[62,108,-95],[84,60,30],[100,100,50],[56,88,60],[30,118,40]].forEach(function(a){ lv+=leaf(a[0],a[1],17,a[2]); });
    var fl=bloom(66,64,26)+bloom(112,26,17)+bloom(18,128,19)+bloom(96,128,14);
    return '<svg class="wi-orn wi-relief" viewBox="0 0 220 260" preserveAspectRatio="xMinYMin meet" aria-hidden="true">'+emboss(st+lv+fl)+'</svg>';
  }
  function seal(){ return '<svg class="wi-seal" viewBox="0 0 80 80" aria-hidden="true"><defs><radialGradient id="wxg" cx="38%" cy="34%" r="75%"><stop offset="0" stop-color="#f4e9d3"/><stop offset=".6" stop-color="#dcc79d"/><stop offset="1" stop-color="#b89c6a"/></radialGradient></defs><path d="M40 6c9 0 12 5 20 7 6 3 11 8 12 16 1 7 5 11 3 19-2 8-6 11-9 17-5 7-12 8-20 9-8 1-14-3-20-8-6-6-8-11-9-19-1-8 3-12 6-19 4-8 9-13 17-20z" fill="#000" opacity=".16" transform="translate(1.5,2.5)"/><path d="M40 4c9 0 12 5 20 7 6 3 11 8 12 16 1 7 5 11 3 19-2 8-6 11-9 17-5 7-12 8-20 9-8 1-14-3-20-8-6-6-8-11-9-19-1-8 3-12 6-19 4-8 9-13 17-20z" fill="url(#wxg)"/><circle cx="40" cy="40" r="22" fill="none" stroke="#b89c6a" stroke-width="1.4"/><circle cx="40" cy="40" r="22" fill="none" stroke="#fff" stroke-width=".6" opacity=".6" transform="translate(-.6,-.6)"/></svg>'; }
  function bow(){ return '<svg class="wi-orn wi-bow" viewBox="0 0 300 190" aria-hidden="true"><defs><linearGradient id="bwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--ac)" stop-opacity=".55"/><stop offset=".5" stop-color="var(--ac)" stop-opacity=".95"/><stop offset="1" stop-color="var(--ac)" stop-opacity=".7"/></linearGradient><linearGradient id="bwh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'+
    '<path d="M150 82C118 18 28 6 14 62c-10 44 70 58 136 20z" fill="url(#bwg)"/><path d="M150 82C182 18 272 6 286 62c10 44-70 58-136 20z" fill="url(#bwg)"/>'+
    '<path d="M150 82C112 38 52 30 30 58" fill="none" stroke="url(#bwh)" stroke-width="6" stroke-linecap="round"/><path d="M150 82C188 38 248 30 270 58" fill="none" stroke="url(#bwh)" stroke-width="6" stroke-linecap="round"/>'+
    '<path d="M150 82C100 54 52 50 36 66M150 82C200 54 248 50 264 66" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1.2"/>'+
    '<path d="M141 90C128 126 112 156 92 186l30-6 14 8c4-32 12-62 20-92z" fill="url(#bwg)"/><path d="M159 90c13 36 29 66 49 96l-30-6-14 8c-4-32-12-62-20-92z" fill="url(#bwg)"/>'+
    '<rect x="132" y="66" width="36" height="38" rx="14" fill="url(#bwg)"/><rect x="132" y="66" width="36" height="38" rx="14" fill="none" stroke="#fff" stroke-opacity=".35"/><path d="M138 72c8 6 16 6 24 0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/></svg>'; }
  function ribbonBand(){ return '<svg class="wi-ribbon" viewBox="0 0 360 40" preserveAspectRatio="none" aria-hidden="true"><rect y="8" width="360" height="24" fill="var(--soft)"/><rect y="8" width="360" height="24" fill="none" stroke="var(--ac)" stroke-opacity=".35"/><path d="M0 12H360M0 28H360" stroke="var(--ac)" stroke-opacity=".5" stroke-dasharray="3 3" fill="none"/></svg>'; }
  /* desenhos arquitetónicos a traço fino (genéricos: igreja, quinta, palácio) */
  function ln(d,w){ return '<path d="'+d+'" fill="none" stroke="var(--ink)" stroke-width="'+(w||.9)+'" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function wash(d,op,col){ return '<path d="'+d+'" fill="'+(col||'var(--ac)')+'" opacity="'+op+'" stroke="none"/>'; }
  function arcWin(x,y,w,h){ var r=w/2; return ln('M'+x+' '+(y+h)+'V'+(y+r)+'A'+r+' '+r+' 0 0 1 '+(x+w)+' '+(y+r)+'V'+(y+h)+'Z',.8)+ln('M'+(x+w/2)+' '+y+'V'+(y+h)+'M'+x+' '+(y+h*0.55)+'H'+(x+w),.5); }
  function sqWin(x,y,w,h){ return ln('M'+x+' '+y+'h'+w+'v'+h+'h'+(-w)+'Z',.8)+ln('M'+(x+w/2)+' '+y+'v'+h+'M'+x+' '+(y+h/2)+'h'+w,.45); }
  function hatch(x,y,w,n,dy){ var s=''; for(var i=0;i<n;i++) s+='M'+x+' '+(y+i*dy)+'h'+(w-i*1.5); return ln(s,.35); }
  function cypress(x,y,h){ var s=''; for(var i=0;i<9;i++){ var yy=y-h+ i*h/9, k=Math.sin(Math.PI*(i+0.6)/9.6)*11; s+='M'+(x-k)+' '+yy+'q'+k+' 4 '+(2*k)+' 0'; } return wash('M'+x+' '+(y-h)+'c14 24 14 '+(h-26)+' 0 '+h+'c-14 -26 -14 '+(-h+26)+' 0 '+(-h),.28,'var(--ac)')+ln(s,.4)+ln('M'+x+' '+(y-h)+'c14 24 14 '+(h-26)+' 0 '+h+'c-14 -26 -14 '+(-h+26)+' 0 '+(-h),.7); }
  function roundTree(x,y,r){ var s=''; for(var i=0;i<6;i++) s+='M'+(x-r+i*3)+' '+(y-r*0.6+i*4)+'q'+r*0.6+' -6 '+(r*1.3)+' 0'; return wash('M'+(x-r)+' '+y+'a'+r+' '+r+' 0 1 1 '+(2*r)+' 0z',.22,'var(--ac)')+ln('M'+(x-r)+' '+y+'a'+r+' '+r+' 0 1 1 '+(2*r)+' 0',.7)+ln(s,.35)+ln('M'+x+' '+y+'v14',.8); }
  function archDraw(kind, wsh){
    var g='', W=function(d,o,c){ return wsh ? wash(d,o,c) : ''; };
    if(kind==='church'){
      g+=W('M90 250V150L180 96L270 150V250Z',.1,'var(--soft)')+W('M270 250V92L291 40L312 92V250Z',.14)+W('M82 150L180 96L278 150Z',.22);
      g+=ln('M90 250V150M270 250V150M82 150L180 96L278 150')+ln('M96 146L180 102L264 146',.5)+ln('M270 250V92M312 250V92M266 92L291 40L316 92Z')+ln('M262 92h58',.9)+ln('M291 40v-12M285 33h12',.9);
      g+=arcWin(281,112,20,34)+arcWin(281,176,20,36)+arcWin(112,176,16,36)+arcWin(232,176,16,36);
      g+='<circle cx="180" cy="130" r="14" fill="none" stroke="var(--ink)" stroke-width=".8"/><circle cx="180" cy="130" r="3" fill="none" stroke="var(--ink)" stroke-width=".6"/>'+ln('M180 116v28M166 130h28M170 120l20 20M190 120l-20 20',.45);
      g+=ln('M170 96V68h20V96')+ln('M174 82a6 6 0 0 1 12 0v14h-12z',.7)+ln('M170 68L180 58L190 68',.8);
      g+=ln('M158 250V206a22 22 0 0 1 44 0V250',1)+ln('M164 250V208a16 16 0 0 1 32 0V250',.5)+ln('M180 192V250',.5);
      g+=hatch(92,196,16,8,6)+hatch(250,196,16,8,6)+hatch(92,160,70,3,5);
    } else if(kind==='palace'){
      g+=W('M120 250V112H240V250Z',.08,'var(--soft)')+W('M30 250V150H120V250ZM240 250V150H330V250Z',.12)+W('M114 112L180 76L246 112Z',.24);
      g+=ln('M120 250V112M240 250V112M114 112L180 76L246 112Z')+ln('M122 108L180 80L238 108',.5)+ln('M156 76a24 24 0 0 1 48 0')+ln('M172 56h16v-8h-16zM180 48V38',.8);
      for(var i=0;i<4;i++){ var cx=130+i*20; g+=ln('M'+cx+' 126V250M'+(cx+6)+' 126V250',.7); }
      g+=ln('M30 250V150H120M240 150H330V250')+ln('M30 142H120M240 142H330',.7)+'<g>'+(function(){ var b=''; for(var k=0;k<8;k++){ b+='M'+(34+k*11)+' 142v-8'; b+='M'+(244+k*11)+' 142v-8'; } return ln(b,.7); })()+'</g>';
      [[42,162],[78,162],[256,162],[292,162]].forEach(function(p){ g+=sqWin(p[0],p[1],20,26); }); [[42,206],[78,206],[256,206],[292,206]].forEach(function(p){ g+=arcWin(p[0],p[1],20,34); });
      g+=ln('M166 250V212a14 14 0 0 1 28 0V250')+ln('M150 250h60v6h-60z',.7);
    } else {
      g+=W('M60 250V120H300V250Z',.08,'var(--soft)')+W('M52 120L180 74L308 120Z',.26);
      g+=ln('M60 250V120M300 250V120M52 120L180 74L308 120Z')+ln('M64 116L180 80L296 116',.5)+ln('M150 120L180 96L210 120',.8)+ln('M95 92v-24h8v34M265 92v-24h-8v34',.8);
      [[76,134],[106,134],[168,134],[230,134],[260,134]].forEach(function(p){ g+=sqWin(p[0],p[1],22,30); }); [[76,190],[106,190],[230,190],[260,190]].forEach(function(p){ g+=sqWin(p[0],p[1],22,36); });
      g+=ln('M164 250V212a16 16 0 0 1 32 0V250')+ln('M170 250V214a10 10 0 0 1 20 0V250',.5)+ln('M158 202L180 186L202 202',.8)+ln('M150 250h60v5h-60zM144 255h72v5h-72z',.7);
      g+=hatch(62,124,236,3,4);
    }
    g+=ln('M8 250H352',1)+ln('M20 254H340',.4);
    if(kind!=='church'){ g+=cypress(32,250,110)+cypress(328,250,104); } else { g+=roundTree(40,230,24)+roundTree(330,236,22); }
    g+=roundTree(kind==='manor'?14:346,236,16);
    return '<svg class="wi-orn wi-draw" viewBox="0 0 360 270" aria-hidden="true">'+g+'</svg>';
  }
  var LOTA_CSS = [
   '.wi-t-luxo{--foil:linear-gradient(135deg,#8a6a2e,#e8cf8f 42%,#a8802f 68%,#f1dca5)}.wi-t-luxo.wi-f-silver{--foil:linear-gradient(135deg,#565a61,#c4c8ce 42%,#70747c 68%,#d9dce0)}.wi-t-luxo.wi-f-none{--foil:linear-gradient(var(--ink),var(--ink))}',
   '.wi-t-luxo{background-image:url("data:image/svg+xml;utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix values=\'0 0 0 0 .45 0 0 0 0 .4 0 0 0 0 .32 0 0 0 .09 0\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}',
   '.wi-relief{left:0;top:0;width:290px;height:343px}',
   '.wi-t-luxo .wi-cc{padding:210px 30px 96px;gap:14px}.wi-t-luxo .wi-mono{display:none}',
   '.wi-lxm{display:flex;align-items:center;gap:20px;font-family:var(--fm);font-size:66px;font-weight:300;line-height:1;letter-spacing:.04em}.wi-lxm span,.wi-lxm b{background:var(--foil);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:300}.wi-lxm i{width:1px;height:62px;background:var(--ac)}',
   '.wi-t-luxo .wi-n1,.wi-t-luxo .wi-n2{font-size:21px;letter-spacing:.3em}.wi-t-luxo .wi-names{flex-direction:row;gap:10px;flex-wrap:wrap;justify-content:center}.wi-t-luxo .wi-and{font-size:16px}.wi-t-luxo .wi-date{margin-top:10px;font-size:12px;letter-spacing:.3em}.wi-t-luxo .wi-venue,.wi-t-luxo .wi-intro{display:none}',
   '.wi-seal{position:absolute;left:50%;bottom:26px;width:62px;height:62px;transform:translateX(-50%)}.wi-seal-m{position:absolute;left:50%;bottom:26px;width:62px;height:62px;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:15px;letter-spacing:.06em;color:#9a8157;text-shadow:0 1px 0 rgba(255,255,255,.6),0 -1px 0 rgba(0,0,0,.18)}.wi-t-luxo .wi-ribbon{position:absolute;left:0;bottom:37px;width:100%;height:40px}',
   '.wi-t-arquitetura{background-image:radial-gradient(ellipse at 50% 30%,rgba(255,255,255,.5),transparent 70%)}.wi-t-arquitetura .wi-draw{left:0;top:26px;width:100%;height:270px}.wi-t-arquitetura .wi-cc{justify-content:flex-end;padding:0 32px 40px;gap:6px}.wi-t-arquitetura .wi-mono{display:none}.wi-t-arquitetura .wi-names{gap:0}.wi-t-arquitetura .wi-n1,.wi-t-arquitetura .wi-n2{text-transform:none;letter-spacing:.01em;font-size:44px;font-weight:400;line-height:1.02}.wi-t-arquitetura .wi-and{font-size:20px;line-height:1.1}.wi-t-arquitetura .wi-date{margin-top:12px;letter-spacing:.3em;font-size:12px}.wi-t-arquitetura .wi-venue{font-size:11px}.wi-t-arquitetura .wi-intro{display:none}',
   '.wi-t-romance .wi-bow{left:30px;top:-6px;width:300px;height:190px}.wi-t-romance .wi-cc{padding:200px 30px 60px;gap:14px}.wi-t-romance .wi-mono{display:none}',
   '.wi-rmm{display:flex;align-items:center;justify-content:center;gap:2px;font-family:var(--fm);font-weight:300;font-size:80px;line-height:1;color:var(--ac);letter-spacing:.02em}.wi-rmm em{font-style:normal;font-size:90px;font-weight:200;transform:skewX(-14deg) scaleY(1.25);display:inline-block;margin:0 -2px;opacity:.8}',
   '.wi-t-romance .wi-names{flex-direction:row;gap:8px}.wi-t-romance .wi-n1,.wi-t-romance .wi-n2{font-size:14px;letter-spacing:.2em;font-family:var(--fs)}.wi-t-romance .wi-and{font-size:14px;font-family:var(--fm)}.wi-t-romance .wi-date{margin-top:8px;font-size:11px;letter-spacing:.34em}.wi-t-romance .wi-venue,.wi-t-romance .wi-intro{display:none}',
   '.wi-vel{position:absolute;left:22px;right:22px;top:200px;bottom:60px;background:rgba(255,255,255,.34);border:1px solid color-mix(in srgb,var(--ac) 30%,transparent);border-radius:3px}.wi-t-romance.wi-novel .wi-vel{display:none}',
   '.wi-ptf{display:flex;gap:0;flex-direction:column;align-items:center}',
   '.wp-ev{display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 0}.wp-ev svg{width:30px;height:30px;stroke:var(--ac);fill:none;stroke-width:1.2}.wp-ev h3{font:600 11px var(--fs);letter-spacing:.3em;text-transform:uppercase;color:var(--ac);margin:6px 0 0}.wp-ev b{font-family:var(--fm);font-size:20px;font-weight:500}.wp-ev span{font-size:14px;opacity:.85}.wp-ev hr{width:90px;border:0;border-top:1px solid color-mix(in srgb,var(--ac) 30%,transparent);margin:10px 0 0}',
   '.wp-close{position:relative;height:190px;overflow:hidden}.wp-close .wi-draw{position:static;width:100%;height:190px}.wp-close .wi-seal{bottom:auto;top:56px}.wp-close .wi-ribbon{position:absolute;left:0;width:100%;top:67px;height:40px}.wp-close .wi-bow{position:absolute;left:50%;transform:translateX(-50%);width:240px;top:0}',
   '.wp-t-luxo,.wp-t-arquitetura,.wp-t-romance{background:var(--bg)}.wp.wp-script h2,.wp.wp-script .wp-prog b,.wp.wp-script .wp-ev b,.wp.wp-script .wp-ev h3,.wp.wp-script .wp-big{font-family:var(--fs)}.wp.wp-script .wp-big{font-size:22px}.wp.wp-script .wp-ev b{font-size:18px}'
  ].join('');
  function eventIcon(k){ return k==='cer' ? '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3v5M13.5 5.5h5M8 29V15l8-5.5 8 5.5v14zM13 29v-7a3 3 0 0 1 6 0v7M3 29h26"/></svg>' : '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 4h8l-1 8a3.5 3.5 0 0 1-6 0zM13 15v11M9 28h8M19 4l8 2-2 7a3.5 3.5 0 0 1-6-2zM23 15l-1 11M20 28h8"/></svg>'; }
  function lotCard(cfg){
    if(cfg.tpl==='colorido' || cfg.tpl==='natural') return lotCardB(cfg);
    var n=splitNames(cfg), S=STR[cfg.lang], o=cfg.opt||{}, cls='wi-card wi-t-'+cfg.tpl, dd=dateDot2(cfg), mp=monoParts(cfg);
    var names = n[1] ? '<span class="wi-n1">'+esc(n[0])+'</span><span class="wi-and">'+'&amp;'+'</span><span class="wi-n2">'+esc(n[1])+'</span>' : '<span class="wi-n1">'+esc(n[0])+'</span>';
    var dateH = dd ? '<div class="wi-date">'+esc(dd)+'</div>' : '';
    if(cfg.tpl==='luxo'){
      cls += ' wi-f-'+(o.finish||'gold');
      return '<div class="'+cls+'" style="'+vars(cfg)+'">'+(o.relief!==false&&cfg.deco?relief():'')+'<div class="wi-cc"><div class="wi-lxm"><span>'+esc(mp[0])+'</span>'+(mp[1]?'<i></i><span>'+esc(mp[1])+'</span>':'')+'</div><div class="wi-names">'+names+'</div>'+dateH+'</div>'+(o.seal!==false?ribbonBand()+seal()+'<div class="wi-seal-m">'+esc(mp[0]+(mp[1]?mp[1]:''))+'</div>':'')+'</div>';
    }
    if(cfg.tpl==='arquitetura'){
      return '<div class="'+cls+'" style="'+vars(cfg)+'">'+archDraw(o.kind||'manor', o.wash!==false)+'<div class="wi-cc"><div class="wi-names">'+names+'</div>'+dateH+(cfg.venue?'<div class="wi-venue">'+esc(cfg.venue)+'</div>':'')+'</div></div>';
    }
    if(o.vellum===false) cls += ' wi-novel';
    return '<div class="'+cls+'" style="'+vars(cfg)+'">'+(o.bow!==false&&cfg.deco?bow():'')+'<div class="wi-vel"></div><div class="wi-cc"><div class="wi-rmm"><span>'+esc(mp[0])+'</span>'+(mp[1]?'<em>/</em><span>'+esc(mp[1])+'</span>':'')+'</div><div class="wi-names">'+names+'</div>'+dateH+'</div></div>';
  }
  function lotClosing(cfg){ var o=cfg.opt||{};
    if(cfg.tpl==='luxo'){ var mp=monoParts(cfg); return '<div class="wp-close" aria-hidden="true">'+ribbonBand()+seal()+'<div class="wi-seal-m" style="top:56px;bottom:auto">'+esc(mp[0]+mp[1])+'</div></div>'; }
    if(cfg.tpl==='arquitetura') return '<div class="wp-close" aria-hidden="true">'+archDraw(o.kind||'manor', o.wash!==false)+'</div>';
    if(cfg.tpl==='colorido' && cfg.deco) return '<div class="wp-close" style="height:150px" aria-hidden="true">'+paintArt(false,true)+'</div>';
    if(cfg.tpl==='romance' && o.bow!==false) return '<div class="wp-close" style="height:150px" aria-hidden="true">'+bow()+'</div>';
    return ''; }
  function eventBlocks(cfg){ var S=STR[cfg.lang], h='';
    [['cer',S.cerT,cfg.cer],['rec',S.recT,cfg.rec]].forEach(function(e){ var v=e[2]; if(v && (v.t||v.p)) h+='<div class="wp-ev">'+eventIcon(e[0])+'<h3>'+esc(e[1])+'</h3>'+(v.t?'<b>'+esc(v.t)+'</b>':'')+(v.p?'<span>'+esc(v.p)+'</span>':'')+'<hr></div>'; });
    return h; }
  var OPTS = {
    colorido:null, natural:null,
    luxo:[{k:'finish',t:'sel',v:['gold','silver','none'],d:'gold',l:{pt:'Acabamento do monograma',en:'Monogram finish'},vl:{gold:{pt:'Dourado',en:'Gold'},silver:{pt:'Prateado',en:'Silver'},none:{pt:'Tinta simples',en:'Plain ink'}}},{k:'relief',t:'bool',d:true,l:{pt:'Relevo floral',en:'Floral relief'}},{k:'seal',t:'bool',d:true,l:{pt:'Selo e fita',en:'Seal and ribbon'}}],
    arquitetura:[{k:'kind',t:'sel',v:['manor','church','palace'],d:'manor',l:{pt:'Tipo de edifício',en:'Building type'},vl:{manor:{pt:'Quinta / casa',en:'Manor / house'},church:{pt:'Igreja / capela',en:'Church / chapel'},palace:{pt:'Palácio',en:'Palace'}}},{k:'wash',t:'bool',d:true,l:{pt:'Aguarela suave sobre o desenho',en:'Soft watercolour wash'}}],
    romance:[{k:'bow',t:'bool',d:true,l:{pt:'Laço de seda',en:'Silk bow'}},{k:'vellum',t:'bool',d:true,l:{pt:'Papel vegetal',en:'Vellum overlay'}}]
  };
  OPTS.colorido = OPTSB.colorido; OPTS.natural = OPTSB.natural;
  function sanitizeOpt(tplId, raw){ var out={}, defs=OPTS[tplId]||[]; raw = raw && typeof raw==='object' ? raw : {};
    defs.forEach(function(d){ var v=raw[d.k]; if(d.t==='bool') out[d.k] = (v===false||v===0) ? false : (v===true||v===1 ? true : d.d); else out[d.k] = d.v.indexOf(v)>=0 ? v : d.d; });
    return out; }
  /* Fotografias dos modelos «w-*»: só URLs https (Firebase Storage/Weddy). Vazio = fotografia demonstrativa. */
  function sanitizePhotos(raw){ raw = raw && typeof raw==='object' ? raw : {}; var g = Array.isArray(raw.gallery) ? raw.gallery.slice(0,6).map(function(u){ return safeUrl(clip(u, 400)); }) : [];
    return { cover: safeUrl(clip(raw.cover, 400)), gallery: g }; }
  /* Campos opcionais dos modelos «w-*» (citação, canção, hashtag, ligação de presentes com QR). */
  function sanitizeSong(raw){ raw = raw && typeof raw==='object' ? raw : {}; return { t:clip(raw.t, 80).trim(), a:clip(raw.a, 80).trim(), u:safeUrl(clip(raw.u, 300)) }; }
  function sanitizeHash(h){ h = clip(h, 40).replace(/[^\p{L}\p{N}_]/gu,''); return h ? '#'+h : ''; }
  function wCardFoot(cfg, esc){
    var dark = /w-(romantico|bordo|destino|relevo)$/.test(cfg.tpl), col = dark ? '#fff' : 'var(--ink)';
    var where = /w-(editorial|beige)$/.test(cfg.tpl) ? '' : [cfg.venue, cfg.address].filter(Boolean).join(' · '), at = cfg.time ? (cfg.lang==='en' ? 'at ' : 'às ')+cfg.time : '';
    var frame = '<div style="position:absolute;inset:12px;border:1px solid '+col+';opacity:'+(dark?'.4':'.28')+';pointer-events:none;z-index:5"></div>';
    var txt = (where||at) ? '<div style="position:absolute;left:24px;right:24px;bottom:30px;z-index:6;text-align:center;color:'+col+';font:500 9px/1.7 \'W Jost\',sans-serif;letter-spacing:.22em;text-transform:uppercase;'+(dark?'text-shadow:0 1px 6px rgba(0,0,0,.55)':'')+';flex:none">'+(where?'<div>'+esc(where)+'</div>':'')+(at?'<div>'+esc(at)+'</div>':'')+'</div>' : '';
    return frame+txt;
  }
  function wParts(cfg){ var S=STR[cfg.lang], n=splitNames(cfg), mp=monoParts(cfg); return { names:n, mono: mp[1] ? mp[0]+'·'+mp[1] : mp[0], date:dateDots(cfg), intro: cfg.intro || (cfg.lang==='en' ? 'The wedding of' : 'O casamento de'), openLabel: cfg.lang==='en' ? 'Tap to open' : 'Toque para abrir' }; }
  function sanitizeEv(raw){ raw = raw && typeof raw==='object' ? raw : {}; return { t:validTime(raw.t), p:clip(raw.p, 80).trim(), a:clip(raw.a, 120).trim() }; }
  /* ---------- cartão digital (vertical 360×540) ---------- */
  function vars(cfg){ var c=cfg.colors; return '--bg:'+c.bg+';--ink:'+c.ink+';--ac:'+c.ac+';--soft:'+c.soft+';--fm:\''+cfg.fontMain+'\','+(cfg.fontMain==='Manrope'||cfg.fontMain==='Helvetica'?'sans-serif':(cfg.fontMain==='Pinyon Script'?'cursive':'serif'))+';--fs:\''+cfg.fontSecond+'\','+(cfg.fontSecond==='Manrope'||cfg.fontSecond==='Helvetica'?'sans-serif':(cfg.fontSecond==='Pinyon Script'?'cursive':'serif'))+';'; }
  function cardHTML(cfg){
    var W = root.WeddyInviteW; if(W && W.isW(cfg.tpl)) return '<style>'+W.baseCss+W.pageCss(cfg.tpl)+'</style><div class="wv-card wv-'+cfg.tpl.slice(2)+'" style="'+vars(cfg)+'">'+W.models[cfg.tpl].card(cfg,false,esc,wParts(cfg))+wCardFoot(cfg,esc)+'</div>';
    if(tplOf(cfg.tpl).lot) return lotCard(cfg);
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
  ].join('')+LOTA_CSS+LOTB_CSS+(root.WeddyInviteW ? root.WeddyInviteW.baseCss : '');
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
    opts = opts || {}; var S=STR[cfg.lang], sc=cfg.sections, h=''; var W = root.WeddyInviteW, isw = !!(W && W.isW(cfg.tpl));
    var tok = /^[A-Za-z0-9_-]{8,80}$/.test(opts.token||'') ? opts.token : '';
    h += '<main class="wp wp-t-'+cfg.tpl+(cfg.fontMain==='Pinyon Script'?' wp-script':'')+'" style="'+vars(cfg)+'"><div class="wp-hero">'+(isw ? '<!--WV-HERO-->' : cardHTML(cfg))+'</div>';
    if(sc.message && (cfg.message || true)) h += '<section class="wp-sec" id="mensagem"><h2>'+esc(S.msgT)+'</h2><p class="wp-p">'+esc(cfg.message || S.defMsg)+'</p></section>'; if(isw) h += '<!--WV-PH0-->';
    if(sc.datetime && (cfg.date||cfg.time)) h += '<section class="wp-sec" id="data"><h2>'+esc(S.whenT)+'</h2><p class="wp-big">'+esc(dateLong(cfg))+'</p>'+(cfg.time?'<p class="wp-p">'+esc(S.at+' '+cfg.time)+'</p>':'')+eventBlocks(cfg)+'</section>'+countBlock(cfg);
    if(sc.location && (cfg.venue||cfg.address)){
      h += '<section class="wp-sec" id="local"><h2>'+esc(S.whereT)+'</h2>'+(cfg.venue?'<p class="wp-big">'+esc(cfg.venue)+'</p>':'')+(cfg.address?'<p class="wp-p">'+esc(cfg.address)+'</p>':'');
      var ml = sc.map ? mapLink(cfg) : '';
      if(ml) h += '<a class="wp-btn ghost" href="'+esc(ml)+'" target="_blank" rel="noopener noreferrer">'+esc(S.mapBtn)+'</a>';
      h += '</section>';
    }
    if(sc.program && cfg.program.length) h += '<section class="wp-sec" id="programa"><h2>'+esc(S.progT)+'</h2><ul class="wp-prog">'+cfg.program.map(function(p){ return '<li><b>'+esc(p.t||'·')+'</b><span>'+esc(p.d)+'</span></li>'; }).join('')+'</ul></section>';
    if(sc.dress && cfg.dress) h += '<section class="wp-sec" id="dresscode"><h2>'+esc(S.dressT)+'</h2><p class="wp-p">'+esc(cfg.dress)+'</p></section>'; if(isw) h += '<!--WV-PH1-->';
    h += extraSecs(cfg);
    h += lotClosing(cfg);
    h += '<section class="wp-sec" id="rsvp"><h2>'+esc(S.rsvpT)+'</h2>'+(tok ? '<a class="wp-btn" href="https://www.weddy.pt/rsvp.html?g='+esc(tok)+'">'+esc(S.rsvpBtn)+'</a>' : '<p class="wp-note">'+esc(S.rsvpNo)+'</p>')+'</section>';
    if(isw) h += '<!--WV-HASH-->';
    h += '<div class="wp-foot">'+esc(S.foot)+'</div></main>';
    if(isw && (W.models[cfg.tpl].interior || W.models[cfg.tpl].secs)){
      h = '<main class="wp wp-t-'+cfg.tpl+'" style="'+vars(cfg)+'"><div class="wp-hero"><!--WV-HERO--></div>'+(W.models[cfg.tpl].interior ? W.models[cfg.tpl].interior(cfg, esc, { S:S, sc:sc, tok:tok, dots:dateDots(cfg), dl:dateLong(cfg), mono:monoParts(cfg) }) : W.genInterior(cfg, esc, { S:S, sc:sc, tok:tok, dots:dateDots(cfg), dl:dateLong(cfg), mono:monoParts(cfg) }, W.models[cfg.tpl]))+'</main>';
    }
    if(isw){ h = W.wrap(cfg.tpl, cfg, h, wParts(cfg), esc); }
    var title = (cfg.names ? cfg.names+' · ' : '') + S.invite;
    return { html:h, css:CSS+PAGE_CSS+(isw ? W.pageCss(cfg.tpl) : ''), bodyStyle:vars(cfg), title:title, description: (cfg.names||'')+(cfg.date?' — '+dateLong(cfg):'') };
  }
  /* ---------- cartão em PNG (só no navegador) ---------- */
  function b64(buf){ var s='', b=new Uint8Array(buf); for(var i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(s); }
  function fontCss(base){
    var f = [['Cormorant Garamond','cormorant-garamond.woff','normal'],['Cormorant Garamond','cormorant-garamond-italic.woff','italic'],['Manrope','manrope.woff','normal'],['Pinyon Script','pinyon-script.woff','normal']];
    return Promise.all(f.map(function(x){ return fetch(base+'fonts/'+x[1]).then(function(r){ return r.ok ? r.arrayBuffer() : null; }).catch(function(){ return null; }).then(function(b){ return b ? '@font-face{font-family:\''+x[0]+'\';font-style:'+x[2]+';font-weight:100 900;src:url(data:font/woff;base64,'+b64(b)+') format(\'woff\')}' : ''; }); })).then(function(a){ return a.join(''); });
  }
  function cardPng(cfg, scale, base){
    scale = scale || 3; base = base || '/';
    return fontCss(base).then(function(fc){
      var xml = '<svg xmlns="http://www.w3.org/2000/svg" width="'+(360*scale)+'" height="'+(540*scale)+'" viewBox="0 0 360 540"><foreignObject width="360" height="540"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+fc+CSS.replace(/&/g,'&amp;')+'</style>'+cardHTML(cfg).replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g,'&amp;').replace(/<svg /g,'<svg xmlns="http://www.w3.org/2000/svg" ')+'</div></foreignObject></svg>';
      return new Promise(function(res, rej){
        var img = new Image(); img.onload = function(){ var c=document.createElement('canvas'); c.width=360*scale; c.height=540*scale; var g=c.getContext('2d'); g.drawImage(img,0,0); c.toBlob(function(b){ b ? res(b) : rej(new Error('png')); }, 'image/png'); };
        img.onerror = function(){ rej(new Error('img')); };
        img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
      });
    });
  }
  root.WeddyInvite = { OPTS:OPTS, TEMPLATES:TEMPLATES, STYLES:STYLES, SECTIONS:SECTIONS, FONTS:FONTS, LIM:LIM, STR:STR, sanitize:sanitize, cardHTML:cardHTML, page:page, css:CSS, pageCss:PAGE_CSS, cardPng:cardPng, esc:esc, safeUrl:safeUrl, contrast:contrast, tpl:tplOf, mapLink:mapLink, dateLong:dateLong };
  if(typeof module!=='undefined' && module.exports) module.exports = root.WeddyInvite;
})(typeof window!=='undefined' ? window : (typeof globalThis!=='undefined' ? globalThis : this));
