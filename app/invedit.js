/* Weddy Invitations — editor visual (página própria, ecrã inteiro).
   O convite real (mesmo motor da página pública, modo 'edit') fica sempre visível ao lado dos campos.
   Fonte de verdade: convites8/schema.js (secções, títulos, fotografias, obrigatórias/ocultáveis de cada modelo).
   Ligação à app por um adaptador (open(adapter)); sem dependências novas. Não grava nada por si: escreve no rascunho e pede ao adaptador para o guardar. */
(function(root){
  'use strict';
  var A = null, st = null, el = null, tmr = 0, mq = null, ro = null;
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var W = function(pt,en){ return A && A.lang==='en' ? en : pt; };
  var SCH = function(){ return root.WeddyInviteSchema.SCHEMA[A.draft().tpl] || null; };
  var L = function(a){ return A.lang==='en' ? a[1] : a[0]; };
  var CSS = [
  '.ied{position:fixed;inset:0;z-index:9000;background:#FAF8F5;color:#2B2522;font:14px/1.5 "Jost",system-ui,sans-serif;display:flex;flex-direction:column}',
  '.ied *{box-sizing:border-box}',
  '.ied-top{display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) calc(18px + env(safe-area-inset-right,0px)) 10px calc(18px + env(safe-area-inset-left,0px));border-bottom:1px solid #E6DCD4;background:#FAF8F5;flex:none}',
  '.ied-back{border:0;background:none;color:#6b5d4f;font:500 13px/1 inherit;cursor:pointer;padding:8px 4px}',
  '.ied-ttl{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}.ied-ttl b{font:600 20px/1.1 "Cormorant Garamond",Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.ied-st{font-size:12px;color:#7b6d5d}.ied-st.pend{color:#9a5b2e}',
  '.ied-saved{font-size:12px;color:#7b6d5d;white-space:nowrap}',
  '.ied-btn{border:1px solid #2B2522;background:#2B2522;color:#FAF8F5;border-radius:99px;padding:10px 18px;font:500 13px/1 inherit;cursor:pointer;white-space:nowrap}',
  '.ied-btn.ghost{background:transparent;color:#2B2522}.ied-btn:disabled{opacity:.4;cursor:default}',
  '.ied-body{flex:1;min-height:0;display:grid;grid-template-columns:380px 1fr}',
  '.ied-panel{overflow:auto;padding:18px 20px 40px;border-right:1px solid #E6DCD4;background:#FDFBF8}',
  '.ied-prev{display:flex;flex-direction:column;min-width:0;min-height:0;background:#EFE9E1}',
  '.ied-pbar{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;flex:none}',
  '.ied-seg{border:1px solid #cdbfae;background:transparent;color:#4a3f35;border-radius:99px;padding:6px 14px;font:500 12px/1 inherit;cursor:pointer}.ied-seg[aria-pressed=true]{background:#2B2522;color:#FAF8F5;border-color:#2B2522}',
  '.ied-stage{flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start;padding:0 12px 16px;overflow:hidden}',
  '.ied-dev{position:relative;border-radius:34px;background:#1d1916;padding:10px;box-shadow:0 18px 40px rgba(43,37,34,.25)}.ied-dev.desk{border-radius:14px;padding:8px}',
  '.ied-scr{overflow:hidden;border-radius:26px;background:#fff;position:relative}.ied-dev.desk .ied-scr{border-radius:8px}',
  '.ied-ifr{border:0;display:block;transform-origin:top left;background:#fff}',
  '.ied-h{font:600 24px/1.15 "Cormorant Garamond",Georgia,serif;margin:2px 0 4px}.ied-sub{color:#7b6d5d;font-size:13px;margin:0 0 14px}',
  '.ied-sec{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid #EAE1D8;background:none;padding:11px 2px;cursor:pointer;font:inherit;color:inherit}',
  '.ied-sec:hover{background:#f6f1ea}.ied-sec.on{background:#f1eadf}',
  '.ied-sec>span:first-child{flex:1;min-width:0}.ied-sec b{font-weight:500;display:block;font-size:14px}',
  '.ied-chip{font-size:11px;letter-spacing:.02em;border-radius:99px;padding:2px 9px;border:1px solid #d8ccbd;color:#6b5d4f;white-space:nowrap}',
  '.ied-chip.ok{color:#586338;border-color:#b9c29a;background:#f3f5ea}.ied-chip.empty{color:#8a6a3f;border-color:#e0cfae;background:#fbf4e5}.ied-chip.req{color:#4a3f35}.ied-chip.off{color:#8c8378;border-style:dashed}',
  '.ied-tog{width:38px;height:22px;border-radius:99px;border:0;background:#cfc5b8;position:relative;cursor:pointer;flex:none;padding:0}.ied-tog::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.ied-tog[aria-checked=true]{background:#6f7c45}.ied-tog[aria-checked=true]::after{left:19px}',
  '.ied-hidhead{margin:20px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7b6d5d}',
  '.ied-in{width:100%;border:1px solid #d8ccbd;border-radius:10px;background:#fff;padding:10px 12px;font:inherit;color:inherit}textarea.ied-in{min-height:84px;resize:vertical}.ied-in:focus{outline:2px solid #b9c29a;outline-offset:1px}',
  '.ied-f{display:block;margin:0 0 14px}.ied-f>span{display:flex;justify-content:space-between;font-size:12px;color:#6b5d4f;margin-bottom:5px}.ied-f small{color:#9a8f82}',
  '.ied-where{display:inline-block;font-size:12px;color:#586338;background:#f3f5ea;border:1px solid #b9c29a;border-radius:99px;padding:2px 10px;margin:0 0 14px}',
  '.ied-box{border:1px solid #E6DCD4;border-radius:14px;padding:12px;margin:0 0 14px;background:#fff}',
  '.ied-link{border:0;background:none;color:#6b5d4f;text-decoration:underline;cursor:pointer;font:inherit;padding:2px 0}',
  '.ied-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.ied-row .ied-in{flex:1;min-width:0}.ied-row .ied-in.t{flex:0 0 96px}',
  '.ied-ph{display:flex;gap:12px;align-items:flex-start}.ied-thumb{position:relative;width:104px;flex:none;border-radius:10px;overflow:hidden;background:#efe7da;border:1px dashed #a89684;cursor:crosshair;touch-action:none}.ied-thumb img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}.ied-thumb i{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);pointer-events:none}',
  '.ied-ph .b{flex:1;min-width:0;font-size:12px;color:#6b5d4f}.ied-ph .b p{margin:0 0 8px}',
  '.ied-warn{border-top:1px solid #E6DCD4;margin-top:22px;padding-top:12px;font-size:12.5px;color:#7a5a2c}.ied-warn p{margin:4px 0}.ied-err{color:#9a2f2f}',
  '.ied-mbar{display:none}',
  '@media (max-width:899px){',
  ' .ied-body{grid-template-columns:1fr;grid-template-rows:42% 1fr}.ied-body.view{grid-template-rows:1fr 0}.ied-body.view .ied-panel{display:none}',
  ' .ied-panel{border-right:0;border-top:1px solid #E6DCD4;border-radius:18px 18px 0 0;box-shadow:0 -8px 20px rgba(43,37,34,.08);padding-bottom:90px}',
  ' .ied-prev{order:-1}.ied-pbar{display:none}.ied-stage{padding:8px 8px 0}.ied-body.view{padding-bottom:calc(74px + env(safe-area-inset-bottom,0px));box-sizing:border-box}',
  ' .ied-mbar{display:flex;gap:8px;position:fixed;left:0;right:0;bottom:0;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));background:#FAF8F5;border-top:1px solid #E6DCD4;z-index:2}.ied-mbar .ied-btn{flex:1;text-align:center}',
  ' .ied-top{padding:calc(8px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) 8px calc(12px + env(safe-area-inset-left,0px));gap:8px}.ied-saved{display:none}.ied-ttl b{font-size:17px}',
  '}'
  ].join('\n');

  /* ---------- dados ---------- */
  var FIELD = {
    names:{l:['Nomes dos noivos','Couple names'],k:'text',max:60}, date:{l:['Data do casamento','Wedding date'],k:'date'}, time:{l:['Hora','Time'],k:'time'},
    venue:{l:['Local principal','Main venue'],k:'text',max:120}, address:{l:['Morada ou localidade','Address or town'],k:'text',max:240},
    intro:{l:['Frase de abertura','Opening line'],k:'area',max:200}, mono:{l:['Monograma (iniciais)','Monogram (initials)'],k:'text',max:8},
    message:{l:['Mensagem','Message'],k:'area',max:300}, quote:{l:['Citação','Quote'],k:'area',max:200}, story:{l:['A vossa história','Your story'],k:'area',max:400},
    parents:{l:['Pais e padrinhos (uma linha por nome)','Parents and godparents (one per line)'],k:'area',max:200}, kids:{l:['Informação sobre crianças','Children'],k:'area',max:300},
    dress:{l:['Dress code','Dress code'],k:'area',max:300}, gifts:{l:['Texto sobre presentes','Gifts text'],k:'area',max:300}, giftUrl:{l:['Ligação da lista de presentes (https://…)','Gift list link (https://…)'],k:'url'},
    hotel:{l:['Alojamento sugerido','Suggested accommodation'],k:'text',max:120}, hotelUrl:{l:['Ligação do alojamento (https://…)','Accommodation link (https://…)'],k:'url'},
    hash:{l:['Hashtag','Hashtag'],k:'text',max:40}, org:{l:['Nome do organizador','Organiser name'],k:'text',max:100}, orgTel:{l:['Telefone do organizador','Organiser phone'],k:'tel',max:20},
    flowers:{l:['Flores (cores e preferências)','Flowers'],k:'area',max:200},
    dressF:{l:['Texto para as senhoras (vazio = texto original)','Text for the ladies (empty = original text)'],k:'area',max:200}, dressM:{l:['Texto para os senhores (vazio = texto original)','Text for the gentlemen (empty = original text)'],k:'area',max:200},
    thanks:{l:['Texto de agradecimento (vazio = texto original)','Thank-you text (empty = original text)'],k:'area',max:240}
  };
  function get(k){ return A.draft()[k]; }
  function setv(k, v){ A.draft()[k] = v; touch(); }
  function touch(){ A.save(); markSaved(); schedule(); }
  function markSaved(){ var s = el && el.querySelector('.ied-saved'); if(s) s.textContent = W('Guardado','Saved'); }
  function empty(v){ if(v==null) return true; if(typeof v==='string') return !v.trim(); if(Array.isArray(v)) return !v.some(function(x){ return !empty(x); }); if(typeof v==='object') return !Object.keys(v).some(function(k){ return !empty(v[k]); }); return false; }
  function hidden(){ var d = A.draft(); return Array.isArray(d.hiddenSections) ? d.hiddenSections : []; }
  function setSlotUrl(slot, url){ var d = A.draft(); d.photos = d.photos && typeof d.photos==='object' ? d.photos : {}; if(!Array.isArray(d.photos.gallery)) d.photos.gallery = []; if(slot==='cover') d.photos.cover = url; else { var k = +slot.slice(1); while(d.photos.gallery.length<=k) d.photos.gallery.push(''); d.photos.gallery[k] = url; } }
  function swapSlots(a, b){ var d = A.draft(), ua = slotUrl(a), ub = slotUrl(b); setSlotUrl(a, ub); setSlotUrl(b, ua);
    var f = d.photoFocus && typeof d.photoFocus==='object' ? d.photoFocus : {}, fa = f[a], fb = f[b]; delete f[a]; delete f[b]; if(fb) f[a] = fb; if(fa) f[b] = fa; d.photoFocus = f; touch(); }
  function slotUrl(slot){ var p = A.draft().photos || {}; return slot==='cover' ? (p.cover||'') : ((p.gallery||[])[+slot.slice(1)]||''); }
  function hasContent(s){
    if(s.obrig || s.edicao==='fixo') return true;
    if(s.edicao==='foto') return s.fotos.some(function(f){ return !!slotUrl(f); });
    var d = A.draft(); return s.campos.some(function(k){ if(k==='opt'||k==='dcol') return false; return !empty(d[k]); }) || s.fotos.some(function(f){ return !!slotUrl(f); });
  }
  function chip(s){
    if(s.obrig) return '<span class="ied-chip req">'+W('Obrigatória','Required')+'</span>';
    if(hidden().indexOf(s.id)>=0) return '<span class="ied-chip off">'+W('Oculta','Hidden')+'</span>';
    return hasContent(s) ? '<span class="ied-chip ok">'+W('Visível','Visible')+'</span>' : '<span class="ied-chip empty">'+W('Sem conteúdo','No content')+'</span>';
  }

  /* ---------- painel: lista de secções ---------- */
  function listView(){
    var sch = SCH(), h = '', hid = hidden(), vis = [], off = [];
    sch.secoes.forEach(function(s){ (hid.indexOf(s.id)>=0 && s.ocultavel ? off : vis).push(s); });
    h += '<h3 class="ied-h">'+W('O vosso convite','Your invitation')+'</h3><p class="ied-sub">'+W('Escolham uma secção para a editar. O convite à direita mostra cada alteração.','Choose a section to edit. The invitation shows every change.')+'</p>';
    vis.forEach(function(s){ h += secRow(s); });
    if(off.length){ h += '<div class="ied-hidhead">'+W('Secções ocultas','Hidden sections')+' ('+off.length+')</div>'; off.forEach(function(s){ h += secRow(s); }); }
    h += footer();
    return h;
  }
  function secRow(s){
    var on = hidden().indexOf(s.id)<0;
    return '<div class="ied-sec'+(st.sec===s.id?' on':'')+'" role="button" tabindex="0" data-sec="'+s.id+'"><span><b>'+esc(L(s.nome))+'</b></span>'+chip(s)+
      (s.ocultavel ? '<button type="button" class="ied-tog" role="switch" aria-checked="'+on+'" aria-label="'+esc(W('Mostrar secção ','Show section ')+L(s.nome))+'" data-tog="'+s.id+'"></button>' : '')+'</div>';
  }
  function footer(){
    var c = A.cfg(), pr = A.problems(c), wa = warnings();
    var h = '<div class="ied-warn" aria-live="polite">';
    pr.forEach(function(p){ h += '<p class="ied-err">'+esc(p)+'</p>'; });
    wa.forEach(function(p){ h += '<p>'+esc(p)+'</p>'; });
    if(!pr.length && !wa.length) h += '<p>'+W('Tudo em ordem para publicar.','Everything is ready to publish.')+'</p>';
    return h+'</div>';
  }
  function warnings(){
    var w = A.warnings().slice(), sch = SCH(), hid = hidden();
    sch.secoes.forEach(function(s){ if(!s.obrig && s.edicao!=='fixo' && hid.indexOf(s.id)<0 && s.so && !hasContent(s)) w.push(L(s.nome)+': '+W('está vazia e não vai aparecer.','is empty and will not appear.')); });
    if(sch.capaObrig && !slotUrl('cover')) w.push(W('Este modelo precisa de uma fotografia de capa.','This design needs a cover photo.'));
    return w;
  }

  /* ---------- painel: detalhe de uma secção ---------- */
  function detailView(s){
    var h = '<button type="button" class="ied-link" data-back>‹ '+W('Todas as secções','All sections')+'</button><h3 class="ied-h">'+esc(L(s.nome))+'</h3>';
    h += '<span class="ied-where">'+W('Aparece em: ','Appears in: ')+esc(L(s.nome))+'</span>';
    if(s.titulo){ var T = (A.draft().titles||{})[s.id]||''; h += '<div class="ied-box"><label class="ied-f" style="margin:0"><span>'+W('Título da secção','Section title')+' <small>'+W('original: ','original: ')+esc(L(s.titulo))+'</small></span><input class="ied-in" maxlength="40" data-title="'+s.id+'" value="'+esc(T)+'" placeholder="'+esc(L(s.titulo))+'"></label><button type="button" class="ied-link" data-retitle="'+s.id+'">'+W('Repor título','Reset title')+'</button></div>'; }
    if(s.ocultavel){ var on = hidden().indexOf(s.id)<0; h += '<div class="ied-row" style="justify-content:space-between"><span>'+W('Mostrar esta secção','Show this section')+'</span><button type="button" class="ied-tog" role="switch" aria-checked="'+on+'" aria-label="'+esc(W('Mostrar secção','Show section'))+'" data-tog="'+s.id+'"></button></div>'; }
    else h += '<p class="ied-sub">'+W('Esta secção é essencial e não pode ser ocultada.','This section is essential and cannot be hidden.')+'</p>';
    if(s.edicao==='fixo' && !s.campos.length && !s.fotos.length) h += '<p class="ied-sub">'+W('O conteúdo desta secção é automático (a partir da data do casamento).','This section is automatic (from the wedding date).')+'</p>';
    s.campos.forEach(function(k){ h += control(k, s); });
    s.fotos.forEach(function(sl){ var f = SCH().fotos.filter(function(x){ return x.slot===sl; })[0]; if(f) h += photoBox(f); });
    return h;
  }
  function control(k, s){
    var d = A.draft(), f = FIELD[k], mx = (s.max && s.max[k]) || (f && f.max) || 200;
    if(k==='tips') return qa(k, s);
    if(k==='program') return programBox();
    if(k==='cer' || k==='rec') return eventBox(k);
    if(k==='song') return songBox(s);
    if(k==='opt') return optBox();
    if(k==='dcol') return dcolBox();
    if(!f) return '';
    var v = d[k]||'', lab = '<span>'+esc(L(f.l))+(f.k==='area'||f.k==='text' ? ' <small data-count="'+k+'">'+String(v).length+'/'+mx+'</small>' : '')+'</span>';
    if(f.k==='area') return '<label class="ied-f">'+lab+'<textarea class="ied-in" maxlength="'+mx+'" data-f="'+k+'">'+esc(v)+'</textarea></label>';
    return '<label class="ied-f">'+lab+'<input class="ied-in" type="'+(f.k==='url'?'url':f.k)+'" '+(f.k==='text'||f.k==='tel'||f.k==='url'?'maxlength="'+(f.k==='url'?300:mx)+'"':'')+' data-f="'+k+'" value="'+esc(v)+'"'+(f.k==='url'?' placeholder="https://"':'')+'></label>';
  }
  function eventBox(k){
    var d = A.draft(), e = d[k] && typeof d[k]==='object' ? d[k] : {}, nm = k==='cer' ? W('Cerimónia','Ceremony') : W('Receção','Reception');
    var dn = k==='cer' ? W('Cerimónia religiosa','Religious ceremony') : W('Receção','Reception');
    return '<div class="ied-box"><b>'+nm+'</b>'+
      '<label class="ied-f" style="margin-top:8px"><span>'+W('Título (tipo de cerimónia)','Title (type of event)')+' <small>'+W('original: ','original: ')+esc(dn)+'</small></span><input class="ied-in" maxlength="40" data-ev="'+k+'.n" value="'+esc(e.n||'')+'" placeholder="'+esc(dn)+'"></label>'+
      '<label class="ied-f"><span>'+W('Hora','Time')+'</span><input class="ied-in" type="time" data-ev="'+k+'.t" value="'+esc(e.t||'')+'"></label>'+
      '<label class="ied-f"><span>'+W('Nome do local','Venue name')+'</span><input class="ied-in" maxlength="80" data-ev="'+k+'.p" value="'+esc(e.p||'')+'"></label>'+
      '<label class="ied-f" style="margin:0"><span>'+W('Morada (o botão do mapa usa-a)','Address (used by the map button)')+'</span><input class="ied-in" maxlength="120" data-ev="'+k+'.a" value="'+esc(e.a||'')+'"></label></div>';
  }
  function programBox(){
    var p = A.draft().program || [], h = '<div class="ied-box"><b>'+W('Momentos do dia','Moments of the day')+'</b><div style="margin-top:8px">';
    p.forEach(function(m,i){ h += '<div class="ied-row"><input class="ied-in t" type="time" data-pg="'+i+'.t" value="'+esc(m.t||'')+'" aria-label="'+W('Hora','Time')+'"><input class="ied-in" maxlength="80" data-pg="'+i+'.d" value="'+esc(m.d||'')+'" aria-label="'+W('Momento','Moment')+'"><button type="button" class="ied-link" data-pgdel="'+i+'" aria-label="'+W('Remover','Remove')+'">✕</button></div>'; });
    if(p.length<12) h += '<button type="button" class="ied-link" data-pgadd>+ '+W('Acrescentar momento','Add moment')+'</button>';
    return h+'</div></div>';
  }
  function qa(k, s){
    var lines = String(A.draft()[k]||'').split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){ var m = l.match(/^([^:]{2,28}):\s*(.+)$/); return m ? [m[1],m[2]] : ['',l]; });
    var faq = s.id==='perguntas', h = '<div class="ied-box"><b>'+(faq ? W('Perguntas e respostas','Questions and answers') : W('Recomendações','Tips'))+'</b><div style="margin-top:8px">';
    lines.forEach(function(x,i){ h += '<div class="ied-row" style="align-items:flex-start"><div style="flex:1;min-width:0"><input class="ied-in" maxlength="28" data-qa="'+i+'.q" value="'+esc(x[0])+'" placeholder="'+(faq?W('Pergunta','Question'):W('Título (ex.: Estacionamento)','Title (e.g. Parking)'))+'" style="margin-bottom:6px"><input class="ied-in" maxlength="120" data-qa="'+i+'.a" value="'+esc(x[1])+'" placeholder="'+(faq?W('Resposta','Answer'):W('Texto','Text'))+'"></div><button type="button" class="ied-link" data-qadel="'+i+'">✕</button></div>'; });
    if(lines.length<6) h += '<button type="button" class="ied-link" data-qaadd>+ '+(faq?W('Acrescentar pergunta','Add question'):W('Acrescentar recomendação','Add tip'))+'</button>';
    return h+'</div></div>';
  }
  function songMsg(u){ u = String(u||'').trim(); if(!u) return ''; return root.WeddyInvite.safeUrl(u) ? '' : W('Ligação inválida: tem de começar por https://. Enquanto não estiver correta, a música não aparece no convite.','Invalid link: it must start with https://. Until it is correct the music will not appear.'); }
  function songBox(s){
    var so = A.draft().song && typeof A.draft().song==='object' ? A.draft().song : {t:'',a:'',u:''};
    var note = A.draft().tpl==='w-monograma' ? '<p class="ied-sub" style="margin-top:8px">'+W('Neste modelo a música aparece como botão de reprodução quando existe ligação.','In this design the music appears as a play button when there is a link.')+'</p>' : '';
    var mono = A.draft().tpl==='w-monograma';
    return '<div class="ied-box">'+(mono ? '' : '<label class="ied-f"><span>'+W('Título da música','Song title')+'</span><input class="ied-in" maxlength="80" data-song="t" value="'+esc(so.t||'')+'"></label>'+
      '<label class="ied-f"><span>'+W('Artista','Artist')+'</span><input class="ied-in" maxlength="80" data-song="a" value="'+esc(so.a||'')+'"></label>')+
      '<label class="ied-f"><span>'+W('Ligação (Spotify, YouTube, Apple Music, SoundCloud ou ficheiro de áudio)','Link (Spotify, YouTube, Apple Music, SoundCloud or audio file)')+'</span><input class="ied-in" type="url" maxlength="300" data-song="u" value="'+esc(so.u||'')+'" placeholder="https://"></label><p class="ied-warn" data-songmsg style="margin:-6px 0 10px;font-size:12px">'+songMsg(so.u)+'</p>'+
      '<p class="ied-sub" style="margin:0 0 8px">'+W('A música nunca toca sozinha: quem recebe o convite carrega para ouvir. A Weddy não aloja músicas.','Music never plays by itself: guests tap to listen. Weddy does not host music.')+'</p>'+
      '<button type="button" class="ied-link" data-songdel>'+W('Remover música','Remove music')+'</button>'+note+'</div>';
  }
  function optBox(){
    var defs = (root.WeddyInvite.OPTS||{})[A.draft().tpl]; if(!defs || !defs.length) return '';
    var d = A.draft(); d.opt = d.opt || {}; var h = '';
    defs.forEach(function(o){ if(o.t==='sel'){ h += '<label class="ied-f"><span>'+esc(A.lang==='en'?o.l.en:o.l.pt)+'</span><select class="ied-in" data-opt="'+o.k+'">'+o.v.map(function(v){ var lab = o.vl && o.vl[v] ? (A.lang==='en'?o.vl[v].en:o.vl[v].pt) : v; return '<option value="'+esc(v)+'"'+((d.opt[o.k]||o.d)===v?' selected':'')+'>'+esc(lab)+'</option>'; }).join('')+'</select></label>'; } });
    return h;
  }
  function dcolBox(){
    var cols = (A.draft().dcol && A.draft().dcol.length ? A.draft().dcol : []).slice(0,5), h = '<div class="ied-box"><b>'+W('Paleta do dress code','Dress code palette')+'</b><div class="ied-row" style="margin-top:8px;flex-wrap:wrap">';
    for(var i=0;i<5;i++) h += '<input type="color" data-dcol="'+i+'" value="'+esc(cols[i]||'#d9cdb4')+'" aria-label="'+W('Cor ','Colour ')+(i+1)+'" style="width:42px;height:42px;border:0;padding:0;background:none">';
    return h+'</div><button type="button" class="ied-link" data-dcolclear>'+W('Usar cores do modelo','Use design colours')+'</button></div>';
  }
  function photoBox(f){
    var u = slotUrl(f.slot), foc = (A.draft().photoFocus||{})[f.slot] || {x:50,y:50}, ratio = f.prop.split(':'), pad = (+ratio[1]/+ratio[0]*100).toFixed(1);
    var h = '<div class="ied-box" data-slotbox="'+f.slot+'"><b>'+esc(L(f.uso))+(f.obrig?' <small>('+W('obrigatória','required')+')</small>':'')+'</b><div class="ied-ph" style="margin-top:8px">';
    h += '<div class="ied-thumb" data-focus="'+f.slot+'" style="aspect-ratio:'+ratio[0]+'/'+ratio[1]+'">'+(u?'<img src="'+esc(u)+'" alt="" style="object-position:'+foc.x+'% '+foc.y+'%"><i style="left:'+foc.x+'%;top:'+foc.y+'%"></i>':'<span style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:11px;color:#7b6d5d;padding:6px">'+W('Adicione a vossa foto','Add your photo')+'</span>')+'</div>';
    h += '<div class="b"><p>'+W('Proporção ','Ratio ')+f.prop+' · '+W('recomendado ','recommended ')+esc(f.rec)+'</p>';
    h += '<label class="ied-btn ghost" style="display:inline-block;padding:8px 14px">'+(st.busy===f.slot?'…':(u?W('Substituir','Replace'):W('Carregar fotografia','Upload photo')))+'<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-up="'+f.slot+'"></label>';
    if(u && !f.obrig) h += ' <button type="button" class="ied-link" data-phdel="'+f.slot+'">'+W('Remover','Remove')+'</button>';
    var opts = SCH().fotos.filter(function(x){ return x.slot!==f.slot && (slotUrl(x.slot) || (!f.obrig && u)) && !(x.obrig && !u); });
    if(u && opts.length) h += '<label class="ied-f" style="margin:10px 0 0"><span>'+W('Trocar de lugar com…','Swap places with…')+'</span><select class="ied-in" data-swap="'+f.slot+'"><option value="">—</option>'+opts.map(function(x){ return '<option value="'+x.slot+'">'+esc(L(x.uso))+(slotUrl(x.slot)?'':' ('+W('vazio','empty')+')')+'</option>'; }).join('')+'</select></label>';
    if(u) h += '<p style="margin:8px 0 0">'+W('Toquem no ponto mais importante da fotografia para a enquadrar.','Tap the most important point of the photo to frame it.')+'</p>';
    return h+'</div></div></div>';
  }

  /* ---------- pré-visualização (convite real, modo editor) ---------- */
  function schedule(){ clearTimeout(tmr); tmr = setTimeout(refresh, 320); refreshChips(); }
  function refreshChips(){ if(!el) return; if(!st.sec){ var p = el.querySelector('.ied-panel'); if(p && !p.contains(document.activeElement)) p.innerHTML = listView(); } }
  function docOf(){ var f = el && el.querySelector('.ied-ifr'); try{ return f && f.contentDocument; }catch(e){ return null; } }
  var lastCss = '';
  function build(){
    var cfg = A.cfg(), p = root.WeddyInvite.page(cfg, { mode:'edit' });
    var noAnim = '<style id="ed-na">*{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}html,body{overflow-x:hidden;max-width:100%}</style><style id="ed-hl"></style>';
    var body = p.html.replace('class="wv-chk"','class="wv-chk" checked');
    return { css:p.css, bodyStyle:p.bodyStyle, body:body, lang:cfg.lang, head:noAnim };
  }
  function refresh(){
    if(!el) return; var f = el.querySelector('.ied-ifr'); if(!f) return; var b = build(), d = docOf();
    var sig = b.css + '|' + b.bodyStyle;
    if(d && d.body && sig===lastCss){ var y = d.defaultView ? d.defaultView.scrollY : 0; d.body.innerHTML = b.body; try{ d.defaultView.scrollTo(0,y); }catch(e){} hl(); return; }
    lastCss = sig;
    f.srcdoc = '<!doctype html><html lang="'+b.lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+b.css+'</style>'+b.head+'</head><body style="'+esc(b.bodyStyle)+'">'+b.body+'</body></html>';
  }
  function hl(){ var d = docOf(); if(!d) return; var s = d.getElementById('ed-hl'); if(s) s.textContent = st.sec ? '[data-wsec="'+st.sec+'"]{outline:2px dashed #8a5a3c;outline-offset:-4px}' : ''; }
  function reveal(id){
    var d = docOf(); if(!d) return; var t = d.querySelector('[data-wsec="'+id+'"]');
    if(!t && id==='capa'){ hl(); try{ d.defaultView.scrollTo({ top:0, behavior:'smooth' }); }catch(e){ d.defaultView.scrollTo(0,0); } return; } if(!t){ var s = root.WeddyInviteSchema.SCHEMA[A.draft().tpl].secoes.filter(function(x){ return x.id===id; })[0]; if(s && s.chunk) t = d.querySelector('[data-wsec="'+s.chunk+'"]'); }
    hl(); if(t && t.scrollIntoView) t.scrollIntoView({ block:'center', behavior:'smooth' });
  }
  function fit(){
    if(!el) return; var stg = el.querySelector('.ied-stage'), dev = el.querySelector('.ied-dev'), scr = el.querySelector('.ied-scr'), f = el.querySelector('.ied-ifr'); if(!stg||!dev||!f) return;
    var desk = st.device==='desk', dw = desk ? 1100 : 390, pad = desk ? 16 : 20, aw = stg.clientWidth-24, ah = stg.clientHeight-22;
    var k = Math.min(aw/(dw+pad), ah/((desk?700:844)+pad), 1.2); if(!isFinite(k)||k<=0) return;
    var sh = Math.floor(ah/k - pad); scr.style.width = (dw*k)+'px'; scr.style.height = (sh*k)+'px'; f.style.width = dw+'px'; f.style.height = sh+'px'; f.style.transform = 'scale('+k+')';
    dev.className = 'ied-dev'+(desk?' desk':'');
  }
  function bindFrame(){
    var f = el.querySelector('.ied-ifr'); f.addEventListener('load', function(){
      var d = docOf(); if(!d) return; hl();
      d.addEventListener('click', function(e){
        var t = e.target && e.target.closest ? e.target : null; if(!t) return; e.preventDefault();
        var s = t.closest('[data-wsec]'), p = t.closest('[data-wslot]');
        if(p){ var slot = p.getAttribute('data-wslot'); var sch = SCH(); var owner = sch.secoes.filter(function(x){ return x.fotos.indexOf(slot)>=0; })[0]; if(owner){ select(owner.id, false); var bx = el.querySelector('[data-slotbox="'+slot+'"]'); if(bx && bx.scrollIntoView) bx.scrollIntoView({block:'nearest'}); return; } }
        if(s){ var id = s.getAttribute('data-wsec'); if(id==='fim') id = 'recomendacoes'; select(id, false); return; }
        select('capa', false);
      }, true);
    });
  }

  /* ---------- navegação ---------- */
  function select(id, scroll){
    st.sec = id || ''; var p = el.querySelector('.ied-panel'), s = id ? root.WeddyInviteSchema.schemaSec(A.draft().tpl, id) : null;
    p.innerHTML = s ? detailView(s) : listView(); p.scrollTop = 0;
    if(id && scroll!==false) reveal(id); else hl();
    el.querySelector('.ied-body').classList.remove('view');
    var tg = el.querySelector('[data-mtoggle]'); if(tg) tg.textContent = W('Ver convite inteiro','View full invitation');
  }
  function statusHtml(){ var s = A.status(); return s.published ? (s.pending ? '<span class="ied-st pend">'+W('A editar alterações · o convite público não muda até publicarem','Editing changes · the public invitation stays the same until you publish')+'</span>' : '<span class="ied-st">'+W('Publicado · sem alterações por publicar','Published · no unpublished changes')+'</span>') : '<span class="ied-st">'+W('Rascunho · ainda não publicado','Draft · not published yet')+'</span>'; }
  function shell(){
    var sch = SCH(), nm = L(sch.nome);
    return '<style>'+CSS+'</style><div class="ied-top"><button type="button" class="ied-back" data-close>‹ '+W('Convites digitais','Digital invitations')+'</button><div class="ied-ttl"><b>'+esc(nm)+'</b>'+statusHtml()+'</div><span class="ied-saved" role="status"></span>'+
      (A.status().published ? '<button type="button" class="ied-btn ghost" data-seepub>'+W('Ver convite publicado','View published')+'</button>' : '')+'<button type="button" class="ied-btn" data-publish>'+W('Rever e publicar','Review and publish')+'</button></div>'+
      '<div class="ied-body"><aside class="ied-panel" aria-label="'+W('Editar convite','Edit invitation')+'"></aside><section class="ied-prev"><div class="ied-pbar"><button type="button" class="ied-seg" data-dev="phone" aria-pressed="'+(st.device==='phone')+'">'+W('Telemóvel','Phone')+'</button><button type="button" class="ied-seg" data-dev="desk" aria-pressed="'+(st.device==='desk')+'">'+W('Computador','Computer')+'</button></div><div class="ied-stage"><div class="ied-dev"><div class="ied-scr"><iframe class="ied-ifr" title="'+esc(W('Pré-visualização do convite','Invitation preview'))+'" sandbox="allow-same-origin"></iframe></div></div></div></section></div>'+
      '<div class="ied-mbar"><button type="button" class="ied-btn ghost" data-mtoggle>'+W('Ver convite inteiro','View full invitation')+'</button><button type="button" class="ied-btn" data-publish>'+W('Rever e publicar','Review and publish')+'</button></div>';
  }

  /* ---------- eventos ---------- */
  function onClick(e){
    var t = e.target.closest ? e.target : null; if(!t) return;
    if(t.closest('[data-close]')){ close(); return; }
    if(t.closest('[data-publish]')){ var c = A.cfg(); if(A.problems(c).length){ select('', false); var p = el.querySelector('.ied-warn'); if(p && p.scrollIntoView) p.scrollIntoView({block:'center'}); return; } var a = A; close(true); a.publish(); return; }
    if(t.closest('[data-seepub]')){ A.openPublished(); return; }
    var dv = t.closest('[data-dev]'); if(dv){ st.device = dv.dataset.dev; el.querySelectorAll('[data-dev]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.dev===st.device)); }); fit(); return; }
    if(t.closest('[data-mtoggle]')){ var bd = el.querySelector('.ied-body'); var v = bd.classList.toggle('view'); t.closest('[data-mtoggle]').textContent = v ? W('Editar','Edit') : W('Ver convite inteiro','View full invitation'); setTimeout(fit, 30); return; }
    var tg = t.closest('[data-tog]'); if(tg){ e.stopPropagation(); toggle(tg.dataset.tog); return; }
    if(t.closest('[data-back]')){ select('', false); return; }
    var sc = t.closest('[data-sec]'); if(sc){ select(sc.dataset.sec); return; }
    var rt = t.closest('[data-retitle]'); if(rt){ var d = A.draft(); if(d.titles) delete d.titles[rt.dataset.retitle]; touch(); select(st.sec, false); return; }
    if(t.closest('[data-pgadd]')){ var dd = A.draft(); dd.program = dd.program||[]; if(dd.program.length<12) dd.program.push({t:'',d:''}); touch(); select(st.sec, false); return; }
    var pd = t.closest('[data-pgdel]'); if(pd){ A.draft().program.splice(+pd.dataset.pgdel,1); touch(); select(st.sec, false); return; }
    if(t.closest('[data-qaadd]')){ var q = qaLines(); q.push(['','']); qaSet(q, true); select(st.sec, false); return; }
    var qd = t.closest('[data-qadel]'); if(qd){ var ql = qaLines(); ql.splice(+qd.dataset.qadel,1); qaSet(ql); select(st.sec, false); return; }
    if(t.closest('[data-songdel]')){ A.draft().song = {t:'',a:'',u:''}; touch(); select(st.sec, false); return; }
    if(t.closest('[data-dcolclear]')){ A.draft().dcol = []; touch(); select(st.sec, false); return; }
    var pdl = t.closest('[data-phdel]'); if(pdl){ A.removePhoto(pdl.dataset.phdel); touch(); select(st.sec, false); return; }
  }
  function toggle(id){
    var d = A.draft(), h = Array.isArray(d.hiddenSections) ? d.hiddenSections.slice() : [], i = h.indexOf(id);
    if(i>=0) h.splice(i,1); else h.push(id); d.hiddenSections = h; touch();
    var p = el.querySelector('.ied-panel'); p.innerHTML = st.sec ? detailView(root.WeddyInviteSchema.schemaSec(d.tpl, st.sec)) : listView();
  }
  function qaLines(){ return String(A.draft().tips||'').split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){ var m = l.match(/^([^:]{2,28}):\s*(.+)$/); return m ? [m[1],m[2]] : ['',l]; }); }
  function qaSet(lines, keepEmpty){ A.draft().tips = lines.filter(function(x){ return keepEmpty || x[0].trim() || x[1].trim(); }).map(function(x){ return (x[0].trim() ? x[0].trim()+': ' : '')+x[1].trim(); }).join('\n').slice(0,300); touch(); }
  function onInput(e){
    var t = e.target; if(!t || !t.getAttribute) return;
    var d = A.draft(), k;
    if((k = t.getAttribute('data-f'))){ var f = FIELD[k]; d[k] = t.value; var c = el.querySelector('[data-count="'+k+'"]'); if(c) c.textContent = t.value.length+'/'+(t.maxLength>0?t.maxLength:200); touch(); return; }
    if((k = t.getAttribute('data-title'))){ d.titles = d.titles && typeof d.titles==='object' ? d.titles : {}; var v = t.value.slice(0,40); if(v.trim()) d.titles[k] = v; else delete d.titles[k]; touch(); reveal(k); return; }
    if((k = t.getAttribute('data-ev'))){ var a = k.split('.'); d[a[0]] = d[a[0]] && typeof d[a[0]]==='object' ? d[a[0]] : {t:'',p:'',a:'',n:''}; d[a[0]][a[1]] = t.value; touch(); return; }
    if((k = t.getAttribute('data-pg'))){ var b = k.split('.'); if(d.program && d.program[+b[0]]){ d.program[+b[0]][b[1]] = t.value; touch(); } return; }
    if((k = t.getAttribute('data-song'))){ d.song = d.song && typeof d.song==='object' ? d.song : {t:'',a:'',u:''}; d.song[k] = t.value; if(k==='u'){ var sm = el.querySelector('[data-songmsg]'); if(sm) sm.textContent = songMsg(t.value); } touch(); return; }
    if((k = t.getAttribute('data-qa'))){ var q = qaLines(), p = k.split('.'); while(q.length<=+p[0]) q.push(['','']); q[+p[0]][p[1]==='q'?0:1] = t.value; qaSet(q, true); return; }
    if((k = t.getAttribute('data-dcol'))){ var cur = (d.dcol||[]).slice(); while(cur.length<5) cur.push('#d9cdb4'); cur[+k] = t.value; d.dcol = cur; touch(); return; }
  }
  function onChange(e){
    var t = e.target; if(!t || !t.getAttribute) return; var k, d = A.draft();
    if((k = t.getAttribute('data-opt'))){ d.opt = d.opt||{}; d.opt[k] = t.value; touch(); return; }
    if((k = t.getAttribute('data-swap'))){ if(t.value && slotUrl(k)+slotUrl(t.value)){ swapSlots(k, t.value); select(st.sec, false); refresh(); } return; }
    if((k = t.getAttribute('data-up'))){ var fl = t.files && t.files[0]; t.value = ''; if(!fl) return; st.busy = k; select(st.sec, false);
      Promise.resolve(A.uploadPhoto(k, fl)).then(function(){ st.busy = ''; touch(); select(st.sec, false); refresh(); }, function(){ st.busy = ''; select(st.sec, false); }); return; }
  }
  function focusAt(e){
    var th = e.target.closest ? e.target.closest('[data-focus]') : null; if(!th) return false;
    var r = th.getBoundingClientRect(), x = Math.round(Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100))), y = Math.round(Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100))), slot = th.getAttribute('data-focus');
    if(!slotUrl(slot)) return true;
    var d = A.draft(); d.photoFocus = d.photoFocus && typeof d.photoFocus==='object' ? d.photoFocus : {}; d.photoFocus[slot] = { x:x, y:y };
    var im = th.querySelector('img'), mk = th.querySelector('i'); if(im) im.style.objectPosition = x+'% '+y+'%'; if(mk){ mk.style.left = x+'%'; mk.style.top = y+'%'; }
    touch(); return true;
  }
  var dragging = false;
  function onKey(e){ if(e.key==='Escape' && !(e.target.matches && e.target.matches('input,textarea,select'))){ close(); } else if((e.key==='Enter'||e.key===' ') && e.target.matches && e.target.matches('[data-sec]')){ e.preventDefault(); select(e.target.dataset.sec); } }

  /* ---------- abrir / fechar ---------- */
  function open(adapter, sec){
    close(true); A = adapter; st = { sec:'', device:'phone', busy:'' }; lastCss = '';
    if(!root.WeddyInviteSchema || !SCH()){ A.fallback && A.fallback(); return; }
    el = document.createElement('div'); el.className = 'ied'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label', W('Editor do convite','Invitation editor'));
    el.innerHTML = shell(); document.body.appendChild(el); document.documentElement.style.overflow = 'hidden';
    el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onChange); el.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', function(e){ if(focusAt(e)){ dragging = true; e.preventDefault(); } });
    el.addEventListener('pointermove', function(e){ if(dragging) focusAt(e); });
    window.addEventListener('pointerup', up); window.addEventListener('resize', fit);
    if(window.ResizeObserver){ ro = new ResizeObserver(fit); ro.observe(el.querySelector('.ied-stage')); }
    bindFrame(); el.querySelector('.ied-panel').innerHTML = listView(); fit(); refresh(); markSaved(); el.querySelector('.ied-saved').textContent = '';
    if(sec){ select(sec); setTimeout(function(){ if(el && st.sec===sec) { var tt = el.querySelector(".ied-ifr"); var dd = tt && tt.contentDocument; var ee = dd && dd.querySelector("[data-wsec=\""+sec+"\"]"); if(ee && ee.scrollIntoView) ee.scrollIntoView({block:"center"}); } }, 350); }
  }
  function up(){ if(dragging){ dragging = false; refresh(); } }
  function close(silent){
    if(!el) return; clearTimeout(tmr); window.removeEventListener('pointerup', up); window.removeEventListener('resize', fit); if(ro){ ro.disconnect(); ro = null; }
    el.remove(); el = null; document.documentElement.style.overflow = ''; var a = A; A = null; if(!silent && a && a.close) a.close();
  }
  root.WeddyInvEditor = { open:open, close:close, select:function(id){ if(el) select(id); }, refresh:refresh, isOpen:function(){ return !!el; } };
})(typeof window!=='undefined' ? window : globalThis);
