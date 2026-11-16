# Documento 4 — Especificação funcional da Weddy Planning

Formato por módulo: **Objetivo · Utilizadores · Funcionalidades · Permissões · Dados · Estados · Dependências · Testes**. Papéis: OW owner, AD admin, PL planner, CO coordinator, AS assistant; casal: CP (owner/partner). "Grant" = acesso da pessoa ao casamento (Doc. 3 §3).

---

## M1. Organização e equipa
- **Objetivo**: criar e gerir o estúdio, os membros e as permissões.
- **Utilizadores**: OW, AD (gestão); todos (perfil próprio).
- **Funcionalidades**: perfil e identidade (logótipo, cor de acento dentro da paleta), definições fiscais por omissão (IVA, moeda), convites a membros, papéis, matriz de permissões por secção, atribuição de membros a casamentos, disponibilidade e calendário da equipa, custo/hora por membro, histórico de atividade.
- **Permissões**: só OW altera owner/plan; OW/AD gerem membros; ninguém altera o próprio papel.
- **Dados**: `organizations/{orgId}`, `members/{uid}`, `auditLog`.
- **Estados**: membro `invited → active → suspended → removed`; organização `active | suspended`.
- **Dependências**: Auth; Core multi-tenant (Fase 1).
- **Testes**: acesso cruzado entre organizações; elevação de papel pelo cliente recusada; membro removido perde acesso imediato (grants revogados).

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
- **Objetivo**: acompanhar cada pedido do primeiro contacto ao contrato.
- **Utilizadores**: OW, AD, PL (edição); CO (ver).
- **Funcionalidades**: formulário público de contacto por organização (anti-spam + rate limit), registo manual, origem, dados dos noivos, data/local pretendidos, n.º estimado de convidados, orçamento indicativo, histórico (notas, emails enviados, chamadas), reuniões, questionário inicial, próximos passos e lembretes, motivos de perda, vistas pipeline/lista/perdidos, **conversão em casamento** sem reintroduzir dados.
- **Pipeline**: `novo → contactado → reunião → proposta → negociação → contratado | perdido`.
- **Permissões**: leads visíveis a toda a organização com `crm:view`.
- **Dados**: `leads/{id}`, `clients/{id}`, `leads/{id}/activity`.
- **Dependências**: M12 (questionários), M6 (propostas), M1.
- **Testes**: formulário público não permite escrever noutra organização; conversão cria cliente+casamento uma vez (idempotente).

## M4. Carteira de casamentos (ficha profissional)
- **Objetivo**: cada casamento como projeto da organização, reutilizando os módulos da Couples.
- **Funcionalidades**: Overview (data, local, serviço, equipa, estado da ligação ao casal, progresso), Planeamento (tarefas por fases), e acesso aos módulos partilhados existentes (Orçamento, Fornecedores, Compare, Convidados, Mesas, Design, Programa/Cronograma, Documentos, Memories) **lidos da projeção e editados por secção** conforme o consentimento do casal; notas internas; equipa atribuída.
- **Permissões**: grant por pessoa; secção editável só se `sharing[secção]=='edit'` **e** permissão do papel.
- **Dados**: `organizations/{orgId}/weddings/{weddingId}` (interno) + `weddingPlannerViews/{weddingId}` (partilhado, leitura) + callable de escrita.
- **Estados**: `prospect (sem casal) → invited → linked → completed → archived`; ligação `pending | active | ended`.
- **Dependências**: Fase 1 + Fase 3.
- **Testes**: secção `hidden` não aparece na projeção; escrita numa secção `view` recusada; concorrência casal/planner na mesma secção.

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
- **Visibilidade na Couples**: ícone junto às notificações **só** com ligação ativa (não depende de Premium; convite pendente ou relação terminada = sem ícone).
- **Testes**: tabela das 6 regras de visibilidade; leitura por noivo independente; acesso após fim de relação; anexos acessíveis só a participantes; exportação regista checksum e expira o link.

## M18. Weddy Intelligence
- **Funcionalidades**: perguntas sobre dados autorizados (casamentos, clientes, fornecedores, orçamentos, tarefas, cronogramas, documentos, conversas, calendário, equipa); preparar reuniões, resumir decisões, comparar propostas (reutiliza Compare), preparar cronograma, decisões → tarefas.
- **Regras**: só dados a que o utilizador tem acesso (o contexto é montado no servidor com as mesmas permissões); propõe, **nunca executa** sem confirmação; nada financeiro/contratual automático; `store:false`; quotas por organização; registo de uso.
- **Testes**: um membro sem grant não obtém dados desse casamento por pergunta indireta (testes adversariais de prompt).

## M19. Email e comunicação externa (avaliação)
Fase 5+: templates, envio pelo servidor, histórico associado a cliente/casamento/fornecedor. Integração de caixa de correio (OAuth Gmail/Microsoft) só depois de avaliação RGPD e de custo.

## M20. Brochuras e portefólio
Fase 7: brochuras de serviços e pacotes, página pública da organização. Sem marketplace no MVP.
