# Termos Premium — auditoria e pontos para aprovação (K.1-H)

Rascunho técnico-comercial. **Não é aconselhamento jurídico** e não altera textos publicados. Nada foi inventado: onde falta decisão, está indicado.

## 1. Auditoria comercial (código vs. interface vs. texto)
| Item | Código / Stripe | Interface | Termos / Privacidade | Estado |
|---|---|---|---|---|
| Preço | 3000 cêntimos (30 €) | "30€ / 12 meses" (PT), "€30 / 12 months" (EN), 30 € no lembrete | "preço mostrado na app" (sem valor) | ✔ coerente (corrigido o **comentário** antigo 29,99 €/24 meses em `index.js`) |
| Duração | 12 meses (`SUBSCRIPTION_MAX_MONTHS = 12`) em cliente e servidor | 12 meses | 12 meses | ✔ |
| Início | Data da confirmação do pagamento; compras seguidas acumulam | "a partir da ativação" | idem | ✔ |
| Renovação | **Sem renovação automática** (`mode:'payment'`) | "sem renovação automática" | "Podes cancelar a subscrição a qualquer momento… mantém-se até ao fim do período já pago" | ⚠ **discrepância** |
| Cancelamento | Botão (web) → `active=false` **imediato**, sem reembolso; confirmação diz "cancela já"; iOS diz "nada para cancelar" | idem | "mantém-se até ao fim do período" | ⚠ **discrepância grave**: o texto promete acesso até ao fim, o código corta já |
| Expiração | `premiumUntil`; modo "lapsed": conteúdo visível/apagável, sem criar | idem | "O que acontece após expirar" **não descrito** | ⚠ falta texto |
| Reembolso | Nenhuma lógica Stripe (K-9); RevenueCat tem REFUND | — | **Sem política de reembolso** | ⚠ por decidir |
| Livre resolução (14 dias) | Acesso ativado de imediato; **não existe** passo de consentimento expresso nem de reconhecimento da perda do direito no checkout (Stripe sem texto/consentimento adicional) | — | Texto afirma que o consentimento expresso faz cessar o direito | ⚠ **o texto pressupõe um consentimento que o fluxo não recolhe** |
| Faturação | Sem emissão de fatura/recibo (Stripe pode enviar recibo, não configurado no código) | — | Política cita "faturação" como obrigação legal | ⚠ por decidir |
| Métodos de pagamento | card, MB WAY, Klarna | — | só "Stripe" | Decidir se Klarna (pagamento fracionado) se mantém e se é descrito |
| Funcionalidades Premium | Verificadas por `assertPremiumWedding` / `hasActiveSubscription` (RSVP Autopilot, Memories, Documents, Website, Copilot, Compare, AI Seating, Calendar, WhatsApp…) | Lista na página de venda | "detalhes na app" | Confirmar lista final para os termos |
| Conteúdo após expirar | Preservado (Website suspende, não apaga) | Aviso de modo "lapsed" | Não descrito | Descrever |
| Dados após eliminação de conta | Cascata (Fase J); Stripe mantém registos fiscais; backups por expirar | — | "apagas… a qualquer momento" sem ressalva | Acrescentar ressalvas (retenção legal, backups) |
| Preços na RevenueCat/Apple | Gerido fora do repositório | "30€" iOS | — | [X] confirmar preço no App Store Connect |

## 2. Pontos que necessitam de aprovação (administração + jurídico)
1. Cancelamento: o que significa "cancelar" num pagamento único? Opções: (a) remover o botão no web e explicar "não há renovação"; (b) manter o botão mas só como "desligar", com acesso até `premiumUntil` (alterar código); (c) reembolso proporcional. **Escolher e alinhar texto e código.**
2. Consentimento expresso e reconhecimento da perda do direito de livre resolução antes do pagamento (caixa/linha no checkout; pode ser `custom_text`/`consent_collection` do Stripe ou passo na app). Texto a aprovar.
3. Política de reembolso (prazos, parciais, falhas do serviço) e efeito no acesso (ver `ANALISE-STRIPE-REEMBOLSOS.md`).
4. Informação pré-contratual obrigatória: identificação do prestador, preço total com IVA, duração, funcionalidades, direitos de consumidor, meios de reclamação (Livro de Reclamações eletrónico), resolução alternativa de litígios — **lista a validar por jurista**.
5. Faturação/IVA: emissão de fatura, dados fiscais do cliente, regime.
6. Klarna: manter ou retirar.
7. Descrição do que acontece após expirar e após eliminar a conta.
8. Termos para Beta (secção 12 "versões beta" já existe): validar com o regime comercial da Beta (gratuita? preço?).

## 3. Correções feitas nesta fase (só documentação técnica interna)
Comentários de `index.js` (L122 e L5829) que diziam 29,99 € / 24 meses → 30 € / 12 meses. Sem alteração de lógica nem de textos legais.
