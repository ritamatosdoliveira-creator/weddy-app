/* Paridade PT/EN do rsvp.html (a da app é verificada em ui/i18n_en.py, que corre a app real).
 * Falha se uma chave existir só numa língua, se um texto EN estiver vazio, ou se um texto EN for igual ao PT
 * em chaves com palavras claramente portuguesas.  Correr: node tests/unit/i18n-parity.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'rsvp.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

const iPt = src.search(/\n\s*pt:\s*\{/), iEn = src.search(/\n\s*en:\s*\{/);
ok(iPt > 0 && iEn > iPt, 'rsvp.html tem blocos pt e en');
function keysOf(block) {
  const m = new Map();
  for (const line of block.split('\n')) {
    const k = line.match(/^\s{4,8}([A-Za-z0-9_]+):\s*(.*)$/);
    if (k) m.set(k[1], k[2]);
  }
  return m;
}
// cada bloco acaba na primeira linha "}" com a mesma indentação da linha "pt:"/"en:"
function blockEnd(from) {
  const lineStart = src.lastIndexOf('\n', from + 1) + 1;
  const indent = src.slice(src.indexOf('\n', from) + 1).match(/^\s*/)[0].length;
  const ind = src.slice(from + 1).match(/^\s*/)[0].length;
  const re = new RegExp('\\n\\s{' + ind + '}\\}', 'g'); re.lastIndex = from + 1;
  const m = re.exec(src); return m ? m.index : src.length;
}
const pt = keysOf(src.slice(iPt + 1, blockEnd(iPt)).split('\n').slice(1).join('\n')), en = keysOf(src.slice(iEn + 1, blockEnd(iEn)).split('\n').slice(1).join('\n'));
ok(pt.size > 50 && en.size > 50, `chaves lidas (pt=${pt.size}, en=${en.size})`);
const onlyPt = [...pt.keys()].filter((k) => !en.has(k)), onlyEn = [...en.keys()].filter((k) => !pt.has(k));
ok(!onlyPt.length, 'todas as chaves PT existem em EN' + (onlyPt.length ? ': ' + onlyPt.join(',') : ''));
ok(!onlyEn.length, 'todas as chaves EN existem em PT' + (onlyEn.length ? ': ' + onlyEn.join(',') : ''));
const empty = [...en.entries()].filter(([, v]) => /^(''|""|``)[,]?$/.test(v.trim())).map(([k]) => k);
ok(!empty.length, 'nenhum texto EN vazio' + (empty.length ? ': ' + empty.join(',') : ''));
const PT_WORDS = /\b(não|você|ainda|então|está|obrigatório|inválid[oa]|guardar|preferência|convite|tenta|erro)\b/i;
const leaked = [...en.entries()].filter(([, v]) => PT_WORDS.test(v.replace(/\$\{[^}]*\}/g, ''))).map(([k]) => k);
ok(!leaked.length, 'sem palavras portuguesas nos textos EN' + (leaked.length ? ': ' + leaked.join(',') : ''));
console.log(`\n${pass} OK, ${fail} FALHAS`);
process.exit(fail ? 1 : 0);
