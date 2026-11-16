# Documento 6 — Roadmap técnico

Complexidade: **S** (dias), **M** (1–2 semanas), **L** (3–5 semanas), **XL** (> 5 semanas) para uma pessoa com apoio de IA. Cada fase só começa com aprovação e termina com os testes existentes (76 suites) a verde + os novos.

## Pré-requisitos (antes da Fase 1)

| # | Item | Dono | Porquê |
|---|---|---|---|
| P1 | Decidir a origem do GitHub Pages (doc. `docs/integracao/D-github-pages.md`) | Rita | Sem isto, nada desta branch pode entrar no `main` |
| P2 | Decidir a tecnologia do frontend da Planning (Doc. 3 §13.2) | Rita | Define a estrutura da Fase 2 |
| P3 | Ambiente de staging: `weddy-premium-teste` (ou projeto novo) para a Planning | Rita | Testes reais de convites/email sem tocar em produção |
| P4 | Confirmar que versão do backend está em produção (só leitura) | Claude + Rita | Base fiável para as alterações às regras |

## Fases

### Fase 1 — Weddy Core e arquitetura SaaS · **L**
- Coleções `organizations`, `members`, `auditLog`; `weddings/{id}.planningLink` e `grants/{uid}`; regras (incluindo a proteção de `planningLink`); codebase `planning` de funções; callables de organização/membros/grants; projeção `weddingPlannerViews`; callable de escrita por secção.
- **Dependências**: P1–P4.
- **Riscos**: alteração das regras de `weddings` (partilhadas com a Couples); custo de leituras das regras (`get`/`exists`).
- **Aceitação**: organização criada; membro com e sem grant; casal não consegue alterar `planningLink`; nenhuma suite existente regride.
- **Testes novos**: matriz de acesso cruzado entre 2 organizações × 5 papéis × 3 casamentos; elevação de papel; IDOR por `weddingId`/`orgId` trocado; projeção respeita `hidden/view/edit`; concorrência casal/planner por secção.

### Fase 2 — Weddy Planning Core · **XL**
- App `/planning/` (shell, navegação, design system), Hoje (sem radar completo), CRM inicial (leads + pipeline + conversão), clientes, carteira de casamentos, calendário, equipa, tarefas, notas internas, templates com prazos relativos.
- **Aceitação**: um planner gere 3 casamentos fictícios de ponta a ponta no staging; revisão visual com capturas a 1440/1024/390; auditoria de acessibilidade (`design:accessibility-review`).
- **Testes**: regras de cada coleção; UI (Playwright) das vistas principais; templates (recalcular datas).

### Fase 3 — Integração Weddy Couples · **L**
- Convites (criar, email, reenviar, revogar, expirar), página `/aceitar/`, criação do casamento pelo planner com o casal como dono, ligação a casamento existente com consentimento, partilha por secção, fim da relação.
- **Riscos**: identidade (email da conta ≠ email convidado), contas Apple com email privado (relay), casamentos múltiplos do casal.
- **Aceitação**: os 10 passos do fluxo do pedido (secção 6) passam no staging com conta nova e conta existente; casamento aparece na Couples sem alterar `app/index.html`.
- **Testes**: convite válido, expirado, revogado, reutilizado, email diferente, força bruta (rate limit), conta existente, conta nova, fim de relação (planner perde acesso, casal mantém tudo).

### Fase 4 — Weddy Conversations · **L**
- Coleções e regras de conversas, anexos, leitura individual, decisões, mensagem → tarefa, pesquisa, exportação PDF + ZIP com checksum, ícone e ecrã na Couples (exceção autorizada), FCM (se aprovado).
- **Aceitação**: as 6 regras de visibilidade do ícone; contadores por pessoa; PDF integral paginado; regressão completa da Couples.
- **Testes**: participantes, anexos, edição auditada, sem eliminação, exportação (registo + link temporário), acesso após fim de relação.

### Fase 5 — Gestão profissional avançada · **XL** (dividir em sub-fases)
5a Propostas (link público, extras, versões) · 5b Contratos + integração de assinatura · 5c Fornecedores e espaços · 5d Portal de fornecedores · 5e Financeiro + horas · 5f Run sheet completo + PDFs · 5g Questionários, reuniões e aprovações · 5h Documentos.
- **Riscos**: requisitos legais (eIDAS, faturação certificada — integrar, não construir).
- **Testes**: conteúdo da proposta pública sem custos/margens; portal do fornecedor isolado; finanças só com permissão.

### Fase 6 — Weddy Intelligence · **L**
Radar de riscos completo, workflows "quando X, faz Y", assistente com contexto autorizado montado no servidor, sugestões com confirmação. **Testes** adversariais de fuga de dados entre casamentos/organizações.

### Fase 7 — SaaS comercial e lançamento · **L**
Planos Solo/Studio/Agency com limites aplicados no servidor, subscrições (Stripe), onboarding, marca do planner, integrações (faturação certificada, calendário), pilotos com 3–5 planners, lançamento.

## Ordem e dependências

```
P1–P4 ─► F1 Core ─► F2 Planning Core ─► F3 Integração Couples ─► F4 Conversations
                                   └──────────────► F5 (sub-fases em paralelo após F3) ─► F6 ─► F7
```

## Riscos transversais

| Risco | Mitigação |
|---|---|
| Regressão na Couples | Suites existentes antes e depois de cada alteração; Doc. 7 |
| Custo das regras (`get`) e leituras | Grants por pessoa (1 `exists`), projeções em vez de leituras do `json` completo |
| Limite de 900 KB do `json` | A Planning nunca grava dados próprios no `json` |
| Âmbito demasiado grande | Sub-fases com entregas utilizáveis; pilotos cedo (após F3) |
| Dependência de publicação (Pages) | Resolver P1 antes de F1 |
