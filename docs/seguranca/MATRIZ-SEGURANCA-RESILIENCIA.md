# Matriz de segurança e resiliência (Fase K)

Legenda de evidência: **[E]** emulador Firebase real (Firestore/Storage) · **[M]** serviço externo simulado · **[C]** leitura de código · **[X]** não verificado (precisa de produção/credenciais).

| Área | Controlo | Evidência | Resultado |
|---|---|---|---|
| Autenticação | Todas as callables exigem sessão; email verificado exigido (exceto fluxos de convidado por token) | [E] `hard-auth-matrix` (todas as funções onCall descobertas automaticamente) | OK |
| Autenticação | Sessão expirada/revogada, recuperação de password, alteração de email | [X] gerido pelo Firebase Auth; não testável sem projeto real | Pendente |
| Autorização | Funções derivam o casamento da conta autenticada; IDs do cliente ignorados; vítima inalterada | [E] `hard-auth-matrix` | OK |
| Autorização | Co-dono removido perde leitura/escrita (Firestore e Storage) | [E] `hard-rules` | OK |
| Firestore | Coleções só-servidor (12) negam leitura/escrita/apagar ao dono | [E] `hard-rules` | OK |
| Firestore | Subscription não ativável pelo cliente; creatorEmail protegido; json string ≤900 000 | [E] `hard-rules`, `rules-premium`, `rules-phasec` | OK |
| Storage | Isolamento por casamento; SVG/HTML/executáveis recusados; limites 8/15 MB; sem substituição de memórias; Premium expirado só lê/apaga | [E] `hard-rules`, `rules-memdocs` | OK |
| Storage | Limite de nº de ficheiros no upload público; magic bytes | [C] não suportado pelas regras | K-4, K-6 |
| Functions | Webhook Stripe: assinatura, 405, idempotência (sequencial e 5 entregas simultâneas), async MB WAY | [M] `hard-payments` | OK |
| Functions | RevenueCat: Authorization em tempo constante, sandbox ignorado, duplicados, reembolso de transação antiga | [M] `hard-payments` | OK |
| Functions | WhatsApp webhook: assinatura Meta; STOP | [E] suites `consent`/`stop` | OK |
| Functions | Contacto: limites por IP/email, honeypot, stress | [E] `contact`, `contact-stress` | OK |
| Functions | Erros ao cliente genéricos (sem `err.message`) | [C]+[M] `hard-payments` | OK |
| Integrações | OpenAI: `store:false`, JSON Schema estrito, quotas diárias, timeouts, só código HTTP em erros | [M] `privacy-static`, `copilot-classify`, `seating-engine`, `compare` | OK |
| Integrações | Google Calendar: OAuth state de uso único, finalização autenticada, tokens cifrados | [M] `gcal` | OK (credenciais reais: [X]) |
| Integrações | SMTP indisponível não perde pedidos / não duplica | [M] `contact`, `rsvp-reminders` | OK |
| Concorrência | Stripe/RevenueCat entregas simultâneas | [M] `hard-payments` | OK |
| Concorrência | Lembretes RSVP (lease), contacto (transação), RSVP família | [E] `rsvp-reminders`, `contact-stress`, `rules-phasec` | OK |
| Concorrência | Dois dispositivos: fusão por secção em transação | [C]+ função real extraída `hard-scale` | OK; K-8 |
| Recuperação | Eliminação com falha de Storage preserva tudo e permite repetir | [E] `privacy-deletion` | OK |
| Recuperação | Quarentena do estado + snapshots; backups/PITR | [C]; PITR [X] | Parcial |
| Desempenho | 50–1000 convidados: JSON ≤36% do limite; validação <10 ms; AI Seating 600 convidados <4 s (limite de produto 800) | [E]/[M] `hard-scale`, `seating-engine` | OK |
| Desempenho | Consultas com limite (resumo 2000; lembretes 400; limpeza 400) | [C] | OK |
| UX | 14 separadores + 6 definições × 390/768/1360 × PT/EN: sem overflow, sem erros, sem undefined | [E] `ui-sweep` (366 verificações) | OK |
| UX | Contraste/acessibilidade detalhada | [C] revisões anteriores; auditoria WCAG formal não feita | Parcial |
