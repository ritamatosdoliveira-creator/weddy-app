# Implementação da quota de uploads (K.3-B)

**Estado:** implementado e testado **localmente** (emulador + Storage simulado). Não publicado. Quotas de produção inalteradas.

## 1. Auditoria prévia (confirmada no código)
Fluxos: `rsvp.html` (convidado com convite, pasta `memories/{casamento}/{tokenConvite}/`) e `memorias.html` (QR público, pasta `.../publico/`). Ambos fazem `put` direto no Storage e depois criam `memories/{id}` (campos fixos). Tokens/entidades: `guests/{token}` (convite) e `weddings/{id}` (Premium). Sem conta: não é necessário login (inalterado). Risco: sem limite de nº de ficheiros; custo ~8 MB × N.

## 2. Valores finais — **aprovados** (decisão da Rita, K.3 consolidação)
| Limite | Valor | Fundamentação |
|---|---|---|
| Tamanho por foto | 8 MB (**já existente** nas regras) | mantido |
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
