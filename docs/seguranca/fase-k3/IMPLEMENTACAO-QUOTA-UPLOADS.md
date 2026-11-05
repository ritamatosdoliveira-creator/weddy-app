# Implementação da quota de uploads (K.3-B)

**Estado:** implementado e testado **localmente** (emulador + Storage simulado). Não publicado. Quotas de produção inalteradas.

## 1. Auditoria prévia (confirmada no código)
Fluxos: `rsvp.html` (convidado com convite, pasta `memories/{casamento}/{tokenConvite}/`) e `memorias.html` (QR público, pasta `.../publico/`). Ambos fazem `put` direto no Storage e depois criam `memories/{id}` (campos fixos). Tokens/entidades: `guests/{token}` (convite) e `weddings/{id}` (Premium). Sem conta: não é necessário login (inalterado). Risco: sem limite de nº de ficheiros; custo ~8 MB × N.

## 2. Valores finais — **aprovados** (decisão da Rita, K.3 consolidação)
| Limite | Valor | Fundamentação |
|---|---|---|
| Tamanho por foto | 8 MiB (**já existente** nas regras) | mantido. **Nota de fronteira:** `storage.rules` usa `size < 8 * 1024 * 1024` (estrito: um ficheiro de exatamente 8 MiB é recusado **na origem**), enquanto o servidor usa `size > MEMORIES_MAX_FILE_BYTES` (aceita até 8 MiB inclusive). A diferença é inofensiva: as regras são mais estritas e atuam primeiro, por isso o servidor nunca vê um ficheiro de exatamente 8 MiB nem dessincroniza os contadores; o limite efetivo é **< 8 MiB** |
| Tipos | JPEG/PNG/WebP/HEIC/HEIF/GIF (**já existente**) | mantido |
| Fotos por convite | 20 | um convidado típico partilha poucas fotos; limita um convite abusado a 160 MB |
| Fotos no QR público | **500** (decidido; a proposta inicial era 300) | o QR é partilhado por todos os visitantes |
| Fotos por casamento | 2000 | casamento grande (200 convidados × 10) |
| Bytes por casamento | 5 GB | 8 MB × 2000 = 16 GB seria o teto teórico; 5 GB limita o custo (~0,1 €/mês de armazenamento, **estimativa** a confirmar na tabela Google) |
Parâmetros: `MEMORIES_MAX_FILES_PER_INVITE`, `MEMORIES_MAX_FILES_PUBLIC_QR`, `MEMORIES_MAX_FILES_PER_WEDDING`, `MEMORIES_MAX_MB_PER_WEDDING` (`defineInt`, alteráveis sem mudar código). Valores efetivos confirmados no código (`defineInt`): 20 / 500 / 2000 / 5120 MB, e por teste (`k3-quota-defaults`). Em produção só se aplicam após publicação autorizada.

### Consolidação (código e testes)
- QR público alterado de 300 para **500** (`defineInt` por defeito). Constantes de recurso `MEMORIES_QUOTA_DEFAULTS` = 2000 / 5120 MB / 20 / 500: se o parâmetro não estiver resolvido, `value()` devolveria 0 e **recusaria todas as fotos**; agora usa-se sempre o valor aprovado (defeito encontrado ao testar fora do deploy).
- `k3-quota-defaults` (10 casos): valores efetivos sem variáveis de ambiente; convite 20.ª/21.ª; QR 500 (20 rajadas simultâneas de 25) e a 501.ª recusada; casamento a 2.000.ª entra e a 2.001.ª é recusada; 5 GB exatos entram e o byte seguinte é recusado (contadores semeados nas fronteiras de casamento/bytes por razões de duração). Concorrência: `k3-quota` (40 pedidos / limite 10; mesmo ficheiro 15×). 500 transações simultâneas num só documento não foram usadas como teste (esgotam o emulador; cenário irreal).

## 3. Desenho
- Contador `memoryQuota/{casamento}` (ficheiros, bytes, por convite com **hash** do token, `full`) e registo idempotente `items/{sha256(path)}`; só o servidor escreve.
- Quatro triggers: documento criado / ficheiro finalizado (contam, uma só vez, em **transação**); documento apagado / ficheiro apagado (libertam). `retry: true` + repetição com espera aleatória em contenção.
- Acima do limite: apaga o ficheiro e o documento recusados e regista a recusa (motivo, hash do token, validade 90 dias).
- `firestore.rules`: com `full=true` o álbum recusa novos documentos (feedback imediato ao convidado: "este álbum não está a receber fotos"); o contador é legível pelos donos e não escrevível por clientes.
- O `weddingId` vem do caminho/documento validado pelas regras (token tem de pertencer ao casamento); o contador é por esse id, logo mudá-lo não contorna limites de outro casamento.
- `deleteWeddingAccount` apaga contador e registos.

## 4. Limitações
- A recusa por convite/bytes é **a posteriori** (o ficheiro existe segundos até ser apagado); só "álbum cheio" bloqueia antes. O convidado pode ver "enviado" e a foto desaparecer (mensagem específica para convite cheio: pendência).
- Storage Rules não podem contar; ficheiros enviados sem documento são contados pelo trigger do ficheiro.
- A UI do casal ainda não mostra "X de N" (o contador já é legível; pendência P-K3-6).
- Não testado com Storage/Eventarc reais (K.3-G/runbook).

## 5. Testes
`k3-quota` (32): normal, limite, concorrência (40 pedidos / limite 10 → exatamente 10), repetição, ficheiro inválido, tamanho, casamento diferente, falha parcial, libertação, token completo nunca gravado. `k3-quota-rules` (12). **Defeito encontrado e corrigido pelos testes:** documento de quota criado por uma recusa não tinha `files/bytes` (NaN) e contenção causava `ABORTED` → normalização e repetição com espera.


## Correções pós-auditoria (P1 e P3) — implementado e testado só em emulador/Storage simulado
**P1 — documento sem ficheiro e coerência do caminho.**
- Só o **objeto real** do Storage conta: o evento do documento lê os metadados do ficheiro; se não existe, **não cria item nem incrementa nada** (`memoryQuotaAccountOnce` devolve `pending` sempre que o tamanho é desconhecido e o item não existe). O documento fica em `memoryQuotaPending/{memoryId}` com prazo de 60 min; a rotina `memoryQuotaReconcile` volta a verificar: se o ficheiro apareceu conta-o (idempotente), senão apaga o documento sem tocar na quota.
- **K.4:** este mecanismo foi refinado (ver `../fase-k4/RELATORIO-FASE-K4.md`): o documento passa a ter **dono** (1:1), a quota é libertada pelo **objeto** com marcador terminal, `memoryQuotaPending` já não guarda o caminho, e a reconciliação isola erros por entrada.
- Um erro **transitório** ao ler os metadados (≠ 404) sobe para o retry do trigger (não é confundido com "sem ficheiro").
- Coerência: o documento só é válido se `weddingId` e `token` coincidirem com `memories/{weddingId}/{token}/{ficheiro}`. As regras Firestore passam a exigi-lo na criação (`split('/')`, 4 segmentos); no servidor, um documento incoerente é apagado **sem** tocar no ficheiro nem na quota, e o seu apagamento **não** liberta a quota de ninguém (`ignore_incoherent`).
- Objeto e documento continuam a poder chegar por qualquer ordem: idempotência por `sha256(caminho)`; objeto→documento = duplicado; documento→objeto (ficheiro visível) = conta uma vez com o tamanho real.

**P3 — limpeza recuperável.** A recusa grava, na **mesma transação**, `memoryQuotaCleanupQueue/{hash}` {weddingId, path, attempts, giveUp}. A limpeza (apagar ficheiro e documentos) devolve `done`; se falhar, regista tentativas e último erro, e o erro **sobe** para o retry do trigger até 5 tentativas (depois deixa de lançar: sem loop infinito). A rotina horária `memoryQuotaReconcile` (onSchedule, `every 60 minutes`) retoma as entradas até 20 tentativas totais e depois marca `giveUp` com erro registado para intervenção manual. Tudo idempotente; a limpeza nunca altera contadores.

**Limitações / riscos residuais (não validados em serviços reais):**
- A fila de limpeza guarda o **caminho completo (inclui o token do convite)** até a limpeza ter sucesso (K.4: `memoryQuotaPending` já não guarda caminho); coleção só-servidor, sem regras de cliente. Entradas `giveUp` ficam até intervenção/eliminação da conta.
- ~~Dois documentos coerentes podem apontar para o mesmo ficheiro real; apagar um liberta a quota~~ — **corrigido na K.4** (1:1, dono, libertação pelo objeto).
- A rotina horária precisa de Cloud Scheduler em produção: **não validada**; os testes chamam `memoryQuotaReconcile` diretamente.
- O contador único por casamento continua a ser um ponto de contenção sob picos reais (P2): o número de tentativas internas subiu de 12 para 25 e os triggers têm `retry:true`, mas não há validação em Firestore real.
