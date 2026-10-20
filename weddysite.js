/* ============================================================================
   Weddy — Site do casamento: renderizador partilhado
   ----------------------------------------------------------------------------
   Usado em DOIS sítios, para que a pré-visualização seja exatamente o que os
   convidados vão ver:
     - site.html   (página pública, lê publicWeddingSites/{slug})
     - index.html  (pré-visualização no editor, numa <iframe srcdoc>)

   REGRAS:
   - Só recebe um "snapshot" já filtrado (nomes, data, secções públicas). Nunca
     recebe nem mostra convidados, orçamento, pagamentos, contratos ou tokens.
   - NUNCA injeta HTML/CSS/JS escrito por utilizadores: todo o texto passa por
     escape() e todo o URL por safeUrl() (só https).
   - RSVP: o botão só leva a rsvp.html com o token INDIVIDUAL do convidado
     (?g=TOKEN, recebido no link que o casal lhe enviou, ou colado por ele).
     Nunca há pesquisa de convidados nem token genérico.
   ========================================================================== */
(function(root){
  'use strict';

  var DEFAULT_TZ = 'Europe/Lisbon';
  var TIMEZONES = ['Europe/Lisbon','Atlantic/Azores','Atlantic/Madeira','Europe/London','Europe/Madrid','Europe/Paris'];
  var TEMPLATES = ['editorial','classic','modern'];
  // Cores verificadas para contraste WCAG AA: "dark" (texto/botões) ≥ 4.5:1 sobre
  // o fundo e sobre "soft"; texto branco sobre "dark" ≥ 4.5:1.
  var PALETTES = {
    terracota:{ accent:'#B96752', dark:'#9A4F3D', soft:'#F3E3DC', name:{ pt:'Terracota', en:'Terracotta' } },
    salvia:{ accent:'#6F7F61', dark:'#4E6343', soft:'#E8EDE2', name:{ pt:'Sálvia', en:'Sage' } },
    rosa:{ accent:'#B27078', dark:'#8F4F58', soft:'#F6E6E4', name:{ pt:'Rosa', en:'Blush' } },
    noite:{ accent:'#4F5F7A', dark:'#38465E', soft:'#E4E8EF', name:{ pt:'Azul-noite', en:'Midnight' } }
  };
  var RESERVED_SLUGS = ['admin','api','app','login','logout','premium','rsvp','site','c','assets','static','weddy','www','memorias','suporte','privacidade','termos','index','404','sw','manifest','icon','login-bg','functions','settings','definicoes','help','ajuda','about','sobre','test','teste'];

  var S = {
    pt:{
      dayWord:function(n){ return n===1?'dia':'dias'; }, until:'para o grande dia',
      today:'Hoje é o grande dia!', tomorrow:'É já amanhã!',
      nav:{ story:'A nossa história', location:'Local', schedule:'Programa', dresscode:'Dress code', lodging:'Alojamento', faq:'Perguntas', contact:'Contacto', rsvp:'Confirmar presença' },
      navTitle:{ lodging:'Alojamento e transportes', faq:'Perguntas frequentes' },
      rsvpBtn:'Confirmar presença', rsvpOpenWithLink:'Abrir o meu convite', rsvpWelcome:'Já tens o teu convite individual. Abre-o para responderes.',
      rsvpNoLink:'Cada convidado tem um convite individual com o seu próprio link. Se o recebeste, cola-o aqui.', rsvpPasteLabel:'Link do teu convite', rsvpPastePh:'https://www.weddy.pt/rsvp.html?g=…', rsvpPasteBtn:'Abrir convite', rsvpPasteErr:'Este não parece ser um link de convite. Confirma que o copiaste inteiro.',
      rsvpAsk:'Ainda não recebeste o teu link? Fala com os noivos.', rsvpAskContact:'Ainda não recebeste o teu link? Contacta os noivos.',
      rsvpPreview:'Na página pública, cada convidado abre aqui o seu convite individual (link recebido dos noivos).',
      directions:'Como chegar', address:'Morada', parking:'Estacionamento', transport:'Transportes', meeting:'Pontos de encontro', lodgingTitle:'Alojamento', links:'Links úteis', notes:'Notas',
      by:'Criado com', previewBadge:'Pré-visualização', skip:'Saltar para o conteúdo', sections:'Secções', timeLabel:'Hora',
      notFoundTitle:'Este site não está disponível', notFoundText:'O endereço pode estar errado ou o site pode estar temporariamente indisponível.',
      loading:'A carregar…', error:'Não foi possível carregar o site. Tenta novamente.', retry:'Tentar novamente',
      metaDesc:function(a,b,d){ return a+' & '+b+(d?' — '+d:'')+'. Toda a informação do nosso casamento num só sítio.'; },
      welcomeDefault:'Estamos muito felizes por partilhar este dia convosco.', phone:'Telefone', email:'Email', external:'abre num novo separador'
    },
    en:{
      dayWord:function(n){ return n===1?'day':'days'; }, until:'to the big day',
      today:"Today's the big day!", tomorrow:"It's tomorrow!",
      nav:{ story:'Our story', location:'Venue', schedule:'Schedule', dresscode:'Dress code', lodging:'Stay', faq:'FAQ', contact:'Contact', rsvp:'RSVP' },
      navTitle:{ lodging:'Stay & travel', faq:'Frequently asked questions' },
      rsvpBtn:'RSVP', rsvpOpenWithLink:'Open my invitation', rsvpWelcome:'You already have your individual invitation. Open it to reply.',
      rsvpNoLink:'Every guest has an individual invitation with their own link. If you received it, paste it here.', rsvpPasteLabel:'Your invitation link', rsvpPastePh:'https://www.weddy.pt/rsvp.html?g=…', rsvpPasteBtn:'Open invitation', rsvpPasteErr:"That doesn't look like an invitation link. Make sure you copied all of it.",
      rsvpAsk:"Haven't received your link yet? Ask the couple.", rsvpAskContact:"Haven't received your link yet? Contact the couple.",
      rsvpPreview:'On the public page, each guest opens their individual invitation here (link received from the couple).',
      directions:'Get directions', address:'Address', parking:'Parking', transport:'Transport', meeting:'Meeting points', lodgingTitle:'Accommodation', links:'Useful links', notes:'Notes',
      by:'Made with', previewBadge:'Preview', skip:'Skip to content', sections:'Sections', timeLabel:'Time',
      notFoundTitle:'This site is not available', notFoundText:'The address may be wrong or the site may be temporarily unavailable.',
      loading:'Loading…', error:'We could not load the site. Please try again.', retry:'Try again',
      metaDesc:function(a,b,d){ return a+' & '+b+(d?' — '+d:'')+'. All the details of our wedding in one place.'; },
      welcomeDefault:"We're so happy to share this day with you.", phone:'Phone', email:'Email', external:'opens in a new tab'
    }
  };

  function escape(v){
    return String(v==null?'':v).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; });
  }
  function multiline(v){ return escape(v).replace(/\r?\n/g,'<br>'); }
  // Só https (nunca javascript:, data:, http:). Devolve '' se não for válido.
  function safeUrl(u){
    if(typeof u!=='string') return '';
    u = u.trim();
    if(u.length>1000 || !/^https:\/\//i.test(u)) return '';
    try{ var p = new URL(u); if(p.protocol!=='https:') return ''; return p.href; }catch(e){ return ''; }
  }
  // Só imagens do Storage do projeto (nunca URLs arbitrários de terceiros).
  function safeImg(u){
    var s = safeUrl(u);
    if(!s) return '';
    try{
      var h = new URL(s).hostname;
      if(h==='firebasestorage.googleapis.com' || h==='storage.googleapis.com' || /\.firebasestorage\.app$/.test(h)) return s;
    }catch(e){}
    return '';
  }
  function slugify(str){
    var s = String(str||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    s = s.replace(/&/g,' e ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
    return s.slice(0, 40).replace(/-+$/,'');
  }
  function slugProblem(slug){ return siteSlugProblem(slug); }
  function isTz(tz){ if(typeof tz!=='string' || TIMEZONES.indexOf(tz)<0) return false; try{ new Intl.DateTimeFormat('en-CA',{ timeZone:tz }); return true; }catch(e){ return false; } }
  function ymdInTz(now, tz){
    var f = new Intl.DateTimeFormat('en-CA',{ timeZone: isTz(tz)?tz:DEFAULT_TZ, year:'numeric', month:'2-digit', day:'2-digit' });
    var parts = {}; f.formatToParts(now).forEach(function(p){ parts[p.type]=p.value; });
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  // Dias de calendário até à data do casamento NO FUSO do evento. Negativo = já passou.
  function daysUntil(dateStr, tz, now){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||'')) return null;
    var today = ymdInTz(now||new Date(), tz);
    function ms(s){ var a=s.split('-'); return Date.UTC(+a[0], +a[1]-1, +a[2]); }
    return Math.round((ms(dateStr)-ms(today))/86400000);
  }
  function formatDate(dateStr, lang){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||'')) return '';
    var a = dateStr.split('-');
    var d = new Date(Date.UTC(+a[0], +a[1]-1, +a[2], 12));
    try{ return new Intl.DateTimeFormat(lang==='en'?'en-GB':'pt-PT',{ timeZone:'UTC', day:'numeric', month:'long', year:'numeric' }).format(d); }catch(e){ return dateStr; }
  }
  function canonicalSource(n1, n2, date, schedule){
    var sched = (schedule||[]).map(function(e){ return [String(e.time||'').trim(), String(e.label||'').trim(), String(e.place||'').trim()].join('~'); }).join('^');
    return [String(n1||'').trim(), String(n2||'').trim(), String(date||'').trim()].join('|') + '#' + sched;
  }

  var IC = {
    pin:'<svg class="ws-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    arrow:'<svg class="ws-ic ws-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    orn:'<svg class="ws-orn" viewBox="0 0 120 12" aria-hidden="true" focusable="false"><path d="M0 6h48M72 6h48" stroke="currentColor" stroke-width="1" fill="none"/><path d="M60 1.5 64.5 6 60 10.5 55.5 6z" fill="currentColor"/></svg>'
  };

  var FONT_BASE = 'fonts/'; // relativo ao documento (site.html e index.html estão na raiz)
  var CSS = [
  /* fontes alojadas localmente (OFL), sem pedidos ao Google */
  '@font-face{ font-family:"Cormorant Garamond"; font-style:normal; font-weight:300 700; font-display:swap; src:url("'+FONT_BASE+'cormorant-garamond.woff") format("woff"); }',
  '@font-face{ font-family:"Cormorant Garamond"; font-style:italic; font-weight:300 700; font-display:swap; src:url("'+FONT_BASE+'cormorant-garamond-italic.woff") format("woff"); }',
  '@font-face{ font-family:"Manrope"; font-style:normal; font-weight:200 800; font-display:swap; src:url("'+FONT_BASE+'manrope.woff") format("woff"); }',
  '@font-face{ font-family:"WS Serif"; src:local("Iowan Old Style"),local("Palatino Linotype"),local("Palatino"),local("Book Antiqua"),local("Georgia"),local("GFS Baskerville"),local("FreeSerif"); size-adjust:93%; }',
  '/* ---------- tokens ---------- */',
  '.ws-root{ --accent:#B96752; --dark:#9A4F3D; --soft:#F3E3DC; --ink:#2A2623; --muted:#655E58; --bg:#FAF8F4; --card:#FFFDFB; --line:rgba(42,38,35,.16); --top:0px;',
  '  --display:"Cormorant Garamond","WS Serif",Georgia,"Times New Roman",serif; --body:"Manrope",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
  '  --gut:22px; --sec:clamp(64px,16vw,132px);',
  '  --f-hero:clamp(3.5rem,17vw,9.5rem); --f-h2:clamp(2.4rem,10.5vw,4.1rem); --f-lead:clamp(1.3rem,5.2vw,1.75rem); --f-body:1.0625rem; --f-label:.72rem;',
  '  font-family:var(--body); color:var(--ink); background:var(--bg); line-height:1.7; font-size:16px; -webkit-text-size-adjust:100%; text-rendering:optimizeLegibility; -webkit-font-smoothing:antialiased; font-variant-numeric:lining-nums; overflow-x:clip; }',
  '.ws-root *,.ws-root *::before,.ws-root *::after{ box-sizing:border-box; }',
  '.ws-root img{ max-width:100%; display:block; }',
  ':where(.ws-root) :where(h1,h2,p,dl,dd,ul,ol,figure){ margin:0; padding:0; }',
  ':where(.ws-root) a{ color:inherit; }',
  'html{ scroll-behavior:smooth; }',
  '.ws-wrap{ width:100%; max-width:1200px; margin:0 auto; padding:0 var(--gut); }',
  '@media (min-width:600px){ .ws-root{ --gut:40px; } }',
  '@media (min-width:1000px){ .ws-root{ --gut:56px; } }',
  '.ws-skip{ position:absolute; left:12px; top:-60px; z-index:50; background:var(--dark); color:#fff; padding:10px 16px; font-weight:700; text-decoration:none; }',
  '.ws-skip:focus{ top:calc(var(--top) + 8px); }',
  '.ws-root :focus-visible{ outline:2px solid var(--dark); outline-offset:3px; }',
  '.ws-badge{ position:sticky; top:0; z-index:40; text-align:center; background:var(--dark); color:#fff; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; padding:6px 10px; }',
  '.ws-orn-wrap{ display:none; }',
  '/* ---------- componentes base ---------- */',
  '.ws-eyebrow{ font-size:var(--f-label); letter-spacing:.26em; text-transform:uppercase; color:var(--dark); font-weight:700; margin-bottom:22px; }',
  '.ws-names{ font-family:var(--display); font-weight:400; font-size:var(--f-hero); line-height:.9; letter-spacing:-.03em; color:var(--ink); text-wrap:balance; }',
  '.ws-names.ws-long{ font-size:clamp(2.6rem,12vw,6rem); }',
  '.ws-nm{ display:inline-block; max-width:100%; overflow-wrap:break-word; }',
  '.ws-nm2{ margin-left:.16em; }',
  '.ws-amp{ font-style:italic; font-weight:400; color:var(--accent); }',
  '.ws-date{ margin-top:26px; font-size:.75rem; letter-spacing:.22em; text-transform:uppercase; font-weight:700; color:var(--ink); }',
  '.ws-venue{ font-family:var(--display); text-transform:none; letter-spacing:.01em; font-size:1.4rem; font-style:italic; font-weight:500; color:var(--muted); }',
  '.ws-date .ws-dot{ display:none; }',
  '.ws-cover{ margin:0; overflow:hidden; background:var(--soft); width:100%; }',
  '.ws-cover img{ width:100%; height:100%; object-fit:cover; }',
  '.ws-mono{ display:flex; align-items:center; justify-content:center; font-family:var(--display); color:var(--dark); font-size:clamp(3rem,16vw,5rem); font-weight:400; font-style:italic; letter-spacing:.02em; }',
  '.ws-welcome{ margin-top:26px; max-width:30em; font-size:var(--f-body); line-height:1.8; text-wrap:pretty; }',
  '.ws-count{ margin-top:30px; display:inline-flex; align-items:baseline; gap:12px; flex-wrap:wrap; color:var(--dark); }',
  '.ws-count b{ font-family:var(--display); font-variant-numeric:lining-nums; font-weight:400; font-size:4.2rem; line-height:.9; letter-spacing:-.02em; font-variant-numeric:lining-nums; }',
  '.ws-count span{ font-size:var(--f-label); letter-spacing:.2em; text-transform:uppercase; font-weight:700; }',
  '.ws-count.is-msg b{ font-size:1.8rem; line-height:1.2; letter-spacing:0; }',
  '.ws-btn{ display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:54px; padding:0 34px; text-align:center; background:var(--dark); color:#fff !important; text-decoration:none; font-weight:600; font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; border:1px solid var(--dark); border-radius:0; cursor:pointer; font-family:inherit; transition:background .2s, color .2s; }',
  '.ws-btn:hover{ background:transparent; color:var(--dark) !important; }',
  '.ws-btn.is-ghost{ background:transparent; color:var(--dark) !important; }',
  '.ws-btn.is-ghost:hover{ background:var(--dark); color:#fff !important; }',
  '.ws-btn[aria-disabled="true"]{ opacity:.55; pointer-events:none; }',
  '.ws-cta{ margin-top:32px; }',
  '/* navegação */',
  '.ws-nav{ position:sticky; top:var(--top); z-index:30; background:rgba(250,248,244,.95); -webkit-backdrop-filter:saturate(1.2) blur(10px); backdrop-filter:saturate(1.2) blur(10px); border-bottom:1px solid var(--line); }',
  '.ws-nav-in{ display:flex; align-items:center; gap:4px; max-width:1200px; margin:0 auto; padding:0 12px; }',
  '.ws-nav-brand{ display:none; }',
  '.ws-nav-list{ display:flex; gap:0; overflow-x:auto; scroll-snap-type:x proximity; scrollbar-width:none; -webkit-overflow-scrolling:touch; flex:1; min-width:0; }',
  '.ws-nav-list::-webkit-scrollbar{ display:none; } .ws-nav-list > a:first-child{ margin-left:auto; } .ws-nav-list > a:last-child{ margin-right:auto; }',
  '.ws-nav.sr .ws-nav-list{ -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 46px),transparent); mask-image:linear-gradient(90deg,#000 calc(100% - 46px),transparent); }',
  '.ws-nav.sl .ws-nav-list{ -webkit-mask-image:linear-gradient(90deg,transparent,#000 46px); mask-image:linear-gradient(90deg,transparent,#000 46px); }',
  '.ws-nav.sl.sr .ws-nav-list{ -webkit-mask-image:linear-gradient(90deg,transparent,#000 46px,#000 calc(100% - 46px),transparent); mask-image:linear-gradient(90deg,transparent,#000 46px,#000 calc(100% - 46px),transparent); }',
  '.ws-nav a{ flex:0 0 auto; scroll-snap-align:center; display:inline-flex; align-items:center; min-height:50px; padding:0 15px; font-size:.7rem; letter-spacing:.16em; text-transform:uppercase; font-weight:600; text-decoration:none; color:var(--muted); white-space:nowrap; position:relative; }',
  '.ws-nav a::after{ content:""; position:absolute; left:15px; right:15px; bottom:9px; height:1px; background:var(--dark); transform:scaleX(0); transform-origin:left; transition:transform .25s; }',
  '.ws-nav a:hover,.ws-nav a[aria-current="true"]{ color:var(--dark); } .ws-nav a[aria-current="true"]::after{ transform:scaleX(1); }',
  '/* secções */',
  '.ws-block{ padding:var(--sec) 0; }',
  '.ws-pair{ display:grid; gap:calc(var(--sec) * .8); }',
  '.ws-sec{ scroll-margin-top:calc(var(--top) + 60px); min-width:0; }',
  '.ws-num{ display:block; font-family:var(--display); font-style:italic; font-size:1.05rem; color:var(--dark); margin-bottom:14px; }',
  '.ws-h2{ font-family:var(--display); font-weight:400; font-size:var(--f-h2); line-height:1; letter-spacing:-.015em; color:var(--ink); margin-bottom:30px; text-wrap:balance; }',
  '.ws-p{ font-size:var(--f-body); line-height:1.85; overflow-wrap:anywhere; text-wrap:pretty; max-width:34em; }',
  '.ws-p + .ws-p{ margin-top:16px; }',
  '.ws-muted{ color:var(--muted); font-size:.95rem; margin-bottom:22px; max-width:34em; }',
  '.ws-photo{ margin:40px 0 0; overflow:hidden; background:var(--soft); }',
  '.ws-photo img{ width:100%; height:auto; aspect-ratio:4/5; object-fit:cover; }',
  '.ws-dl{ display:grid; gap:26px; }',
  '.ws-dl dt{ font-size:var(--f-label); letter-spacing:.22em; text-transform:uppercase; font-weight:700; color:var(--dark); margin-bottom:6px; }',
  '.ws-dl dd{ font-size:var(--f-body); line-height:1.65; overflow-wrap:anywhere; }',
  '.ws-dl dd strong{ font-weight:600; }',
  '.ws-dl a{ color:var(--dark); font-weight:600; text-underline-offset:4px; text-decoration-thickness:1px; }',
  '.ws-sec .ws-cta{ margin-top:30px; }',
  '.ws-ic{ width:15px; height:15px; flex:0 0 15px; }',
  '/* programa */',
  '.ws-tl{ list-style:none; position:relative; margin-top:10px; }',
  '.ws-tl::before{ content:""; position:absolute; left:104px; top:20px; bottom:20px; width:1px; background:var(--accent); opacity:.45; }',
  '.ws-tl li{ position:relative; display:grid; grid-template-columns:92px 1fr; column-gap:38px; padding:16px 0; align-items:baseline; }',
  '.ws-tl li::before{ content:""; position:absolute; left:100px; top:29px; width:9px; height:9px; border-radius:50%; background:var(--accent); }',
  '.ws-tl time{ font-family:var(--display); font-size:2.15rem; font-weight:400; line-height:1; color:var(--ink); font-variant-numeric:lining-nums tabular-nums; letter-spacing:-.01em; }',
  '.ws-tl .n{ display:block; font-weight:600; font-size:1.0625rem; line-height:1.35; }',
  '.ws-tl .pl{ display:flex; align-items:center; gap:6px; margin-top:3px; font-size:.9rem; color:var(--muted); }',
  '/* links úteis */',
  '.ws-links{ list-style:none; display:flex; flex-wrap:wrap; gap:8px 26px; margin-top:22px; }',
  '.ws-links a{ display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:0; border-bottom:1px solid var(--dark); color:var(--dark); font-weight:600; font-size:.92rem; text-decoration:none; }',
  '.ws-links a:hover{ opacity:.7; }',
  '.ws-arrow{ width:14px; height:14px; flex-basis:14px; }',
  '/* faq */',
  '.ws-faq{ border-bottom:1px solid var(--line); }',
  '.ws-faq:first-of-type{ border-top:1px solid var(--line); }',
  '.ws-faq summary{ cursor:pointer; padding:20px 0; min-height:60px; font-family:var(--display); font-weight:500; font-size:1.4rem; line-height:1.25; list-style:none; display:flex; justify-content:space-between; align-items:center; gap:20px; }',
  '.ws-faq summary::-webkit-details-marker{ display:none; }',
  '.ws-faq summary::after{ content:""; flex:0 0 13px; height:13px; background:linear-gradient(var(--dark),var(--dark)) center/100% 1px no-repeat, linear-gradient(var(--dark),var(--dark)) center/1px 100% no-repeat; transition:transform .25s; }',
  '.ws-faq[open] summary::after{ transform:rotate(45deg); }',
  '.ws-faq .a{ padding:0 0 24px; color:var(--muted); font-size:1rem; line-height:1.75; overflow-wrap:anywhere; max-width:42em; }',
  '/* rsvp */',
  '.ws-rsvp-box{ text-align:center; }',
  '.ws-rsvp-box .ws-h2{ margin-bottom:16px; }',
  '.ws-rsvp-box .ws-p{ margin-left:auto; margin-right:auto; }',
  '.ws-help{ max-width:30em; margin:18px auto 0; color:var(--muted); font-size:.92rem; }',
  '.ws-help a{ color:var(--dark); font-weight:700; }',
  '.ws-paste{ margin:26px auto 0; max-width:34em; text-align:left; }',
  '.ws-paste label{ display:block; font-size:var(--f-label); font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--dark); margin-bottom:8px; }',
  '.ws-paste-row{ display:flex; gap:10px; flex-wrap:wrap; }',
  '.ws-paste input{ flex:1 1 230px; min-width:0; min-height:54px; padding:0 16px; font:inherit; font-size:16px; border:1px solid var(--line); border-radius:0; background:#fff; color:var(--ink); }',
  '.ws-paste-err{ margin-top:10px; font-size:.9rem; color:#9B2C1F; font-weight:600; }',
  '.ws-foot{ text-align:center; padding:56px 0 64px; color:var(--muted); font-size:.78rem; letter-spacing:.06em; }',
  '.ws-foot-names{ display:block; font-family:var(--display); font-style:italic; font-size:1.6rem; letter-spacing:0; color:var(--ink); margin-bottom:6px; }',
  '.ws-foot a{ color:var(--dark); font-weight:700; text-decoration:none; }',
  '.ws-js .ws-reveal{ opacity:0; transform:translateY(18px); transition:opacity .8s ease, transform .8s ease; }',
  '.ws-js .ws-reveal.in{ opacity:1; transform:none; }',
  '@media (prefers-reduced-motion:reduce){ html{ scroll-behavior:auto; } .ws-root *,.ws-root *::before,.ws-root *::after{ transition:none !important; animation:none !important; } .ws-js .ws-reveal{ opacity:1 !important; transform:none !important; } }',
  '/* =============== 1 · EDITORIAL — capa em painel sobreposto, ritmo variado =============== */',
  '.ws-t-editorial .ws-hero{ padding:0; }',
  '.ws-t-editorial .ws-hero > .ws-wrap{ padding:0; max-width:none; display:flex; flex-direction:column; }',
  '.ws-t-editorial .ws-cover{ order:-1; aspect-ratio:4/5; max-height:86vh; max-height:86svh; }',
  '.ws-t-editorial .ws-mono{ display:none; }',
  '.ws-t-editorial .ws-hero-text{ position:relative; display:flex; flex-direction:column; align-items:flex-start; margin:-92px 0 0 var(--gut); padding:36px 24px 8px 28px; background:var(--bg); }',
  '.ws-t-editorial .ws-nocover .ws-hero-text, .ws-t-editorial .ws-hero.ws-nocover .ws-hero-text{ margin:0; padding:76px var(--gut) 8px; }',
  '.ws-t-editorial .ws-eyebrow{ display:flex; align-items:center; gap:14px; } .ws-t-editorial .ws-eyebrow::after{ content:""; height:1px; width:48px; background:var(--accent); }',
  '.ws-t-editorial .ws-names{ font-size:clamp(3.2rem,14.6vw,7.4rem); line-height:.86; letter-spacing:-.035em; }',
  '.ws-t-editorial .ws-names.ws-long{ font-size:clamp(2.7rem,13vw,5.6rem); }',
  '.ws-t-editorial .ws-nm2{ display:block; margin-left:0; padding-left:.5em; }',
  '.ws-t-editorial .ws-date{ display:flex; flex-direction:column; gap:6px; margin-top:34px; }',
  '.ws-t-editorial .ws-welcome{ position:relative; margin-top:28px; padding-top:28px; font-family:var(--display); font-size:var(--f-lead); line-height:1.45; font-style:italic; font-weight:500; max-width:24em; }',
  '.ws-t-editorial .ws-welcome::before{ content:""; position:absolute; left:0; top:0; width:44px; height:1px; background:var(--accent); }',
  '.ws-t-editorial .ws-count{ margin-top:26px; padding-top:22px; border-top:1px solid var(--line); align-self:stretch; }',
  '.ws-t-editorial .ws-count b{ font-size:5rem; }',
  '.ws-t-editorial .ws-cta{ margin:34px 0 44px; }',
  '.ws-t-editorial .ws-sec-in{ display:block; }',
  '.ws-t-editorial .ws-num::after{ content:""; display:inline-block; width:38px; height:1px; background:var(--accent); vertical-align:middle; margin-left:14px; }',
  '/* ritmo: história · local (endereço em destaque) · programa (faixa) · dress code (centrado) · alojamento · faq · contacto · rsvp (faixa escura) */',
  '.ws-t-editorial .ws-b-story .ws-photo{ margin:44px calc(var(--gut) * -1) 0; }',
  '.ws-t-editorial .ws-b-story .ws-p{ font-size:1.125rem; }',
  '.ws-t-editorial .ws-b-location .ws-dl > div:first-child dd{ font-family:var(--display); font-size:2rem; line-height:1.15; font-weight:400; } .ws-t-editorial .ws-b-location .ws-dl > div:first-child dd strong{ font-weight:500; }',
  '.ws-t-editorial .ws-b-schedule{ background:var(--soft); }',
  '.ws-t-editorial .ws-b-dresscode{ text-align:center; } .ws-t-editorial .ws-b-dresscode .ws-num::after{ display:none; }',
  '.ws-t-editorial .ws-b-dresscode .ws-p{ margin:0 auto; font-family:var(--display); font-style:italic; font-size:var(--f-lead); line-height:1.5; }',
  '.ws-t-editorial .ws-b-dresscode .ws-photo{ width:min(100%,380px); margin:44px auto 0; }',
  '/* moodboard do dress code: mostra a imagem inteira (sem recorte) e centrada, qualquer que seja o formato */',
  '.ws-b-dresscode .ws-photo img, .ws-t-editorial .ws-b-dresscode .ws-photo img, .ws-t-classic .ws-b-dresscode .ws-photo img{ aspect-ratio:auto; object-fit:contain; }',
  '.ws-t-editorial .ws-b-lodging{ border-top:1px solid var(--line); }',
  '.ws-t-editorial .ws-b-contact{ padding:calc(var(--sec) * .7) 0; border-top:1px solid var(--line); }',
  '.ws-t-editorial .ws-b-rsvp{ background:var(--ink); color:#fff; }',
  '.ws-t-editorial .ws-b-rsvp .ws-h2{ color:#fff; font-style:italic; font-size:clamp(2.6rem,12vw,5.2rem); }',
  '.ws-t-editorial .ws-b-rsvp .ws-p{ color:#E9E3DC; font-family:var(--display); font-size:1.4rem; font-style:italic; }',
  '.ws-t-editorial .ws-b-rsvp .ws-btn{ background:#fff; color:var(--ink) !important; border-color:#fff; } .ws-t-editorial .ws-b-rsvp .ws-btn:hover{ background:transparent; color:#fff !important; }',
  '.ws-t-editorial .ws-b-rsvp .ws-help,.ws-t-editorial .ws-b-rsvp .ws-help a,.ws-t-editorial .ws-b-rsvp .ws-paste label{ color:#E9E3DC; }',
  '.ws-t-editorial .ws-b-rsvp .ws-paste input{ background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.4); color:#fff; } .ws-t-editorial .ws-b-rsvp .ws-paste input::placeholder{ color:rgba(255,255,255,.62); }',
  '.ws-t-editorial .ws-b-rsvp .ws-paste-err{ color:#FFB4A8; }',
  '.ws-t-editorial .ws-foot{ background:var(--bg); }',
  '/* =============== 2 · CLÁSSICO — papelaria de casamento =============== */',
  '.ws-t-classic{ --bg:#FBF8F2; --card:#FFFEFC; --ink:#2E2522; --muted:#6A5F59; }',
  '.ws-t-classic .ws-hero{ padding:22px 0 8px; }',
  '.ws-t-classic .ws-hero > .ws-wrap{ position:relative; width:calc(100% - 32px); max-width:860px; margin:0 auto; padding:54px 22px 50px; background:var(--card); border:1px solid var(--accent); outline:1px solid var(--line); outline-offset:6px; display:flex; flex-direction:column; align-items:center; text-align:center; }',
  '.ws-t-classic .ws-hero-text{ display:flex; flex-direction:column; align-items:center; }',
  '.ws-t-classic .ws-cover{ order:-1; width:min(78%,270px); aspect-ratio:3/4; border-radius:999px 999px 0 0; margin-bottom:38px; outline:1px solid var(--accent); outline-offset:6px; }',
  '.ws-t-classic .ws-mono{ width:min(66%,220px); height:auto; aspect-ratio:3/4; border:1px solid var(--accent); outline:1px solid var(--line); outline-offset:6px; background:transparent; font-size:clamp(3rem,17vw,5rem); }',
  '.ws-t-classic .ws-eyebrow{ letter-spacing:.42em; margin-bottom:26px; }',
  '.ws-t-classic .ws-names{ font-weight:400; font-size:clamp(2.9rem,14vw,5.4rem); line-height:1.02; letter-spacing:-.01em; }',
  '.ws-t-classic .ws-names.ws-long{ font-size:clamp(2.3rem,10.5vw,4.2rem); }',
  '.ws-t-classic .ws-nm2{ display:block; margin-left:0; }',
  '.ws-t-classic .ws-amp{ font-size:.72em; }',
  '.ws-t-classic .ws-hero .ws-orn-wrap{ display:flex; justify-content:center; color:var(--accent); margin:26px 0 4px; } .ws-t-classic .ws-orn{ width:110px; height:12px; }',
  '.ws-t-classic .ws-date{ display:flex; flex-direction:column; align-items:center; gap:8px; margin-top:18px; letter-spacing:.3em; }',
  '.ws-t-classic .ws-welcome{ font-family:var(--display); font-size:1.4rem; font-style:italic; font-weight:500; line-height:1.5; margin-left:auto; margin-right:auto; color:var(--muted); }',
  '.ws-t-classic .ws-count{ border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:14px 30px; justify-content:center; } .ws-t-classic .ws-count b{ font-size:3rem; }',
  '.ws-t-classic .ws-btn{ outline:1px solid var(--dark); outline-offset:4px; letter-spacing:.24em; }',
  '.ws-t-classic .ws-nav{ background:rgba(251,248,242,.95); }',
  '.ws-t-classic .ws-nav a{ font-family:var(--display); font-style:italic; font-size:1.12rem; text-transform:none; letter-spacing:.01em; font-weight:500; }',
  '.ws-t-classic .ws-block{ padding:8px 0 0; text-align:center; }',
  '.ws-t-classic .ws-block:first-child > .ws-wrap{ padding-top:56px; }',
  '.ws-t-classic .ws-pair > .ws-sec + .ws-sec::before{ content:""; display:block; width:7px; height:7px; transform:rotate(45deg); background:var(--accent); margin:0 auto 44px; }',
  '.ws-t-classic .ws-block > .ws-wrap > .ws-orn-wrap{ display:flex; justify-content:center; color:var(--accent); padding:44px 0 34px; } .ws-t-classic .ws-orn{ width:110px; height:12px; }',
  '.ws-t-classic .ws-sec-in{ display:block; }',
  '.ws-t-classic .ws-num{ display:none; }',
  '.ws-t-classic .ws-h2{ font-style:italic; font-weight:400; font-size:clamp(2.1rem,9vw,3rem); color:var(--dark); margin-bottom:24px; }',
  '.ws-t-classic .ws-p,.ws-t-classic .ws-muted,.ws-t-classic .ws-help{ margin-left:auto; margin-right:auto; }',
  '.ws-t-classic .ws-dl{ justify-items:center; text-align:center; gap:24px; } .ws-t-classic .ws-links{ justify-content:center; }',
  '.ws-t-classic .ws-dl dt{ letter-spacing:.3em; }',
  '.ws-t-classic .ws-b-location .ws-dl > div:first-child dd{ font-family:var(--display); font-size:1.7rem; line-height:1.25; }',
  '.ws-t-classic .ws-photo{ width:min(80%,320px); margin:34px auto 0; border-radius:999px 999px 0 0; outline:1px solid var(--accent); outline-offset:6px; } .ws-t-classic .ws-photo img{ aspect-ratio:3/4; }',
  '.ws-t-classic .ws-tl{ margin:8px auto 0; } .ws-t-classic .ws-tl::before{ display:none; }',
  '.ws-t-classic .ws-tl li{ display:block; padding:6px 0 28px; text-align:center; } .ws-t-classic .ws-tl li::before{ display:none; }',
  '.ws-t-classic .ws-tl li + li::before{ display:block; content:""; position:static; width:7px; height:7px; border-radius:0; transform:rotate(45deg); background:var(--accent); margin:0 auto 24px; }',
  '.ws-t-classic .ws-tl time{ display:block; font-style:italic; font-size:2rem; color:var(--dark); margin-bottom:4px; } .ws-t-classic .ws-tl .pl{ justify-content:center; }',
  '.ws-t-classic .ws-faq{ text-align:left; } .ws-t-classic .ws-sec-faq{ max-width:680px; margin:0 auto; }',
  '.ws-t-classic .ws-faq summary{ font-style:italic; }',
  '.ws-t-classic .ws-b-rsvp{ padding:44px 0 0; }',
  '.ws-t-classic .ws-b-rsvp .ws-rsvp-box{ background:var(--card); border:1px solid var(--accent); outline:1px solid var(--line); outline-offset:6px; padding:54px 22px 50px; margin:0 6px; }',
  '.ws-t-classic .ws-b-rsvp .ws-h2{ margin-bottom:14px; }',
  '.ws-t-classic .ws-foot{ padding-top:64px; }',
  '/* =============== 3 · MODERNO — grelha editorial contemporânea =============== */',
  '.ws-t-modern{ --bg:#F6F4EF; --card:#FFFFFF; --ink:#1F2428; --muted:#5C6368; --line:rgba(31,36,40,.18); --f-h2:clamp(1.9rem,8vw,3rem); }',
  '.ws-t-modern .ws-hero{ padding:34px 0 0; }',
  '.ws-t-modern .ws-hero > .ws-wrap{ display:flex; flex-direction:column; }',
  '.ws-t-modern .ws-hero-text{ display:flex; flex-direction:column; align-items:flex-start; }',
  '.ws-t-modern .ws-eyebrow{ display:flex; align-items:center; gap:12px; letter-spacing:.2em; color:var(--ink); } .ws-t-modern .ws-eyebrow::before{ content:""; width:28px; height:2px; background:var(--accent); }',
  '.ws-t-modern .ws-names{ font-family:var(--body); font-weight:300; font-size:clamp(3.2rem,16vw,8rem); line-height:.92; letter-spacing:-.04em; word-spacing:.08em; overflow-wrap:normal; word-break:normal; hyphens:manual; }',
  '.ws-t-modern .ws-names.ws-long{ font-size:clamp(2.2rem,10vw,4.6rem); }',
  '.ws-t-modern .ws-nm{ display:block; } .ws-t-modern .ws-nm2{ margin-left:0; }',
  '.ws-t-modern .ws-amp{ font-family:var(--display); font-weight:400; letter-spacing:0; }',
  '.ws-t-modern .ws-date{ display:flex; flex-wrap:wrap; gap:4px 18px; align-items:baseline; align-self:stretch; margin-top:30px; padding-top:18px; border-top:1px solid var(--ink); letter-spacing:.12em; }',
  '.ws-t-modern .ws-venue{ font-family:var(--body); font-style:normal; font-weight:500; font-size:.8rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }',
  '.ws-t-modern .ws-welcome{ color:var(--muted); margin-top:20px; }',
  '.ws-t-modern .ws-count{ margin-top:26px; } .ws-t-modern .ws-count b{ font-family:var(--body); font-weight:300; font-size:4rem; letter-spacing:-.05em; }',
  '.ws-t-modern .ws-btn{ background:var(--ink); border-color:var(--ink); } .ws-t-modern .ws-btn:hover{ background:transparent; color:var(--ink) !important; }',
  '.ws-t-modern .ws-btn.is-ghost{ background:transparent; color:var(--ink) !important; } .ws-t-modern .ws-btn.is-ghost:hover{ background:var(--ink); color:#fff !important; }',
  '.ws-t-modern .ws-cover{ order:2; width:calc(100% - var(--gut)); margin:44px 0 0 auto; aspect-ratio:4/5; max-height:none; box-shadow:-14px 14px 0 var(--soft); }',
  '.ws-t-modern .ws-mono{ order:2; width:calc(100% - var(--gut)); margin:44px 0 0 auto; aspect-ratio:4/5; background:var(--soft); box-shadow:none; font-family:var(--body); font-style:normal; font-weight:200; letter-spacing:-.05em; font-size:clamp(4rem,26vw,9rem); }',
  '.ws-t-modern .ws-nav{ background:rgba(246,244,239,.95); margin-top:44px; }',
  '.ws-t-modern .ws-block{ padding:0; }',
  '.ws-t-modern .ws-block > .ws-wrap{ padding-top:var(--sec); padding-bottom:var(--sec); }',
  '.ws-t-modern .ws-block:nth-child(even){ background:var(--soft); }',
  '.ws-t-modern .ws-sec-in{ display:block; }',
  '.ws-t-modern .ws-num{ font-family:var(--body); font-style:normal; font-weight:200; font-size:3.6rem; line-height:1; letter-spacing:-.06em; color:var(--accent); margin-bottom:10px; }',
  '.ws-t-modern .ws-h2{ font-family:var(--body); font-weight:600; letter-spacing:-.03em; line-height:1.08; color:var(--ink); }',
  '.ws-t-modern .ws-p{ color:var(--ink); }',
  '.ws-t-modern .ws-dl dt{ color:var(--muted); letter-spacing:.18em; }',
  '.ws-t-modern .ws-b-location .ws-dl > div:first-child dd{ font-size:1.35rem; line-height:1.35; letter-spacing:-.01em; }',
  '.ws-t-modern .ws-photo{ margin-top:36px; box-shadow:-12px 12px 0 var(--soft); } .ws-t-modern .ws-block:nth-child(even) .ws-photo{ box-shadow:-12px 12px 0 var(--card); }',
  '.ws-t-modern .ws-tl{ margin-top:6px; border-bottom:1px solid var(--line); } .ws-t-modern .ws-tl::before{ display:none; }',
  '.ws-t-modern .ws-tl li{ grid-template-columns:84px 1fr; column-gap:18px; padding:20px 0; border-top:1px solid var(--line); } .ws-t-modern .ws-tl li::before{ display:none; }',
  '.ws-t-modern .ws-tl time{ font-family:var(--body); font-weight:700; font-size:1.05rem; letter-spacing:-.01em; }',
  '.ws-t-modern .ws-links a{ border:1px solid var(--ink); border-bottom-width:1px; padding:0 18px; color:var(--ink); } .ws-t-modern .ws-links a:hover{ background:var(--ink); color:#fff; opacity:1; }',
  '.ws-t-modern .ws-faq summary{ font-family:var(--body); font-weight:600; font-size:1.05rem; letter-spacing:-.01em; }',
  '.ws-t-modern .ws-b-rsvp{ background:var(--dark) !important; color:#fff; }',
  '.ws-t-modern .ws-b-rsvp .ws-rsvp-box{ text-align:left; }',
  '.ws-t-modern .ws-b-rsvp .ws-h2{ color:#fff; font-weight:300; font-size:clamp(2.6rem,12vw,5.6rem); letter-spacing:-.055em; line-height:.95; }',
  '.ws-t-modern .ws-b-rsvp .ws-p{ color:#F0F0EE; margin-left:0; }',
  '.ws-t-modern .ws-b-rsvp .ws-btn{ background:#fff; color:var(--dark) !important; border-color:#fff; } .ws-t-modern .ws-b-rsvp .ws-btn:hover{ background:transparent; color:#fff !important; }',
  '.ws-t-modern .ws-b-rsvp .ws-help,.ws-t-modern .ws-b-rsvp .ws-help a,.ws-t-modern .ws-b-rsvp .ws-paste label{ color:#F0F0EE; } .ws-t-modern .ws-b-rsvp .ws-help{ margin-left:0; }',
  '.ws-t-modern .ws-b-rsvp .ws-paste{ margin-left:0; } .ws-t-modern .ws-b-rsvp .ws-paste input{ background:rgba(255,255,255,.1); border-color:rgba(255,255,255,.45); color:#fff; } .ws-t-modern .ws-b-rsvp .ws-paste input::placeholder{ color:rgba(255,255,255,.65); }',
  '.ws-t-modern .ws-b-rsvp .ws-paste-err{ color:#FFD0C8; }',
  '.ws-t-modern .ws-foot{ text-align:left; border-top:1px solid var(--line); margin-top:0; padding:40px 0 48px; }',
  '/* =============== TABLET (≥600) =============== */',
  '@media (min-width:600px){',
  '  .ws-dl{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:30px 40px; }',
  '  .ws-t-editorial .ws-hero > .ws-wrap{ } .ws-t-editorial .ws-cover{ aspect-ratio:3/2; max-height:640px; }',
  '  .ws-t-editorial .ws-hero-text{ margin-top:-110px; padding:44px 40px 8px 44px; }',
  '  .ws-t-editorial .ws-b-story .ws-photo{ margin-left:0; margin-right:0; }',
  '  .ws-t-classic .ws-hero > .ws-wrap{ padding:64px 56px 58px; }',
  '  .ws-t-modern .ws-cover,.ws-t-modern .ws-mono{ aspect-ratio:3/2; }',
  '}',
  '/* =============== DESKTOP (≥900) =============== */',
  '@media (min-width:900px){',
  '  .ws-nav-in{ padding:0 var(--gut); } .ws-nav a{ padding:0 18px; }',
  '  .ws-nav-brand{ display:block; font-family:var(--display); font-style:italic; font-size:1.4rem; color:var(--ink); white-space:nowrap; margin-right:auto; flex:0 0 auto; width:90px; }',
  '  .ws-nav-in::after{ content:""; flex:0 0 90px; }',
  '  .ws-pair{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:96px; } .ws-pair .ws-dl{ grid-template-columns:1fr; }',
  '  .ws-h2{ font-size:clamp(2.8rem,4.2vw,4.4rem); }',
  '  /* editorial */',
  '  .ws-t-editorial .ws-hero > .ws-wrap{ flex-direction:row; align-items:stretch; min-height:min(92vh,880px); }',
  '  .ws-t-editorial .ws-hero-text{ flex:1 1 56%; min-width:0; justify-content:center; margin:0; padding:96px 48px 88px max(56px,calc((100vw - 1200px)/2 + 56px)); background:transparent; }',
  '  .ws-t-editorial .ws-cover{ order:2; flex:0 0 44%; width:auto; aspect-ratio:auto; max-height:none; min-height:620px; }',
  '  .ws-t-editorial .ws-mono{ display:flex; order:2; flex:0 0 40%; width:auto; margin:56px 56px 56px 0; background:var(--soft); font-size:clamp(5rem,11vw,10rem); border:1px solid var(--accent); outline:1px solid var(--line); outline-offset:-12px; }',
  '  .ws-t-editorial .ws-names{ font-size:clamp(4.4rem,7.2vw,9rem); } .ws-t-editorial .ws-names.ws-long{ font-size:clamp(3.4rem,5.2vw,6.4rem); }',
  '  .ws-t-editorial .ws-date{ flex-direction:row; align-items:baseline; gap:22px; flex-wrap:wrap; } .ws-t-editorial .ws-venue{ padding-left:22px; border-left:1px solid var(--line); }',
  '  .ws-t-editorial .ws-sec-in{ display:grid; grid-template-columns:minmax(240px,4fr) 8fr; gap:72px; align-items:start; }',
  '  .ws-t-editorial .ws-sec-head{ position:sticky; top:calc(var(--top) + 90px); } .ws-t-editorial .ws-h2{ margin-bottom:0; font-size:clamp(2.8rem,4vw,4.4rem); }',
  '  .ws-t-editorial .ws-b-story .ws-sec-body.has-photo, .ws-t-editorial .ws-b-story .ws-has-photo .ws-sec-body{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:64px; align-items:start; }',
  '  .ws-t-editorial .ws-b-story .ws-photo{ margin:88px 0 0; } .ws-t-editorial .ws-b-story .ws-p{ font-size:1.2rem; }',
  '  .ws-t-editorial .ws-b-location .ws-dl{ grid-template-columns:1fr 1fr; } .ws-t-editorial .ws-b-location .ws-dl > div:first-child{ grid-column:1 / -1; } .ws-t-editorial .ws-b-location .ws-dl > div:first-child dd{ font-size:2.6rem; }',
  '  .ws-t-editorial .ws-b-schedule .ws-sec-in{ display:block; text-align:center; } .ws-t-editorial .ws-b-schedule .ws-sec-head{ position:static; margin-bottom:56px; } .ws-t-editorial .ws-b-schedule .ws-num::after{ display:none; }',
  '  .ws-t-editorial .ws-b-schedule .ws-muted{ margin-left:auto; margin-right:auto; }',
  '  .ws-t-editorial .ws-b-schedule .ws-tl{ max-width:780px; margin:0 auto; } .ws-t-editorial .ws-b-schedule .ws-tl::before{ left:50%; }',
  '  .ws-t-editorial .ws-b-schedule .ws-tl li{ grid-template-columns:1fr 1fr; column-gap:56px; padding:22px 0; text-align:left; } .ws-t-editorial .ws-b-schedule .ws-tl li::before{ left:calc(50% - 4px); top:38px; }',
  '  .ws-t-editorial .ws-b-schedule .ws-tl time{ text-align:right; font-size:3rem; } .ws-t-editorial .ws-b-schedule .ws-tl .n{ font-size:1.15rem; }',
  '  .ws-t-editorial .ws-b-dresscode .ws-sec-in{ display:block; } .ws-t-editorial .ws-b-dresscode .ws-sec-head{ position:static; margin-bottom:28px; }',
  '  .ws-t-editorial .ws-b-dresscode .ws-p{ font-size:clamp(1.9rem,2.8vw,2.6rem); max-width:22em; }',
  '  .ws-t-editorial .ws-b-dresscode .ws-photo{ width:380px; margin:64px auto 0; }',
  '  .ws-t-editorial .ws-b-lodging .ws-dl{ grid-template-columns:1fr 1fr; }',
  '  .ws-t-editorial .ws-b-contact .ws-dl{ grid-template-columns:repeat(3,auto); justify-content:start; gap:24px 64px; }',
  '  .ws-t-editorial .ws-b-rsvp .ws-sec-in{ display:block; }',
  '  .ws-t-editorial .ws-b-rsvp .ws-h2{ font-size:clamp(4rem,8vw,8rem); }',
  '  /* clássico */',
  '  .ws-t-classic .ws-hero{ padding:40px 0 12px; } .ws-t-classic .ws-hero > .ws-wrap{ padding:76px 96px 70px; }',
  '  .ws-t-classic .ws-names{ font-size:clamp(3.6rem,6.4vw,6rem); } .ws-t-classic .ws-names.ws-long{ font-size:clamp(2.8rem,5vw,4.6rem); }',
  '  .ws-t-classic .ws-nm2{ display:inline-block; margin-left:.18em; } .ws-t-classic .ws-names.ws-long .ws-nm2{ display:block; margin-left:0; }',
  '  .ws-t-classic .ws-pair{ gap:0; } .ws-t-classic .ws-pair > .ws-sec + .ws-sec::before{ display:none; } .ws-t-classic .ws-pair > .ws-sec{ padding:0 56px; } .ws-t-classic .ws-pair > .ws-sec + .ws-sec{ border-left:1px solid var(--line); }',
  '  .ws-t-classic .ws-sec-solo{ max-width:760px; margin:0 auto; }',
  '  .ws-t-classic .ws-h2{ font-size:clamp(2.6rem,3.6vw,3.4rem); }',
  '  .ws-t-classic .ws-b-rsvp .ws-rsvp-box{ max-width:720px; margin:0 auto; padding:64px 56px 58px; }',
  '  /* moderno */',
  '  .ws-t-modern .ws-hero{ padding:64px 0 0; } .ws-t-modern .ws-hero > .ws-wrap{ display:grid; grid-template-columns:minmax(0,7fr) minmax(0,5fr); column-gap:72px; align-items:end; }',
  '  .ws-t-modern .ws-cover,.ws-t-modern .ws-mono{ order:2; width:auto; margin:0 0 0 0; aspect-ratio:4/5; max-height:720px; }',
  '  .ws-t-modern .ws-names{ font-size:clamp(4.4rem,8.4vw,10rem); } .ws-t-modern .ws-names.ws-long{ font-size:clamp(3rem,5.2vw,6.4rem); }',
  '  .ws-t-modern .ws-hero-text{ padding-bottom:12px; }',
  '  .ws-t-modern .ws-nav{ margin-top:72px; }',
  '  .ws-t-modern .ws-b-story .ws-sec-in,.ws-t-modern .ws-sec-solo .ws-sec-in{ display:grid; grid-template-columns:minmax(220px,4fr) 8fr; gap:72px; align-items:start; }',
  '  .ws-t-modern .ws-sec-solo .ws-sec-head{ position:sticky; top:calc(var(--top) + 90px); }',
  '  .ws-t-modern .ws-block > .ws-wrap{ padding-top:calc(var(--sec) * .9); padding-bottom:calc(var(--sec) * .9); }',
  '  .ws-t-modern .ws-b-story .ws-has-photo .ws-sec-body{ display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:start; }',
  '  .ws-t-modern .ws-b-story .ws-photo{ margin-top:0; }',
  '  .ws-t-modern .ws-b-rsvp .ws-sec-in{ display:block; } .ws-t-modern .ws-b-rsvp .ws-h2{ font-size:clamp(4rem,8.6vw,9rem); }',
  '  .ws-t-modern .ws-b-rsvp .ws-rsvp-box{ max-width:none; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); column-gap:72px; align-items:end; } .ws-t-modern .ws-b-rsvp .ws-rsvp-box > .ws-h2{ grid-column:1; grid-row:1 / span 8; align-self:start; } .ws-t-modern .ws-b-rsvp .ws-rsvp-box > :not(.ws-h2){ grid-column:2; }',
  '}',
  '@media (min-width:1280px){ .ws-root{ font-size:17px; } }'
  ].join('\n');

  // Nomes: inline-block por nome; o "&" fica sempre agarrado ao 2.º nome (nbsp)
  // e nunca pode ficar sozinho numa linha.
  function namesHtml(n1, n2, tpl){
    var a = escape(n1), b = escape(n2);
    var words = (n1+' '+n2).split(/\s+/).filter(Boolean);
    var longest = words.reduce(function(m,w){ return Math.max(m, w.length); }, 0);
    var long = longest > 10 || (n1+n2).length > 30;
    var second = (a && b) ? '<span class="ws-amp">&amp;</span>&nbsp;'+b : b;
    return { html:'<h1 class="ws-names'+(long?' ws-long':'')+'"><span class="ws-nm">'+a+'</span> <span class="ws-nm ws-nm2">'+second+'</span></h1>', long:long };
  }
  function initials(names){
    var l = names.filter(Boolean).map(function(n){ return n.trim().charAt(0).toUpperCase(); });
    return l.length===2 ? escape(l[0])+'&amp;'+escape(l[1]) : escape(l[0]||'');
  }

  var SCRIPT = '(function(){var d=document,r=d.querySelector(".ws-root");if(!r)return;'
  + 'function ymd(n,tz){try{var f=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}),p={};f.formatToParts(n).forEach(function(x){p[x.type]=x.value});return p.year+"-"+p.month+"-"+p.day}catch(e){return null}}'
  + 'function ms(s){var a=s.split("-");return Date.UTC(+a[0],+a[1]-1,+a[2])}'
  + 'function tick(){r.querySelectorAll(".ws-count[data-date]").forEach(function(el){var t=ymd(new Date(),el.getAttribute("data-tz")||"Europe/Lisbon");if(!t)return;var dd=Math.round((ms(el.getAttribute("data-date"))-ms(t))/864e5),o=JSON.parse(el.getAttribute("data-txt")||"{}"),b=el.querySelector("b"),s=el.querySelector("span");'
  + 'if(dd>1){el.classList.remove("is-msg");b.textContent=dd;s.textContent=o.days+" "+o.until}else if(dd===1){el.classList.add("is-msg");b.textContent=o.tomorrow;s.textContent=""}else if(dd===0){el.classList.add("is-msg");b.textContent=o.today;s.textContent=""}else{el.style.display=o.expired?"":"none";el.classList.add("is-msg");b.textContent=o.expired||"";s.textContent=""}})}tick();setInterval(tick,60000);'
  /* animação de entrada */
  + 'var rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,els=r.querySelectorAll(".ws-reveal");'
  + 'if(!rm&&"IntersectionObserver" in window&&els.length){r.classList.add("ws-js");var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});els.forEach(function(e){io.observe(e)})}'
  /* navegação: indicador de mais conteúdo + secção atual */
  + 'var nav=r.querySelector(".ws-nav"),list=r.querySelector(".ws-nav-list");'
  + 'function fades(){if(!nav||!list)return;var sl=list.scrollLeft>4,sr=list.scrollLeft+list.clientWidth<list.scrollWidth-4;nav.classList.toggle("sl",sl);nav.classList.toggle("sr",sr)}'
  + 'if(list){list.addEventListener("scroll",fades,{passive:true});window.addEventListener("resize",fades);fades()}'
  + 'var links=r.querySelectorAll(".ws-nav a[href^=\\"#\\"]");'
  + 'if(links.length&&"IntersectionObserver" in window){var map={};links.forEach(function(a){map[a.getAttribute("href").slice(1)]=a});var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.removeAttribute("aria-current")});var a=map[e.target.id];if(a){a.setAttribute("aria-current","true");if(list&&!rm){var l=a.offsetLeft-list.clientWidth/2+a.clientWidth/2;list.scrollTo?list.scrollTo({left:l,behavior:"smooth"}):0}}}})},{rootMargin:"-45% 0px -50% 0px"});Object.keys(map).forEach(function(id){var s=d.getElementById(id);if(s)so.observe(s)})}'
  /* RSVP: colar o link do convite (nunca há pesquisa de convidados) */
  + 'var f=r.querySelector("[data-ws-paste]");if(f){f.addEventListener("submit",function(ev){ev.preventDefault();var v=(f.querySelector("input").value||"").trim(),t="";try{t=new URL(v).searchParams.get("g")||""}catch(e){}if(!t&&/^[A-Za-z0-9_-]{8,64}$/.test(v))t=v;var er=f.querySelector(".ws-paste-err");if(/^[A-Za-z0-9_-]{8,64}$/.test(t)){er.hidden=true;location.href="https://www.weddy.pt/rsvp.html?g="+encodeURIComponent(t)}else{er.hidden=false;f.querySelector("input").focus()}})}'
  + '})();';

  function sectionHtml(id, num, title, body, extraCls){
    return '<section class="ws-sec ws-reveal'+(extraCls?' '+extraCls:'')+'" id="ws-'+id+'" aria-labelledby="ws-h-'+id+'"><div class="ws-sec-in"><div class="ws-sec-head"><span class="ws-num" aria-hidden="true">'+num+'</span><h2 class="ws-h2" id="ws-h-'+id+'">'+escape(title)+'</h2></div><div class="ws-sec-body">'+body+'</div></div></section>';
  }
  function dl(pairs){
    var rows = pairs.filter(function(p){ return p[1]; }).map(function(p){ return '<div>'+(p[0]?'<dt>'+escape(p[0])+'</dt>':'')+'<dd>'+p[1]+'</dd></div>'; }).join('');
    return rows ? '<dl class="ws-dl">'+rows+'</dl>' : '';
  }
  function extLink(url, label, T){
    var u = safeUrl(url); if(!u) return '';
    return '<a href="'+escape(u)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+IC.arrow+'<span class="ws-sr" style="position:absolute;left:-9999px">('+escape(T.external)+')</span></a>';
  }

  /**
   * snap: snapshot público (ver buildPublicSiteSnapshot).  opts: { preview, token, now }
   * Devolve { css, html, script, title, description, lang }
   */
  function render(snap, opts){
    snap = snap || {}; opts = opts || {};
    var lang = snap.lang==='en' ? 'en' : 'pt';
    var T = S[lang];
    var tpl = TEMPLATES.indexOf(snap.template)>=0 ? snap.template : 'editorial';
    var pal = PALETTES[snap.palette] || PALETTES.terracota;
    var names = Array.isArray(snap.names) ? snap.names : [];
    var tz = isTz(snap.timezone) ? snap.timezone : DEFAULT_TZ;
    var sec = snap.sections || {};
    var cover = safeImg(snap.coverUrl);
    var nameArr = names.filter(Boolean);
    var NH = namesHtml(names[0]||'', names[1]||'', tpl);
    var datePretty = escape(formatDate(snap.eventDate, lang));
    var venue = (sec.location && sec.location.name) ? escape(sec.location.name) : '';
    var hasRsvp = !!sec.rsvp;
    var pos = snap.coverPos || {}; var px = isFinite(+pos.x)?Math.max(0,Math.min(100,+pos.x)):50, py = isFinite(+pos.y)?Math.max(0,Math.min(100,+pos.y)):50;

    var order = ['story','location','schedule','dresscode','lodging','faq','contact'];
    var navItems = order.filter(function(k){ return sec[k]; }).map(function(k){ return '<a href="#ws-'+k+'">'+escape(T.nav[k])+'</a>'; });

    // contagem decrescente
    var countHtml = '';
    if(snap.countdown && snap.countdown.on && snap.eventDate){
      var d = daysUntil(snap.eventDate, tz, opts.now);
      var txt = { days:T.dayWord(2), until:T.until, today:T.today, tomorrow:T.tomorrow, expired:(snap.countdown.expiredMessage||'') };
      var big, small, cls = '';
      if(d===null){ big=''; small=''; }
      else if(d>1){ big=String(d); small=T.dayWord(d)+' '+T.until; }
      else if(d===1){ big=T.tomorrow; small=''; cls=' is-msg'; }
      else if(d===0){ big=T.today; small=''; cls=' is-msg'; }
      else { big=txt.expired||''; small=''; cls=' is-msg'; }
      if(d!==null && !(d<0 && !txt.expired)){
        countHtml = '<div class="ws-count'+cls+'" data-date="'+escape(snap.eventDate)+'" data-tz="'+escape(tz)+'" data-txt="'+escape(JSON.stringify(txt))+'" role="timer" aria-live="off"><b>'+escape(big)+'</b><span>'+escape(small)+'</span></div>';
      }
    }

    // ----- hero -----
    var hero = [];
    hero.push('<header class="ws-hero'+(cover?'':' ws-nocover')+'"><div class="ws-wrap">');
    hero.push('<div class="ws-hero-text">');
    if((snap.title||'').trim()) hero.push('<p class="ws-eyebrow">'+escape(snap.title.trim())+'</p>');
    hero.push(NH.html);
    hero.push('<div class="ws-orn-wrap" aria-hidden="true">'+IC.orn+'</div>');
    if(datePretty) hero.push('<p class="ws-date"><time datetime="'+escape(snap.eventDate)+'">'+datePretty+'</time>'+(venue?'<span class="ws-dot" aria-hidden="true">·</span><span class="ws-venue">'+venue+'</span>':'')+'</p>');
    hero.push('<p class="ws-welcome">'+((snap.welcome||'').trim()?multiline(snap.welcome.trim()):escape(T.welcomeDefault))+'</p>');
    if(countHtml) hero.push(countHtml);
    if(hasRsvp) hero.push('<div class="ws-cta"><a class="ws-btn" href="#ws-rsvp">'+escape(T.rsvpBtn)+'</a></div>');
    hero.push('</div>');
    if(cover) hero.push('<figure class="ws-cover"><img src="'+escape(cover)+'" alt="'+escape(nameArr.join(' & '))+'" style="object-position:'+px+'% '+py+'%" fetchpriority="high" decoding="async"></figure>');
    else hero.push('<div class="ws-cover ws-mono" aria-hidden="true">'+initials(nameArr)+'</div>');
    hero.push('</div></header>');

    // ----- secções (conteúdo) -----
    var parts = {}, num = 0;
    function N(){ num++; return (num<10?'0':'')+num; }
    if(sec.story){
      var st = sec.story, ph = safeImg(st.photoUrl);
      parts.story = sectionHtml('story', N(), st.title||T.nav.story,
        (st.text?'<p class="ws-p">'+multiline(st.text)+'</p>':'') + (ph?'<figure class="ws-photo"><img loading="lazy" decoding="async" src="'+escape(ph)+'" alt=""></figure>':''), 'ws-sec-solo'+(ph?' ws-has-photo':''));
    }
    if(sec.location){
      var L = sec.location;
      var dirs = safeUrl(L.mapUrl);
      parts.location = sectionHtml('location', N(), T.nav.location,
        dl([[T.address, (L.name?'<strong>'+escape(L.name)+'</strong><br>':'')+multiline(L.address||'')],[T.parking, L.parking?multiline(L.parking):''],[T.notes, L.notes?multiline(L.notes):'']])
        + (dirs?'<p class="ws-cta"><a class="ws-btn is-ghost" href="'+escape(dirs)+'" target="_blank" rel="noopener noreferrer">'+IC.pin+escape(T.directions)+'</a></p>':''));
    }
    if(sec.schedule){
      var sc = sec.schedule, rows = (sc.items||[]).map(function(e){
        return '<li><time>'+escape(e.time||'')+'</time><div><span class="n">'+escape(e.label||'')+'</span>'+(e.place?'<span class="pl">'+IC.pin+escape(e.place)+'</span>':'')+'</div></li>';
      }).join('');
      parts.schedule = sectionHtml('schedule', N(), T.nav.schedule, (sc.note?'<p class="ws-muted">'+multiline(sc.note)+'</p>':'')+'<ol class="ws-tl">'+rows+'</ol>');
    }
    if(sec.dresscode){
      var dc = sec.dresscode, di = safeImg(dc.imageUrl);
      parts.dresscode = sectionHtml('dresscode', N(), dc.title||T.nav.dresscode,
        (dc.text?'<p class="ws-p">'+multiline(dc.text)+'</p>':'') + (di?'<figure class="ws-photo"><img loading="lazy" decoding="async" src="'+escape(di)+'" alt=""></figure>':''), di?'ws-has-photo':'');
    }
    if(sec.lodging){
      var lo = sec.lodging;
      var linksHtml = (lo.links||[]).map(function(l){ var a = extLink(l.url, l.label||l.url, T); return a?'<li>'+a+'</li>':''; }).join('');
      parts.lodging = sectionHtml('lodging', N(), T.navTitle.lodging,
        dl([[T.lodgingTitle, lo.lodging?multiline(lo.lodging):''],[T.transport, lo.transport?multiline(lo.transport):''],[T.parking, lo.parking?multiline(lo.parking):''],[T.meeting, lo.meeting?multiline(lo.meeting):'']])
        + (linksHtml?'<ul class="ws-links" aria-label="'+escape(T.links)+'">'+linksHtml+'</ul>':''));
    }
    if(sec.faq){
      var fq = (sec.faq.items||[]).map(function(f){ return '<details class="ws-faq"><summary>'+escape(f.q||'')+'</summary><div class="a">'+multiline(f.a||'')+'</div></details>'; }).join('');
      parts.faq = sectionHtml('faq', N(), T.navTitle.faq, fq, 'ws-sec-solo ws-sec-faq ws-sec-solo-wide');
    }
    if(sec.contact){
      var c = sec.contact;
      var mail = (typeof c.email==='string' && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.email)) ? c.email : '';
      var tel = (typeof c.phone==='string' && /^[+0-9 ()-]{6,24}$/.test(c.phone)) ? c.phone : '';
      parts.contact = sectionHtml('contact', N(), T.nav.contact,
        (c.note?'<p class="ws-p">'+multiline(c.note)+'</p>':'')
        + dl([['', c.name?'<strong>'+escape(c.name)+'</strong>':''],[T.phone, tel?'<a href="tel:'+escape(tel.replace(/[^+0-9]/g,''))+'">'+escape(tel)+'</a>':''],[T.email, mail?'<a href="mailto:'+escape(mail)+'">'+escape(mail)+'</a>':'']]), 'ws-sec-solo');
    }
    if(hasRsvp){
      var tok = (typeof opts.token==='string' && /^[A-Za-z0-9_-]{8,64}$/.test(opts.token)) ? opts.token : '';
      var rs = sec.rsvp, inner;
      var ask = sec.contact ? '<p class="ws-help">'+escape(T.rsvpAskContact)+' <a href="#ws-contact">'+escape(T.nav.contact)+'</a></p>' : '<p class="ws-help">'+escape(T.rsvpAsk)+'</p>';
      if(opts.preview){
        inner = '<p><span class="ws-btn" aria-disabled="true">'+escape(T.rsvpBtn)+'</span></p><p class="ws-help">'+escape(T.rsvpPreview)+'</p>';
      } else if(tok){
        inner = '<p class="ws-help" style="margin-top:0">'+escape(T.rsvpWelcome)+'</p><p style="margin-top:18px"><a class="ws-btn" href="https://www.weddy.pt/rsvp.html?g='+escape(tok)+'">'+escape(T.rsvpOpenWithLink)+'</a></p>';
      } else {
        inner = '<p class="ws-help" style="margin-top:0">'+escape(T.rsvpNoLink)+'</p>'
          + '<form class="ws-paste" data-ws-paste novalidate><label for="ws-paste-in">'+escape(T.rsvpPasteLabel)+'</label><div class="ws-paste-row"><input id="ws-paste-in" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+escape(T.rsvpPastePh)+'"><button type="submit" class="ws-btn">'+escape(T.rsvpPasteBtn)+'</button></div><p class="ws-paste-err" role="alert" hidden>'+escape(T.rsvpPasteErr)+'</p></form>'
          + ask;
      }
      parts.rsvp = '<section class="ws-sec ws-reveal" id="ws-rsvp" aria-labelledby="ws-h-rsvp"><div class="ws-rsvp-box"><h2 class="ws-h2" id="ws-h-rsvp">'+escape(T.nav.rsvp)+'</h2>'+(rs.text?'<p class="ws-p">'+multiline(rs.text)+'</p>':'')+inner+'</div></section>';
    }

    // ----- composição dos blocos -----
    var groups = tpl==='editorial' ? [['story'],['location'],['schedule'],['dresscode'],['lodging'],['faq'],['contact'],['rsvp']]
                                   : [['story'],['location','schedule'],['dresscode','lodging'],['faq'],['contact'],['rsvp']];
    var blocks = [];
    groups.forEach(function(g){
      var present = g.filter(function(k){ return parts[k]; });
      if(!present.length) return;
      var inner = present.map(function(k){ return parts[k]; }).join('');
      var isPair = present.length>1;
      if(isPair) inner = '<div class="ws-pair">'+inner+'</div>';
      else if(tpl!=='editorial' && present[0]!=='rsvp') inner = inner.replace('class="ws-sec ws-reveal','class="ws-sec ws-sec-solo ws-reveal');
      blocks.push('<div class="ws-block '+present.map(function(k){ return 'ws-b-'+k; }).join(' ')+'"><div class="ws-wrap">'+(tpl==='classic' && blocks.length? '<div class="ws-orn-wrap" aria-hidden="true">'+IC.orn+'</div>':'')+inner+'</div></div>');
    });

    var nav = navItems.length ? '<nav class="ws-nav sr" aria-label="'+escape(T.sections)+'"><div class="ws-nav-in"><span class="ws-nav-brand" aria-hidden="true">'+initials(nameArr)+'</span><div class="ws-nav-list">'+navItems.join('')+'</div></div></nav>' : '';
    var out = [];
    out.push('<a class="ws-skip" href="#ws-main">'+escape(T.skip)+'</a>');
    out.push(hero.join(''));
    out.push(nav);
    out.push('<main id="ws-main">'+blocks.join('')+'</main>');
    out.push('<footer class="ws-foot"><div class="ws-wrap">'+(nameArr.length?'<span class="ws-foot-names">'+escape(nameArr.join(' & '))+'</span>':'')+escape(T.by)+' <a href="https://www.weddy.pt" target="_blank" rel="noopener">Weddy</a></div></footer>');

    var accentVars = '.ws-root{ --accent:'+pal.accent+'; --dark:'+pal.dark+'; --soft:'+pal.soft+'; '+(opts.preview?'--top:26px; ':'')+'}';
    var html = '<div class="ws-root ws-t-'+tpl+'" lang="'+lang+'">'+(opts.preview?'<div class="ws-badge">'+escape(T.previewBadge)+'</div>':'')+out.join('')+'</div>';
    var nm = nameArr;
    return {
      css: CSS+'\n'+accentVars, html: html, script: SCRIPT, lang: lang,
      title: nm.join(' & ')||'Weddy',
      description: T.metaDesc(nm[0]||'', nm[1]||'', formatDate(snap.eventDate, lang))
    };
  }

  var FONTS = '<link rel="preload" href="fonts/cormorant-garamond.woff" as="font" type="font/woff" crossorigin><link rel="preload" href="fonts/manrope.woff" as="font" type="font/woff" crossorigin>';
  // Documento completo (para <iframe srcdoc> da pré-visualização).
  function buildDocument(snap, opts){
    var r = render(snap, opts);
    return '<!doctype html><html lang="'+r.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+escape(r.title)+'</title>'+FONTS+'<style>html,body{margin:0;background:#FAF8F5}'+r.css+'</style></head><body>'+r.html+'<script>'+r.script+'<\/script></body></html>';
  }

  /*BEGIN-SHARED-BUILDER*/
const SITE_LIMITS = { title: 80, welcome: 600, storyTitle: 80, story: 3000, venue: 120, address: 240, notes: 600, parking: 300, dressTitle: 80, dress: 800, lodging: 800, transport: 800, meeting: 400, faqQ: 140, faqA: 600, faqMax: 12, linksMax: 6, linkLabel: 60, contactName: 80, contactNote: 240, rsvpText: 300, scheduleNote: 240, scheduleMax: 30, expired: 160, slugMin: 3, slugMax: 40, name: 60, schedLabel: 100, schedPlace: 120 };
const SITE_TEMPLATES = ['editorial', 'classic', 'modern'];
const SITE_PALETTES = ['terracota', 'salvia', 'rosa', 'noite'];
const SITE_TIMEZONES = ['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira', 'Europe/London', 'Europe/Madrid', 'Europe/Paris'];
const SITE_RESERVED_SLUGS = ['admin', 'api', 'app', 'login', 'logout', 'premium', 'rsvp', 'site', 'c', 'assets', 'static', 'weddy', 'www', 'memorias', 'suporte', 'privacidade', 'termos', 'index', '404', 'sw', 'manifest', 'icon', 'login-bg', 'functions', 'settings', 'definicoes', 'help', 'ajuda', 'about', 'sobre', 'test', 'teste'];

function siteSlugProblem(slug) {
  if (typeof slug !== 'string' || !slug) return 'empty';
  if (slug.length < SITE_LIMITS.slugMin) return 'short';
  if (slug.length > SITE_LIMITS.slugMax) return 'long';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'chars';
  if (SITE_RESERVED_SLUGS.indexOf(slug) >= 0) return 'reserved';
  return '';
}
function siteSlugify(str) {
  let s = String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return s.slice(0, SITE_LIMITS.slugMax).replace(/-+$/, '');
}
// Texto simples: corta ao limite, remove caracteres de controlo. O HTML nunca
// é aceite como tal — o renderizador faz escape de tudo.
function siteText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function siteHttps(u) {
  if (typeof u !== 'string') return '';
  u = u.trim();
  if (u.length > 1000 || !/^https:\/\//i.test(u)) return '';
  try { const p = new URL(u); return p.protocol === 'https:' ? p.href : ''; } catch (e) { return ''; }
}
// Imagens: só do Storage deste casamento (sites/{weddingId}/...).
function siteImage(u, weddingId) {
  const s = siteHttps(u);
  if (!s) return '';
  try {
    const p = new URL(s);
    if (p.hostname !== 'firebasestorage.googleapis.com') return '';
    // /v0/b/BUCKET/o/sites%2F{weddingId}%2F{ficheiro}: o objeto tem de estar
    // DIRETAMENTE na pasta deste casamento (sem subpastas, sem "..").
    const prefix = '/o/' + encodeURIComponent('sites/' + weddingId + '/');
    const i = p.pathname.indexOf(prefix);
    if (i < 0 || !/^\/v0\/b\/[^/]+$/.test(p.pathname.slice(0, i))) return '';
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(p.pathname.slice(i + prefix.length))) return '';
    return s;
  } catch (e) { return ''; }
}
function siteValidDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + 'T12:00:00Z');
  return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}
function siteFocus(n) { n = Number(n); return isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50; }
function siteValidTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

// Constrói o snapshot público (lista branca) e devolve { snapshot, errors }.
// errors = códigos para a interface mostrar mensagens traduzidas.
function buildPublicSiteSnapshot(draft, weddingId) {
  const errors = [];
  const d = (draft && typeof draft === 'object') ? draft : {};
  const L = SITE_LIMITS;
  const src = (d.source && typeof d.source === 'object') ? d.source : {};
  const names = (Array.isArray(src.names) ? src.names : []).slice(0, 2).map((n) => siteText(n, L.name)).filter(Boolean);
  if (names.length < 2) errors.push('names');
  const date = siteValidDate(src.date) ? src.date : '';
  if (!date) errors.push('date');
  const sec = (d.sections && typeof d.sections === 'object') ? d.sections : {};
  const out = {};
  const on = (k) => sec[k] && sec[k].on === true;

  if (on('story')) {
    const s = sec.story;
    out.story = { title: siteText(s.title, L.storyTitle), text: siteText(s.text, L.story), photoUrl: siteImage(s.photoUrl, weddingId) };
    if (!out.story.text) errors.push('story_empty');
  }
  if (on('location')) {
    const s = sec.location;
    out.location = { name: siteText(s.name, L.venue), address: siteText(s.address, L.address), mapUrl: siteHttps(s.mapUrl), parking: siteText(s.parking, L.parking), notes: siteText(s.notes, L.notes) };
    if (!out.location.name && !out.location.address) errors.push('location_empty');
    if (s.mapUrl && !out.location.mapUrl) errors.push('map_url');
  }
  if (on('schedule')) {
    const items = (Array.isArray(src.schedule) ? src.schedule : []).slice(0, L.scheduleMax)
      .map((e) => ({ time: siteValidTime(e && e.time) ? e.time : '', label: siteText(e && e.label, L.schedLabel), place: siteText(e && e.place, L.schedPlace) }))
      .filter((e) => e.label);
    items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    out.schedule = { note: siteText(sec.schedule.note, L.scheduleNote), items };
    if (!items.length) errors.push('schedule_empty');
  }
  if (on('dresscode')) {
    const s = sec.dresscode;
    out.dresscode = { title: siteText(s.title, L.dressTitle), text: siteText(s.text, L.dress), imageUrl: siteImage(s.imageUrl, weddingId) };
    if (!out.dresscode.text) errors.push('dresscode_empty');
  }
  if (on('lodging')) {
    const s = sec.lodging;
    const links = (Array.isArray(s.links) ? s.links : []).slice(0, L.linksMax)
      .map((l) => ({ label: siteText(l && l.label, L.linkLabel), url: siteHttps(l && l.url) })).filter((l) => l.url);
    out.lodging = { lodging: siteText(s.lodging, L.lodging), transport: siteText(s.transport, L.transport), parking: siteText(s.parking, L.parking), meeting: siteText(s.meeting, L.meeting), links };
    if (!out.lodging.lodging && !out.lodging.transport && !out.lodging.parking && !out.lodging.meeting && !links.length) errors.push('lodging_empty');
  }
  if (on('faq')) {
    const items = (Array.isArray(sec.faq.items) ? sec.faq.items : []).slice(0, L.faqMax)
      .map((f) => ({ q: siteText(f && f.q, L.faqQ), a: siteText(f && f.a, L.faqA) })).filter((f) => f.q && f.a);
    out.faq = { items };
    if (!items.length) errors.push('faq_empty');
  }
  if (on('contact')) {
    const s = sec.contact;
    const email = siteText(s.email, 120);
    const phone = siteText(s.phone, 24);
    out.contact = {
      name: siteText(s.name, L.contactName), note: siteText(s.note, L.contactNote),
      email: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email : '',
      phone: /^[+0-9 ()-]{6,24}$/.test(phone) ? phone : ''
    };
    if (email && !out.contact.email) errors.push('contact_email');
    if (phone && !out.contact.phone) errors.push('contact_phone');
    if (!out.contact.email && !out.contact.phone) errors.push('contact_empty');
  }
  if (on('rsvp')) out.rsvp = { text: siteText(sec.rsvp.text, L.rsvpText) };

  const cd = (d.countdown && typeof d.countdown === 'object') ? d.countdown : {};
  const snapshot = {
    lang: d.lang === 'en' ? 'en' : 'pt',
    template: SITE_TEMPLATES.indexOf(d.template) >= 0 ? d.template : 'editorial',
    palette: SITE_PALETTES.indexOf(d.palette) >= 0 ? d.palette : 'terracota',
    names,
    eventDate: date,
    timezone: SITE_TIMEZONES.indexOf(d.timezone) >= 0 ? d.timezone : 'Europe/Lisbon',
    title: siteText(d.title, L.title),
    welcome: siteText(d.welcome, L.welcome),
    coverUrl: siteImage(d.coverUrl, weddingId),
    coverPos: { x: siteFocus(d.coverX), y: siteFocus(d.coverY) },
    countdown: { on: cd.on === true, expiredMessage: siteText(cd.expiredMessage, L.expired) },
    sections: out
  };
  return { snapshot, errors };
}

/*END-SHARED-BUILDER*/

  root.WeddySite = {
    render: render, buildDocument: buildDocument, escape: escape, safeUrl: safeUrl, safeImg: safeImg,
    buildSnapshot: buildPublicSiteSnapshot, siteSlugProblem: siteSlugProblem, siteLimits: SITE_LIMITS, siteSlugify: siteSlugify,
    slugify: slugify, slugProblem: slugProblem, daysUntil: daysUntil, formatDate: formatDate, canonicalSource: canonicalSource,
    TEMPLATES: TEMPLATES, PALETTES: PALETTES, TIMEZONES: TIMEZONES, RESERVED_SLUGS: RESERVED_SLUGS, STRINGS: S, FONTS: FONTS, DEFAULT_TZ: DEFAULT_TZ, isTz: isTz
  };
})(typeof window!=='undefined' ? window : globalThis);
