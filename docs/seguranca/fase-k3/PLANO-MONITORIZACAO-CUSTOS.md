# Plano de monitorização e alertas de custos (K.3-H)

**Estado:** proposta. Nada criado, nenhum serviço pago ativado, nenhum orçamento/alerta de produção alterado. Preços são **a confirmar** nas tabelas oficiais (não verificados aqui).

| Serviço | Métricas disponíveis | Alerta proposto | Custo do alerta |
|---|---|---|---|
| Firestore | leituras/escritas/eliminações por dia, tamanho (Cloud Monitoring `firestore.googleapis.com/document/*`) | Pico > 3× média móvel de 7 dias; leituras diárias acima de um teto a definir | Cloud Monitoring: gratuito no volume típico [X] |
| Storage | bytes armazenados, nº de objetos, egress | Crescimento > X GB/dia; `memoryQuota` com recusas elevadas (consulta a `refused`) | idem |
| Cloud Functions | invocações, erros, duração, instâncias | Taxa de erro > 5 % (5 min); invocações de `memoryQuota*`/`revokeDownloadTokens*` anómalas | idem |
| OpenAI | uso e custo no painel OpenAI | **Limite mensal rígido (hard limit)** e alerta a 50/80 % no painel; projeto OpenAI dedicado | gratuito |
| Stripe | Dashboard → webhooks (falhas de entrega), disputas, reembolsos | Alerta de endpoint com falhas; revisão semanal de `stripePayments.reviewRequired=true` | gratuito |
| Orçamento global | Cloud Billing Budgets | Orçamento mensal com alertas a 50/90/100 % por email | gratuito |

**Dependências:** conta de faturação Google (Blaze), permissões de administrador (Rita). **Configuração:** Billing → Budgets & alerts; Monitoring → Alerting (canal email). Registo de incidentes técnicos: `_incident_log` (90 dias, TTL só se aprovado) — financeiros fora desse prazo.
Pendente de decisão: tetos numéricos (dependem de dados reais da Beta).
