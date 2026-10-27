/* Âncoras do menu sem deixar o #secção no endereço. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  function clean(){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
  function go(id,smooth){
    var el=document.getElementById(id);if(!el)return false;
    el.scrollIntoView({behavior:smooth&&!reduce?'smooth':'auto',block:'start'});
    if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');
    try{el.focus({preventScroll:true})}catch(e){}
    return true;
  }
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
    var a=e.target.closest&&e.target.closest('a[href*="#"]');if(!a||a.target==='_blank')return;
    var u;try{u=new URL(a.getAttribute('href'),location.href)}catch(x){return}
    if(!u.hash||u.origin!==location.origin||u.pathname.replace(/\/$/,'')!==location.pathname.replace(/\/$/,''))return;
    var id=decodeURIComponent(u.hash.slice(1));
    if(go(id,true)){e.preventDefault();clean()}
  });
  function initial(){
    if(!location.hash)return;
    var id=decodeURIComponent(location.hash.slice(1));
    setTimeout(function(){go(id,false);clean()},60);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initial);else initial();
})();
