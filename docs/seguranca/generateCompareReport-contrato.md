# Weddy Compare — origem das funções do servidor e contrato esperado

Estado: **investigação concluída, função NÃO reconstruída** (pedido: documentar antes de reconstruir).
Data: 2026-11-01. Tudo local, nada executado em produção.

## 1. Resultado da investigação

**O código-fonte das funções do Comparador não existe em nenhum sítio a que esta sessão tem acesso.**

| Onde procurei | Resultado |
|---|---|
| `weddy-app`, working tree (`index.js`, todas as pastas) | `generateCompareReport` só aparece em 2 linhas de `app/index.html` (um comentário e a chamada `httpsCallable`). Nenhuma definição. |
| `weddy-app`, histórico git (`git log --all -S`, 320 commits) | Único commit com o nome: `0e1ef1e` "Comparador: lançamento (cliente + cache v256)". Altera só `app/index.html` e `app/sw.js`. |
| `weddy-app`, 44 branches remotas (incl. `comparador-go-live`, `comparador-v7-orientacao-v266`, `comparador-v269-relatorio`, `v274-comparador-mobile`) | `index.js` dessas branches não contém a função. |
| `weddy-premium-app-teste` (`index.js`, 2643 linhas) | Versão antiga: não tem Comparador. |
| `weddy-rsvp-teste`, `casamento`, `financas` | Sem pastas de functions. |
| Pesquisa de código no GitHub (conta `ritamatosdoliveira-creator`) | 0 resultados. |
| Computador da Rita (pasta `functions-deliverable/`, referida em comentários) | **Não consegui verificar:** o computador não estava ligado à sessão. |
| Endpoints em produção (`https://europe-west1-weddy-app-bd12f.cloudfunctions.net/…`) | **Não consegui sondar:** o acesso de rede desta sessão só permite sites autorizados. Não sei, portanto, se as funções estão implantadas. |

### Funções que o cliente chama e que NÃO estão no `index.js` do repositório
| Função | Chamada em | Tipo |
|---|---|---|
| `generateCompareReport` | `app/index.html` (`cmpGenerateReport`) | callable, Premium (o ecrã do Comparador exige `hasActiveSubscription()`) |
| `analyzeCompareProposal` | `app/index.html` (`cmpAnalyze`) | callable, lê ficheiros do Storage e envia-os à OpenAI |
| `sendContactMessage` | `contactos.html` (`fetch` POST direto, sem login) | HTTP público |

As três funcionam, ou falham, sem que o repositório as descreva. Isto é um risco por si só (não há revisão, histórico nem testes) e é o ponto 1 a resolver antes de qualquer auditoria.

### Hipóteses para a origem (por ordem de probabilidade)
1. Foram escritas e implantadas a partir de uma pasta local (`functions-deliverable/index.js`, mencionada nos comentários do `index.js`) que nunca foi enviada para o GitHub.
2. Foram implantadas no projeto de teste (`weddy-premium-teste`) e não no de produção (`weddy-app-bd12f`). Nesse caso, em produção o Comparador falha ao analisar/gerar relatório, o que coincide com o "relatório preso" reportado antes.
3. Nunca foram implantadas (só o cliente foi publicado em `0e1ef1e`).

4. (Acrescentada) O código pode estar em `~/weddy-app/functions` (ou `~/weddy-app/functions-deliverable`) no Mac da Rita, fora do Git, ou implantado a partir de outra pasta. Procurar: `grep -rl "generateCompareReport" ~/weddy-app ~/Desktop ~/Downloads 2>/dev/null` e `git -C ~/weddy-app status --ignored | grep -i functions`.

### O que a Rita pode confirmar em 2 minutos (sem risco)
```
firebase functions:list --project weddy-app-bd12f      # estão implantadas?
firebase functions:list --project weddy-premium-teste
```
E enviar-me o ficheiro-fonte (ou colocá-lo no repositório numa branch) para auditar.

## 2. Contrato esperado (extraído do cliente)

### 2.1 `generateCompareReport` — pedido
`httpsCallable('generateCompareReport', { timeout: 115000 })` com:
```
{ compareId: string, lang: 'pt'|'en', weddingId?: string }
```
- `weddingId` vem de `currentWeddingId` e **não pode ser confiável** (ver 3).
- Antes do pedido o cliente faz `pushRemoteImmediate()`: o servidor lê o estado a partir de `weddings/{id}.json`.

### 2.2 Dados utilizados (lidos no servidor, nunca vindos do pedido)
Em `JSON.parse(weddings/{weddingId}.json)`:
- `state.compares[]` com `id === compareId`: `category`, `priorities[]` (até 3 de `price_low`, `more_services`, `longer_duration`, `flexibility`, `payment_terms`, `fewer_extra_costs`), `priorityLevels{ [prioridade]: 'essential' }`, `proposals[]` (até 4, `id`, nome, `fields`).
- `proposal.fields[k]`, com `k` em `price, vat, services, hours, travel, extras, payment, deposit, deadline, cancellation, validity, exclusions`; só conta o campo **confirmado** (`src === 'manual'` ou `confirmed === true`), com `v` string não vazia, cortada a 700 caracteres. Rascunhos da IA por rever (`proposal.ai.draft`) nunca entram.
- Categorias ocultas: `convites`/`vestuario` sem `hours, travel`; `decoracao` sem `hours`.
- Elegibilidade (igual ao cliente, `cmpReportEligible`): ≥ 2 propostas e ≥ 2 com algum campo confirmado.
- `state.categories` só para o nome da categoria.
- Regras de preço (`cmpParsePrice`): "IGUAL no servidor e na app" (comentário do cliente): um preço total, explícito, em euros; nunca "o primeiro número" de um texto com vários valores.

### 2.3 Resposta
```
{ report: {
    summary[], priceVsServices[], additionalCosts[], attentionPoints[],   // frases { text, proposalId|null, basis[{proposalId, field}], scope? }
    orientation: { status: 'aligned'|'balanced'|'insufficient', proposalId, reasons[{...,priority}], otherStrengths[], code, comparable[], noData[], essential[] },
    strengths[{ proposalId, statements[] }],
    priorityNotes[{ priority, observations[] }],
    questions[{ proposalId, field|null, text }] },
  generatedAt: ISO, sig: string, lang: 'pt'|'en', model: string,
  priorities: string[], priorityLevels: string[] }
```
O cliente rejeita frases sem `basis` (cada afirmação tem de apontar para campos confirmados) e limita o número de itens. `sig` tem de ser o mesmo hash que `cmpSigOf` (djb2 sobre categoria, prioridades, níveis e campos confirmados das ≤ 4 primeiras propostas) para o ecrã saber se o relatório ficou desatualizado.

### 2.4 Erros que o cliente já trata
`resource-exhausted`, `failed-precondition`, `permission-denied`, `not-found`, `invalid-argument` (mostram `message` se < 260 caracteres), `unauthenticated`, `deadline-exceeded`, `unavailable`.

### 2.5 `analyzeCompareProposal` (contrato resumido)
Pedido: `{ compareId, proposalId, documentPaths: string[≤3], weddingId? }`, timeout 170 s. Resposta: `{ fields{ [k]: {v, src:'explicit'|'inferred'|'not_stated', needsConfirmation, evidence} }, supplierName{v,src,evidence}, warnings[≤5], documentReadable, filesAnalyzed, analyzedAt }`. O texto da app promete "máximo de 3 ficheiros por análise e 10 análises por dia" e que os ficheiros são enviados à OpenAI (tem de constar na política de privacidade).

## 3. Autorização Premium necessária (requisitos de segurança)
Qualquer implementação tem de, **por esta ordem**:
1. Recusar sem sessão ou com `email_verified !== true` (`unauthenticated`).
2. Resolver o casamento com `resolveWeddingId(request, true)` (email do token ∈ `ownerEmails`). **Ignorar** `data.weddingId`, ou aceitá-lo apenas se esse casamento tiver o email do token em `ownerEmails` (um dono pode ter mais de um casamento; o cliente envia o aberto no ecrã).
3. `assertPremiumWedding(weddingId)` (Premium ativo e dentro de 12 meses) **antes de qualquer custo** (leitura de ficheiros, chamada à OpenAI). Premium expirado → `permission-denied`.
4. Quota diária por casamento em transação (`checkAndIncrementAiUsage` ou equivalente próprio do Comparador; o texto promete 10 análises/dia) e um limite por comparação para evitar regenerações em ciclo.
5. Ler o estado **só** do documento do casamento; validar `compareId` ∈ `state.compares`, `proposalId` ∈ propostas, e que cada `documentPaths[i]` começa por `documents/{weddingId}/` e corresponde a um item de `state.weddingDocuments` dessa proposta (nunca ler um caminho arbitrário do Storage: sem isto, um dono lia ficheiros de outro casamento).
6. Limitar tamanho (≤ 15 MB por ficheiro, ≤ 3 ficheiros, tipos PDF/imagem), tempo (≤ 115/170 s) e a saída ao contrato (2.3), descartando qualquer campo extra devolvido pelo modelo.
7. Não registar texto das propostas nos logs (só ids e tamanhos).
8. Resistir a *prompt injection* nos documentos: o modelo só extrai/compara; a saída é validada contra o esquema e cada afirmação tem de ter `basis` válida.

### Testes a escrever (emulador, sem OpenAI real: modelo simulado)
Sem sessão; email não verificado; sem Premium; Premium expirado; `weddingId` de outro casamento; `compareId` inexistente; `documentPaths` de outro casamento; > 3 ficheiros; quota esgotada (a 11.ª análise); duas chamadas em simultâneo (transação); saída do modelo malformada/extra; frase sem `basis`; elegibilidade (< 2 propostas confirmadas); `sig` igual ao do cliente.

## 4. Lacunas que isto cria para a A.3
- Armazenamento: as propostas ficam em `documents/{weddingId}/…`. Com as regras A.3, carregar exige Premium; ler/apagar continua a ser do dono.
- `sendContactMessage` (HTTP público, sem login): precisa de ser auditada à parte (spam/relay de email, limite por IP, validação de campos). Sem o código, não posso dizer se tem proteção.

## 5. Próximo passo (decisão da Rita)
Enviar o código das 3 funções (ou confirmar que não existem em produção). Só depois: auditoria, testes do ponto 3 e, se for preciso, reescrita seguindo este contrato.
