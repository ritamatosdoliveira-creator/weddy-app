# Relatório Fase K.1 — Pendências administrativas, segurança operacional e ambiente de teste

Base: branch `v325-import-guests`, commit `484e914` (confirmado presente; árvore limpa no início). Tudo local. Sem push/merge/deploy/publicação, sem alterações de produção, secrets, regiões, TTL, backups, OAuth ou Stripe.

## 1. O que foi feito
| Item | Resultado | Documento |
|---|---|---|
| K.1-A chave OpenAI | Auditada: **nenhuma chave** no repositório nem no histórico; secret só via `defineSecret`; 4 funções declaram-no. Procedimento de rotação preparado; **não executada** | `PLANO-ROTACAO-OPENAI.md` |
| K.1-B uploads (K-4) | Fluxo e custos descritos; 4 alternativas comparadas; recomendação em camadas; nada implementado | `ANALISE-UPLOADS-APP-CHECK-QUOTAS.md` |
| K.1-C URLs (K-5) | Tokens só persistem no rascunho do Website (já rodados no fim do Premium); recomendação: rodar tokens ao remover co-dono (a aprovar) | `ANALISE-URLS-DOWNLOAD.md` |
| K.1-D `_incident_log` (K-7) | Auditado (escrita cliente, leitura só servidor, `failedTokens` = tokens RSVP, sem retenção); política proposta | `POLITICA-PROPOSTA-INCIDENT-LOG.md` |
| K.1-E Stripe (K-9) | Lacuna confirmada (sem `charge.refunded`; `payment_intent` não guardado); desenho e política por tipo propostos | `ANALISE-STRIPE-REEMBOLSOS.md` |
| K.1-F Firebase | Functions em europe-west1 (provado); Firestore/Storage/PITR/TTL **[X]**; consequências explicadas | `MATRIZ-FIREBASE-REGIOES-BACKUPS-TTL.md` |
| K.1-G Privacidade | EmailJS descrito; **WhatsApp/Meta: integração servidor existe mas dormente**; recolha de alergias descrita; rascunhos | `REVISAO-PRIVACIDADE-WEDDY.md` |
| K.1-H Termos | Discrepâncias: cancelamento, consentimento de livre resolução, reembolso, faturação | `PENDENCIAS-JURIDICAS-PREMIUM.md` |
| K.1-I Testes reais | Matriz N1–N5; nenhum N4/N5 feito; checklist | `MATRIZ-TESTES-INTEGRACOES-REAIS.md` |
| K.1-J Correções documentais | Comentários `index.js` 29,99 €/24 meses → 30 €/12 meses (2 sítios); sem outras referências antigas ao preço no código/UI | — |

## 2. Alterações no repositório
`index.js`: **apenas 2 comentários**. Documentação nova em `docs/seguranca/fase-k1/`. Nenhuma alteração funcional, de regras ou de testes.

## 3. Descobertas novas (para além da lista da fase)
1. **API WhatsApp Business existe no servidor** (dormente na UI) — contradiz a premissa de que a Weddy não a usa; requer decisão (opção recomendada: feature flag).
2. **Texto de cancelamento incorreto**: os Termos prometem acesso até ao fim do período, o código corta de imediato.
3. **Consentimento expresso para perda do direito de livre resolução não é recolhido** no checkout.
4. `failedTokens` no `_incident_log` guarda tokens de convite RSVP completos.
5. `STATE_VALIDATE_MODE` é `off` por defeito: a quarentena só existe se alguém o ativou em produção [X].
6. Reembolsos Stripe não conseguem ser ligados ao casamento sem guardar `payment_intent`.

## 4. Separação final
- **Resolvido:** comentários de preço; auditorias e análises; procedimento de rotação documentado.
- **Preparado, dependente de autorização:** rotação OpenAI, flag WhatsApp, quota de uploads/App Check, rodar tokens, limites do `_incident_log`, eventos de reembolso Stripe, alertas de custo, publicação.
- **Dependente de decisão administrativa:** `PENDENCIAS-ADMINISTRATIVAS-LEGAIS-K1.md`.
- **Dependente de validação jurídica:** privacidade, art. 9.º, termos Premium, DPIA, citações.
- **Dependente de testes externos:** `MATRIZ-TESTES-INTEGRACOES-REAIS.md` (todo N4/N5).

A Weddy **não é declarada pronta para Beta**. A Fase L não foi iniciada.
