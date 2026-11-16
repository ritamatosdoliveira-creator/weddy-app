# Matriz AI Seating

| Requisito | Implementação | Teste | Resultado | Observações |
|---|---|---|---|---|
| Distribuição inicial (A) | `seatingCompute` modo `auto` | seating-engine A; ui-seating-ai A | OK | Determinística; nada gravado ao gerar |
| Capacidade nunca excedida (B) | Capacidade efetiva + validador | seating-engine B, Val | OK | Mesas 2/3/5, 11 para 10 lugares recusado |
| Não criar mesas inexistentes | `seatingNormalizeTables` + validador | B, Val | OK | ids/seats inválidos ignorados |
| Famílias juntas (C) | Atributo `f` → uniões STRONG | seating-engine C; ui C | OK | Família maior que a mesa → `FAMILY_SPLIT` explicado |
| Crianças (D) | Atributo `k` → nota por mesa | seating-engine D; ui | OK | Não ocupam lugar próprio |
| Alergias ≠ intolerâncias (E) | Só `c` (0/1) viaja; detalhe fica local (`logiSeatTags`) | ui E | OK | Nota ao catering; nunca promete segurança |
| Acessibilidade (F) | Atributo `a`; `ACCESS_CHECK` | seating-engine F; ui F | OK | Sem planta da sala → sinalizado |
| Grupos (G) | TOGETHER/NEAR + união | seating-engine G | OK | |
| Conflitos explicados (H) | `report.issues` + avisos | seating-engine H | OK | Contradição obrigatória → recusa explicada |
| Otimização sem perder dados (I) | `optimizeSeating` (movimentos/trocas) | seating-engine I; ui I | OK | Mantém não elegíveis; sem duplicados |
| Alterações manuais (J) | Seleção por alteração | ui J | OK | Desmarcada não é aplicada |
| Dados desatualizados (K) | Hash: RSVP/logística, mesas, lugares, convidados | ui K | OK | Mesmo forçando o clique não grava |
| Aplicação duplicada (L) | Trava `aiSeatingCommitting`; limitador servidor | ui L; seating-engine L | OK | 1 gravação / 1 pedido concorrente |
| Premium no servidor (M) | `assertPremiumWedding` | seating-engine M; ui M | OK | Dados nunca apagados |
| Segurança / outro casamento (N) | Sessão → casamento; ids filtrados | seating-engine N; rules-phasec | OK | |
| IA indisponível (O) | Fallback por regras | seating-engine O (7 casos) | OK | timeout, 500, vazio, JSON mau, formato, tipo, marcadores |
| Dados antigos (P) | Tolerância a campos em falta | seating-engine P; ui P | OK | |
| Privacidade (Q) | Pseudonimização; sem IA para explicar | seating-engine Q; ui Q | OK | Corpo do pedido inspecionado |
| Regressão mesas manuais (R) | Sem alteração ao modelo | ui R; suite completa | OK | |
| Limites e desempenho | `SEATING_LIMITS` no servidor | seating-engine Lim/Perf | OK | |
| Validação antes de aplicar | Servidor + cliente | Val (9 adulterações) | OK | |
| Aprovação explícita | Confirmação ao mudar lugares sentados | ui auto/confirmação | OK | |
| Assistente do casal (11.4) | Sem intenções de mesas | auditoria | OK | Não executa alterações |
| Wedding Health (11.5) | Sem indicador novo | auditoria | OK | Pontuação inalterada |
