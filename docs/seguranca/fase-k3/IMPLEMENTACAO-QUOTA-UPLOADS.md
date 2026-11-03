# Implementação da quota de uploads (K.3-B)

**Estado:** implementado e testado **localmente** (emulador + Storage simulado). Não publicado. Quotas de produção inalteradas.

## 1. Auditoria prévia (confirmada no código)
Fluxos: `rsvp.html` (convidado com convite, pasta `memories/{casamento}/{tokenConvite}/`) e `memorias.html` (QR público, pasta `.../publico/`). Ambos fazem `put` direto no Storage e depois criam `memories/{id}` (campos fixos). Tokens/entidades: `guests/{token}` (convite) e `weddings/{id}` (Premium). Sem conta: não é necessário login (inalterado). Risco: sem limite de nº de ficheiros; custo ~8 MB × N.

## 2. Valores recomendados (por aprovar para produção — predefinição local, configurável)
| Limite | Valor | Fundamentação |
|---|---|---|
| Tamanho por foto | 8 MB (**já existente** nas regras) | mantido |
| Tipos | JPEG/PNG/WebP/HEIC/HEIF/GIF (**já existente**) | mantido |
| Fotos por convite | 20 | um convidado típico partilha poucas fotos; limita um convite abusado a 160 MB |
| Fotos no QR público | 300 | o QR é partilhado por todos; ~2 fotos por 150 convidados |
| Fotos por casamento | 2000 | casamento grande (200 convidados × 10) |
| Bytes por casamento | 5 GB | 8 MB × 2000 = 16 GB seria o teto teórico; 5 GB limita o custo (~0,1 €/mês de armazenamento, **estimativa** a confirmar na tabela Google) |
Parâmetros: `MEMORIES_MAX_FILES_PER_INVITE`, `MEMORIES_MAX_FILES_PUBLIC_QR`, `MEMORIES_MAX_FILES_PER_WEDDING`, `MEMORIES_MAX_MB_PER_WEDDING` (`defineInt`, alteráveis sem mudar código). **Estes números são uma proposta técnica; não são decisão comercial.**

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
