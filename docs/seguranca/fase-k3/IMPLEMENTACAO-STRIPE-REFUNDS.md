# Tratamento de reembolsos Stripe (K.3-E)

**Estado:** implementado e testado **localmente com SDK Stripe simulado** (sem rede, sem chaves, sem transações). **Não** validado em Stripe modo de teste (sem credenciais aqui). Produção intocada.

## Auditoria (antes)
Eventos tratados: `checkout.session.completed` (paid), `async_payment_succeeded`; `payment_intent` não era guardado; `charge.refunded` ignorado; pagamento→casamento só por `metadata.weddingId` da sessão. Pagamento único 30 €/12 meses (Termos e `PENDENCIAS-JURIDICAS-PREMIUM.md` da K.1 lidos: política de reembolso **não definida**).

## O que foi implementado
1. **Ligação segura:** o checkout passa `payment_intent_data.metadata.weddingId` (weddingId sempre derivado da conta no servidor).
2. **Persistência:** na transação de ativação cria-se `stripePayments/{payment_intent}` (casamento, sessão, valor, moeda, estado `paid`, `refundedAmount`, `disputeStatus`, `reviewRequired`). Só servidor; sem emails; **sem TTL**.
3. **Eventos:** `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` → `handleStripeRefundEvent`, idempotente por `event.id` (`stripeEvents/{id}`, criado na mesma transação).
4. **Total/parcial:** `refundedAmount` é monótono (evento atrasado não reduz); `refunded` se ≥ valor pago, `partially_refunded` se parcial.
5. **Inconsistências:** sem registo do pagamento (fora de ordem/pagamentos anteriores à K.3), metadados diferentes do registo, evento malformado ⇒ `unmatched`/`inconsistent` + `reviewRequired`, **nunca** altera Premium. Reembolso que chega antes do pagamento marca o pagamento para revisão.
6. **Falhas:** erro a gravar ⇒ incidente + HTTP **500** (o Stripe repete; seguro por idempotência). Outros eventos mantêm o comportamento anterior (200).

## Separação detecção × política
Parâmetro `STRIPE_REFUND_POLICY`:
- **`record_only` (defeito, em vigor):** regista e marca para revisão; **Premium nunca é alterado**.
- `revoke_on_full_refund` (implementado, **desligado**): só reembolso **total** + pagamento ligado + única compra paga do casamento + sem disputa ⇒ `subscription.active=false`; caso contrário `ambiguous_review`. Parciais e disputas nunca revogam.
Ativar qualquer política exige decisão comercial/jurídica expressa (não tomada).

## Configuração externa necessária (não feita)
Ativar no endpoint do webhook (teste e depois produção) os eventos `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.

## Testes
`k3-stripe-refunds` (24, simulados). Validação real: runbook em `VALIDACAO-STRIPE-TESTE` dentro de `CHECKLIST-PUBLICACAO-CONTROLADA.md` (pagamento de teste + reembolso de teste no painel Stripe em modo teste, via `stripe trigger`/painel; conferir `stripePayments`/`stripeEvents`).

## Riscos
Pagamentos anteriores à K.3 não têm registo ⇒ reembolsos aparecem `unmatched` (revisão manual; pode fazer-se um backfill manual a partir do painel). Registos financeiros: retenção fiscal a validar com contabilista; `deleteWeddingAccount` **não** os apaga (decisão a confirmar).

## Decisão aprovada (consolidação K.3)
**Reembolsos em revisão manual.** `STRIPE_REFUND_POLICY=record_only` é e continua o comportamento predefinido; nenhum reembolso (total, parcial), duplicado ou disputa revoga o Premium. Cada caso fica registado (`stripePayments.reviewRequired=true`, `stripeEvents`) para decisão humana. Confirmado por `k3-stripe-refunds`: política por defeito `record_only`, reembolso total/parcial/disputa sem alteração do Premium, valor desconhecido da flag ⇒ `record_only`. A opção `revoke_on_full_refund` fica no código, **desligada e não aprovada**. Nenhuma lógica financeira foi alterada nesta consolidação (não se identificou necessidade concreta).
