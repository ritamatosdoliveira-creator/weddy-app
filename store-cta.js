/* Weddy — botões "Começar" levam à loja de aplicações no telemóvel.
   No computador (sem app de loja) continuam a abrir a versão web em /app/. */
(function(){
  var ua=navigator.userAgent||'';
  var ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var android=/Android/i.test(ua);
  var url=ios?'https://apps.apple.com/pt/app/weddy/id6817425432':''; /* Android: continua a abrir /app/ (revertido) */
  if(!url)return;
  function fix(){
    var l=document.querySelectorAll('a[href="/app/"],a[href="/app"]');
    for(var i=0;i<l.length;i++){l[i].setAttribute('href',url);l[i].setAttribute('rel','noopener');
      var t=l[i].firstChild;if(t&&t.nodeType===3&&/(Começar|Criar conta) gratuitamente/.test(t.textContent))t.textContent=t.textContent.replace(/(Começar|Criar conta) gratuitamente/,'Descarregar a app');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();
})();
