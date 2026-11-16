# Weddy Planning — Fase 0 (auditoria, arquitetura e plano)

Estado: **aprovação condicionada** (v2 de 16/11/2026). A Fase 1 não está autorizada. Nenhuma funcionalidade implementada; nenhuma alteração à Couples, às regras, às funções ou ao Firebase; sem push, merge ou deploy.

| # | Documento |
|---|---|
| 1 | [Auditoria técnica](01-auditoria-tecnica.md) |
| 2 | [Análise da concorrência](02-analise-concorrencia.md) |
| 3 | [Arquitetura técnica](03-arquitetura-tecnica.md) |
| 4 | [Especificação funcional](04-especificacao-funcional.md) |
| 5 | [Design system](05-design-system.md) · [protótipo](prototipos/index.html) · [capturas](prototipos/capturas/) |
| 6 | [Roadmap técnico](06-roadmap-tecnico.md) |
| 7 | [Plano de integração e proteção da Weddy Couples](07-protecao-weddy-couples.md) |
| — | [DESIGN.md](DESIGN.md) — regras visuais da Planning (resumo do Doc. 5) |

Decisões pendentes: **Doc. 3 §16** (questões Q1–Q8, todas por decidir) e Doc. 6 «Pré-requisitos» (P1, P3–P6).

## Notas de leitura
- **Doc. 1 é um registo factual** da auditoria de 16/11/2026 e não é atualizado com decisões posteriores. A referência ao campo `planningLink` no Doc. 1 §9 é um **exemplo histórico**: esse desenho foi substituído no Doc. 3 v2 §4 pela subcoleção `weddings/{id}/professionalLinks/{orgId}` (proposta técnica, pendente de Q1/Q3).
- Docs. 1 e 2 indicam a data 17/11/2026 por lapso; o trabalho foi realizado a 16/11/2026 (ver datas dos commits). Não foram alterados para preservar o registo original.
- Localização: worktree `~/weddy-producao/planning` (branch `feature/weddy-planning`), criado em `~/weddy-planning` e movido com `git worktree move` a 16/11/2026.
