# Pendências K.2

## A. Decisões/ações da Rita
| # | Pendência |
|---|---|
| P-K2-1 | Autorizar publicação (índice: `index.js`, `app/index.html`, `firestore.rules`; publicar app + regras juntas). **Nada publicado.** |
| P-K2-2 | Ativar TTL sobre `_incident_log.expireAt` (não ativado) e limpar registos antigos sem campo |
| P-K2-3 | UI: ocultar/tratar o botão WhatsApp enquanto a flag estiver desligada |
| P-K2-4 | Rotação OpenAI (procedimento pronto; não executada) |
| P-K2-5 | Validar revogação de tokens no projeto de teste com Storage real |
| P-K2-6 | Confirmar 90 dias na Política de Privacidade |

## B. Propostas técnicas (NÃO implementadas; aguardam aprovação)
**B1 Quota de uploads.** Atual: regras limitam tipo/tamanho por ficheiro, sem total por casamento. Proposta: contador `storageUsage/{weddingId}` atualizado por trigger `onObjectFinalized/Deleted` (Storage trigger; sem novas dependências) + limite (ex. 500 MB documentos, 1 GB memórias [X] a definir) aplicado por Cloud Function de pedido de upload ou verificação a posteriori com remoção/aviso. Impactos: casais com muito conteúdo; custos de invocação; decisão comercial dos limites por plano (não aprovada).
**B2 App Check.** Proposta: ativar reCAPTCHA Enterprise/v3 no web app, `enforceAppCheck` primeiro em modo monitor (métricas) e só depois nas callables sensíveis. Dependências não aprovadas: chave reCAPTCHA (conta Google/Cloud), SDK App Check no cliente (nova dependência), risco de bloquear PWA offline/iOS e RSVP público. Recomenda-se monitor ≥2 semanas.
**B3 Stripe reembolsos.** Atual: pagamento único 30 €, 12 meses, sem renovação. Proposta: tratar `charge.refunded`/`charge.dispute.created` no webhook para terminar o Premium (`subscription.active=false`) com registo financeiro (sem TTL). Requer decisão comercial/jurídica (direito de livre resolução, prazo, reembolso parcial) e testes em modo Stripe test. Não implementado.

## C. Riscos residuais
Regras não validam o tamanho de elementos em listas; links já descarregados não são revogáveis; trigger com custo por atualização; clientes antigos perdem telemetria após publicar regras; 56/56 é local (emulador/mock).
