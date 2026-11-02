/* Ponte para os testes de UI: corre o motor REAL do servidor (sem rede nem Firestore) sobre o estado dado.
 * stdin: {state, data}  →  stdout: resposta no formato de generateSeatingProposal. */
'use strict';
process.env.WEDDY_EXPOSE_INTERNALS_FOR_TESTS = '1';
process.env.OPENAI_API_KEY = 'fake-NOT-REAL';
const path = require('path');
module.paths.unshift(path.join(__dirname, '..', 'node_modules'));
const T = require(path.join(__dirname, '..', '..', 'index.js'))._test;
let buf = ''; process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', () => {
  const { state, data } = JSON.parse(buf);
  const tables = T.seatingNormalizeTables(state.seating && state.seating.tables);
  const guests = T.seatingEligibleGuests(state);
  const ids = new Set(guests.map((g) => g.guestId));
  const constraints = (data.constraints || []).map((c) => ({ ...c, guestIds: (c.guestIds || []).filter((g) => ids.has(g)) })).filter((c) => c.guestIds.length >= 2);
  const attrs = T.sanitizeSeatingAttrs(data.attrs, ids);
  const mode = data.mode === 'optimize' ? 'optimize' : 'auto';
  process.stdout.write(JSON.stringify(T.seatingCompute({ clientState: state, guests, tables, constraints, attrs, mode, unresolvedFreeText: [], ambiguousFreeText: [] })));
});
