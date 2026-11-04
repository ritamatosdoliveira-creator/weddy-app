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
| Quota de uploads local | **Feita e testada** em emulador/Storage simulado (ver `MATRIZ-TESTES-K3.md`); valores **aprovados**: 20 por convite / 500 QR público / 2.000 por casamento / 5 GB / 8 MB por foto. Correções pós-auditoria (P1/P3) na secção final |
| App Check monitor no teste | **Preparado, não validado** |
| TTL 90 dias no teste | **Preparado, não ativado** |
| Stripe reembolsos local | **Feito e testado (SDK simulado)**; política `record_only`; Stripe modo teste não validado |
| Rotação OpenAI no teste | **Não executada** (precisa da Rita) |
| Revogação com Storage real | **Preparada, não validada** |
| Alertas/monitorização | Proposta documentada |
| Regressão | **62/62** (61 + `k3-quota-integrity`, pós-auditoria) |
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

**Regressão completa: 62/62 suites** (56 da K.2 + 5 da K.3 + 1 pós-auditoria `k3-quota-integrity`; nenhuma removida ou enfraquecida). **Nível dos testes:** automatizados em emulador/mocks. **Validações externas continuam por realizar** (TTL, rotação OpenAI, Storage real, Stripe test mode, iOS/Android reais, custos, App Check): ver `CHECKLIST-VALIDACOES-EXTERNAS-K3.md`.


## Correções pós-auditoria K.3 (P1, P3 e documentação) — não commitado
- **P1 corrigido:** documento `memories` sem ficheiro real já não conta como foto; `token`/`weddingId` do documento têm de coincidir com o caminho (regras Firestore + servidor). Detalhe e limites em `IMPLEMENTACAO-QUOTA-UPLOADS.md`.
- **P3 corrigido:** limpeza falhada sobe para retry (máx. 5 no trigger), fila `memoryQuotaCleanupQueue` e rotina horária `memoryQuotaReconcile` (máx. 20 tentativas, depois `giveUp`).
- **Testes:** nova suite `k3-quota-integrity` (28 casos) + 8 casos de regras; regressão **62/62** em emulador, com Storage simulado. Nada disto valida o Storage real, o Eventarc nem o Cloud Scheduler.
- **Instabilidade observada (anterior a estas alterações):** o cenário de 40 pedidos simultâneos de `k3-quota` falhou/excedeu o tempo (`ABORTED: Transaction lock timeout` no emulador) de forma intermitente — reproduzido também com o código original da K.3 (1 em 4 execuções). Foi aumentado o número de tentativas internas (12→25); a contenção do contador único por casamento continua por validar em Firestore real.
- **Documentação:** contradição "por aprovar" removida; fronteira `<`/`>` dos 8 MiB documentada; retenção alinhada com `deleteWeddingAccount` (sem escolher prazo).
