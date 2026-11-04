# Proposta técnica de retenção de dados financeiros

**Para validação por contabilista e assessoria jurídica. Não define prazo. Não cria nem presume obrigações legais.** Nada foi apagado nem configurado. Tudo o que depende de lei ou prática profissional está marcado **[VALIDAR]**.

## 1. Inventário (o que existe hoje, verificado no código)
| Tipo | Onde | Conteúdo | Origem | Finalidade / necessidade |
|---|---|---|---|---|
| Sistema de registo do pagamento | **Stripe** (fora da Weddy) | cobrança, cliente/cartão, reembolsos, disputas, faturas do Stripe | Stripe | fonte primária do pagamento; retenção regida pelo Stripe [VALIDAR contrato/DPA] |
| Estado de subscrição | Firestore `weddings/{id}.subscription` | `active`, `plan`, `startedAt`, `premiumUntil`, últimos 50 `stripeCheckoutSessionIds` / `revenueCatTransactionIds`, `revokedReason` | webhooks | decidir acesso ao Premium (necessário enquanto o casamento existir) |
| Registo de pagamento (K.3) | `stripePayments/{payment_intent}` | casamento, sessão, valor, moeda, estado, `refundedAmount`, `disputeStatus`, `reviewRequired`, datas | webhook Stripe | histórico auditável; ligar reembolsos/disputas ao casamento; prova do que foi cobrado |
| Registo de eventos Stripe (K.3) | `stripeEvents/{event.id}` | tipo, casamento (ou nulo), valores, resultado, política aplicada | webhook | idempotência e trilho de auditoria das decisões |
| Incidentes financeiros | `_incident_log` (docs `type=stripeWebhook` / revenuecat, **sem `expireAt`**) | motivo, ids de evento/sessão/transação, mensagem de erro, casamento | servidor | detetar pagamentos confirmados que não ficaram ativos |
| Logs de funções | Cloud Logging | mensagens com casamento/ids de evento | runtime | operação/diagnóstico; retenção definida pela Google/projeto [VALIDAR] |
| Cópias/backups | backups do Firestore (se existirem) | tudo o acima | plataforma | recuperação de desastre [VALIDAR política atual: não alterada] |
| App Store / RevenueCat | sistemas externos | recibos iOS | terceiros | fora do âmbito da Weddy; retenção própria |
Dados pessoais: os registos Weddy (`stripePayments`, `stripeEvents`) **não contêm email nem nome**; ligam-se ao casal pelo `weddingId`, que é pseudónimo mas identificável via o casamento. Dados de cartão: **nunca** chegam à Weddy.

## 2. Distinções que importam
- **Dados de pagamento** (quanto, quando, qual compra): potencial relevância contabilística/fiscal [VALIDAR].
- **Registos de reembolso**: acompanham o pagamento; documentam o que foi devolvido e a decisão manual.
- **Disputas**: prazos e provas definidos pelo processador; precisam de ser conservadas enquanto a disputa estiver aberta [VALIDAR].
- **Logs técnicos** (`_incident_log` técnico, Cloud Logging): finalidade operacional; a retenção de 90 dias foi preparada **só** para registos técnicos com `expireAt`. Os incidentes financeiros não têm `expireAt` e ficam fora do TTL — decisão deliberada para não apagar prova financeira antes de haver prazo.

## 3. Opções (sem escolher)
| Opção | Descrição | Implicações |
|---|---|---|
| A | Reter `stripePayments`/`stripeEvents` enquanto existir o casamento; apagar com a eliminação de conta | Minimiza dados pessoais; **risco** de apagar prova que possa ser exigida depois [VALIDAR] |
| B | Reter por um prazo fixo definido externamente (a decidir), independente da conta; na eliminação de conta, separar o `weddingId` (pseudonimização/dissociação) | Cobre obrigações de conservação; exige desenho de pseudonimização e informação na Política de Privacidade; retenção possivelmente excessiva se o prazo for mal definido |
| C | Exportar periodicamente para sistema contabilístico e manter na Weddy só o necessário operacional | Reduz dados na app; depende de processo externo e custo; risco de divergência |
| D | Manter indefinidamente | **Não recomendado**: retenção excessiva, difícil de justificar RGPD |
Em qualquer opção: a TTL do Firestore só se aplica a documentos com um campo de data de expiração; aplicar a financeiros exigiria um campo novo e **uma decisão de prazo** que ainda não existe.

## 4. Riscos
- **Eliminação prematura:** perder prova de cobrança/reembolso/disputa; impossibilidade de reconstruir o histórico; problemas com contabilidade ou fisco [VALIDAR].
- **Retenção excessiva:** manter dados para além do necessário; contradiz a minimização/limitação da conservação; aumenta o impacto de um incidente.
- **Conflito eliminação de conta × retenção:** hoje `deleteWeddingAccount` **não** apaga `stripePayments`/`stripeEvents` (decisão provisória, a confirmar). O cliente pode pedir apagamento; é preciso definir o que se informa e o que se conserva por obrigação [VALIDAR].
- Pagamentos anteriores à K.3 não têm `stripePayments` (só a subscrição).

## 5. Questões para decisão externa (contabilista / jurídico)
1. Que registos têm de ser conservados e por quanto tempo, e a partir de que data (pagamento, fim do Premium, eliminação de conta)?
2. Chega conservar o que o Stripe já guarda, ou a Weddy precisa da sua própria cópia?
3. Pode/deve conservar-se o `weddingId` após a eliminação da conta, ou é preciso dissociar?
4. Que deve constar na Política de Privacidade e nos Termos (finalidade, base legal, prazo)?
5. Como tratar disputas abertas e reembolsos parciais em termos de registo?
6. Logs do Cloud Logging e backups: prazos aceitáveis?
7. Faturação: a Weddy emite fatura própria ou apenas o recibo do Stripe? (afeta o que é obrigatório reter)
**Resultado esperado:** um prazo e regras por tipo de registo, com fundamento, para só então implementar (campo de expiração/pseudonimização) — nesse momento será uma nova alteração a aprovar.
