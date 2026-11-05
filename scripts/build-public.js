#!/usr/bin/env node
/* Constrói o artefacto PÚBLICO do site (GitHub Pages) a partir de uma ALLOWLIST explícita.
 * Nada que não esteja listado aqui é publicado (docs/, tests/, scripts/, recuperado-producao/, index.js, regras, relatórios, ...).
 * Uso: node scripts/build-public.js [pasta-de-saída]   (por omissão: _site, ignorada pelo git)
 * Falha (exit 1) se um ficheiro da allowlist não existir. Não faz rede nem publica nada. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

// Ficheiros públicos na raiz (explícitos).
const ROOT_FILES = [
  'CNAME', '.nojekyll', '404.html', 'index.html', 'inicio.html', 'sobre.html', 'contactos.html', 'suporte.html', 'privacidade.html',
  'demonstracao.html', 'demo-app.html', 'memorias.html', 'rsvp.html', 'site.html', 'promo-video.html',
  'manifest.json', 'sw.js', 'demo-seed.js', 'demo-shim.js', 'site-anchors.js', 'site-i18n.js', 'site-protect.js', 'store-cta.js', 'weddysite.js',
  'dsk-casal.png', 'dsk-flor-bl.png', 'dsk-flor-tl.png', 'dsk-flor-tr.png', 'dsk-logo.png',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'login-bg-creme.jpg', 'login-bg.jpg', 'login-bg.png', 'login-couple.png', 'login-logo-w.png', 'login-sprig-br.png', 'login-sprig-tr.png',
  'logo-dgpublicidade.png', 'logo-happybox.png', 'logo-jtestudios.png', 'logo-mateceramics.jpg', 'logo-quintasantoandre.png', 'site-mockup.jpg',
  'app/index.html', 'app/manifest.json', 'app/sw.js',
  '.well-known/assetlinks.json',
];
// Pastas só de ativos estáticos: apenas estas extensões.
const ROOT_DIRS = { feira: ['.png'], inicio: ['.jpg', '.mp4'], fonts: ['.woff', '.txt'] };

function listPublic() {
  const out = [...ROOT_FILES];
  for (const [dir, exts] of Object.entries(ROOT_DIRS)) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) throw new Error(`pasta pública em falta: ${dir}`);
    for (const f of fs.readdirSync(abs).sort()) {
      const full = path.join(abs, f);
      if (fs.statSync(full).isFile() && exts.includes(path.extname(f).toLowerCase())) out.push(`${dir}/${f}`);
    }
  }
  return out;
}
function build(outDir) {
  const files = listPublic(); const missing = files.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) throw new Error('ficheiros da allowlist em falta: ' + missing.join(', '));
  const out = path.resolve(outDir);
  if (out === ROOT || ROOT.startsWith(out + path.sep)) throw new Error('pasta de saída inválida');
  fs.rmSync(out, { recursive: true, force: true });
  for (const f of files) { const dst = path.join(out, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), dst); }
  return files;
}
module.exports = { ROOT_FILES, ROOT_DIRS, listPublic, build };
if (require.main === module) {
  try { const files = build(process.argv[2] || path.join(ROOT, '_site')); console.log(`artefacto público: ${files.length} ficheiros`); }
  catch (e) { console.error('ERRO: ' + e.message); process.exit(1); }
}
