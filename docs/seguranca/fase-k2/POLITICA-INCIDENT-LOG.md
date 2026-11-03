# Política do `_incident_log` (K.2-3)

**Estado:** implementado localmente (cliente + regras). **Regras não publicadas. TTL NÃO ativado.**

## O que mudou
1. **Minimização no cliente** (`incidentAdd` → `incidentSanitize`, em `app/index.html`): tokens/ids longos (≥12 carateres alfanuméricos) ficam `…últimos6`; paths mascarados (≤20×200); `failedTokens` ≤50 (já mascarados); `error`/`errorMessage` ≤300; `userAgent` ≤200; `type` ≤80. `before`/`after` guardam **apenas contagens** (corrige o registo anterior que gravava o estado completo do casamento em `logOutgoingWriteGuardTripped`). Nunca se guarda token RSVP completo.
2. **Retenção:** cada registo leva `expireAt = agora + 90 dias` (Timestamp).
3. **Regras (`firestore.rules`):** `create` com esquema fechado (`keys().hasOnly`) e limites de tamanho; continua sem leitura/alteração/eliminação pelo cliente; exige sessão com email verificado.
4. **Separação financeira:** registos financeiros (`stripeWebhook`, `revenueCatWebhook`, faturação) são escritos pelo servidor noutras coleções, **sem `expireAt`**, e não são abrangidos por esta política (verificado por inspeção: `grep expireAt index.js` só aparece fora dos webhooks financeiros — ver MATRIZ-TESTES-K2).

## Por ativar (decisão/ação da Rita)
- Política TTL do Firestore sobre `_incident_log.expireAt` (`gcloud firestore fields ttls update expireAt --collection-group=_incident_log --enable-ttl --project <id>`): **não executado**. Só apaga registos com `expireAt`; registos antigos (sem campo) ficam até limpeza manual.
- Prazo de 90 dias é para dados **técnicos**; confirmar coerência com a Política de Privacidade (pendência jurídica).

## Limitações
- As regras não conseguem validar o tamanho de cada elemento das listas; o cliente mascara, um cliente malicioso poderia enviar strings longas dentro dos limites de nº de elementos (risco residual baixo: só cria, nunca lê).
- Clientes antigos em cache escreverão no formato antigo e serão **recusados** pelas novas regras depois de publicadas (perde-se apenas telemetria; sincronização não é afetada). Publicar app e regras juntas.
