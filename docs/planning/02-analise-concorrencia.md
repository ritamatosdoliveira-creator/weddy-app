# Documento 2 — Análise da concorrência

Data: 2026-11-17. Fontes: páginas oficiais de cada produto (listadas no fim). Legenda: **✔** confirmado na fonte oficial · **◐** parcial ou só mencionado sem detalhe · **?** não verificado (a fonte consultada não o menciona, o que **não** prova que não existe) · **✖** a fonte declara expressamente que não existe.

## 1. Resumo por concorrente

### Journey 2 Yes (PT) — o benchmark mais próximo
Plataforma portuguesa com área de casais (gratuita, Premium 29 € por 24 meses), diretório de fornecedores e uma área para planners com **42 funcionalidades** descritas. Planos para planners por número de utilizadores: **Solo (1), Estúdio (até 5), Agência (até 20), Casa** — a mesma lógica proposta para a Weddy. Promoção: tudo aberto até 31/12/2026.
Pontos fortes: painel em blocos, **Radar de riscos**, pipeline de leads, propostas com folha de margem, contratos com assinatura eletrónica simples, faturas e IVA (registo de gestão, não certificado; integra InvoiceXpress/Moloni para certificada), pagamentos Stripe, horas e rentabilidade, equipa com permissões no servidor, questionários por link, contactos e espaços, **Advance Pack / portal do fornecedor**, moodboard, checklists com modelos, documentos com validade, automatizações "quando X, faz Y", **partilha com os noivos ferramenta a ferramenta (editar / ver / esconder, decidido pelo casal)**, portal com a marca do planner, cofre de versões do casamento, marcação de reuniões por link, perfil público.
Lacunas na fonte: **sem chat/mensagens**, **sem IA**, versionamento de propostas não específico.

### Event365 (PT) — gestão operacional de eventos
Software português para quintas, planners e eventos em geral. Para planners: ficha do casal (visitas, preferências, ficheiros), fornecedores por evento, **ementas-modelo e folha de cozinha**, decoração com moodboards por dossier, pagamentos faseados com alertas, timing do dia partilhado, **"4 PDFs em 2 cliques"** (orçamento, ementa, timing, equipa), relatórios e rentabilidade por casamento, escala de equipa. Teste gratuito de 14 dias; sem preços públicos.
Lacunas na fonte: portal do casal, propostas, assinatura eletrónica e faturação não mencionados.

### Stellanza (internacional, 2026) — casal + planner, foco em convidados
Produto recente (lançado em 2026 no Product Hunt). Convidados ilimitados, RSVP por link com prazo validado no servidor, **seating plan com regras (juntar/separar) e assistente de IA**, orçamento, tarefas com dependências, **visão multi-casamento para planners com contas de staff ilimitadas** e convite do casal. Gratuito + Premium 35 € pagamento único. Sem CRM, propostas ou financeiro do negócio.

### Aisle Planner (EUA) — o mais completo na área do evento
Vendas (leads, propostas/orçamentos interativos, contratos e e-signature, faturas e pagamentos, brochuras, questionários, agendamento, integração de email, comunicação interna) + gestão de projeto (portal do cliente, checklists, timelines, orçamentos, **style guides e paletas (design boards)**, fornecedores e ficheiros, gestão de convidados e mensagens, **layouts e seating**, website com RSVP). Preço por **número de projetos** (49,99–229,99 $/mês), **utilizadores ilimitados**.

### Planning Pod (EUA) — eventos e espaços em geral
CRM com formulários de captação e automação do pipeline, propostas, contratos e e-signatures, pagamentos e prestações, **BEO / food & beverage**, calendário de reservas, **plantas (floor plans)** e seating, timelines, gestão de fornecedores, **portais do cliente com marca**, **caixa de entrada central**, workflows e triggers, relatórios e dashboards, agendamento, registo de chamadas. Preços só por demonstração.

### HoneyBook (EUA) — referência do percurso comercial
CRM e pipeline, propostas, contratos, e-signature, faturas, pagamentos (cartão/transferência, autopay), agendamento, **automações**, portal do cliente, **HoneyBook AI**, formulários de leads. 29–109 $/mês; equipa ilimitada só no Premium.

### Dubsado (EUA) — referência de workflows administrativos
CRM, formulários de captação, modelos de formulário e email, propostas públicas, faturas e planos de pagamento, agendador, portal do cliente, **workflows** (Premier), marcas múltiplas. 335–525 $/ano.

## 2. Matriz comparativa

Colunas: J2Y = Journey 2 Yes · E365 = Event365 · STL = Stellanza · AP = Aisle Planner · PP = Planning Pod · HB = HoneyBook · DB = Dubsado. "Weddy hoje" = Weddy Couples + Core já existentes.

| Funcionalidade | J2Y | E365 | STL | AP | PP | HB | DB | Weddy hoje | Weddy Planning (plano) | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|
| Gestão de vários casamentos | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | ◐ | ✖ (seletor de casamentos do casal) | Carteira + Hoje | **P0** |
| Organizações / equipa com papéis | ✔ | ✔ (escala) | ✔ (staff) | ✔ | ✔ | ◐ | ◐ | ✖ | RBAC+ABAC | **P0** |
| Partilha com o casal por secção | ✔ | ? | ◐ | ✔ | ✔ | ◐ | ◐ | ✖ | Visibilidade 3 níveis | **P0** |
| CRM / pipeline de leads | ✔ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ | P1 |
| Formulários de captação | ◐ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✖ (só contacto Weddy) | ✔ | P1 |
| Propostas | ✔ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ + extras | P1 |
| Margem interna nas propostas | ✔ | ? | ✖ | ? | ? | ? | ? | ✖ | ✔ | P1 |
| Contratos + e-signature | ✔ (simples) | ◐ | ✖ | ✔ | ✔ | ✔ | ◐ | ✖ | ✔ (integração) | P2 |
| Faturação certificada PT | ◐ (integração) | ? | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | Integração (avaliar) | P3 |
| Pagamentos online do cliente | ✔ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✔ (só Premium Weddy) | P3 | P3 |
| Rentabilidade por casamento | ✔ | ✔ | ✖ | ◐ | ◐ | ◐ | ✖ | ✖ | ✔ | P2 |
| Registo de horas | ✔ | ? | ✖ | ? | ? | ? | ? | ✖ | ✔ | P2 |
| Questionários | ✔ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ | P1 |
| Agendamento de reuniões | ✔ | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ◐ (Google Calendar) | ✔ | P2 |
| Base de fornecedores | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ | ✖ | ◐ (por casamento) | Por organização | P1 |
| Biblioteca de espaços | ✔ | ◐ | ✖ | ? | ✔ | ✖ | ✖ | ✖ | ✔ | P2 |
| Portal do fornecedor | ✔ | ◐ (timing partilhado) | ✖ | ? | ✖ (não mencionado) | ✖ | ✖ | ✖ | ✔ | P2 |
| Run sheet / cronograma | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ | ✖ | ◐ (Programa do dia) | Run sheet com vistas | **P1** |
| PDFs operacionais | ✔ | ✔ | ✔ (seating) | ✔ | ✔ | ◐ | ◐ | ✔ (vários) | ✔ | P1 |
| Ementas / folha de cozinha | ✖? | ✔ | ✖ | ? | ✔ (BEO) | ✖ | ✖ | ◐ (restrições no RSVP) | Avaliar | P3 |
| Moodboards / style guides | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ | ✖ | ✔ (Design, Papelaria) | Reutilizar + aprovação | P2 |
| Templates de casamento / checklists | ✔ | ? | ◐ | ✔ | ✔ | ✔ | ✔ | ◐ (checklist fixa) | Templates com prazos relativos | **P1** |
| Workflows / automações | ✔ | ? | ✖ | ◐ | ✔ | ✔ | ✔ | ◐ (Autopilot RSVP) | ✔ | P2 |
| Radar de riscos | ✔ | ◐ (alertas) | ✖ | ? | ◐ | ✖ | ✖ | ◐ (Health do casal) | **Risk Monitor** | **P1** |
| Convidados / RSVP / famílias | ◐ (via ferramentas do casal) | ◐ | ✔ | ✔ | ✔ | ✖ | ✖ | **✔ (forte)** | Reutilizar | — |
| Seating com IA | ✖? | ✖ | ✔ | ◐ (sem IA) | ◐ | ✖ | ✖ | **✔ (AI Seating)** | Reutilizar | — |
| Website + convites digitais | ✔ (site) | ✖ | ✔ (página) | ✔ | ✔ | ✖ | ✖ | **✔ (8 modelos)** | Reutilizar | — |
| Comparação de propostas com IA | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | **✔ (Weddy Compare)** | Reutilizar | Diferenciação |
| Mensagens com o casal | ✖ (fonte) | ? | ? | ✔ | ✔ (inbox) | ✔ | ◐ | ✖ | **Conversations** com decisões | **P1** |
| Decisões registadas + PDF integral | ✖ | ✖ | ✖ | ? | ? | ? | ? | ✖ | ✔ | **Diferenciação** |
| Leitura individual por noivo | ? | ? | ? | ? | ? | ? | ? | ✖ | ✔ | Diferenciação |
| Aprovações formais versionadas | ◐ (versões do casamento) | ? | ✖ | ? | ◐ | ◐ | ◐ | ✖ | ✔ | P2 |
| IA de operação (planner) | ✖ (fonte) | ? | ◐ (seating) | ? | ? | ✔ (genérica) | ? | ◐ (Copilot do casal) | **Weddy Intelligence** | Diferenciação |
| Apps nativas do casal | ? | ? | ? | ? | ? | ✔ | ? | **✔ (iOS/Android)** | — | Diferenciação |
| Marca do planner (white-label) | ✔ | ? | ? | ✔ | ✔ | ✔ | ✔ (marcas) | ✖ | Fase 7 | P3 |
| Perfil público / portefólio | ✔ | ? | ✖ | ✔ (brochuras) | ✖ | ◐ | ✖ | ✖ | Brochuras | P3 |
| Integração de email | ? | ? | ✖ | ✔ | ✔ | ✔ | ✔ | ✖ | Avaliar (Fase 5+) | P3 |

## 3. Oportunidades de diferenciação

1. **Casamento único partilhado de verdade** — os concorrentes "ligam" o casal a ferramentas; na Weddy o casal já usa uma app completa e premiada com convidados, RSVP familiar com logística, AI Seating, Compare, website, convites e apps nativas. O planner entra no **mesmo** casamento, com consentimento, sem migração de dados.
2. **Weddy Conversations com decisões e arquivo** — nenhum concorrente verificado combina chat por casamento + decisões classificadas + leitura por noivo + exportação integral (PDF + ZIP com checksum). Elimina o WhatsApp como registo informal.
3. **Weddy Intelligence específica** — IA sobre dados reais do casamento e do negócio (radar, preparação de reuniões, decisões → tarefas), com confirmação humana. O J2Y não menciona IA; o HoneyBook tem IA genérica.
4. **Compare para o planner** — comparar propostas de fornecedores com IA já existe e não tem equivalente.
5. **Run sheet com vistas por papel**, ligado aos fornecedores e à logística dos convidados (transportes, alergias) que já vem do RSVP.

## 4. O que não justifica desenvolvimento (por agora)

- **Faturação certificada própria** (exige certificação AT): integrar (InvoiceXpress, Moloni, Vendus) em vez de construir.
- **Venue/BEO completo, bilheteira, eventos virtuais** (Planning Pod): fora do foco casamentos-planner.
- **Plantas técnicas (floor plans CAD)**: o seating existente cobre o essencial.
- **Marketplace público**: fora do MVP (já previsto).
- **Integração de email completa (IMAP/OAuth)**: alto custo e risco RGPD; começar por templates e envio pelo servidor.

## 5. Implicações para a Weddy Planning

- O J2Y já tem paridade alta em gestão de negócio, com um preço de lançamento agressivo (gratuito até 2027). Competir só em "CRM + propostas + faturas" não diferencia; a Weddy deve liderar em **colaboração casal–planner, comunicação com valor de registo e IA operacional**, e ter paridade suficiente no negócio.
- O modelo **Solo/Studio/Agency** está alinhado com o mercado PT (J2Y usa o mesmo eixo: utilizadores). O Aisle Planner cobra por projetos com utilizadores ilimitados; vale a pena avaliar um modelo misto (membros + casamentos ativos).
- A partilha **decidida pelo casal, ferramenta a ferramenta** é o padrão de mercado em PT e encaixa nos 3 níveis de visibilidade pedidos.

## 6. Fontes consultadas (17/11/2026)

- [Journey 2 Yes — página inicial](https://www.journey2yes.com/) e [Funcionalidades para wedding planners](https://www.journey2yes.com/pt/funcionalidades/wedding-planners)
- [Event365 — Software para Wedding Planners](https://www.event365.pt/wedding-planners), [FAQ](https://www.event365.pt/faq), [Folha de Cozinha & Ementas](https://event365.pt/service/cozinha), [Gestores de quintas](https://event365.pt/gestores-quintas)
- [Stellanza](https://www.stellanza.com/) e [Product Hunt](https://www.producthunt.com/products/stellanza)
- [Aisle Planner](https://www.aisleplanner.com/) e [Preços](https://aisleplanner.com/pricing/)
- [Planning Pod](https://www.planningpod.com/)
- [HoneyBook — Preços](https://www.honeybook.com/pricing)
- [Dubsado — Preços](https://www.dubsado.com/pricing)

Limitações: não houve acesso a contas de demonstração; as páginas de funcionalidades são material de marketing. Itens "?" devem ser verificados com contas de teste antes de decisões de produto finais.
