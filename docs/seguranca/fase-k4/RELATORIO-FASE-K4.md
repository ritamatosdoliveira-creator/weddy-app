# Fase K.4 — Integridade, quotas e reconciliação (pós-auditoria de riscos residuais)

**Estado:** implementado e testado **só em emulador (Firestore) com Storage simulado**. Nada foi validado em Firebase real (Storage, Eventarc, Cloud Scheduler). Sem commit, sem deploy, sem push.

## 1. Modelo (o que mudou e porquê)

### 1.1 Relação 1:1 objeto ↔ documento (R2)
- O **objeto** do Storage é a unidade de quota. Cada objeto tem um item `memoryQuota/{casamento}/items/{sha256(caminho)}`.
- O item guarda `ownerMemoryId`: o **primeiro documento válido** (coerente com o caminho e com o objeto existente) torna-se dono. A reivindicação é feita numa transação que também confirma que o documento ainda existe.
- Um segundo documento para o mesmo caminho **nunca** é dono: o servidor apaga-o (`duplicate_doc_deleted`). Dois em simultâneo: a transação serializa e só um fica.
- Apagar um documento **não dono** nunca liberta quota (`not_owner`). Documentos incoerentes continuam a ser apagados sem tocar na quota (K.3).
- Ciclo de vida do dono: objeto primeiro → item sem dono → o evento do documento reivindica; documento primeiro (ficheiro já visível) → item criado já com dono.

### 1.2 Libertação pelo objeto (R1)
Fluxo ao apagar o documento dono (`memoryQuotaHandleDocDeleted` → `memoryQuotaOwnerDelete`):
1. O servidor apaga o objeto (`delete({ignoreNotFound:true})`). Falha → **não liberta**, grava a entrada `memoryQuotaCleanupQueue` (`kind:'owner_delete'`) e o erro sobe (retry do trigger, máx. 5); depois a reconciliação retoma.
2. `memoryQuotaRelease` **confirma** que o objeto já não existe (`getMetadata` → not-found). Existe → `object_exists` (nada é libertado). Erro transitório → sobe (retry).
3. Só então a transação liberta e marca o item `released`.

O evento de objeto apagado (`memoryQuotaOnObjectDeleted`) usa a mesma função (mesma confirmação). A Firestore e o Storage **não** são atómicos: o desenho tolera a falha entre os dois (a quota nunca é libertada antes de o objeto ter desaparecido; o pior caso é libertar com atraso).

### 1.3 Marcadores terminais e eventos tardios (R3)
- Estados do item: `accepted → released` (marcador) e `refused` (final). Um item `released`/`refused` **nunca volta a `accepted`**; eventos tardios devolvem `released_ignored`.
- Se a eliminação for processada **antes** do evento de criação (não existe item), a libertação grava um marcador `released` (`tombstoned`) depois de confirmar que o objeto não existe: o evento de criação tardio fica ignorado.
- Retenção técnica: `expireAt` = +30 dias nos marcadores `released`, +90 dias nos `refused`. **O TTL do Firestore não está ativo** em nenhum projeto, por isso estes campos ainda não eliminam nada. A janela de 30 dias é uma margem técnica **a validar** contra o tempo máximo real de reentrega de eventos (não verificado); não é um prazo legal.

### 1.4 Casamento eliminado (R8)
- `deleteWeddingAccount` chama `memoryQuotaPurgeWedding`: o documento `memoryQuota/{id}` é **substituído** por um marcador `{deleted:true, weddingId, deletedAt, expireAt}` (+30 dias) e depois apagam-se os itens. Qualquer transação de quota lê o contador, vê `deleted` e **não escreve nada** (`wedding_deleted`). Serializabilidade: uma transação em curso que leu o contador antigo é abortada pelo marcador e repete.
- Escolha do marcador no próprio documento do contador, **sem coleção nova**. Os IDs de casamento são gerados pelo Firestore (`doc()` automático), por isso não são reutilizados. O marcador só pode ser eliminado com segurança depois de passar toda a janela de reentrega de eventos (a confirmar em Firebase real); a eliminação do marcador depende do TTL (por ativar) ou de limpeza manual.
- Filas (`memoryQuotaCleanupQueue`, `memoryQuotaPending`): as escritas de falha são feitas em transação que lê o marcador; a criação de pendentes e a criação inicial da fila de limpeza (na transação da recusa) também respeitam o marcador. Uma criação de pendente concorrente com a eliminação pode recriar uma entrada, que a reconciliação **descarta** (entrada de casamento eliminado) — janela transitória documentada, sem efeito sobre contadores nem itens.
- Limite: o fluxo real de `deleteWeddingAccount` (token, Auth, restantes coleções) continua coberto pela suite `privacy-deletion`, que não verifica estas estruturas; o comportamento do marcador é testado chamando `memoryQuotaPurgeWedding` diretamente.

### 1.5 Reconciliação robusta (R5) — `memoryQuotaReconcile`
- Cada entrada num `try/catch`: uma exceção regista a tentativa na própria entrada (sem dados privados) e **não interrompe** as outras; ao fim de 20 tentativas fica `giveUp`.
- Paginação com orçamento de tempo (200 s) e teto de 2.000 entradas por fila e por execução: trata mais de 100 entradas sem bloquear as seguintes. Pendentes que falham recebem `due` com backoff (saem da consulta); `giveUp` põe `due` em 2100-01-01.
- **Reverificação antes de apagar:** entrada `refused` só apaga se o item continuar `refused`; entrada `owner_delete` só apaga se o item continuar `accepted`, com o mesmo dono, e o documento já não existir. Caso contrário a entrada é descartada **sem tocar no objeto** (`stale`).
- Execuções paralelas: todas as operações são idempotentes; os contadores de tentativas são atómicos (pior caso: contar uma tentativa a mais).
- Limites mantidos: **5** tentativas pelo trigger e **20** totais.
- **Recuperação manual de `giveUp`** (consola/Admin, sem código novo): na fila de limpeza pôr `giveUp:false` e `attempts:0`; num pendente pôr `giveUp:false`, `attempts:0` e `due` = agora. A próxima execução horária retoma-a.

### 1.6 Sanitização central (R7)
- `memorySafeError(e)` devolve só `{code, category}`: o `code` só é aceite se for numérico ou um identificador seguro (`[A-Za-z0-9_.:-]{1,40}`; um caminho com `/` é rejeitado) e a `category` vem de padrões fixos. **Nunca** usa `e.message` em bruto.
- Usada em `lastError`, em todos os logs de quota e de reconciliação e nas mensagens de erro que sobem ao runtime (`memoryGuard` embrulha os quatro triggers: o erro que a plataforma regista é `memoryQuota: <operação> falhou (<categoria>/<código>)`).
- `memoryQuotaPending` **deixou de guardar o caminho** (guarda `weddingId`, `memoryId`, `due`, tentativas); o caminho é lido do documento `memories`. `memoryQuotaCleanupQueue` **continua a guardar o caminho completo** (inclui o token de convite) porque é necessário para apagar o objeto; é removido quando a limpeza tem sucesso. Ambas as filas são só do servidor (sem regras de cliente: negadas por omissão — testado nas regras).
- Retenção técnica das filas: `expireAt` +30 dias (+90 dias em `giveUp`); TTL por ativar. Nenhum prazo legal foi escolhido.

### 1.7 Inundação de documentos sem ficheiro (R6)
- Um documento sem objeto **não conta**, não cria item e fica marcado `quotaState:'pending'` (campo escrito só pelo servidor; as regras de criação do cliente continuam a recusar chaves extra). A galeria do casal (`carregarMemories`, alteração mínima em `app/index.html`) **ignora** documentos `pending`; quando o ficheiro aparece, a reconciliação conta-o, atribui o dono e remove o campo.
- Teto brando de **200 pendentes por casamento**: acima disso o documento é apagado de imediato (sem criar entrada). Moderador contra trabalho ilimitado nas filas; **não** impede a criação dos documentos nem as invocações dos triggers (não há rate limiting; App Check continua só em monitor).
- A reconciliação trata volumes superiores a 100 por execução.

### 1.8 Pré-leitura do item (G)
Antes da transação, lê-se o item **sem bloquear o contador**. Estados `refused`/`released` são finais e `accepted` só avança para `released`, por isso uma leitura desatualizada só pode devolver um resultado que a transação também devolveria. Duplicados de itens já definitivos deixam de abrir transação sobre o contador (medido no emulador pela contagem de chamadas a `runTransaction`: 0). Reivindicações de dono, contagens novas e libertações continuam dentro da transação. **Isto não prova redução de contenção em produção**: não há medições em Firestore real.

## 2. Estado dos riscos

| Risco | Estado anterior | Correção | Teste | Estado final |
|---|---|---|---|---|
| R1 libertação por documento | Quota libertada ao apagar o documento, mesmo com o ficheiro vivo | Só o dono liberta, depois de apagar o objeto e confirmar not-found; falha → fila + retry | k4: 4, 5, 6, 7 | Corrigido (emulador/mock) |
| R2 documentos duplicados | Vários documentos para o mesmo caminho; apagar um libertava | `ownerMemoryId` (1:1); duplicado removido; não dono nunca liberta | k4: 1, 2a, 2b, 3 | Corrigido (emulador/mock) |
| R3 eventos tardios | Item apagado na libertação → contagem fantasma | Marcador `released` (e marcador na eliminação antes da criação) | k4: 8–13 | Corrigido (emulador/mock) |
| R5 reconciliação frágil | Exceção interrompia o resto | `try/catch` por entrada, giveUp, paginação, backoff | k4: 19–26, 31, 32 | Corrigido (emulador/mock) |
| R6 inundação | Pendentes ilimitados; limite de 100/hora | Teto 200, `quotaState`, galeria ignora, paginação | k4: 31–34 | Mitigado (sem rate limiting) |
| R7 tokens em erros/logs | `e.message`/caminho nas filas | `memorySafeError`, `memoryGuard`, pendente sem caminho | k4: 27–29, regras (30) | Corrigido; caminho da fila de limpeza mantido |
| R8 casamento eliminado | Eventos tardios recriavam estruturas | Marcador `deleted` no contador | k4: 14–18 | Corrigido para contador/itens; entradas de fila podem ser recriadas transitoriamente e são descartadas |
| G contenção (R4) | Duas transações por foto sobre o contador | Pré-leitura do item | k4: 13, 13b | **Por validar em Firestore real** |

## 3. Riscos que permanecem
- **Contenção do contador único (R4)**: sem medição em Firestore real; a pré-leitura só elimina transações de duplicados.
- ~~**Objeto sem documento** continua contado e invisível~~ — **tratado na tarefa de pré-produção (R4):** um objeto aceite sem documento dono fica registado em `memoryQuotaOrphans/{hash}` (servidor; guarda o caminho até ser resolvido); passadas **6 h** (`MEMORIES_ORPHAN_GRACE_MS`, tolerância para uploads lentos/interrompidos) a rotina horária `memoryQuotaReconcile` (a mesma, sem função nova): (1) se existe um documento que ainda não reivindicou o ficheiro → reivindica e **não apaga**; (2) se o objeto já não existe → liberta depois de confirmar; (3) se o objeto existe sem documento → apaga o objeto (falha → atraso crescente e retry; 20 tentativas → `giveUp`) e **só depois de confirmar a inexistência** liberta a quota, deixando o marcador `released` (um evento tardio de criação não o volta a contar). Idempotente e segura em paralelo; não recolhe fotos com documento. **Limitações:** itens legados (K.3) sem dono **não têm** entrada de órfão (não se guarda o caminho nos itens; recolhê-los exigiria listar o Storage real — fica como plano, não implementado); uma foto cujo documento só chega depois de 6 h perde-se (o documento passa a "sem ficheiro" e é removido). Custo: +1 escrita por objeto aceite sem dono (removida quando o documento o reivindica) e uma consulta por execução; nenhuma função nova (só a rotina horária existente).
- **Documento apagado antes de ser reivindicado**: o objeto fica contado e sem dono até ser apagado (a app apaga-o; o evento de objeto apagado liberta).
- **Janela dos marcadores (30 dias)** não confirmada contra a reentrega real de eventos; sem TTL ativo, itens/marcadores acumulam-se.
- **Caminho com token na fila de limpeza** até a limpeza ter sucesso (ou `giveUp`).
- **Inundação**: o teto limita as filas, não a criação de documentos nem as execuções.
- O trigger de objeto é invocado para todo o bucket (o filtro `memories/` é interno).

## 4. A validar só em Firebase real
Contenção/latência do contador com 50/100/200 convidados; reentrega e ordem reais de eventos Eventarc (incl. tardios); semântica real de `getMetadata`/`delete` (not-found, erros transitórios); Cloud Scheduler (cadência, retries, alertas); tempo limite das funções; `count()` agregado em Firestore real; TTL dos campos `expireAt`; texto real dos erros do SDK (a sanitização é pensada para não depender dele); regras das filas implantadas.
