# Relatório Fase D — Consolidação do AI Seating

Branch `v325-import-guests`. **Tudo local**: sem push, merge, deploy nem alterações em produção; regras e funções **não publicadas**; sem segredos criados/alterados (`defineSecret("OPENAI_API_KEY")` mantido); `STATE_VALIDATE_MODE` desligado; sem custos nem serviços novos.

## 1. Estado inicial (auditoria)
| Componente | Estado encontrado | O que faltava | Ação |
|---|---|---|---|
| `generateSeatingProposal` (servidor) | Funcional: autenticação, `resolveWeddingId`, `assertPremiumWedding` no servidor, limite diário de IA | Sem limites de dimensão, sem proteção contra chamadas repetidas, contava IA mesmo sem a usar | Corrigido |
| `solveSeating` (motor determinístico) | Funcional (capacidade, TOGETHER/APART/NEAR, HARD/STRONG/SOFT) | Ignorava famílias, lugares já ocupados, acessibilidade, distribuição atual | Estendido |
| Modo "distribuição automática" | Implementado | — | Mantido |
| Modo "otimizar a distribuição atual" | **Planeado mas inexistente** | Tudo | Implementado |
| Resolução de conflitos | Parcial (só avisos em texto) | Relatório estruturado | Implementado (`report.issues`) |
| Explicação por mesa | Inexistente (um parágrafo, por IA) | Nº de pessoas, famílias juntas, avisos | Implementado (determinístico, PT/EN) |
| Validação da proposta | Só o motor (sem verificação independente) | Validação integral antes de devolver e antes de gravar | Implementado (servidor **e** cliente) |
| Aplicação | **Substituía todas as atribuições** (`assignments = {...proposal}`), apagando trabalho manual e lugares de não elegíveis | Preservar; aprovar; confirmar | Corrigido |
| Dados desatualizados | Hash de convidados/mesas/preferências | RSVP/logística, lugares atuais | Estendido |
| IA / privacidade | **Enviava a lista de nomes dos convidados** à OpenAI e os avisos (com nomes) na explicação | Minimização | Corrigido |
| Testes | **Nenhum teste dedicado** ao AI Seating | Tudo | 97 + 80 + 3 novos |
| Assistente do casal | Sem intenções de mesas | — | Sem alterações (não pode alterar nada) |
| Wedding Health | Sem indicador de mesas | — | Não criado (evita redundância) |
| Mesas bloqueadas/reservadas | Não suportado no modelo (`{id, shape, seats}`) | — | Documentado; não inventado |
| Crianças | Não ocupam lugar próprio (são dados do RSVP do adulto) | — | Sinalizadas por mesa; não sentadas |

## 2. Arquitetura final
UI (`app/index.html`) → `AIService.generateSeatingProposal(constraints, freeText, mode, attrs)` → função `generateSeatingProposal` (autenticação → casamento da sessão → **Premium no servidor** → limites → limitador → [texto livre: IA com nomes anónimos] → `seatingCompute` determinístico → **validação integral** → relatório) → proposta (simulação) → revisão/aprovação do casal → revalidação local → gravação em `state.seating.assignments` (a mesma estrutura de sempre, sem sistema paralelo).

- **Modos:** `auto` (distribuir de raiz) e `optimize` (melhorar a atual). Resolução de conflitos = `optimize` + relatório.
- **Atributos minimizados** (cliente → nosso servidor, nunca IA): `f` (id opaco de família), `a`/`c`/`k` (0/1: acessibilidade, necessidade alimentar, crianças). Sem textos. Só afetam **preferências** (nunca capacidade, permissões ou restrições obrigatórias). O servidor sanitiza (ids existentes, formato, tamanho).
- **Restrições obrigatórias** (nunca ultrapassadas): capacidade, HARD TOGETHER/APART, lugares de não elegíveis intocáveis, só confirmados.
- **Preferências:** famílias juntas, grupos, equilíbrio por capacidade; acessibilidade e alimentação são **sinalizadas** (não há planta da sala nem menus por mesa).
- **Otimização:** movimentos independentes (cada destino é um lugar livre no estado atual) ou **trocas atómicas** (`group`); aprovadas uma a uma; nunca se tira ninguém do sítio sem destino.

## 3. Segurança
- Autenticação com `email_verified === true`; casamento só pela sessão (`weddingId` do pedido é ignorado); guestIds de outro casamento são descartados.
- **Premium no servidor** (`assertPremiumWedding`): ausente/inativo/expirado → `permission-denied`; reativado → funciona; dados nunca apagados.
- Limites validados no servidor: 800 convidados, 150 mesas, 60 lugares/mesa, 50 preferências, 20 ids/preferência, 800 atributos, texto livre 1000, 60 movimentos.
- Limitador por casamento (`seatingRuns`, 2 s): duplo clique/pedidos concorrentes → só um passa. Coleções internas (`seatingRuns`, `aiUsage`) inacessíveis a clientes (testado nas regras).
- Proposta inválida nunca sai como pronta (`INVALID_PROPOSAL`); respostas da IA malformadas são rejeitadas (fallback local por regras).

## 4. Privacidade e custos
- A IA **só** interpreta texto livre, e só se houver ≥ 2 nomes reconhecidos; recebe o texto com nomes substituídos por `P1, P2…`. Nunca recebe lista de convidados, ids, contactos, alergias, acessibilidade, atributos nem a proposta (testado a inspecionar o corpo do pedido).
- A explicação deixou de usar IA (determinística): menos custo e sem fuga de nomes. O limite diário de IA só conta quando a IA é realmente chamada.
- Sem novos fornecedores, serviços, dependências, secrets ou custos.

## 5. Interface (sem redesign)
Estilo editorial existente. Novo: escolha de modo (só quando já há lugares atribuídos), aviso "simulação", resumo, "Pontos a rever", lista de alterações com seleção (botão circular com `aria-pressed`), notas por mesa, botão "Aplicar N alterações", confirmação quando muda lugares já sentados. 390/768/1360 sem overflow; nenhum botão inerte na proposta válida. PT/EN com paridade.

## 6. Testes (resultado)
| Suite | Resultado |
|---|---|
| `seating-engine` (A, B, C, D, E, F, G, H, I, L, M, N, O, P, Q + limites/desempenho + validador adulterado) | 97/97 |
| `ui-seating-ai` (A, C–F, I, J, K, L, M, P, Q, R; 390/768/1360; EN) | 80/80 |
| `rules-phasec` (+ coleções internas) | 31/31 |
| Suite completa | 36/36 suites (antes 34/34), incluindo concorrência, Premium, segurança, RSVP e logística |

Desempenho medido: 600 convidados / 60 mesas / 120 famílias — distribuição e otimização em milissegundos a poucos segundos (ver teste "Perf").

## 7. Limitações e riscos residuais
- Sem planta da sala: acessibilidade e alimentação são **sinalizadas**, nunca "resolvidas"; "perto" ≈ "mesma mesa".
- Mesas bloqueadas/reservadas não existem no modelo; não foram inventadas.
- A otimização é gulosa (não ótima); pode não resolver todos os conflitos sem mais trocas — o relatório diz o que ficou por resolver.
- A gravação final é local (como a edição manual): o bloqueio Premium no servidor protege a **geração**; a revalidação antes de gravar é no cliente. Falha de rede na gravação: o estado local mantém-se e sincroniza como qualquer outra edição.
- O texto livre que o casal escreve pode conter nomes que não estão na lista (ficam no texto enviado à IA); documentado.
- Chave OpenAI no pacote de produção: risco conhecido, **não rodada**; nenhuma nova exposição.

## 8. Resultado
Fase D concluída localmente (ver `RESUMO-EXECUTIVO-FASE-D.md`). Nada publicado.
