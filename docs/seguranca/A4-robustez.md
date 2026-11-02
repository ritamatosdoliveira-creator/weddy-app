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

## Limitações e decisões
- A reparação é **em memória**: o valor corrompido só desaparece do servidor quando o casal editar e guardar (o backup local e o incidente ficam). Não escrevo no servidor automaticamente.
- Valores escalares (`number`, `boolean`) não são validados aqui: continuam a ser validados onde são usados (ex.: `moneyNum`).
- Campos de tipo certo mas conteúdo estranho (ex.: datas inválidas) não são tratados nesta fase.
- Falta (A.4, restante): lacunas EN, testes automáticos no repositório sem depender de `/tmp/sx` (CI), e a validação do `json` no servidor ao gravar (as regras não conseguem validar o `json`; requer função).
