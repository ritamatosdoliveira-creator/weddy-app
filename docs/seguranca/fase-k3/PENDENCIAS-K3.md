# Pendências K.3

## A. Validação externa não executada (bloqueio: sem credenciais/CLI neste ambiente)
| # | Item | Quem | Material pronto |
|---|---|---|---|
| P-K3-1 | App Check monitor no projeto de teste | Rita | `VALIDACAO-APP-CHECK.md` |
| P-K3-2 | TTL `_incident_log` no projeto de teste | Rita | `scripts/semear-ttl-teste.js`, `scripts/ttl-incident-log-teste.sh` |
| P-K3-3 | Rotação OpenAI no projeto de teste | Rita (chave interativa) | `PLANO-ROTACAO-OPENAI.md`, `scripts/rotacao-openai-teste-verificacoes.sh` |
| P-K3-4 | Storage real: revogação de tokens | Rita (deploy de teste) | `scripts/validar-storage-revogacao.js` |
| P-K3-5 | Stripe modo teste (pagamento + reembolso) | Rita | `CHECKLIST-PUBLICACAO-CONTROLADA.md` §C |

## B. Decisões
| # | Decisão |
|---|---|
| P-K3-6 | ~~Limites de quota~~ **decididos** (20/500/2.000/5 GB). Resta: mostrar "X de N" ao casal; mensagem específica ao convidado quando o convite enche |
| P-K3-7 | ~~Política de reembolsos~~ **decidida: revisão manual (`record_only`)**. Resta: texto nos Termos e procedimento interno de revisão |
| P-K3-8 | Retenção financeira: proposta técnica pronta (`PROPOSTA-RETENCAO-FINANCEIRA.md`); **prazo por definir** com contabilista/jurídico |
| P-K3-9 | Pagamentos anteriores à K.3 sem `payment_intent` registado: backfill manual? |
| P-K3-10 | reCAPTCHA/App Check: aprovação RGPD antes de qualquer produção |
| P-K3-11 | Tetos de custos e alertas (`PLANO-MONITORIZACAO-CUSTOS.md`) |

## C. Riscos
Quota a posteriori (ficheiro existe segundos); triggers de quota nunca correram em Eventarc/Storage reais; custo de invocações em cada alteração de casamento (trigger de co-donos) e em cada foto (2 eventos); iOS/Android reais não testados (apenas Chromium emulado).
