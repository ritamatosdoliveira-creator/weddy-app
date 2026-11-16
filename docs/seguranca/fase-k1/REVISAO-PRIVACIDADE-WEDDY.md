# Revisão de privacidade (K.1-G) — factos, lacunas e rascunhos

**Nada foi publicado nem alterado em `privacidade.html` ou nos textos da app.** Rascunhos abaixo = **sujeitos a revisão jurídica**, com placeholders para o que depende da administração.

## 1. EmailJS
| Pergunta | Facto verificado |
|---|---|
| Usado? | **Sim**, em `app/index.html` (script jsDelivr `@emailjs/browser@4`; `emailjs.send` L~24548) |
| Finalidade | Aviso imediato por email à administração quando alguém usa "Reporta um problema" (Definições) |
| Dados enviados ao EmailJS | Texto do relatório (+ nota de que há capturas), **email indicado pela pessoa**, destinatário `geral@weddy.pt`. As capturas **não** vão para o EmailJS (ficam no Storage `feedback/`); o relatório completo fica também em Firestore `feedback` |
| Chaves | `PUBLIC_KEY`, `SERVICE_ID`, `TEMPLATE_ID` no frontend (chaves públicas por desenho do EmailJS; abuso limitável no painel EmailJS por domínio/limites → [X] confirmar) |
| Identificado na política? | **Texto na app: sim** (`privacySubprocessorsText`). **`privacidade.html`: NÃO** → lacuna |
| Localização/DPA | EmailJS (EUA, a confirmar) — [X] DPA/transferência |
| Observação | O formulário é só para utilizadores autenticados; o texto livre pode conter dados pessoais de terceiros |

## 2. Meta / WhatsApp — a verdade técnica (importante)
- **Existe, no servidor, uma integração com a WhatsApp Business API (Meta):** `sendWhatsappRsvpReminder` (onCall, Premium) faz `fetch` a `graph.facebook.com/.../messages` com um *template* aprovado, e `whatsappWebhook` recebe respostas/STOP e confirma consentimentos por resposta. Há também `setGuestWhatsappConsent/getGuestWhatsappConsent` (página de consentimento em `rsvp.html`) e coleções `whatsappConsents/Inbox/MessageStatus/...`.
- **Está dormente na interface:** o cliente tem o wrapper `GuestCommsService.sendWhatsappRsvpReminder`, mas **nenhum ecrã o invoca** (só `updateGuestPhone` é usado). Os lembretes que a UI faz usam `wa.me` (o casal envia do seu WhatsApp pessoal). A função só envia se `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` existirem no Secret Manager; sem eles responde `unavailable`. **Não é possível provar a partir do repositório se esses segredos existem em produção** [X].
- **Inconsistência:** `privacidade.html` diz que a API da Meta é usada (para convidados com consentimento); a política **na app** diz que **não** se usa a API e o número não é partilhado com a Meta. Ambas não podem estar certas ao mesmo tempo.
- **Regra da fase:** a Weddy **não deve** passar a usar a API nem mensagens automáticas por WhatsApp. **Opções (decisão tua; nada removido):**
  1. *Manter dormente e documentar* (risco: alguém configurar os segredos e chamar a função diretamente; mitigado por Premium+consentimento+limites).
  2. *Desativar por *feature flag* de servidor* (`WHATSAPP_API_ENABLED=false` por defeito → a função devolve `unavailable` mesmo com segredos): alteração pequena, reversível, testável. **Recomendada**, mas só com a tua aprovação (mexe em funcionalidade existente).
  3. *Não publicar estas funções* no deploy de produção (`--only functions:` seletivo) até decisão.
  4. *Remover o código* — **não recomendado agora** (regra: não remover funcionalidades).
- **Consequência para a política:** com 1–3, o texto correto é o da app ("wa.me, sem API"); o parágrafo da Meta em `privacidade.html` deve ser **removido** e o consentimento do convidado reescrito para o fluxo manual (a validar).

## 3. Alergias, intolerâncias, dietas e acessibilidade (art. 9.º RGPD — possivelmente)
| Pergunta | Facto |
|---|---|
| Onde se recolhe | `rsvp.html` (secções de logística: "Alergias ou restrições alimentares", "Acessibilidade ou apoio"); o casal também pode introduzir/editar nas fichas |
| Opcional? | Sim (interruptores "Só se for o teu caso"; campos opcionais; tamanhos máximos) |
| Quem consulta | Só os donos (autenticados, email verificado) e o próprio convidado com o seu link (token); não aparece a outros convidados; não vai para o Website público |
| Quem altera | O convidado (só campos de resposta/logística permitidos pelas regras) e os donos |
| Informação ao titular | Há um bloco expansível de privacidade no RSVP ("vistos apenas pelos noivos…"), em PT/EN. **Não** identifica o responsável, a base legal, a retenção nem inclui ligação direta à política (a verificar na versão final) |
| Consentimento explícito | **Não** é recolhido como ato separado (o preenchimento voluntário é o único sinal) |
| Usos | AI Seating **não** recebe alergias/acessibilidade; Concierge só responde com informação dos noivos; Copilot só dados do casamento do utilizador |
| Base legal | **Não definida** — não inventada |

**Opções para validação jurídica (perguntas):**
1. A Weddy é responsável, subcontratante do casal, ou corresponsável por estes dados? (Determina quem informa e quem recolhe o consentimento.)
2. Alergia ≠ preferência: tratar "alergias/intolerâncias/acessibilidade" como dados de saúde (art. 9.º) e "vegetariano/sem porco" como não-sensíveis (ou potencialmente religiosos)? Onde fica a linha no formulário?
3. Condição do art. 9.º/2: consentimento explícito do convidado (a) caixa/frase explícita no RSVP; (b) ato afirmativo ao ativar o interruptor, com texto próprio; ou outra condição aplicável?
4. O consentimento do casal vale? (Em princípio não substitui o do titular.)
5. Retenção: apagar dados de saúde N dias após o casamento? Quantos?
6. Convidados menores: quem consente?
7. Menção do responsável e DPO/contacto no próprio formulário.

## 4. Restantes verificações
| Tema | Estado | Lacuna |
|---|---|---|
| Identificação da entidade | `privacidade.html`: "Rita Matos de Oliveira, geral@weddy.pt, 926 378 303" (pessoa singular) | Confirmar se é a entidade responsável; NIF/morada ausentes → **[IDENTIFICAÇÃO LEGAL DA ENTIDADE] [NIF] [MORADA]** |
| Finalidades | Descritas de forma geral | Falta separar base legal por finalidade |
| Subprocessadores | Política HTML lista 7 (inclui Meta e GitHub Pages); app lista Firebase, GitHub Pages, Stripe, Apple, RevenueCat, EmailJS, OpenAI, Google Calendar, CDNs | Unificar; incluir EmailJS; Meta conforme decisão; **jsDelivr/cdnjs** (IP) ; SMTP; reCAPTCHA se App Check |
| Retenção | "Enquanto a conta estiver ativa" | Sem prazos para backups, logs, quarentena, faturação |
| Direitos | Acesso, correção, eliminação, retirar consentimento, CNPD | Faltam portabilidade, limitação, oposição, prazo de resposta, verificação de identidade; convidados |
| Transferências | OpenAI (EUA) mencionada | Sem mecanismo (DPF/cláusulas) para OpenAI, Stripe, EmailJS, Apple, RevenueCat, Google |
| Cookies/analytics | **Nenhum** cookie próprio nem analytics (teste automático `privacy-static`); fontes agora locais | Descrever armazenamento local técnico; reCAPTCHA mudaria isto |
| "Dados nunca partilhados" | Afirmações absolutas na app/RSVP | Rever formulações absolutas (ex.: "nunca") com jurista |

## 5. Rascunhos propostos (PT-PT) — NÃO PUBLICAR
**5.1 Subprocessadores (substitui a secção 4 de `privacidade.html`)**
> Usamos prestadores que tratam dados em nosso nome: **Google (Firebase/Google Cloud)** — base de dados, autenticação, ficheiros e funções do servidor, [REGIÃO A CONFIRMAR]; **GitHub Pages** — alojamento do site; **Stripe** — pagamentos na versão web; **Apple** e **RevenueCat** — compras na App Store; **OpenAI (EUA)** — interpretar texto livre no assistente, só o texto que escreves, com o armazenamento do pedido desativado; **EmailJS** — envio do aviso interno quando usas "Reporta um problema" (recebe o texto e o email que indicares); **Google Calendar** — apenas se ligares essa funcionalidade; **[SMTP: FORNECEDOR]** — emails de resumo e de contacto. Para carregar bibliotecas técnicas do navegador usamos redes de entrega de conteúdo (jsDelivr, cdnjs), que veem o endereço IP de quem usa a app. [TRANSFERÊNCIAS PARA PAÍSES TERCEIROS: MECANISMO A CONFIRMAR].

**5.2 WhatsApp (se mantida a opção 1–3)**
> Os lembretes por WhatsApp são preparados na Weddy mas **enviados por ti, a partir do teu WhatsApp pessoal**. A Weddy não envia mensagens de WhatsApp em teu nome nem partilha números de telefone com a Meta. [REVER SE O CONSENTIMENTO DO CONVIDADO CONTINUA A SER NECESSÁRIO — JURÍDICO]

**5.3 Identificação**
> Responsável pelo tratamento: **[IDENTIFICAÇÃO LEGAL DA ENTIDADE]**, NIF **[NIF]**, **[MORADA]**. Contacto de privacidade: **[EMAIL DE PRIVACIDADE]**. [DPO, SE APLICÁVEL].

**5.4 Aviso no RSVP para logística (alergias/acessibilidade)** — *variantes por decisão jurídica*
> Variante A (consentimento explícito): "Se quiseres, indica alergias, intolerâncias ou necessidades de acessibilidade. Estas informações podem ser dados de saúde. Ao preenchê-las, **consentes expressamente** que sejam usadas pelos noivos [e pela Weddy, em nome deles] apenas para organizar o catering e o acesso no dia do casamento. Podes retirar o consentimento a qualquer momento neste link. Responsável: [ENTIDADE]. Mais informação: [LIGAÇÃO À POLÍTICA]."
> Variante B (outra condição do art. 9.º/2 indicada pelo jurídico): [TEXTO A DEFINIR].

**5.5 Retenção e direitos (resumo)**
> Guardamos os teus dados enquanto a conta estiver ativa. Ao eliminar a conta, apagamos os dados da aplicação; cópias de segurança e registos de faturação podem permanecer durante [PRAZOS A CONFIRMAR] e depois são eliminados. Tens direito de acesso, retificação, apagamento, limitação, oposição e portabilidade; respondemos em [PRAZO]; podes reclamar à CNPD (www.cnpd.pt).

## 6. Atualização da lista de pendências da Fase J
Fechadas por esta auditoria (factos): EmailJS descrito; situação real do WhatsApp esclarecida; recolha/acesso a alergias descrita. Continuam abertas: identificação legal, base art. 9.º, DPAs/transferências, retenção, DPIA, validação jurídica das citações.
