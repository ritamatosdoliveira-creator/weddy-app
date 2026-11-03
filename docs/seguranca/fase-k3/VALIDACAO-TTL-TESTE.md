# TTL de 90 dias do `_incident_log` no projeto de teste (K.3-D)

**Estado:** **preparado, NÃO ativado** (sem credenciais neste ambiente). Produção intocada. A configuração de teste **não equivale à aprovação jurídica** da retenção de 90 dias.

## Verificações prévias (feitas por leitura do código/regras)
- Campo: `expireAt` (Timestamp), gravado pelo cliente (`incidentAdd`) e exigido como timestamp pelas regras.
- Âmbito: a política TTL do Firestore aplica-se por **grupo de coleções + campo**: `_incident_log.expireAt`. Outras coleções com `expireAt` (rate limits de contacto, quarentena, registos de recusa de quota, `downloadTokenRevocations`) **têm campos próprios noutros grupos** e **não** são abrangidas por esta política.
- Registos financeiros: `stripeWebhook`/`revenueCatWebhook` escrevem incidentes **sem** `expireAt` no mesmo `_incident_log` → documentos sem o campo **nunca** são apagados pelo TTL. `stripePayments`/`stripeEvents` (K.3-E) não têm `expireAt` e estão noutras coleções.

## Execução (Rita)
1. `scripts/semear-ttl-teste.js` (registos fictícios: futuro, passado, sem `expireAt`, financeiro, `stripePayments`).
2. `scripts/ttl-incident-log-teste.sh weddy-premium-teste` (pede confirmação do id do projeto).
3. Após ~24–72 h: só `k3-ttl-passado` deve ter desaparecido; `futuro`, `sem-expireAt`, `financeiro` e `stripePayments/pi_k3_ttl_teste` devem existir.
4. Antes/depois: anotar a contagem por tipo. Limpar os registos fictícios no fim.

**Resultado observado: nenhum (não executado).** Teste local equivalente (emulador não implementa TTL): regras e esquema validados em `rules-hardening` e `k2-incident-sanitize`.
