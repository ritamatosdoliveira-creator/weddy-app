# Registo de atividades de tratamento (art. 30.º) — rascunho Weddy

Responsável: **[IDENTIFICAÇÃO LEGAL DA ENTIDADE]** · NIF **[NIF]** · Morada **[MORADA]** · Email legal **[EMAIL LEGAL]** · DPO (se aplicável) **[DPO]**. (Política atual indica Rita Matos de Oliveira, geral@weddy.pt — a confirmar enquanto entidade responsável.)

| Atividade | Papel Weddy | Titulares | Categorias de dados | Finalidade | Base (proposta) | Destinatários/subprocessadores | Transferências | Retenção | Medidas (art. 32) |
|---|---|---|---|---|---|---|---|---|---|
| Gestão de contas | Responsável | Noivos | Email, nome, uid | Autenticação | Contrato | Google Firebase | Intra-UE/Google | Enquanto ativa | Auth, regras, HTTPS |
| Planeamento de casamento | Responsável (dados do casal) / Subcontratante (dados de terceiros inseridos pelo casal — a validar) | Noivos, convidados, fornecedores | Estado JSON | Serviço | Contrato / int. legítimo | Firebase | idem | Enquanto ativa | Regras por dono, cascata |
| Convites e RSVP | Subcontratante do casal (a validar) | Convidados | Nome, resposta, restrições | Confirmar presença | Int. legítimo do casal | Firebase | — | Até eliminar | Token por convite |
| Logística (art. 9) | idem | Convidados | Alergias/acessibilidade | Catering/acessos | Consentimento explícito (proposta) | Firebase | — | Após o evento + prazo (decisão) | Acesso só donos |
| Lembretes WhatsApp | Subcontratante / responsável conjunto (a decidir) | Convidados | Telefone, consentimento | Lembrar RSVP | Consentimento | Firebase (+Meta) | EUA (se API) | Até retirada/eliminação | STOP, rate limit |
| Site do casamento | Subcontratante do casal | Noivos (+convidados públicos por decisão) | Campos públicos | Publicar | Ação do casal | Firebase, GitHub Pages | — | Até despublicar | Snapshot só público |
| Memórias/Documentos | idem | Convidados, fornecedores | Fotos, ficheiros | Álbum/arquivo | Contrato/consentimento | Firebase | — | Até eliminar | Storage rules |
| Assistente IA | Responsável | Noivos | Texto livre | Interpretar | Contrato + autorização | OpenAI | EUA | Não retido (`store:false`; retenção de abuso do prestador a confirmar) | Minimização, quota |
| Google Calendar | Responsável | Noivos | Tokens, eventos | Sincronizar | Consentimento | Google | — | Até desligar | AES-GCM, OAuth autenticado |
| Subscrições | Responsável | Noivos | Ids pagamento | Cobrança | Contrato/obrigação legal | Stripe, Apple, RevenueCat | EUA | Prazo fiscal [validar] | Webhooks assinados |
| Emails e suporte | Responsável | Noivos, contactos | Email, mensagem | Comunicar | Int. legítimo/contrato | SMTP, EmailJS | EUA (EmailJS) | Definir | Rate limit |
| Segurança (logs, incidentes) | Responsável | Todos | Logs, cópias de estado | Segurança | Int. legítimo | Firebase | — | Definir (gap) | Regras só-criação |

Factos verificados: ver INVENTARIO-DADOS-PESSOAIS-WEDDY.md. Hipóteses/pendentes: papéis (responsável vs subcontratante) e prazos exigem validação jurídica.
