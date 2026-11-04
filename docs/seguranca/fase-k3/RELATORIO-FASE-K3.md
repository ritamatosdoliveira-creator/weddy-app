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
| Regressão | **61/61** |
| Documentação | 12 documentos + scripts |
| Working tree limpo após commit | Ver entrega |

**Por isso a K.3 NÃO está integralmente concluída pelos critérios do brief**: faltam as validações externas (P-K3-1..5). **Beta não declarada pronta.**

## Alterações principais
`index.js`: `getWhatsappApiStatus`; quota (`memoryQuota*`, 4 triggers); reembolsos (`handleStripeRefundEvent`, `stripePayments`, `stripeEvents`, `payment_intent_data.metadata`); limpeza na eliminação de conta. `app/index.html`: estado da API WhatsApp (falha fechada). `firestore.rules`: `memoryQuota`, álbum cheio. Testes: 4 suites novas; `auth-matrix` ganha uma entrada em OWN_SCOPE. Docs: esta pasta.

## Custos e dependências
Sem serviços pagos novos. Custo variável: invocações de functions por foto (2 eventos) e por atualização de casamento; Firestore (contador). Dependências externas por aprovar: reCAPTCHA (App Check).

---
## Consolidação das decisões (K.3, 4 nov)
**Decisões fechadas:** quota por convite **20** · QR público **500** · por casamento **2.000** · armazenamento **5 GB** por casamento · reembolsos Stripe em **revisão manual** (`record_only`, sem revogação automática) · retenção financeira: **só proposta técnica, sem prazo** · App Check: **apenas monitor** no projeto de teste.

**Alterado:** QR público 300 → 500 (`index.js`); valores de recurso para os `defineInt`; novo teste `k3-quota-defaults`; documentação de quota/Stripe/checklists atualizada; novos `PROPOSTA-RETENCAO-FINANCEIRA.md` e `CHECKLIST-VALIDACOES-EXTERNAS-K3.md`; `VALIDACAO-APP-CHECK.md` com checklist de 14 dias. **Não alterado:** lógica financeira (nenhuma necessidade concreta identificada), regras Firebase, credenciais, configurações externas, política de reembolsos, prazo de retenção.

**Confirmação Stripe:** `record_only` é o predefinido; reembolsos total/parcial, duplicados e disputas ficam registados (`reviewRequired`) e **não** revogam Premium (`k3-stripe-refunds`, 24/24).

**Regressão completa: 61/61 suites** (56 da K.2 + 5 da K.3; nenhuma removida ou enfraquecida). **Nível dos testes:** automatizados em emulador/mocks. **Validações externas continuam por realizar** (TTL, rotação OpenAI, Storage real, Stripe test mode, iOS/Android reais, custos, App Check): ver `CHECKLIST-VALIDACOES-EXTERNAS-K3.md`.
