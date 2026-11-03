# Relatório Fase K.3

Base: `v325-import-guests`, K.2 `ea85a2e`. Estado inicial confirmado (branch, commit, working tree limpo). **Sem push/merge/deploy/publicação; produção intocada.**

## Autorizações usadas
| Nível | Estado |
|---|---|
| A — trabalho local | **Usado**: código, testes, documentação |
| B — projeto de teste | **Não usado**: sem credenciais gcloud/Firebase, sem `firebase` CLI e sem chaves Stripe/OpenAI neste ambiente; nenhuma operação externa foi feita. Material pronto para execução pela Rita (`scripts/`, docs) |
| C — produção | Não autorizado; nada feito |

## Resultado por critério de fecho
| Critério | Estado |
|---|---|
| Botão WhatsApp oculto com flag desligada | **Feito** (observação: a app não tinha botão que chame a API; o estado vem do servidor e a UI futura só mostra se `true`) |
| Quota de uploads local | **Feita e testada** (32+12 casos); valores propostos por aprovar |
| App Check monitor no teste | **Preparado, não validado** |
| TTL 90 dias no teste | **Preparado, não ativado** |
| Stripe reembolsos local | **Feito e testado (SDK simulado)**; política `record_only`; Stripe modo teste não validado |
| Rotação OpenAI no teste | **Não executada** (precisa da Rita) |
| Revogação com Storage real | **Preparada, não validada** |
| Alertas/monitorização | Proposta documentada |
| Regressão | **60/60** |
| Documentação | 12 documentos + scripts |
| Working tree limpo após commit | Ver entrega |

**Por isso a K.3 NÃO está integralmente concluída pelos critérios do brief**: faltam as validações externas (P-K3-1..5). **Beta não declarada pronta.**

## Alterações principais
`index.js`: `getWhatsappApiStatus`; quota (`memoryQuota*`, 4 triggers); reembolsos (`handleStripeRefundEvent`, `stripePayments`, `stripeEvents`, `payment_intent_data.metadata`); limpeza na eliminação de conta. `app/index.html`: estado da API WhatsApp (falha fechada). `firestore.rules`: `memoryQuota`, álbum cheio. Testes: 4 suites novas; `auth-matrix` ganha uma entrada em OWN_SCOPE. Docs: esta pasta.

## Custos e dependências
Sem serviços pagos novos. Custo variável: invocações de functions por foto (2 eventos) e por atualização de casamento; Firestore (contador). Dependências externas por aprovar: reCAPTCHA (App Check).
