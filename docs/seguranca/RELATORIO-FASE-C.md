# Relatório Fase C — Auditoria de integração end-to-end

Branch `v325-import-guests`. **Tudo local**: sem push, merge, deploy nem alterações em produção; sem segredos tocados; `STATE_VALIDATE_MODE` desligado; regras/funções **não publicadas**.

## 1. Objetivo
Verificar o fluxo Convite → RSVP → Dados do convidado → Logística → Mesas → Concierge → Wedding Health → Notificações, corrigir o que falhasse e provar com testes.

## 2. Estado inicial
Base: B.1 + B.2 (31/31 suites, c8e432e).

## 3. Arquitetura auditada
`guests/{token}` (individual/família), `logistics` opcional por pessoa, acompanhamento privado `entry.logi` do casal, Concierge por regras (sem IA para dados privados), Health (contagem, ≤120 dias), notificações (máx. 2 de saúde), lembretes por email no servidor (não leem `logistics`).

## 4. Problemas encontrados e corrigidos
| # | Sev. | Problema | Correção |
|---|---|---|---|
| 1 | P1 | "Organizado" continuava válido depois de o convidado mudar as necessidades | Assinatura por necessidade (`done@<sig>`); mudança reabre "por organizar" (compatível com `'done'` antigo) |
| 2 | P1 | Submissão de família reescrevia todos os membros com estado local antigo (outro dispositivo podia ser sobrescrito) | Escrita só dos membros alterados (`familyBaseline`) |
| 3 | P2 | Revogar convite deixava `entry.logi` órfão | `revokeRSVPLink` apaga `logi` |
| 4 | P2 | Concierge: perguntas indiretas/contornos sobre terceiros não eram recusadas (alergias, "o Nome precisa…", "the others…") | `asksAboutOthersPrivate` PT/EN; recusa local, sem chamada à IA (14/14) |
| 5 | P2 | Etiquetas de mesa e verificação Health apareciam sem Premium | Respeitam `hasActiveSubscription()` |
| 6 | P2 | Assistente do casal (`getDietaryList`) ignorava alergias/intolerâncias/dietas estruturadas | Passa a listá-las (só localmente) + nota antiga |
| 7 | P3 | `.pyc` versionado | `.gitignore` + removido do índice |

## 5. Verificado sem alterações necessárias
Regras: convidado não lista, não escreve `logi`/campos extra/protegidos, não muda `weddingId`; dono de outro casamento sem acesso; escritas concorrentes (família + casal) preservam ambas. Lembretes: idêntico com e sem `logistics`, sem WhatsApp/IA, idempotente. Health: janela 120 dias (dentro, limite, fora, sem data), sem recusados/duplicação de famílias, sem dados pessoais, índice inalterado. Mesas: nunca alteradas automaticamente. Dados antigos (sem `logistics`) e Premium desligado/ligado funcionam.

## 6. Ciclo de vida (secção 4)
Mudar/recusar/apagar resposta, remover membro/família/convidado, mudar data, reenviar convite, token revogado, submissão dupla, falha de escrita: sem dados órfãos. Preservado por desenho: reservas de idempotência de lembretes (sem email/nome) e registos de auditoria.

## 7. Testes
Novos: `rsvp-reminders-logistics` (10), `rules-phasec` (28), `ui-phasec-e2e` (89; 390/768/1360), Concierge privacidade (26), ajustes em `logistics_couple` (47). Resultado da suite completa: ver `RESUMO-EXECUTIVO-FASE-C.md`.

## 8. Desempenho e custo
Sem novas leituras/listeners/funções; helpers em memória O(convidados); menos chamadas de IA (recusas locais). Sem custos novos.

## 9. Riscos residuais
- `get` de `guests/{token}` aberto por ID (desenho: o token é a credencial).
- Interior de `responses.*` (família) não validado em profundidade pelas regras.
- CSV não inclui logística (minimização).
- Lembretes por email não dependem do consentimento WhatsApp (STOP só afeta WhatsApp).
- Risco já conhecido da chave OpenAI no pacote de produção: não alterado.
- Teste D simula localmente a remoção do lado do casal; o caminho Firestore real está coberto por regras + auditoria de código.

## 10. Dependências de publicação
Ver `CHECKLIST-PUBLICACAO-PENDENTE.md`. Ordem: regras → funções → site.

## 11. Conclusão
Fase C concluída localmente, com 7 correções; nada publicado.
