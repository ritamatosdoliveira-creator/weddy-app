/* Weddy · dados de exemplo da demonstração (casamento fictício). */
window.WEDDY_DEMO_SEED=function(store,WID,UID,EMAIL){
  var d=new Date(); d.setMonth(d.getMonth()+8); d.setDate(26);
  var pad=function(n){return (n<10?'0':'')+n;};
  var iso=function(dt){return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());};
  var wedding=iso(d);
  var ago=function(days){var x=new Date();x.setDate(x.getDate()-days);return iso(x);};
  var ahead=function(days){var x=new Date();x.setDate(x.getDate()+days);return iso(x);};
  var gi=0;
  function G(name,extra){gi++;var id='g'+gi;var o={name:name,id:id,guestId:id};if(extra)for(var k in extra)o[k]=extra[k];return o;}
  var guests={
    noiva:{familia:['Maria Matos','José Matos','Ana Matos','Carlos Matos','Teresa Oliveira','Joaquim Oliveira','Inês Matos','Pedro Matos','Helena Matos','Manuel Oliveira'].map(function(n){return G(n);}),
      amigos:['Joana Ferreira','Catarina Lopes','Marta Silva','Beatriz Gomes','Sofia Martins','Daniela Rocha','Filipa Nunes','Carolina Dias'].map(function(n){return G(n);}),
      duvida:[G('Rui Antunes')],staff:[],custom:[{id:'criancas',label:'Crianças',names:[G('Leonor',{age:6,payingPct:1}),G('Tomás',{age:4,payingPct:1})]}]},
    noivo:{familia:['Rosa Almeida','António Almeida','Paula Almeida','Nuno Almeida','Fernanda Costa','Luís Costa','Sandra Almeida','Jorge Almeida'].map(function(n){return G(n);}),
      amigos:['Miguel Santos','André Pereira','Ricardo Moreira','Bruno Carvalho','Diogo Teixeira','Gonçalo Freitas','Hugo Barbosa'].map(function(n){return G(n);}),
      duvida:[],staff:[],custom:[{id:'criancas',label:'Crianças',names:[G('Matilde',{age:8,payingPct:1})]}]},
    conjunto:{familia:[],amigos:['Patrícia e Tiago Reis','Susana e Paulo Mendes','Cláudia e Vasco Lima','Rita e João Pinto'].map(function(n){return G(n);}),
      duvida:[],staff:[],custom:[{id:'criancas',label:'Crianças',names:[]}]}
  };
  var all=[];
  ['noiva','noivo','conjunto'].forEach(function(s){var g=guests[s];['familia','amigos','duvida'].forEach(function(c){g[c].forEach(function(e){all.push(e);});});g.custom[0].names.forEach(function(e){all.push(e);});});
  var confirmed={};
  all.forEach(function(e,i){ if(i%4!==3) confirmed[e.guestId]=true; });
  /* mesas */
  var tables=[]; var cols=3;
  for(var i=0;i<6;i++){tables.push({id:i+1,shape:i===0?'imperial':'round',seats:i===0?12:8,x:40+(i%cols)*190,y:130+Math.floor(i/cols)*190});}
  var assignments={}; var pool=all.filter(function(e){return confirmed[e.guestId];});
  var p=0; tables.slice(1).forEach(function(t,ti){ if(ti>3) return; for(var s=1;s<=t.seats-1 && p<pool.length;s++){ assignments['t'+t.id+'-s'+s]=pool[p++].guestId; } });
  var cats=[
    {id:'quinta',name:'Espaço e Catering',value:20000},{id:'cerimonia',name:'Cerimónia',value:2000},
    {id:'entretenimento',name:'Entretenimento',value:3200},{id:'foto',name:'Fotografia e Vídeo',value:4800},
    {id:'vestuario',name:'Vestuário e Acessórios',value:6000},{id:'decoracao',name:'Decoração e Flores',value:6000},
    {id:'convites',name:'Convites e Papelaria',value:800},{id:'extras',name:'Extras e Logística',value:1600}];
  var sup=[
    {id:'sup1',name:'Quinta das Lágrimas',category:'quinta',contact:'+351 239 802 380',email:'eventos@quinta.example',website:'',price:'',status:'contratado',notas:'Sinal pago. Prova de menu em Março.',valorTotal:19000,payments:[{id:'p1',date:ago(120),amount:8000,desc:'Sinal'},{id:'p2',date:ago(20),amount:7000,desc:'2.ª prestação'}],nextPaymentDate:ahead(45),nextPaymentAmount:4000,nextStep:'Prova de menu',lastContact:ago(6)},
    {id:'sup2',name:'Luz & Memória Fotografia',category:'foto',contact:'+351 912 345 678',email:'ola@luzememoria.example',website:'',price:'',status:'contratado',notas:'Reportagem completa + álbum.',valorTotal:3600,payments:[{id:'p3',date:ago(60),amount:1800,desc:'Sinal'}],nextPaymentDate:ahead(90),nextPaymentAmount:1800,nextStep:'Sessão de noivos',lastContact:ago(15)},
    {id:'sup3',name:'DJ Sunset',category:'entretenimento',contact:'+351 934 567 890',email:'',website:'',price:'',status:'contactado',notas:'À espera de proposta.',valorTotal:0,payments:[],nextPaymentDate:'',nextPaymentAmount:0,nextStep:'Ver proposta',lastContact:ago(3)},
    {id:'sup4',name:'Atelier Flor de Sal',category:'decoracao',contact:'+351 965 432 109',email:'',website:'',price:'',status:'considerar',notas:'Gostámos do estilo boho.',valorTotal:0,payments:[],nextPaymentDate:'',nextPaymentAmount:0,nextStep:'',lastContact:''},
    {id:'sup5',name:'Maison Noiva',category:'vestuario',contact:'+351 218 765 432',email:'',website:'',price:'',status:'contratado',notas:'Segunda prova marcada.',valorTotal:2800,payments:[{id:'p4',date:ago(90),amount:2000,desc:'Sinal'}],nextPaymentDate:ahead(60),nextPaymentAmount:800,nextStep:'2.ª prova',lastContact:ago(10)}];
  var exp=[
    {id:'e1',date:ago(2),desc:'3.ª prestação da quinta',value:4000,paid:0,category:'quinta',dueDate:ahead(45),method:'transferencia',supplierId:'sup1'},
    {id:'e2',date:ago(2),desc:'Restante da fotografia',value:1800,paid:0,category:'foto',dueDate:ahead(90),method:'mbway',supplierId:'sup2'},
    {id:'e3',date:ago(2),desc:'Restante do vestido',value:800,paid:0,category:'vestuario',dueDate:ahead(60),method:'cartao',supplierId:'sup5'},
    {id:'e5',date:ago(40),desc:'Alianças',value:900,paid:900,category:'vestuario',dueDate:'',method:'cartao',supplierId:null},
    {id:'e6',date:ago(30),desc:'Fato do noivo',value:650,paid:300,category:'vestuario',dueDate:ahead(50),method:'cartao',supplierId:null},
    {id:'e7',date:ago(15),desc:'Convites',value:380,paid:380,category:'convites',dueDate:'',method:'mbway',supplierId:null},
    {id:'e8',date:ago(5),desc:'Sinal da decoração',value:500,paid:0,category:'decoracao',dueDate:ahead(28),method:'transferencia',supplierId:null}];
  var done={}; for(var t=0;t<7;t++) done['f1-'+t]=true; for(var u=0;u<3;u++) done['f2-'+u]=true;
  var data={
    budget:{total:50000,guestsEstimate:all.length},
    categories:cats,
    guests:guests, confirmed:confirmed, expenses:exp,
    seating:{tables:tables,assignments:assignments,items:[{id:'i1',type:'entrada',x:16,y:16},{id:'i2',type:'pista',x:260,y:520}]},
    daySchedule:[{id:'ev1',label:'Cerimónia',time:'15:00',place:'Capela da Quinta',guestVisible:true},{id:'ev2',label:'Cocktail',time:'16:30',place:'Jardim',guestVisible:true},{id:'ev3',label:'Jantar',time:'19:30',place:'Salão',guestVisible:true},{id:'ev4',label:'Bolo e primeira dança',time:'22:00',place:'Salão',guestVisible:true},{id:'ev5',label:'Festa',time:'23:00',place:'Pista',guestVisible:true}],
    checklistDone:done, checklistPersonal:[], dressChecklistDone:{}, dressVisits:[], favoriteVisitId:null,
    suppliers:sup,
    todos:[],
    todoCategories:[
      {id:'tc1',icon:'music',label:'Músicas',title:'Playlist do casamento',desc:'As músicas que queremos que toquem ao longo do dia.',items:[{text:'Entrada da noiva',done:true,due:'',time:''},{text:'Primeira dança',done:false,due:'',time:''},{text:'Lista de músicas para a pista',done:false,due:'',time:''}]},
      {id:'tc2',icon:'church',label:'Igreja',title:'Cânticos e leituras',desc:'Seleciona os cânticos e leituras para a cerimónia religiosa.',items:[{text:'Escolher as leituras',done:false,due:ahead(40),time:''}]},
      {id:'tc3',icon:'doc',label:'Geral',title:'Outras tarefas',desc:'Ideias, lembretes e tudo o que quiseres organizar.',items:[{text:'Marcar prova de menu',done:false,due:ahead(20),time:''},{text:'Escolher lembranças',done:false,due:'',time:''}]}],
    todoNotes:'', honeymoon:{options:[]}, payments:[], weddingDocuments:[]
  };
  store['weddings/'+WID]={ownerEmails:[EMAIL],ownerUids:[UID],creatorEmail:EMAIL,
    consent:{termsVersion:'2026-10-02',privacyVersion:'2026-10-02'},
    settings:{coupleName1:'Rita',coupleName2:'Tiago',weddingDate:wedding,venue:'Quinta das Lágrimas',accentColor:'rust',heroPhotoUrl:'inicio/ilustracao-casal.jpg',heroPhotoPosX:50,heroPhotoPosY:20,heroPhotoZoom:100},
    json:JSON.stringify(data),subscription:{active:true,plan:'premium12',startedAt:new Date().toISOString()}};
  try{localStorage.setItem('weddy_demo','1');}catch(e){}
};
