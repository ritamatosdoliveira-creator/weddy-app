#!/usr/bin/env node
/* Compara uma ou mais funções exportadas entre ficheiros index.js (só leitura; sem rede).
 * Uso: node comparar-funcao.js <funcao[,funcao2]> <A.js> <B.js> [C.js ...]
 * Para cada função, recolhe o bloco `exports.<f> = ...` e, transitivamente, as funções e
 * constantes de topo que ele usa, e diz se cada unidade é IDÊNTICA em todos os ficheiros
 * (comparação sem comentários nem espaços) ou onde difere (mostra o diff mínimo).
 * Não imprime segredos: se encontrar um padrão de segredo numa unidade, avisa e omite o texto. */
'use strict';
const fs = require('fs');
function blockEnd(s, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' }; const st = []; let prev = '';
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
    if (c === '/' && n === '*') { i = s.indexOf('*/', i) + 1; continue; }
    if (c === '\'' || c === '"') { for (i++; s[i] !== c; i++) if (s[i] === '\\') i++; prev = 'x'; continue; }
    if (c === '`') { for (i++; s[i] !== '`'; i++) { if (s[i] === '\\') i++; else if (s[i] === '$' && s[i + 1] === '{') i = blockEnd(s, i + 1); } prev = 'x'; continue; }
    if (c === '/' && /[(,=:\[!&|?{};]|^$/.test(prev)) { for (i++; s[i] !== '/'; i++) { if (s[i] === '\\') i++; else if (s[i] === '[') { for (i++; s[i] !== ']'; i++) if (s[i] === '\\') i++; } } prev = 'x'; continue; }
    if (pairs[c]) st.push(pairs[c]); else if (c === ')' || c === '}' || c === ']') { st.pop(); if (!st.length) return i; }
    if (!/\s/.test(c)) prev = c;
  }
  return s.length;
}
// fim de uma instrução de topo (até ';' com profundidade 0)
function stmtEnd(s, from) {
  let depth = 0; let prev = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
    if (c === '/' && n === '*') { i = s.indexOf('*/', i) + 1; continue; }
    if (c === '\'' || c === '"') { for (i++; s[i] !== c; i++) if (s[i] === '\\') i++; prev = 'x'; continue; }
    if (c === '`') { for (i++; s[i] !== '`'; i++) { if (s[i] === '\\') i++; else if (s[i] === '$' && s[i + 1] === '{') i = blockEnd(s, i + 1); } prev = 'x'; continue; }
    if (c === '/' && /[(,=:\[!&|?{};]|^$/.test(prev)) { for (i++; s[i] !== '/'; i++) { if (s[i] === '\\') i++; else if (s[i] === '[') { for (i++; s[i] !== ']'; i++) if (s[i] === '\\') i++; } } prev = 'x'; continue; }
    if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
    else if (c === ';' && depth === 0) return i;
    if (!/\s/.test(c)) prev = c;
  }
  return s.length;
}
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const norm = (t) => strip(t).replace(/\s+/g, ' ').trim();
function units(src) {
  const u = {}; let m;
  const reF = /^(?:async )?function ([A-Za-z0-9_$]+)\(/gm;
  while ((m = reF.exec(src))) { const o = src.indexOf('{', src.indexOf(')', m.index)); u[m[1]] = src.slice(m.index, blockEnd(src, o) + 1); }
  const reC = /^(?:const|let|var) ([A-Za-z0-9_$]+)\s*=/gm;
  while ((m = reC.exec(src))) { if (!u[m[1]]) u[m[1]] = src.slice(m.index, stmtEnd(src, m.index) + 1); }
  const reE = /^exports\.([A-Za-z0-9_$]+)\s*=/gm;
  while ((m = reE.exec(src))) u['exports.' + m[1]] = src.slice(m.index, stmtEnd(src, m.index) + 1);
  return u;
}
function closure(U, root) {
  const seen = new Set([root]); const q = [root];
  while (q.length) {
    const body = strip(U[q.pop()] || '');
    for (const k of Object.keys(U)) {
      if (seen.has(k) || k.startsWith('exports.')) continue;
      if (new RegExp('(^|[^A-Za-z0-9_$.])' + k.replace(/\$/g, '\\$') + '(?![A-Za-z0-9_$])').test(body)) { seen.add(k); q.push(k); }
    }
  }
  return seen;
}
const SECRET = /sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|whsec_[A-Za-z0-9]{10,}|(sk|rk)_live_[A-Za-z0-9]{10,}/;
function lineDiff(a, b) {
  const x = a.split(/;\s|\{\s|\}\s/), y = b.split(/;\s|\{\s|\}\s/); const out = [];
  const sy = new Set(y), sx = new Set(x);
  x.filter((l) => !sy.has(l)).slice(0, 6).forEach((l) => out.push('   - ' + l.slice(0, 160)));
  y.filter((l) => !sx.has(l)).slice(0, 6).forEach((l) => out.push('   + ' + l.slice(0, 160)));
  return out.join('\n');
}
if (require.main === module) {
  const [, , fnList, ...files] = process.argv;
  if (!fnList || files.length < 2) { console.error('Uso: node comparar-funcao.js <funcao[,funcao2]> <A.js> <B.js> [C.js ...]'); process.exit(2); }
  const U = files.map((f) => units(fs.readFileSync(f, 'utf8')));
  let anyDiff = false;
  console.log('Ficheiros: ' + files.map((f, i) => `[${String.fromCharCode(65 + i)}] ${f}`).join('  '));
  for (const fn of fnList.split(',')) {
    const root = 'exports.' + fn;
    console.log('\n=== ' + fn + ' ===');
    const present = U.map((u) => !!u[root]);
    if (!present.every(Boolean)) { console.log('  Ausente em: ' + present.map((p, i) => (p ? null : String.fromCharCode(65 + i))).filter(Boolean).join(', ')); anyDiff = true; continue; }
    const names = new Set(); U.forEach((u) => closure(u, root).forEach((n) => names.add(n)));
    let same = 0;
    for (const n of [...names].sort()) {
      const texts = U.map((u) => u[n]);
      if (texts.some((t) => t === undefined)) { console.log(`  ~ ${n}: não existe em ${texts.map((t, i) => (t === undefined ? String.fromCharCode(65 + i) : null)).filter(Boolean).join(', ')}`); anyDiff = true; continue; }
      const ns = texts.map(norm);
      if (ns.every((t) => t === ns[0])) { same++; continue; }
      anyDiff = true; console.log(`  ≠ ${n}: DIFERE entre ficheiros`);
      if (texts.some((t) => SECRET.test(t))) console.log('    (contém padrão de segredo: texto omitido)'); else for (let i = 1; i < ns.length; i++) { console.log(`    A→${String.fromCharCode(65 + i)}:`); console.log(lineDiff(ns[0], ns[i])); }
    }
    console.log(`  ${same} unidade(s) idêntica(s) em todos os ficheiros; ${names.size - same} com diferenças.`);
  }
  process.exit(anyDiff ? 1 : 0);
}
module.exports = { units, closure, norm };
