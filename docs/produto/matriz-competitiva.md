# Weddy — Matriz competitiva (v1, 2026-11-01)

Documento de trabalho. **Só afirmo como "verificado" o que li numa página oficial do próprio produto (site ou ficha da App Store) ou, no caso da Journey 2 Yes, numa notícia e numa ficha de terceiros, assinalado.** Tudo o que não encontrei escrito fica em "não confirmado": a ausência de uma funcionalidade numa página de marketing **não prova** que ela não existe.

## 1. Fontes e nível de confiança

| Concorrente | Fonte consultada | Confiança |
|---|---|---|
| Journey 2 Yes (PT) | Notícia NiT (Out 2026) com a descrição do produto e do plano gratuito/premium; ficha Capterra (software, preço inicial 0 €, cloud/web) | **Média**: fonte secundária. Falta ver o site/app oficial. |
| Zola | Ficha oficial na App Store (funcionalidades, compras na app, 4,9 / 99 mil avaliações) | Alta para o que lista; não cobre o site web completo. |
| The Knot | Ficha oficial na App Store | Alta para o que lista. |
| Joy | Página oficial de funcionalidades (withjoy.com/features) | Alta; preços muitas vezes "não indicados". |
| Bridebook | Página oficial de ferramentas (plan.bridebook.com) | Alta para o que lista; mercado UK. |
| WeddingWire | Página oficial da app (versão .ca) | Média: lista curta, sem preços. |
| Appy Couple | Ficha oficial na App Store (funcionalidades e preços de anfitrião) | Alta para o que lista. |
| "Weddy.app" | Ficha App Store "Weddy – AI Wedding Assistant" (programador individual). **Não confirmei que seja a entidade do domínio weddy.app.** | Baixa quanto à identidade; alta quanto ao que a ficha diz. |

Não verifiquei: preços e limites atuais nos sites (mudam), funcionalidades só visíveis depois de criar conta, mercados fora dos consultados, avaliações de qualidade/UX. Quando uma coluna diz "—" é porque **a fonte não menciona**, não que não exista.

## 2. O que cada concorrente lista (verificado nas fontes acima)

| Funcionalidade | J2Y | Zola | Knot | Joy | Bridebook | WeddingWire | Appy Couple | Weddy.app |
|---|---|---|---|---|---|---|---|---|
| Orçamento | ✔ (pagos/pendentes) | ✔ (lembretes de pagamento) | ✔ | — | ✔ | ✔ | — | — |
| Tarefas / checklist | ✔ (prioridades e prazos) | — | — | — | ✔ | ✔ | — | — |
| Lista de convidados + RSVP | ✔ (import Excel) | ✔ | ✔ (refeição) | ✔ (grátis; import) | ✔ | ✔ | ✔ | — |
| Link individual por convidado, sem conta | ✔ (SMS) | — | — | ✔ (por agregado) | ✔ (convidado preenche a sua morada) | — | — | — |
| Mesas / plano de lugares | ✔ **(Premium)** | ✔ **(pago, 14,99 US$)** | ✔ | **não indicado** | — | ✔ | — | — |
| Site do casamento | ✔ | ✔ (animações pagas) | ✔ | ✔ (grátis; domínio próprio) | — | ✔ | ✔ | — |
| Lista de presentes | — | ✔ | ✔ | ✔ (sem taxas em fundos) | — | — | ✔ | — |
| Diretório / marketplace de fornecedores | em desenvolvimento | ✔ | ✔ (mensagens) | — | ✔ (maior do Reino Unido) | ✔ | — | — |
| Convites digitais / save the date | — | ✔ (modelos grátis/pagos) | ✔ | ✔ | — | — | ✔ | — |
| SMS a convidados | ✔ **(Premium)** | ✔ **(pago, 59,99–79,99 US$)** | — | — | — | — | — | — |
| Fotos dos convidados / galeria | — | câmara descartável **(paga)** | — | ✔ | — | — | ✔ (projeção, mural) | — |
| Cronograma com música por momento | ✔ (exportável) | — | — | — | — | — | — | — |
| Sincronização com calendário | ✔ (Google) | — | — | — | — | — | — | — |
| Notificações | — | (avaliações citam controlo limitado) | — | — | — | — | ✔ | — |
| Viagem/alojamento dos convidados | ✔ (transporte) | — | — | ✔ (assistente de reservas, boleias) | — | — | ✔ (concierge de viagem) | — |
| IA no planeamento | — | — | — | — | — | — | — | ✔ (assistente) |
| Cuidado com modelo de preço | Grátis; Premium por definir | Grátis + compras na app | Grátis | Grátis + extras | Grátis | — | Convidados grátis; anfitrião 11,99/49,99/99 US$ | 2,99/mês, 29,99/ano, 34,99 único |
| Língua / mercado | **PT** | EN (US) | EN (US) | EN (global) | EN (UK) | EN | EN | EN |

## 3. A Weddy hoje (verificado no código desta branch, 2026-11-01)

**Grátis:** Orçamento e Gastos, Convidados (inclui importação A.1, só local), Mesas manuais, To-do, Checklist, Vestido, Lua de mel, Fornecedores (lista própria + recomendações), Inspiração, exportação, PT/EN, apps iOS e Android + web.
**Premium (30 €, pagamento único, 12 meses):** RSVP (link por convidado + família), Concierge do convidado, lembretes por email e por WhatsApp (abre o WhatsApp do casal), AI Seating, Weddy Compare, Wedding Health, Google Calendar, Site do casamento, Memories, Documentos, Bolo, Votos, Papelaria.
**Implementado só localmente (não publicado):** A.1 importação de convidados, A.2 notificações inteligentes (internas; push em segundo plano e email resumo ainda não), A.3 correções de segurança Premium, consentimento WhatsApp pelo próprio convidado.
**Decisões de produto já tomadas:** sem diretório de fornecedores, sem lista de presentes, sem SMS.

## 4. Classificação

### 4.1 Temos e somos competitivos
| Funcionalidade | Porquê |
|---|---|
| Orçamento + gastos com prazos/pagamentos | Todos os que o listam fazem o mesmo; a Weddy acrescenta ligação a categorias e (A.2) avisos de pagamentos. |
| Tarefas/checklist | Equivalente a J2Y/Bridebook/WeddingWire. |
| Lista de convidados e RSVP com link individual, sem conta | Equivalente a J2Y/Joy/Bridebook; suporta famílias num só link. |
| Mesas de lugares manuais (grátis) | Zola cobra por isto e a J2Y só no Premium. |
| Site do casamento com domínio/slug | Equivalente ao que Zola/Knot/Joy/WW/Appy oferecem; é Premium na Weddy. |
| Lua de mel e vestido | J2Y tem lua de mel; WeddingWire tem vestidos (só navegação). |
| App nas lojas (iOS/Android) + web | Zola/Knot/Joy/Bridebook/Appy idem; J2Y é só PWA. |
| Português europeu nativo | Só a J2Y está no mesmo mercado. |

### 4.2 Temos, mas precisamos de melhorar
| Funcionalidade | Lacuna |
|---|---|
| Importação de convidados | Pronta mas **não publicada** (A.1); J2Y já importa Excel. |
| Notificações | A.2 pronta localmente; falta push em segundo plano e email resumo (arquitetura em `docs/produto/A2-push-e-email-resumo.md`). |
| Google Calendar | Existe (Premium) mas tem erro conhecido de sincronização. |
| Convites digitais / papelaria | Há Papelaria (Premium), mas não vi envio de save the date digital pelo próprio produto, ao contrário de Zola/Knot/Joy/Appy. |
| Fotos dos convidados (Memories) | Existe; Joy e Appy Couple fazem galeria partilhada e projeção — comparar UX. |
| RSVP exclusivo Premium | Zola, Knot, Joy, Bridebook e WeddingWire listam RSVP **grátis**. Só a J2Y restringe (RSVP automático por SMS no Premium). É a decisão com maior efeito na conversão: **decisão da Rita**, não proponho alterar preços/condições. |
| Inglês | Alguns textos ainda em PT em modo EN (A.4). |
| Dados corrompidos | Uma chave inválida em `state` deixa páginas em branco (A.4). |

### 4.3 A concorrência tem e nós não
| Funcionalidade | Quem | Proposta |
|---|---|---|
| Cronograma do dia com música por momento, exportável para a banda/DJ | J2Y | **Fase D** (já no plano). |
| Convidado preenche a sua morada/dados de contacto por link | Bridebook, Zola (Contact Collector), Joy | **Fase B** (logística de convidados): encaixa no RSVP, sem custo de terceiros. |
| Programa personalizado por convidado (eventos diferentes) | Joy | Fase B, a validar com casais reais. |
| Vários eventos no mesmo RSVP (cerimónia, jantar, brunch) | Joy, WeddingWire ("RSVPs de todos os eventos") | Não detetei no código; confirmar e avaliar. |
| Ajuda a viagens/alojamento dos convidados | Joy, Appy Couple | Parcial (marcadores transporte/alojamento); Fase B. |
| Guestbook/brindes virtuais, projeção de fotos | Appy Couple | Baixa prioridade. |
| Notas de reuniões com fornecedores | J2Y | Pequeno; ver relação com o Compare. |
| Export Excel/PDF como valor Premium | J2Y | A Weddy exporta; verificar formatos. |

### 4.4 Temos uma abordagem diferenciadora
| Funcionalidade | Porquê (e o que **não** afirmo) |
|---|---|
| **Weddy Compare**: IA lê propostas de fornecedores, o casal confirma cada valor e o relatório indica em que campos se baseia | Não encontrei nada equivalente nas fontes consultadas; não posso garantir que nenhum concorrente o tenha. O código do servidor não está no repositório (ver `generateCompareReport-contrato.md`): **risco operacional**. |
| Restrições alimentares e alergias chegam às mesas | Ligação RSVP → mesas não aparece nas fontes dos concorrentes. |
| AI Seating com preferências | Apenas verifiquei que Zola vende mesas (sem IA) e a ficha da "Weddy.app" fala em IA de planeamento geral. |
| Concierge para o convidado (responde só com informação escrita pelo casal) | Não consultado nos concorrentes. |
| **Pagamento único de 30 € por 12 meses**, sem subscrições nem módulos avulsos | Contrasta com Zola (compras avulsas), Appy Couple (11,99–99 US$) e Weddy.app (subscrição). |
| Wedding Health (diagnóstico do estado do planeamento) | Não encontrado nas fontes. |
| Consentimento WhatsApp dado pelo próprio convidado, com prova no servidor | Boa prática RGPD; não comparável com as fontes. |
| Notificações integradas nos dados do casal (A.2), com limites anti-spam | Zola é citado por falta de controlo; a Weddy tem preferências, silêncio e tetos. |
| Identidade editorial em PT-PT | Diferenciação de mercado; só a J2Y está no mesmo país. |

### 4.5 Não vale a pena desenvolver (agora)
| Funcionalidade | Motivo |
|---|---|
| Lista de presentes / registry | Decisão da Rita (Nov 2026). Presente em Zola, Knot, Joy, Appy. |
| Diretório / marketplace de fornecedores | Decisão da Rita; investimento e moderação elevados (a J2Y também o tem ainda "em desenvolvimento"). |
| SMS | Decisão da Rita (email e WhatsApp). Premium na J2Y e Zola. |
| Garantia de reserva de fornecedor (Knot) | Exige marketplace. |
| Câmara descartável física (Zola) | Logística física. |
| Animações do site pagas por nível (Zola) | Contrária ao modelo de preço único. |

## 5. Riscos e notas
- **Marca:** "Weddy – AI Wedding Assistant" existe na App Store (EN, subscrição). Nome muito próximo para uma app de casamentos; confirmar marcas/domínio antes de investir em marketing internacional. Não é aconselhamento jurídico.
- **Journey 2 Yes é o concorrente direto** (mercado PT, PWA, importação, mesas, SMS, cronograma com música): a notícia diz que quem se registar até 30 de outubro mantém acesso completo grátis. Rever o site oficial antes de decisões de preço.
- **Esta matriz tem de ser revalidada** com os sites/apps abertos por uma pessoa: funcionalidades e preços mudam, e esta versão não substitui uma análise de produto com contas de teste.

## 6. Próximas ações sugeridas (a validar)
1. Publicar A.1, A.2 e A.3 (quando autorizado) para fechar as lacunas de 4.2.
2. Fase B (RSVP Autopilot, logística de convidados) cobre 4.3: morada por link, programa por convidado, multi-evento.
3. Fase D cobre o cronograma com música.
4. Rever com dados reais o efeito do RSVP Premium na conversão.
