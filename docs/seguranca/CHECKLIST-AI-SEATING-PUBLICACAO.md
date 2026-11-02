# Checklist de publicação — AI Seating (Fase D)

Legenda: **[L]** validado localmente · **[P]** precisa de publicação · **[C]** precisa de configuração · **[V]** precisa de validação em produção.

## Funções
- [L][P] `generateSeatingProposal` (motor, validação, limites, limitador, pseudonimização). Publicar **antes** do site (o novo cliente envia `mode` e `attrs`; o servidor antigo ignora-os e responde sem `validated`, pelo que o novo cliente recusa a resposta — ordem: funções → site).
- Novo documento interno `seatingRuns/{weddingId}` (só servidor, criado na 1.ª utilização; sem migração).

## Regras Firestore / Storage
- [L] Sem alterações nesta fase. `seatingRuns` e `aiUsage` não têm regras (acesso de cliente negado por omissão; testado).

## Frontend
- [L][P] `app/index.html` (modo, aprovação, validação local, textos PT/EN).

## Configuração / segredos
- [C] Nenhuma nova. `OPENAI_API_KEY` via `defineSecret` mantido. Rotação da chave exposta no pacote de produção continua pendente (passagem controlada para produção).

## Migrações
- Nenhuma. Casamentos sem logística/atributos funcionam.

## Validação em produção
- [V] Casamento de teste Premium: gerar (de raiz e otimizar), aprovar parte das alterações, confirmar que lugares manuais se mantêm.
- [V] Conta sem Premium e Premium expirado → `permission-denied`.
- [V] Texto livre com 2 nomes: confirmar no registo da OpenAI (se aplicável) que só chegam marcadores `P1/P2`.
- [V] Casamento grande (~300–600 convidados): tempo de resposta.
- [V] Custos: a explicação deixou de usar IA (menos chamadas).
