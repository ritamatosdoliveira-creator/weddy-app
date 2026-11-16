# Checklist das validações externas K.3

**Estado de todas: NÃO REALIZADAS.** Este ambiente não executa comandos Firebase/Stripe/OpenAI nem usa dispositivos reais. Cada validação deve ser feita pela Rita **só no projeto de teste** (`weddy-premium-teste`), com `scripts/guard-projeto-teste.sh`. Produção permanece bloqueada.

## 1. TTL de 90 dias em `_incident_log` (teste)
- **Pré-requisitos:** projeto de teste confirmado; dados fictícios; `gcloud` autenticado como a Rita; regras/app K.2 já no teste (para o esquema do campo `expireAt`).
- **Procedimento:** `semear-ttl-teste.js` → `ttl-incident-log-teste.sh weddy-premium-teste` → aguardar 24–72 h → comparar.
- **Evidência:** listagem das políticas TTL antes/depois; contagem por registo (`k3-ttl-futuro`, `-passado`, `-sem-expireAt`, `-financeiro`, `stripePayments/pi_k3_ttl_teste`).
- **Critério de conclusão:** só `k3-ttl-passado` desapareceu; todos os outros existem; nenhuma outra coleção afetada. Nota: não equivale a aprovação jurídica da retenção.

## 2. Rotação da chave OpenAI (teste)
- **Pré-requisitos:** acesso à consola OpenAI (projeto/chave de **teste**, idealmente com limite de gasto); Secret Manager do projeto de teste; conta Premium de teste.
- **Procedimento:** `PLANO-ROTACAO-OPENAI.md` passos 2–7 com chave nova criada e colada interativamente pela Rita; `rotacao-openai-teste-verificacoes.sh`; testar Copilot, AI Seating e Compare; só depois desativar a versão antiga **do teste**.
- **Evidência:** versões do segredo (números, sem valor); respostas OK das 4 funções; versão antiga desativada; painel OpenAI sem uso da chave antiga.
- **Critério:** 4 funções funcionais com a chave nova; antiga sem uso; nenhuma chave em ficheiros/logs/repositório. Produção não é tocada.

## 3. Revogação de tokens de Storage (real, teste)
- **Pré-requisitos:** functions K.3 publicadas no projeto de teste (decisão da Rita); bucket de teste sem dados reais.
- **Procedimento:** `scripts/validar-storage-revogacao.js` (passos 1–9); passo 10 conforme `VALIDACAO-STORAGE-REAL.md`.
- **Evidência:** saída do script (OK/FAIL por passo); registo `downloadTokenRevocations` com `done` e, no passo 10, `partial`/`failed`.
- **Critério:** URLs antigos 403/404, ficheiros existentes, novos URLs 200, restantes donos com acesso, falha parcial registada sem apagar ficheiros. Validar também o trigger da quota (`memoryQuota*`) com uploads reais acima de um limite baixo configurado no teste.

## 4. Pagamento e reembolso em Stripe Test Mode
- **Pré-requisitos:** chaves **de teste** e segredo de webhook de teste no projeto de teste; endpoint com os eventos `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`; `STRIPE_REFUND_POLICY=record_only` (predefinição).
- **Procedimento:** checkout com cartão de teste; reembolso total e depois parcial no painel (modo teste); reenviar um evento; (opcional) disputa de teste.
- **Evidência:** documentos `stripePayments/{pi}` e `stripeEvents/{id}` (estado, `refundedAmount`, `reviewRequired`); estado do Premium; capturas do painel.
- **Critério:** pagamento ligado ao casamento; reembolsos registados para revisão; **Premium inalterado**; reenvio sem duplicação. Nenhuma transação real.

## 5. iOS e Android reais
- **Pré-requisitos:** build de teste acessível; dispositivos reais (iPhone com Safari/PWA instalada; Android com Chrome); contas de teste.
- **Procedimento:** instalar PWA; fluxo do casal (login, convidados, Memories); RSVP sem conta (link de convite); upload de fotos via convite e via QR (incluindo HEIC no iPhone); atingir um limite baixo de quota de teste.
- **Evidência:** capturas/vídeo por dispositivo e versão do SO; erros da consola se existirem.
- **Critério:** todos os fluxos funcionam; mensagens de álbum cheio claras; sem regressão visual em 390 px.

## 6. Monitorização de custos e utilização
- **Pré-requisitos:** conta de faturação do projeto de teste; permissões de administrador.
- **Procedimento:** `PLANO-MONITORIZACAO-CUSTOS.md` — orçamento com alertas 50/90/100 %, alertas de Monitoring (erros de functions, bytes do Storage), limite rígido no projeto OpenAI.
- **Evidência:** capturas dos orçamentos/alertas; email de teste recebido.
- **Critério:** alertas ativos no teste e disparo verificado; tetos de produção propostos (sem aplicar) com base na utilização observada.

## 7. App Check (monitor, teste)
Ver `VALIDACAO-APP-CHECK.md` (checklist de 14 dias, métricas e critérios). Sem enforcement.
