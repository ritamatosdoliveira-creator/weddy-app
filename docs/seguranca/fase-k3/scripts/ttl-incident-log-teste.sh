#!/usr/bin/env bash
# K.3-D — TTL do _incident_log SÓ no projeto de teste. Executar pela Rita, depois de confirmar que os dados são fictícios.
set -euo pipefail
cd "$(dirname "$0")"; source ./guard-projeto-teste.sh "${1:-}"
P="$1"
echo "== Estado atual das políticas TTL =="; gcloud firestore fields ttls list --project "$P" 2>&1 | head -20
echo "== Ativar TTL em _incident_log.expireAt (apenas esta coleção; não afeta stripePayments/stripeEvents/memoryQuota/etc.) =="
gcloud firestore fields ttls update expireAt --collection-group=_incident_log --enable-ttl --project "$P"
echo "O TTL demora até ~24h a apagar. Ver VALIDACAO-TTL-TESTE.md para os registos de prova (futuro / passado / sem expireAt / financeiro)."
