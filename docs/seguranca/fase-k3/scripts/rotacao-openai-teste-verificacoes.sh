#!/usr/bin/env bash
# K.3-F — verificações NÃO secretas para a rotação OpenAI no projeto de teste. NÃO cria, lê nem imprime a chave.
# A chave nova é criada e guardada pela Rita (passos 2-3 do PLANO-ROTACAO-OPENAI.md), de forma interativa.
set -euo pipefail
cd "$(dirname "$0")"; source ./guard-projeto-teste.sh "${1:-}"; P="$1"
echo "== Versões do segredo (estado, sem valor) =="; gcloud secrets versions list OPENAI_API_KEY --project "$P"
echo "== Funções que referenciam o segredo =="; for f in classifyWeddyIntent generateSeatingProposal analyzeCompareProposal generateCompareReport; do echo "- $f"; gcloud functions describe "$f" --gen2 --region europe-west1 --project "$P" --format="value(serviceConfig.secretEnvironmentVariables[0].key,serviceConfig.secretEnvironmentVariables[0].version)"; done
echo "Depois do teste funcional no projeto de teste, desativar a versão antiga: gcloud secrets versions disable <n> --secret OPENAI_API_KEY --project $P"
