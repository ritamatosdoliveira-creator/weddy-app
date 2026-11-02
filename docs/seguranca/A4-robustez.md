# A.4 — Robustez e integridade dos dados (estado corrompido → app em branco)

Estado: **local, commit local, nada publicado**.

## Problema
Todo o casamento vive num `json` que o cliente escreve. Um campo com o tipo errado (`null`, texto, objeto onde devia haver lista, lista com `null`) fazia rebentar uma função de desenho ou uma migração. Como `render()` concatenava as 15 páginas numa só expressão e o handler do snapshot corria as migrações em sequência, **uma única exceção** deixava a app em branco, ou presa no ecrã "A verificar a tua conta…" porque `firstSyncDone` nunca chegava a ser marcado.

## O que mudou (`app/index.html`)
1. **`a4SanitizeState`** valida o estado que chega (snapshot do servidor e restauro do histórico) contra a estrutura de `seedData()`: tipos de contentor errados são repostos pelo valor por defeito **só em memória**; listas de objetos perdem entradas que não são objetos; `guests`, `seating` e `honeymoon` ganham as estruturas em falta; chaves `__proto__`/`constructor`/`prototype` são removidas. Raiz que não é objeto (`null`, número, lista, texto) nunca substitui o estado local.
2. **Rasto, sem perda silenciosa:** o valor original removido fica num backup local (`localStorage`, `weddy-corrupt-backup-<id>`) e é registado um incidente (`_incident_log`, só caminhos e contagem, uma vez por sessão).
3. **`safeView` por página:** cada uma das 15 páginas desenha-se isolada. Se uma falhar, mostra "Esta secção não abriu / Tentar de novo" (tipografia e cores Weddy, componente `empty-note` + `cb-btn` existentes) e as restantes continuam.
4. **`safeStep` nos passos críticos:** tema, barra de separadores, `bindHandlers`, Mesa 3D, acessibilidade, alerta de pagamentos, botão do assistente, as 4 migrações e o backup automático. Um passo que falhe já não impede os seguintes.
5. **Snapshot à prova de falhas:** o corpo do `onSnapshot` está num `try/catch`; se falhar a meio, a app desenha com o estado local e conclui a 1.ª sincronização (esconde o login).

## Testes (todos passam)
| Teste | Casos |
|---|---|
| Estado válido não é alterado (0 reparações) | 1 |
| Matriz topo: 27 chaves × 8 valores errados → reparar + desenhar sem falhas | 216 |
| Mesma matriz **sem** sanitizar: `render()` nunca lança, 15 páginas desenhadas (79 com aviso isolado) | 216 |
| Profundidade 2: 37 caminhos × 8 valores | 296 |
| 17 casos concretos (guests=null, todoCategories='x', expenses com nulos, seating=null, budget=null, cake.tiers={}, …) | 17 |
| Snapshot corrompido, json truncado, json null/array/número/texto, em telemóvel e desktop | 20 |
| `__proto__`, raiz inválida, backup local, 6000 convidados + 3000 despesas (<300 ms), retry, sem overflow, sem erros JS | 8 |
Regressão: A.2 (28 + 32 + 14), ficha do convidado (11), RSVP (42), consentimento, contacto, resumo, backfill, regras.

## Fecho da A.4 (2026-11-02)

### A.4.1 — Inglês
- Paridade de chaves `APP_I18N` pt/en (2346) e `rsvp.html` (141) verificada por teste. Sem chaves em falta.
- Corrigido: mensagem de manutenção (segue o idioma do navegador), erros lançados pela app (bilingues pelo idioma da app), seletor de país do telefone (nomes em EN), vista de recuperação ("This section did not open / Try again"), pedidos pendentes de WhatsApp (texto honesto PT/EN).
- Teste `tests/ui/i18n_en.py`: 15 separadores × (dados de origem + estado corrompido) × (telemóvel + desktop) sem linhas com português.
- **Limitação conhecida (decisão da Rita pendente):** o conteúdo semeado por defeito nos dados do casal (categorias de orçamento, "Crianças", títulos da lista de tarefas inicial) é texto guardado em português nos dados de cada utilizador. Os testes ignoram-no. Mostrar a tradução EN seria um mapeamento só de visualização (não altera dados); não está implementado.

### A.4.2 — Testes permanentes
Estrutura em `tests/` (ver `tests/README.md`): `npm test` corre as 19 suites com emuladores locais e gera `tests/reports/last-run.md`. Já não há dependência de `/tmp/sx`; as suites antigas foram portadas para `tests/ui/` (a pasta `tests/robustness/` foi removida).

### A.4.3 — Validação do estado no servidor
- **Porquê depois da escrita:** as regras do Firestore só veem o campo `json` como string; o conteúdo só pode ser validado numa function. Mover a escrita para um *callable* seria uma alteração de arquitetura (a app escreve diretamente com sincronização em tempo real) — **não feito; fica como opção para decisão da Rita**.
- **Regras (novas):** `json` tem de ser `string` com ≤ 900 000 caracteres (create e update); `weddingStateQuarantine` sem acesso de cliente.
- **Function `validateWeddingStateOnWrite`** (trigger em `weddings/{id}`; `index.js`): `validateWeddingState(raw)` classifica em `ok` / `repairable` / `invalid`:
  - *invalid* (grave): não é string, > 900 000 caracteres, JSON inválido, raiz não objeto, profundidade > 24, > 4 000 chaves num objeto, arrays > 20 000, > 200 000 nós, chaves `__proto__`/`constructor`/`prototype`.
  - *repairable*: tipo errado/`null` num contentor conhecido (`STATE_SHAPE`, igual a `seedData()` — há teste de paridade). Só regista; o saneador do cliente trata.
  - *ok*: tudo o resto. **Campos em falta (dados antigos) e campos inesperados nunca são erro nem são removidos.**
- **Modos (`STATE_VALIDATE_MODE`):** `off` (defeito; nada acontece), `report` (regista e guarda quarentena), `enforce` (reverte no caso grave para o `before` do evento, só se esse já era válido e o documento ainda tem a versão rejeitada; guarda sempre a cópia em `weddingStateQuarantine` com `expireAt` de 30 dias e marca `stateGuard` no casamento).
- **Sem migrações destrutivas:** nada é reescrito em dados válidos; a quarentena preserva o conteúdo rejeitado.
- **Custo:** 1 invocação do trigger por gravação do casamento (a app grava com frequência: autosave) + escritas só em caso grave. Pequeno, mas é novo custo recorrente: **confirmar antes de ativar**. Sugestão: política TTL do Firestore em `weddingStateQuarantine.expireAt`.
- **Publicação:** a function nasce em `off`; passar a `report` primeiro, observar os logs e só depois `enforce`.
- Testes: `tests/validate/state-validation.test.js` (55), `tests/rules/state-rules.test.mjs` (13), `tests/ui/state_shape.py` (3, inclui 104 corrupções onde tudo o que o cliente repara o servidor sinaliza).

## Limitações e decisões
- A reparação no cliente é **em memória**: o valor corrompido só desaparece do servidor quando o casal editar e guardar (o backup local e o incidente ficam).
- Valores escalares (`number`, `boolean`) não são validados em profundidade: validam-se onde são usados (ex.: `moneyNum`).
- Campos de tipo certo mas conteúdo estranho (ex.: datas inválidas) não são tratados nesta fase.
