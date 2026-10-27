/* Weddy: dissuade copiar texto e arrastar imagens nas páginas públicas.
   Os campos de formulário continuam a funcionar normalmente. */
(function(){
  var st=document.createElement('style');
  st.textContent='html,body{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}'+
    'input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;-moz-user-select:text;user-select:text}'+
    'img,svg,video{-webkit-user-drag:none;user-drag:none}::selection{background:transparent}input::selection,textarea::selection{background:#EBCFC5}';
  document.head.appendChild(st);
  function editable(t){return t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]')}
  function block(e){if(!editable(e.target))e.preventDefault()}
  ['copy','cut','contextmenu','dragstart','selectstart'].forEach(function(n){document.addEventListener(n,block,true)});
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&/^[cxa]$/i.test(e.key)&&!editable(e.target))e.preventDefault();
  },true);
})();
