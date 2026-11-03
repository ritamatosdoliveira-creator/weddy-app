#!/usr/bin/env bash
# Barreira de segurança: aborta se o projeto não for EXATAMENTE o de teste. Usar no início de qualquer comando externo.
# Uso: source guard-projeto-teste.sh <project-id>
set -euo pipefail
TESTE="weddy-premium-teste"; PROD="weddy-app-bd12f"
P="${1:-}"
[ "$P" = "$PROD" ] && { echo "ABORTADO: $P é PRODUÇÃO."; exit 2; }
[ "$P" = "$TESTE" ] || { echo "ABORTADO: projeto '$P' não é o de teste ($TESTE)."; exit 2; }
echo "Projeto confirmado como TESTE: $P. Confirma ainda que NÃO há dados reais de casais (Firestore e Storage) antes de continuar."
read -r -p "Escreve o id do projeto para continuar: " C; [ "$C" = "$TESTE" ] || { echo "Cancelado."; exit 2; }
