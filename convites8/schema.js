/* Weddy Invitations — descritor (schema) próprio de cada um dos 8 modelos. FONTE DE VERDADE do editor, da validação e do motor.
   Cada secção corresponde ao que o modelo realmente desenha, pela ordem do convite (confirmado por testes que desenham os 8 modelos).
   sec: { id, nome:[pt,en], titulo:[pt,en]|null (título predefinido como aparece no convite; só se editável),
          campos:[...draft], obrig (essencial: não oculta), ocultavel, edicao, fotos:[slots], musica, chunk (secção desenhada dentro de outra),
          max:{campo:n}, so (só aparece quando há conteúdo) }
   Modelo: { n, nome, fotos:[{slot,uso,obrig,prop,rec}], musica, capaObrig }
   Independente da ordem de carregamento: expõe window.WeddyInviteSchema e, se existir, WeddyInvite.SCHEMA. */
(function(root){
  'use strict';
  var T = function(pt,en){ return [pt,en||pt]; };
  var S = function(id, nome, o){ o = o||{}; var ob = !!o.obrig;
    return { id:id, nome:nome, titulo:o.titulo||null, campos:o.campos||[], obrig:ob, ocultavel: ob ? false : o.ocultavel!==false, edicao:o.edicao||'texto', fotos:o.fotos||[], musica:!!o.musica, chunk:o.chunk||'', max:o.max||{}, so:o.so!==false }; };
  var P = function(slot, uso, o){ o = o||{}; return { slot:slot, uso:uso, obrig:!!o.obrig, prop:o.prop||'4:5', rec:o.rec||'1600 px' }; };
  var CAPA = function(c, extra){ return S('capa', T('Capa e nomes','Cover and names'), { campos:['names','date','venue','address'].concat(c||[]), obrig:true, edicao:'misto', max:{names:60}, fotos:extra||[] }); };
  var RSVP = function(titulo){ return S('rsvp', T('Confirmação de presença','RSVP'), { titulo:titulo||null, obrig:true, edicao:'fixo' }); };
  var LOC = function(id, nome, titulo, campos){ return S(id, nome, { titulo:titulo||null, campos:campos, edicao:'misto' }); };
  var SCHEMA = {
    'w-verde': { n:1, nome:T('Verde-oliva','Olive green'), musica:true,
      fotos:[ P('g0',T('Abertura','Opening'),{prop:'3:4'}), P('g1',T('Depois do calendário','After the calendar'),{prop:'4:3'}), P('g2',T('Antes do final','Before the end'),{prop:'4:5'}) ],
      secoes:[ CAPA(['intro','mono']), S('foto1',T('Fotografia de abertura','Opening photo'),{edicao:'foto',fotos:['g0']}), S('citacao',T('Citação','Quote'),{campos:['quote'],max:{quote:200}}), S('musica',T('Música','Music'),{campos:['song'],edicao:'musica',musica:true}),
        S('mensagem',T('Mensagem','Message'),{campos:['message'],chunk:'data',max:{message:300}}), S('pais',T('Pais e padrinhos','Parents and godparents'),{campos:['parents'],chunk:'data',max:{parents:200}}),
        S('data',T('Data e hora','Date and time'),{campos:['date','time'],obrig:true,edicao:'misto'}), S('contagem',T('Contagem decrescente e calendário','Countdown and calendar'),{titulo:T('O grande dia','The big day'),chunk:'data',edicao:'fixo'}),
        LOC('locais',T('Cerimónia e receção','Ceremony and reception'),null,['cer','rec']), S('programa',T('Programa','Programme'),{titulo:T('Itinerário de atividades','Schedule'),campos:['program'],edicao:'lista'}),
        S('historia',T('A nossa história','Our story'),{titulo:T('A nossa história','Our story'),campos:['story'],max:{story:400}}), S('foto2',T('Fotografia da história','Story photo'),{edicao:'foto',fotos:['g1']}),
        S('dress',T('Dress code e ilustração','Dress code and illustration'),{titulo:T('Código de vestuário','Dress code'),campos:['dress','opt'],edicao:'misto',max:{dress:300}}),
        S('presentes',T('Presentes','Gifts'),{titulo:T('Presentes','Gifts'),campos:['gifts','giftUrl'],edicao:'ligacao',max:{gifts:300}}), RSVP(T('Confirmar presença','Confirm attendance')),
        S('recomendacoes',T('Recomendações','Tips'),{titulo:T('Recomendações','Recommendations'),campos:['tips'],chunk:'fim',max:{tips:300}}), S('criancas',T('Crianças','Children'),{campos:['kids'],chunk:'fim',max:{kids:300}}),
        S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Muito obrigado!','Thank you!'),chunk:'fim',edicao:'fixo'}),
        S('alojamento',T('Alojamento','Accommodation'),{titulo:T('Alojamento sugerido','Suggested accommodation'),campos:['hotel','hotelUrl'],edicao:'ligacao',max:{hotel:120}}), S('foto3',T('Fotografia final','Final photo'),{edicao:'foto',fotos:['g2']}),
        S('hashtag',T('Hashtag','Hashtag'),{titulo:T('Partilhem os vossos momentos','Share your moments'),campos:['hash']}) ] },
    'w-romantico': { n:2, nome:T('Romântico','Romantic'), musica:false, capaObrig:true,
      fotos:[ P('cover',T('Capa','Cover'),{obrig:true,prop:'2:3'}), P('g0',T('Fotografia 1','Photo 1'),{prop:'4:5'}), P('g1',T('Fotografia 2','Photo 2'),{prop:'3:4'}), P('g2',T('Polaroid 1 da história','Story polaroid 1'),{prop:'3:4'}), P('g3',T('Polaroid 2 da história','Story polaroid 2'),{prop:'3:4'}) ],
      secoes:[ CAPA([],['cover']), S('contagem',T('Contagem decrescente','Countdown'),{titulo:T('O grande dia está a chegar','The big day is coming'),edicao:'fixo'}), S('mensagem',T('Mensagem','Message'),{campos:['message'],max:{message:300}}),
        LOC('locais',T('Cerimónia e receção','Ceremony and reception'),null,['cer','rec']), S('foto1',T('Fotografia 1','Photo 1'),{edicao:'foto',fotos:['g0']}), S('programa',T('Programa','Programme'),{titulo:T('O dia do casamento','The wedding day'),campos:['program'],edicao:'lista'}),
        S('foto2',T('Fotografia 2','Photo 2'),{edicao:'foto',fotos:['g1']}), S('historia',T('A nossa história','Our story'),{titulo:T('A nossa história','Our story'),campos:['story'],fotos:['g2','g3'],max:{story:400}}),
        S('dress',T('Dress code','Dress code'),{titulo:T('Dress code','Dress code'),campos:['dress'],max:{dress:300}}), RSVP(T('Confirmar presença','Confirm attendance')), S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Obrigado','Thank you'),campos:['thanks'],edicao:'misto',max:{thanks:240}}), S('hashtag',T('Hashtag','Hashtag'),{titulo:T('Partilhem o amor','Share the love'),campos:['hash']}) ] },
    'w-editorial': { n:3, nome:T('Editorial','Editorial'), musica:false,
      fotos:[ P('cover',T('Capa e frase de convite','Cover and invitation line'),{prop:'3:4'}), P('g0',T('Polaroid 1 da história','Story polaroid 1'),{prop:'3:4'}), P('g1',T('Polaroid 2 da história','Story polaroid 2'),{prop:'3:4'}), P('g2',T('Faixa fotográfica','Photo strip'),{prop:'4:3'}), P('g3',T('Fundo do dress code e das moradas','Dress code and addresses background'),{prop:'3:4'}) ],
      secoes:[ CAPA([],['cover']), S('convite',T('Frase de convite','Invitation line'),{titulo:T('Ela disse sim!','She said yes!'),campos:['intro'],fotos:['cover'],max:{intro:200},so:false}), S('historia',T('A nossa história','Our story'),{titulo:T('A nossa história','Our story'),campos:['story'],fotos:['g0','g1'],max:{story:400}}),
        S('programa',T('Programa','Programme'),{titulo:T('O programa','The programme'),campos:['program'],edicao:'lista'}), S('contagem',T('Contagem decrescente','Countdown'),{titulo:T('O grande dia está a chegar','The big day is coming'),edicao:'fixo'}),
        S('foto',T('Fotografia','Photo'),{edicao:'foto',fotos:['g2']}), RSVP(T('RSVP','RSVP')), S('dress',T('Dress code','Dress code'),{titulo:T('Dress code','Dress code'),campos:['dress'],fotos:['g3'],max:{dress:300}}),
        S('perguntas',T('Perguntas e respostas','Questions and answers'),{titulo:T('Detalhes e dúvidas','Details and questions'),campos:['tips'],edicao:'lista',max:{tips:300}}), S('locais',T('Cerimónia e receção','Ceremony and reception'),{titulo:T('Moradas','Addresses'),campos:['cer','rec'],edicao:'misto',fotos:['g3']}),
        S('alojamento',T('Alojamento','Accommodation'),{titulo:T('Alojamento sugerido','Suggested accommodation'),campos:['hotel','hotelUrl'],edicao:'ligacao',max:{hotel:120}}), S('hashtag',T('Hashtag','Hashtag'),{titulo:T('Partilhem os vossos momentos','Share your moments'),campos:['hash']}),
        S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Obrigado','Thank you'),campos:['thanks'],edicao:'misto',max:{thanks:240}}) ] },
    'w-bordo': { n:4, nome:T('Bordô','Burgundy'), musica:true,
      fotos:[ P('g0',T('Abertura','Opening'),{prop:'4:5'}), P('g1',T('Secção intermédia','Middle section'),{prop:'4:5'}), P('g2',T('Final','Closing'),{prop:'4:5'}) ],
      secoes:[ CAPA(['mono']), S('citacao',T('Citação','Quote'),{campos:['quote'],max:{quote:200}}), S('foto1',T('Fotografia de abertura','Opening photo'),{edicao:'foto',fotos:['g0']}), S('musica',T('Música','Music'),{campos:['song'],edicao:'musica',musica:true}),
        S('pais',T('Pais e padrinhos','Parents and godparents'),{campos:['parents'],max:{parents:200}}), S('data',T('Data e contagem','Date and countdown'),{campos:['date','time'],obrig:true,edicao:'misto'}), S('foto2',T('Fotografia intermédia','Middle photo'),{edicao:'foto',fotos:['g1']}),
        LOC('rececao',T('Receção','Reception'),null,['rec']), S('programa',T('Programa','Programme'),{titulo:T('Itinerário de atividades','Schedule'),campos:['program'],edicao:'lista'}), S('dress',T('Dress code','Dress code'),{titulo:T('Código de vestuário','Dress code'),campos:['dress','dcol'],edicao:'misto',max:{dress:300}}),
        S('presentes',T('Presentes','Gifts'),{titulo:T('Presentes','Gifts'),campos:['gifts','giftUrl'],edicao:'ligacao',max:{gifts:300}}), S('alojamento',T('Alojamento','Accommodation'),{titulo:T('Alojamento sugerido','Suggested accommodation'),campos:['hotel','hotelUrl'],edicao:'ligacao',max:{hotel:120}}),
        RSVP(T('Confirmar presença','Confirm attendance')), S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Muito obrigado!','Thank you!'),edicao:'fixo'}), S('foto3',T('Fotografia final','Final photo'),{edicao:'foto',fotos:['g2']}) ] },
    'w-beige': { n:5, nome:T('Bege','Beige'), musica:false,
      fotos:[ P('g0',T('Faixa fotográfica','Photo strip'),{prop:'4:3'}), P('g1',T('Fundo da contagem','Countdown background'),{prop:'4:5'}) ],
      secoes:[ CAPA(['mono']), S('mensagem',T('Mensagem','Message'),{titulo:T('Queridos familiares e amigos!','Dear family and friends!'),campos:['message'],max:{message:300},so:false}), S('foto1',T('Fotografia','Photo'),{edicao:'foto',fotos:['g0']}),
        LOC('locais',T('Cerimónia e receção','Ceremony and reception'),null,['cer','rec']), S('dress',T('Dress code','Dress code'),{titulo:T('Código de vestuário','Dress code'),campos:['dress','dcol'],edicao:'misto',max:{dress:300}}),
        S('hashtag',T('Hashtag','Hashtag'),{titulo:T('Hashtag do casamento','Wedding hashtag'),campos:['hash']}), S('contagem',T('Contagem decrescente','Countdown'),{edicao:'foto',fotos:['g1']}),
        S('alojamento',T('Alojamento','Accommodation'),{titulo:T('Alojamento sugerido','Suggested accommodation'),campos:['hotel','hotelUrl'],edicao:'ligacao',max:{hotel:120}}), S('presentes',T('Presentes','Gifts'),{titulo:T('Presentes','Gifts'),campos:['gifts','giftUrl'],edicao:'ligacao',max:{gifts:300}}),
        RSVP(T('RSVP','RSVP')), S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Obrigado','Thank you'),campos:['thanks'],edicao:'misto',max:{thanks:240}}) ] },
    'w-monograma': { n:6, nome:T('Monograma','Monogram'), musica:true,
      fotos:[ P('cover',T('Capa','Cover'),{prop:'3:4'}), P('g0',T('Abertura','Opening'),{prop:'3:4'}), P('g1',T('Convite','Invitation'),{prop:'3:4'}), P('g2',T('Intermédia','Middle'),{prop:'3:4'}), P('g3',T('Final','Closing'),{prop:'4:3'}) ],
      secoes:[ CAPA(['mono'],['cover']), S('foto1',T('Fotografia de abertura','Opening photo'),{edicao:'foto',fotos:['g0']}), S('musica',T('Música','Music'),{campos:['song'],edicao:'musica',musica:true}),
        S('convite',T('Convite e pais','Invitation and parents'),{campos:['parents'],fotos:['g1'],max:{parents:200},obrig:true}), S('savedate',T('Save the date, data e hora','Save the date, date and time'),{campos:['date','time'],obrig:true,edicao:'misto'}),
        S('foto2',T('Fotografia intermédia','Middle photo'),{edicao:'foto',fotos:['g2']}), S('contagem',T('Contagem decrescente','Countdown'),{edicao:'fixo'}), LOC('locais',T('Cerimónia e receção','Ceremony and reception'),null,['cer','rec']),
        S('presentes',T('Presentes','Gifts'),{titulo:T('Mesa de presentes','Gift table'),campos:['gifts','giftUrl'],edicao:'ligacao',max:{gifts:300}}), S('dress',T('Dress code e paleta','Dress code and palette'),{titulo:T('Código de vestuário','Dress code'),campos:['dress','dcol'],edicao:'misto',max:{dress:300}}),
        RSVP(), S('foto3',T('Fotografia final','Final photo'),{edicao:'foto',fotos:['g3']}), S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Obrigado','Thank you'),campos:['thanks'],edicao:'misto',max:{thanks:240}}) ] },
    'w-destino': { n:7, nome:T('Destino','Destination'), musica:false, capaObrig:true,
      fotos:[ P('cover',T('Capa','Cover'),{obrig:true,prop:'3:4'}), P('g0',T('Fotografia interior','Inner photo'),{prop:'4:3'}) ],
      secoes:[ CAPA([],['cover']), S('mensagem',T('Mensagem','Message'),{titulo:T('Queridos amigos e família!','Dear friends and family!'),campos:['message'],max:{message:300},so:false}), S('calendario',T('Calendário e contagem','Calendar and countdown'),{edicao:'fixo'}),
        S('programa',T('Programa','Programme'),{titulo:T('Programa do dia','Programme'),campos:['program'],edicao:'lista'}), LOC('rececao',T('Receção','Reception'),null,['rec']), S('foto',T('Fotografia','Photo'),{edicao:'foto',fotos:['g0']}),
        S('presentes',T('Desejos, presentes e flores','Wishes, gifts and flowers'),{titulo:T('Desejos','Wishes'),campos:['gifts','giftUrl','flowers'],edicao:'misto',max:{gifts:300,flowers:200}}), S('dress',T('Dress code','Dress code'),{titulo:T('Dress code','Dress code'),campos:['dress','dressF','dressM'],edicao:'misto',max:{dress:300,dressF:200,dressM:200}}),
        S('organizador',T('Organizador','Organiser'),{titulo:T('Organizador','Organiser'),campos:['org','orgTel'],max:{org:100}}), S('agradecimento',T('Agradecimento','Thank you'),{edicao:'fixo'}), RSVP() ] },
    'w-relevo': { n:8, nome:T('Relevo','Relief'), musica:false,
      fotos:[ P('cover',T('Capa','Cover'),{prop:'3:4'}), P('g0',T('Calendário','Calendar'),{prop:'4:3'}), P('g1',T('Agradecimento','Thank you'),{prop:'4:3'}) ],
      secoes:[ CAPA(['mono'],['cover']), S('calendario',T('Calendário','Calendar'),{edicao:'foto',fotos:['g0']}), S('detalhes',T('Detalhes: cerimónia, receção e dress code','Details: ceremony, reception and dress code'),{campos:['cer','rec','dress'],edicao:'misto',max:{dress:300}}),
        S('programa',T('Programa','Programme'),{campos:['program'],edicao:'lista'}), RSVP(), S('obrigado',T('Agradecimento','Thank you'),{titulo:T('Obrigado','Thank you'),edicao:'foto',fotos:['g1']}) ] }
  };
  /* Utilitários (puros) */
  function secoes(tpl){ var m = SCHEMA[tpl]; return m ? m.secoes : []; }
  function ids(tpl){ return secoes(tpl).map(function(s){ return s.id; }); }
  function sec(tpl, id){ var a = secoes(tpl); for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null; }
  function fotos(tpl){ var m = SCHEMA[tpl]; return m ? m.fotos : []; }
  var API = { SCHEMA:SCHEMA, schemaSecoes:secoes, schemaIds:ids, schemaSec:sec, schemaFotos:fotos };
  root.WeddyInviteSchema = API;
  if(root.WeddyInvite) for(var k in API) root.WeddyInvite[k] = API[k];
  if(typeof module!=='undefined' && module.exports) module.exports = API;
})(typeof window!=='undefined' ? window : globalThis);
