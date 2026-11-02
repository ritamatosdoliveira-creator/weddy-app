# Análise: reembolsos Stripe e estado Premium (K-9) — K.1-E

**Estado:** análise e desenho. **Nada implementado** (a política de reembolso depende de decisão administrativa e jurídica). Sem pagamentos ou reembolsos reais.

## 1. Fluxo atual (verificado em `index.js`; testes simulados em `tests/hardening/payments.test.js`)
| Elemento | Facto |
|---|---|
| Produto | Pagamento **único** 30 € (`WEDDY_PREMIUM_PRICE_CENTS = 3000`), 12 meses, `mode: 'payment'`, métodos card / MB WAY / Klarna; sem renovação automática |
| Ligação pagamento→casamento | `metadata.weddingId` da sessão (derivado da conta autenticada no servidor) |
| Eventos tratados | `checkout.session.completed` (só se `payment_status=paid`), `checkout.session.async_payment_succeeded`; `async_payment_failed` e `expired` só registam |
| Eventos **não** tratados | `charge.refunded`, `charge.dispute.created/closed`, `refund.created/updated`, `payment_intent.*` |
| Idempotência | Transação Firestore; lista das últimas 50 `stripeCheckoutSessionIds`; testada com 5 entregas simultâneas |
| Histórico | `subscription.stripeCheckoutSessionId(s)`, `startedAt`, `premiumUntil`; **não** guarda `payment_intent`/`charge`/valor/moeda; compras seguidas **acumulam** (a nova começa no fim da anterior) |
| Cancelar (web) | Botão escreve `subscription.active=false` (cliente; regra permite só desligar) → acesso termina de imediato, sem reembolso (ver `PENDENCIAS-JURIDICAS-PREMIUM.md`) |
| RevenueCat | `REFUND` já desativa Premium só se for a última transação (mecanismo a imitar) |

## 2. Lacuna
Um reembolso/disputa feito no painel Stripe **não altera** o Premium: o casal mantém acesso pago-devolvido. Hoje é "revisão manual". Além disso, como o `payment_intent` não é guardado, **um evento `charge.refunded` não pode ser ligado ao casamento** (o evento traz `payment_intent`/`charge`, não a sessão).

## 3. Desenho proposto (não implementado)
1. **Guardar referências** ao confirmar o pagamento: `stripePaymentIntentId`, valor, moeda, `session.id`, data (lista `stripePayments[]` com as últimas 50 — histórico auditável) e passar `payment_intent_data: { metadata: { weddingId } }` na criação da sessão (para que cobranças e reembolsos herdem o `weddingId`).
2. **Novos eventos**: `charge.refunded` (inclui total/parcial: `amount_refunded` vs `amount`), `charge.dispute.created`, `charge.dispute.closed`.
3. **Registo antes de alterar**: cada evento gravado numa subcoleção/coleção de auditoria `stripeEvents/{event.id}` (transação `create` → duplicados falham = idempotência por `event.id`), com tipo, valores, `weddingId`, resultado. Nunca apagar.
4. **Política por tipo** (a decidir):
   | Situação | Efeito proposto (para aprovação) |
   |---|---|
   | Reembolso **total** da compra mais recente | Desativar Premium **dessa compra**: se houver compras acumuladas, recalcular `premiumUntil` sem ela; se for a única → `active=false` |
   | Reembolso **parcial** | **Sem efeito automático**; alerta à administração (decisão manual) — ou política explícita (ex.: proporcional). **Decisão administrativa/jurídica** |
   | Reembolso de compra antiga com compra posterior | Não revoga o Premium (mesma regra do RevenueCat); regista |
   | Disputa aberta | Só alerta; fechada a favor do cliente → tratar como reembolso total |
   | Reembolso **solicitado** (pedido do cliente) | Só estado interno/administrativo; **o Premium só muda no reembolso *processado*** |
   | Subscrição cancelada / expirada | Estados distintos já existentes (`active=false` vs `premiumUntil` passado); sem relação com reembolsos |
5. **Nunca revogar por erro de processamento**: se o evento não puder ser ligado a um casamento/compra, ou se a escrita falhar, **não alterar** o Premium; registar incidente e alertar. Preferir falhar-seguro (manter acesso) a revogar indevidamente.
6. **Webhook**: continua a responder 200 só depois de processar; novos eventos têm de ser ativados no endpoint do Stripe (configuração externa).

## 4. Plano de testes (quando houver decisão)
Simulado: reembolso total/parcial/duplicado/simultâneo/fora de ordem (reembolso antes do pagamento), compra acumulada, evento sem `weddingId`, falha de escrita. Stripe **modo teste** real: pagamento de teste + reembolso de teste no painel + conferir estado e `stripeEvents`. Produção: nada.

## 5. Decisões necessárias
(1) Política de reembolso (prazo, parcial/proporcional, após uso de funcionalidades); (2) efeito de reembolso/disputa no acesso; (3) quem decide reembolsos manuais e como são registados; (4) se se ativa `payment_intent_data.metadata`; (5) retenção dos registos financeiros (obrigação fiscal a validar com contabilista).
