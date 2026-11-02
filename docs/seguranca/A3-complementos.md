# A.3 — Complementos (só análise e preparação local; nada executado em produção)

## 1. Backfill de `subscription.premiumUntil`
Ficheiros: `scripts/backfill-premium-until.js`, `tests/backfill/backfill-premium-until.test.js`.

- Dry-run por defeito; `--apply` para escrever; em projeto real exige ainda `WEDDY_CONFIRM_PROD=sim`.
- Escreve só `subscription.premiumUntil` (campo pontilhado), `startedAt + 12 meses` (mesma regra de `subscriptionExpiryDate`).
- Idempotente (2.ª execução = 0 escritas) e seguro contra corridas (transação que revalida `active`/`startedAt`).
- Datas validadas: sem `startedAt`, ilegível, não-texto ou no futuro (>1,5 dias) => NÃO escreve, vai para o relatório.
- `premiumUntil` já presente e diferente (ex.: renovação feita pelos webhooks novos) => não é pisado.
- Relatório sem emails: contagens por categoria, ids de casamento e impacto (quantos Premium já expirados deixam de poder carregar Memories/Documentos, quantos expiram em 30 dias, quantos ficam à espera de decisão).
- Testado no emulador (42 verificações). Casos "sem `startedAt`" (válidos para sempre pelas regras antigas) ficam intocados: decisão tua se devem expirar.

Procedimento sugerido (quando decidires): 1) dry-run em produção com `--report`; 2) ler o relatório; 3) `--apply`.

## 2. `generateCompareReport` (Weddy Compare)
**Resultado: o código da função não existe.** Procurei no repositório (todas as 320 revisões, as 44 branches remotas e as 3 cópias locais) e em todo o disco desta sessão: só há chamadas do cliente (`app/index.html`, `cmpGenerateReport`). O commit `0e1ef1e` ("Comparador: lançamento (cliente + cache v256)") só tem cliente.
Consequência: não posso auditar a proteção Premium. Se está deployada, o código está só na tua máquina/consola Firebase; se não está, o botão "Gerar relatório" falha sempre (coerente com o "relatório preso" reportado antes).

O que preciso para auditar (ou o que a função tem de cumprir quando for escrita/entregue):
1. O ficheiro-fonte da função deployada (`firebase functions:list` + copiar o código de `functions/` ou do `index.js` local).
2. Verificar, por ordem: sessão com `email_verified`; `weddingId` resolvido por `resolveWeddingId(request, true)` — **nunca** o `weddingId` que o cliente envia (o cliente envia `weddingId: currentWeddingId`; tem de ser ignorado ou validado contra os donos); `assertPremiumWedding(weddingId)` antes de qualquer custo; `checkAndIncrementAiUsage` (quota diária); dados lidos do `json` no servidor (não do pedido); `compareId` validado contra `state.compares`; limite de tamanho/timeout (cliente espera 115 s); saída limitada ao contrato que o cliente já filtra (`summary`, `priceVsServices`, `additionalCosts`, `attentionPoints`, `orientation`, `strengths`, `priorityNotes`, `questions`).
3. Testar: sem sessão, sem Premium, Premium expirado, `weddingId` de outro casamento, `compareId` inexistente, chamadas repetidas (quota).

## 3. Consentimento WhatsApp validado no servidor
**Problema.** `sendWhatsappRsvpReminder` lê `entry.communicationPreferences.whatsapp.optedIn` do `json` do casamento, que o cliente escreve. O telefone já é protegido pelo `guestPhoneIndex` (servidor), o consentimento não.

**Proposta (recomendada).**
1. Fonte de verdade no servidor: guardar o consentimento em `guestPhoneIndex/{telefone}` (já server-only, regras `read,write:false`) com `whatsappConsent: { optedIn, source, at, optedOutAt }`. `source` ∈ `couple-attestation` | `guest-self`.
2. `updateGuestPhone` (já é o único caminho) grava também no índice; o `json` passa a ser só espelho para a interface.
3. `sendWhatsappRsvpReminder` decide **só** pelo índice (ignora o `json`). Um `optedIn` forjado no `json` deixa de ter efeito.
4. Regra de precedência: `optedOutAt` mais recente que `at` bloqueia sempre; só o **convidado** pode voltar a aceitar (`guest-self`). O casal não consegue reativar quem fez STOP.
5. `whatsappWebhook` (STOP) passa a escrever no índice (além do `json`).
6. Consentimento do próprio convidado: no `rsvp.html` uma caixa "Aceito lembretes por WhatsApp" com o telefone, enviada para uma callable nova `setGuestWhatsappConsent({guestToken, phone, optedIn})` (anónima, validada pelo token do convite, com limite de pedidos). É a prova forte; a declaração do casal (`couple-attestation`) é mais fraca juridicamente — decidir se continua aceite.
7. Migração: preencher o índice a partir do `json` atual com `source:'couple-attestation'` e `migrated:true`, ou exigir nova confirmação (mais seguro, mais fricção). Decisão tua.
8. Testes: `optedIn` forjado no `json` não envia; STOP bloqueia mesmo que o casal reative; troca de número limpa consentimento; dois convidados com o mesmo número.

**Não implementado** (mexe em Cloud Functions e no fluxo legal; aguarda a tua decisão sobre os pontos 6 e 7).
