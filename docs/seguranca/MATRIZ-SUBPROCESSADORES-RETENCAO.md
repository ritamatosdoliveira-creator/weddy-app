# Matriz de subprocessadores e retenção — Weddy (Fase J)

Aviso: "DPA/residência UE" **não estão comprovados no repositório**. Marcados "a confirmar". Não se inventam contratos nem períodos legais.

## A. Subprocessadores / terceiros
| Prestador | Finalidade | Dados | Papel (proposta) | Localização/transferência | DPA/salvaguardas | Declarado na política? |
|---|---|---|---|---|---|---|
| Google Firebase/Cloud (Auth, Firestore, Storage, Functions) | Alojamento, autenticação | Tudo | Subcontratante | Functions: europe-west1; Firestore/Storage: **a verificar na consola** | Termos de tratamento de dados da Google Cloud — a confirmar aceitação | Sim |
| Google Calendar API | Sincronizar eventos (opcional) | Tokens, títulos de eventos | Subcontratante/prestador escolhido pelo utilizador | Google (EUA/UE) | A confirmar | Sim |
| OpenAI | Interpretar texto livre (Copilot, Concierge, AI Seating, Compare) | Texto/contexto mínimo do pedido; `store:false` | Subcontratante | EUA | **DPA + SCC/DPF a confirmar**; sem treino com dados API (a confirmar nos termos atuais) | Sim (política) |
| Stripe | Pagamentos web | Email, ids, estado | Responsável autónomo / subcontratante (a decidir) | UE/EUA | DPA Stripe a confirmar | Sim |
| Apple / RevenueCat | Compras iOS | Id de conta, recibo | Idem | EUA | A confirmar | Sim |
| Meta WhatsApp Business API | Mensagens (só se API usada) | Telefone, mensagem | Subcontratante | EUA | A confirmar | Política standalone: sim; **texto in-app diz que não se usa a API — inconsistência a resolver** |
| SMTP (host configurável, ex. Gmail) | Emails de resumo/contacto | Email, conteúdo | Subcontratante | Depende do fornecedor | A confirmar | Parcial |
| EmailJS | "Reporta um problema" | Texto, email, captura | Subcontratante | EUA (a confirmar) | A confirmar | Só no texto in-app; **falta em privacidade.html** |
| GitHub Pages | Alojamento estático | IP dos visitantes | Subcontratante | EUA/global | Termos GitHub | Sim |
| jsDelivr, cdnjs (scripts) | Bibliotecas | IP do visitante | Terceiros técnicos | Global | — | In-app sim; **recomenda-se self-host (P3)** |
| ~~Google Fonts~~ | — | — | **Removido (J-1)** | — | — | — |

## B. Retenção (proposta — nada é auto-apagado sem política aprovada)
| Categoria | Finalidade | Retenção atual (código) | Proposta | Eliminação |
|---|---|---|---|---|
| Conta Auth | Serviço | Até o utilizador eliminar | Manter enquanto ativa; inatividade longa → decisão admin | `deleteWeddingAccount` |
| Casamento + convidados + RSVP + logística | Serviço | Idem | Idem; logística (art. 9) apagar após a data do casamento + prazo curto (decisão admin) | Cascata |
| Fotos/Memórias/Documentos | Serviço | Idem | Idem | Cascata + Storage |
| Votos | Serviço | Idem | Idem | Cascata |
| Site público | Publicação | Até despublicar; suspenso sem Premium | Despublicar após evento (decisão) | `deleteWeddingSiteData` |
| Tokens Google | Sincronização | Até desligar/eliminar | Idem | Revogação + cascata |
| Consentimentos WhatsApp | Prova | Até eliminar casamento | Manter prova enquanto houver tratamento | Cascata |
| Snapshots | Recuperação | Até eliminar casamento | Limitar nº/idade (decisão) | Cascata |
| Quarentena de estado | Diagnóstico | `expireAt` +30 d **(TTL Firestore não verificada)** | 30 d com TTL configurada | Cascata (novo) + TTL |
| `_incident_log` | Segurança | Sem limite | 90 d a definir | Cascata; job de limpeza = **gap P2** |
| Logs Cloud Functions | Segurança | Predefinição Google (30 d, a confirmar) | Definir | Google |
| Pagamentos/faturação | Obrigação legal/fiscal | Stripe retém | **Prazo legal a validar com contabilista** | Não apagável de imediato |
| Suporte (email) | Responder | Caixa de email | Definir | Manual |
| Backups | Recuperação | **Desconhecido** (PITR/exports não verificados) | Documentar; não prometer eliminação imediata | Rotação do prestador |

Distinção ao eliminar: **apagado** (Firestore, Storage, Auth, tokens), **revogado** (Google), **retido** (faturação, backups, logs do prestador), **anonimizado** (nenhum processo hoje).
