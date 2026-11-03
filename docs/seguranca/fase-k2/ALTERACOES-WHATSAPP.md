# Alterações WhatsApp (K.2-1)

**Estado:** implementado localmente e testado (emulador + mocks). **Não publicado. API WhatsApp NÃO ativada.**

## Antes / depois
| | Antes | Depois |
|---|---|---|
| `sendWhatsappRsvpReminder` | Enviava via Graph API se houvesse consentimento, quota e segredos | Primeiro verifica a flag de servidor `WHATSAPP_API_ENABLED` (parâmetro `defineString`, **defeito `false`**). Desligada → `HttpsError('unavailable', …, {reason:'whatsapp_api_disabled'})` antes de qualquer leitura/escrita, limite ou chamada de rede |
| `whatsappWebhook` (STOP, estados) | Ativo | **Inalterado** (continua a processar STOP/revogação) |
| Código da integração | Presente | **Preservado** (nada removido) |

## Garantias
- Só o valor `true` (sem distinguir maiúsculas/espaços) liga a flag; `false`, vazio, `0`, `no`, `sim` mantêm-na desligada.
- Desligada: sem chamada a `graph.facebook.com`, sem consumo de limites diários/rate-limit, sem escrita.
- Não afeta emails, lembretes manuais (partilha por link/mensagem do próprio casal) nem o RSVP sem conta (`rsvp.html`/funções públicas).
- Ligar no futuro exige decisão expressa: definir `WHATSAPP_API_ENABLED=true` no ambiente das funções e voltar a publicar (a ativar só depois de templates Meta aprovados e testes reais — fora do âmbito desta fase).

## Testes
Ver MATRIZ-TESTES-K2.md (`k2-whatsapp-tokens`). Os testes `consent` e `stop` existentes passam a definir a flag ligada **apenas dentro do teste** para continuar a validar a lógica de consentimento (não foram enfraquecidos).

## Impacto na interface
A UI que chama a função receberá `unavailable` / `whatsapp_api_disabled`. [X] Não foi alterado o texto da UI; se o botão estiver visível a casais, convém ocultá-lo ou tratar o motivo (pendência P-K2-3).
