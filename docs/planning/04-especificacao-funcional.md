# Documento 4 — Especificação funcional da Weddy Planning

**Versão 2 (17/11/2026)** — revista após a revisão da Fase 0. Especificação de produto; nada está implementado. Legenda: **[Decisão aprovada]**, **[Proposta técnica]**, **[Questão pendente]** (ver Doc. 3 §16), **[Trabalho futuro]**. Os nomes de dados seguem o Doc. 3 v2 (`professionalLinks`, `consent`, `grants`), que substitui o antigo `planningLink`.

Formato por módulo: **Objetivo · Utilizadores · Funcionalidades · Permissões · Dados · Estados · Dependências · Testes**. Papéis: OW owner, AD admin, PL planner, CO coordinator, AS assistant; casal: CP (owner/partner). "Grant" = acesso da pessoa ao casamento (Doc. 3 §4).

---

## M1. Organização e equipa
- **Objetivo**: criar e gerir o estúdio, os membros e as permissões.
- **Utilizadores**: OW, AD (gestão); todos (perfil próprio).
- **Funcionalidades**: perfil e identidade (logótipo, cor de acento dentro da paleta), definições fiscais por omissão (IVA, moeda), convites internos a membros (token com hash, validade, uso único), papéis, matriz de permissões por secção da organização, atribuição de membros a casamentos (grants), disponibilidade e calendário da equipa, custo/hora por membro, histórico de atividade.
- **Permissões**: só OW altera owner/plano; OW/AD gerem membros; ninguém altera o próprio papel; papéis e estados só pelo servidor.
- **Dados**: `organizations/{orgId}`, `members/{uid}`, `memberInvites/{id}`, `auditLog`.
- **Estados do membro**: `invited → active ⇄ suspended → removed`; organização `active | suspended`.
- **Operações distintas** [Decisão aprovada] (detalhe técnico no Doc. 3 §10):

| Operação | Efeito |
|---|---|
| Remover membro | Perde imediatamente o acesso à organização e **todos** os seus grants de casamentos são revogados; conversas, documentos, anexos, exportações e links temporários deixam de lhe ser servidos; operações pendentes canceladas; os registos que criou ficam na organização |
| Suspender membro | Acesso negado enquanto suspenso; grants mantêm-se inoperantes; reativar restaura sem reconfigurar |
| Revogar acesso a um casamento | Só esse grant; o membro continua na organização |
| Terminar relação profissional | Ver M4 — atinge toda a organização nesse casamento, não um membro |

- **Dependências**: Auth; Fase 1A/1B.
- **Testes**: acesso cruzado entre organizações; elevação de papel recusada; membro removido e suspenso perdem acesso imediato em regras **e** funções (incluindo conversas, ficheiros e exportações já pedidas); reativação; revogação de um só casamento não afeta os outros.

## M2. Hoje (dashboard) e Wedding Risk Monitor
- **Objetivo**: o que precisa de atenção hoje e esta semana.
- **Utilizadores**: todos os membros (vê só os casamentos com grant).
- **Funcionalidades**: números-chave (casamentos ativos, pedidos novos, propostas pendentes, pagamentos em atraso), **Precisa de atenção** (radar), próximos casamentos com progresso, agenda do dia, blocos configuráveis por utilizador, sugestão da Weddy Intelligence.
- **Regras do radar** (calculadas no servidor, diárias + em eventos): tarefa crítica em atraso; fornecedor sem confirmação a < N dias; orçamento ultrapassado (do `json` partilhado); prestação a vencer/vencida; aprovação pendente > N dias; prazo próximo sem responsável; convidados sem resposta perto do prazo do RSVP.
- **Permissões**: valores financeiros só com `finance:view`.
- **Dados**: `organizations/{orgId}/risks/{id}` (gerado), preferências em `members/{uid}.dashboard`.
- **Estados**: risco `open → acknowledged → resolved | snoozed`.
- **Dependências**: M4, M5, M10, M11.
- **Testes**: cada regra com casos limite (fronteira de datas, fusos); membro sem grant não vê riscos desse casamento.

## M3. CRM e pipeline comercial
- **Objetivo**: acompanhar cada pedido do primeiro contacto ao contrato e ao casamento.
- **Utilizadores**: OW, AD, PL (edição); CO (ver).
- **Ciclo** [Decisão aprovada]: **Lead → Contacto → Reunião → Proposta → Negociação → Cliente contratado → Casamento** (estado `perdido` possível em qualquer fase até ao contrato).
- **Funcionalidades**: formulário público por organização (anti-spam, rate limit, App Check), registo manual, origem, dados dos noivos, data/local pretendidos, n.º estimado de convidados, orçamento indicativo, histórico (notas, emails, chamadas), reuniões, questionário inicial, próximos passos e lembretes, motivos de perda, vistas pipeline/lista/perdidos.
- **Conversão em cliente** [Proposta técnica] (modelo definitivo: [Questão pendente] Q2): `clientId = leadId` (sem duplicar registos nem identificadores); **idempotente** (repetir devolve o mesmo cliente); **auditável**; **reversível** só enquanto não houver convite aceite nem contrato assinado; segura em execução simultânea (transação); o histórico comercial fica no lead.
- **Conversão em casamento**: o casamento é sempre o `weddings/{id}` do casal — criado pelo casal na Couples, ou pelo servidor quando o noivo aceita um convite `new_wedding` (M4). A organização mantém uma **ficha interna** com o mesmo `weddingId`; **não** cria convidados, mesas, orçamento ou fornecedores próprios para o casamento.
- **Permissões**: leads visíveis a membros com `crm:view`; dados de leads são internos (nunca visíveis ao casal).
- **Dados**: `leads/{id}`, `leads/{id}/activity`, `clients/{id}`.
- **Testes**: formulário público não escreve noutra organização; conversão concorrente (2 pedidos) gera 1 cliente; reverter bloqueado após convite aceite; histórico preservado após conversão.

## M4. Carteira de casamentos (ficha profissional)
- **Objetivo**: cada casamento como projeto da organização, reutilizando os dados e módulos existentes da Couples.
- **Funcionalidades**: Overview (data, local, serviço, equipa, estado da ligação, **o que o casal partilha**), Planeamento (tarefas internas por fases), acesso às secções do casal **apenas** se autorizadas (Orçamento, Fornecedores, Compare, Convidados, Mesas, Design, Programa do dia, Documentos, Memories), notas internas, equipa atribuída, **pedido de acesso** a secções não partilhadas.
- **Consentimento do casal** [Decisão aprovada]: três estados por secção — **Não partilhar**, **Consultar**, **Consultar e editar**; tudo começa em "Não partilhar"; ausência de configuração = negado; só o casal altera; revogável a qualquer momento com efeito imediato no servidor. Secção não autorizada aparece como "Não partilhada pelo casal", sem conteúdo nem contagens.
- **Pedidos de acesso** [Proposta técnica]: o planner pede uma secção e um nível com um motivo; o casal aceita ou recusa no ecrã de permissões; nada muda até aceitar; limites de repetição; pedidos expiram.
- **Leitura e escrita** [Proposta técnica]: leitura com verificação atual da autorização (regras sobre projeções + funções para operações sensíveis); escrita só por função, por secção, com `baseRev` (Doc. 3 §6–7). Fase 1C sem leitura nem escrita de dados; 1D leitura; 1E escrita.
- **Permissões**: membership ativa + papel + grant ativo + ligação ativa + consentimento da secção.
- **Dados**: `organizations/{orgId}/weddings/{weddingId}` (interno) · `weddings/{weddingId}/professionalLinks/{orgId}` (+ `consent/current`, `grants/{uid}`, `accessRequests/{id}`) · projeções por secção (cache) · função de escrita.
- **Estados**: ficha `prospect → invited → linked → completed → archived`; ligação `pending | active | ended`.
- **Fim da relação**: pelo casal ou pela organização; o casal mantém tudo e continua a usar a Couples; a organização perde o acesso e mantém só os seus dados internos.
- **Dependências**: Fase 1C, 1D, 1E.
- **Testes**: secção `none` invisível (regras e funções); revogação durante uma leitura/escrita; alterações rápidas de permissões; trigger atrasada/falhada; projeção desatualizada não expõe dados; casal e planner em simultâneo; fim da relação.

## M4a. Operações do planner por secção — [Proposta técnica], decisão em Q8

"Consultar e editar" proposto **sem eliminação** na Fase 1E (apagar pede confirmação do casal, numa fase posterior).

| Secção (chaves do casamento) | Consultar | Consultar e editar (proposta 1E) | Nunca pelo planner |
|---|---|---|---|
| Convidados (`guests`, `confirmed`) | lista, grupos, RSVP, logística | acrescentar/editar convidados e grupos, notas | apagar convidados; alterar consentimentos WhatsApp; ver/regenerar tokens RSVP |
| Mesas (`seating`) | plano | editar plano, correr AI Seating (proposta, aplicar com confirmação) | — |
| Orçamento (`budget`, `categories`, `expenses`, `payments`) | tudo | acrescentar/editar linhas e categorias | apagar pagamentos registados pelo casal |
| Fornecedores (`suppliers`) | tudo | acrescentar/editar fornecedores e estados | — |
| Compare (`compares`) | resultados | correr comparações (quota da organização) | — |
| Programa do dia (`daySchedule`) | tudo | editar | — |
| Tarefas (`todos`, `todoCategories`) | tudo | acrescentar/editar tarefas | apagar tarefas do casal |
| Design (`stationery*`, `cake`, `dressStyle`) | tudo | editar | — |
| Documentos (`weddingDocuments`, Storage) | listar e abrir (URL temporário) | acrescentar | apagar ficheiros do casal |
| Memories, Website, Convites | consultar | [Trabalho futuro] | publicar/despublicar em nome do casal |
| `vows`, `honeymoon`, `checklistPersonal`, `dressVisits` | **não partilháveis** nesta fase | — | — |

## M4b. Gestão de permissões pelo casal (na Couples) — [Decisão aprovada] existe desde a primeira integração
- **Objetivo**: o casal escolhe, altera e revoga o que partilha com cada organização.
- **Onde**: ecrã próprio, acessível pelo link do convite aceite e por um ponto de entrada discreto na Couples (ver Doc. 7); não tem de estar na navegação principal na primeira versão.
- **Funcionalidades**: lista das secções com os três estados (por omissão "Não partilhar"); pedidos de acesso pendentes (aceitar/recusar); equipa da organização com acesso; "Terminar ligação"; histórico de alterações.
- **Regras**: alterações gravadas por função que confirma que quem pede é dono do casamento; efeito imediato; cada alteração auditada.
- **Testes**: só donos alteram; planner não consegue alterar por nenhuma via; efeito imediato nas leituras do planner; terminar ligação não afeta a Couples.

## M5. Templates e biblioteca de processos
- **Objetivo**: preparar automaticamente a estrutura de trabalho de cada casamento.
- **Funcionalidades**: templates (Full Planning, Partial, Coordination, Destination, Micro, vários dias) com fases, tarefas, responsáveis por papel, **prazos relativos à data do casamento**, questionários, documentos e checklists; aplicar ao criar ou depois; recalcular prazos quando a data muda; versões de template.
- **Dados**: `templates/{id}/versions/{v}`; instâncias em `weddings/{id}/tasks`.
- **Testes**: data alterada recalcula só tarefas não concluídas; template novo não altera casamentos já criados.

## M6. Propostas comerciais
- **Objetivo**: propostas elegantes, com margem interna e aceitação online.
- **Funcionalidades**: tipos de serviço, linhas e extras opcionais, preço individual, **custo e margem internos (nunca no documento do cliente)**, IVA e condições, plano de pagamentos, fotografias, modelos reutilizáveis, versões, link seguro (token com hash, validade), o cliente seleciona extras e aceita/rejeita, registo de visualizações; aceitação gera contrato (M7) e casamento (M4) sem duplicação.
- **Estados**: `rascunho → enviada → vista → aceite | rejeitada | expirada`; cada envio congela uma versão.
- **Permissões**: margens só com `finance:view`.
- **Testes**: a página pública nunca contém custos/margens (teste de conteúdo); versão aceite é imutável.

## M7. Contratos e assinaturas
- **Funcionalidades**: modelos com campos dinâmicos (cliente, serviços, valores, prestações, condições), geração a partir da proposta aceite, versões, envio, alertas de pendência, registo da assinatura.
- **Assinatura**: integração com prestador (proposta: avaliar prestador qualificado eIDAS com presença em PT — p.ex. serviços com Chave Móvel Digital/CC — e alternativa de assinatura eletrónica avançada). **Não** construir assinatura própria. Até à integração: aceitação registada (nome, email, IP, data, hash do documento) apresentada como "aceitação eletrónica", não como assinatura qualificada.
- **Estados**: `rascunho → enviado → assinado parcialmente → assinado | cancelado`.
- **Testes**: documento assinado imutável (hash); alterações criam nova versão.

## M8. Fornecedores e espaços
- **Funcionalidades**: base por organização com categorias (quintas/espaços, fotografia, vídeo, flores, decoração, catering, DJ, música, maquilhagem, cabelos, design, papelaria, outros), contactos, localização, serviços, preços habituais, condições, documentos (seguros, licenças com validade), avaliações internas, histórico, casamentos associados, disponibilidade conhecida; biblioteca de espaços (capacidade, localização, fotografias, condições); associar a casamentos (liga ao módulo Fornecedores do casal quando partilhado); importação Excel.
- **Visibilidade**: avaliações e preços habituais são INTERNOS.
- **Testes**: avaliações internas nunca na projeção do casal nem no portal do fornecedor.

## M9. Portal de fornecedores
- **Objetivo**: cada fornecedor vê só o que precisa para aquele casamento.
- **Funcionalidades**: link por fornecedor e casamento (token com hash, revogável, validade até D+7), cronograma filtrado, horários, moradas, contactos, instruções técnicas, documentos autorizados; o fornecedor confirma presença/horários, envia documentos e comunica alterações.
- **Nunca**: dados privados do casal (convidados, orçamento), finanças internas, outros casamentos.
- **Dados**: `organizations/{orgId}/weddings/{id}/vendorAccess/{id}` + respostas.
- **Testes**: token de um casamento não abre outro; token revogado; ficheiros fora da lista autorizada inacessíveis.

## M10. Cronograma e Run Sheet
- **Funcionalidades**: atividades por fase (montagem, cerimónia, receção, desmontagem), hora início/fim, responsáveis (equipa e fornecedores), locais, contactos, instruções, estado, alertas, histórico de alterações e versões; vistas **Planner / Equipa / Fornecedor / Documento completo**; exportação PDF; parte partilhada com o casal = Programa do dia existente (`daySchedule`), parte operacional = interna.
- **Estados**: atividade `por confirmar → confirmado → em curso → concluído | problema`; documento com versão.
- **Testes**: vista de fornecedor só mostra as suas linhas e as gerais; PDF gerado igual à vista.

## M11. Financeiro profissional
- **Separação**: (A) financeiro do casamento = orçamento/gastos/pagamentos do casal (partilhado, existente); (B) financeiro da organização = negócio (interno, novo).
- **Funcionalidades (B)**: receita contratada, planos de pagamento, recebimentos, valores pendentes e antiguidade, custos operacionais e de colaboradores, horas, margem por casamento, receita mensal/anual, previsões, rentabilidade por serviço.
- **Fiscal**: registo de gestão, **não** é faturação certificada; integração com software certificado (InvoiceXpress, Moloni, Vendus) a avaliar.
- **Permissões**: só `finance:view/edit`.
- **Testes**: assistente sem permissão não lê nenhum documento financeiro (regras, não só UI).

## M12. Questionários e reuniões
- **Funcionalidades**: modelos (inicial, estilo, logística, necessidades especiais, personalizados), envio por link sem conta, respostas na ficha; agendamento por link com disponibilidade (Google Calendar já integrado na Core); atas, decisões e tarefas resultantes.
- **Testes**: link de questionário de uma organização não grava noutra; respostas validadas por esquema.

## M13. Aprovações
- **Objetivo**: decisões formais do casal com prova.
- **Funcionalidades**: pedir aprovação de fornecedor, proposta, orçamento, decoração, moodboard, ementa, papelaria, cronograma ou alteração; o casal aprova/rejeita/comenta na Couples (via Conversations, Fase 4) ou por link.
- **Registo**: utilizador, data/hora, conteúdo congelado (hash), versão, estado, histórico.
- **Estados**: `pedida → vista → aprovada | rejeitada | alterações pedidas`.

## M14. Design e moodboards profissionais
- **Reutiliza**: Design/Papelaria/inspirações da Couples (`stationeryDesign`, paleta).
- **Acrescenta**: moodboards por casamento e por coleção da organização, imagens, cores, referências, apresentação, marca da organização, partilha controlada e aprovação (M13), versões.

## M15. Gestão documental
- **Funcionalidades**: contratos, propostas, documentos de fornecedores, seguros, licenças, versões, validade com alertas, permissões por documento; liga a `documents/{weddingId}` (partilhados) e a documentos internos da organização.

## M16. Registo de horas e rentabilidade
- **Funcionalidades**: cronómetro e registo manual por casamento/colaborador/atividade, horas estimadas (do template) vs. reais, custo de trabalho, valor/hora efetivo, rentabilidade real.
- **Permissões**: cada membro regista as suas; custos só `finance`.

## M17. Weddy Conversations
Ver Doc. 3 §8. Requisitos funcionais: conversa por casamento, tempo real, anexos (imagens/documentos), respostas, pesquisa, filtros (importantes, decisões, anexos), marcar importante, decisões classificadas, mensagem → tarefa, **leitura individual**, edição auditada, sem eliminação, exportação PDF (integral, período, participante, decisões) e arquivo ZIP com checksum; registo de cada exportação.
- **Visibilidade na Couples**: ícone junto às notificações **só** com ligação ativa (não depende de Premium; convite pendente = sem ícone; relação terminada = sem ícone, histórico acessível ao casal em só leitura a partir das definições da ligação).
- **Revogação**: membro removido/suspenso deixa de ler e escrever de imediato; anexos e exportações servidos por URL assinado de curta duração emitido após verificar a autorização.
- **Conversas e consentimento**: a conversa não depende das secções partilhadas, mas um anexo de uma secção não partilhada não é exposto por referência.
- **Testes**: tabela das 6 regras de visibilidade; leitura por noivo independente; acesso após fim de relação; anexos acessíveis só a participantes; exportação regista checksum e expira o link.

## M18. Weddy Intelligence
- **Funcionalidades**: perguntas sobre dados autorizados (casamentos, clientes, fornecedores, orçamentos, tarefas, cronogramas, documentos, conversas, calendário, equipa); preparar reuniões, resumir decisões, comparar propostas (reutiliza Compare), preparar cronograma, decisões → tarefas.
- **Regras**: só dados a que o utilizador tem acesso **no momento do pedido** (o contexto é montado no servidor verificando membership, grant, ligação e consentimento por secção; nunca a partir de projeções sem verificação); propõe, **nunca executa** sem confirmação; nada financeiro/contratual automático; `store:false`; quotas por organização; registo de uso.
- **Testes**: um membro sem grant não obtém dados desse casamento por pergunta indireta (testes adversariais de prompt).

## M19. Email e comunicação externa (avaliação)
Fase 5+: templates, envio pelo servidor, histórico associado a cliente/casamento/fornecedor. Integração de caixa de correio (OAuth Gmail/Microsoft) só depois de avaliação RGPD e de custo.

## M20. Brochuras e portefólio
Fase 7: brochuras de serviços e pacotes, página pública da organização. Sem marketplace no MVP.
